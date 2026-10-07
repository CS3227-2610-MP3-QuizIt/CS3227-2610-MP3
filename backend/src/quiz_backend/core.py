import asyncio
import hashlib
import math
import secrets
import sqlite3
from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import aiosqlite
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from argon2.low_level import Type
from pydantic import ValidationError

from .auth import User, role
from .config import Settings
from .db import Database, all_rows, one
from .errors import AppError, missing
from .schemas import DisplayName, Password, TeacherQuestion, Username
from .time import stamp, utc_now

PUBLIC_USER_SQL = "id, username, display_name, role"
QUIZ_FIELDS = (
    "id",
    "class_id",
    "title",
    "question_count",
    "status",
    "revision",
    "created_at",
    "published_at",
)


def public_user(row: dict[str, Any]) -> User:
    return {key: row[key] for key in ("id", "username", "display_name", "role")}


def metadata(row: dict[str, Any]) -> dict[str, Any]:
    return {key: row[key] for key in QUIZ_FIELDS}


class Core:
    def __init__(
        self, db: Database, settings: Settings, clock: Callable[[], datetime] = utc_now
    ) -> None:
        self.db = db
        self.settings = settings
        self.clock = clock
        self.password_hasher = PasswordHasher(type=Type.ID)
        self._dummy_hash: str | None = None
        self._upload_jobs: set[asyncio.Task[dict[str, Any]]] = set()

    def _verify_password(self, password: str, password_hash: str | None) -> bool:
        if self._dummy_hash is None:
            self._dummy_hash = self.password_hasher.hash(secrets.token_urlsafe(32))
        try:
            valid = self.password_hasher.verify(password_hash or self._dummy_hash, password)
            return bool(valid and password_hash is not None)
        except VerificationError, InvalidHashError:
            return False

    async def _login_allowance(
        self, conn: aiosqlite.Connection, username: str, source_ip: str, now: datetime
    ) -> None:
        since = stamp(now - timedelta(seconds=self.settings.login_window_seconds))
        failed = await one(
            conn,
            "SELECT count(*) AS count, min(failed_at) AS oldest FROM login_failures WHERE username = ? AND source_ip = ? AND failed_at > ?",
            (username.casefold(), source_ip, since),
        )
        assert failed is not None
        if failed["count"] >= self.settings.login_max_failures:
            remaining = (
                datetime.fromisoformat(failed["oldest"])
                + timedelta(seconds=self.settings.login_window_seconds)
                - now
            ).total_seconds()
            raise AppError(
                429,
                "LOGIN_RATE_LIMIT",
                "Too many failed login attempts. Please try again later.",
                retry_after=max(1, math.ceil(remaining)),
            )

    async def login(self, username: str, password: str, source_ip: str) -> tuple[User, str]:
        async with self.db.read() as conn:
            await self._login_allowance(conn, username, source_ip, self.clock())
            account = await one(
                conn, "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
            )
        valid = await asyncio.to_thread(
            self._verify_password, password, account["password_hash"] if account else None
        )
        token = secrets.token_urlsafe(32)
        now = self.clock()
        async with self.db.write() as conn:
            await self._login_allowance(conn, username, source_ip, now)
            since = stamp(now - timedelta(seconds=self.settings.login_window_seconds))
            await conn.execute("DELETE FROM login_failures WHERE failed_at <= ?", (since,))
            if not valid or account is None:
                await conn.execute(
                    "INSERT INTO login_failures(username, source_ip, failed_at) VALUES (?, ?, ?)",
                    (username.casefold(), source_ip, stamp(now)),
                )
            else:
                await conn.execute(
                    "DELETE FROM login_failures WHERE username = ? AND source_ip = ?",
                    (username.casefold(), source_ip),
                )
                await conn.execute(
                    "INSERT INTO sessions(user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)",
                    (
                        account["id"],
                        hashlib.sha256(token.encode()).hexdigest(),
                        stamp(now),
                        stamp(now + timedelta(hours=8)),
                    ),
                )
        if not valid or account is None:
            raise AppError(401, "INVALID_CREDENTIALS", "Invalid username or password.")
        return public_user(account), token

    async def authenticate(self, token: str | None) -> User:
        if not token or len(token) > 128:
            raise AppError(401, "AUTH_REQUIRED", "Log in to continue.")
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        async with self.db.read() as conn:
            account = await one(
                conn,
                "SELECT users.id, users.username, users.display_name, users.role, sessions.expires_at FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?",
                (token_hash,),
            )
        if account is None:
            raise AppError(401, "AUTH_REQUIRED", "Log in to continue.")
        if datetime.fromisoformat(account["expires_at"]) <= self.clock():
            raise AppError(401, "SESSION_EXPIRED", "Your session has expired. Log in again.")
        return public_user(account)

    async def logout(self, token: str) -> None:
        async with self.db.write() as conn:
            await conn.execute(
                "DELETE FROM sessions WHERE token_hash = ?",
                (hashlib.sha256(token.encode()).hexdigest(),),
            )

    async def bootstrap(self, username: str, display_name: str, password: str) -> User:
        # The CLI validates through the same field constraints as API account creation.
        from pydantic import TypeAdapter

        username = TypeAdapter(Username).validate_python(username)
        display_name = TypeAdapter(DisplayName).validate_python(display_name)
        password = TypeAdapter(Password).validate_python(password)
        password_hash = await asyncio.to_thread(self.password_hasher.hash, password)
        async with self.db.write() as conn:
            if await one(conn, "SELECT id FROM users WHERE role = 'admin' LIMIT 1"):
                raise AppError(
                    409, "ADMIN_EXISTS", "An administrator has already been bootstrapped."
                )
            try:
                cursor = await conn.execute(
                    "INSERT INTO users(username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
                    (username, display_name, password_hash, stamp(self.clock())),
                )
            except sqlite3.IntegrityError as exc:
                raise AppError(409, "USERNAME_EXISTS", "That username is already in use.") from exc
            row = await one(
                conn, f"SELECT {PUBLIC_USER_SQL} FROM users WHERE id = ?", (cursor.lastrowid,)
            )
            assert row is not None
            return row

    async def create_user(
        self, user: User, username: str, display_name: str, password: str, account_role: str
    ) -> User:
        role(user, "admin")
        if account_role not in {"student", "teacher"}:
            raise AppError(
                422, "VALIDATION_ERROR", "Administrators can create only students and teachers."
            )
        password_hash = await asyncio.to_thread(self.password_hasher.hash, password)
        async with self.db.write() as conn:
            try:
                cursor = await conn.execute(
                    "INSERT INTO users(username, display_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
                    (username, display_name, password_hash, account_role, stamp(self.clock())),
                )
            except sqlite3.IntegrityError as exc:
                raise AppError(409, "USERNAME_EXISTS", "That username is already in use.") from exc
            row = await one(
                conn, f"SELECT {PUBLIC_USER_SQL} FROM users WHERE id = ?", (cursor.lastrowid,)
            )
            assert row is not None
            return row

    async def list_users(self, user: User, account_role: str | None = None) -> list[User]:
        role(user, "admin")
        async with self.db.read() as conn:
            if account_role:
                return await all_rows(
                    conn,
                    f"SELECT {PUBLIC_USER_SQL} FROM users WHERE role = ? ORDER BY username COLLATE NOCASE, id",
                    (account_role,),
                )
            return await all_rows(
                conn,
                f"SELECT {PUBLIC_USER_SQL} FROM users WHERE role IN ('student', 'teacher') ORDER BY username COLLATE NOCASE, id",
            )

    async def check_class(
        self, conn: aiosqlite.Connection, user: User, class_id: int
    ) -> dict[str, Any]:
        row = await one(conn, "SELECT id, name, created_at FROM classes WHERE id = ?", (class_id,))
        if row is None:
            raise missing()
        if user["role"] != "admin" and not await one(
            conn,
            "SELECT 1 FROM class_memberships WHERE class_id = ? AND user_id = ?",
            (class_id, user["id"]),
        ):
            raise missing()
        return row

    async def create_class(self, user: User, name: str) -> dict[str, Any]:
        role(user, "admin")
        async with self.db.write() as conn:
            cursor = await conn.execute(
                "INSERT INTO classes(name, created_by, created_at) VALUES (?, ?, ?)",
                (name, user["id"], stamp(self.clock())),
            )
            row = await one(
                conn, "SELECT id, name, created_at FROM classes WHERE id = ?", (cursor.lastrowid,)
            )
            assert row is not None
            return row

    async def list_classes(self, user: User) -> list[dict[str, Any]]:
        async with self.db.read() as conn:
            if user["role"] == "admin":
                return await all_rows(conn, "SELECT id, name, created_at FROM classes ORDER BY id")
            return await all_rows(
                conn,
                "SELECT c.id, c.name, c.created_at FROM classes c JOIN class_memberships m ON m.class_id = c.id WHERE m.user_id = ? ORDER BY c.id",
                (user["id"],),
            )

    async def members(self, user: User, class_id: int) -> list[dict[str, Any]]:
        role(user, "admin")
        async with self.db.read() as conn:
            await self.check_class(conn, user, class_id)
            return await all_rows(
                conn,
                "SELECT u.id, u.username, u.display_name, u.role, m.assigned_at FROM class_memberships m JOIN users u ON u.id = m.user_id WHERE m.class_id = ? ORDER BY u.id",
                (class_id,),
            )

    async def assign(self, user: User, class_id: int, user_id: int) -> dict[str, Any]:
        role(user, "admin")
        async with self.db.write() as conn:
            await self.check_class(conn, user, class_id)
            account = await one(
                conn,
                f"SELECT {PUBLIC_USER_SQL} FROM users WHERE id = ? AND role IN ('student', 'teacher')",
                (user_id,),
            )
            if account is None:
                raise missing()
            await conn.execute(
                "INSERT INTO class_memberships(class_id, user_id, assigned_at) VALUES (?, ?, ?) ON CONFLICT(class_id, user_id) DO NOTHING",
                (class_id, user_id, stamp(self.clock())),
            )
            membership = await one(
                conn,
                "SELECT assigned_at FROM class_memberships WHERE class_id = ? AND user_id = ?",
                (class_id, user_id),
            )
            assert membership is not None
            return {**account, **membership}

    async def unassign(self, user: User, class_id: int, user_id: int) -> None:
        role(user, "admin")
        async with self.db.write() as conn:
            await self.check_class(conn, user, class_id)
            account = await one(
                conn,
                "SELECT id FROM users WHERE id = ? AND role IN ('student', 'teacher')",
                (user_id,),
            )
            if account is None:
                raise missing()
            await conn.execute(
                "DELETE FROM class_memberships WHERE class_id = ? AND user_id = ?",
                (class_id, user_id),
            )

    async def upload_note(
        self, user: User, class_id: int, filename: str, data: bytes
    ) -> dict[str, Any]:
        from .notes import extract_docx

        role(user, "teacher")
        async with self.db.read() as conn:
            await self.check_class(conn, user, class_id)
        text = await asyncio.to_thread(
            extract_docx, data, filename, max_characters=self.settings.ai_max_note_characters
        )
        # Keep storage and persistence together when the HTTP caller disconnects.
        job = asyncio.create_task(self._persist_note(user, class_id, filename, data, text))
        self._upload_jobs.add(job)
        job.add_done_callback(self._upload_finished)
        return await asyncio.shield(job)

    def _upload_finished(self, job: asyncio.Task[dict[str, Any]]) -> None:
        self._upload_jobs.discard(job)
        if not job.cancelled():
            job.exception()

    async def drain_uploads(self) -> None:
        if self._upload_jobs:
            await asyncio.gather(*tuple(self._upload_jobs), return_exceptions=True)

    async def _persist_note(
        self, user: User, class_id: int, filename: str, data: bytes, text: str
    ) -> dict[str, Any]:
        from .notes import store_docx

        storage_key = await asyncio.to_thread(store_docx, self.settings.storage_path, data)
        try:
            async with self.db.write() as conn:
                await self.check_class(conn, user, class_id)
                now = stamp(self.clock())
                cursor = await conn.execute(
                    "INSERT INTO notes(class_id, uploaded_by, original_filename, storage_key, file_sha256, file_size_bytes, extracted_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (
                        class_id,
                        user["id"],
                        filename,
                        storage_key,
                        hashlib.sha256(data).hexdigest(),
                        len(data),
                        text,
                        now,
                    ),
                )
                assert cursor.lastrowid is not None
                return {
                    "id": cursor.lastrowid,
                    "class_id": class_id,
                    "original_filename": filename,
                    "extracted_characters": len(text),
                    "created_at": now,
                }
        except BaseException:
            await asyncio.shield(
                asyncio.to_thread(
                    Path.unlink, self.settings.storage_path / storage_key, missing_ok=True
                )
            )
            raise

    async def create_quiz(
        self, user: User, class_id: int, note_id: int, title: str, question_count: int = 5
    ) -> dict[str, Any]:
        role(user, "teacher")
        async with self.db.write() as conn:
            await self.check_class(conn, user, class_id)
            note = await one(
                conn,
                "SELECT id FROM notes WHERE id = ? AND class_id = ? AND uploaded_by = ?",
                (note_id, class_id, user["id"]),
            )
            if note is None:
                raise missing()
            cursor = await conn.execute(
                "INSERT INTO quizzes(class_id, teacher_id, note_id, title, question_count, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (class_id, user["id"], note_id, title, question_count, stamp(self.clock())),
            )
            quiz = await self.check_quiz(conn, user, int(cursor.lastrowid or 0))
            return {
                **metadata(quiz),
                "teacher_id": quiz["teacher_id"],
                "note_id": quiz["note_id"],
                "questions": [],
            }

    async def check_quiz(
        self, conn: aiosqlite.Connection, user: User, quiz_id: int
    ) -> dict[str, Any]:
        quiz = await one(conn, "SELECT * FROM quizzes WHERE id = ?", (quiz_id,))
        if quiz is None:
            raise missing()
        if user["role"] == "teacher":
            if quiz["teacher_id"] != user["id"] or not await one(
                conn,
                "SELECT 1 FROM class_memberships WHERE class_id = ? AND user_id = ?",
                (quiz["class_id"], user["id"]),
            ):
                raise missing()
        elif user["role"] == "student":
            if quiz["status"] != "published" or not await one(
                conn,
                "SELECT 1 FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
                (quiz_id, user["id"]),
            ):
                raise missing()
        elif user["role"] == "admin":
            if quiz["status"] != "published":
                raise missing()
        else:
            raise AppError(403, "FORBIDDEN_ROLE", "Your account cannot access quizzes.")
        return quiz

    async def questions(
        self, conn: aiosqlite.Connection, quiz_id: int, include_keys: bool = True
    ) -> list[dict[str, Any]]:
        if include_keys:
            columns = "id, position, question_text, option_a, option_b, option_c, option_d, correct_option, explanation"
        else:
            columns = "id, position, question_text, option_a, option_b, option_c, option_d"
        rows = await all_rows(
            conn,
            f"SELECT {columns} FROM quiz_questions WHERE quiz_id = ? ORDER BY position",
            (quiz_id,),
        )
        result = []
        for row in rows:
            question = {
                "id": row["id"],
                "position": row["position"],
                "question": row["question_text"],
                "options": {option: row[f"option_{option.lower()}"] for option in "ABCD"},
            }
            if include_keys:
                question.update(
                    correct_option=row["correct_option"], explanation=row["explanation"]
                )
            result.append(question)
        return result

    async def list_quizzes(self, user: User, class_id: int | None = None) -> list[dict[str, Any]]:
        params: list[Any] = []
        if user["role"] == "teacher":
            sql = "SELECT q.*, c.name AS class_name FROM quizzes q JOIN classes c ON c.id = q.class_id JOIN class_memberships m ON m.class_id = q.class_id AND m.user_id = q.teacher_id WHERE q.teacher_id = ?"
            params.append(user["id"])
        elif user["role"] == "student":
            sql = "SELECT q.*, c.name AS class_name, a.id AS attempt_id, a.status AS attempt_status, a.score FROM quizzes q JOIN classes c ON c.id = q.class_id JOIN quiz_attempts a ON a.quiz_id = q.id WHERE q.status = 'published' AND a.student_id = ?"
            params.append(user["id"])
        else:
            role(user, "admin")
            sql = "SELECT q.*, c.name AS class_name FROM quizzes q JOIN classes c ON c.id = q.class_id WHERE q.status = 'published'"
        if class_id is not None:
            sql += " AND q.class_id = ?"
            params.append(class_id)
        async with self.db.read() as conn:
            rows = await all_rows(conn, sql + " ORDER BY q.id", params)
        items = []
        for row in rows:
            item = {**metadata(row), "class_name": row["class_name"]}
            if user["role"] == "student":
                item.update(attempt_id=row["attempt_id"], attempt_status=row["attempt_status"])
                if row["attempt_status"] == "submitted":
                    item["score"] = row["score"]
            items.append(item)
        return items

    async def get_quiz(self, user: User, quiz_id: int) -> dict[str, Any]:
        async with self.db.read() as conn:
            quiz = await self.check_quiz(conn, user, quiz_id)
            result = metadata(quiz)
            if user["role"] == "teacher":
                result.update(
                    teacher_id=quiz["teacher_id"],
                    note_id=quiz["note_id"],
                    questions=await self.questions(conn, quiz_id),
                )
            elif user["role"] == "student":
                attempt = await one(
                    conn,
                    "SELECT id, status, score FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
                    (quiz_id, user["id"]),
                )
                assert attempt is not None
                result.update(
                    attempt_id=attempt["id"],
                    attempt_status=attempt["status"],
                    questions=await self.questions(conn, quiz_id, include_keys=False),
                )
                if attempt["status"] == "submitted":
                    result["score"] = attempt["score"]
            return result

    async def publish(self, user: User, quiz_id: int, expected_revision: int) -> dict[str, Any]:
        role(user, "teacher")
        async with self.db.write() as conn:
            quiz = await self.check_quiz(conn, user, quiz_id)
            if quiz["revision"] != expected_revision:
                raise AppError(
                    409,
                    "STALE_REVISION",
                    "The quiz revision has changed. Review the current draft before publishing.",
                )
            if quiz["status"] == "published":
                completion = await self.completion(conn, quiz_id)
                return {**metadata(quiz), "assigned_student_count": completion["assigned_count"]}
            if await one(
                conn,
                "SELECT 1 FROM ai_requests r JOIN ai_targets t ON t.id = r.target_id WHERE t.feature = 'quiz_generation' AND t.quiz_id = ? AND r.status = 'running'",
                (quiz_id,),
            ):
                raise AppError(
                    409,
                    "AI_REQUEST_IN_PROGRESS",
                    "Wait for quiz generation to finish before publishing.",
                )
            questions = await self.questions(conn, quiz_id)
            try:
                validated = [TeacherQuestion.model_validate(question) for question in questions]
            except ValidationError as exc:
                raise AppError(
                    409, "QUIZ_NOT_READY", "The draft questions must be valid before publishing."
                ) from exc
            if (
                quiz["revision"] <= 0
                or len(validated) != quiz["question_count"]
                or [question.position for question in validated]
                != list(range(1, quiz["question_count"] + 1))
                or len({" ".join(question.question.split()).casefold() for question in validated})
                != len(validated)
            ):
                raise AppError(
                    409, "QUIZ_NOT_READY", "Generate and review a complete draft before publishing."
                )
            students = await all_rows(
                conn,
                "SELECT u.id FROM users u JOIN class_memberships m ON m.user_id = u.id WHERE m.class_id = ? AND u.role = 'student' ORDER BY u.id",
                (quiz["class_id"],),
            )
            if not students:
                raise AppError(409, "NO_STUDENTS", "Assign at least one student before publishing.")
            published_at = stamp(self.clock())
            changed = await conn.execute(
                "UPDATE quizzes SET status = 'published', published_at = ? WHERE id = ? AND status = 'draft' AND revision = ?",
                (published_at, quiz_id, expected_revision),
            )
            if changed.rowcount != 1:
                raise AppError(409, "STALE_REVISION", "Review the current draft before publishing.")
            await conn.executemany(
                "INSERT INTO quiz_attempts(quiz_id, student_id) VALUES (?, ?)",
                [(quiz_id, student["id"]) for student in students],
            )
            quiz.update(status="published", published_at=published_at)
            return {**metadata(quiz), "assigned_student_count": len(students)}

    async def check_attempt(
        self, conn: aiosqlite.Connection, user: User, attempt_id: int
    ) -> dict[str, Any]:
        role(user, "student")
        attempt = await one(
            conn,
            "SELECT a.* FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = ? AND a.student_id = ? AND q.status = 'published'",
            (attempt_id, user["id"]),
        )
        if attempt is None:
            raise missing()
        return attempt

    async def _attempt_response(
        self, conn: aiosqlite.Connection, attempt: dict[str, Any]
    ) -> dict[str, Any]:
        answers = await all_rows(
            conn,
            "SELECT question_id, selected_option, updated_at FROM attempt_answers WHERE attempt_id = ? ORDER BY question_id",
            (attempt["id"],),
        )
        return {key: attempt[key] for key in ("id", "quiz_id", "status", "started_at")} | {
            "answers": answers,
            "hints": [],
        }

    async def start_attempt(self, user: User, quiz_id: int) -> dict[str, Any]:
        role(user, "student")
        async with self.db.write() as conn:
            await self.check_quiz(conn, user, quiz_id)
            attempt = await one(
                conn,
                "SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?",
                (quiz_id, user["id"]),
            )
            assert attempt is not None
            if attempt["status"] == "not_started":
                started_at = stamp(self.clock())
                changed = await conn.execute(
                    "UPDATE quiz_attempts SET status = 'in_progress', started_at = ? WHERE id = ? AND status = 'not_started'",
                    (started_at, attempt["id"]),
                )
                if changed.rowcount != 1:
                    raise AppError(409, "ATTEMPT_SUBMITTED", "The attempt state has changed.")
                attempt.update(status="in_progress", started_at=started_at)
            return await self._attempt_response(conn, attempt)

    async def get_attempt(self, user: User, attempt_id: int) -> dict[str, Any]:
        async with self.db.read() as conn:
            attempt = await self.check_attempt(conn, user, attempt_id)
            return await self._attempt_response(conn, attempt)

    async def save_answer(
        self, user: User, attempt_id: int, question_id: int, selected_option: str
    ) -> dict[str, Any]:
        role(user, "student")
        async with self.db.write() as conn:
            attempt = await self.check_attempt(conn, user, attempt_id)
            if attempt["status"] == "submitted":
                raise AppError(409, "ATTEMPT_SUBMITTED", "This attempt has already been submitted.")
            if attempt["status"] != "in_progress":
                raise AppError(
                    409, "ATTEMPT_NOT_STARTED", "Start the attempt before saving answers."
                )
            question = await one(
                conn,
                "SELECT id FROM quiz_questions WHERE id = ? AND quiz_id = ?",
                (question_id, attempt["quiz_id"]),
            )
            if question is None:
                raise missing()
            now = stamp(self.clock())
            await conn.execute(
                "INSERT INTO attempt_answers(attempt_id, quiz_id, question_id, selected_option, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(attempt_id, question_id) DO UPDATE SET selected_option = excluded.selected_option, updated_at = excluded.updated_at",
                (attempt_id, attempt["quiz_id"], question_id, selected_option, now),
            )
            return {
                "question_id": question_id,
                "selected_option": selected_option,
                "updated_at": now,
            }

    async def _score_response(
        self, conn: aiosqlite.Connection, attempt: dict[str, Any]
    ) -> dict[str, Any]:
        quiz = await one(
            conn, "SELECT question_count FROM quizzes WHERE id = ?", (attempt["quiz_id"],)
        )
        assert quiz is not None
        count = quiz["question_count"]
        return {
            key: attempt[key] for key in ("id", "quiz_id", "status", "score", "submitted_at")
        } | {"total_questions": count, "score_percent": round(100 * attempt["score"] / count, 2)}

    async def submit(self, user: User, attempt_id: int) -> dict[str, Any]:
        role(user, "student")
        async with self.db.write() as conn:
            attempt = await self.check_attempt(conn, user, attempt_id)
            if attempt["status"] == "submitted":
                return await self._score_response(conn, attempt)
            if attempt["status"] != "in_progress":
                raise AppError(409, "ATTEMPT_NOT_STARTED", "Start the attempt before submitting.")
            questions = await self.questions(conn, attempt["quiz_id"])
            answers = await all_rows(
                conn,
                "SELECT question_id, selected_option FROM attempt_answers WHERE attempt_id = ?",
                (attempt_id,),
            )
            by_question = {answer["question_id"]: answer["selected_option"] for answer in answers}
            if len(by_question) != len(questions) or any(
                question["id"] not in by_question for question in questions
            ):
                raise AppError(
                    422,
                    "ANSWERS_INCOMPLETE",
                    "Select an answer for every question before submitting.",
                )
            score = sum(
                by_question[question["id"]] == question["correct_option"] for question in questions
            )
            submitted_at = stamp(self.clock())
            changed = await conn.execute(
                "UPDATE quiz_attempts SET status = 'submitted', score = ?, submitted_at = ? WHERE id = ? AND status = 'in_progress'",
                (score, submitted_at, attempt_id),
            )
            if changed.rowcount != 1:
                raise AppError(409, "ATTEMPT_SUBMITTED", "The attempt state has changed.")
            attempt.update(status="submitted", score=score, submitted_at=submitted_at)
            return await self._score_response(conn, attempt)

    async def results(self, user: User, attempt_id: int) -> dict[str, Any]:
        async with self.db.read() as conn:
            attempt = await self.check_attempt(conn, user, attempt_id)
            if attempt["status"] != "submitted":
                raise AppError(
                    409, "ATTEMPT_NOT_SUBMITTED", "Submit your attempt before viewing results."
                )
            questions = await self.questions(conn, attempt["quiz_id"])
            answers = await all_rows(
                conn,
                "SELECT question_id, selected_option FROM attempt_answers WHERE attempt_id = ?",
                (attempt_id,),
            )
            by_question = {answer["question_id"]: answer["selected_option"] for answer in answers}
            for question in questions:
                question.update(
                    selected_option=by_question[question["id"]],
                    is_correct=by_question[question["id"]] == question["correct_option"],
                )
            return await self._score_response(conn, attempt) | {"questions": questions}

    async def completion(self, conn: aiosqlite.Connection, quiz_id: int) -> dict[str, Any]:
        counts = await one(
            conn,
            "SELECT count(*) AS assigned_count, coalesce(sum(status = 'submitted'), 0) AS submitted_count, coalesce(sum(status = 'not_started'), 0) AS not_started_count, coalesce(sum(status = 'in_progress'), 0) AS in_progress_count FROM quiz_attempts WHERE quiz_id = ?",
            (quiz_id,),
        )
        assert counts is not None
        task = await one(
            conn,
            "SELECT r.status FROM ai_targets t LEFT JOIN ai_requests r ON r.id = t.latest_request_id WHERE t.feature = 'summary' AND t.quiz_id = ?",
            (quiz_id,),
        )
        return {
            "quiz_id": quiz_id,
            **counts,
            "summary_eligible": counts["assigned_count"] > 0
            and counts["submitted_count"] == counts["assigned_count"],
            "has_summary": task is not None and task["status"] == "succeeded",
        }

    async def get_completion(self, user: User, quiz_id: int) -> dict[str, Any]:
        role(user, "admin")
        async with self.db.read() as conn:
            await self.check_quiz(conn, user, quiz_id)
            return await self.completion(conn, quiz_id)

    async def metrics(self, conn: aiosqlite.Connection, quiz_id: int) -> dict[str, Any]:
        completion = await self.completion(conn, quiz_id)
        if not completion["summary_eligible"]:
            raise AppError(
                409,
                "QUIZ_INCOMPLETE",
                "All assigned students must submit before a summary can be generated.",
                details={
                    "assigned_count": completion["assigned_count"],
                    "submitted_count": completion["submitted_count"],
                },
            )
        quiz = await one(conn, "SELECT question_count FROM quizzes WHERE id = ?", (quiz_id,))
        assert quiz is not None
        scores = await one(
            conn,
            "SELECT sum(score) AS total_score, min(score) AS min_score, max(score) AS max_score FROM quiz_attempts WHERE quiz_id = ? AND status = 'submitted'",
            (quiz_id,),
        )
        assert scores is not None
        count = completion["assigned_count"]
        questions = await self.questions(conn, quiz_id)
        for question in questions:
            option_counts = {option: 0 for option in "ABCD"}
            for row in await all_rows(
                conn,
                "SELECT a.selected_option, count(*) AS count FROM attempt_answers a JOIN quiz_attempts t ON t.id = a.attempt_id WHERE a.quiz_id = ? AND a.question_id = ? AND t.status = 'submitted' GROUP BY a.selected_option",
                (quiz_id, question["id"]),
            ):
                option_counts[row["selected_option"]] = row["count"]
            correct_count = option_counts[question["correct_option"]]
            question.pop("explanation")
            question.update(
                correct_count=correct_count,
                incorrect_count=count - correct_count,
                correct_percent=round(100 * correct_count / count, 2),
                option_counts=option_counts,
            )
        return {
            "assigned_count": count,
            "submitted_count": completion["submitted_count"],
            "question_count": quiz["question_count"],
            "average_score": scores["total_score"] / count,
            "min_score": scores["min_score"],
            "max_score": scores["max_score"],
            "average_score_percent": round(
                100 * scores["total_score"] / (count * quiz["question_count"]), 2
            ),
            "questions": questions,
        }
