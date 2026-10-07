"""Seed a fresh database before serving requests; leave existing data unchanged."""

import asyncio

from argon2 import PasswordHasher
from argon2.low_level import Type

from .config import Settings
from .db import Database, one
from .time import stamp, utc_now

DEMO_PASSWORD = "QuizDemo2026!"


async def seed_demo(settings: Settings) -> None:
    db = Database(settings.database_path)
    await db.initialize()
    async with db.read() as conn:
        if await one(conn, "SELECT id FROM users LIMIT 1"):
            return
    accounts = [
        ("admin", "Administrator", "admin"),
        ("teacher1", "Teacher 1", "teacher"),
        ("teacher2", "Teacher 2", "teacher"),
        *[(f"student{number:02d}", f"Student {number:02d}", "student") for number in range(1, 21)],
    ]
    hasher = PasswordHasher(type=Type.ID)
    # Hash outside the write transaction, with a separate random salt for each account.
    hashes = [await asyncio.to_thread(hasher.hash, DEMO_PASSWORD) for _ in accounts]
    now = stamp(utc_now())
    async with db.write() as conn:
        # Recheck under the write lock so simultaneous startup cannot seed twice.
        if await one(conn, "SELECT id FROM users LIMIT 1"):
            return
        account_ids: dict[str, int] = {}
        for (username, display_name, account_role), password_hash in zip(
            accounts, hashes, strict=True
        ):
            cursor = await conn.execute(
                "INSERT INTO users(username, display_name, password_hash, role, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (username, display_name, password_hash, account_role, now),
            )
            assert cursor.lastrowid is not None
            account_ids[username] = cursor.lastrowid

        for number in (1, 2):
            name = f"Class {number}"
            cursor = await conn.execute(
                "INSERT INTO classes(name, created_by, created_at) VALUES (?, ?, ?)",
                (name, account_ids["admin"], now),
            )
            assert cursor.lastrowid is not None
            class_id = cursor.lastrowid
            members = [f"teacher{number}"] + [
                f"student{student:02d}" for student in range((number - 1) * 10 + 1, number * 10 + 1)
            ]
            await conn.executemany(
                "INSERT INTO class_memberships(class_id, user_id, assigned_at) VALUES (?, ?, ?)",
                [(class_id, account_ids[username], now) for username in members],
            )
