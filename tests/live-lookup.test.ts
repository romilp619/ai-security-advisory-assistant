import { describe, it, expect, beforeEach, vi } from 'vitest';
import osvNext from './fixtures/osv-npm-next.json';
import { rangeIntervals, mapOsv, dedupeByAlias, sourceExcerpt, affectedForPackage } from '../src/lib/live-advisory';
import { assessVersion, reconcileWithSource } from '../src/lib/versions';
import { resolveIdentity } from '../src/lib/package-identity';
import { lookupLive, buildFinding, type OsvFetcher } from '../src/lib/live-lookup';
import { clearCache } from '../src/lib/advisory-cache';
import { liveAdvisorySchema, type LiveAdvisory } from '../src/lib/schema';
import type { OsvVulnerability } from '../src/lib/osv';

const identity = {ecosystem: 'npm' as const, name: 'next', display: 'Next.js', basis: 'known-alias' as const};
const FETCHED = '2026-09-24T00:00:00.000Z';
const vulns = osvNext.vulns as unknown as OsvVulnerability[];
const byId = (id: string) => vulns.find(v => v.id === id)!;
const mapped = (id: string) => mapOsv(byId(id), identity, FETCHED)!;
beforeEach(() => clearCache());

describe('OSV range events become explicit intervals', () => {
  it('translates introduced/fixed pairs, the "0" sentinel, last_affected and open ranges', () => {
    expect(rangeIntervals([{introduced: '14.0.0'}, {fixed: '14.2.25'}])).toEqual([{affected: '>=14.0.0 <14.2.25', fixed: '14.2.25'}]);
    expect(rangeIntervals([{introduced: '0'}, {fixed: '1.2.3'}])).toEqual([{affected: '<1.2.3', fixed: '1.2.3'}]);
    // last_affected is inclusive and names no fixed version; it must not be reported as one.
    expect(rangeIntervals([{introduced: '1.0.0'}, {last_affected: '1.5.0'}])).toEqual([{affected: '>=1.0.0 <=1.5.0', fixed: null}]);
    expect(rangeIntervals([{introduced: '2.0.0'}])).toEqual([{affected: '>=2.0.0', fixed: null}]);
    expect(rangeIntervals([{introduced: '1.0.0'}, {fixed: '1.1.0'}, {introduced: '2.0.0'}, {fixed: '2.1.0'}]))
      .toEqual([{affected: '>=1.0.0 <1.1.0', fixed: '1.1.0'}, {affected: '>=2.0.0 <2.1.0', fixed: '2.1.0'}]);
  });
});

describe('real OSV records normalize without inventing data', () => {
  const next = mapped('GHSA-f82v-jwr5-mffw');
  it('preserves identity, branch fixes, aliases and provenance', () => {
    expect(liveAdvisorySchema.safeParse(next).success).toBe(true);
    expect(next.cve).toBe('CVE-2025-29927');
    expect(next.aliases).toContain('CVE-2025-29927');
    expect(next.ranges).toContainEqual({affected: '>=14.0.0 <14.2.25', fixed: '14.2.25'});
    expect(next.ranges).toContainEqual({affected: '>=15.0.0 <15.2.3', fixed: '15.2.3'});
    expect(next.severity).toBe('critical');
    expect(next.sourceUrl).toBe('https://osv.dev/vulnerability/GHSA-f82v-jwr5-mffw');
    expect(next.provenance.provider).toBe('OSV.dev');
    expect(next.provenance.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(next.provenance.upstreamSources.join(' ')).toContain('github/advisory-database');
  });
  it('carries the published CVSS vector and never derives a numeric score from it', () => {
    expect(next.cvssVector).toMatch(/^CVSS:/);
    expect(next.cvss).toBeNull();
  });
  it('does not manufacture review state, remediation or exploitation', () => {
    expect(next.conditionsReviewed).toBe(false);
    expect(next.conditions).toBeNull();
    expect(next.remediation).toBeNull();
    expect(next.exploitation).toBeNull();
    expect(next.unaffectedRanges).toEqual([]);
  });
  it('drops records that carry no entry for the queried package', () => {
    expect(mapOsv(byId('GHSA-f82v-jwr5-mffw'), {...identity, name: 'not-next'}, FETCHED)).toBeNull();
  });
  it('refuses to claim semver comparability when the source mixes range types', () => {
    // GHSA-3h52-269p-cp9r publishes both SEMVER and ECOSYSTEM ranges for next.
    expect(affectedForPackage(byId('GHSA-3h52-269p-cp9r'), 'next').comparability).toBe('unsupported');
  });
  it('records enumerated affected versions where the source lists them individually', () => {
    expect(affectedForPackage(byId('GHSA-223j-4rm8-mrmf'), 'next').exactVersions.length).toBeGreaterThan(0);
  });
});

describe('deterministic applicability for live records', () => {
  const next = mapped('GHSA-f82v-jwr5-mffw');
  it.each(['14.2.24', '13.5.8', '15.2.2'])('flags affected branch %s as conditional because live records are unreviewed', version => {
    expect(assessVersion(next, version).status).toBe('conditional');
  });
  it.each(['14.2.25', '13.5.9', '15.2.3'])('places patched %s outside the range without calling it safe', version => {
    const result = assessVersion(next, version);
    expect(result.status).toBe('outside-range');
    expect(result.reason).toContain('does not establish that the software is safe');
  });
  it.each(['', '14.2.24-canary.1', '14.2.24+vendor.1', '14.2'])('treats %s conservatively', version => {
    expect(assessVersion(next, version).status).toBe('unknown');
  });
  it('honours an inclusive last_affected boundary', () => {
    const inclusive: LiveAdvisory = {...next, ranges: [{affected: '>=1.0.0 <=1.5.0', fixed: null}]};
    expect(assessVersion(inclusive, '1.5.0').status).toBe('conditional');
    expect(assessVersion(inclusive, '1.5.1').status).toBe('outside-range');
  });
  it('keeps a real advisory whose boundaries are prereleases out of automated comparison', () => {
    // GHSA-5f7q-jpqc-wp7h bounds every range with canary builds.
    const record = mapped('GHSA-5f7q-jpqc-wp7h');
    expect(record.ranges.some(r => r.affected.includes('<='))).toBe(true);
    expect(assessVersion(record, '15.0.0-canary.205').status).toBe('unknown');
  });
  it('refuses to compare versions when the source ranges are not semver', () => {
    const record = mapped('GHSA-3h52-269p-cp9r');
    expect(record.comparability).toBe('unsupported');
    expect(assessVersion(record, '15.0.0').status).toBe('unknown');
  });
  it('uses enumerated versions exactly, never by proximity', () => {
    const record = mapped('GHSA-223j-4rm8-mrmf');
    const enumerated: LiveAdvisory = {...record, comparability: 'enumerated', ranges: [], exactVersions: ['15.2.2']};
    expect(assessVersion(enumerated, '15.2.2').status).toBe('conditional');
    expect(assessVersion(enumerated, '15.2.1').status).toBe('outside-range');
  });
  it('never assesses a withdrawn record', () => {
    expect(assessVersion({...next, withdrawnAt: FETCHED}, '14.2.24').status).toBe('unknown');
  });
});

describe('cross-checking the source version matcher', () => {
  it('reports disagreement in both directions instead of resolving it', () => {
    expect(reconcileWithSource({status: 'outside-range', reason: 'r'}, true).status).toBe('conflict');
    expect(reconcileWithSource({status: 'conditional', reason: 'r'}, false).status).toBe('conflict');
  });
  it('leaves agreeing assessments untouched, and does nothing without a source verdict', () => {
    expect(reconcileWithSource({status: 'conditional', reason: 'r'}, true).status).toBe('conditional');
    expect(reconcileWithSource({status: 'outside-range', reason: 'r'}, false).status).toBe('outside-range');
    expect(reconcileWithSource({status: 'unknown', reason: 'r'}, null).status).toBe('unknown');
  });
});

describe('alias handling', () => {
  const base = mapped('GHSA-f82v-jwr5-mffw');
  it('merges records that share an identifier when their ranges agree', () => {
    const alias: LiveAdvisory = {...base, advisoryId: 'CVE-2025-29927', aliases: ['GHSA-f82v-jwr5-mffw'], sourceUrl: 'https://osv.dev/vulnerability/CVE-2025-29927'};
    const merged = dedupeByAlias([base, alias]);
    expect(merged).toHaveLength(1);
    expect(merged[0].aliases).toContain('CVE-2025-29927');
  });
  it('keeps both records when aliased sources disagree about version ranges', () => {
    const alias: LiveAdvisory = {...base, advisoryId: 'CVE-2025-29927', aliases: ['GHSA-f82v-jwr5-mffw'], ranges: [{affected: '>=14.0.0 <14.9.9', fixed: '14.9.9'}], sourceUrl: 'https://osv.dev/vulnerability/CVE-2025-29927'};
    expect(dedupeByAlias([base, alias])).toHaveLength(2);
  });
  it('never merges across different packages', () => {
    const other: LiveAdvisory = {...base, packageName: 'next-auth', aliases: ['GHSA-f82v-jwr5-mffw'], advisoryId: 'CVE-2025-29927', sourceUrl: 'https://osv.dev/vulnerability/CVE-2025-29927'};
    expect(dedupeByAlias([base, other])).toHaveLength(2);
  });
});

describe('evidence is copied, never composed', () => {
  const next = mapped('GHSA-f82v-jwr5-mffw');
  it('takes excerpts verbatim from the retrieved record', () => {
    const finding = buildFinding(next, '14.2.24', true);
    expect(next.description.includes(finding.evidenceQuote) || finding.evidenceQuote === next.title).toBe(true);
    if (finding.remediationExcerpt) expect(next.description).toContain(finding.remediationExcerpt);
    if (finding.impactExcerpt) expect(next.description).toContain(finding.impactExcerpt);
    expect(finding.origin).toBe('live-lookup');
  });
  it('quotes the documented patch section rather than summarising it', () => {
    expect(sourceExcerpt(next, ['Patches'])).toContain('14.2.25');
  });
  it('falls back to the record title when the source carries no usable prose', () => {
    const bare: LiveAdvisory = {...next, description: ''};
    expect(buildFinding(bare, '14.2.24', null).evidenceQuote).toBe(bare.title);
  });
});

describe('package identity resolution', () => {
  it('maps display names to exact npm packages', () => {
    const result = resolveIdentity('Next.js');
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') expect(result.identity.name).toBe('next');
  });
  it('accepts an exact package name, including a scoped one', () => {
    for (const name of ['lodash', '@angular/core']) {
      const result = resolveIdentity(name);
      expect(result.status).toBe('resolved');
      if (result.status === 'resolved') expect(result.identity.name).toBe(name);
    }
  });
  it('asks instead of guessing when a display name maps to several packages', () => {
    const result = resolveIdentity('Angular');
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') expect(result.candidates.map(c => c.name)).toEqual(['@angular/core', 'angular']);
  });
  it('refuses names that are not valid npm packages', () => {
    expect(resolveIdentity('Some Vendor Appliance 9').status).toBe('unsupported');
  });
});

describe('live lookup reporting', () => {
  const ok = (data: OsvVulnerability[], truncated = false): OsvFetcher => vi.fn(async () => ({ok: true as const, data, pages: 1, truncated}));
  const signal = () => new AbortController().signal;

  it('returns findings, counts and a completed source check', async () => {
    const result = await lookupLive(identity, '14.2.24', ok(vulns), signal());
    expect(result.check.status).toBe('ok');
    expect(result.check.origin).toBe('live');
    expect(result.retrieved).toBe(vulns.length);
    expect(result.findings.some(f => f.advisory.advisoryId === 'GHSA-f82v-jwr5-mffw')).toBe(true);
    expect(result.freshestRecordAt).toBeTruthy();
  });
  it('excludes versions outside every documented range from a version-scoped report', async () => {
    // Realistic source behaviour: the version-scoped query returns nothing for a patched version.
    let call = 0;
    const fetcher: OsvFetcher = vi.fn(async () => ({ok: true as const, data: call++ === 0 ? [byId('GHSA-f82v-jwr5-mffw')] : [], pages: 1, truncated: false}));
    const result = await lookupLive(identity, '14.2.25', fetcher, signal());
    expect(result.findings).toHaveLength(0);
    expect(result.retrieved).toBe(1);
    expect(result.check.status).toBe('ok');
    expect(result.check.detail).toContain('0 relevant to this version');
  });
  it('raises a conflict when the source matches a version that the published ranges do not', async () => {
    // Both queries return the advisory, so the source claims 14.2.25 is affected
    // while its own ranges say it is fixed. Neither side is silently preferred.
    const result = await lookupLive(identity, '14.2.25', ok([byId('GHSA-f82v-jwr5-mffw')]), signal());
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].assessment.status).toBe('conflict');
    expect(result.findings[0].sourceVersionMatch).toBe(true);
  });
  it('never presents a failed lookup as an absence of vulnerabilities', async () => {
    const failing: OsvFetcher = vi.fn(async () => ({ok: false as const, error: 'OSV.dev rate limit reached. The lookup did not complete.', retryable: true}));
    const result = await lookupLive(identity, '14.2.24', failing, signal());
    expect(result.check.status).toBe('failed');
    expect(result.findings).toEqual([]);
    expect(result.check.detail).toContain('did not complete');
    expect(result.check.detail).not.toMatch(/no (known )?vulnerabilit/i);
  });
  it('degrades to partial when only the version cross-check fails', async () => {
    let call = 0;
    const fetcher: OsvFetcher = vi.fn(async () => {
      call++;
      return call === 1 ? {ok: true as const, data: vulns, pages: 1, truncated: false} : {ok: false as const, error: 'timeout', retryable: true};
    });
    const result = await lookupLive(identity, '14.2.24', fetcher, signal());
    expect(result.check.status).toBe('partial');
    expect(result.check.detail).toContain('cross-check');
    expect(result.findings.length).toBeGreaterThan(0);
  });
  it('reports truncation rather than treating a partial page set as the whole', async () => {
    const result = await lookupLive(identity, '', ok(vulns, true), signal());
    expect(result.truncated).toBe(true);
    expect(result.check.status).toBe('partial');
    expect(result.check.detail).toContain('truncated');
  });
  it('serves a repeat lookup from cache and labels it as cached', async () => {
    const fetcher = ok(vulns);
    await lookupLive(identity, '', fetcher, signal());
    const second = await lookupLive(identity, '', fetcher, signal());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(second.check.origin).toBe('cache');
  });
  it('does not cache a truncated result set', async () => {
    const fetcher = ok(vulns, true);
    await lookupLive(identity, '', fetcher, signal());
    await lookupLive(identity, '', fetcher, signal());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('unevaluated ranges are not reported as contradictions', () => {
  it('adopts the source verdict when this application cannot compare the ranges', () => {
    const result = reconcileWithSource({status: 'unknown', reason: 'ranges are not comparable semver'}, true);
    expect(result.status).toBe('conditional');
    expect(result.reason).toContain('could not evaluate');
    expect(result.reason).toContain('version matcher');
  });
  it('stays unknown when neither side establishes a match', () => {
    expect(reconcileWithSource({status: 'unknown', reason: 'r'}, false).status).toBe('unknown');
  });
  it('still reports a genuine disagreement as a conflict', () => {
    expect(reconcileWithSource({status: 'outside-range', reason: 'r'}, true).status).toBe('conflict');
    expect(reconcileWithSource({status: 'conditional', reason: 'r'}, false).status).toBe('conflict');
  });
});
