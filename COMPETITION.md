# DEV Community Sanity Challenge — Path One

## What I Built

AI Security Advisory Assistant is a defensive research workspace for developers investigating documented vulnerabilities in specific software versions. Enter a product, installed version, and question; inspect source-grounded findings, exact affected ranges, branch-specific patches, and evidence limitations.

The interface includes a research form, selectable example questions, advisory cards, a Knowledge Base evidence panel, and an actual-operation activity trail. No simulated successful reports appear when credentials are missing.

## Demo instructions

Complete the authenticated setup in README.md. Import the four real advisories into the existing production dataset, deploy the schema, build/review the Knowledge Base, and configure its dedicated Context MCP endpoint. Run the live test before recording a demo.

1. Ask about Next.js 14.2.24 and its middleware authorization bypass.
2. Open Activity to show initial_context followed by knowledge_base_read.
3. Open Sources to show entry paths, returned text, source URLs and timestamps.
4. Inspect affected ranges and 14.2.25 as the documented fix for that branch.
5. Ask about 14.2.25: show “Outside listed range,” not “safe.”
6. Ask about Vite 6.2.2: show the distinction between a version match and development-server exposure conditions.
7. Try an unsupported product or vendor build to demonstrate honest uncertainty.

## Repository information

- Repository URL: **[Add your actual public repository URL]**
- Deployment URL: **[Add only after deployment and verification]**
- Demo video: **[Add after recording a real session]**
- Sanity project ID field for submission: **o7qa6o3y** (existing project; not a fabricated placeholder)
- Dataset: **production**
- Local WSL directory: /home/romil/ai-security-advisory-assistant

## How I Used Sanity

Sanity stores the advisory schema: identity, product/ecosystem, version ranges, fixes, source descriptions, severity/CVSS when present, dates, provenance, deployment review, and source references. A deterministic importer fetches real GitHub advisory data and preserves source hashes and timestamps.

The Knowledge Base builds a navigable collection over these structured records. Its entries preserve relevant context and source relationships across advisory prose; its issue workflow supports resolving contradictions. This lets the agent discover the relevant context before assessing exact record fields.

## Knowledge Base architecture

Existing Sanity production documents → reviewed Knowledge Base entries and outline → dedicated Context MCP in Knowledge Base mode → application-controlled read operations → parameterized exact advisory verification → validated evidence excerpts and deterministic version assessment.

Only Knowledge Base sources are attached to the MCP. No search engine or local JSON fixture substitutes for live retrieval.

## Which Sanity Context tools were used

Implemented tool calls:
- **initial_context** obtains the Knowledge Base outline.
- **knowledge_base_read** reads the model-selected outline paths using the documented knowledgeBase and paths arguments.

The exact Content Lake verification query is a separate data path and is not described as a Context tool. Live tool execution must be demonstrated with a configured endpoint before submitting this claim as a deployed result.

## How the agent uses the retrieved content

The model selects relevant entries from the outline, then selects advisory evidence and literal impact/remediation excerpts. The server checks that IDs were retrieved, structured records match the requested product, and quotes exist in their claimed sources. Version outcomes are computed conservatively for supported npm versions. Incomplete or contradictory evidence remains visible.

## Example research scenarios

- Next.js 14.2.24: documented middleware bypass, conditions, fixes.
- Next.js 14.2.25: outside that advisory's affected range, with no blanket safety claim.
- Vite 6.2.2: affected version and network-exposed dev-server conditions.
- Next.js 14.2.24+vendor.1: backport/build uncertainty.
- Product outside the imported corpus: evidence not established.

## Testing and verification notes

See VERIFICATION.md for executed results. Automated coverage includes schema/input validation, version boundaries, ambiguity, attribution, conflicting records, local MCP wire behavior, malicious retrieved instructions, API failures, and desktop/mobile browser states.

Real advisory API retrieval is distinct from live Sanity and model integration. No live endpoint transcript, deployed URL, remote schema operation, or user feedback is claimed without evidence.

## Submission disclosure

This application supports a focused historical advisory collection, not exhaustive or real-time security intelligence. Access controls are appropriate for an invite-only demo; public scale requires shared edge rate limiting and account authentication. Remaining external setup must be completed before presenting a live end-to-end demo.
