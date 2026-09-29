# AI Security Advisory Assistant - submission draft

A solo project by Romil Patel.

## Inspiration

Security advice should be traceable to original advisories and exact versions. I wanted developers to see both the evidence behind an answer and the limits of that evidence, especially when configuration or deployment conditions still need review.

## What It Does

A developer can ask about an npm package and installed version, or drag in a `package-lock.json`. The app checks live OSV.dev advisories and my curated Sanity Context Knowledge Base, then shows affected ranges, source-listed fixes, original links, and coverage of the sources actually checked. It never treats "no match" as proof of safety.

The [nine-step screenshot walkthrough](README.md#step-by-step-screenshots) shows the research question, findings, coverage, source evidence, activity trail, and dependency-file check.

## Why It Is Defensible (and I Can Prove It)

Sanity Context MCP supplies relevant Knowledge Base entries. The server verifies referenced published records in the existing Sanity dataset and checks the package through OSV.dev independently. Model-selected paths and excerpts must match retrieved source data; code calculates version outcomes. Coverage and Activity expose completed operations and failures. The latest recorded validation includes 129 passing offline tests, 26 passing browser tests, and one successful opt-in live integration test. [VERIFICATION.md](VERIFICATION.md) records the evidence and its limits.

## How I Built It

The browser talks to a Next.js Node server. It queries OSV.dev for npm advisories, reads curated entries through Sanity Context MCP, verifies exact advisory records in the existing Sanity **production** dataset, and returns a cited report. A separate importer brings selected GitHub Security Advisories into the existing Sanity project; changed imports require a Knowledge Base rebuild. The current local model uses Token Harbor. Full setup is in [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md).

## What I Learned

Citations must be checked, not merely displayed. Broad Knowledge Base entries created too many choices for structured model output, so I bounded retrieval and validated each selected passage. Independent source paths also let the app report partial results honestly when one service is unavailable.

## Challenges

Advisories can share a CVE yet disagree on affected ranges or fixes. A version match can still depend on deployment conditions. Free model endpoints may be overloaded or return malformed JSON. The app preserves conflicting records, labels unreviewed conditions, validates model output, and reports source failures.

## Accomplishments

I built the research interface, source and activity views, and drag-and-drop dependency check. The existing Sanity production dataset contains 122 imported advisory documents. The Knowledge Base and live model path passed a local end-to-end test for a real Next.js advisory. The code and setup guide are published at [github.com/romilp619/ai-security-advisory-assistant](https://github.com/romilp619/ai-security-advisory-assistant), with API keys excluded from Git.

## What's Next

Choose a Node-compatible host, set server-side secrets and an access code, run a hosted smoke test, review more curated advisory conditions, and add shared rate limiting and account-based access before broad public use. A live deployment URL and demo video will be added only after they exist and are verified.

## Built With

Next.js, React, TypeScript, Node.js, Sanity Content Lake, Sanity Context MCP, OSV.dev, GitHub Security Advisories, Vercel AI SDK, Token Harbor, Vitest, and Playwright.
