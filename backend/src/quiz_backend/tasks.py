import asyncio
import hashlib
import json
import math
import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any

import aiosqlite

from .ai import AIError, AIResult, SoCLaaS
from .core import Core
from .db import Database, all_rows, one
from .errors import AppError, missing
from .events import EventHub
from .time import stamp, utc_now

EXECUTION_SECONDS = 60
ADMISSION_LIMIT = 30
WINDOW_SECONDS = 60


class NeedsPreparation(Exception):
    pass


class TaskManager:
    """Persist operations and supervise coroutines without queues or concurrency caps."""

    def __init__(
        self, db: Database, core: Core, ai: SoCLaaS, clock: Callable[[], datetime] = utc_now
    ) -> None:
        self.db, self.core, self.ai, self.clock = db, core, ai, clock
        self.events = EventHub()
        self.active: dict[str, asyncio.Task[None]] = {}
        self.admissions: set[asyncio.Task[dict[str, Any]]] = set()
        self.cleanup: set[asyncio.Task[None]] = set()
        self.accepting = True

    async def access(
        self,
        conn: aiosqlite.Connection,
        user: dict[str, Any],
        feature: str,
        quiz_id: int,
        attempt_id: int | None = None,
        question_id: int | None = None,
    ) -> dict[str, Any]:
        required = {"quiz_generation": "teacher", "hint": "student", "summary": "admin"}[feature]
        if user["role"] != required:
            raise AppError(403, "FORBIDDEN_ROLE", "This role cannot access the requested feature.")
        quiz = await self.core.check_quiz(conn, user, quiz_id)
        if feature == "hint":
            attempt = await self.core.check_attempt(conn, user, attempt_id)  # type: ignore[arg-type]
            if attempt["quiz_id"] != quiz_id or not await one(
                conn,
                "SELECT id FROM quiz_questions WHERE id=? AND quiz_id=?",
                (question_id, quiz_id),
            ):
                raise missing()
            return attempt
        return quiz

    async def target(
        self,
        conn: aiosqlite.Connection,
        feature: str,
        quiz_id: int,
        attempt_id: int | None,
        question_id: int | None,
    ) -> dict[str, Any] | None:
        return await one(
            conn,
            "SELECT * FROM ai_targets WHERE feature=? AND quiz_id=? AND attempt_id IS ? AND question_id IS ?",
            (feature, quiz_id, attempt_id, question_id),
        )

    async def envelope(
        self, conn: aiosqlite.Connection, target: dict[str, Any], task_id: str | None = None
    ) -> dict[str, Any]:
        task = await one(
            conn, "SELECT * FROM ai_requests WHERE id=?", (task_id or target["latest_request_id"],)
        )
        result = error = None
        status = "not_requested"
        if task:
            status = {"running": "in_progress", "succeeded": "success", "failed": "failed"}[
                task["status"]
            ]
            if task["status"] == "succeeded":
                result = json.loads(task["response_json"])
            elif task["status"] == "failed":
                error = json.loads(task["response_json"])["error"]
                error["http_status"] = task["http_status"]
        return {
            "target_id": target["id"],
            "feature": target["feature"],
            "quiz_id": target["quiz_id"],
            "attempt_id": target["attempt_id"],
            "question_id": target["question_id"],
            "task_id": task["id"] if task else None,
            "version": task["state_version"] if task_id and task else target["version"],
            "status": status,
            "result": result,
            "error": error,
        }

    async def latest(
        self,
        *,
        feature: str,
        user: dict[str, Any],
        quiz_id: int,
        attempt_id: int | None = None,
        question_id: int | None = None,
    ) -> dict[str, Any]:
        async with self.db.read() as conn:
            await self.access(conn, user, feature, quiz_id, attempt_id, question_id)
            target = await self.target(conn, feature, quiz_id, attempt_id, question_id)
            if target:
                return await self.envelope(conn, target)
            return {
                "target_id": None,
                "feature": feature,
                "quiz_id": quiz_id,
                "attempt_id": attempt_id,
                "question_id": question_id,
                "task_id": None,
                "version": 0,
                "status": "not_requested",
                "result": None,
                "error": None,
            }

    async def historical(self, user: dict[str, Any], task_id: str) -> dict[str, Any]:
        async with self.db.read() as conn:
            task = await one(conn, "SELECT * FROM ai_requests WHERE id=?", (task_id,))
            if not task:
                raise missing()
            target = await one(conn, "SELECT * FROM ai_targets WHERE id=?", (task["target_id"],))
            assert target
            await self.access(
                conn,
                user,
                target["feature"],
                target["quiz_id"],
                target["attempt_id"],
                target["question_id"],
            )
            return await self.envelope(conn, target, task_id)

    async def reusable(
        self,
        conn: aiosqlite.Connection,
        user: dict[str, Any],
        key: str,
        request_hash: str,
        target: dict[str, Any] | None,
        action: str,
    ) -> str | None:
        binding = await one(
            conn,
            "SELECT * FROM ai_operation_keys WHERE actor_id=? AND idempotency_key=?",
            (user["id"], key),
        )
        if binding:
            if binding["request_hash"] != request_hash:
                raise AppError(
                    409, "IDEMPOTENCY_CONFLICT", "This operation key is bound to different input."
                )
            return str(binding["ai_request_id"])
        if target:
            latest = await one(
                conn, "SELECT id,status FROM ai_requests WHERE id=?", (target["latest_request_id"],)
            )
            if latest and (action == "ensure" or latest["status"] == "running"):
                return str(latest["id"])
        return None

    async def eligible(
        self,
        conn: aiosqlite.Connection,
        user: dict[str, Any],
        feature: str,
        quiz_id: int,
        attempt_id: int | None,
        question_id: int | None,
        body: dict[str, Any],
    ) -> None:
        resource = await self.access(conn, user, feature, quiz_id, attempt_id, question_id)
        if feature == "quiz_generation":
            if resource["status"] != "draft":
                raise AppError(
                    409, "QUIZ_PUBLISHED", "Published quizzes cannot be generated again."
                )
            if resource["revision"] != body["expected_revision"]:
                raise AppError(409, "STALE_REVISION", "Read and review the current quiz revision.")
        elif feature == "hint":
            if resource["status"] == "submitted":
                raise AppError(
                    409, "ATTEMPT_SUBMITTED", "Submitted attempts cannot request new hints."
                )
            if resource["status"] != "in_progress":
                raise AppError(
                    409, "ATTEMPT_NOT_STARTED", "Start the attempt before requesting a hint."
                )
            count = await one(
                conn,
                "SELECT count(*) AS n FROM hints WHERE attempt_id=? AND question_id=?",
                (attempt_id, question_id),
            )
            assert count
            if count["n"] >= self.core.settings.ai_max_hints_per_question:
                raise AppError(
                    422, "HINT_LIMIT_REACHED", "The successful hint allowance has been reached."
                )
        else:
            completion = await self.core.completion(conn, quiz_id)
            if not completion["summary_eligible"]:
                raise AppError(
                    409,
                    "QUIZ_INCOMPLETE",
                    "All assigned students must submit before a summary can be generated.",
                    {
                        "assigned_count": completion["assigned_count"],
                        "submitted_count": completion["submitted_count"],
                    },
                )

    async def snapshot(
        self,
        conn: aiosqlite.Connection,
        feature: str,
        quiz_id: int,
        question_id: int | None,
        body: dict[str, Any],
    ) -> dict[str, Any]:
        if feature == "summary":
            return {"metrics": await self.core.metrics(conn, quiz_id)}
        quiz = await one(
            conn,
            "SELECT q.*,n.extracted_text FROM quizzes q JOIN notes n ON n.id=q.note_id WHERE q.id=?",
            (quiz_id,),
        )
        assert quiz
        if feature == "quiz_generation":
            return {
                "question_count": quiz["question_count"],
                "notes": quiz["extracted_text"],
                "current_draft": await self.core.questions(conn, quiz_id),
                "prompt": body["prompt"],
            }
        question = await one(
            conn, "SELECT * FROM quiz_questions WHERE id=? AND quiz_id=?", (question_id, quiz_id)
        )
        assert question
        return {
            "question": question["question_text"],
            "notes": quiz["extracted_text"],
            "prompt": body["prompt"],
            "forbidden_options": [question[f"option_{label}"] for label in "abcd"],
        }

    async def admit(
        self,
        *,
        user: dict[str, Any],
        feature: str,
        quiz_id: int,
        key: str,
        route: str,
        body: dict[str, Any],
        attempt_id: int | None = None,
        question_id: int | None = None,
    ) -> dict[str, Any]:
        if not self.accepting:
            raise AppError(503, "AI_UNAVAILABLE", "AI requests are unavailable during shutdown.")
        # Shield admission so a disconnect cannot strand a committed task before registration.
        job = asyncio.create_task(
            self._admit(user, feature, quiz_id, key, route, body, attempt_id, question_id)
        )
        self.admissions.add(job)
        job.add_done_callback(self._admission_done)
        return await asyncio.shield(job)

    def _admission_done(self, job: asyncio.Task[dict[str, Any]]) -> None:
        self.admissions.discard(job)
        if not job.cancelled():
            job.exception()  # Retrieve exceptions even if the HTTP caller disconnected.

    async def _admit(
        self,
        user: dict[str, Any],
        feature: str,
        quiz_id: int,
        key: str,
        route: str,
        body: dict[str, Any],
        attempt_id: int | None,
        question_id: int | None,
    ) -> dict[str, Any]:
        canonical = json.dumps(
            {"method": "POST", "route": route, "body": body}, sort_keys=True, separators=(",", ":")
        )
        request_hash = hashlib.sha256(canonical.encode()).hexdigest()
        prepared: dict[str, Any] | None = None
        async with self.db.read() as conn:
            await self.access(conn, user, feature, quiz_id, attempt_id, question_id)
            target = await self.target(conn, feature, quiz_id, attempt_id, question_id)
            reuse = await self.reusable(conn, user, key, request_hash, target, body["action"])
            if not reuse:
                await self.eligible(conn, user, feature, quiz_id, attempt_id, question_id, body)
                prepared = await self.snapshot(conn, feature, quiz_id, question_id, body)
        if prepared is not None:
            self.ai.prepare(feature, prepared)
        try:
            return await self._commit_admission(
                user, feature, quiz_id, key, body, attempt_id, question_id, request_hash, prepared
            )
        except NeedsPreparation:
            # Another transaction can replace a reusable terminal task between reads.
            return await self._admit(
                user, feature, quiz_id, key, route, body, attempt_id, question_id
            )

    async def _commit_admission(
        self,
        user: dict[str, Any],
        feature: str,
        quiz_id: int,
        key: str,
        body: dict[str, Any],
        attempt_id: int | None,
        question_id: int | None,
        request_hash: str,
        prepared: dict[str, Any] | None,
    ) -> dict[str, Any]:
        fresh = False
        admitted_monotonic = 0.0
        async with self.db.write() as conn:
            await self.access(conn, user, feature, quiz_id, attempt_id, question_id)
            target = await self.target(conn, feature, quiz_id, attempt_id, question_id)
            reuse = await self.reusable(conn, user, key, request_hash, target, body["action"])
            if reuse:
                task = await one(conn, "SELECT target_id FROM ai_requests WHERE id=?", (reuse,))
                assert task
                target = await one(
                    conn, "SELECT * FROM ai_targets WHERE id=?", (task["target_id"],)
                )
                assert target
                await conn.execute(
                    "INSERT OR IGNORE INTO ai_operation_keys VALUES (?,?,?,?,?)",
                    (user["id"], key, request_hash, reuse, stamp(self.clock())),
                )
                envelope = await self.envelope(conn, target, reuse)
            else:
                if not self.accepting:
                    raise AppError(
                        503, "AI_UNAVAILABLE", "AI requests are unavailable during shutdown."
                    )
                if prepared is None:
                    raise NeedsPreparation()
                await self.eligible(conn, user, feature, quiz_id, attempt_id, question_id, body)
                now = self.clock()
                rate = await one(
                    conn,
                    "SELECT count(*) AS n,min(created_at) AS oldest FROM ai_requests WHERE created_at>?",
                    (stamp(now - timedelta(seconds=WINDOW_SECONDS)),),
                )
                assert rate
                if rate["n"] >= ADMISSION_LIMIT:
                    retry = max(
                        1,
                        math.ceil(
                            (
                                datetime.fromisoformat(rate["oldest"])
                                + timedelta(seconds=WINDOW_SECONDS)
                                - now
                            ).total_seconds()
                        ),
                    )
                    raise AppError(
                        429,
                        "AI_APP_RATE_LIMIT",
                        "AI request limit reached. Please try again later.",
                        retry_after=retry,
                    )
                if target is None:
                    cursor = await conn.execute(
                        "INSERT INTO ai_targets(feature,quiz_id,attempt_id,question_id) VALUES (?,?,?,?)",
                        (feature, quiz_id, attempt_id, question_id),
                    )
                    target = await one(
                        conn, "SELECT * FROM ai_targets WHERE id=?", (cursor.lastrowid,)
                    )
                assert target
                task_id = str(uuid.uuid4())
                version = target["version"] + 1
                admitted_monotonic = asyncio.get_running_loop().time()
                await conn.execute(
                    "INSERT INTO ai_requests(id,target_id,actor_id,expected_revision,status,state_version,input_json,model_id,created_at,deadline_at,started_at) VALUES (?,?,?,?, 'running',?,?,?,?,?,?)",
                    (
                        task_id,
                        target["id"],
                        user["id"],
                        body.get("expected_revision"),
                        version,
                        json.dumps(prepared),
                        self.ai.model_for(feature),
                        stamp(now),
                        stamp(now + timedelta(seconds=EXECUTION_SECONDS)),
                        stamp(now),
                    ),
                )
                await conn.execute(
                    "UPDATE ai_targets SET version=?,latest_request_id=? WHERE id=?",
                    (version, task_id, target["id"]),
                )
                await conn.execute(
                    "INSERT INTO ai_operation_keys VALUES (?,?,?,?,?)",
                    (user["id"], key, request_hash, task_id, stamp(now)),
                )
                target.update(version=version, latest_request_id=task_id)
                envelope = await self.envelope(conn, target)
                fresh = True
        if fresh:
            self.events.publish(envelope)
            try:
                self.register(envelope["task_id"], admitted_monotonic)
            except Exception:
                await self.fail(
                    envelope["task_id"],
                    AppError(
                        503,
                        "AI_REQUEST_INTERRUPTED",
                        "AI request was interrupted; explicitly retry when eligible.",
                    ),
                )
                return await self.historical(user, envelope["task_id"])
        return envelope

    def register(self, task_id: str, admission_time: float) -> None:
        coroutine = self.run(task_id, admission_time)
        try:
            task = asyncio.create_task(coroutine, name=f"ai:{task_id}")
        except BaseException:
            coroutine.close()
            raise
        self.active[task_id] = task
        task.add_done_callback(lambda done: self._task_done(task_id, done))

    def _task_done(self, task_id: str, task: asyncio.Task[None]) -> None:
        self.active.pop(task_id, None)
        # Handles cancellation even before run() executes its first instruction.
        if task.cancelled() or task.exception() is not None:
            job = asyncio.create_task(
                self.fail(
                    task_id,
                    AppError(
                        503,
                        "AI_REQUEST_INTERRUPTED",
                        "AI request was interrupted; explicitly retry when eligible.",
                    ),
                )
            )
            self.cleanup.add(job)
            job.add_done_callback(self._cleanup_done)

    def _cleanup_done(self, job: asyncio.Task[None]) -> None:
        self.cleanup.discard(job)
        if not job.cancelled():
            job.exception()

    async def run(self, task_id: str, admission_time: float) -> None:
        result: AIResult | None = None
        try:
            deadline = admission_time + EXECUTION_SECONDS
            async with asyncio.timeout_at(deadline):
                async with self.db.read() as conn:
                    task = await one(conn, "SELECT * FROM ai_requests WHERE id=?", (task_id,))
                    if not task or task["status"] != "running":
                        return
                    target = await one(
                        conn, "SELECT * FROM ai_targets WHERE id=?", (task["target_id"],)
                    )
                    user = await one(
                        conn,
                        "SELECT id,username,display_name,role FROM users WHERE id=?",
                        (task["actor_id"],),
                    )
                    assert target and user
                    await self.validate_completion(conn, task, target, user)
                snapshot = json.loads(task["input_json"])
                operation = {
                    "hint": self.ai.generate_hint,
                    "quiz_generation": self.ai.generate_quiz,
                    "summary": self.ai.generate_quiz_result_summary,
                }[target["feature"]]
                result = await operation(snapshot)
                await self.succeed(task_id, result, execution_deadline=deadline)
        except TimeoutError:
            await self.safe_fail(
                task_id,
                AppError(
                    504, "AI_TIMEOUT", "AI request timed out; explicitly retry when eligible."
                ),
                result,
            )
        except asyncio.CancelledError:
            await self.safe_fail(
                task_id,
                AppError(
                    503,
                    "AI_REQUEST_INTERRUPTED",
                    "AI request was interrupted; explicitly retry when eligible.",
                ),
                result,
            )
            raise
        except AppError as error:
            await self.safe_fail(task_id, error, result)
        except Exception:
            await self.safe_fail(
                task_id,
                AppError(502, "AI_UPSTREAM_ERROR", "AI request could not be completed."),
                result,
            )

    async def validate_completion(
        self,
        conn: aiosqlite.Connection,
        task: dict[str, Any],
        target: dict[str, Any],
        user: dict[str, Any],
    ) -> None:
        if target["latest_request_id"] != task["id"]:
            raise AppError(
                409, "STALE_REVISION", "AI request is no longer the latest target operation."
            )
        if self.clock() >= datetime.fromisoformat(task["deadline_at"]):
            raise AppError(
                504, "AI_TIMEOUT", "AI request timed out; explicitly retry when eligible."
            )
        await self.eligible(
            conn,
            user,
            target["feature"],
            target["quiz_id"],
            target["attempt_id"],
            target["question_id"],
            {"expected_revision": task["expected_revision"]},
        )

    async def succeed(
        self, task_id: str, result: AIResult, *, execution_deadline: float | None = None
    ) -> None:
        async with self.db.write() as conn:
            task = await one(conn, "SELECT * FROM ai_requests WHERE id=?", (task_id,))
            if not task or task["status"] != "running":
                return
            target = await one(conn, "SELECT * FROM ai_targets WHERE id=?", (task["target_id"],))
            user = await one(
                conn,
                "SELECT id,username,display_name,role FROM users WHERE id=?",
                (task["actor_id"],),
            )
            assert target and user
            await self.validate_completion(conn, task, target, user)
            now = stamp(self.clock())
            applied = await self.apply(conn, task, target, result.result, now)
            if self.clock() >= datetime.fromisoformat(task["deadline_at"]) or (
                execution_deadline is not None
                and asyncio.get_running_loop().time() >= execution_deadline
            ):
                raise AppError(
                    504, "AI_TIMEOUT", "AI request timed out; explicitly retry when eligible."
                )
            now = stamp(self.clock())
            await self.terminal(
                conn,
                task,
                target,
                "succeeded",
                applied,
                200,
                None,
                result.usage,
                result.provider_status,
                now,
            )
            envelope = await self.envelope(conn, target)
        self.events.publish(envelope)

    async def apply(
        self,
        conn: aiosqlite.Connection,
        task: dict[str, Any],
        target: dict[str, Any],
        output: dict[str, Any],
        now: str,
    ) -> dict[str, Any]:
        quiz_id, feature = target["quiz_id"], target["feature"]
        if feature == "quiz_generation":
            await conn.execute("DELETE FROM quiz_questions WHERE quiz_id=?", (quiz_id,))
            for position, question in enumerate(output["questions"], 1):
                options = question["options"]
                await conn.execute(
                    "INSERT INTO quiz_questions(quiz_id,position,question_text,option_a,option_b,option_c,option_d,correct_option,explanation) VALUES (?,?,?,?,?,?,?,?,?)",
                    (
                        quiz_id,
                        position,
                        question["question"],
                        *[options[x] for x in "ABCD"],
                        question["correct_option"],
                        question["explanation"],
                    ),
                )
            cursor = await conn.execute(
                "UPDATE quizzes SET revision=revision+1 WHERE id=? AND revision=? AND status='draft'",
                (quiz_id, task["expected_revision"]),
            )
            if cursor.rowcount != 1:
                raise AppError(
                    409, "STALE_REVISION", "The draft revision changed before completion."
                )
            quiz = await one(
                conn,
                "SELECT id,class_id,title,status,revision,question_count,created_at,published_at FROM quizzes WHERE id=?",
                (quiz_id,),
            )
            assert quiz
            quiz["questions"] = await self.core.questions(conn, quiz_id)
            return quiz
        if feature == "hint":
            snapshot = json.loads(task["input_json"])
            prompt = snapshot["prompt"]
            cursor = await conn.execute(
                "INSERT INTO hints(attempt_id,quiz_id,question_id,prompt,prompt_hash,hint_text,ai_request_id,created_at) VALUES (?,?,?,?,?,?,?,?)",
                (
                    target["attempt_id"],
                    quiz_id,
                    target["question_id"],
                    prompt,
                    hashlib.sha256(prompt.encode()).hexdigest(),
                    output["hint"],
                    task["id"],
                    now,
                ),
            )
            return {
                "id": cursor.lastrowid,
                "question_id": target["question_id"],
                "hint": output["hint"],
                "ai_request_id": task["id"],
            }
        metrics = json.loads(task["input_json"])["metrics"]
        await conn.execute(
            "INSERT INTO quiz_summaries(quiz_id,requested_by,metrics_json,summary_json,ai_request_id,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(quiz_id) DO UPDATE SET requested_by=excluded.requested_by,metrics_json=excluded.metrics_json,summary_json=excluded.summary_json,ai_request_id=excluded.ai_request_id,created_at=excluded.created_at",
            (quiz_id, task["actor_id"], json.dumps(metrics), json.dumps(output), task["id"], now),
        )
        return {
            "quiz_id": quiz_id,
            "metrics": metrics,
            "summary": output,
            "ai_request_id": task["id"],
            "created_at": now,
        }

    async def terminal(
        self,
        conn: aiosqlite.Connection,
        task: dict[str, Any],
        target: dict[str, Any],
        status: str,
        response: dict[str, Any],
        http_status: int,
        error_code: str | None,
        usage: dict[str, Any],
        provider_status: int | None,
        now: str,
    ) -> None:
        version = target["version"] + 1
        cursor = await conn.execute(
            "UPDATE ai_requests SET status=?,state_version=?,response_json=?,http_status=?,error_code=?,finished_at=?,input_tokens=?,output_tokens=?,total_tokens=?,provider_status=? WHERE id=? AND status='running'",
            (
                status,
                version,
                json.dumps(response),
                http_status,
                error_code,
                now,
                usage.get("input_tokens"),
                usage.get("output_tokens"),
                usage.get("total_tokens"),
                provider_status,
                task["id"],
            ),
        )
        if cursor.rowcount != 1:
            raise AppError(409, "AI_REQUEST_IN_PROGRESS", "Task state changed before completion.")
        cursor = await conn.execute(
            "UPDATE ai_targets SET version=? WHERE id=? AND version=?",
            (version, target["id"], target["version"]),
        )
        if cursor.rowcount != 1:
            raise AppError(
                409, "AI_REQUEST_IN_PROGRESS", "Target version changed before completion."
            )
        target["version"] = version

    async def fail(self, task_id: str, error: AppError, result: AIResult | None = None) -> None:
        async with self.db.write() as conn:
            task = await one(conn, "SELECT * FROM ai_requests WHERE id=?", (task_id,))
            if not task or task["status"] != "running":
                return
            target = await one(conn, "SELECT * FROM ai_targets WHERE id=?", (task["target_id"],))
            assert target
            usage = result.usage if result else error.usage if isinstance(error, AIError) else {}
            provider_status = (
                result.provider_status
                if result
                else error.provider_status
                if isinstance(error, AIError)
                else None
            )
            await self.terminal(
                conn,
                task,
                target,
                "failed",
                error.envelope(),
                error.status,
                error.code,
                usage,
                provider_status,
                stamp(self.clock()),
            )
            envelope = await self.envelope(conn, target)
        self.events.publish(envelope)

    async def safe_fail(
        self, task_id: str, error: AppError, result: AIResult | None = None
    ) -> None:
        # Failure persistence lives outside the expired execution timeout and is shielded.
        job = asyncio.create_task(self.fail(task_id, error, result))
        self.cleanup.add(job)
        job.add_done_callback(self._cleanup_done)
        try:
            async with asyncio.timeout(7):
                await asyncio.shield(job)
        except TimeoutError, asyncio.CancelledError:
            # Strong reference remains until completion; startup covers a hard crash.
            pass

    async def interrupt_on_startup(self) -> None:
        async with self.db.read() as conn:
            tasks = await all_rows(conn, "SELECT id FROM ai_requests WHERE status='running'")
        for task in tasks:
            await self.fail(
                task["id"],
                AppError(
                    503,
                    "AI_REQUEST_INTERRUPTED",
                    "AI request was interrupted; explicitly retry when eligible.",
                ),
            )

    async def drain(self) -> None:
        while self.admissions or self.active or self.cleanup:
            pending = [*self.admissions, *self.active.values(), *self.cleanup]
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
            await asyncio.sleep(0)

    async def shutdown(self) -> None:
        self.accepting = False
        grace_deadline = (
            asyncio.get_running_loop().time() + self.core.settings.shutdown_grace_seconds
        )
        # Admissions may register work while settling. Finish/cancel them first,
        # then take a fresh worker snapshot so every accepted task is supervised.
        if self.admissions:
            _, remaining_admissions = await asyncio.wait(list(self.admissions), timeout=7)
            for admission in remaining_admissions:
                admission.cancel()
            if remaining_admissions:
                await asyncio.wait(remaining_admissions, timeout=7)
        if self.active:
            grace = max(0, grace_deadline - asyncio.get_running_loop().time())
            _, remaining = await asyncio.wait(list(self.active.values()), timeout=grace)
            for task in remaining:
                task.cancel()
            if remaining:
                await asyncio.wait(remaining, timeout=7)
        # Callback persistence is bounded; restart handles any remaining running rows.
        if self.cleanup:
            await asyncio.wait(list(self.cleanup), timeout=7)
        # Covers a cancellation between admission commit and registration.
        async with asyncio.timeout(7):
            await self.interrupt_on_startup()
