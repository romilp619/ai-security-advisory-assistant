# Verification

This record summarizes the latest checks completed in WSL Ubuntu-22.04 for `/home/romil/ai-security-advisory-assistant`. Results below were recorded through **2026-09-29**. This document was shortened on 2026-09-30; the checks were not rerun for this documentation edit.

## Automated checks

| Check | Last recorded result | Scope |
| --- | --- | --- |
| `npm run typecheck` | Passed | Next.js route type generation and TypeScript |
| `npm run lint` | Passed | ESLint |
| `npm test` | 129 passed; 1 credential-gated test skipped by default | Offline unit and integration tests; external services mocked where applicable |
| `npm run build` | Passed | Next.js 16.3.6 production build |
| `npm run test:e2e` | 26 passed | Desktop and mobile Chromium; research transport mocked |
| `RUN_LIVE_TESTS=1 npm run test:live` | Passed once in 9.97 seconds | Real model, Sanity Context MCP, and published advisory verification |

The live test exercised `initial_context` and `knowledge_base_read` against the existing Sanity project (`o7qa6o3y`) and `production` dataset. It verified CVE-2025-29927 for Next.js 14.2.24, the documented 14.2.25 branch fix, and a literal quote from the retrieved Knowledge Base text. One successful run proves that path worked at that time; it does not guarantee future service availability.

## Live application checks

Two full research requests completed with both OSV.dev and the Sanity Knowledge Base reporting success:

| Input | Findings | Findings supported by both sources | Elapsed |
| --- | ---: | ---: | ---: |
| Axios 1.7.3 | 32 | 7 | 25.5 s |
| Next.js 14.2.24 | 30 | 1 | 11.0 s |

Both responses reported `coverage.complete = true`. The credential-free summaries are saved in [data/token-harbor-verification.json](data/token-harbor-verification.json). These are two observed requests, not a reliability or latency benchmark.

The existing `production` dataset contained 122 published advisory documents after the import. The Sanity Knowledge Base was rebuilt and exposed 21 outline paths. A dependency-file check also completed against an outdated sample `package-lock.json`: four exact installed package versions were queried and all four had matching published advisory records. The check does not scan application source code or determine whether a vulnerable path is reachable.

## Remaining limits

- The application source is in the existing [GitHub repository](https://github.com/romilp619/ai-security-advisory-assistant), but the web app has not been deployed to a host. There is no hosted smoke-test result.
- Public hosting still needs production secrets and origin configuration, stronger access control, and shared or edge rate limiting. Keep write credentials off the web host. See [GitHub setup](docs/GITHUB_SETUP.md).
- OSV.dev lookup and dependency-file analysis cover npm packages. A missing advisory is not proof that a package is safe.
- Imported advisory conditions still need human review. Automated version matching alone does not confirm deployment exposure.
- Knowledge Base rebuilds after future imports are manual. For an entry citing more than eight advisories, evidence selection considers the first eight for curated excerpts; other matching live records can still appear in results.
- The last production-dependency audit reported eight moderate findings in a transitive dependency under the Sanity Studio/CLI tree. Review them before unrestricted public deployment.

Secrets, access tokens, and local `.env.local` values are intentionally excluded from this record and from Git.
