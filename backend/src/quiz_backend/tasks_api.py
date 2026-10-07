import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict

from .auth import current_user
from .db import one
from .errors import AppError, missing
from .schemas import GenerationRequest, HintRequest, SummaryRequest

router = APIRouter(prefix="/api/v1")
User = Annotated[dict[str, Any], Depends(current_user)]
Key = Annotated[UUID, Header(alias="Idempotency-Key")]


class TaskEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_id: int | None
    feature: Literal["hint", "quiz_generation", "summary"]
    quiz_id: int
    attempt_id: int | None
    question_id: int | None
    task_id: str | None
    version: int
    status: Literal["not_requested", "in_progress", "success", "failed"]
    result: dict[str, Any] | None
    error: dict[str, Any] | None


def task_response(
    response: Response, envelope: dict[str, Any], post: bool = False
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    if post:
        response.status_code = 202 if envelope["status"] == "in_progress" else 200
    return envelope


@router.post("/quizzes/{quiz_id}/generate", response_model=TaskEnvelope)
async def generate(
    quiz_id: int,
    body: GenerationRequest,
    key: Key,
    user: User,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    envelope = await request.app.state.tasks.admit(
        user=user,
        feature="quiz_generation",
        quiz_id=quiz_id,
        key=str(key),
        route=request.url.path,
        body=body.model_dump(),
    )
    return task_response(response, envelope, True)


@router.get("/quizzes/{quiz_id}/generation", response_model=TaskEnvelope)
async def generation(
    quiz_id: int, user: User, request: Request, response: Response
) -> dict[str, Any]:
    envelope = await request.app.state.tasks.latest(
        user=user, feature="quiz_generation", quiz_id=quiz_id
    )
    return task_response(response, envelope)


async def hint_scope(request: Request, user: dict[str, Any], attempt_id: int) -> int:
    async with request.app.state.db.read() as conn:
        attempt = await request.app.state.core.check_attempt(conn, user, attempt_id)
        return int(attempt["quiz_id"])


@router.post("/attempts/{attempt_id}/questions/{question_id}/hints", response_model=TaskEnvelope)
async def hint(
    attempt_id: int,
    question_id: int,
    body: HintRequest,
    key: Key,
    user: User,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    quiz_id = await hint_scope(request, user, attempt_id)
    envelope = await request.app.state.tasks.admit(
        user=user,
        feature="hint",
        quiz_id=quiz_id,
        attempt_id=attempt_id,
        question_id=question_id,
        key=str(key),
        route=request.url.path,
        body=body.model_dump(),
    )
    return task_response(response, envelope, True)


@router.get("/attempts/{attempt_id}/questions/{question_id}/hints", response_model=TaskEnvelope)
async def hint_state(
    attempt_id: int, question_id: int, user: User, request: Request, response: Response
) -> dict[str, Any]:
    quiz_id = await hint_scope(request, user, attempt_id)
    envelope = await request.app.state.tasks.latest(
        user=user, feature="hint", quiz_id=quiz_id, attempt_id=attempt_id, question_id=question_id
    )
    return task_response(response, envelope)


@router.post("/quizzes/{quiz_id}/summary", response_model=TaskEnvelope)
async def summarize(
    quiz_id: int, body: SummaryRequest, key: Key, user: User, request: Request, response: Response
) -> dict[str, Any]:
    envelope = await request.app.state.tasks.admit(
        user=user,
        feature="summary",
        quiz_id=quiz_id,
        key=str(key),
        route=request.url.path,
        body=body.model_dump(),
    )
    return task_response(response, envelope, True)


@router.get("/quizzes/{quiz_id}/summary", response_model=TaskEnvelope)
async def summary(quiz_id: int, user: User, request: Request, response: Response) -> dict[str, Any]:
    envelope = await request.app.state.tasks.latest(user=user, feature="summary", quiz_id=quiz_id)
    return task_response(response, envelope)


@router.get("/ai/tasks/{task_id}", response_model=TaskEnvelope)
async def history(
    task_id: UUID, user: User, request: Request, response: Response
) -> dict[str, Any]:
    envelope = await request.app.state.tasks.historical(user, str(task_id))
    return task_response(response, envelope)


async def event_stream(request: Request) -> AsyncIterator[str]:
    manager = request.app.state.tasks
    token = request.cookies.get(request.app.state.settings.session_cookie)
    async with manager.events.subscribe() as queue:
        yield ": connected\n\n"
        while manager.accepting:
            try:
                # Recheck session on every notification AND during idle periods.
                user = await request.app.state.core.authenticate(token)
                if await request.is_disconnected():
                    return
                try:
                    event = await asyncio.wait_for(
                        queue.get(), request.app.state.settings.sse_heartbeat_seconds
                    )
                except TimeoutError:
                    await request.app.state.core.authenticate(token)
                    yield ": heartbeat\n\n"
                    continue
                user = await request.app.state.core.authenticate(token)
                async with request.app.state.db.read() as conn:
                    target = await one(
                        conn, "SELECT * FROM ai_targets WHERE id=?", (event["target_id"],)
                    )
                    if not target:
                        raise missing()
                    await manager.access(
                        conn,
                        user,
                        target["feature"],
                        target["quiz_id"],
                        target["attempt_id"],
                        target["question_id"],
                    )
                yield (
                    "event: ai_state_changed\ndata: "
                    + json.dumps(event, separators=(",", ":"))
                    + "\n\n"
                )
            except AppError as error:
                if error.status == 401:
                    return
                # Events for other users' targets are filtered, including revoked access.
                continue


@router.get("/ai/events")
async def events(user: User, request: Request) -> StreamingResponse:
    return StreamingResponse(
        event_stream(request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
