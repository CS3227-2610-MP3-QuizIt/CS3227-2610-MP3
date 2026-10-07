# Classroom frontend

React 19, TypeScript, Tailwind CSS, and Vite. This delivery includes login/logout,
admin overview, student/teacher account creation, class creation and membership
management, and published quiz completion and AI summaries. Student and teacher
screens currently show a signed-in placeholder.

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

`src/api` contains typed, cookie-authenticated API access. `src/auth` manages the
backend identity and login. `src/admin` contains the role screens and per-quiz
summary reconciliation. `src/shared` contains UI components and guarded resource
reads. AI results always come from backend state reads; SSE only invalidates state.

Existing summary logic tests can be run with `npm test`. Playwright and browser
end-to-end tests were removed at the user's request. No live AI requests are made
by build or local checks.
