import { z } from 'zod';
const configSchema = z.object({
  SANITY_PROJECT_ID: z.string().regex(/^[a-z0-9]{1,32}$/),
  SANITY_DATASET: z.literal('production'),
  SANITY_CONTEXT_MCP_URL: z.url().refine(value => {
    const u = new URL(value);
    return u.origin === 'https://api.sanity.io' && /^\/v1\/context\/organizations\/[^/]+\/mcp\/[^/]+$/.test(u.pathname) && !u.search && !u.hash && !u.username && !u.password;
  }),
  SANITY_ORGANIZATION_TOKEN: z.string().min(1), SANITY_READ_TOKEN: z.string().min(1),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'nvidia', 'token-harbor']).default('openai'),
  AI_PROVIDER_API_KEY: z.string().min(1), AI_MODEL: z.string().min(1),
  AI_BASE_URL: z.url().optional(),
}).refine(c => c.AI_PROVIDER !== 'nvidia' || !c.AI_BASE_URL || c.AI_BASE_URL.replace(/\/$/, '') === 'https://integrate.api.nvidia.com/v1', {path: ['AI_BASE_URL'], message: 'Use the official NVIDIA endpoint.'})
.refine(c => c.AI_PROVIDER !== 'token-harbor' || !c.AI_BASE_URL || c.AI_BASE_URL.replace(/\/$/, '') === 'https://tokenharbor.ai/v1', {path: ['AI_BASE_URL'], message: 'Use the official Token Harbor endpoint.'});
export class ConfigurationError extends Error {
  constructor(public fields: string[]) { super('Research is not configured.'); }
}
export function getConfig(env: Record<string, string | undefined> = process.env) {
  const values = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const result = configSchema.safeParse({ ...values, SANITY_DATASET: values.SANITY_DATASET ?? 'production' });
  if (!result.success) throw new ConfigurationError([...new Set(result.error.issues.map(i => String(i.path[0])))]);
  return result.data;
}
export function configStatus() {
  const missing: string[] = [];
  try { getConfig(); }
  catch (error) { if (error instanceof ConfigurationError) missing.push(...error.fields); else missing.push('SERVER_CONFIGURATION'); }
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.APP_ORIGIN) missing.push('APP_ORIGIN');
    if (!process.env.RESEARCH_ACCESS_TOKEN) missing.push('RESEARCH_ACCESS_TOKEN');
  }
  return {configured: missing.length === 0, missing};
}
