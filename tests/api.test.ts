import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('../src/lib/agent',()=>({runResearch:vi.fn()}));
vi.mock('../src/lib/config',async(importOriginal)=>({...await importOriginal<typeof import('../src/lib/config')>(), getConfig:vi.fn()}));
import { POST } from '../src/app/api/research/route';
import { runResearch } from '../src/lib/agent';
import { getConfig, ConfigurationError } from '../src/lib/config';
import { acquireRequest } from '../src/lib/request-security';
function req(body: unknown, headers: Record<string,string>={}) {return new Request('http://localhost:3000/api/research',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});}
const input={software:'Next.js',version:'14.2.24',question:'What documented vulnerabilities affect this?'};
beforeEach(()=>{vi.stubEnv('NODE_ENV','test');vi.stubEnv('RESEARCH_ACCESS_TOKEN','');vi.stubEnv('APP_ORIGIN','http://localhost:3000');vi.mocked(getConfig).mockReset();vi.mocked(runResearch).mockReset();});
afterEach(()=>vi.unstubAllEnvs());
describe('API security and failures',()=>{
  it('rejects invalid inputs before upstream calls',async()=>{expect((await POST(req({...input,software:''}))).status).toBe(400);expect(runResearch).not.toHaveBeenCalled();});
  it('rejects oversized bodies',async()=>{expect((await POST(req({...input,question:'x'.repeat(13000)}))).status).toBe(413);});
  it('rejects cross-origin requests',async()=>{expect((await POST(req(input,{origin:'https://evil.example'}))).status).toBe(403);});
  it('requires access code in production',async()=>{vi.stubEnv('NODE_ENV','production');expect((await POST(req(input))).status).toBe(503);});
  it('checks access code without exposing it',async()=>{vi.stubEnv('RESEARCH_ACCESS_TOKEN','private-code');const r=await POST(req(input));expect(r.status).toBe(401);expect(await r.text()).not.toContain('private-code');});
  it('reports missing config safely',async()=>{vi.mocked(getConfig).mockImplementation(()=>{throw new ConfigurationError(['AI_MODEL']);});const r=await POST(req(input));expect(r.status).toBe(503);expect(await r.text()).toContain('AI_MODEL');});
  it('redacts upstream errors from streamed failure events',async()=>{vi.mocked(runResearch).mockRejectedValue(new Error('API secret sk-PRIVATE'));const r=await POST(req(input));const body=await r.text();expect(body).toContain('"type":"error"');expect(body).not.toContain('sk-PRIVATE');});
  it('streams actual activity before results',async()=>{
    vi.mocked(runResearch).mockImplementation(async(_input,emit)=>{emit?.({stage:'initial_context',detail:'Outline retrieved',at:new Date().toISOString()});return {requestId:'test',query:_input,createdAt:new Date().toISOString(),summary:'Test result',findings:[],limitations:[],activity:[],entries:[],coverage:{identity:{status:'resolved' as const,ecosystem:'npm',packageName:'next',display:'Next.js',basis:'known-alias'},sources:[],live:{advisoriesRetrieved:0,versionMatched:null,truncated:false,freshestRecordAt:null},knowledgeBase:{entriesRead:0,advisoriesVerified:0},complete:true}};});
    const r=await POST(req(input));const body=await r.text();expect(body.indexOf('"type":"activity"')).toBeLessThan(body.indexOf('"type":"result"'));
  });
  it('bounds concurrency and releases slots idempotently',()=>{const a=acquireRequest(),b=acquireRequest(),c=acquireRequest();expect(()=>acquireRequest()).toThrow('capacity');a();a();b();c();const d=acquireRequest();d();});
});
