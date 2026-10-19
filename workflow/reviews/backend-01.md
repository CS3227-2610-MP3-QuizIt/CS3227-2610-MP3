# Backend implementation review 01

## Status

- Target: the complete backend implementation requested in the uv implementation plan, reviewed on 2026-10-07.
- Scope: backend application, request/response contracts, SQLite reference/migration, configuration, locked dependencies, CLI, CI, tests, guides, reflections, workflow evidence, and interaction summary.
- Overall: **PASS for the backend implementation scope**.
- Independent human review: **READY**, with the manual checks below explicit.
- No unresolved Blocker, High, Medium, or Low findings remain. One Low and one Medium finding were fixed during review and retain their stable IDs below.

The reviewer applied `.agents/skills/code-review/SKILL.md` and its project-checks, review-criteria, and review-report references. Product authority is the user-approved plan, `assignment-brief.md`, and the actual backend/frontend specifications and schema. ResolveIT, MP2, Gradle, Java, Java line-length/Javadoc, and unavailable requirements paths do not define this Python backend.

The native plan/todo tool requested by the skill is unavailable: inspection of the callable tool catalog found no matching tool. The explicit completed checklist below records applicable checks instead; no unavailable tool or remote check is reported as passed. The specialist previously implemented `auth.py`, `core.py`, `api.py`, and `schemas.py`; the review of the root-owned task manager, gateway integration, packaging, and evidence is independent of that implementation. A separate human review remains valuable.

## Checks

All applicable local review checks are complete. Commands below ran from `backend/` unless indicated otherwise. Reviewer-run checks and evidence supplied by the integration owner are distinguished.

| Completed check | Status | Evidence and limitation |
| --- | --- | --- |
| Scope, sources, Git diff, unrelated changes | Passed | Read changed/new files and `git status --short`, `git diff --stat`, and relevant tracked diffs. User changes to `AGENTS.md` and the Python skill were preserved. Reviewer edited only this report. |
| Compilation/imports and CLI | Passed | Reviewer compiled all 16 source modules with `compile(...)` without writing bytecode and ran `.venv/bin/quiz-backend --help`; init-db/seed-demo/serve/live-check commands are exposed. |
| Final full automated suite | Passed | Integration owner supplied `.venv/bin/python -m pytest -q`: **127 passed in 33.05 seconds**, including the final canonical-schema and usage-bound changes. Recorded in `workflow/backend-validation.md`. All gateway traffic is mocked. |
| Independent selected regressions | Passed | Reviewer ran eight tests: in-flight admission shutdown, deadline during result application, concurrent rolling boundary, idle SSE expiry, buffered membership revocation, failed-upload cleanup, hint input/allowance, and historical/reused operation keys. **8 passed in 5.80 seconds**. Reviewer also directly checked final usage normalization at the SQLite integer boundary and invalid boolean/string/negative counts. Scoped unrestricted test execution was necessary because sandboxed async SQLite tests stall. |
| Formatting and lint | Passed | Reviewer reran `.venv/bin/ruff format --check .` and `.venv/bin/ruff check .`: 26 files already formatted; all checks passed. A transient formatting failure in an in-progress test edit was corrected before this final rerun. |
| Type checks | Passed | Reviewer reran `.venv/bin/mypy src/quiz_backend tests`: no issues in 24 files. |
| Dependency lock and build | Passed | Integration owner supplied `uv lock --check` and final `uv build --offline` success. No tools/dependencies were installed by the reviewer. |
| Package/resources/private exclusions | Passed | Reviewer inspected wheel and source distribution: migration included; wheel includes CLI; `.env`, private files, `.venv`, and `.uv-cache` excluded. Wheel contains 21 files; source distribution contains 31. |
| Schema alignment | Passed | Reviewer executed reference and migration DDL in isolated in-memory SQLite databases and compared all non-internal schema objects; they match exactly. Connection pragmas and migration versioning were inspected and covered by tests. |
| Restart/persistence smoke | Passed | Integration owner supplied the two-process smoke result: account/class API state persisted; one migration version and SQLite integrity verified. The reviewer inspected the script, which explicitly disables `.env` reading and makes no gateway call. |
| Specification and security mapping | Passed | Code and test inspection completed against the acceptance areas below; no unresolved backend acceptance defect identified. |
| Guides, diagrams, workflow, logs | Passed | Read UserGuide, DeveloperGuide, Reflections, backend README, workflow implementation/validation and persistence script, and verified interaction summary. Backend-only status and manual limitations are explicit. Specification architecture remains consistent with implementation. |
| CI configuration | Passed by inspection | Locked uv environment, Python 3.14, lint/types/tests/build, scoped triggers, and read-only permissions are configured. Pinned action commits were verified at the official GitHub commit pages linked below. An actual remote CI run was **not performed**. |
| Whitespace | Passed | Reviewer ran `git diff --check` from repository root; no output/errors. |
| Java/Gradle and browser GUI checks | Not applicable | No Java/Gradle application or frontend implementation is included in this task. Browser reconciliation remains explicitly separate frontend work. |
| Live gateway/production deployment checks | Not applicable to this delivery | User scope excludes live requests and deployment. No live availability, HTTPS, reverse-proxy, persistent-volume, or production claim is marked verified. |

CI pins reference [actions/checkout commit 3d3c42e](https://github.com/actions/checkout/commit/3d3c42e5aac5ba805825da76410c181273ba90b1) and [astral-sh/setup-uv commit c771a70](https://github.com/astral-sh/setup-uv/commit/c771a70e6277c0a99b617c7a806ffedaca235ff9). Verification confirms the configured commits exist; it does not substitute for running GitHub Actions.

## Acceptance and design review

| Requirement area | Implementation and acceptance evidence | Reviewed outcome |
| --- | --- | --- |
| Authentication and browser protection | `auth.py`, `core.py`, `main.py`; workflow authentication/session/login-limit/Origin/CORS tests | Argon2id, hashed 256-bit opaque tokens, eight-hour revocable sessions, production Secure cookie, exact mutating Origin checks, sanitized validation errors, persisted username/IP failure window. |
| Roles, ownership and privacy | `core.py`, role-specific `schemas.py`, API/task access checks; ownership/leakage tests | Teachers must own quizzes and remain assigned; students retain frozen-roster access and see keys only through submitted results; admins see published metadata and anonymous summary aggregates. |
| Accounts, classes, drafts, publication | Core transactions; full workflow/publication/teacher revocation tests | Case-insensitive usernames, idempotent membership, private teacher notes, reviewed revision required, valid questions/nonempty roster frozen atomically, generation/publication serialized. |
| Attempts and grading | Core write transactions and conditional row counts; answer/submission race and immutable-result tests | One resumable attempt per frozen student; cross-quiz question rejection; every answer required; deterministic score; repeat submission returns persisted result; late saves cannot mutate it. |
| Uploads | `notes.py`, bounded request parsing, shielded storage/persistence; upload format/XML/expansion/cleanup tests | One DOCX, bounded compressed/expanded/text sizes, safe paragraph/table extraction outside event loop, opaque private files, no external fetch, cleanup after failed persistence. |
| Gateway/input/output contracts | `ai.py`; 42 direct gateway-contract cases plus integration AI tests | Three distinct fixed models; stateless nonstreaming Responses payloads; complete conservative context budget; strict JSON/field/count/length validation; no provider retries/fallback/tools; safe failures and retained available usage, with invalid/out-of-range counts normalized to null. |
| Hints and summaries | Snapshot/input validators, task completion, backend metrics; allowance/leakage/late-completion/summary tests | Hint outbound data omits options/keys/explanations; successful allowance counts history; submitted attempts reject late hints. Summaries use anonymous authoritative aggregate metrics; latest failure never substitutes older success. Semantic quality remains human-reviewed. |
| Admission and idempotency | `TaskManager.admit`, `_commit_admission`; concurrent rolling/key/reuse tests | Replays/reuse precede fresh eligibility/rate checks; every accepted reuse binds its key. SQLite atomically admits 30 fresh requests in the strict rolling 60-second window; rejection creates no task/key/latest mutation. No queue, dispatcher, semaphore, or unfinished-task cap. |
| Lifecycle, deadlines, atomic completion | `run`, `succeed`, `terminal`, startup/shutdown; lifecycle regressions | Strong references independent of HTTP caller, absolute monotonic/persisted deadlines, post-apply deadline rollback, permissions/state/latest/revision rechecked, result and terminal versions atomic, duplicate completion ignored, interrupted startup fails without replay. Shutdown settles admissions before worker snapshot. |
| State reads and notifications | `tasks_api.py`, `events.py`; history/latest/SSE tests | Authoritative snapshots and no-store task reads; historical own versions; bounded metadata-only events after commit; session rechecks on delivery and idle heartbeat; target access rechecked before delivery; revoked target events filtered. |
| Packaging/process/evidence | Backend-local uv files, CLI, CI, guides, workflow/logs | Standalone backend source/dependencies; automatic demo seeding; one-worker launch; migration packaged; private artifacts excluded; accurate limits and separate frontend/deployment obligations. |

## Findings

### CR-backend-01-1 — Low — Duplicate AI request schemas — Fixed

- Category: maintainability/contract ownership.
- Initial location: `backend/src/quiz_backend/schemas.py:226` and the former request classes at the beginning of `backend/src/quiz_backend/tasks_api.py`.
- Requirement: maintain strict request validation and a shared canonical API contract without conflicting defaults.
- Evidence: initial inspection found unused `GenerationRequest`, `HintRequest`, and `SummaryRequest` alongside task-route-only duplicate classes. Hint defaults and strictness differed. Existing requests worked, but a future route/model change could update only one definition.
- Expected/actual before fix: one actively used definition per AI request shape / two sets with one unused and differing hint defaults.
- Inspection path: search all source/tests for the six request class names and inspect route parameter annotations.
- Impact: future schema drift and misleading unused contracts; no observed current authorization or leakage defect.
- Likely cause/confidence: parallel route/schema ownership left duplicate integration contracts; high confidence.
- Fix direction/responsibility: integration owner consolidated task-route imports onto `GenerationRequest`, `HintRequest`, and `SummaryRequest`; preserved strict reviewed-revision integers and conceptual-clue normalization/default.
- Current location: canonical definitions at `schemas.py:226`, `:236`, and `:246`; `tasks_api.py:14` imports them.
- Verification: inspected final imports/annotations and prompt normalization; final full suite passed 127 tests after consolidation; independent hint/input/key regressions, Ruff, and mypy passed.
- Documentation impact: no behavior/user-guide correction required.
- Status transition: **Fixed**, with the above inspection and tests; finding retained for a verifiable handoff.

### CR-backend-01-2 — Medium — Untrusted usage counts exceeded SQLite integer storage — Fixed

- Category: provider-metadata robustness and atomic completion.
- Location: `backend/src/quiz_backend/ai.py:221`; affected persistence is `TaskManager.terminal` in `backend/src/quiz_backend/tasks.py:670`.
- Requirement: retain usable usage metadata, leave unavailable/invalid usage null, and do not let provider metadata prevent validated result/terminal-state persistence.
- Evidence: the integration owner's final self-inspection identified that `_usage` previously accepted every nonnegative Python integer. SQLite integer binding supports signed 64-bit values; values such as `2**80` could raise `OverflowError` during both the result's success write and the first failure write carrying the same usage.
- Expected/actual before fix: valid content commits successfully with unsupported metadata normalized to null / oversized metadata could roll back valid content and disrupt normal terminal persistence.
- Reproduction/inspection path: trace provider `usage.input_tokens` through `_usage`, `AIResult`, `succeed`, and `terminal`; use a mocked completed response with valid quiz JSON and counts above `2**63 - 1`.
- Impact: legitimate content could be lost and reported as an execution failure because untrusted metadata was outside the persistence representation.
- Likely cause/confidence: Python integers are unbounded while SQLite integer bindings are not; high confidence.
- Fix direction/responsibility: integration owner bounded accepted plain integers to `0 <= count <= 2**63 - 1`; booleans, negative values, strings, and out-of-range integers remain null.
- Tests/verification: new `backend/tests/test_task_lifecycle.py:17` sends a valid quiz with enormous input/total usage and confirms successful task state plus null unsupported counts and retained valid output count. Final 127-test suite passed. Reviewer independently checked the maximum accepted boundary, one-over-maximum rejection, zero, boolean, string, and negative normalization; final Ruff/mypy passed.
- Documentation impact: no user behavior or guide correction; validation/logs now record the regression and final 127-test result.
- Status transition: **Fixed**, retaining the independently inspected bounds and final integration evidence above.

## Next actions

- Rerun write-code skill: **NO**.
- Edit documentation: **NO** for a product correction. The integration owner may replace the validation table's “finalizing review” progress marker with this completed report link.
- Rerun code-review skill: **NO** for this reviewed implementation; rerun after future relevant changes.
- Independent human review: **READY** for backend source assessment, with the following limitations.

## Agent handoff

No implementation/test corrective follow-up is required. Root can close its validation-review progress marker and deliver the reviewed backend. Final local checks and the fixed finding are synchronized above. No code, test, guide, dependency, Git, or external application was changed by this reviewer.

Future frontend and deployment owners must retain the spec's ownership, frozen roster, latest-target version, and no-automatic-provider-retry invariants. These future tasks are outside this delivery and are not unresolved defects in the backend review.

## Gaps, limitations, and manual checks for the user

- Before production, verify three permitted text models/context budgets and run the explicitly opted-in `quiz-backend live-check --allow-live-requests`; inspect factual quiz correctness, conceptual hints, and grounded summary interpretation. Automated mocks establish application boundaries, not actual model quality/availability.
- Run the supplied GitHub Actions workflow on the team repository. At deployment, check one HTTPS origin, Secure cookies, exact approved origins, intended reverse-proxy client IPs, persistent disk, restart behavior, and backup recovery.
- When the frontend exists, exercise safe text rendering and target-version reconciliation under refresh, disconnect/reconnect, missed/duplicate events, out-of-order reads, and the five-second unfinished-task polling rule. No browser/UI acceptance claim is made here.
- The public submission repository/master branch, GitHub Pages product website, and separately managed production deployment remain team work explicitly excluded from this backend implementation.

The backend implementation is ready for human review within the stated scope; this report does not certify a deployed full application.
