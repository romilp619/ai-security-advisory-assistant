import { z } from 'zod';

export const researchInput = z.object({
  software: z.string().trim().min(1).max(80).regex(/^[\p{L}\p{N} ._@/+()-]+$/u, 'Use a software name, not a URL or command.'),
  version: z.string().trim().max(80).regex(/^[a-zA-Z0-9.+_~:-]*$/, 'Enter a single version, not a range.').default(''),
  question: z.string().trim().min(8, 'Add a little more detail (at least 8 characters).').max(2000),
}).strict();
export type ResearchInput = z.infer<typeof researchInput>;
export const httpsUrl = z.url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'An HTTPS source URL is required.');
export const referenceUrl = z.url().refine(value => ['https:', 'http:'].includes(new URL(value).protocol) && !new URL(value).username && !new URL(value).password);
export const advisorySchema = z.object({
  _id: z.string().regex(/^advisory-[A-Za-z0-9-]+$/),
  _type: z.literal('securityAdvisory'),
  advisoryId: z.string().regex(/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/),
  cve: z.string().regex(/^CVE-\d{4}-\d{4,}$/).nullable(),
  title: z.string().min(1).max(500),
  vendor: z.string().nullable(), product: z.string().min(1), packageName: z.string().min(1),
  ecosystem: z.string(),
  description: z.string().min(1).max(100000),
  severity: z.enum(['low', 'moderate', 'high', 'critical']).nullable(),
  cvss: z.number().min(0).max(10).nullable(),
  ranges: z.array(z.object({ affected: z.string().min(1), fixed: z.string().nullable() })).max(50),
  unaffectedRanges: z.array(z.string()).default([]),
  // null = not reviewed; [] = reviewer established no additional conditions.
  conditions: z.array(z.string()).nullable(),
  conditionsReviewed: z.boolean().default(false),
  remediation: z.string().nullable(),
  exploitation: z.object({ status: z.string(), sourceUrl: httpsUrl }).nullable(),
  sourceUrl: httpsUrl,
  references: z.array(referenceUrl).max(100),
  publishedAt: z.iso.datetime(), updatedAt: z.iso.datetime(), fetchedAt: z.iso.datetime(),
  withdrawnAt: z.iso.datetime().nullable(),
  provenance: z.object({ provider: z.literal('GitHub Security Advisories'), apiUrl: httpsUrl, sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
}).refine(d => {
  const u = new URL(d.sourceUrl);
  return u.hostname === 'github.com' && (u.pathname === '/advisories/' + d.advisoryId || (u.pathname.includes('/security/advisories/') && u.pathname.endsWith('/' + d.advisoryId)))
    && d.provenance.apiUrl === 'https://api.github.com/advisories/' + d.advisoryId;
}, 'Source identity must match the original GitHub advisory.').refine(d => !d.conditionsReviewed || d.conditions !== null, 'Reviewed conditions must be explicit.');
export type Advisory = z.infer<typeof advisorySchema>;

// A record fetched live from OSV.dev at request time. It is deliberately a separate
// contract from `advisorySchema`: curated records are reviewed and stored in Sanity,
// live records are not. Shared field names let one UI render both, while `provenance`
// and `origin` always state which is which.
export const liveAdvisorySchema = z.object({
  advisoryId: z.string().regex(/^[A-Z][A-Z0-9]{1,15}-[A-Za-z0-9.-]{1,64}$/),
  aliases: z.array(z.string().max(128)).max(50),
  cve: z.string().regex(/^CVE-\d{4}-\d{4,}$/).nullable(),
  title: z.string().min(1).max(500),
  vendor: z.string().nullable(), product: z.string().min(1), packageName: z.string().min(1),
  ecosystem: z.literal('npm'),
  description: z.string().max(100000),
  severity: z.enum(['low', 'moderate', 'high', 'critical']).nullable(),
  // OSV publishes CVSS vectors, not numeric scores. A score is never derived here.
  cvss: z.null(),
  cvssVector: z.string().max(200).nullable(),
  ranges: z.array(z.object({affected: z.string().min(1), fixed: z.string().nullable()})).max(50),
  exactVersions: z.array(z.string().max(64)).max(200),
  // How the source expresses versions, which decides whether semver comparison is valid.
  comparability: z.enum(['semver', 'enumerated', 'unsupported']),
  unaffectedRanges: z.array(z.string()).default([]),
  conditions: z.array(z.string()).nullable(),
  conditionsReviewed: z.literal(false),
  remediation: z.string().nullable(),
  exploitation: z.object({status: z.string(), sourceUrl: httpsUrl}).nullable(),
  sourceUrl: httpsUrl,
  references: z.array(referenceUrl).max(100),
  publishedAt: z.iso.datetime(), updatedAt: z.iso.datetime(), fetchedAt: z.iso.datetime(),
  withdrawnAt: z.iso.datetime().nullable(),
  provenance: z.object({
    provider: z.literal('OSV.dev'),
    apiUrl: httpsUrl,
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    // The upstream databases OSV aggregated this record from.
    upstreamSources: z.array(z.string().max(300)).max(20),
  }),
}).refine(d => d.sourceUrl === 'https://osv.dev/vulnerability/' + d.advisoryId, 'Source identity must match the OSV record.');
export type LiveAdvisory = z.infer<typeof liveAdvisorySchema>;
export type AnyAdvisory = Advisory | LiveAdvisory;
export const isLive = (a: AnyAdvisory): a is LiveAdvisory => a.provenance.provider === 'OSV.dev';

export type Assessment = {status: 'affected' | 'unaffected' | 'conditional' | 'outside-range' | 'unknown' | 'conflict'; reason: string};
export type Activity = {stage: string; detail: string; at: string};
export type Finding = {
  advisory: AnyAdvisory;
  assessment: Assessment;
  evidenceQuote: string;
  impactExcerpt?: string;
  remediationExcerpt?: string;
  knowledgeBase: string;
  paths: string[];
  // Where this finding came from, so no reader has to infer it.
  origin: 'knowledge-base' | 'live-lookup' | 'knowledge-base+live';
  // Whether OSV's own version matcher returned this advisory for the supplied
  // version. `null` when no version was supplied or no live record was retrieved.
  sourceVersionMatch: boolean | null;
};

export type SourceCheck = {
  id: string; name: string; url: string;
  status: 'ok' | 'partial' | 'failed' | 'skipped';
  detail: string;
  startedAt: string; durationMs: number;
  origin?: 'live' | 'cache' | 'built-snapshot';
};
export type Coverage = {
  identity:
    | {status: 'resolved'; ecosystem: string; packageName: string; display: string; basis: string}
    | {status: 'ambiguous'; display: string; candidates: string[]; reason: string}
    | {status: 'unsupported'; display: string; reason: string};
  sources: SourceCheck[];
  live: {advisoriesRetrieved: number; versionMatched: number | null; truncated: boolean; freshestRecordAt: string | null};
  knowledgeBase: {entriesRead: number; advisoriesVerified: number};
  // False whenever any source failed or returned a partial result. A report that
  // is not complete can never be read as evidence of absence.
  complete: boolean;
};
export type Report = {
  requestId: string; query: ResearchInput; createdAt: string; summary: string;
  findings: Finding[]; limitations: string[]; activity: Activity[];
  entries: {knowledgeBase: string; paths: string[]; content: string}[];
  coverage: Coverage;
};
