import { describe, it, expect } from 'vitest';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { createResearchModel, NVIDIA_BASE_URL, TOKEN_HARBOR_BASE_URL } from '../src/lib/model';
describe('NVIDIA provider integration',()=>{
 it('sends structured generation to NVIDIA chat completions',async()=>{
  let url='',body:Record<string,unknown>={},authorization='';
  const transport:typeof fetch=async(input,init)=>{
   url=String(input);body=JSON.parse(String(init?.body));authorization=new Headers(init?.headers).get('authorization')??'';
   return new Response(JSON.stringify({id:'test',object:'chat.completion',created:1,model:'test-nvidia-model',choices:[{index:0,message:{role:'assistant',content:'{"reads":[]}'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}}),{headers:{'Content-Type':'application/json'}});
  };
  const model=createResearchModel({AI_PROVIDER:'nvidia',AI_PROVIDER_API_KEY:'test-only-key',AI_MODEL:'test-nvidia-model'},transport);
  const {output}=await generateText({model,prompt:'Return empty reads as JSON.',maxRetries:0,output:Output.object({schema:z.object({reads:z.array(z.string())})})});
  expect(url).toBe(NVIDIA_BASE_URL+'/chat/completions');
  expect(authorization).toBe('Bearer test-only-key');
  expect(body.model).toBe('test-nvidia-model');
  expect(body.response_format).toMatchObject({type:'json_schema'});
  expect(output).toEqual({reads:[]});
 });
 it('rejects forwarding NVIDIA credentials to a different host',()=>{
  expect(()=>createResearchModel({AI_PROVIDER:'nvidia',AI_PROVIDER_API_KEY:'test',AI_MODEL:'m',AI_BASE_URL:'https://example.com/v1'})).toThrow('official NVIDIA');
 });
 it('preserves original provider routing',()=>{
  expect(createResearchModel({AI_PROVIDER:'openai',AI_PROVIDER_API_KEY:'test',AI_MODEL:'test'}).provider).toBe('openai.responses');
  expect(createResearchModel({AI_PROVIDER:'anthropic',AI_PROVIDER_API_KEY:'test',AI_MODEL:'test'}).provider).toBe('anthropic.messages');
 });
});

describe('Token Harbor routing',()=>{
 it('uses Chat Completions and rejects redirects for structured output',async()=>{
  let target='',payload:Record<string,unknown>={},redirect:RequestRedirect|undefined;
  const transport:typeof fetch=async(input,init)=>{
   target=String(input);payload=JSON.parse(String(init?.body));redirect=init?.redirect;
   expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-only-key');
   return new Response(JSON.stringify({id:'test',object:'chat.completion',created:1,model:'deepseek-v4.1-flash:free',choices:[{index:0,message:{role:'assistant',content:'{"reads":[]}'},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}}),{headers:{'Content-Type':'application/json'}});
  };
  const model=createResearchModel({AI_PROVIDER:'token-harbor',AI_PROVIDER_API_KEY:'test-only-key',AI_MODEL:'deepseek-v4.1-flash:free'},transport);
  const {output}=await generateText({model,prompt:'Return empty reads as JSON.',maxRetries:0,output:Output.object({schema:z.object({reads:z.array(z.string())})})});
  expect(target).toBe(TOKEN_HARBOR_BASE_URL+'/chat/completions');
  expect(payload.messages).toEqual(expect.arrayContaining([expect.objectContaining({role:'system',content:expect.stringContaining('JSON Schema:')})]));
  const instruction=(payload.messages as {role:string;content:string}[]).find(m=>m.content.includes('JSON Schema:'))!;
  expect(JSON.parse(instruction.content.split('JSON Schema: ')[1])).toMatchObject({type:'object',required:['reads']});
  expect(payload.model).toBe('deepseek-v4.1-flash:free');
  expect(payload.thinking).toEqual({type:'disabled'});
  expect(payload.response_format).toMatchObject({type:'json_schema'});
  expect(redirect).toBe('error');
  expect(output).toEqual({reads:[]});
 });
 it('does not send Token Harbor keys to a substituted endpoint',()=>{
  for(const base of ['https://example.com/v1','https://tokenharbor.ai.evil.invalid/v1','http://tokenharbor.ai/v1','https://tokenharbor.ai/v1?key=x']) {
   expect(()=>createResearchModel({AI_PROVIDER:'token-harbor',AI_PROVIDER_API_KEY:'test',AI_MODEL:'m',AI_BASE_URL:base})).toThrow('official Token Harbor');
  }
 });
});
