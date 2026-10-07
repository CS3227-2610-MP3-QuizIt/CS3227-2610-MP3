# Class quiz backend

Run every command in this folder. Requires Python 3.14 and uv.

```bash
uv sync --locked
uv run --locked quiz-backend init-db
uv run --locked quiz-backend bootstrap-admin --username admin --display-name Administrator
uv run --locked quiz-backend serve
```

Bootstrap prompts for the password twice without echoing it. It refuses to create a
second administrator. The server uses one worker on `127.0.0.1:7000`. Interactive API
documentation is at `/api/v1/docs`. Set `ALLOWED_ORIGINS=["*"]` to allow any origin
(the example configuration uses this mode). CORS echoes the origin to support cookies.
This disables Origin-based CSRF protection. An explicit origin list instead requires
an approved `Origin` on every mutation, including curl and the API documentation page.

Create `.env` from `.env.example` only if no private configuration exists. Configure
three distinct permitted text models and their verified context limits for AI features.
Missing AI configuration returns a safe error for fresh AI requests; other workflows
remain available. Do not overwrite an existing `.env`.

```bash
uv run --locked ruff format --check .
uv run --locked ruff check .
uv run --locked mypy src/quiz_backend
uv run --locked pytest -q
uv build
```

Tests use temporary storage and a mocked HTTPX gateway. They never call SoCLaaS.
An operator can explicitly run three small metered integration calls:

```bash
uv run --locked quiz-backend live-check --allow-live-requests
```

See [Developer guide](../docs/DeveloperGuide.md), [User guide](../docs/UserGuide.md),
and [validation evidence](../workflow/backend-validation.md). Frontend, product website,
production infrastructure, HTTPS origin, and deployment automation are separate work.
