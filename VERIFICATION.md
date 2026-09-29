# Verification record

Executed in WSL Ubuntu-22.04, /home/romil/ai-security-advisory-assistant, on 2026-09-23.

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 50 passed; 1 credential-gated live test skipped |
| npm run build | Passed; Next.js 16.3.6 production build |
| npm run test:e2e | 6 passed across desktop Chromium and mobile Chromium emulation |
| npx sanity build | Passed; local Studio build only |
| npm audit | 0 known vulnerabilities at execution time |
| npm run ingest | Four real GitHub advisories fetched and validated; dry run only |

## What was actually exercised

- Current GitHub REST responses were downloaded, schema-validated, normalized, hashed, and written to local dry-run artifacts.
- The actual AI SDK MCP client connected to a local HTTP test server, initialized, discovered tools, sent bearer authentication, called initial_context and knowledge_base_read, and closed.
- A research orchestration test used real Next.js advisory data with mocked model, Content Lake, and MCP responses.
- Desktop and mobile tests exercised the UI, configuration dialog, example population, result rendering, evidence links, activity, and backend failures.
- Browser screenshots were visually reviewed at both sizes; no horizontal overflow or client page errors were observed in those tested states.
- TypeScript, ESLint, Next.js production compilation, and local Sanity Studio compilation succeeded.
- The generated Studio dist directory is excluded from lint, preventing minified vendor bundles from exhausting lint memory.

## External operations not verified or performed

- No advisory documents were written to Sanity.
- No remote schema or Studio was deployed.
- No Knowledge Base was created or built in the account.
- No actual Context MCP endpoint was authenticated.
- No live AI provider request was made.
- No application was deployed and no repository was pushed.

The application selects existing project o7qa6o3y and dataset production. No new project or dataset was created.

## Live verification still required

Set the missing values in .env.local, complete the steps in README.md, then run:

```bash
RUN_LIVE_TESTS=1 npm run test:live
```

This must use a real model and the actual Knowledge Base endpoint. It asserts that initial_context and knowledge_base_read actually ran, retrieves CVE-2025-29927, checks the documented 14.2.25 branch fix, and verifies that the reported quote occurred in retrieved entry text. Only on success does it write the ignored live-verification.json.

Run a live browser request too before recording the competition demo. Mocked tests and a successful build do not establish live integration.

## Remaining operational limits

(Superseded by the 2026-09-24 live-coverage update below.) Coverage was the four imported historical advisories at the time of writing. KB refresh is manual. Version automation was limited to stable npm releases of Next.js and Vite. Production authentication is a shared invite-only access code and process-local request limits; public multi-instance deployment requires edge/shared limits and account authentication.

## NVIDIA integration update — 2026-09-24

This update supersedes the earlier statement that no live AI provider request was made. Real inference calls were made to NVIDIA; Sanity Context retrieval remains unverified.

- Added NVIDIA Chat Completions routing with official-host validation and redirect rejection.
- Configured the ignored local environment for nvidia/nemotron-3-super-120b-a12b.
- 53 automated backend tests passed (including three new provider routing/schema tests); one live Sanity test remains skipped.
- TypeScript, lint, and the production Next.js build passed after the code changes.
- Nemotron 3 Super passed five application-fit checks in one successful live run, using a public advisory fixture and synthetic KB outline. Earlier errors and other model outcomes are documented in docs/NVIDIA-MODEL-CHECK.md.
- These model tests do not prove a live connection to Sanity, general cybersecurity superiority, universal injection resistance, or stable endpoint availability.
- No Sanity documents, schemas, or Knowledge Bases were changed during this provider update.

## Live Sanity and NVIDIA verification - 2026-09-24

This update supersedes earlier unverified/incomplete integration statements.

- Four published advisory documents were created in existing project o7qa6o3y / production and read back using the reader token.
- The user built the Security Advisories Knowledge Base and created the security-advisor MCP endpoint.
- The actual organization token authenticated successfully. initial_context exposed five entries; knowledge_base_read returned the real Next.js entries.
- Initial live attempts found model-generated invalid paths and altered quotes. The planner now uses enumerated actual outline paths, validates exact KB/path association, and the evidence selector chooses passage IDs; the application copies the original text verbatim.
- 58 offline tests passed; typecheck, lint, and production build passed after these changes.
- The credential-gated Vitest attempt after the fixes hit NVIDIA overload. A subsequent live HTTP POST through the running Next.js /api/research route PASSED equivalent assertions: actual model planning, actual KB reads, actual production lookup, CVE-2025-29927, documented fixed version 14.2.25, and a verbatim quote present in the retrieved entry.
- The successful HTTP request took approximately 70.5 seconds and returned one verified finding for Next.js 14.2.24, assessed as conditional pending deployment checks.
- The full live report is saved locally in ignored live-verification.json. /api/status reports configured=true and no missing credentials; localhost:3000 is reachable from Windows.
- NVIDIA overload errors occurred during verification. This single successful request does not guarantee free-endpoint latency or availability.
- The generated nextjs/advisories entry appears to swap its numbered source labels. The application uses original structured advisory URLs and version ranges, not those generated footnote labels; review the Knowledge Base sources/entries before a public demo.
- No remote Studio/schema deployment, application deployment, or repository push was performed. Local development mode is running.

The model-comparison script now uses the same plain entry-line outline format observed from the live MCP. Earlier model comparison results remain historical observations, not reruns of the changed production selection workflow.

## Live advisory coverage, coverage UX, refresh and dependency analysis — 2026-09-24

This update adds a second, live advisory source. It supersedes the earlier statement that coverage is limited to the four imported advisories.

### Automated checks (re-run after these changes)

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped (was 58 passed) |
| npm run build | Passed; Next.js 16.3.6 production build |
| npm run test:e2e | 8 passed across desktop Chromium and mobile Chromium emulation (was 6) |
| npx sanity build | Passed; local Studio build only |

### Live requests actually executed against the running application

All of the following were real HTTP requests to `POST /api/research` and `POST /api/dependencies` on the local dev server, not mocks.

- **A package outside the original four collection.** `axios` 1.7.3: resolved to npm package `axios`, queried OSV.dev, retrieved 44 advisories, 31 relevant to that version, returned in **5.1 s**. Findings included CVE-2026-44496, CVE-2026-44488 and CVE-2026-44487 with their documented fixed versions. This is the stated success criterion and it passed.
- **Both sources together.** `Next.js` 14.2.24 completed the full path — identity → live lookup → MCP connect → `initial_context` → `knowledge_base_read` (nextjs/advisories, nextjs/mitigations) → verified 2 structured production records → merged result — in **17.4 s**, with `coverage.complete = true`. CVE-2025-29927 appeared **once**, sourced from the reviewed GitHub record, labelled `knowledge-base+live`, with the documented 14.2.25 branch fix and `sourceVersionMatch: true`. The other 29 advisories came from live lookup alone, which the curated import did not cover. No duplicate advisory IDs were present.
- **Cache labelling.** On a repeat request the OSV source reported `origin: cache` at 12 ms while still recording the time the data was actually fetched.
- **Dependency file analysis.** This repository's own `package-lock.json` (715 KB, lockfileVersion 3): 1,263 exact versions queried in **6.8 s**, 0 with advisories. A deliberately outdated synthetic lockfile returned true positives with correct fixed versions — lodash 4.17.20 / CVE-2021-23337 (fixed 4.17.21), minimist 1.2.5 / CVE-2021-44906 (fixed 1.2.6), qs 6.7.0 / CVE-2022-24999, express 4.17.1 / CVE-2024-29041 correctly flagged `dev`, and a symlinked workspace entry skipped and counted. `react` 19.2.0 correctly returned nothing.
- **Refresh command.** `npm run ingest` re-fetched the four curated advisories; a second run returned HTTP 304 for all four via stored ETags and reused the cached responses. `npm run ingest -- --discover axios --limit 3` added three advisory IDs to `data/advisory-sources.json`; re-running reported all three as `already on the list` and added nothing. `knowledgeBase.rebuildRequired` was false throughout because every run was a dry run.

### Provider availability observed during this work

NVIDIA returned `APICallError: Service temporarily overloaded` on several attempts, including a direct probe of the planning call. This is the previously documented free-endpoint flakiness, not a regression. It is now visible rather than silent:

- The curated Knowledge Base path is **degradable**: an availability failure is recorded as a failed source and the request still returns live results. During one such request the app returned 30 live findings in 4.1 s while reporting `sanity-knowledge-base: failed` and `coverage.complete = false`.
- **Evidence-integrity failures remain fatal.** Fabricated quotes, misattributed excerpts and invented advisory IDs throw `EvidenceIntegrityError`, which is never degraded. The existing attribution tests still assert the request rejects.
- Server-side diagnostics log the redacted cause (`[advisory] source "sanity-knowledge-base" did not complete: APICallError — Service temporarily overloaded`). Redaction is unit-tested against provider keys, bearer tokens, URL query strings, userinfo and long opaque strings.

### Restored state and changes not made

- `data/advisory-sources.json` was **restored to the original four advisories** after testing discovery. Expanding the curated production collection is a deliberate decision and was left to the operator; the three discovered axios IDs and their cached raw responses were removed.
- No advisory documents were written to Sanity during this work — every ingestion run was a dry run. No Knowledge Base was rebuilt.
- No remote Studio/schema deployment, application deployment, or repository push was performed.
- The local dev server was restarted twice, because `next build` replaces the `.next` directory that `next dev` is serving from. The previously running process (pid 9378) exited for that reason.

### What remains unverified or incomplete

- **`RUN_LIVE_TESTS=1 npm run test:live` was not re-run to completion after these changes.** The equivalent assertions passed as real HTTP requests, described above. Do not describe the credential-gated Vitest live run as passing.
- OSV.dev coverage is **npm only** in this application. Other ecosystems are reported as unsupported, not answered.
- Live OSV records are unreviewed. They cap at *Conditions to verify* and never reach *Confirmed affected*.
- Full advisory records during a dependency scan are fetched for the 25 most-affected packages only; other affected packages list identifiers only, which the report states.
- The `nextjs/advisories` Knowledge Base entry still appears to swap its numbered source labels. This was not fixed. The application uses the original structured advisory URLs and ranges, not those footnote labels, but the entry should be reviewed before a public demo.
- Production access control is still a shared access code plus process-local limits. `/api/dependencies` uses the same `authorize` and concurrency budget as `/api/research`, with an 8 MB body limit; a public multi-instance deployment still needs edge/shared rate limiting and real authentication.
- No claim is made that this application provides comprehensive vulnerability coverage, and no result establishes that any software is safe.

## Interface motion with GSAP — 2026-09-24

- Installed the official GSAP AI skills (8 skills from `greensock/gsap-skills`) into `~/.claude/skills/` and followed the **gsap-react**, **gsap-core**, **gsap-performance** and **gsap-scrolltrigger** guidance when writing the animation layer.
- Added `gsap@^3.15.0` and `@gsap/react@^2.1.2`. Peer requirements (`gsap ^3.12.5`, `react >=17`) are satisfied by this project's React 19. `npm install` reported **0 vulnerabilities**.
- All motion is isolated in `src/components/dashboard-motion.ts` using `useGSAP()` with a scope ref, so cleanup is automatic and no selector escapes the dashboard root.
- Only transforms and opacity are animated. ScrollTrigger is used for one-shot reveals; nothing is pinned or scrubbed.

### What was verified

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped (unchanged) |
| npm run build | Passed; no SSR error from importing GSAP or ScrollTrigger |
| npm run test:e2e | **12 passed** across desktop and mobile Chromium (was 8) |

Two browser tests were added and pass:

- **Entrance animations settle.** After the GSAP global timeline drains, `.welcome h1`, `.research-panel`, `.guide-panel`, `.connection-banner`, `.topbar` and `.brand` all report a computed opacity of exactly `1`, there is no horizontal overflow, and no page errors were raised. A settled full-page screenshot was captured and visually reviewed at both sizes.
- **Reduced motion.** With Playwright's `reducedMotion: 'reduce'`, the page is asserted **without any settling wait**: the heading is immediately visible and `.welcome h1`, `.research-panel`, `.guide-panel`, `.examples button` and `.results-panel` are all already at opacity `1`. This proves reduced-motion users are never shown hidden content waiting on an animation.

The six pre-existing browser tests still pass unchanged, including the no-horizontal-overflow and zero-page-error assertions.

### Notes

- The Next.js dev overlay shows "1 Issue" in development: a React dev-mode `eval()` warning emitted by `node_modules_next_dist_*.js` under headless Chromium. It was confirmed to originate from Next.js's own development bundle, not GSAP (`grep` finds no `eval(` in `gsap` or `@gsap/react`), and React's own message states it never uses `eval()` in production.
- No application behaviour, data contract, API route, or evidence-validation rule was changed by this work. It is presentation only.

## Colour system — 2026-09-24

The interface previously ran on a single cyan accent, and colour carried almost no meaning: six assessment statuses shared two visual treatments. A semantic palette was introduced, tokenised on `:root` and applied through one `--accent` custom property.

### Measured, not estimated

Contrast was sampled in a real browser against the composited background (accent tints are translucent, so the effective background had to be computed rather than assumed):

| Group | Labels | Distinct colours | Minimum contrast |
| --- | --- | --- | --- |
| Severity | 4 | 4 | 6.09:1 |
| Assessment | 6 | 6 | 5.73:1 |
| Source check status | 4 | 4 | 7.19:1 |
| Provenance | 3 | 3 | 5.98:1 |

**Every sampled pair meets WCAG AA (4.5:1); the measured minimum across all groups is 5.73:1.** Each group is 1:1 label-to-colour, so no two states share a colour.

### Two defects found and fixed during this work

- **The hero gradient bled 40px past the right edge**, creating horizontal page scroll. Caught by the pre-existing `scrollWidth <= innerWidth` assertion, which is exactly why that assertion exists. The wash is now inset to `0` horizontally.
- **The provenance badge's colour disagreed with its label.** The colour class was derived from the advisory record's `provenance.provider` while the text came from `finding.origin`, so a finding labelled "Curated Knowledge Base" could render in the live-source colour. Both now derive from `finding.origin`, a third treatment was added for findings corroborated by both sources, and a browser test asserts the badge's text and class agree.

A third adjustment: the dimmest accent was lifted from `#6d7c90` to `#7f8da1`, raising the weakest measured contrast from 4.54:1 to 5.73:1.

### Checks

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped (unchanged) |
| npm run build | Passed |
| npx sanity build | Passed |
| npm run test:e2e | 12 passed across desktop and mobile Chromium |

No data contract, API route, agent behaviour or evidence-validation rule was changed. This work is presentation only.

## GSAP showcase research, typography, and a motion bug found — 2026-09-24

### A correction to the earlier motion entry

The 2026-09-24 "Interface motion with GSAP" entry above states that entrance animations were verified. **That verification was not sound, and the animations were in fact not running for most users.**

The `matchMedia` helper registered a single condition, `(prefers-reduced-motion: reduce)`. `gsap.matchMedia()` only invokes a handler when one of its conditions *matches*, so the handler ran **only** for visitors who had asked for reduced motion, and never for anyone else. The behaviour was exactly inverted.

Both browser tests passed anyway because both asserted end states — computed opacity `1` and content visible — which are trivially true when nothing animates. A third defect compounded it: the `settled()` helper waited for "no active tweens", and an empty GSAP global timeline satisfies that instantly (`[].every()` is `true`), so it returned immediately and every assertion after it was meaningless.

Measured before the fix:

| Mode | Inline styles applied by GSAP | Headline split |
| --- | --- | --- |
| Normal | none — no animation ran | no |
| Reduced motion | present — animation ran at duration 0 | n/a |

After adding an always-matching `base: 'all'` condition alongside the `reduce` query:

| Mode | Mid-flight panel opacity | Settled opacity | Headline lines |
| --- | --- | --- | --- |
| Normal | `0` (animating) | `1` | 2 |
| Reduced motion | `1` (at rest immediately) | `1` | 0 |

Three tests were added or repaired so this class of bug cannot recur silently: one asserts the panel is **mid-animation** before it settles and that SplitText produced line elements; the reduced-motion test now asserts **zero** split lines; and `settled()` now waits for motion to *start* before waiting for it to finish.

### Showcase research

All 60 showcase entries were extracted by rendering the gallery headlessly, 59 sites' served HTML was fetched along with their stylesheets and scripts, and 26 were rendered to measure computed colour and type. Findings are in [docs/GSAP-SHOWCASE-RESEARCH.md](docs/GSAP-SHOWCASE-RESEARCH.md).

One earlier figure in that research was wrong and is corrected there: counting hex literals in CSS suggested the showcase was 73% light; rendering the sites and measuring computed body luminance showed **65% dark**.

### Typography

The app previously used Arial with a 38px maximum headline against a measured showcase median of **90px**, and 25 of 26 rendered showcase sites use a custom typeface. Inter and JetBrains Mono are now loaded through `next/font`, which downloads and self-hosts them **at build time**, so the running page still makes no request to a third-party font host — consistent with this application's restricted-network posture. The headline is `clamp(38px, 6.2vw, 86px)` and a SplitText line reveal was added with `autoSplit`, so the split survives the variable font swapping in after first paint.

A gradient `background-clip: text` headline was tried and reverted: it fails to an invisible headline where unsupported, and it conflicts with SplitText, which gives each split line its own background box.

### Checks

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped (unchanged) |
| npm run build | Passed |
| npm run test:e2e | **14 passed** across desktop and mobile Chromium (was 12) |

No data contract, API route, agent behaviour or evidence-validation rule was changed.

## Headline/hero-symbol collision — 2026-09-24

Reported from a real browser window: the display headline ran underneath the hero shield graphic.

**Cause.** Raising the headline to `clamp(38px, 6.2vw, 86px)` made it collapse onto a single line at mid-to-wide viewports, while `.welcome-symbol` is absolutely positioned in the top-right of the same container with nothing reserving its footprint.

**Reproduced and bounded.** Sweeping viewport widths showed a collision band of roughly **1450px to 1600px**, worst case **145px of overlap at 1475px**. That band sits between the two configured Playwright projects — desktop at 1440px, where the headline still wraps to two lines, and the mobile project, where the symbol is `display:none` — so no existing test could have caught it.

Two measurement attempts were wrong before the real one: `getBoundingClientRect()` on the `h1` returns the full-width block box, and a `Range` over the `h1` returns SplitText's full-width line wrappers. Both reported a constant 156px "overlap" at every width, which was the container edge, not the text. The correct measurement walks the text nodes and takes the union of their client rects.

**Fix.** `.welcome h1` and `.welcome > p` now reserve the symbol's footprint: `calc(100% - 190px)`, tightening to `calc(100% - 140px)` at the 1200px breakpoint where the symbol shrinks, and released to `none` below 1000px where it is hidden.

**Verified.** A sweep from 360px to 2560px in 40px steps reports no collision at any width, no horizontal scroll at any width, and a tightest clearance of 60px. At 1500px the headline now wraps to two lines with 396px of clearance.

A regression test asserts no overlap and no horizontal scroll at 1220, 1475, 1500, 1600 and 1920px.

Two brittle assertions were also corrected: `toBe('1')` on a computed opacity failed intermittently at `0.9972` and `0.9991` when a tween was sampled a frame before its final commit. Both now assert `> 0.99` numerically. The suite was run three consecutive times with 16/16 passing each time.

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped |
| npm run build | Passed |
| npm run test:e2e | **16 passed**, stable across three consecutive runs (was 14) |

## Showcase research redone at full scale — 2026-09-24

The earlier "GSAP showcase research" entry was based on an incomplete dataset and several of its figures were wrong. It is superseded by [docs/GSAP-SHOWCASE-RESEARCH.md](docs/GSAP-SHOWCASE-RESEARCH.md).

**The gallery holds 494 sites, not 60.** It paginates behind a Load More control that the first pass never found, so that analysis covered roughly 12% of the gallery — and the 12% it covered was the newest page, which is not a neutral sample.

Three further method errors were found and fixed:

- **Plugin pills were read concatenated.** The secondary pills sit inside a zero-width mask element rather than being removed from the DOM, so reading descendant text produced values like `ScrambleTextCustomEase`. Reading `.filtered-gallery__plugin-pill` nodes individually fixed it.
- **Category tags were never captured at all**, although the request asked for a per-tag breakdown. The filters are `<input type="checkbox">` inside `.tag-filters`, not buttons. All 13 have now been toggled and their membership recorded.
- **No animation source was ever read.** 151 sites have now had their HTML and up to four bundles scanned for real GSAP call patterns.

Corrected figures:

| Claim | Earlier | Corrected |
| --- | --- | --- |
| Gallery size | 60 | **494** |
| Dark vs light | 73% light, then 65% dark | **~50/50** (88 sites, evenly sampled) |
| h1 median | 90px | **74px** |
| Custom typeface on h1 | 96% | **74%** |
| CustomEase | 22% | **8%** |
| Draggable | 18% | **9%** |
| Observer | 32% | **20%** |
| Three.js | 28% | **42%** (gallery tag) |

New findings that could not have come from the earlier pass:

- Measured idiom: **`power2.out`** is the dominant ease, **median duration 0.50s**, **median stagger 0.05s**, `start: "top bottom"` / `"top 90%"`, and `toggleActions: "play none none reverse"`.
- **`gsap.matchMedia()` is used by 83%** of sampled sites — which makes the matchMedia bug recorded above a mistake in something the ecosystem treats as standard.
- **ScrollTrigger `scrub` appears in only 7% of sampled sites and `pin` in 4%**, despite ScrollTrigger being on 86% of the gallery. The dominant pattern is a one-shot reveal on enter, not pinned scrub.

The choices already made in this project — `power2.out` default, ~0.5s durations, 0.05–0.09s staggers, `start: "top 92%"`, `gsap.matchMedia()`, SplitText line reveal, and an 86px display headline — all sit inside the measured idiom, so no application change was required by this correction.

The primary datasets are kept at `docs/data/all-sites.json` and `docs/data/bytag.json`. Fetched page source and bundles were not retained. No application code was changed by this work.

## Hero spacing, row reveal, and a tab bar unreachable on mobile — 2026-09-24

Three issues reported from real browser windows. All three were regressions from earlier work in this session.

### 1. Card row appeared misaligned

The scroll reveal animated `.examples button` with `y: 18` and `stagger: 0.07`. Across a row of three siblings that produces up to **18px of vertical desync** mid-reveal, which reads as broken alignment rather than sequencing.

Measured after settling, the cards were always perfectly aligned — top spread and height spread both `0.0px` — so this was purely the in-flight state. The row now sequences with opacity and a slight scale from `transformOrigin: 50% 100%`, with **no vertical offset**. Worst desync across 180 sampled frames is now `0.0px`.

### 2. Hero looked empty

The headline occupied only **49%** of the hero width at 1600px, leaving a **496px dead zone** next to a 130×130px mark — the mark was too small to hold the right side of the composition. It is now 250px (150px at the 1200px breakpoint) with a 104px glyph, and the reserved clearance widened from 190px to 290px accordingly. Verified across 1220–2200px: no collision with the headline and no horizontal scroll at any width.

### 3. The last results tab was unreachable on a phone — the most serious of the three

Adding the Dependencies and Coverage tabs earlier took the tab list to five items. At 360px the list measured **398px wide in a 360px viewport**, overflowing by 68px. The page itself did not scroll horizontally, so the overflow was silently clipped by an ancestor and **the Activity tab could not be reached at all** on a narrow screen.

The tab list now scrolls horizontally on its own (`overflow-x: auto`, hidden scrollbar, `scroll-snap-type: x proximity`, tabs `flex: 0 0 auto`). Verified functionally at 320px, 360px and 390px: the last tab scrolls into view, is clickable, and activates.

This is worth noting as a class of bug: asserting `document.documentElement.scrollWidth <= window.innerWidth` does **not** catch content clipped inside an overflowing descendant. The existing overflow assertion passed throughout.

### Tests added

- Every results tab is reachable and clickable at 320, 360 and 390px, with no page-level horizontal scroll.
- The example card row reveals with vertical desync of at most 1px across 180 sampled frames.

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped |
| npm run build | Passed |
| npm run test:e2e | **20 passed**, identical across two consecutive runs (was 16) |

## Headline descenders clipped by the SplitText line masks — 2026-09-24

Reported from a zoomed screenshot: the `y` in "Clarity" and "your" and the `p` in "update" were cut off flat.

**Cause.** `SplitText` with `mask: 'lines'` wraps each line in an element with `overflow: clip`, sized to the line box. The display `line-height: .98` made that box **shorter than the font's own content area** — Inter's ascent plus descent is about 1.21em — so every descender fell outside the clip region and was cut.

**Fix.** `line-height` raised to `1.04`, and each mask given `padding-bottom: .2em` with `margin-bottom: -.2em`. Padding extends the clip area because `overflow: clip` clips at the padding box; the negative margin keeps the visual line spacing unchanged. Measured room below the baseline went from **11.1px to 42.9px** against an ink descent requirement of **17px**.

### The regression test was wrong first, and was proven before being kept

The first version of the test passed **with the fix reverted**, which made it worthless. The bug was in the test's own baseline maths: it derived half-leading from `measureText('H').actualBoundingBoxAscent` — the *ink* height of a capital — instead of the font's own ascent. That places the baseline too high and reports room that does not exist: it measured 23.1px where the true figure is 11.1px.

Corrected to use `fontBoundingBoxAscent` / `fontBoundingBoxDescent`, then validated in three steps:

| Step | Result |
| --- | --- |
| Fix in place | passes |
| Fix reverted | **fails**: `"Clarity before" has 11.1px below the baseline but the font's ink needs 17.0px` |
| Fix restored | passes |

The failing figure matches a hand calculation from Inter's metrics (≈10.9px), so the test measures the real thing rather than a proxy.

This is the second time in this session a test passed while the behaviour it claimed to cover was broken. Any new assertion about rendered output is now checked by deliberately reverting the fix before the test is kept.

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped |
| npm run build | Passed |
| npm run test:e2e | **22 passed**, identical across two consecutive runs (was 20) |

## Knowledge Base expanded 4 → 122 documents, and the scaling bug it exposed — 2026-09-29

### What was imported

Bulk discovery over 20 npm packages grew `data/advisory-sources.json` from 4 to **122** advisories, inside the Knowledge Base beta budget of 150. `npm run ingest -- --apply` created 118 documents and refreshed 4, all validated against the existing Zod schema with GitHub-provenance checks intact.

Coverage: next 24, vite 15, axios 12, tar 8, lodash 8, undici 6, ws 5, qs 5, mongoose 5, express 5, nodemailer 4, webpack 4, moment 4, sharp 4, jsonwebtoken 4, socket.io 3, semver 2, minimist 2, vue 1, passport 1.

The ingest first failed with `GitHub rate limit reached (HTTP 403)`: `GITHUB_TOKEN` existed in `.env.local` but its value was **blank**, so the importer ran unauthenticated at 60 requests/hour. With a token it fetched all 122 without incident. Note the failure was clean — the script aborts before writing anything to Sanity.

### Knowledge Base rebuild

After a source re-scan and rebuild in the Sanity Dashboard, the outline went from **5 entry paths to 21**, reorganised by package and, for the two largest, by vulnerability class:

```
axios, express, jsonwebtoken, lodash, moment, mongoose, nodemailer, qs,
sharp, socket_io, tar, undici, webpack, ws,
nextjs/cache_poisoning, nextjs/denial_of_service, nextjs/image_optimization,
nextjs/information_disclosure, nextjs/middleware_bypass,
vite/file_access_bypass, vite/path_traversal
```

This measurably improved retrieval precision: a Next.js middleware query now reads `nextjs/middleware_bypass` rather than the old catch-all `nextjs/advisories`.

Sanity Context also raised **1 conflict issue** of its own, flagging that an entry stated CVE-2026-64641 affects 13.0.0–15.5.20 and 16.0.0–16.2.10 while the cited advisory says `>= 13.0.0, < 15.5.21` and `>= 16.0.0, < 16.2.11`.

### The scaling bug this exposed

With 4 documents a curated entry cited about 2 advisories. With 122, the `axios` entry cites 12. Measured against the real entry:

| | Before cap | After cap |
| --- | ---: | ---: |
| Source passages offered to the model | **567** | 30 |
| Enum size for `impactId` / `remediationId` | **568** | 31 |
| Prompt payload | **~44,900 tokens** | ~8,000 tokens |

The model could not answer a schema with 568-value enums across a 12-item array and returned `NoObjectGeneratedError — could not parse the response`. Reducing payload alone was not sufficient; at ~12,000 tokens it still failed, which identified **enum cardinality**, not size, as the cause.

Fixes in `src/lib/evidence-selection.ts` and `src/lib/agent.ts`:

- `PASSAGES_PER_RECORD = 3`, `MAX_SOURCE_PASSAGES = 30`, `MAX_EVIDENCE_PASSAGES = 24`. Impact and patch text sits at the top of a GitHub advisory, so the leading passages are the ones worth offering.
- Evidence selection is offered the first **8** verified records. The live path already provides breadth, so the curated path being focused is a deliberate trade.

**Known limitation:** where a curated entry cites more than 8 advisories, only the first 8 are offered for evidence selection. Those beyond the cap still appear in the report from the live path; they simply do not receive a curated excerpt.

### Verified after the fix

- `Next.js 14.2.24` — full path completed: read `nextjs/middleware_bypass`, verified 5 structured records, returned 30 findings of which **1 is `knowledge-base+live`**, `coverage.complete: true`.
- `axios 1.7.3` — both sources completed, `coverage.complete: true`, 31 findings. The model selected no curated excerpt on that run, which is permitted: an empty selection is valid and does not fail the request.
- NVIDIA remains intermittent. Across these runs the curated path failed roughly half the time with `APICallError — Service temporarily overloaded` and succeeded on retry. The degradable-source design means live results are returned regardless, with the failure recorded.

| Check | Observed result |
| --- | --- |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 124 passed; 1 credential-gated live test skipped |
| npm run build | Passed |
| npm run test:e2e | 22 passed |

All 122 documents are currently `conditionsReviewed: false`, so no finding can yet reach *Confirmed affected*. Reviewing documents in Studio is the remaining step.

## Token Harbor migration - 2026-09-29

User requested a review of Claude's work and migration to the Token Harbor key/model already configured in OpenCode. Inspected the attached handoffs, current code, local OpenCode provider configuration, and the 122-item advisory source list. Older handoff claims of four curated documents are superseded by the September 29 expansion record.

Changes:
- Added explicit token-harbor provider routing through https://tokenharbor.ai/v1/chat/completions.
- Updated ignored .env.local to the exact user-supplied key, deepseek-v4.1-flash:free, and Token Harbor's endpoint. Preserved Sanity settings and restricted file mode to 0600.
- Reject alternate Token Harbor hosts and redirects. The previous NVIDIA adapter remains available but is not selected.
- Kept response_format and all schema/evidence validation. Also provide the requested schema explicitly in a system message because a real planning response returned only {"paths":[...]} rather than the required reads/knowledgeBase structure.
- Disable thinking for schema-constrained DeepSeek requests. A captured Axios selection response finished with reason "length": all 1800 output tokens were consumed by reasoning, content length was zero, and the SDK raised NoOutputGeneratedError. This is observed evidence for this provider/model; it does not establish the cause of every historical NVIDIA failure.
- Added provider transport tests and explicit Token Harbor token-prefix redaction.
- Did not change evidence selection caps, relax attribution, write to Sanity, modify OpenCode configuration, commit, push, or deploy.

Measured live checks:
- Authentication and small structured-output smoke test passed in 1.8 seconds.
- Before schema prompting: OSV completed (31 Axios / 30 Next.js findings), while both curated checks failed.
- After schema prompting alone: Next.js completed, but Axios ran out of output tokens.
- After disabling thinking: both full application orchestration checks passed.
- axios: 32 findings, 7 knowledge-base+live, coverage.complete=true, 25.5 seconds.
- Next.js: 30 findings, 1 knowledge-base+live, coverage.complete=true, 11.0 seconds.

Validation:
- TypeScript and ESLint passed.
- 129 offline tests passed; the credential-gated Vitest live test was skipped.
- The latest successful provider samples are in data/token-harbor-verification.json (no credentials).
- These two full orchestration checks are not six-run reliability trials and are not browser checks. The historical multi-advisory failure should not be declared universally fixed from these samples.
- The provider may cache identical requests; these samples were not forced uncached.
- The app's source/evidence logic and npm-only coverage limitations remain unchanged.

Provider references:
- https://tokenharbor.ai/docs/api/curl
- https://api-docs.deepseek.com/guides/thinking_mode/

## Deployment-readiness audit - 2026-09-29

The application is ready for a controlled staging/private demo after deployment settings are supplied, but it is not yet ready for unrestricted public access. No deployment was performed.

- Production build, TypeScript, and ESLint passed after the latest dependency-result UI changes.
- Full offline Vitest suite: 129 passed, 1 credential-gated test skipped by default.
- Full Playwright suite: 26 passed across desktop and mobile Chromium.
- Opted-in live test passed in 9.97 seconds: real model, Sanity Context MCP Knowledge Base read, production advisory verification, CVE-2025-29927, branch fix 14.2.25, and literal retrieved evidence. This is a single successful run, not an availability guarantee.
- Local .env.local has APP_ORIGIN set to localhost and RESEARCH_ACCESS_TOKEN empty. These must be supplied in the deployment environment. Keep SANITY_WRITE_TOKEN off the web host.
- There is no Git remote or commit yet. No hosted smoke test has been performed.
- npm audit --omit=dev --audit-level=moderate exited 1: 8 moderate findings trace to one transitive undici@7.29.0 under the Sanity Studio/CLI module-federation chain. Other installed undici copies are 7.29.1 or 6.28.1. Do not use npm audit fix --force blindly; it proposes a breaking Sanity downgrade.
- Public multi-instance deployment still needs account-based access and shared/edge rate limiting; the current access token is shared and limits are process-local.
- If deploying on Vercel, its documented 4.5 MB function request limit is below the app's 8 MB package-lock upload limit. Either lower the application limit or choose an upload flow/host that accepts the intended file size.
- The provider's free endpoint has shown intermittent availability in earlier runs. Monitor failures and source coverage after deployment.

## GitHub source upload - 2026-09-29

This update supersedes the earlier statements that the repository was uncommitted or had no remote.

- Pushed the WSL project to the user's existing public repository, `romilp619/ai-security-advisory-assistant`, on `main`. GitHub now stores the source; the web app is not hosted yet.
- Added `docs/GITHUB_SETUP.md` with architecture, environment variables, local setup, Sanity/Token Harbor integration, validation, and later hosting steps.
- Scanned all staged files against active local credentials and common token shapes. No active credential match was found. `.env.local`, raw/import artifacts, verification output, build output, and dependencies stayed out of Git.
- Verified TypeScript, lint, 129 offline tests (1 credential-gated skip), and the production build before upload.
- Updated `npm run typecheck` to generate Next.js route types first, as required for a fresh checkout when `next-env.d.ts` is ignored per the installed Next.js documentation. This typecheck passed.
- No production host, URL, runtime secret store, or hosted smoke test has been configured.
