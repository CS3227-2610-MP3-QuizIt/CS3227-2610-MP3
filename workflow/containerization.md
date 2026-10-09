# Containerization validation

Scope: package the existing frontend and orchestrate both standalone applications.
The backend Dockerfile is reused without changes. No product behavior or schema
requirements changed.

The frontend uses a Node 24 build stage with `npm ci` and a non-root Nginx runtime.
Its allowlist build context excludes local environments, dependencies, and private
files. Nginx serves static assets and proxies API paths without stripping `/api`,
preserves Origin, disables SSE buffering, and permits multipart upload overhead.
Docker DNS is re-resolved when backend containers change.

Compose publishes only the loopback frontend port, waits for backend health, sets
wildcard origins by default, and persists SQLite/uploads in a named volume. Backend paths
and environment/origin defaults are deliberately overridden; gateway settings come
only from an optional backend environment file. Production requires separate
credentials/storage and operator-managed HTTPS.

Checks performed on 2026-10-09:

- `npm run build` from `frontend/`: passed.
- `docker compose config --quiet`: passed.
- `docker compose build`: both images built successfully.
- Isolated project `mp3-container-check`, port 18080, nonexistent optional backend
  environment file, exact `http://localhost:18080` origin: `up --build -d --wait`
  completed with both services healthy.
- Frontend `/`: HTTP 200.
- Proxied `/api/v1/openapi.json`: HTTP 200.
- Login mutation with an unapproved Origin: HTTP 403.
- `git diff --check`: passed before final evidence files were added; repeated afterward.

Docker and localhost access required execution outside the sandbox. No gateway
credentials were loaded for the isolated test, and no live AI requests were made.
The smoke test did not exercise authenticated SSE, full user workflows, persistence
across recreation, or production HTTPS. Application source was unchanged, so the
application test suites were not rerun. The isolated stack was stopped after checks;
its named volume was retained.

Follow-up: the user requested all origins after confirming that localhost worked
but 127.0.0.1 was rejected. Compose now defaults to `ALLOWED_ORIGINS=["*"]`;
`APP_ALLOWED_ORIGINS` can still override it. The exact-origin smoke results above
describe the original configuration. Wildcard behavior already exists in the
backend; no application source or schema changes were needed.
