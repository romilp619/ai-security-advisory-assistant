import { createMCPClient } from '@ai-sdk/mcp';
import { z } from 'zod';
import type { getConfig } from './config';

export interface KnowledgeSession {
  call(name: 'initial_context' | 'knowledge_base_read', args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}
export function toolText(value: unknown): string {
  const result = z.object({isError: z.boolean().optional(), content: z.array(z.object({type: z.string(), text: z.string().optional()}))}).parse(value);
  if (result.isError) throw new Error('Knowledge Base tool returned an error.');
  const text = result.content.filter(c => c.type === 'text').map(c => c.text ?? '').join('\n');
  if (!text.trim() || text.length > 150000) throw new Error('Empty or oversized Knowledge Base response.');
  return text;
}
export async function connectKnowledgeBase(config: ReturnType<typeof getConfig>, signal: AbortSignal): Promise<KnowledgeSession> {
  const client = await createMCPClient({
    clientName: 'security-advisory-assistant', maxRetries: 0,
    initializationOptions: {signal, timeout: 20000},
    transport: {type: 'http', url: config.SANITY_CONTEXT_MCP_URL, redirect: 'error',
      headers: {Authorization: 'Bearer ' + config.SANITY_ORGANIZATION_TOKEN},
      fetch: (url, init) => fetch(url, {...init, signal: AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])]), redirect: 'error'}),
    },
  });
  try {
    const tools = await client.tools();
    if (!tools.initial_context || !tools.knowledge_base_read) throw new Error('Endpoint must serve Knowledge Base mode.');
    return {
      async call(name, args) {
        signal.throwIfAborted();
        const result = await tools[name].execute(args, {toolCallId: crypto.randomUUID(), messages: [], abortSignal: signal});
        return toolText(result);
      },
      close: () => client.close(),
    };
  } catch (error) { await client.close(); throw error; }
}
