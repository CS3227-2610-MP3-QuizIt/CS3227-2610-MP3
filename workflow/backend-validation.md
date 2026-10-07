# Backend validation evidence

Validation took place on 2026-10-07 with uv 0.12.23 and Python 3.14.4. Commands ran
from `backend/`, unless stated otherwise. Runtime/development dependencies were resolved
and installed in backend-local `.venv` with `uv sync`; `uv.lock` is checked in as a new
delivery artifact, and `uv lock --check` passed. No commit or live deployment was made.

## Observed checks

| Check | Observed result |
| --- | --- |
| Initial integrated automated suite | 61 tests passed after isolating the gateway-origin fixture |
| Expanded lifecycle/notification suite | 78 tests passed; subsequent 4 targeted shutdown/deadline/summary regressions passed |
| Full final suite including gateway contract additions | `.venv/bin/python -m pytest -q`: **127 passed in 33.05 seconds**, all provider traffic mocked |
| Ruff source/tests formatting and lint | `ruff format --check .`: 26 files formatted; `ruff check .`: all checks passed; process smoke script also passed formatting/lint |
| mypy application source and tests | `mypy src/quiz_backend tests`: no issues in 24 source/test files |
| Backend CLI | `uv run --locked quiz-backend --help` passed and exposes init-db/seed-demo/serve/live-check |
| Build | `uv build --offline` produced wheel and source distribution successfully |
| Distribution inspection | Migration is included; `.env`, private files, `.venv`, and `.uv-cache` are excluded |
| Process restart/persistence smoke | `python ../workflow/backend_persistence_smoke.py` passed using two isolated subprocesses, API login/class reads, one migration version, and SQLite integrity check |
| Git whitespace check | `git diff --check` passed |
| Specialist final review | **PASS for backend scope**, no unresolved findings; `reviews/backend-01.md` records two fixed findings and eight independently rerun regressions |

Sandboxed async database tests stall because worker/event-loop facilities are restricted.
Tests and the process smoke check were rerun with scoped escalation. Dependency download
and an editable rebuild also needed network escalation. Static analysis and package builds
ran in the workspace. Early integration failures came from a test fixture inheriting a
legacy `/v1` gateway URL; the fixture now explicitly selects a mocked gateway origin.
No private `.env` file was inspected or copied, and no live SoCLaaS calls occurred.

## Acceptance coverage

The specification's acceptance table drives temporary-database integration tests and
direct mocked gateway validation. The suite exercises the complete administrator →
teacher → student → anonymous-summary workflow; authentication/hash storage/revocation/
expiry/login throttling; exact Origin/CORS; roles and resource ownership; frozen rosters;
answer-key leakage; saved answers, deterministic scores, immutable submission and races;
safe DOCX paragraphs/tables, format/XML/expansion/file/text limits and storage cleanup;
strict AI JSON, context budgets, injection boundaries, safe provider errors and usage;
fixed distinct models and stateless requests; hint success allowance and late hint rejection;
summary metrics/latest-state semantics; atomic versions and duplicate completion;
concurrent rolling admission, exact boundary/retry timing, no rejection artifacts,
shared quota across features, and more than ten active targets; durable replay/reuse keys;
pre-start cancellation, task registration failure, absolute timeout, disconnect survival;
restart interruption and persisted admission accounting; and metadata-only scoped SSE,
revoked/expired sessions, and bounded buffers.

Review identified in-flight-admission shutdown and deadline-during-application edge cases.
Integration settled admissions before taking the shutdown worker snapshot, added terminal
row-count checks and a post-application deadline guard, and retained provider usage on
failure. Dedicated regressions passed. Browser state reconciliation remains frontend work.
The final review also consolidated AI request schemas to one canonical set. Gateway
hint regressions distinguish conceptual use of the article "a" from explicit option
selection. The final 127-test run includes all these follow-up changes and a provider-usage
integer overflow regression. Usage counts outside SQLite's signed 64-bit integer range
become null metadata, so provider accounting cannot strand otherwise valid work.

## Limitations and remaining team checks

No frontend/browser rendering or reconciliation tests were run. No production HTTPS,
reverse-proxy/client-IP configuration, persistent volume, live model quality/availability,
GitHub Actions remote run, website, or deployment was tested. CI is provided but has not
run on GitHub during this task. Semantic hint leakage, generated quiz factual correctness,
and summary interpretation cannot be proven by strict format checks; human review remains
necessary. The optional live-check command exists but was not invoked.

## DOCX generation diagnostics follow-up — 2026-10-07

This follow-up supersedes the earlier no-live-check evidence only for the local DOCX
quiz-generation checks described here; it does not validate production deployment,
student hints, class summaries, or teacher browser screens.

Requirement: generate quiz questions from the supplied DOCX, investigate the reported
content rejection, and preserve strict validation, atomic completion, and private data.
Updated `specs/backend-spec.md` defines fixed validation stage/reason codes persisted
inside the existing terminal error envelope. No schema migration is needed. Quiz
instructions now include a concrete placeholder JSON example. No model changes,
automatic provider retries, response repair, or raw-output logging were introduced.

Checks executed from `backend/`:

| Check | Verified result |
| --- | --- |
| `.venv/bin/python -m pytest -q tests/test_gateway_contracts.py tests/test_ai.py` | 81 passed in 14.08 seconds |
| `.venv/bin/python -m pytest -q` | 133 passed in 34.23 seconds; all automated gateway calls mocked |
| `.venv/bin/python -m ruff check .` | Passed |
| `.venv/bin/python -m ruff format --check .` | 27 files formatted |
| `.venv/bin/python -m mypy src/quiz_backend` | Passed, 17 source files |
| `docker build -t quiz-backend:docx-diagnostics .` | Passed |
| `git diff --check` | Passed |
| Running app: authenticated fresh generation of draft 1 from note 1 | HTTP 202 admission; terminal success; five saved questions, revision 1 |
| Persistence verification | Task succeeded, no error, provider HTTP 200; five question rows; source file checksum matches supplied DOCX |

New regression coverage identifies envelope/JSON/schema errors using fixed codes,
checks rejection of reasoning outside JSON, and proves diagnostics expose no provider
text or arbitrary exception messages. Existing eight invalid-quiz cases now verify
that safe diagnostics survive persistence and state reads while the previous draft
remains unchanged, no failed result becomes current, and provider usage is preserved.

The running local container was replaced with the rebuilt image, preserving all of
its original environment settings and the `quiz-backend-data` volume. The old image's
container remains stopped as `quiz-backend-before-docx-diagnostics` for rollback.
No production deployment or configuration change was made. The generated quiz remains
an unpublished draft; teacher review is still required.

Investigation limit: the original task recorded HTTP 200 and valid token usage but
discarded the rejection reason and raw response; the old container logs also contain
no validation diagnostic. The earlier diagnostic call and two additional comparison
calls using the original instructions/input all returned five valid questions. These
comparisons are operator service checks, not application tasks, and do not update the
draft. The original failure therefore remains unreproduced; a precise explanation of
that specific response requires upstream evidence that is not present in this checkout
or either container. Prompt strengthening is a robustness improvement, not proof of
the original cause or a guarantee that every future model response will be valid.
