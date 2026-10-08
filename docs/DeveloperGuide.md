# Classroom developer guide

The standalone frontend implements login/logout, the admin UI, and the teacher UI. From `frontend/`,
run `npm ci` and `npm run dev`. Vite serves http://localhost:5173 and proxies `/api`
to `BACKEND_SERVER_URL` from `frontend/.env`, using the backend Host while preserving
the browser Origin and verifying HTTPS certificates. Copy `.env.example`
to `.env` only on a fresh checkout and set the backend origin. `npm run build`
produces `frontend/dist`. Production must serve this build and API on one HTTPS origin.
See [frontend README](../frontend/README.md) for scope and commands.

The proxy's `changeOrigin: true` allows HTTPS virtual hosts such as Render to receive
their own hostname instead of `localhost:5173`; it does not rewrite the browser Origin.
The [Node CA documentation](https://nodejs.org/api/cli.html#--use-system-ca) informed
the README's optional system/custom CA troubleshooting instructions.

Frontend source separates typed API access, authentication, admin/teacher screens, and shared
components. Sessions remain in backend HttpOnly cookies. Summary state is scoped to
the authenticated admin and quiz; applied/notified versions, coalesced reads, admission
barriers, five-second running-task polling, and read-error backoff prevent stale results.
Generation is explicit, with UUID operation keys retained for uncertain request repeats.
Logout/unmount closes SSE and disposes reconciliation. The student UI is future work.
Implementation evidence and interaction summaries are in
`workflow/frontend-implementation.md` and `logs/frontend-implementation.md`.

Teacher screens live in `frontend/src/teacher`: assigned classes and quiz filters,
DOCX upload/draft setup, and question review/generation/publication. Multipart uploads
let the browser supply the boundary and carry only the file field. Browser checks
bound file size/type/name; the backend remains authoritative for archive and text
validation, ownership, and membership. Source notes and prompts are never written to
browser storage. Generated text is rendered as React text, with no raw HTML rendering.

`shared/TargetStore.ts` generalizes the existing admin summary reconciliation for both
features. `shared/useAIEvents.ts` opens SSE before target entry reads, recovers on
reconnect/focus/online, and disposes session state. `teacher/GenerationStore.ts` reads
the latest generation state and then current quiz content; historical success snapshots
are never used as the reviewed quiz. Current content survives generation POST responses,
and quiz revisions/published status cannot regress. Review confirmation binds to the
displayed quiz revision and target version, resets on generation, and is required to
publish. The backend independently verifies `expected_revision` and publication eligibility.

Run `npm run build`, `npm test`, `npm run lint`, and `npm run format:check` from
`frontend/`. Teacher tests mock backend responses and EventSource; no backend records
or live SoCLaaS calls are used. Component upload tests submit the React form directly
because jsdom reports a selected synthetic FileList as missing for native validation.
Actual native file dialogs, visual layout, and live integration remain manual checks.
Teacher acceptance mapping and check evidence are in `workflow/teacher-ui.md`;
the verified interaction summary is `logs/teacher-ui.md`. The teacher UI reuses the
repository's authentication, API client, component styles, and summary reconciliation;
no external application code or new dependencies were introduced.

Frontend acknowledgements: the existing React/Vite build setup was reused. Repository
specifications define behavior. The React performance skill and official
[Tailwind Vite guide](https://tailwindcss.com/docs/installation/using-vite),
[Vitest guide](https://vitest.dev/guide/), and
[MDN EventSource documentation](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
informed integration. Icons/illustrations are original local SVG/CSS; no MP2 code was reused.

The backend is a standalone Python 3.14 uv project in `backend/`; the frontend has no
shared dependencies. Run installation, server, packaging, and test commands from
`backend/`. `backend/src/quiz_backend` contains all application source. `uv.lock` locks
runtime and development packages. uv's [project workflow](https://docs.astral.sh/uv/guides/projects/)
creates and manages the backend-local `.venv`.

```bash
uv sync --locked
uv run --locked quiz-backend serve --host 127.0.0.1 --port 7000
```

`serve` always uses one Uvicorn worker. Lifespan initializes the versioned
schema, seeds demo accounts and classes if the database has no users, and fails
leftover running tasks before accepting requests. Demo login credentials are in
[the backend README](../backend/README.md). Restarts preserve existing data.
Use `uv run --locked quiz-backend --help` for commands. API/OpenAPI documents
are available at `/api/v1/docs` and `/api/v1/openapi.json`. With an explicit origin
list, an API client must send a configured Origin on every mutation; the docs UI requires its own exact origin to be approved. Wildcard mode
accepts arbitrary or absent Origins.

Configure `.env` locally without overwriting existing private configuration. Settings
also accept environment variables. `ENVIRONMENT` is `development` or `production`;
`DATABASE_PATH` and `STORAGE_PATH` default to backend-local `private/` paths.
`ALLOWED_ORIGINS` is either a JSON array of exact origins or `["*"]` for unrestricted
origins. The example uses `["*"]`; without configuration the code defaults to
`["http://localhost:5173"]`. Wildcard mode disables Origin-based CSRF protection and
reflects each request Origin for credentialed CORS, including the initial login, with
`Vary: Origin`. Missing Origins are accepted in this mode; duplicate headers are rejected.
Wildcard mode is available in development and production. Production explicit lists
require HTTPS origins. Production sends Secure cookies; `SameSite=Lax` and browser
third-party cookie restrictions still apply, so CORS alone cannot enable cross-site
sessions. Use a separate production database, private notes directory, environment file, and gateway credential. Private
configuration, virtual environments, caches, builds, SQLite files, and private storage
are ignored. Custom private storage outside `backend/private` must also be excluded by
the operator. Do not put private files in static directories or HTTP response logs.

AI requires `SOCLAAS_BASE_URL` as an HTTPS origin, `SOCLAAS_API_KEY`, three distinct
fixed model IDs (`SOCLAAS_HINT_MODEL`, `SOCLAAS_QUIZ_MODEL`, `SOCLAAS_SUMMARY_MODEL`), and
positive verified context limits (`SOCLAAS_HINT_CONTEXT_TOKENS`,
`SOCLAAS_QUIZ_CONTEXT_TOKENS`, `SOCLAAS_SUMMARY_CONTEXT_TOKENS`). No runtime catalog lookup
occurs. Verify permitted text models independently during deployment. The supplied
catalog is a dated snapshot. Invalid AI configuration does not prevent login or ordinary
quiz work; fresh AI requests return `AI_CONFIGURATION_ERROR` before consuming admission.

Settings reserve 256 hint, 8192 quiz, and 1024 summary output tokens and 512 safety tokens.
The fallback estimator uses UTF-8 bytes for the complete instructions and JSON context.
It is deliberately conservative. A deployment can inject a model-compatible callable
`SoCLaaS(settings, client, token_estimator=...)`, taking `(model_id, complete_text)` and
returning a nonnegative integer. Never silently truncate notes. Response bodies are
bounded to 256 KiB. Overall execution and the shared HTTP client read timeout are fixed
at 300 seconds; the rolling rate window is 60 seconds and the admission limit is fixed
at 30. Settings allow input/output limits, successful hint allowance, login protection,
and shutdown/heartbeat timing to be adjusted. They do not
add task queues, concurrency caps, retry loops, or a frontend settings feature.

Source responsibilities are deliberately separate:

| Module | Responsibility |
| --- | --- |
| `main.py`, `config.py`, `cli.py` | Application lifespan, HTTP security/error handling, configuration, automatic demo seeding and one-worker launch |
| `db.py`, `migrations/001_initial.sql` | Dedicated snapshot/transaction connections and versioned initial schema |
| `auth.py`, `schemas.py`, `api.py` | Session/role dependencies, strict role-specific contracts, ordinary API routes |
| `core.py` | Accounts, classes, ownership, publication, attempts, deterministic grades, anonymous aggregates |
| `notes.py` | Bounded safe DOCX extraction and opaque private storage |
| `ai.py` | Exactly three fixed-model operations, isolated instructions, bounded stateless gateway calls, strict output validation |
| `tasks.py` | Atomic admission/idempotency, strongly referenced coroutines, deadlines, atomic completion, restart/shutdown interruption |
| `events.py`, `tasks_api.py` | Bounded metadata-only notifications and authoritative state/history/SSE routes |

SQLite enables foreign keys and a five-second busy timeout on every connection and
initializes WAL mode. Reads have explicit snapshot transactions; writes use
`BEGIN IMMEDIATE`. No transaction spans gateway I/O. The migration mirrors the reference
DDL and adds persisted failed-login accounting. Future schema changes must add migrations
and update the reference specification and acceptance tests together.

Passwords are Argon2id hashes; opaque 256-bit session tokens are stored only as SHA256
hashes and expire after eight hours. The login limit initially permits five failed
attempts per normalized username/source-IP pair in five minutes. Exact Origin checks
cover all state-changing HTTP methods, including login, when an explicit origin list
is configured. The operator-requested wildcard mode bypasses this
CSRF protection and allows credentialed CORS from any origin. Role-specific response
models and queries withhold student keys and explanations until submitted results. The backend enforces ownership
and current teacher membership independently of any frontend controls.

Publication validates the reviewed revision and freezes valid questions and nonempty
roster in one transaction. Publication, generation admission/completion, answer saving,
and submission serialize state checks. Submitted attempts have no mutation path.
Draft deletion uses the same write transaction discipline: it rejects published or
running-generation quizzes, cascades questions, and removes the note record only
after its last quiz reference disappears. Private files are removed after commit;
startup retries orphan cleanup for backend-generated filenames. Terminal AI targets
detach from deleted quizzes, preserving requests, operation keys, and rolling rate
accounting while historical reads return 404. Quiz/note IDs are not reused. These
schema changes require a fresh database; no upgrade migration is supplied.
Anonymous summaries calculate all metrics in the backend and never send identities or
individual answers to the model.

DOCX handling validates ZIP structure, content types, document relationship, CRCs, archive
expansion, safe XML, and extracted text. Parsing and storage run outside the event loop.
External relationships are inert; content is never fetched. AI sees fixed instructions
separately from untrusted JSON values. Hint requests omit options, keys, and explanations;
private option strings are used only to reject answer-revealing output. Strict JSON rejects
duplicate fields, nonfinite numbers, unexpected fields, invalid lengths, duplicate quiz
options/questions, and incomplete output. Only a single surrounding Markdown fence can
be removed. Output cannot perform application actions or publish quizzes. Semantic
correctness, hint subtlety, and interpretive accuracy still need human judgment.

`AI_INVALID_OUTPUT` includes fixed `details.stage` and `details.reason` categories
that persist with the terminal error in `ai_requests.response_json`. They distinguish
response/envelope problems, missing text, malformed generated JSON, and schema failures
such as wrong counts or duplicate options. No raw response, rejected field names,
exception messages, notes, or credentials enter diagnostics. Investigate the authorized
generation-state read and persisted provider status/usage before explicitly retrying;
older failures without these categories cannot identify the exact rejection rule.
Quiz instructions include a placeholder JSON example; validation remains strict.

Admission resolves authorized key replays and target reuse before fresh eligibility,
context, and rate checks. Every accepted reuse binds its key. Fresh admission count and
task/latest-version/key writes commit together. Accepted coroutines are registered
immediately and do not depend on request or SSE connections. The HTTPX client is shared,
has finite phase timeouts, and performs one nonstreaming `/v1/responses` call per fresh
executed task. There are no tools, conversation memory, provider fallback, automatic
retries, application queues, dispatchers, semaphores, or unfinished-task caps.

Completion rechecks access, state, deadline, revision, and latest pointer in the same write
transaction that applies the result and terminal state/version. Failures preserve existing
content but latest-state reads expose only the latest success/failure. SSE is published
after commit and buffers at most 64 metadata events per subscriber; dropped notifications
are repaired by authoritative reads. Streams recheck session/access before delivery and
session validity during idle periods. Frontend version guards and five-second unfinished
reconciliation are implemented for admin summaries and teacher generation.

Run local checks from `backend/`:

```bash
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src/quiz_backend
uv run --locked pytest -q
uv build
uv run --locked python ../workflow/backend_persistence_smoke.py
```

`.github/workflows/backend.yml` runs backend checks using the locked environment; it
does not deploy. Actual check results and limitations are recorded in
`workflow/backend-validation.md`. Tests use temporary databases, a controlled clock,
and HTTPX mocked responses. They do not read `.env` secrets or call live SoCLaaS.
`uv run --locked quiz-backend live-check --allow-live-requests` is an optional operator
command that makes three small metered calls. It was not run for this delivery.

The team's future deployment must serve frontend and `/api/v1` on one HTTPS origin with
persistent backend disk, one instance, and one worker. Configure trusted reverse proxy
handling deliberately so source-IP login protection uses the intended client address;
do not trust arbitrary forwarded headers. Back up database and private notes consistently.
Multi-instance storage and shared limits require redesign. Student browser UI, GitHub Pages
product website, production infrastructure, live deployment/model verification, and
public submission repository/master-branch maintenance remain outside this backend work.

Workflow files describe the custom process (`workflow/backend-implementation.md`),
observed checks (`workflow/backend-validation.md`), and specialist review/handoffs.
The unrestricted-origin requirement and verification are recorded in
`workflow/origin-policy.md`, with its interaction summary in `logs/origin-policy.md`.
The canonical completed specialist review is `reviews/backend-01.md`; both findings
were fixed and verified, with no unresolved findings for the backend scope.
`logs/backend-implementation.md` summarizes verified prompts/interactions; it contains
no private credentials or user input. `docs/Reflections.md` records concrete security,
spec-driven development, and specialist-agent lessons. No commits or deployments are
performed by this implementation task.

Acknowledgements: product requirements and reference DDL originate in this repository's
`assignment-brief.md`, `specs/backend-spec.md`, and `specs/schema.sql`; the gateway contract
comes from `backend/soclaas-docs.md`. Implementation uses maintained FastAPI, Pydantic,
aiosqlite, HTTPX, Argon2-cffi, defusedxml, multipart, and Uvicorn libraries rather than
vendored code. Their official documentation informed usage, including
[FastAPI lifespan](https://fastapi.tiangolo.com/advanced/events/),
[FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/) and the installed Starlette
CORS middleware implementation for credentialed origin reflection,
[HTTPX async clients](https://www.python-httpx.org/async/), and
[Python asyncio task lifetime/cancellation](https://docs.python.org/3.14/library/asyncio-task.html).
Codex specialist agents contributed implementation, acceptance tests, integration, and
review as recorded in workflow/logs. No MP2 application source was reused.
