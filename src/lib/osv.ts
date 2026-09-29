import { z } from 'zod';

// OSV.dev is the only live advisory source this application contacts.
// The host is a compile-time constant: no caller, model output, or advisory
// field can redirect a request to another origin.
export const OSV_ORIGIN = 'https://api.osv.dev';
export const OSV_SOURCE = {
  id: 'osv.dev',
  name: 'OSV.dev (Open Source Vulnerabilities)',
  url: 'https://osv.dev',
  // Documented scope, so the UI never implies more than this source covers.
  coverage: 'Aggregates GitHub Security Advisories, npm, PyPI, Go, crates.io, Debian, Ubuntu and other databases. This application queries the npm ecosystem only.',
} as const;

const osvEvent = z.object({introduced: z.string().optional(), fixed: z.string().optional(), last_affected: z.string().optional(), limit: z.string().optional()});
const osvAffected = z.object({
  package: z.object({name: z.string(), ecosystem: z.string(), purl: z.string().optional()}).optional(),
  ranges: z.array(z.object({type: z.string(), events: z.array(osvEvent), repo: z.string().optional()})).optional(),
  versions: z.array(z.string()).optional(),
  database_specific: z.record(z.string(), z.unknown()).optional(),
  ecosystem_specific: z.record(z.string(), z.unknown()).optional(),
});
export const osvVulnerability = z.object({
  id: z.string().min(1).max(128),
  summary: z.string().optional(),
  details: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  related: z.array(z.string()).optional(),
  modified: z.string(),
  published: z.string().optional(),
  withdrawn: z.string().nullable().optional(),
  severity: z.array(z.object({type: z.string(), score: z.string()})).optional(),
  affected: z.array(osvAffected).optional(),
  references: z.array(z.object({type: z.string(), url: z.string()})).optional(),
  database_specific: z.record(z.string(), z.unknown()).optional(),
});
export type OsvVulnerability = z.infer<typeof osvVulnerability>;
const queryResponse = z.object({vulns: z.array(osvVulnerability).optional(), next_page_token: z.string().optional()});
const batchResponse = z.object({results: z.array(z.object({vulns: z.array(z.object({id: z.string(), modified: z.string()})).optional(), next_page_token: z.string().optional()}))});

export type LookupFailure = {ok: false; error: string; retryable: boolean};
export type LookupSuccess<T> = {ok: true; data: T; pages: number; truncated: boolean};
export type Lookup<T> = LookupSuccess<T> | LookupFailure;

const MAX_PAGES = 8;
const MAX_BYTES = 8_000_000;

function describe(status: number): LookupFailure {
  if (status === 429) return {ok: false, error: 'OSV.dev rate limit reached. The lookup did not complete.', retryable: true};
  if (status >= 500) return {ok: false, error: 'OSV.dev returned a server error (' + status + '). The lookup did not complete.', retryable: true};
  return {ok: false, error: 'OSV.dev rejected the query (HTTP ' + status + '). The lookup did not complete.', retryable: false};
}

async function post(path: '/v1/query' | '/v1/querybatch', body: unknown, signal: AbortSignal, timeoutMs: number): Promise<{status: number; text: string} | LookupFailure> {
  const timeout = AbortSignal.timeout(timeoutMs);
  try {
    const response = await fetch(OSV_ORIGIN + path, {
      method: 'POST', redirect: 'error', cache: 'no-store',
      headers: {'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'ai-security-advisory-assistant'},
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, timeout]),
    });
    const text = await response.text();
    if (text.length > MAX_BYTES) return {ok: false, error: 'OSV.dev response exceeded the size limit. The lookup did not complete.', retryable: false};
    return {status: response.status, text};
  } catch {
    if (signal.aborted) return {ok: false, error: 'The lookup was cancelled before OSV.dev responded.', retryable: false};
    return {ok: false, error: 'OSV.dev could not be reached within ' + Math.round(timeoutMs / 1000) + 's. The lookup did not complete.', retryable: true};
  }
}

// One bounded retry, only for transient conditions.
async function postWithRetry(path: '/v1/query' | '/v1/querybatch', body: unknown, signal: AbortSignal, timeoutMs: number) {
  const first = await post(path, body, signal, timeoutMs);
  if ('ok' in first && first.retryable && !signal.aborted) {
    await new Promise(resolve => setTimeout(resolve, 600));
    if (signal.aborted) return first;
    return post(path, body, signal, timeoutMs);
  }
  if (!('ok' in first) && (first.status === 429 || first.status >= 500) && !signal.aborted) {
    await new Promise(resolve => setTimeout(resolve, 600));
    if (signal.aborted) return first;
    return post(path, body, signal, timeoutMs);
  }
  return first;
}

export type QueryTarget = {ecosystem: 'npm'; name: string; version?: string};

/** Every advisory OSV holds for the package, or (with `version`) only those OSV matches to it. */
export async function queryPackage(target: QueryTarget, signal: AbortSignal, timeoutMs = 15000): Promise<Lookup<OsvVulnerability[]>> {
  const vulns: OsvVulnerability[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  while (pages < MAX_PAGES) {
    const body: Record<string, unknown> = {package: {ecosystem: 'npm', name: target.name}};
    if (target.version) body.version = target.version;
    if (pageToken) body.page_token = pageToken;
    const result = await postWithRetry('/v1/query', body, signal, timeoutMs);
    if ('ok' in result) return result;
    if (result.status !== 200) return describe(result.status);
    let parsed;
    try { parsed = queryResponse.parse(JSON.parse(result.text)); }
    catch { return {ok: false, error: 'OSV.dev returned a response this application could not validate. The lookup did not complete.', retryable: false}; }
    vulns.push(...(parsed.vulns ?? []));
    pages++;
    pageToken = parsed.next_page_token;
    if (!pageToken) return {ok: true, data: vulns, pages, truncated: false};
  }
  // Report truncation rather than silently returning a partial set as complete.
  return {ok: true, data: vulns, pages, truncated: true};
}

/** Identifier-only matching for many packages at once; used by dependency-file analysis. */
export async function queryBatch(targets: QueryTarget[], signal: AbortSignal, timeoutMs = 25000): Promise<Lookup<{target: QueryTarget; ids: string[]; truncated: boolean}[]>> {
  const out: {target: QueryTarget; ids: string[]; truncated: boolean}[] = [];
  for (let offset = 0; offset < targets.length; offset += 100) {
    const chunk = targets.slice(offset, offset + 100);
    const result = await postWithRetry('/v1/querybatch', {
      queries: chunk.map(t => t.version
        ? {package: {ecosystem: 'npm', name: t.name}, version: t.version}
        : {package: {ecosystem: 'npm', name: t.name}}),
    }, signal, timeoutMs);
    if ('ok' in result) return result;
    if (result.status !== 200) return describe(result.status);
    let parsed;
    try { parsed = batchResponse.parse(JSON.parse(result.text)); }
    catch { return {ok: false, error: 'OSV.dev returned a batch response this application could not validate. The lookup did not complete.', retryable: false}; }
    if (parsed.results.length !== chunk.length) return {ok: false, error: 'OSV.dev returned a batch result count that does not match the query. The lookup did not complete.', retryable: false};
    parsed.results.forEach((entry, index) => out.push({
      target: chunk[index],
      ids: (entry.vulns ?? []).map(v => v.id),
      truncated: Boolean(entry.next_page_token),
    }));
  }
  return {ok: true, data: out, pages: Math.ceil(targets.length / 100), truncated: false};
}
