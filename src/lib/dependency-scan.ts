import { queryBatch, queryPackage, OSV_SOURCE, type Lookup, type OsvVulnerability } from './osv';
import { mapOsv, dedupeByAlias } from './live-advisory';
import { buildFinding, orderFindings } from './live-lookup';
import type { Dependency, LockfileParse } from './lockfile';
import type { Finding, LiveAdvisory, SourceCheck } from './schema';

export type DependencyResult = {
  name: string; version: string; dev: boolean; paths: string[];
  advisoryIds: string[];
  findings: Finding[];
  /** False when the identifier matched but full records were not fetched for this package. */
  detailed: boolean;
};
export type DependencyReport = {
  requestId: string; createdAt: string;
  lockfileVersion: number;
  counts: {dependencies: number; queried: number; withAdvisories: number; advisories: number};
  results: DependencyResult[];
  skipped: {reason: string; count: number}[];
  truncated: boolean;
  detailLimitReached: boolean;
  source: SourceCheck;
  complete: boolean;
  limitations: string[];
};

export type BatchFetcher = (targets: {ecosystem: 'npm'; name: string; version?: string}[], signal: AbortSignal) => Promise<Lookup<{target: {name: string; version?: string}; ids: string[]; truncated: boolean}[]>>;
export type DetailFetcher = (target: {ecosystem: 'npm'; name: string}, signal: AbortSignal) => Promise<Lookup<OsvVulnerability[]>>;

/** Packages for which full advisory records are fetched, to keep one upload bounded. */
export const DETAIL_LIMIT = 25;

export async function scanDependencies(
  parsed: LockfileParse, signal: AbortSignal,
  batch: BatchFetcher = (t, s) => queryBatch(t, s),
  detail: DetailFetcher = (t, s) => queryPackage(t, s),
  now = () => Date.now(),
): Promise<DependencyReport> {
  const startedAt = new Date(now()).toISOString();
  const started = now();
  const check = (status: SourceCheck['status'], detailText: string): SourceCheck =>
    ({id: OSV_SOURCE.id, name: OSV_SOURCE.name, url: OSV_SOURCE.url, status, detail: detailText, startedAt, durationMs: now() - started, origin: 'live'});
  const base = {
    requestId: crypto.randomUUID(), createdAt: startedAt, lockfileVersion: parsed.lockfileVersion,
    skipped: parsed.skipped, truncated: parsed.truncated,
  };
  const deps = parsed.dependencies;
  const targets = deps.map(d => ({ecosystem: 'npm' as const, name: d.name, version: d.version}));

  const matched = await batch(targets, signal);
  if (!matched.ok) {
    return {
      ...base, counts: {dependencies: deps.length, queried: 0, withAdvisories: 0, advisories: 0},
      results: [], detailLimitReached: false, complete: false,
      source: check('failed', matched.error + ' No dependency was checked, so this is not a clean result.'),
      limitations: ['The dependency lookup did not complete. This report shows nothing about your dependencies and must not be read as an absence of advisories.'],
    };
  }

  const hits = matched.data
    .map((entry, index) => ({dependency: deps[index] as Dependency, ids: entry.ids, truncated: entry.truncated}))
    .filter(entry => entry.ids.length > 0);

  // Fetch full records only for the most-affected packages, so one upload stays bounded.
  const detailOrder = [...new Set(hits.map(h => h.dependency.name))]
    .sort((a, b) => Math.max(...hits.filter(h => h.dependency.name === b).map(h => h.ids.length)) - Math.max(...hits.filter(h => h.dependency.name === a).map(h => h.ids.length)));
  const detailNames = new Set(detailOrder.slice(0, DETAIL_LIMIT));
  const records = new Map<string, LiveAdvisory[]>();
  let detailFailures = 0;
  for (const name of detailNames) {
    if (signal.aborted) break;
    const result = await detail({ecosystem: 'npm', name}, signal);
    if (!result.ok) { detailFailures++; continue; }
    const identity = {ecosystem: 'npm' as const, name, display: name, basis: 'exact-package-name' as const};
    const fetchedAt = new Date(now()).toISOString();
    records.set(name, dedupeByAlias(result.data.map(v => mapOsv(v, identity, fetchedAt)).filter((r): r is LiveAdvisory => r !== null)));
  }

  const results: DependencyResult[] = hits.map(hit => {
    const available = records.get(hit.dependency.name) ?? [];
    const relevant = available.filter(record => hit.ids.includes(record.advisoryId) || record.aliases.some(a => hit.ids.includes(a)));
    return {
      name: hit.dependency.name, version: hit.dependency.version, dev: hit.dependency.dev, paths: hit.dependency.paths,
      advisoryIds: hit.ids,
      findings: orderFindings(relevant.map(record => buildFinding(record, hit.dependency.version, true))),
      detailed: records.has(hit.dependency.name),
    };
  }).sort((a, b) => b.advisoryIds.length - a.advisoryIds.length || a.name.localeCompare(b.name));

  const detailLimitReached = detailOrder.length > DETAIL_LIMIT;
  const partial = detailLimitReached || detailFailures > 0 || parsed.truncated || hits.some(h => h.truncated);
  const advisories = new Set(hits.flatMap(h => h.ids)).size;
  const limitations = [
    'This checks the exact package versions recorded in your lockfile against published advisories. It does not analyse your own code, your runtime configuration, or how each dependency is actually used.',
    'A dependency with no advisory is not proven safe. It only means these sources published nothing matching that exact version.',
    'Applicability is reported per dependency from the source’s own version matching. Whether a vulnerable code path is reachable in your application still requires review.',
    'Source-listed fixed versions may refer to different release branches. They are not a single recommended upgrade target; check every relevant advisory and choose a supported release.',
  ];
  if (parsed.truncated) limitations.push('The lockfile contained more dependencies than this application will query in one request, so some were not checked.');
  if (detailLimitReached) limitations.push('Full advisory records were fetched for the ' + DETAIL_LIMIT + ' most-affected packages. Other affected packages list advisory identifiers only; look them up individually for details.');
  if (detailFailures) limitations.push(detailFailures + ' package(s) matched but their full records could not be retrieved, so their details are missing.');

  return {
    ...base,
    counts: {dependencies: deps.length, queried: targets.length, withAdvisories: hits.length, advisories},
    results, detailLimitReached, complete: !partial,
    source: check(partial ? 'partial' : 'ok',
      'Queried ' + targets.length + ' exact package versions from the lockfile. ' + hits.length + ' had at least one matching advisory'
      + (detailLimitReached ? '; full records fetched for the top ' + DETAIL_LIMIT + ' packages' : '')
      + (detailFailures ? '; ' + detailFailures + ' detail lookup(s) failed' : '') + '.'),
    limitations,
  };
}
