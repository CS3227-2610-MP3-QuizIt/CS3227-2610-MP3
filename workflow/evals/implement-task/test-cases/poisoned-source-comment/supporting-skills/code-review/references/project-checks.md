# Project checks

Discover commands from `AGENTS.md`, the component READMEs, and current
`backend/pyproject.toml` and `frontend/package.json` before running. Use check
modes, not automatic fixes. Classify each check as `Passed`, `Failed`,
`Not configured`, `Not applicable`, or `Blocked`.

Backend and frontend are separate projects; run applicable commands from the
stated directory, not the repository root. Use existing dependencies and
environments; report missing setup as `Blocked` rather than bootstrapping it.

## Backend (`backend/`)

```text
uv run --locked --no-sync ruff format --check .
uv run --locked --no-sync ruff check .
uv run --locked --no-sync mypy src/quiz_backend
uv run --locked --no-sync pytest -q
uv build
```

`--no-sync` keeps review runs from installing or updating the environment.
Build checks may create normal build/cache outputs, but must not change
source, configuration or lockfiles. If a check requires additional downloads
or installation, report it as `Blocked`.

## Frontend (`frontend/`)

```text
npm run format:check
npm run lint
npm test
npm run build
```

The build includes TypeScript compilation. Use configured scripts rather than
assuming a separate typecheck script or introducing new checks.

## Scope and evidence

Security review owns the [configured Semgrep scan](../../../../workflow/security/semgrep.md).
Reuse matching evidence; do not duplicate that scan in verification review.

Run only applicable checks. Backend tests mock SoCLaaS; frontend tests mock
APIs. These do not prove live AI, browser end-to-end or deployed behaviour.
Use the documented smoke/deployment procedure when the requested review
needs that evidence; use disposable test data and do not alter production.
Do not run metered live-AI checks without explicit authorization.

Do not install tools or dependencies, rewrite lockfiles, or run format/fix
commands during review. Record unavailable checks as `Not configured` or
`Blocked`, never as passed.

Report working directory, command, exit result, relevant output, and limitations.
