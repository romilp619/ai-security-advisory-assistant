# Handoff — AI Security Advisory Assistant

You are taking over a working Next.js project. Read this fully before changing anything, then inspect the code yourself.

## Workspace and non-negotiable constraints

- Work only inside WSL Ubuntu-22.04. Project directory: `/home/romil/ai-security-advisory-assistant`.
- Do not create a duplicate application or work in a Windows folder.
- Reuse the existing Sanity project: **AI Security Advisory Assistant**, project ID `o7qa6o3y`, dataset `production`, organization `oaewu6zvh`. **Do not create another Sanity project or dataset.**
- Node lives at `/home/romil/.nvm/versions/node/v24.17.0/bin`. Before shell commands:
  ```
  export PATH=/home/romil/.nvm/versions/node/v24.17.0/bin:/usr/bin:/bin
  cd /home/romil/ai-security-advisory-assistant
  ```
- Dependencies are installed. Check whether the dev server is already on port 3000 before starting another.
- `.env.local` is ignored and mode 0600; it holds Sanity + NVIDIA credentials. Inspect that keys exist, never print values, never commit them, never put them in logs or screenshots.
- **Never claim comprehensive vulnerability coverage, and never state that software is safe because no advisory was found.**
- Git: branch `codex/security-advisory`, **no commits yet**, all files untracked. Nothing has been pushed or deployed.

## Stack

Next.js 16.3.6 (App Router) · React 19 · TypeScript · Tailwind 4 · Radix UI · Vercel AI SDK 6 · `@ai-sdk/mcp` 1.x · `@ai-sdk/openai` as an OpenAI-compatible client for **NVIDIA** (`AI_PROVIDER=nvidia`, model `nvidia/nemotron-3-super-120b-a12b`, base URL `https://integrate.api.nvidia.com/v1`) · Sanity client + Studio 6.16 · Zod · semver · Vitest · Playwright · **GSAP 3.15 + @gsap/react 2.1**.

There is no OpenAI key. `@ai-sdk/openai` is only a compatible client for NVIDIA.

## What the application does

A user enters a software name, an optional version, and a security question. The app answers from **two independent sources** and always states which one each finding came from:

1. **Live advisory lookup — OSV.dev.** Queried per request for the exact npm package and version. This is what gives coverage beyond the curated import and it does not wait on any Knowledge Base rebuild.
2. **Curated Sanity Context Knowledge Base.** Reviewed advisory records retrieved over MCP, with model-driven path selection and evidence excerpting.

Request flow: resolve npm package identity → query OSV (all advisories + a version-scoped query) → connect Sanity Context MCP → `initial_context` → model picks entry paths from enumerated actual values → `knowledge_base_read` → extract GHSA ids → fetch structured records from `production` → model selects evidence by passage ID (the app copies the text verbatim) → deterministic version assessment → merge, dedupe, order → report with a coverage record.

It does **not** search the internet, discover new vulnerabilities, scan code or running deployments, or provide exhaustive coverage.

## Architectural rules you must not break

- **The live path uses no model at all.** Relevance is decided by exact package+version matching; excerpts are copied verbatim from the retrieved record in application code. This is deliberate — it is faster and removes hallucination risk from that path.
- **The Knowledge Base path is degradable.** If the model provider or MCP is unavailable, that source is recorded as `failed` and the request still returns live results.
- **Evidence-integrity failures are always fatal.** Fabricated quotes, misattributed excerpts and invented advisory IDs throw `EvidenceIntegrityError`, which is never degraded to a partial result. Do not relax these checks to make model responses pass.
- **Only `https://api.osv.dev` is contacted**, as a compile-time constant. No model output, advisory field or user input may direct a request elsewhere.
- **A failed or incomplete lookup is never presented as "no vulnerabilities."**
- The model receives no tokens, filesystem, execution tools or user-chosen URLs. Error responses never include upstream errors or credentials.

## Key files

```
src/lib/osv.ts                OSV.dev client — fixed host, paging, bounded retry, batch
src/lib/live-advisory.ts      OSV normalisation, range intervals, alias dedup, verbatim excerpts
src/lib/live-lookup.ts        live orchestration, caching, source cross-check, ordering
src/lib/package-identity.ts   display name -> exact npm package, ambiguity handling
src/lib/advisory-cache.ts     10-minute in-process TTL cache
src/lib/lockfile.ts           package-lock.json parsing (v1/v2/v3), data only
src/lib/dependency-scan.ts    bounded batch scanning of a dependency tree
src/lib/logging.ts            redacted server-side diagnostics
src/lib/source-list.ts        editable curated import list
src/lib/agent.ts              orchestration, source merging, coverage record
src/lib/schema.ts             advisorySchema, liveAdvisorySchema, Coverage, Finding
src/lib/versions.ts           deterministic version policy + source reconciliation
src/lib/mcp.ts                authenticated MCP client
src/components/dashboard.tsx  UI
src/components/dashboard-motion.ts  all GSAP motion, isolated from the UI
src/app/api/research/route.ts       NDJSON streaming
src/app/api/dependencies/route.ts   lockfile analysis (8 MB body limit)
scripts/ingest.ts             extensible importer
docs/GSAP-SHOWCASE-RESEARCH.md      design research, with its own corrections
docs/data/*.json                    494-site showcase dataset
VERIFICATION.md                     honest record of what passed and what did not
```

## Commands

```
npm run typecheck
npm run lint
npm test                 # 124 unit tests, 1 credential-gated live test skipped
npm run build
npm run test:e2e         # 22 browser tests, desktop + mobile Chromium
npx sanity build
npm run ingest                                 # dry run
npm run ingest -- --apply                      # writes to production
npm run ingest -- --only next                  # refresh one package or GHSA id
npm run ingest -- --discover axios --limit 5   # add advisory ids to the curated list
RUN_LIVE_TESTS=1 npm run test:live
```

## Current verified state

All of the following passed on the last run:

| Check | Result |
| --- | --- |
| typecheck | PASS |
| lint | PASS, zero warnings |
| `npm test` | 124 passed, 1 skipped |
| `npm run build` | PASS |
| `npx sanity build` | PASS |
| `npm run test:e2e` | 22 passed, twice consecutively |

Real HTTP requests against the running dev server:

- `axios@1.7.3` — a package the curated import never covered — resolved, queried OSV, **44 advisories retrieved, 31 relevant**, returned in ~6.7s with `coverage.complete: true`. Both sources completed.
- `Next.js@14.2.24` — full path including MCP and the model. CVE-2025-29927 appears **once**, sourced from the reviewed record, labelled `knowledge-base+live`. The other 29 advisories come from live lookup alone.
- `package-lock.json` (715 KB, 1,263 exact versions) scanned in ~6.8s. A deliberately outdated lockfile returned true positives: lodash 4.17.20/CVE-2021-23337, minimist 1.2.5/CVE-2021-44906, qs 6.7.0/CVE-2022-24999, express 4.17.1/CVE-2024-29041 correctly flagged dev, symlinked workspace skipped.

## Bugs found and fixed in this session — read these, they are the traps

1. **`gsap.matchMedia()` was registered with only a `(prefers-reduced-motion: reduce)` condition.** matchMedia runs a handler only when a condition *matches*, so animations ran **only** for users who asked for reduced motion and for nobody else. Fixed by adding an always-matching `base: 'all'` condition alongside it. 83% of GSAP showcase sites use matchMedia; this is standard and easy to get backwards.
2. **A test helper returned instantly on an empty timeline** (`[].every()` is `true`), so every assertion after it was meaningless. Two tests passed while nothing animated.
3. **Headline overlapped the hero symbol between ~1450px and ~1600px** — the band fell exactly between the desktop (1440) and mobile test viewports. `.welcome h1` now reserves the symbol footprint with `max-width: calc(100% - 290px)`.
4. **The provenance badge's colour class came from the advisory's provenance while its label came from `finding.origin`**, so a badge could read "Curated Knowledge Base" while styled as a live result. Both now derive from `finding.origin`.
5. **The results tab list overflowed a phone viewport by 68px and the Activity tab was unreachable.** The page itself did not scroll horizontally, so it was silently clipped. The tab list now scrolls on its own. Note: `scrollWidth <= innerWidth` does **not** catch content clipped inside an overflowing descendant.
6. **SplitText's line masks (`overflow: clip`) clipped descenders** because `line-height: .98` is shorter than Inter's content area (~1.21em). Fixed with `line-height: 1.04` plus `padding-bottom: .2em` / `margin-bottom: -.2em` on the masks.
7. **The hero gradient stopped at the text box, leaving a hard vertical step** at the content edge (measured 11.22/255 at exactly x=276). Now spans the full content column via a `--gutter` token and is feathered with a mask; re-measured at 2/255.
8. **The example card row staggered vertically during its reveal**, reading as misalignment. Now sequences opacity and scale with no vertical offset.

**Two of these (1 and 6) had regression tests that passed while the bug was present.** Standing rule adopted: after writing any test that asserts rendered output, deliberately revert the fix and confirm the test fails before keeping it.

## Design system

- Dark base, semantic colour tokens on `:root`, applied through one `--accent` custom property. Severity, assessment status, source-check status and provenance each map 1:1 to a distinct colour. All sampled pairs meet **WCAG AA**, measured minimum **5.73:1** against composited backgrounds.
- Inter + JetBrains Mono via `next/font`, **self-hosted at build time** so the page makes no runtime third-party request. Headline `clamp(38px, 6.2vw, 86px)`.
- GSAP motion isolated in `dashboard-motion.ts`: `useGSAP()` with a scope ref, transforms and opacity only, ScrollTrigger one-shot reveals, SplitText line reveal, `gsap.matchMedia()` for reduced motion.

## What remains incomplete

- **`RUN_LIVE_TESTS=1 npm run test:live` has not been re-run to completion.** Equivalent assertions passed as real HTTP requests. Do not describe the credential-gated Vitest live run as passing.
- OSV coverage is **npm only**; other ecosystems are reported unsupported, not answered.
- Live OSV records are unreviewed and cap at *Conditions to verify*; they never reach *Confirmed affected*.
- Dependency scans fetch full records for the 25 most-affected packages only; others list identifiers, which the report states.
- The `nextjs/advisories` Knowledge Base entry appears to swap its numbered source labels. The app uses original structured URLs and ranges, not those labels, but review it before a public demo.
- Production access control is a shared access code plus process-local rate limits. A public multi-instance deployment needs edge/shared limiting and real authentication.
- **Lenis smooth scroll was deliberately not adopted** despite 62–68% adoption in the GSAP showcase; it replaces global scroll behaviour and interacts with ScrollTrigger and the browser tests.
- Nothing is committed, deployed, or pushed. No Sanity documents were written in this session — every ingestion run was a dry run.

## Working expectations

1. Read the code and `VERIFICATION.md` before changing anything.
2. Confirm the app still runs locally.
3. Keep changes in this WSL project and this Sanity project/dataset.
4. Add meaningful tests, and prove each new rendered-output test fails without its fix.
5. Update `README.md` and `VERIFICATION.md` with what actually passed and what remains incomplete. Do not overstate verification.
6. Do not redesign the UI, replace the stack, or rerun large model comparisons unless a concrete blocker requires it.

## Current provider update - 2026-09-29

The user has switched the application's provider to Token Harbor. The current local configuration is AI_PROVIDER=token-harbor, AI_MODEL=deepseek-v4.1-flash:free, AI_BASE_URL=https://tokenharbor.ai/v1. Credentials remain only in .env.local. OpenCode configuration was read for endpoint/model discovery but not changed.

Read the final Token Harbor section of VERIFICATION.md for measured migration results. Both Axios and Next.js passed a live sample after provider compatibility changes (schema in prompt and DeepSeek thinking disabled for structured calls). This does not satisfy the six-run stability criterion in the separate evidence-selection task; do not describe that task as fully completed.

The current source list contains 122 advisories. See September 29 verification notes rather than older four-document statements.
