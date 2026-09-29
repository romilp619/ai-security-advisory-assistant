import { timingSafeEqual } from 'node:crypto';
export class RequestError extends Error {
  constructor(public status: number, message: string) {super(message);}
}
const windows = new Map<string, {count: number; expires: number}>();
let inFlight = 0;
export function authorize(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (origin && origin !== expected) throw new RequestError(403, 'This origin is not allowed.');
  if (process.env.NODE_ENV === 'production' && (!process.env.RESEARCH_ACCESS_TOKEN || !process.env.APP_ORIGIN)) throw new RequestError(503, 'The operator must configure a research access code and APP_ORIGIN for production.');
  const required = process.env.RESEARCH_ACCESS_TOKEN;
  if (required) {
    const given = request.headers.get('x-research-access') ?? '';
    const a = Buffer.from(given), b = Buffer.from(required);
    if (a.length !== b.length || !timingSafeEqual(a,b)) throw new RequestError(401, 'Enter a valid research access code.');
  }
}
export function acquireRequest(now = Date.now()) {
  // Global process budget cannot be bypassed by spoofing proxy headers.
  // Production multi-instance deployments also need an edge/WAF distributed limit.
  for (const [key,value] of windows) if (value.expires <= now) windows.delete(key);
  const key = 'global';
  const state = windows.get(key) ?? {count: 0, expires: now + 60000};
  if (state.count >= 12 || inFlight >= 3) throw new RequestError(429, 'Research capacity reached. Try again in a minute.');
  state.count++; windows.set(key,state); inFlight++;
  let released = false;
  return () => {if (!released) {inFlight--; released = true;}};
}
export async function boundedJson(request: Request, maxBytes = 12000) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new RequestError(415, 'Send application/json.');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'A request body is required.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {await reader.cancel(); throw new RequestError(413, 'Request is too large.');}
      chunks.push(value);
    }
    try {return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}
    catch {throw new RequestError(400, 'Invalid JSON body.');}
  } finally {reader.releaseLock();}
}
