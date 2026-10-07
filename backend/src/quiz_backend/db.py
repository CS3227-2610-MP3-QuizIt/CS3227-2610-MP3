import asyncio
from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from importlib.resources import files
from pathlib import Path
from typing import Any

import aiosqlite


async def one(
    conn: aiosqlite.Connection, sql: str, params: Sequence[Any] = ()
) -> dict[str, Any] | None:
    async with conn.execute(sql, params) as cursor:
        row = await cursor.fetchone()
        return dict(row) if row is not None else None


async def all_rows(
    conn: aiosqlite.Connection, sql: str, params: Sequence[Any] = ()
) -> list[dict[str, Any]]:
    async with conn.execute(sql, params) as cursor:
        return [dict(row) for row in await cursor.fetchall()]


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path

    @asynccontextmanager
    async def connection(self) -> AsyncIterator[aiosqlite.Connection]:
        conn = await aiosqlite.connect(self.path, timeout=5)
        conn.row_factory = aiosqlite.Row
        try:
            await conn.execute("PRAGMA foreign_keys = ON")
            await conn.execute("PRAGMA busy_timeout = 5000")
            yield conn
        finally:
            await asyncio.shield(conn.close())

    @asynccontextmanager
    async def read(self) -> AsyncIterator[aiosqlite.Connection]:
        async with self.connection() as conn:
            await conn.execute("BEGIN")
            try:
                yield conn
            finally:
                await asyncio.shield(conn.rollback())

    @asynccontextmanager
    async def write(self) -> AsyncIterator[aiosqlite.Connection]:
        async with self.connection() as conn:
            await conn.execute("BEGIN IMMEDIATE")
            try:
                yield conn
                await asyncio.shield(conn.commit())
            except BaseException:
                await asyncio.shield(conn.rollback())
                raise

    async def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        async with self.connection() as conn:
            await conn.execute("PRAGMA journal_mode = WAL")
            await conn.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)"
            )
            await conn.commit()
            current = await one(conn, "SELECT version FROM schema_migrations WHERE version = 1")
            if current is None:
                schema = files("quiz_backend").joinpath("migrations/001_initial.sql").read_text()
                try:
                    await conn.executescript(
                        "BEGIN IMMEDIATE;\n"
                        + schema
                        + "\nINSERT INTO schema_migrations VALUES (1);\nCOMMIT;"
                    )
                except BaseException:
                    await conn.rollback()
                    raise
