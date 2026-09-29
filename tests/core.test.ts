import { describe, it, expect } from 'vitest';
import rawNext from './fixtures/GHSA-f82v-jwr5-mffw.json';
import rawVite from './fixtures/GHSA-x574-m823-4x7w.json';
import { mapGitHub, sources } from '../src/lib/ingestion';
import { advisorySchema, researchInput } from '../src/lib/schema';
import { assessVersion, productMatches } from '../src/lib/versions';
import { getConfig, ConfigurationError } from '../src/lib/config';
import { redactForLog } from '../src/lib/logging';
const next = mapGitHub(rawNext, sources[0], '2026-09-23T00:00:00.000Z');
const vite = mapGitHub(rawVite, sources[2], '2026-09-23T00:00:00.000Z');
describe('real advisory normalization', () => {
  it('preserves CVE, dates, source and branch-specific fixed versions', () => {
    expect(next.cve).toBe('CVE-2025-29927');
    expect(next.updatedAt).toBe(rawNext.updated_at);
    expect(next.ranges.some(r => r.fixed === '14.2.25')).toBe(true);
    expect(next.description).toBe(rawNext.description);
    expect(next.provenance.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('normalizes GitHub API medium to displayed moderate without guessing a score', () => {
    expect(vite.severity).toBe('moderate');
    const missing = mapGitHub({...rawVite, severity: 'unknown', cvss: null}, sources[2], vite.fetchedAt);
    expect(missing.severity).toBeNull(); expect(missing.cvss).toBeNull();
  });
  it('rejects wrong advisory identity and wrong product', () => {
    expect(() => mapGitHub(rawNext,sources[1],next.fetchedAt)).toThrow();
    expect(() => mapGitHub({...rawNext,vulnerabilities:[]},sources[0],next.fetchedAt)).toThrow();
  });
  it('does not manufacture vendor, exploitation status, conditions or remediation', () => {
    expect(next.vendor).toBeNull(); expect(next.exploitation).toBeNull();
    expect(next.conditionsReviewed).toBe(false); expect(next.remediation).toBeNull();
  });
  it('rejects invalid scores and fabricated/malicious source URLs', () => {
    expect(advisorySchema.safeParse({...next,cvss:11}).success).toBe(false);
    expect(advisorySchema.safeParse({...next,sourceUrl:'javascript:alert(1)'}).success).toBe(false);
    expect(advisorySchema.safeParse({...next,sourceUrl:'https://example.com/advisories/'+next.advisoryId}).success).toBe(false);
  });
});
describe('input validation', () => {
  it('trims and accepts a natural-language question', () => {
    expect(researchInput.parse({software:' Next.js ',question:'What versions are affected?'}).software).toBe('Next.js');
  });
  it.each([{software:'',question:'What is affected?'},{software:'x'.repeat(81),question:'What is affected?'},{software:'http://localhost',question:'What is affected?'},{software:'Vite',version:'>=6.0.0',question:'What is affected?'},{software:'Vite',question:'x'.repeat(2001)}])('rejects malformed input %#', input => {
    expect(researchInput.safeParse(input).success).toBe(false);
  });
});
describe('conservative ecosystem-aware assessments', () => {
  it.each(['14.2.24','13.5.8','15.2.2'])('detects vulnerable Next.js branch %s but requires deployment verification', version => {
    expect(assessVersion(next,version).status).toBe('conditional');
  });
  it.each(['14.2.25','13.5.9','15.2.3'])('does not call patched %s universally safe', version => {
    expect(assessVersion(next,version).status).toBe('outside-range');
  });
  it('recognizes Vite range endpoints', () => {
    expect(assessVersion(vite,'6.2.2').status).toBe('conditional');
    expect(assessVersion(vite,'6.2.3').status).toBe('outside-range');
  });
  it.each(['','14.2.24-canary.1','14.2.24+vendor.1','14.2.24-ubuntu1','14.2'])('treats %s conservatively', version => {
    expect(assessVersion(next,version).status).toBe('unknown');
  });
  it('requires explicit unaffected ranges', () => {
    expect(assessVersion({...next,unaffectedRanges:['14.2.25']},'14.2.25').status).toBe('unaffected');
  });
  it('requires reviewed conditions before confirmed affected', () => {
    expect(assessVersion({...next,conditionsReviewed:true,conditions:[]},'14.2.24').status).toBe('affected');
  });
  it('detects contradictory claims', () => {
    expect(assessVersion({...next,unaffectedRanges:['14.2.24']},'14.2.24').status).toBe('conflict');
  });
  it('rejects ambiguous ranges, withdrawn records and unsupported ecosystems', () => {
    expect(assessVersion({...next,ranges:[{affected:'vendor builds before autumn',fixed:null}]},'14.2.24').status).toBe('unknown');
    expect(assessVersion({...next,ecosystem:'Debian'},'14.2.24').status).toBe('unknown');
    expect(assessVersion({...next,withdrawnAt:next.updatedAt},'14.2.24').status).toBe('unknown');
  });
  it('matches product aliases without substring collisions', () => {
    expect(productMatches('nextjs',next)).toBe(true); expect(productMatches('next',next)).toBe(true);
    expect(productMatches('next-auth',next)).toBe(false);
  });
});
describe('existing project boundary', () => {
  it('reports missing configuration without including secrets', () => {
    try {getConfig({SANITY_ORGANIZATION_TOKEN:'secret-value'});} catch(e) {
      expect(e).toBeInstanceOf(ConfigurationError); expect(JSON.stringify(e)).not.toContain('secret-value');
    }
  });
  it('refuses alternate datasets and arbitrary MCP hosts', () => {
    expect(() => getConfig({SANITY_DATASET:'new-dataset',SANITY_CONTEXT_MCP_URL:'http://localhost:4444'})).toThrow(ConfigurationError);
  });
});

describe('diagnostic logging never carries credentials', () => {
  it('redacts provider keys, bearer tokens, long opaque strings and query strings', () => {
    const samples = [
      'call failed for nvapi-abcdefgh12345678ijklmnop',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'GET https://api.example.com/v1/x?token=s3cr3tvalue&id=2 failed',
      'https://user:hunter2@api.example.com/v1 failed',
      'key sk-0123456789abcdef0123456789abcdef',
    ];
    for (const sample of samples) {
      const out = redactForLog(sample);
      for (const secret of ['nvapi-abcdefgh12345678ijklmnop','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9','s3cr3tvalue','hunter2','sk-0123456789abcdef0123456789abcdef']) {
        expect(out).not.toContain(secret);
      }
    }
  });
  it('keeps a short operational message readable and bounded', () => {
    expect(redactForLog('Service temporarily overloaded')).toBe('Service temporarily overloaded');
    expect(redactForLog('x'.repeat(500)).length).toBeLessThanOrEqual(200);
  });
});
