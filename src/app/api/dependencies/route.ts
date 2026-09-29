import { getConfig, ConfigurationError } from '@/lib/config';
import { parseLockfile } from '@/lib/lockfile';
import { scanDependencies } from '@/lib/dependency-scan';
import { authorize, acquireRequest, boundedJson, RequestError } from '@/lib/request-security';
export const runtime = 'nodejs';
export const maxDuration = 120;
// package-lock.json files are large; the body limit is raised for this route only.
const MAX_BODY_BYTES = 8_000_000;
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    authorize(request);
    const body = await boundedJson(request, MAX_BODY_BYTES);
    getConfig();
    release = acquireRequest();
    const parsed = parseLockfile(body);
    if (!parsed.dependencies.length) return Response.json({error: 'No exact package versions were found in this lockfile.'}, {status: 400});
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 100000);
    try {
      const report = await scanDependencies(parsed, AbortSignal.any([abort.signal, request.signal]));
      return Response.json(report, {headers: {'Cache-Control': 'no-store'}});
    } finally { clearTimeout(timeout); }
  } catch (error) {
    if (error instanceof ConfigurationError) return Response.json({error: 'Connect Sanity and an AI provider before researching.', missing: error.fields}, {status: 503});
    if (error instanceof RequestError) return Response.json({error: error.message}, {status: error.status, headers: error.status === 429 ? {'Retry-After': '60'} : {}});
    // Parser messages are written here and contain no upstream or credential data.
    if (error instanceof Error && error.message.startsWith('This file is not') ) return Response.json({error: error.message}, {status: 400});
    if (error instanceof Error && error.message.startsWith('No dependency entries')) return Response.json({error: error.message}, {status: 400});
    return Response.json({error: 'Unable to process the dependency file.'}, {status: 500});
  } finally { release?.(); }
}
