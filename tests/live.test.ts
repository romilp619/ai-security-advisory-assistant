import { it, expect } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { runResearch } from '../src/lib/agent';
it.skipIf(process.env.RUN_LIVE_TESTS!=='1')('LIVE: actual model → Sanity Context MCP → Knowledge Base → production evidence',async()=>{
  const report=await runResearch({software:'Next.js',version:'14.2.24',question:'Which documented middleware authorization bypass affects this version? Include CVE-2025-29927 and its fixes.'});
  expect(report.activity.some(a=>a.stage==='initial_context')).toBe(true);
  expect(report.activity.some(a=>a.stage==='knowledge_base_read')).toBe(true);
  const finding=report.findings.find(f=>f.advisory.cve==='CVE-2025-29927');
  expect(finding).toBeDefined();
  expect(finding?.advisory.ranges.some(r=>r.fixed==='14.2.25')).toBe(true);
  expect(report.entries.some(e=>e.content.includes(finding!.evidenceQuote))).toBe(true);
  await writeFile('live-verification.json',JSON.stringify(report,null,2));
},120000);
