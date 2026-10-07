# Backend implementation workflow

This repository uses a custom specification → implementation → acceptance evidence → review
workflow. No SDD toolkit is used. Product contracts are in `specs/backend-spec.md`;
its acceptance table is authoritative because `specs/specification.md` does not exist.

The root agent owns packaging, configuration, persistence, task lifecycle, notifications,
integration, documentation, and verification. The `core` specialist owns auth, ordinary
domain services, typed schemas, and ordinary routes. The `ai` specialist owns DOCX handling
and the three-operation SoCLaaS abstraction. The `tests` specialist owns automated
acceptance tests. A specialist review follows integration and observed test results.

Agents share named interfaces before implementation and do not edit each other's owned
files. Handoffs identify implemented behavior, interfaces, checks run, and remaining
issues. The root resolves integration failures and records actual evidence in
`workflow/backend-validation.md`. Verified interaction summaries go in `logs/`.

Private `.env` configuration is neither read nor copied. Gateway tests use HTTPX mocks;
live checks, frontend implementation, production deployment, and the product website
remain separate work. Existing user changes to `AGENTS.md` and local skills are preserved.
