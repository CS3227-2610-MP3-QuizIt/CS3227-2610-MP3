# Classroom frontend

React 19, TypeScript, Tailwind CSS, and Vite. This delivery includes login/logout,
admin overview, student/teacher account creation, class creation and membership
management, published quiz completion and AI summaries, and the teacher workspace.
Teachers can browse assigned classes and own quizzes, upload DOCX notes, create drafts,
generate or reprompt questions, review answer keys and explanations, and publish the
reviewed revision. Students can browse their assigned published quizzes, start or
resume an attempt, save choices immediately, request optional question hints, submit,
and review scores, correct answers, and explanations. Each answer shows its save state
and offers an explicit retry on failure. Submission waits for pending saves and stays
locked while an uncertain response is reconciled.

Run commands from `frontend/`:

```bash
npm ci
# For a fresh checkout only; preserve any existing .env.
cp -n .env.example .env
npm run dev
```

Open http://localhost:5173. Start the backend separately from `backend/` using its
README. Vite forwards `/api` to `BACKEND_SERVER_URL` from `frontend/.env`, using the
backend Host and preserving the browser Origin. Set it to the backend origin, for
example `http://localhost:7000` or `https://cs3227-2610-mp3.onrender.com`.
For exact Origin configuration, allow `http://localhost:5173` in the backend.
The demo admin credentials are documented in [backend/README.md](../backend/README.md).
`BACKEND_SERVER_URL` is server-only Vite configuration. No gateway credentials belong
in the frontend. Production builds use relative `/api/v1` requests and do not require
this development proxy setting.

Restart Vite after changing the backend URL. The proxy verifies HTTPS certificates.
If an HTTPS backend still reports `unable to verify the first certificate`, and your
network's trusted root CA is already installed in the operating system, run Vite
with Node's system CA support (on a Node version supporting `--use-system-ca`):

```bash
node --use-system-ca node_modules/vite/bin/vite.js
```

For a trusted CA supplied separately by your network administrator, start Node with
`NODE_EXTRA_CA_CERTS=/absolute/path/to/trusted-ca.pem npm run dev` instead. These Node
settings must be supplied at process startup, not in Vite's `.env`. Keep certificate
verification enabled. See the [Node CA documentation](https://nodejs.org/api/cli.html#--use-system-ca).

```bash
npm run build
npm run preview
```

The build writes `frontend/dist/`. Preview serves the compiled frontend; it does
not proxy API requests. Production must serve this build and `/api/v1` under one
HTTPS origin. Deployment remains the team's responsibility.

## Docker

Build from this folder with `docker build -t quiz-frontend .`. The image builds
with locked npm dependencies and serves `dist/` with non-root Nginx on port 8080.
It proxies `/api/` to `backend:7000` on the Docker network, preserves the browser
Origin, and disables buffering for SSE. Local `.env` files and gateway credentials
are excluded from the build context. `BACKEND_SERVER_URL` is only used by Vite
development, not this image.

Run both apps using the [Compose instructions](../docs/DeveloperGuide.md#docker-compose).

`src/api` contains typed, cookie-authenticated API access. `src/auth` manages the
backend identity and login. `src/admin`, `src/teacher`, and `src/student` contain their respective
role screens. `src/shared` contains UI components, guarded resource reads, the
session-owned SSE subscription, and the shared per-target AI reconciliation store.
AI results always come from backend state reads; SSE only invalidates state.
Teacher content is read separately from the current quiz endpoint; historical task
snapshots never become the reviewed draft. Student hints use composite attempt/question
keys with the same version guards, five-second unfinished-task polling, and read-error
backoff. Hints never gate answer saving or submission; only the latest successful hint
is displayed. Prompts and selections are held in memory, with persistence in the backend.
Student routes are `#/student/quizzes`, `#/student/attempt/:quizId`, and
`#/student/results/:quizId`. Result reads require a confirmed submitted attempt.

Run `npm test` for mocked API, component, session, and AI reconciliation tests,
`npm run lint` for static analysis, and `npm run format:check` for formatting.
No Playwright or browser end-to-end tests are used. No live AI requests are made
by build or local checks.
