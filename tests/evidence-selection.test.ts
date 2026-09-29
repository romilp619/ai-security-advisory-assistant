import { describe, it, expect } from 'vitest';
import { evidenceChoices, passages } from '../src/lib/evidence-selection';
import { mapGitHub, sources } from '../src/lib/ingestion';
import raw from './fixtures/GHSA-f82v-jwr5-mffw.json';
const record = mapGitHub(raw, sources[0], new Date().toISOString());
const other = {...record, advisoryId:'GHSA-aaaa-bbbb-cccc', cve:'CVE-2000-0001'};
const text = '## **' + record.advisoryId + '** (' + record.cve + ')\n\nSource formatting must stay exactly intact.';
const entry = {knowledgeBase:'kbOne',paths:['nextjs/advisories'],content:text};
describe('source passage selection', () => {
  it('resolves passage IDs to exact original text without model transcription', () => {
    const c = evidenceChoices([entry], [record]);
    const output = c.resolve({findings:[{advisoryId:record.advisoryId,evidenceId:'e0',impactId:'s0',remediationId:'none',conflictId:'none'}]});
    expect(text.includes(output.findings[0].evidenceQuote)).toBe(true);
    expect(record.description.includes(output.findings[0].impactQuote)).toBe(true);
    expect(output.findings[0].remediationQuote).toBe('');
    expect(c.schema.safeParse({findings:[{advisoryId:record.advisoryId,evidenceId:'invented',impactId:'none',remediationId:'none',conflictId:'none'}]}).success).toBe(false);
  });
  it('rejects a passage from a different advisory even when its ID exists', () => {
    const c = evidenceChoices([entry], [record, other]);
    const source = c.source.find(s=>s.advisoryId===other.advisoryId)!;
    expect(()=>c.resolve({findings:[{advisoryId:record.advisoryId,evidenceId:'e0',impactId:source.id,remediationId:'none',conflictId:'none'}]})).toThrow('Unsupported source');
  });
  it('keeps long text chunks bounded and verbatim', () => {
    const source = 'a'.repeat(2000) + '\n\nA short final paragraph.';
    for (const p of passages(source)) {expect(source.includes(p)).toBe(true); expect(p.length).toBeLessThanOrEqual(1800);}
  });
});

describe('tabular entries', () => {
  const table = [
    '| Advisory | CVE | Severity | Affected | Fixed |',
    '| --- | --- | --- | --- | --- |',
    '| GHSA-aaaa-bbbb-cccc | CVE-2026-1111 | High | >=1.0.0 <1.2.0 | 1.2.0 |',
    '| GHSA-dddd-eeee-ffff | CVE-2026-2222 | Moderate | >=2.0.0 <2.1.0 | 2.1.0 |',
  ].join('\n');

  it('splits a table into one passage per row, not one blob', () => {
    const out = passages(table);
    // header + two data rows; the |---| rule line is dropped
    expect(out).toHaveLength(3);
    expect(out.some(p => p.includes('GHSA-aaaa-bbbb-cccc') && p.includes('1.2.0'))).toBe(true);
    expect(out.some(p => p.includes('GHSA-dddd-eeee-ffff'))).toBe(true);
    expect(out.every(p => p.length < 200)).toBe(true);
  });

  it('keeps each row independently attributable to its advisory', () => {
    const rows = passages(table).filter(p => /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/.test(p));
    expect(rows).toHaveLength(2);
    // a row must not carry the other advisory's id, or attribution would be ambiguous
    expect(rows.filter(r => r.includes('GHSA-aaaa-bbbb-cccc'))).toHaveLength(1);
  });

  it('leaves prose untouched', () => {
    const prose = 'First paragraph about GHSA-aaaa-bbbb-cccc and its impact.\n\nSecond paragraph about patches.';
    expect(passages(prose)).toHaveLength(2);
  });
});
