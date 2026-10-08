from typing import Annotated, Any, Literal

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException

from .auth import User, current_user, role
from .errors import AppError
from .schemas import (
    AdminQuiz,
    AnswerRequest,
    AttemptResponse,
    ClassCreate,
    ClassesResponse,
    ClassResponse,
    CompletionResponse,
    Empty,
    Login,
    LoginResponse,
    Member,
    MembersResponse,
    NoteResponse,
    Publication,
    PublicUser,
    QuizCreate,
    QuizzesResponse,
    ResultsResponse,
    RevisionRequest,
    SavedAnswer,
    ScoreResponse,
    StudentQuiz,
    TeacherQuiz,
    UserCreate,
    UsersResponse,
)

router = APIRouter(prefix="/api/v1")
CurrentUser = Annotated[User, Depends(current_user)]
EmptyBody = Annotated[Empty | None, Body()]


@router.post("/auth/login", response_model=LoginResponse)
async def login(request: Request, response: Response, body: Login) -> dict[str, Any]:
    core = request.app.state.core
    source_ip = request.client.host if request.client else "unknown"
    user, token = await core.login(body.username, body.password, source_ip)
    response.set_cookie(
        core.settings.session_cookie,
        token,
        max_age=8 * 3600,
        httponly=True,
        secure=core.settings.environment == "production",
        samesite="lax",
        path="/api/v1",
    )
    response.headers["Cache-Control"] = "no-store"
    return {"user": user}


@router.get("/auth/me", response_model=PublicUser)
async def me(response: Response, user: CurrentUser) -> User:
    response.headers["Cache-Control"] = "no-store"
    return user


@router.post("/auth/logout", status_code=204)
async def logout(request: Request, user: CurrentUser, body: EmptyBody = None) -> Response:
    core = request.app.state.core
    await core.logout(request.cookies[core.settings.session_cookie])
    response = Response(status_code=204)
    response.delete_cookie(
        core.settings.session_cookie,
        path="/api/v1",
        httponly=True,
        secure=core.settings.environment == "production",
        samesite="lax",
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@router.post("/users", response_model=PublicUser, status_code=201)
async def create_user(request: Request, user: CurrentUser, body: UserCreate) -> User:
    return await request.app.state.core.create_user(
        user, body.username, body.display_name, body.password, body.role
    )


@router.get("/users", response_model=UsersResponse)
async def users(
    request: Request,
    user: CurrentUser,
    account_role: Annotated[Literal["student", "teacher"] | None, Query(alias="role")] = None,
) -> dict[str, Any]:
    return {"items": await request.app.state.core.list_users(user, account_role)}


@router.post("/classes", response_model=ClassResponse, status_code=201)
async def create_class(request: Request, user: CurrentUser, body: ClassCreate) -> dict[str, Any]:
    return await request.app.state.core.create_class(user, body.name)


@router.get("/classes", response_model=ClassesResponse)
async def classes(request: Request, user: CurrentUser) -> dict[str, Any]:
    return {"items": await request.app.state.core.list_classes(user)}


@router.get("/classes/{class_id}/members", response_model=MembersResponse)
async def members(request: Request, user: CurrentUser, class_id: int) -> dict[str, Any]:
    return {"items": await request.app.state.core.members(user, class_id)}


@router.put("/classes/{class_id}/members/{user_id}", response_model=Member)
async def assign(
    request: Request, user: CurrentUser, class_id: int, user_id: int, body: EmptyBody = None
) -> dict[str, Any]:
    return await request.app.state.core.assign(user, class_id, user_id)


@router.delete("/classes/{class_id}/members/{user_id}", status_code=204)
async def unassign(
    request: Request, user: CurrentUser, class_id: int, user_id: int, body: EmptyBody = None
) -> Response:
    await request.app.state.core.unassign(user, class_id, user_id)
    return Response(status_code=204)


@router.post(
    "/classes/{class_id}/notes",
    response_model=NoteResponse,
    status_code=201,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file"],
                        "additionalProperties": False,
                        "properties": {"file": {"type": "string", "format": "binary"}},
                    }
                }
            },
        }
    },
)
async def upload_note(request: Request, user: CurrentUser, class_id: int) -> dict[str, Any]:
    role(user, "teacher")
    core = request.app.state.core
    async with core.db.read() as conn:
        await core.check_class(conn, user, class_id)
    # Bound the complete multipart body before the parser can spool file parts.
    body_limit = 5 * 1024 * 1024 + 64 * 1024
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        total += len(chunk)
        if total > body_limit:
            raise AppError(413, "UPLOAD_TOO_LARGE", "DOCX uploads must be at most 5 MiB.")
        chunks.append(chunk)
    bounded_body = b"".join(chunks)

    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": bounded_body, "more_body": False}

    upload_request = Request(request.scope, receive=receive)
    try:
        async with upload_request.form(max_files=1, max_fields=0) as form:
            entries = form.multi_items()
            if (
                len(entries) != 1
                or entries[0][0] != "file"
                or not isinstance(entries[0][1], UploadFile)
            ):
                raise AppError(
                    422, "VALIDATION_ERROR", "Upload exactly one DOCX in the file field."
                )
            upload = entries[0][1]
            filename = upload.filename or ""
            if len(filename) > 255:
                raise AppError(422, "INVALID_DOCX", "The upload filename is too long.")
            data = await upload.read(5 * 1024 * 1024 + 1)
            if len(data) > 5 * 1024 * 1024:
                raise AppError(413, "UPLOAD_TOO_LARGE", "DOCX uploads must be at most 5 MiB.")
            return await core.upload_note(user, class_id, filename, data)
    except HTTPException as exc:
        raise AppError(
            422, "VALIDATION_ERROR", "Upload exactly one DOCX in the file field."
        ) from exc


@router.post("/quizzes", response_model=TeacherQuiz, status_code=201)
async def create_quiz(request: Request, user: CurrentUser, body: QuizCreate) -> dict[str, Any]:
    return await request.app.state.core.create_quiz(
        user, body.class_id, body.note_id, body.title, body.question_count
    )


@router.get("/quizzes", response_model=QuizzesResponse, response_model_exclude_unset=True)
async def quizzes(
    request: Request, user: CurrentUser, class_id: int | None = None
) -> dict[str, Any]:
    return {"items": await request.app.state.core.list_quizzes(user, class_id)}


@router.get(
    "/quizzes/{quiz_id}",
    response_model=StudentQuiz | TeacherQuiz | AdminQuiz,
    response_model_exclude_unset=True,
)
async def quiz(request: Request, user: CurrentUser, quiz_id: int) -> dict[str, Any]:
    return await request.app.state.core.get_quiz(user, quiz_id)


@router.delete("/quizzes/{quiz_id}", status_code=204)
async def delete_quiz(request: Request, user: CurrentUser, quiz_id: int) -> Response:
    await request.app.state.core.delete_quiz(user, quiz_id)
    return Response(status_code=204)


@router.post("/quizzes/{quiz_id}/publish", response_model=Publication)
async def publish(
    request: Request, user: CurrentUser, quiz_id: int, body: RevisionRequest
) -> dict[str, Any]:
    return await request.app.state.core.publish(user, quiz_id, body.expected_revision)


async def with_hints(request: Request, user: User, attempt: dict[str, Any]) -> dict[str, Any]:
    core = request.app.state.core
    async with core.db.read() as conn:
        await core.check_attempt(conn, user, attempt["id"])
        questions = await core.questions(conn, attempt["quiz_id"], include_keys=False)
    attempt["hints"] = [
        await request.app.state.tasks.latest(
            feature="hint",
            user=user,
            quiz_id=attempt["quiz_id"],
            attempt_id=attempt["id"],
            question_id=question["id"],
        )
        for question in questions
    ]
    return attempt


@router.post("/quizzes/{quiz_id}/attempt", response_model=AttemptResponse)
async def start_attempt(
    request: Request, user: CurrentUser, quiz_id: int, body: EmptyBody = None
) -> dict[str, Any]:
    attempt = await request.app.state.core.start_attempt(user, quiz_id)
    return await with_hints(request, user, attempt)


@router.get("/attempts/{attempt_id}", response_model=AttemptResponse)
async def attempt(
    request: Request, response: Response, user: CurrentUser, attempt_id: int
) -> dict[str, Any]:
    response.headers["Cache-Control"] = "no-store"
    result = await request.app.state.core.get_attempt(user, attempt_id)
    return await with_hints(request, user, result)


@router.put("/attempts/{attempt_id}/answers/{question_id}", response_model=SavedAnswer)
async def save_answer(
    request: Request, user: CurrentUser, attempt_id: int, question_id: int, body: AnswerRequest
) -> dict[str, Any]:
    return await request.app.state.core.save_answer(
        user, attempt_id, question_id, body.selected_option
    )


@router.post("/attempts/{attempt_id}/submit", response_model=ScoreResponse)
async def submit(
    request: Request, user: CurrentUser, attempt_id: int, body: EmptyBody = None
) -> dict[str, Any]:
    return await request.app.state.core.submit(user, attempt_id)


@router.get("/attempts/{attempt_id}/results", response_model=ResultsResponse)
async def results(request: Request, user: CurrentUser, attempt_id: int) -> dict[str, Any]:
    return await request.app.state.core.results(user, attempt_id)


@router.get("/quizzes/{quiz_id}/completion", response_model=CompletionResponse)
async def completion(request: Request, user: CurrentUser, quiz_id: int) -> dict[str, Any]:
    return await request.app.state.core.get_completion(user, quiz_id)
