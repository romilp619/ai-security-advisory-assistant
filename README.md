# AI Security Advisory Assistant

An evidence-first workspace for researching known vulnerabilities in npm packages. Ask about a package and version, or check a `package-lock.json`; the result links back to published advisories and shows what was actually checked.

**Status:** The source is on GitHub and the local app has passed a live integration test. A public web deployment has not been configured.

## Inspiration

A vulnerability answer is only useful if a developer can tell which package and version it applies to, where the claim came from, and what remains uncertain. Advisory data is spread across sources, while a fluent AI answer can blur version ranges or overlook deployment conditions. We built a workspace that keeps the evidence visible from question to conclusion.

## What It Does

- Researches a named npm package, an optional installed version, and a security question.
- Checks live advisories from OSV.dev and relevant entries in our Sanity Context Knowledge Base.
- Shows affected ranges, source-listed fixes, deployment conditions to verify, original links, and a record of completed or failed source checks.
- Accepts a `package-lock.json` by file picker or drag and drop, then checks exact direct and transitive dependency versions against published advisories.
- Reports uncertainty explicitly. No match is not presented as proof that software is safe.

The lockfile check reads JSON as data; it does not run install scripts or scan application code.

## Why It Is Defensible (and We Can Prove It)

The server reads the Knowledge Base through Sanity Context MCP, verifies referenced published advisory records in the existing Sanity dataset, and checks npm advisories live through OSV.dev. The model selects relevant paths and source passages; application code validates those selections and calculates version outcomes. A finding links to its original record, and the Coverage and Activity views show which real operations completed.

The app does not let retrieved text add tools or change the trusted endpoints. If a source fails, the report records the failure instead of presenting a complete-looking answer. Its version assessment can show **Conditions to verify**, **Conflicting evidence**, or **Outside listed range** rather than inventing certainty.

This behavior is testable: 129 offline tests and 26 browser tests passed in the latest recorded full run. An opted-in live test also exercised the model, Sanity Context, the existing production dataset, and a real Next.js advisory. See [the verification record](VERIFICATION.md) for dates and limits of those checks.

## How We Built It

`Browser -> Next.js server -> OSV.dev + Sanity Context MCP -> verified Sanity advisory records -> version and evidence checks -> cited report`

We used the existing Sanity project **AI Security Advisory Assistant** (`o7qa6o3y`) and its existing **production** dataset. An importer collects selected original GitHub Security Advisories into structured records. Sanity Context builds navigable Knowledge Base entries over those records; the app uses the Knowledge Base for relevant context and checks exact records for version boundaries. Live OSV.dev lookup extends coverage beyond the curated collection without waiting for a Knowledge Base rebuild.

The current local model configuration uses Token Harbor's `deepseek-v4.1-flash:free`. Credentials stay server-side in an ignored local environment file or, later, a host's secret store. [The setup guide](docs/GITHUB_SETUP.md) explains the architecture, keys, local run, and future hosting steps.

## What We Learned

A citation alone does not make an answer reliable. We had to validate that selected Knowledge Base paths really existed, excerpts appeared in their claimed sources, and version conclusions agreed with source records. Separating live lookup from curated context also made partial failures visible: a model or Knowledge Base outage should not erase a completed live advisory check.

The expanded advisory collection showed that broad prompts can overwhelm a model. Bounded retrieval and evidence selection made the work more predictable while keeping source links available for human review.

## Challenges

- GitHub advisory records can share CVEs while listing different affected ranges or fixes. We preserve source-level differences instead of silently choosing one.
- Version matches do not establish whether a vulnerable feature or deployment condition is present. Those cases remain conditional until reviewed.
- Free model endpoints can be overloaded or return malformed structured output. The server validates model output and reports source failures.
- Curated Knowledge Base entries must be rebuilt after changed imports. The importer reports when a rebuild is required.

## Accomplishments

- Built a working research UI with source evidence, coverage, activity, and a drag-and-drop dependency-file check.
- Imported 122 advisory documents into the existing Sanity production dataset and connected the Knowledge Base through its MCP endpoint.
- Verified an end-to-end local research request against real Sanity and model services, including the documented Next.js 14.2.24 middleware advisory and its branch-specific fix.
- Published the source and reproducible setup instructions while keeping local API keys out of Git.

These are observed checks, not a claim that every vulnerability or deployment condition is covered.

## What's Next

Choose a Node-compatible host, configure server-side secrets and an access code, and run a hosted smoke test. Review more curated advisory conditions in Sanity Studio, rebuild the Knowledge Base when records change, and add shared rate limiting and account-based access before opening the app to broad public use.

## Built With

Next.js, React, TypeScript, Node.js, Sanity Content Lake, Sanity Context MCP, OSV.dev, GitHub Security Advisories, Vercel AI SDK, Token Harbor, Vitest, and Playwright.

For setup and architecture, start with [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md). For the exact tests performed, see [VERIFICATION.md](VERIFICATION.md).
