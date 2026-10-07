"""Run from backend/: uv run --locked python ../workflow/backend_persistence_smoke.py.

Two isolated processes open the same temporary database. No private environment file,
gateway call, production data, or credentials are involved. Output is only a check result.
"""

import asyncio
import subprocess
import sys
import tempfile
from pathlib import Path

import httpx

from quiz_backend.config import Settings
from quiz_backend.db import one
from quiz_backend.main import create_app
from quiz_backend.seed import DEMO_PASSWORD


async def stage(directory: Path, mode: str) -> None:
    settings = Settings(
        _env_file=None,
        environment="development",
        database_path=directory / "smoke.sqlite3",
        storage_path=directory / "notes",
        allowed_origins=["http://localhost:5173"],
        soclaas_api_key="",
        soclaas_hint_model="",
        soclaas_quiz_model="",
        soclaas_summary_model="",
    )
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app),
            base_url="http://smoke",
            headers={"Origin": "http://localhost:5173"},
        ) as client:
            response = await client.post(
                "/api/v1/auth/login",
                json={"username": "admin", "password": DEMO_PASSWORD},
            )
            assert response.status_code == 200
            if mode == "seed":
                created = await client.post(
                    "/api/v1/classes", json={"name": "Persistent smoke class"}
                )
                assert created.status_code == 201
            else:
                classes = await client.get("/api/v1/classes")
                assert classes.status_code == 200
                assert len(classes.json()["items"]) == 3
                assert classes.json()["items"][-1]["name"] == "Persistent smoke class"
                async with app.state.db.read() as conn:
                    assert await one(conn, "PRAGMA integrity_check") == {"integrity_check": "ok"}
                    assert await one(conn, "SELECT count(*) AS n FROM schema_migrations") == {
                        "n": 1
                    }


def main() -> None:
    if len(sys.argv) == 3:
        asyncio.run(stage(Path(sys.argv[1]), sys.argv[2]))
        return
    with tempfile.TemporaryDirectory(prefix="quiz-backend-smoke-") as directory:
        for mode in ("seed", "verify"):
            subprocess.run([sys.executable, __file__, directory, mode], check=True, timeout=30)
    print(
        "PASS: isolated process restart preserved accounts/classes; schema and database integrity verified."
    )


if __name__ == "__main__":
    main()
