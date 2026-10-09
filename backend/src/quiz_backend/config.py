from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    environment: Literal["development", "production"] = "development"
    database_path: Path = Path("private/development.sqlite3")
    storage_path: Path = Path("private/notes")
    allowed_origins: list[str] = ["http://localhost:5173"]
    session_cookie: str = "quiz_session"
    login_max_failures: int = 5
    login_window_seconds: int = 300
    soclaas_base_url: str = "https://soclaas-api.comp.nus.edu.sg"
    soclaas_api_key: SecretStr = SecretStr("")
    soclaas_hint_model: str = ""
    soclaas_quiz_model: str = ""
    soclaas_summary_model: str = ""
    soclaas_hint_context_tokens: int = 0
    soclaas_quiz_context_tokens: int = 0
    soclaas_summary_context_tokens: int = 0
    ai_quiz_max_output_tokens: int = 32768
    ai_hint_max_output_tokens: int = 8192
    ai_summary_max_output_tokens: int = 8192
    ai_max_note_characters: int = 12000
    ai_max_hints_per_question: int = 2
    ai_response_max_bytes: int = 256 * 1024
    shutdown_grace_seconds: float = 5.0
    sse_heartbeat_seconds: float = 5.0

    @field_validator("allowed_origins")
    @classmethod
    def origins(cls, values: list[str]) -> list[str]:
        if not values:
            raise ValueError("At least one exact origin is required")
        if values == ["*"]:
            return values
        for value in values:
            parts = urlsplit(value)
            if (
                parts.scheme not in {"http", "https"}
                or not parts.netloc
                or parts.path
                or parts.query
                or parts.fragment
                or parts.username
                or "*" in value
            ):
                raise ValueError("Origins must be exact HTTP(S) origins without paths")
        return values

    @model_validator(mode="after")
    def production_origins(self) -> Settings:
        if self.environment == "production" and any(
            value != "*" and not value.startswith("https://") for value in self.allowed_origins
        ):
            raise ValueError("Production requires HTTPS origins")
        for field in (
            "login_max_failures",
            "login_window_seconds",
            "ai_max_hints_per_question",
            "ai_max_note_characters",
            "ai_response_max_bytes",
            "ai_quiz_max_output_tokens",
            "ai_hint_max_output_tokens",
            "ai_summary_max_output_tokens",
        ):
            if getattr(self, field) <= 0:
                raise ValueError(f"{field} must be positive")
        return self
