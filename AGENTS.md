# Repository guidance

## Project and current state

This is CS3227 MP3: a secured class quiz application with student, teacher, and admin roles, each with a SoCLaaS-powered AI feature. The repository currently contains requirements and reference documents only. There is no application entry point, dependency manifest, test suite, or established build/run command. `frontend/` is empty; `backend/` contains gateway documentation and environment configuration.

Read these sources before changing the relevant behavior:

- `assignment-brief.md`: assignment restrictions, engineering process, deployment, and submission deliverables.
- `specs/backend-spec.md`: specifications for the backend server.
- `specs/frontend-spec.md:` specifications for the frontend.
- `specs/schema.sql`: reference SQLite DDL. It is not a migration runner and contains known stale AI queue definitions.
- `backend/soclaas-docs.md`: supplied gateway API contract. Its model catalog is a dated snapshot, not a guarantee of current availability.
- `backend/.env.example`: example backend configuration; never print or copy secrets from `.env`.

## Spec-driven changes

Implement from the specification and its acceptance criteria. When requirements change, update the specification, affected schema, implementation, and acceptance tests together. Surface material contradictions instead of silently inventing behavior.

Before implementing AI persistence, align `specs/schema.sql` with the current specification: tasks use only `running`, `succeeded`, and `failed`; remove queue dispatch and output-staging requirements and the obsolete ten-unfinished-task rule; retain per-target unfinished uniqueness and add an admission-time index. The specification explicitly documents this mismatch.

The assignment requires a custom spec-driven process and basic multi-agent software engineering evidence. Keep workflow artifacts under `workflow/` where practical and verified summaries of development prompts/interactions under `logs/`. Do not use an SDD toolkit. Record reused material in the developer guide's acknowledgements.

## Planned structure and stack

Use the assignment's `src/` convention for application source when scaffolding:

- `frontend/`: TypeScript, React 19, Tailwind CSS, and Vite. Keep role screens separate; share typed API access, authentication, and UI components.
- `backend/`: Python, FastAPI, and SQLite. Separate routes and schemas from domain services, AI integration, task management, and persistence.
- `workflow/`: development workflow instructions, scripts, and evidence.
- `docs/UserGuide.md`, `docs/DeveloperGuide.md`, `docs/Reflections.md`: required documentation matching the delivered product.
- `logs/`: verified development interaction summaries.

Treat `backend/` and `frontend/` as standalone folders. Instructions to install and run the backend are to be executed when in `backend/`, likewise for `frontend/`. Anyone installation needed for `backend/` should be placed inside `backend/`, likewise for `frontend/`. Do not introduce any shared dependency between `backend/` and `frontend/`.


## Product invariants

- Accounts have exactly one role. Admins create students and teachers; demo accounts and classes are seeded automatically on a fresh database at startup.
- Only an owning teacher who is still assigned to the class can manage or publish a draft. Publication requires explicit human review of the submitted revision.
- Quizzes have 1–10 questions, each with exactly four distinct options, one correct option, and an explanation.
- Publication atomically freezes quiz content and a nonempty student roster. Later membership changes do not change existing attempts or summary completion counts.
- Each roster student has one resumable attempt. Submission requires every answer, grades deterministically without AI, and makes the attempt immutable.
- Students receive answer keys and explanations only after their own submission. Summaries require full submission by the frozen roster.

## AI and concurrency

- Route every application AI request through backend-only SoCLaaS. Expose exactly `generate_hint`, `generate_quiz`, and `generate_quiz_result_summary`, each using a fixed configured text model and its own context limit. Any two or all three features may use the same model ID.
- Use nonstreaming, stateless `POST /v1/responses`. Do not add tools, gateway background mode, conversation memory, alternate providers, automatic model fallback, or automatic provider retries.
- Run one FastAPI process with one Uvicorn worker. Use a shared async HTTP client and lifespan-managed async tasks with strong references. Move blocking file parsing outside the event loop.
- Atomically admit at most 30 fresh AI requests in a rolling 60-second window across all users/features using SQLite timestamps. Reject excess immediately with `429 AI_APP_RATE_LIMIT` and retry timing. Replays, reads, and reused work consume no new allowance.
- Do not introduce an application task queue, dispatcher, completion worker, concurrency semaphore/cap, per-user AI rate gate, or global unfinished-task cap.
- Enforce a 300-second overall execution timeout. On restart, fail leftover running tasks without resuming or replaying them. Browser disconnects do not cancel accepted work.
- Recheck permissions, workflow state, deadline, revision, and latest target before committing. Apply validated results, terminal task state, and versions atomically; never hold a database transaction during gateway I/O.
- Preserve idempotency-key bindings and latest-target semantics. A latest failure must not display an older successful result as current.
- SSE announces committed target/task/version changes only, with no status, result, or error content. Fetch authoritative state afterward and reconcile unfinished tasks every five seconds with backoff and version guards.

## Security and data handling

- Keep gateway keys, passwords, session tokens, private uploads, and database contents out of source control, browser bundles, responses, and development logs. `.env` and `.venv/` are ignored; extend ignore rules as generated/private artifacts are introduced.
- Enforce roles and resource ownership in the backend. Use Argon2id password hashes, hashed opaque session tokens, secure production cookies, exact Origin checks on mutating browser requests, and exact development CORS origins.
- Treat DOCX text and user prompts as untrusted data. Bound and validate uploads, archive expansion, extracted text, prompt context, and generated output. Never fetch external DOCX content.
- Keep model instructions separate from source text. Parse and validate strict feature JSON; render generated text safely. Invalid output must not partially replace application data.
- Hint inputs omit options, answer keys, and explanations. Summary inputs contain anonymous aggregates, not student identities or individual answer records. Backend calculations remain authoritative.
- Enable SQLite foreign keys on every connection, WAL mode, a five-second busy timeout, and short write transactions.

## Validation and delivery

Use `specs/specification.md` acceptance criteria to guide meaningful tests, especially authorization, answer leakage, prompt injection, upload rejection, publication/submit races, rolling admission boundaries, idempotency, timeout/restart handling, atomic completion, and frontend version reconciliation.

Mock SoCLaaS for automated success, failure, and injection tests. Live integration checks should be small and explicitly configured. Report which checks actually ran and any limitations. Initialization-only documentation changes do not need application tests.

Keep development and production credentials, database files, and private storage separate. Serve production frontend and `/api/v1` under one HTTPS origin with persistent backend disk. Deployment must be managed separately by the team, with suitable automation such as GitHub Actions; do not use a build-and-host environment supplied by Codex or Claude. The assignment also requires a GitHub Pages product website and an up-to-date public submission repository/master branch.
