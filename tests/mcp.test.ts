import { createServer } from 'node:http';
import { once } from 'node:events';
import { it, expect } from 'vitest';
import { connectKnowledgeBase, toolText } from '../src/lib/mcp';
import { getConfig } from '../src/lib/config';
it('uses real HTTP MCP initialization, discovery and tool calls against a local test server', async () => {
  const calls: string[]=[]; const headers: string[]=[];
  const server=createServer(async(req,res)=>{
    if(req.method==='GET'){res.writeHead(405);res.end();return;}
    if(req.method==='DELETE'){res.writeHead(200);res.end();return;}
    let body=''; for await(const chunk of req) body+=chunk;
    const message=JSON.parse(body); headers.push(req.headers.authorization??''); calls.push(message.method);
    if(message.id===undefined){res.writeHead(202);res.end();return;}
    let result: unknown={};
    if(message.method==='initialize') result={protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'test-only-mcp',version:'1.0'}};
    if(message.method==='tools/list') result={tools:['initial_context','knowledge_base_read'].map(name=>({name,description:'Test tool',inputSchema:{type:'object',properties:{},additionalProperties:true}}))};
    if(message.method==='tools/call') result={content:[{type:'text',text:message.params.name==='initial_context'?'Knowledge base id: kbTest\nnext/middleware':'GHSA-f82v-jwr5-mffw retrieved'}]};
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:message.id,result}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const address=server.address();if(!address||typeof address==='string')throw Error();
  // Test-only config bypasses the production host allowlist to exercise the wire protocol.
  const config={SANITY_CONTEXT_MCP_URL:'http://127.0.0.1:'+address.port,SANITY_ORGANIZATION_TOKEN:'test-token'} as ReturnType<typeof getConfig>;
  let session;
  try {
    session=await connectKnowledgeBase(config,AbortSignal.timeout(5000));
    expect(await session.call('initial_context',{})).toContain('kbTest');
    expect(await session.call('knowledge_base_read',{knowledgeBase:'kbTest',paths:['next/middleware']})).toContain('GHSA');
    expect(calls.filter(c=>c==='tools/call')).toHaveLength(2);
    expect(headers.every(h=>h==='Bearer test-token')).toBe(true);
  } finally {await session?.close();server.close();server.closeAllConnections();}
});
it('rejects MCP errors, empty text and oversized results',()=>{
  expect(()=>toolText({isError:true,content:[{type:'text',text:'upstream secret'}]})).toThrow();
  expect(()=>toolText({content:[{type:'image'}]})).toThrow();
  expect(()=>toolText({content:[{type:'text',text:'x'.repeat(150001)}]})).toThrow();
});
