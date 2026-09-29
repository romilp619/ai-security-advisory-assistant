# Task: fix the evidence-selection call failing on multi-advisory entries

Read `docs/HANDOFF.md` first for the project's constraints and architecture. Everything in it still applies — in particular, do not weaken any evidence-integrity check to make model output pass.

## The problem in one sentence

The second model call in the Knowledge Base path — evidence selection in `src/lib/agent.ts` (`deps.select`, which builds its schema in `src/lib/evidence-selection.ts`) — fails with `NoObjectGeneratedError: No object generated: could not parse the response` whenever the curated entry cites many advisories, while succeeding reliably when it cites few.

## Reproduce it

Start the dev server, then:

```bash
# FAILS roughly 2 of 3 runs
curl -s -N -X POST http://127.0.0.1:3000/api/research \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"software":"axios","version":"1.7.3","question":"Which documented advisories affect this version, and what are the listed fixed versions?"}'

# SUCCEEDS reliably (measured 6/6)
curl -s -N -X POST http://127.0.0.1:3000/api/research \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"software":"Next.js","version":"14.2.24","question":"Which documented middleware authorization bypass affects this version? Include CVE-2025-29927 and its fixes."}'
```

Look at `coverage.sources[] where id == "sanity-knowledge-base"`. The failure is logged server-side as a redacted diagnostic: `[advisory] source "sanity-knowledge-base" did not complete: NoObjectGeneratedError`.

The difference between the two cases:

| | Next.js | axios |
| --- | --- | --- |
| Entry paths read | `nextjs/middleware_bypass` | `axios/prototype_pollution`, `axios/proxy_ssrf_dos` |
| Structured records verified | 5 | 12 (capped to 8 for selection) |
| Result | succeeds 6/6 | fails ~2/3 |

## What has already been ruled out — do not repeat these

Each of these was measured, not assumed.

**1. Prompt payload size is not the cause.** The selection payload was reduced from **~44,900 tokens → ~12,000 → ~2,400** by capping passages and making the splitter table-aware. It still fails at 2,400 tokens.

**2. Record count is not the cause.** Records offered to selection were swept 8 → 6 → 4 → 3. Failure stayed at roughly 50% at every value, and even successful runs returned no curated finding.

**3. Entry formatting is not sufficient on its own.** The Knowledge Base instructions were rewritten to require prose over tables and the KB was rebuilt. Context split `axios` into two entries and de-tabled one of them (`axios/proxy_ssrf_dos` went from 90 table pipes to 10), but `axios/prototype_pollution` is still a table at 78 pipes, and the end-to-end result did not improve.

**4. The model is not simply overloaded.** A fresh NVIDIA API key removed the `APICallError — Service temporarily overloaded` failures entirely; the Next.js query went from 4/6 to 6/6. `NoObjectGeneratedError` is a different, persistent failure.

**5. Switching model does not help.** Benchmarked on this exact selection task: `nemotron-3-super-120b` 0/3, `nemotron-3-ultra-550b` 0/3 (`NoObjectGeneratedError`), `gpt-oss-20b` 1/3, `gemma-4-31b-it` 0/3, `nemotron-3-nano-omni-30b` 0/3, `deepseek-v4.1-flash` 0/3. Note some zeros may reflect self-inflicted rate limiting during benchmarking. `nemotron-3-ultra-550b` also exceeds the 100s request budget end-to-end.

## The remaining hypothesis

The failure tracks **structured-output schema complexity**, not input size. The schema built in `evidenceChoices()` is an array of up to 12 objects, each with five enum-typed fields, where `impactId` and `remediationId` share an enum of up to 31 values. Nemotron appears unable to emit valid JSON against that shape once the record count grows.

## Suggested direction (verify before committing to it)

Consider replacing the single large constrained call with something the model can actually satisfy. Options worth measuring:

- **One call per advisory.** Ask for a single finding at a time against a small schema (one advisory, a handful of passage ids). Slower, but each call is trivial. Bound total calls and run them with limited concurrency inside the existing request timeout.
- **Two-stage selection.** First ask only *which advisory ids are relevant* (a small enum, no nesting). Then ask for passage ids for just those, in a second small call.
- **Drop enums for plain strings plus post-validation.** The application already re-validates every returned id and copies text itself, so the enum is defence in depth rather than the actual guarantee. Removing it must not remove the post-validation — `evidenceChoices().resolve()` and the attribution checks in `agent.ts` must still reject any unknown or cross-advisory id.

Whichever you pick, **measure it** across at least 6 runs of the axios query before declaring it fixed, and confirm the Next.js query still succeeds.

## Hard constraints

- Do not relax `EvidenceIntegrityError`, the passage-id resolution in `evidenceChoices().resolve()`, or the cross-advisory attribution checks in `agent.ts`. A fabricated or misattributed excerpt must still abort the request.
- The application must keep copying excerpt text itself. The model returns ids only.
- A failed selection must continue to be reported as a failed source with `coverage.complete: false`, never as an absence of advisories.
- Keep the request inside the existing 100s budget.
- Do not commit, deploy, or write to Sanity.

## Current state of the code

```
src/lib/evidence-selection.ts   PASSAGES_PER_RECORD = 3
                                MAX_SOURCE_PASSAGES = 30
                                MAX_EVIDENCE_PASSAGES = 24
                                passages() is table-aware (splits Markdown rows), 3 unit tests cover it
src/lib/agent.ts                records.slice(0, 8) before selection
                                maxRetries: 2 on both generateText calls
.env.local                      AI_MODEL=nvidia/nemotron-3-super-120b-a12b
```

`npm run typecheck`, `npm run lint` and `npm test` (127 passed, 1 skipped) are green. Nothing is committed.

## Definition of done

- The axios query returns `coverage.complete: true` in at least 5 of 6 consecutive runs, with at least one finding whose `origin` is `knowledge-base+live`.
- The Next.js query still succeeds at the same rate.
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` all pass.
- Any new test asserting model behaviour is proven to fail with the fix reverted before it is kept — two tests in this project previously passed while the bug they covered was live.
- `VERIFICATION.md` updated with measured numbers, including anything that did not work.
