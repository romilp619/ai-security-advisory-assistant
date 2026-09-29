import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createClient } from '@sanity/client';
import { mapGitHub } from '../src/lib/ingestion';
import type { Advisory } from '../src/lib/schema';
import { parseSourceList, mergeSources, defaultSourceList, advisorySource, type AdvisorySource, type SourceList } from '../src/lib/source-list';
import { queryPackage } from '../src/lib/osv';

const args = process.argv.slice(2);
const flag = (name: string) => {const i = args.indexOf('--' + name); return i === -1 ? undefined : args[i + 1];};
const apply = args.includes('--apply');
const discover = flag('discover');
const limit = Math.min(Math.max(Number(flag('limit') ?? 10), 1), 50);
const only = flag('only');
const LIST_PATH = 'data/advisory-sources.json';

if (process.env.SANITY_DATASET && process.env.SANITY_DATASET !== 'production') throw new Error('Only the existing production dataset may be used.');
if (apply && (!process.env.SANITY_PROJECT_ID || !process.env.SANITY_WRITE_TOKEN)) throw new Error('Set existing SANITY_PROJECT_ID and local SANITY_WRITE_TOKEN before --apply.');
await mkdir('data/raw', {recursive: true});

// ---- source list -------------------------------------------------------------
let list: SourceList;
try { list = parseSourceList(JSON.parse(await readFile(LIST_PATH, 'utf8'))); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  list = defaultSourceList();
  await writeFile(LIST_PATH, JSON.stringify(list, null, 2) + '\n');
}
const discovered: AdvisorySource[] = [];
let skippedAdditions: {id: string; reason: string}[] = [];
if (discover) {
  // Discovery is explicit and bounded: it adds identifiers to the curated list and
  // stops. It never runs on a schedule and never fetches more than --limit records.
  const result = await queryPackage({ecosystem: 'npm', name: discover}, AbortSignal.timeout(30000));
  if (!result.ok) throw new Error('Discovery failed: ' + result.error);
  const candidates = result.data
    .filter(v => /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(v.id) && !v.withdrawn)
    .sort((a, b) => Date.parse(b.modified) - Date.parse(a.modified))
    .slice(0, limit)
    .map(v => advisorySource.parse({id: v.id, product: flag('product') ?? discover, packageName: discover, ecosystem: 'npm', addedAt: new Date().toISOString()}));
  const merged = mergeSources(list, candidates);
  list = merged.list; discovered.push(...merged.added); skippedAdditions = merged.skipped;
  await writeFile(LIST_PATH, JSON.stringify(list, null, 2) + '\n');
}
const selected = only ? list.sources.filter(s => s.id === only || s.packageName === only) : list.sources;
if (!selected.length) throw new Error('No advisories selected. Check ' + LIST_PATH + ' or the --only value.');

// ---- fetch with conditional requests ----------------------------------------
type Meta = {etag?: string; sha256?: string};
const readMeta = async (id: string): Promise<Meta> => {
  try { return JSON.parse(await readFile('data/raw/' + id + '.meta.json', 'utf8')); } catch { return {}; }
};
const documents: Advisory[] = [];
const fetchLog: {id: string; action: string}[] = [];
for (const source of selected) {
  const meta = await readMeta(source.id);
  const response = await fetch('https://api.github.com/advisories/' + source.id, {
    headers: {
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      ...(meta.etag ? {'If-None-Match': meta.etag} : {}),
      ...(process.env.GITHUB_TOKEN ? {Authorization: 'Bearer ' + process.env.GITHUB_TOKEN} : {}),
    },
    signal: AbortSignal.timeout(20000), redirect: 'error',
  });
  let raw: unknown;
  if (response.status === 304) {
    // Unchanged upstream: reuse the stored response instead of spending rate limit.
    raw = JSON.parse(await readFile('data/raw/' + source.id + '.json', 'utf8'));
    fetchLog.push({id: source.id, action: 'not modified (304); used cached response'});
  } else if (response.ok) {
    raw = await response.json();
    await writeFile('data/raw/' + source.id + '.json', JSON.stringify(raw, null, 2));
    const etag = response.headers.get('etag');
    await writeFile('data/raw/' + source.id + '.meta.json', JSON.stringify({etag: etag ?? undefined}, null, 2));
    fetchLog.push({id: source.id, action: 'fetched'});
  } else if (response.status === 403 || response.status === 429) {
    throw new Error('GitHub rate limit reached (HTTP ' + response.status + '). Set GITHUB_TOKEN or retry later. Nothing was written.');
  } else throw new Error('GitHub fetch failed for ' + source.id + ': HTTP ' + response.status);
  documents.push(mapGitHub(raw, source, new Date().toISOString()));
}

const withKeys = (d: Advisory) => ({...d, ranges: d.ranges.map((r, i) => ({...r, _key: 'range-' + i}))});
await writeFile('data/import.ndjson', documents.map(d => JSON.stringify(withKeys(d))).join('\n') + '\n');

// ---- idempotent write with revision guards ----------------------------------
const result: {id: string; action: string; changed: boolean}[] = [];
if (apply) {
  const client = createClient({projectId: process.env.SANITY_PROJECT_ID!, dataset: 'production', token: process.env.SANITY_WRITE_TOKEN, apiVersion: '2026-09-01', useCdn: false});
  let transaction = client.transaction();
  for (const doc of documents) {
    const existing = await client.getDocument<{_id: string; _rev: string; updatedAt: string; provenance?: {sha256: string}}>(doc._id);
    if (existing && new Date(existing.updatedAt) > new Date(doc.updatedAt)) {result.push({id: doc.advisoryId, action: 'skipped older source', changed: false}); continue;}
    if (existing?.provenance?.sha256 === doc.provenance.sha256) {
      transaction = transaction.patch(doc._id, p => p.ifRevisionId(existing._rev).set({fetchedAt: doc.fetchedAt}));
      result.push({id: doc.advisoryId, action: 'unchanged; refreshed fetchedAt', changed: false}); continue;
    }
    if (existing) {
      const { _id, _type, ...fields } = withKeys(doc);
      void _id; void _type;
      transaction = transaction.patch(doc._id, p => p.ifRevisionId(existing._rev).set(fields));
    } else transaction = transaction.create(withKeys(doc));
    result.push({id: doc.advisoryId, action: existing ? 'updated; conditions need review' : 'created', changed: true});
  }
  await transaction.commit();
} else for (const doc of documents) result.push({id: doc.advisoryId, action: 'validated dry run; not imported', changed: false});

// ---- rebuild status ----------------------------------------------------------
const changed = result.filter(r => r.changed);
const rebuild = apply && changed.length > 0;
const report = {
  at: new Date().toISOString(), dataset: 'production', applied: apply,
  sourceList: {path: LIST_PATH, total: list.sources.length, selected: selected.length},
  discovered: discovered.map(d => d.id), skippedAdditions,
  fetches: fetchLog, records: result,
  knowledgeBase: {
    rebuildRequired: rebuild,
    reason: !apply ? 'Dry run: nothing was written, so the Knowledge Base is unaffected.'
      : rebuild ? changed.length + ' document(s) changed in production. Rebuild the "Security Advisories" Knowledge Base in the Sanity Dashboard so its entries reflect them.'
      : 'No document content changed, so no rebuild is required.',
  },
};
await writeFile('data/ingestion-report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (rebuild) console.log('\nACTION REQUIRED: rebuild the Knowledge Base in the Sanity Dashboard before relying on curated entries.');
