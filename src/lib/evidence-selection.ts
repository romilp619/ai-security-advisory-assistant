import { z } from 'zod';
import type { Advisory, Report } from './schema';

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_RULE = /^\s*\|[\s:|-]+\|\s*$/;

export function passages(text: string): string[] {
  return text.split(/\n\s*\n/).flatMap(part => {
    const lines = part.split('\n');
    // A Markdown table contains no blank lines, so it arrives here as one block and
    // would be cut at an arbitrary 1800 characters, often mid-row, leaving nothing
    // cleanly quotable. Each row is already a self-contained record carrying its own
    // advisory id, so split on rows instead.
    if (lines.length > 2 && lines.filter(l => TABLE_ROW.test(l)).length >= 2) {
      return lines.map(l => l.trim()).filter(l => l.length >= 12 && !TABLE_RULE.test(l));
    }
    const chunks: string[] = [];
    for (let offset = 0; offset < part.length; offset += 1800) {
      const chunk = part.slice(offset, offset + 1800).trim();
      if (chunk.length >= 12) chunks.push(chunk);
    }
    return chunks;
  });
}
// A curated entry can cite a dozen advisories, and each advisory description can
// split into dozens of passages. Left uncapped that produced a 568-value enum and a
// ~45,000 token prompt, which the model could not answer with valid structured output.
// Impact and remediation text sits at the top of a GitHub advisory, so the leading
// passages are the ones worth offering.
const PASSAGES_PER_RECORD = 3;
const MAX_SOURCE_PASSAGES = 30;
const MAX_EVIDENCE_PASSAGES = 24;

export function evidenceChoices(entries: Report['entries'], records: Advisory[]) {
  const evidence = records.flatMap(record => entries.flatMap((entry, entryIndex) =>
    passages(entry.content).filter(text => text.includes(record.advisoryId) || Boolean(record.cve && text.includes(record.cve)))
      .slice(0, PASSAGES_PER_RECORD)
      .map(text => ({advisoryId: record.advisoryId, entryIndex, text}))
  )).slice(0, MAX_EVIDENCE_PASSAGES).map((item, i) => ({...item, id: 'e' + i}));
  const source = records.flatMap(record => passages(record.description).slice(0, PASSAGES_PER_RECORD).map(text => ({advisoryId: record.advisoryId, text})))
    .slice(0, MAX_SOURCE_PASSAGES)
    .map((item, i) => ({...item, id: 's' + i}));
  const conflicts = entries.flatMap((entry, entryIndex) => passages(entry.content)
    .filter(text => /\b(conflict|disagree|contradict)/i.test(text)).map(text => ({entryIndex, text})))
    .map((item, i) => ({...item, id: 'c' + i}));
  const schema = z.object({findings: z.array(z.object({
    advisoryId: z.enum(records.map(r => r.advisoryId)),
    evidenceId: z.enum(evidence.length ? evidence.map(e => e.id) : ['none']),
    impactId: z.enum(['none', ...source.map(s => s.id)]),
    remediationId: z.enum(['none', ...source.map(s => s.id)]),
    conflictId: z.enum(['none', ...conflicts.map(c => c.id)]),
  })).max(12)});
  return {
    evidence, source, conflicts, schema,
    resolve(output: z.infer<typeof schema>) {
      return {findings: output.findings.map(item => {
        const quote = evidence.find(e => e.id === item.evidenceId && e.advisoryId === item.advisoryId);
        if (!quote) throw new Error('Unsupported evidence attribution.');
        const sourceText = (id: string) => {
          if (id === 'none') return '';
          const passage = source.find(s => s.id === id && s.advisoryId === item.advisoryId);
          if (!passage) throw new Error('Unsupported source excerpt.');
          return passage.text;
        };
        const conflict = conflicts.find(c => c.id === item.conflictId && c.entryIndex === quote.entryIndex);
        if (item.conflictId !== 'none' && !conflict) throw new Error('Unsupported conflict attribution.');
        return {
          advisoryId: item.advisoryId, entryIndex: quote.entryIndex, evidenceQuote: quote.text,
          impactQuote: sourceText(item.impactId), remediationQuote: sourceText(item.remediationId),
          conflictQuote: conflict?.text ?? '',
        };
      })};
    },
  };
}
