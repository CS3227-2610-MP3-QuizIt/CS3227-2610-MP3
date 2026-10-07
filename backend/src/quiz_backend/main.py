from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime

import httpx
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .ai import SoCLaaS
from .api import router as core_router
from .config import Settings
from .core import Core
from .db import Database
from .errors import AppError
from .seed import seed_demo
from .tasks import TaskManager
from .tasks_api import router as task_router
from .time import utc_now


class BrowserSecurity:
    """Apply the configured origin policy and bound request bodies."""

    def __init__(self, app: ASGIApp, origins: list[str]) -> None:
        self.app, self.origins = app, origins

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        headers = scope.get("headers", [])
        if scope["method"] in {"POST", "PUT", "PATCH", "DELETE"}:
            origins = [value.decode("latin1") for key, value in headers if key == b"origin"]
            if len(origins) > 1 or (
                "*" not in self.origins and (not origins or origins[0] not in self.origins)
            ):
                response = JSONResponse(
                    AppError(403, "INVALID_ORIGIN", "An approved Origin is required.").envelope(),
                    status_code=403,
                )
                await response(scope, receive, send)
                return
            upload = scope["path"].endswith("/notes")
            limit = 5 * 1024 * 1024 + 64 * 1024 if upload else 32 * 1024
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                body.extend(message.get("body", b""))
                if len(body) > limit:
                    code = "UPLOAD_TOO_LARGE" if upload else "VALIDATION_ERROR"
                    response = JSONResponse(
                        AppError(413, code, "Request body is too large.").envelope(),
                        status_code=413,
                    )
                    await response(scope, receive, send)
                    return
                if not message.get("more_body", False):
                    break
            consumed = False

            async def bounded_receive() -> Message:
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}
                return await receive()

            await self.app(scope, bounded_receive, send)
        else:
            await self.app(scope, receive, send)


def create_app(
    settings: Settings | None = None,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    clock: Callable[[], datetime] = utc_now,
) -> FastAPI:
    config = settings if settings is not None else Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        db = Database(config.database_path)
        await seed_demo(config)
        config.storage_path.mkdir(parents=True, exist_ok=True, mode=0o700)
        async with httpx.AsyncClient(
            transport=transport,
            timeout=httpx.Timeout(45, connect=5, write=10, pool=5),
            follow_redirects=False,
            trust_env=False,
            limits=httpx.Limits(max_connections=None, max_keepalive_connections=30),
        ) as client:
            core = Core(db, config, clock)
            ai = SoCLaaS(config, client)
            tasks = TaskManager(db, core, ai, clock)
            app.state.settings, app.state.db, app.state.core = config, db, core
            app.state.ai, app.state.tasks = ai, tasks
            await tasks.interrupt_on_startup()
            try:
                yield
            finally:
                await tasks.shutdown()
                await core.drain_uploads()

    app = FastAPI(
        title="Class Quiz Backend",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/v1/docs",
        openapi_url="/api/v1/openapi.json",
        redoc_url=None,
    )
    app.add_middleware(BrowserSecurity, origins=config.allowed_origins)
    unrestricted_origins = config.allowed_origins == ["*"]
    app.add_middleware(
        CORSMiddleware,
        # Echo origins even on cookie-free login responses when credentials are enabled.
        allow_origins=[] if unrestricted_origins else config.allowed_origins,
        allow_origin_regex=".*" if unrestricted_origins else None,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "Idempotency-Key"],
        expose_headers=["Retry-After"],
    )

    @app.exception_handler(AppError)
    async def application_error(request: Request, error: AppError) -> JSONResponse:
        headers = {"Cache-Control": "no-store"}
        if error.retry_after is not None:
            headers["Retry-After"] = str(error.retry_after)
        return JSONResponse(error.envelope(), status_code=error.status, headers=headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        # Pydantic's raw input can contain credentials; return field paths/types only.
        details = {
            "fields": [{"path": list(item["loc"]), "type": item["type"]} for item in error.errors()]
        }
        return JSONResponse(
            AppError(422, "VALIDATION_ERROR", "Request validation failed.", details).envelope(),
            status_code=422,
            headers={"Cache-Control": "no-store"},
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException) -> JSONResponse:
        return JSONResponse(
            AppError(
                error.status_code,
                "NOT_FOUND" if error.status_code == 404 else "VALIDATION_ERROR",
                "Request could not be processed.",
            ).envelope(),
            status_code=error.status_code,
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, error: Exception) -> JSONResponse:
        return JSONResponse(
            AppError(500, "INTERNAL_ERROR", "Request could not be completed.").envelope(),
            status_code=500,
        )

    app.include_router(core_router)
    app.include_router(task_router)
    return app
