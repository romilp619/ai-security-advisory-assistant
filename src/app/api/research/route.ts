import { researchInput } from '@/lib/schema';
import { getConfig, ConfigurationError } from '@/lib/config';
import { runResearch } from '@/lib/agent';
import { authorize, acquireRequest, boundedJson, RequestError } from '@/lib/request-security';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    authorize(request);
    const parsed = researchInput.safeParse(await boundedJson(request));
    if (!parsed.success) return Response.json({error: 'Check the software, version, and question.', fields: parsed.error.flatten().fieldErrors}, {status: 400});
    getConfig();
    release = acquireRequest();
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 100000);
    const signal = AbortSignal.any([abort.signal, request.signal]);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: unknown) => {if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify({type,data}) + '\n'));};
        try {
          const report = await runResearch(parsed.data, event => send('activity',event), signal);
          send('result',report);
        } catch {
          // Never send upstream error bodies, request headers, prompts, or tokens.
          if (!request.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify({type:'error',data: signal.aborted ? 'Research timed out. Try again with a narrower question.' : 'Research could not be completed. Check the model, Context endpoint, and dataset permissions.'}) + '\n'));
        } finally {
          clearTimeout(timeout); release?.();
          try {controller.close();} catch { /* Client disconnected. */ }
        }
      },
      cancel() {abort.abort(); release?.(); clearTimeout(timeout);},
    });
    return new Response(stream, {headers: {'Content-Type':'application/x-ndjson', 'Cache-Control':'no-store', 'X-Accel-Buffering':'no'}});
  } catch (error) {
    release?.();
    if (error instanceof ConfigurationError) return Response.json({error:'Connect Sanity and an AI provider before researching.', missing:error.fields}, {status:503});
    if (error instanceof RequestError) return Response.json({error:error.message}, {status:error.status, headers: error.status === 429 ? {'Retry-After':'60'} : {}});
    return Response.json({error:'Unable to process the request.'}, {status:500});
  }
}
