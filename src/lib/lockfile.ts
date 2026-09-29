import { z } from 'zod';

// package-lock.json is parsed strictly as data. Nothing in the file is executed,
// resolved from the network, or used to build a filesystem path.
export type Dependency = {name: string; version: string; paths: string[]; dev: boolean};
export type LockfileParse = {
  lockfileVersion: number;
  dependencies: Dependency[];
  skipped: {reason: string; count: number}[];
  truncated: boolean;
};

const NPM_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const SEMVERISH = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;
export const MAX_DEPENDENCIES = 1500;

const v3Entry = z.object({version: z.string().optional(), dev: z.boolean().optional(), link: z.boolean().optional(), resolved: z.string().optional()}).loose();
const v1Entry: z.ZodType<{version?: string; dev?: boolean; dependencies?: Record<string, unknown>}> = z.lazy(() =>
  z.object({version: z.string().optional(), dev: z.boolean().optional(), dependencies: z.record(z.string(), v1Entry).optional()}).loose());
const lockfile = z.object({
  lockfileVersion: z.number().int().min(1).max(9).optional(),
  packages: z.record(z.string(), v3Entry).optional(),
  dependencies: z.record(z.string(), v1Entry).optional(),
}).loose();

/** "node_modules/a/node_modules/@scope/b" -> "@scope/b" */
export function packageNameFromPath(path: string): string | null {
  const marker = 'node_modules/';
  const index = path.lastIndexOf(marker);
  if (index === -1) return null;
  const name = path.slice(index + marker.length);
  return name && NPM_NAME.test(name) ? name : null;
}

export function parseLockfile(raw: unknown): LockfileParse {
  const parsed = lockfile.safeParse(raw);
  if (!parsed.success) throw new Error('This file is not a package-lock.json document.');
  const file = parsed.data;
  if (!file.packages && !file.dependencies) throw new Error('No dependency entries were found. Supply a package-lock.json, not a package.json.');
  const found = new Map<string, Dependency>();
  const skipped = new Map<string, number>();
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1);
  const add = (name: string, version: string | undefined, path: string, dev: boolean) => {
    if (!NPM_NAME.test(name)) return skip('entry name is not a valid npm package name');
    // Only exact published versions can be matched against advisory ranges.
    if (!version || !SEMVERISH.test(version)) return skip('no exact published version recorded (workspace, link, git or file dependency)');
    const key = name + '@' + version;
    const existing = found.get(key);
    if (existing) { if (existing.paths.length < 5 && !existing.paths.includes(path)) existing.paths.push(path); if (!dev) existing.dev = false; return; }
    found.set(key, {name, version, paths: [path], dev});
  };

  if (file.packages) {
    for (const [path, entry] of Object.entries(file.packages)) {
      if (path === '') continue; // the root project itself
      if (entry.link) { skip('symlinked workspace entry'); continue; }
      const name = packageNameFromPath(path);
      if (!name) { skip('entry path is not under node_modules'); continue; }
      add(name, entry.version, path, entry.dev === true);
    }
  } else if (file.dependencies) {
    const walk = (tree: Record<string, {version?: string; dev?: boolean; dependencies?: Record<string, unknown>}>, prefix: string, depth: number) => {
      if (depth > 30) { skip('dependency tree deeper than the traversal limit'); return; }
      for (const [name, entry] of Object.entries(tree)) {
        const path = prefix + 'node_modules/' + name;
        add(name, entry.version, path, entry.dev === true);
        if (entry.dependencies) walk(entry.dependencies as Record<string, {version?: string; dev?: boolean}>, path + '/', depth + 1);
      }
    };
    walk(file.dependencies, '', 0);
  }

  const all = [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
  const truncated = all.length > MAX_DEPENDENCIES;
  return {
    lockfileVersion: file.lockfileVersion ?? (file.packages ? 3 : 1),
    dependencies: all.slice(0, MAX_DEPENDENCIES),
    skipped: [...skipped.entries()].map(([reason, count]) => ({reason, count})),
    truncated,
  };
}
