# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:0.12.23 AS uv

FROM python:3.14-slim AS builder
COPY --from=uv /uv /usr/local/bin/uv
WORKDIR /app

ENV UV_PYTHON_DOWNLOADS=never \
    UV_LINK_MODE=copy

# Cache locked dependencies separately from application changes.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

COPY src/ ./src/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-editable

FROM python:3.14-slim AS runtime
WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DATABASE_PATH=/app/private/quiz.sqlite3 \
    STORAGE_PATH=/app/private/notes

RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --no-create-home app \
    && mkdir -p /app/private/notes \
    && chown -R app:app /app/private \
    && chmod 700 /app/private /app/private/notes

COPY --from=builder /app/.venv /app/.venv

USER app
VOLUME ["/app/private"]
EXPOSE 7000

# The CLI starts exactly one Uvicorn worker.
CMD ["quiz-backend", "serve", "--host", "0.0.0.0", "--port", "7000"]
