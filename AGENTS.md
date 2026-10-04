# FeedbackInboxServer

Think/work in English; answer the user in Korean. Actual source/tests/runtime are truth.
This project owns the shared Cloudflare Worker/D1/operator implementation, not the Apple package.
Each app supplies its own Worker/D1/Access configuration and immutable app ID. Never trust client context as authorization.
Preserve current HTTP/storage/receipt contracts. Keep credentials and app-specific deployment settings outside this source tree.
Never rename/delete live Worker, D1 or Access resources during source relocation; never initialize a non-empty production D1.
README.md contains only the approved usage notice and Axient Inc. copyright. Local logs, fixtures and generated artifacts belong outside source.
No GitHub Actions, CI/CD, release automation or .github/workflows unless explicitly requested.
Run the smallest relevant Node/Worker check and preserve locked dependency versions and unrelated edits.
