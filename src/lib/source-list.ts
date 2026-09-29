import { z } from 'zod';
import { sources as seed } from './ingestion';

/** The curated import list. Editable as data so new advisories need no code change. */
export const advisorySource = z.object({
  id: z.string().regex(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/),
  product: z.string().min(1).max(120),
  packageName: z.string().min(1).max(214),
  ecosystem: z.literal('npm').default('npm'),
  addedAt: z.iso.datetime().optional(),
});
export type AdvisorySource = z.infer<typeof advisorySource>;
export const sourceList = z.object({
  dataset: z.literal('production'),
  sources: z.array(advisorySource).max(500),
});
export type SourceList = z.infer<typeof sourceList>;

export const defaultSourceList = (): SourceList => ({
  dataset: 'production',
  sources: seed.map(s => ({...s, ecosystem: 'npm' as const})),
});

export function parseSourceList(raw: unknown): SourceList {
  const parsed = sourceList.safeParse(raw);
  if (!parsed.success) throw new Error('The advisory source list is not valid: ' + parsed.error.issues.map(i => i.path.join('.') + ' ' + i.message).join('; '));
  return parsed.data;
}

/** Idempotent: an advisory already on the list is never duplicated or silently rewritten. */
export function mergeSources(list: SourceList, additions: AdvisorySource[]) {
  const sources = [...list.sources];
  const added: AdvisorySource[] = [];
  const skipped: {id: string; reason: string}[] = [];
  for (const addition of additions) {
    const existing = sources.find(s => s.id === addition.id);
    if (existing) {
      skipped.push({id: addition.id, reason: existing.packageName === addition.packageName ? 'already on the list' : 'already on the list for package ' + existing.packageName});
      continue;
    }
    sources.push(addition);
    added.push(addition);
  }
  return {list: {...list, sources}, added, skipped};
}
