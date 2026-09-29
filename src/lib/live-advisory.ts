import { createHash } from 'node:crypto';
import { liveAdvisorySchema, type LiveAdvisory } from './schema';
import type { OsvVulnerability } from './osv';
import type { Identity } from './package-identity';

type Event = {introduced?: string; fixed?: string; last_affected?: string; limit?: string};

/** OSV expresses ranges as ordered introduced/fixed events; convert each pair to one interval. */
export function rangeIntervals(events: Event[]): {affected: string; fixed: string | null}[] {
  const out: {affected: string; fixed: string | null}[] = [];
  let lower: string | null = null;
  let open = false;
  const emit = (upper: string | null, inclusive: boolean) => {
    const parts: string[] = [];
    // OSV uses the sentinel "0" for "from the beginning of time".
    if (lower && lower !== '0') parts.push('>=' + lower);
    if (upper) parts.push((inclusive ? '<=' : '<') + upper);
    if (parts.length) out.push({affected: parts.join(' '), fixed: inclusive ? null : upper});
    lower = null; open = false;
  };
  for (const event of events) {
    if (event.introduced !== undefined) {
      if (open) emit(null, false);
      lower = event.introduced; open = true;
      continue;
    }
    if (!open) continue;
    if (event.fixed !== undefined) emit(event.fixed, false);
    else if (event.last_affected !== undefined) emit(event.last_affected, true);
  }
  if (open) emit(null, false);
  return out;
}

export function affectedForPackage(vuln: OsvVulnerability, packageName: string) {
  const entries = (vuln.affected ?? []).filter(a => a.package?.ecosystem === 'npm' && a.package.name === packageName);
  const ranges: {affected: string; fixed: string | null}[] = [];
  const exactVersions: string[] = [];
  const upstream: string[] = [];
  let sawRange = false;
  let allSemver = true;
  for (const entry of entries) {
    for (const range of entry.ranges ?? []) {
      sawRange = true;
      if (range.type !== 'SEMVER') { allSemver = false; continue; }
      ranges.push(...rangeIntervals(range.events));
    }
    for (const version of entry.versions ?? []) if (!exactVersions.includes(version)) exactVersions.push(version);
    const source = entry.database_specific?.source;
    if (typeof source === 'string' && !upstream.includes(source)) upstream.push(source);
  }
  const deduped = ranges.filter((r, i, a) => a.findIndex(o => o.affected === r.affected && o.fixed === r.fixed) === i).slice(0, 50);
  // Only claim semver comparability when every range the source gave is a semver range.
  const comparability: LiveAdvisory['comparability'] =
    deduped.length && allSemver && sawRange ? 'semver'
    : exactVersions.length && !deduped.length ? 'enumerated'
    : 'unsupported';
  return {ranges: deduped, exactVersions: exactVersions.slice(0, 200), comparability, upstream: upstream.slice(0, 20), matched: entries.length > 0};
}

const SEVERITY: Record<string, LiveAdvisory['severity']> = {LOW: 'low', MODERATE: 'moderate', MEDIUM: 'moderate', HIGH: 'high', CRITICAL: 'critical'};
const iso = (value: string | undefined | null, fallback: string) => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
};
const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
};

export function mapOsv(vuln: OsvVulnerability, identity: Identity, fetchedAt: string): LiveAdvisory | null {
  const affected = affectedForPackage(vuln, identity.name);
  // The query was package-scoped, so a record with no matching package entry is
  // not evidence about this package and is dropped rather than reinterpreted.
  if (!affected.matched) return null;
  const aliases = [...new Set([...(vuln.aliases ?? []), ...(vuln.related ?? [])])].filter(a => a !== vuln.id).slice(0, 50);
  const cve = [vuln.id, ...aliases].find(a => /^CVE-\d{4}-\d{4,}$/.test(a)) ?? null;
  const modified = iso(vuln.modified, fetchedAt);
  const severityLabel = typeof vuln.database_specific?.severity === 'string' ? SEVERITY[vuln.database_specific.severity.toUpperCase()] ?? null : null;
  const vector = vuln.severity?.find(s => s.type.startsWith('CVSS'))?.score ?? null;
  const references = [...new Set((vuln.references ?? []).map(r => safeUrl(r.url)).filter((u): u is string => Boolean(u)))].slice(0, 100);
  const title = (vuln.summary?.trim() || vuln.details?.trim().split('\n')[0]?.replace(/^#+\s*/, '').trim() || vuln.id).slice(0, 500);
  const parsed = liveAdvisorySchema.safeParse({
    advisoryId: vuln.id, aliases, cve, title,
    vendor: null, product: identity.display, packageName: identity.name, ecosystem: 'npm',
    description: (vuln.details ?? '').slice(0, 100000),
    severity: severityLabel, cvss: null, cvssVector: vector,
    ranges: affected.ranges, exactVersions: affected.exactVersions, comparability: affected.comparability,
    unaffectedRanges: [], conditions: null, conditionsReviewed: false, remediation: null, exploitation: null,
    sourceUrl: 'https://osv.dev/vulnerability/' + vuln.id,
    references,
    publishedAt: iso(vuln.published, modified), updatedAt: modified, fetchedAt,
    withdrawnAt: vuln.withdrawn ? iso(vuln.withdrawn, modified) : null,
    provenance: {
      provider: 'OSV.dev', apiUrl: 'https://api.osv.dev/v1/query',
      sha256: createHash('sha256').update(JSON.stringify(vuln)).digest('hex'),
      upstreamSources: affected.upstream,
    },
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Collapse records that describe the same vulnerability under different identifiers.
 * Ranges are unioned rather than replaced, so an alias never drops a distinct
 * version range, and records whose ranges genuinely disagree are kept separate.
 */
export function dedupeByAlias(records: LiveAdvisory[]): LiveAdvisory[] {
  const out: LiveAdvisory[] = [];
  for (const record of records) {
    const identifiers = new Set([record.advisoryId, ...record.aliases]);
    const existing = out.find(kept =>
      identifiers.has(kept.advisoryId) || kept.aliases.some(a => identifiers.has(a)));
    if (!existing) { out.push({...record}); continue; }
    if (existing.packageName !== record.packageName) { out.push({...record}); continue; }
    const merged = [...existing.ranges];
    let differs = false;
    for (const range of record.ranges) {
      if (!merged.some(r => r.affected === range.affected && r.fixed === range.fixed)) { merged.push(range); differs = true; }
    }
    if (record.ranges.length !== existing.ranges.length) differs = true;
    // Keep both records when the sources disagree about ranges; do not pick a winner.
    if (differs) { out.push({...record}); continue; }
    existing.aliases = [...new Set([...existing.aliases, record.advisoryId, ...record.aliases])].filter(a => a !== existing.advisoryId).slice(0, 50);
  }
  return out;
}

/** Verbatim excerpt from the record's own text. No model involvement, no paraphrase. */
export function sourceExcerpt(record: LiveAdvisory, headings: string[]): string {
  const text = record.description;
  if (!text.trim()) return '';
  for (const heading of headings) {
    const match = text.match(new RegExp('^#{1,6}\\s*' + heading + '\\s*$', 'im'));
    if (match?.index === undefined) continue;
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const next = rest.search(/^#{1,6}\s+\S/m);
    const section = (next === -1 ? rest : rest.slice(0, next)).trim();
    if (section.length >= 12) return section.slice(0, 1800);
  }
  return '';
}
