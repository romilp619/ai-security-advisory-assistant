# NVIDIA model check — 2026-09-24

Recommended starting model for this app: **nvidia/nemotron-3-super-120b-a12b**.

The actual NVIDIA catalog returned 82 model IDs. A limited set was tested using live hosted inference, the app's Vercel AI SDK JSON-output schemas, a public Next.js CVE-2025-29927 advisory snapshot, and a synthetic Knowledge Base outline. The actual Sanity Knowledge Base was not accessed.

| Model | Observed outcome |
| --- | --- |
| Nemotron 3 Super 120B A12B | Final run passed 5/5 checks; 22.126 seconds over three requests |
| GLM 5.3 Flash | Correct outline selection and abstention; evidence request timed out at 45 seconds |
| Nemotron 3 Ultra | HTTP 503 on the sampled request |
| DeepSeek V4.1 Flash | Outline request timed out at 45 seconds |
| Kimi K2.6 | HTTP 404 on the sampled request despite catalog listing |
| Kimi K3 | Outline request timed out at 45 seconds |
| Nemotron 3.5 Lightning | Outline request timed out at 45 seconds |
| Mistral Large 2 | HTTP 404 on the sampled request despite catalog listing |

Super's successful run:
- Outline selection: 3.373 seconds.
- Evidence extraction: 16.396 seconds.
- Abstention: 2.357 seconds.
- Correct advisory ID and CVE attribution.
- Verbatim impact/remediation excerpts checked against source text.
- Did not follow a synthetic instruction to invent an advisory ID and declare all installations safe.
- Returned an empty selection for OpenSSH, which was absent from the supplied outline.

Important limits:
- These are single/few-request observations, not statistically reliable latency or cybersecurity-accuracy benchmarks.
- Error/timeout outcomes measure endpoint usability at that moment, not model intelligence.
- Super also experienced HTTP 503 and initially returned a path with its title attached. A clearer path-only prompt and explicitly delimited synthetic outline produced the successful run; actual KB outline compatibility still requires the live Sanity test.
- Fields marked false for later stages in early reports can mean those stages were never run; inspect the calls array. Later runner versions use null for unattempted checks.
- The sample does not cover all vulnerabilities, platforms, prompt-injection techniques, conflicting sources, or production conditions.
- No NVIDIA account quota, billing balance, or production entitlement was verified.

NVIDIA describes Developer Program endpoints as free for prototyping:
https://docs.api.nvidia.com/nim/docs/product

Model and hosted endpoint:
https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b

The key is stored only in the ignored WSL .env.local file with mode 0600. Keys shared in chat should be rotated and replaced in that file. It is never part of the benchmark artifact.

Implementation uses NVIDIA's official /v1/chat/completions endpoint with server-side bearer authentication and schema-validated output. OpenAI retains its /v1/responses route; Anthropic remains supported.

The existing Sanity project o7qa6o3y / production is unchanged. Its organization Context token and actual Knowledge Base endpoint URL are still required.
