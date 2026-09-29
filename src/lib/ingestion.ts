import { z } from 'zod';
import { createHash } from 'node:crypto';
import { advisorySchema, httpsUrl, referenceUrl } from './schema';
export const sources = [
  { id: 'GHSA-f82v-jwr5-mffw', product: 'Next.js', packageName: 'next' },
  { id: 'GHSA-gp8f-8m3g-qvj9', product: 'Next.js', packageName: 'next' },
  { id: 'GHSA-x574-m823-4x7w', product: 'Vite', packageName: 'vite' },
  { id: 'GHSA-xcj6-pq6g-qj4x', product: 'Vite', packageName: 'vite' },
] as const;
const githubSchema = z.object({
  ghsa_id: z.string(), cve_id: z.string().nullable(), summary: z.string(), description: z.string(),
  severity: z.enum(['low','moderate','medium','high','critical','unknown']).nullable(), html_url: httpsUrl,
  published_at: z.iso.datetime(), updated_at: z.iso.datetime(), withdrawn_at: z.iso.datetime().nullable(),
  cvss: z.object({score: z.number().nullable()}).nullable().optional(), references: z.array(referenceUrl),
  vulnerabilities: z.array(z.object({
    package: z.object({ecosystem: z.string(), name: z.string()}),
    vulnerable_version_range: z.string(), first_patched_version: z.string().nullable(),
  })),
});
export type MappableSource = {id: string; product: string; packageName: string};
export function mapGitHub(raw: unknown, source: MappableSource, fetchedAt: string) {
  const input = githubSchema.parse(raw);
  if (input.ghsa_id !== source.id) throw new Error('Advisory identity mismatch.');
  const packages = input.vulnerabilities.filter(v => v.package.ecosystem === 'npm' && v.package.name === source.packageName);
  if (!packages.length) throw new Error('Expected npm package missing from advisory.');
  return advisorySchema.parse({
    _id: 'advisory-' + source.id, _type: 'securityAdvisory', advisoryId: input.ghsa_id, cve: input.cve_id,
    title: input.summary, product: source.product, vendor: null, packageName: source.packageName, ecosystem: 'npm',
    description: input.description, severity: input.severity === 'unknown' ? null : input.severity === 'medium' ? 'moderate' : input.severity, cvss: input.cvss?.score ?? null,
    ranges: packages.map(v => ({affected: v.vulnerable_version_range, fixed: v.first_patched_version})),
    unaffectedRanges: [], conditions: null, conditionsReviewed: false, remediation: null, exploitation: null,
    sourceUrl: input.html_url, references: input.references, publishedAt: input.published_at, updatedAt: input.updated_at,
    fetchedAt, withdrawnAt: input.withdrawn_at,
    provenance: {provider: 'GitHub Security Advisories', apiUrl: 'https://api.github.com/advisories/' + source.id, sha256: createHash('sha256').update(JSON.stringify(raw)).digest('hex')},
  });
}
