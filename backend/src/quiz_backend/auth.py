from typing import Any

from fastapi import Request

from .errors import AppError

User = dict[str, Any]


async def current_user(request: Request) -> User:
    settings = request.app.state.core.settings
    token = request.cookies.get(settings.session_cookie)
    return await request.app.state.core.authenticate(token)


def role(user: User, *allowed: str) -> None:
    if user["role"] not in allowed:
        raise AppError(403, "FORBIDDEN_ROLE", "Your account cannot perform this action.")
