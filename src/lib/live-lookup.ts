import { queryPackage, OSV_SOURCE, type Lookup, type OsvVulnerability } from './osv';
import { mapOsv, dedupeByAlias, sourceExcerpt } from './live-advisory';
import { assessVersion, reconcileWithSource } from './versions';
import { cacheKey, readCache, writeCache } from './advisory-cache';
import type { Identity } from './package-identity';
import type { Finding, LiveAdvisory, SourceCheck } from './schema';

export type LiveResult = {
  check: SourceCheck;
  findings: Finding[];
  retrieved: number;
  versionMatched: number | null;
  truncated: boolean;
  freshestRecordAt: string | null;
};
export type OsvFetcher = (target: {ecosystem: 'npm'; name: string; version?: string}, signal: AbortSignal) => Promise<Lookup<OsvVulnerability[]>>;

const EVIDENCE_HEADINGS = ['Impact', 'Summary', 'Details', 'Description', 'Overview'];
const REMEDIATION_HEADINGS = ['Patches', 'Patched versions', 'Remediation', 'Fix', 'Fixes', 'Mitigation', 'Workarounds', 'Workaround'];
const RANK: Record<string, number> = {conflict: 0, affected: 1, conditional: 2, unknown: 3, unaffected: 4, 'outside-range': 5};
const SEVERITY_RANK: Record<string, number> = {critical: 0, high: 1, moderate: 2, low: 3};

/** First paragraph of the record's own text, copied verbatim. */
function leadExcerpt(record: LiveAdvisory) {
  const paragraph = record.description.split(/\n\s*\n/).map(p => p.trim()).find(p => p.length >= 12 && !p.startsWith('#'));
  return paragraph?.slice(0, 1800) ?? '';
}

export function buildFinding(record: LiveAdvisory, version: string, sourceMatched: boolean | null): Finding {
  const impact = sourceExcerpt(record, EVIDENCE_HEADINGS);
  const remediation = sourceExcerpt(record, REMEDIATION_HEADINGS);
  const evidence = impact || leadExcerpt(record) || record.title;
  // The excerpt is copied from the retrieved record in application code. Anything
  // that is not a literal substring of the record is not presented as a quote.
  const literal = record.description.includes(evidence) || evidence === record.title;
  return {
    advisory: record,
    assessment: reconcileWithSource(assessVersion(record, version), sourceMatched),
    evidenceQuote: literal ? evidence : record.title,
    impactExcerpt: impact || undefined,
    remediationExcerpt: remediation || undefined,
    knowledgeBase: OSV_SOURCE.name,
    paths: ['npm/' + record.packageName],
    origin: 'live-lookup',
    sourceVersionMatch: sourceMatched,
  };
}

export function orderFindings(findings: Finding[]) {
  return [...findings].sort((a, b) =>
    (RANK[a.assessment.status] ?? 9) - (RANK[b.assessment.status] ?? 9)
    || (SEVERITY_RANK[a.advisory.severity ?? ''] ?? 9) - (SEVERITY_RANK[b.advisory.severity ?? ''] ?? 9)
    || Date.parse(b.advisory.publishedAt) - Date.parse(a.advisory.publishedAt));
}

export async function lookupLive(identity: Identity, version: string, fetcher: OsvFetcher, signal: AbortSignal, now = () => Date.now()): Promise<LiveResult> {
  const startedAt = new Date(now()).toISOString();
  const started = now();
  const base = (status: SourceCheck['status'], detail: string, origin?: SourceCheck['origin']): SourceCheck =>
    ({id: OSV_SOURCE.id, name: OSV_SOURCE.name, url: OSV_SOURCE.url, status, detail, startedAt, durationMs: now() - started, origin});
  const empty = (check: SourceCheck): LiveResult => ({check, findings: [], retrieved: 0, versionMatched: null, truncated: false, freshestRecordAt: null});

  const key = cacheKey(['osv', identity.ecosystem, identity.name]);
  const cached = readCache<OsvVulnerability[]>(key, now());
  let all: OsvVulnerability[];
  let truncated = false;
  let origin: SourceCheck['origin'] = 'live';

  if (cached) {
    all = cached.value; origin = 'cache';
  } else {
    const result = await fetcher({ecosystem: identity.ecosystem, name: identity.name}, signal);
    // A failed lookup is reported as a failed lookup. It never becomes "no vulnerabilities".
    if (!result.ok) return empty(base('failed', result.error + ' Results below do not include OSV.dev coverage.'));
    all = result.data; truncated = result.truncated;
    if (!truncated) writeCache(key, all, now());
  }

  // Second, version-scoped query: the source's own matcher, used to cross-check the
  // deterministic range evaluation performed here.
  let matchedIds: Set<string> | null = null;
  let matchPartial = false;
  if (version) {
    const matchKey = cacheKey(['osv', identity.ecosystem, identity.name, version]);
    const cachedMatch = readCache<string[]>(matchKey, now());
    if (cachedMatch) matchedIds = new Set(cachedMatch.value);
    else {
      const matched = await fetcher({ecosystem: identity.ecosystem, name: identity.name, version}, signal);
      if (matched.ok) {
        matchedIds = new Set(matched.data.map(v => v.id));
        if (!matched.truncated) writeCache(matchKey, [...matchedIds], now());
      } else matchPartial = true;
    }
  }

  const fetchedAt = new Date(cached ? cached.fetchedAt : now()).toISOString();
  const records = dedupeByAlias(all.map(v => mapOsv(v, identity, fetchedAt)).filter((r): r is LiveAdvisory => r !== null));
  const findings = orderFindings(records.map(record => buildFinding(record, version, matchedIds ? matchedIds.has(record.advisoryId) : null)));
  const relevant = version
    ? findings.filter(f => f.assessment.status !== 'outside-range' && f.assessment.status !== 'unaffected')
    : findings;
  const freshest = records.map(r => r.updatedAt).sort().at(-1) ?? null;
  const detail = 'Queried the npm package "' + identity.name + '"' + (version ? ' at version ' + version : ' (no version supplied)')
    + '. Retrieved ' + records.length + ' advisor' + (records.length === 1 ? 'y' : 'ies')
    + (version ? '; ' + relevant.length + ' relevant to this version.' : '.')
    + (truncated ? ' The result set was truncated at the page limit and is incomplete.' : '')
    + (matchPartial ? ' The version-scoped cross-check query failed, so source-side version matching could not be compared.' : '');

  return {
    check: base(truncated || matchPartial ? 'partial' : 'ok', detail, origin),
    findings: relevant.slice(0, 60),
    retrieved: records.length,
    versionMatched: matchedIds ? matchedIds.size : null,
    truncated,
    freshestRecordAt: freshest,
  };
}

export const defaultFetcher: OsvFetcher = (target, signal) => queryPackage(target, signal);
