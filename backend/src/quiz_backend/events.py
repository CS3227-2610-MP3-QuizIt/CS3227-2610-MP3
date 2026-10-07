import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any


class EventHub:
    """Bounded notification buffers; the database remains authoritative after drops."""

    def __init__(self) -> None:
        self.subscribers: set[asyncio.Queue[dict[str, Any]]] = set()

    @asynccontextmanager
    async def subscribe(self) -> AsyncIterator[asyncio.Queue[dict[str, Any]]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=64)
        self.subscribers.add(queue)
        try:
            yield queue
        finally:
            self.subscribers.discard(queue)

    def publish(self, envelope: dict[str, Any]) -> None:
        event = {
            key: envelope[key]
            for key in (
                "target_id",
                "feature",
                "quiz_id",
                "attempt_id",
                "question_id",
                "task_id",
                "version",
            )
        }
        for queue in self.subscribers:
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(event.copy())
