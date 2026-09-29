// Server-side diagnostics only. Nothing produced here is ever sent to a client.
// Upstream SDK errors can embed credentials in URLs or headers, so every value is
// redacted before it reaches stdout/stderr.
const PATTERNS: RegExp[] = [
  /\b(?:sk|nvapi|thk_live|ghp|gho|ghs|github_pat|skA|sanity)[-_][A-Za-z0-9_-]{8,}/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b[A-Za-z0-9_-]{40,}\b/g,
  /\b[a-f0-9]{32,}\b/gi,
];
export function redactForLog(value: string, limit = 200) {
  let text = value.replace(/[\r\n]+/g, ' ');
  // Strip query strings and userinfo wholesale rather than trying to parse them.
  text = text.replace(/\?[^\s]*/g, '?[redacted]').replace(/\/\/[^/\s@]+@/g, '//[redacted]@');
  for (const pattern of PATTERNS) text = text.replace(pattern, '[redacted]');
  return text.slice(0, limit);
}
export function logSourceFailure(source: string, error: unknown) {
  const name = error instanceof Error ? error.constructor.name : typeof error;
  const message = error instanceof Error ? redactForLog(error.message) : '';
  console.warn('[advisory] source "' + source + '" did not complete: ' + name + (message ? ' — ' + message : ''));
}
