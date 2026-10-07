from typing import Any


class AppError(Exception):
    """A safe application error; private provider diagnostics never enter its message."""

    def __init__(
        self,
        status: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
        retry_after: int | None = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details or {}
        self.retry_after = retry_after

    def envelope(self) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
                "retry_after_seconds": self.retry_after,
            }
        }


def missing() -> AppError:
    return AppError(404, "NOT_FOUND", "Resource not found.")
