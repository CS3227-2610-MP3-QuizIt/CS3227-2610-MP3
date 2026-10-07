import argparse
import asyncio

import httpx
import uvicorn
from pydantic import ValidationError

from .ai import SoCLaaS
from .config import Settings
from .db import Database
from .errors import AppError
from .main import create_app
from .seed import seed_demo


async def initialize(settings: Settings) -> None:
    await Database(settings.database_path).initialize()


async def live_check(settings: Settings) -> None:
    """Explicit operator command: three small calls; never part of startup or tests."""
    async with httpx.AsyncClient(timeout=httpx.Timeout(45, connect=5), trust_env=False) as client:
        ai = SoCLaaS(settings, client)
        await ai.generate_quiz(
            {
                "question_count": 1,
                "notes": "A queue follows first in first out order.",
                "current_draft": [],
                "prompt": "Use a simple question.",
            }
        )
        await ai.generate_hint(
            {
                "question": "What removal order does a queue use?",
                "notes": "Queues preserve insertion order.",
                "prompt": "Give a conceptual clue.",
                "forbidden_options": ["FIFO", "LIFO", "Random", "Sorted"],
            }
        )
        await ai.generate_quiz_result_summary(
            {
                "metrics": {
                    "assigned_count": 1,
                    "submitted_count": 1,
                    "question_count": 1,
                    "average_score": 1,
                    "min_score": 1,
                    "max_score": 1,
                    "average_score_percent": 100,
                    "questions": [],
                }
            }
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run commands from backend/ with uv run quiz-backend"
    )
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("init-db")
    commands.add_parser(
        "seed-demo", help="Seed demo accounts and two classes on an empty database."
    )
    serve = commands.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=7000)
    live = commands.add_parser("live-check")
    live.add_argument(
        "--allow-live-requests",
        action="store_true",
        required=True,
        help="Explicitly allow three metered SoCLaaS calls.",
    )
    args = parser.parse_args()
    settings = Settings()
    try:
        if args.command == "init-db":
            asyncio.run(initialize(settings))
        elif args.command == "seed-demo":
            asyncio.run(seed_demo(settings))
        elif args.command == "live-check":
            asyncio.run(live_check(settings))
        else:
            uvicorn.run(create_app(settings), host=args.host, port=args.port, workers=1)
            return
    except AppError as error:
        parser.exit(1, f"{error.code}: {error.message}\n")
    except ValidationError:
        parser.exit(1, "VALIDATION_ERROR: Invalid account or configuration fields.\n")
    print("Command completed.")


if __name__ == "__main__":
    main()
