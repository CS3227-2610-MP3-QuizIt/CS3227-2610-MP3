import asyncio
import json
from typing import Any
from uuid import uuid4

import httpx
import pytest

import quiz_backend.tasks as task_module
from quiz_backend.ai import AIResult
from quiz_backend.db import all_rows, one
from quiz_backend.main import create_app

from .conftest import API, ORIGIN, Course, Harness, assert_error, quiz_output


async def test_untrusted_usage_integer_overflow_cannot_strand_a_task(course: Course) -> None:
    draft = await course.draft()
    harness = course.harness
    harness.gateway.responses.append(
        httpx.Response(
            200,
            json={
                "output_text": json.dumps(quiz_output()),
                "usage": {"input_tokens": 2**80, "output_tokens": 5, "total_tokens": 2**90},
            },
        )
    )
    response = await harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
    )
    assert response.status_code == 202
    await harness.drain()
    state = (await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")).json()
    assert state["status"] == "success"
    async with harness.app.state.db.read() as conn:
        usage = await one(
            conn,
            "SELECT input_tokens,output_tokens,total_tokens FROM ai_requests WHERE id=?",
            (state["task_id"],),
        )
    assert usage == {"input_tokens": None, "output_tokens": 5, "total_tokens": None}


async def test_concurrent_rolling_admission_limit_and_exact_boundary(course: Course) -> None:
    harness = course.harness
    drafts = [await course.draft(title=f"Target {index}") for index in range(35)]
    harness.gateway.blocked = True
    keys = [str(uuid4()) for _ in drafts]
    responses = await asyncio.gather(
        *[
            harness.ai_post(
                course.teacher,
                f"/quizzes/{draft['id']}/generate",
                {"expected_revision": 0},
                key=key,
            )
            for draft, key in zip(drafts, keys, strict=True)
        ]
    )
    accepted = [response for response in responses if response.status_code == 202]
    rejected = [response for response in responses if response.status_code == 429]
    assert len(accepted) == 30 and len(rejected) == 5
    assert len(harness.app.state.tasks.active) == 30
    for response in rejected:
        error = assert_error(response, 429, "AI_APP_RATE_LIMIT")
        assert error["retry_after_seconds"] == int(response.headers["retry-after"]) == 60
    async with harness.app.state.db.read() as conn:
        requests = await all_rows(conn, "SELECT id FROM ai_requests")
        bindings = await all_rows(conn, "SELECT idempotency_key FROM ai_operation_keys")
        targets = await all_rows(conn, "SELECT id FROM ai_targets")
    assert len(requests) == len(bindings) == len(targets) == 30
    rejected_index = next(
        index for index, response in enumerate(responses) if response.status_code == 429
    )
    rejected_draft, rejected_key = drafts[rejected_index], keys[rejected_index]
    latest = await course.teacher.get(f"{API}/quizzes/{rejected_draft['id']}/generation")
    assert latest.json()["status"] == "not_requested" and latest.json()["version"] == 0
    harness.gateway.release.set()
    await harness.drain()
    assert len(harness.gateway.calls) == 30
    accepted_index = next(
        index for index, response in enumerate(responses) if response.status_code == 202
    )
    ensured = await harness.ai_post(
        course.teacher,
        f"/quizzes/{drafts[accepted_index]['id']}/generate",
        {"expected_revision": 0},
    )
    assert ensured.status_code == 200
    replay = await harness.ai_post(
        course.teacher,
        f"/quizzes/{drafts[accepted_index]['id']}/generate",
        {"expected_revision": 0},
        key=keys[accepted_index],
    )
    assert replay.json()["task_id"] == ensured.json()["task_id"]
    assert len(harness.gateway.calls) == 30
    harness.clock.advance(1)
    response = await harness.ai_post(
        course.teacher,
        f"/quizzes/{rejected_draft['id']}/generate",
        {"expected_revision": 0},
        key=rejected_key,
    )
    assert_error(response, 429, "AI_APP_RATE_LIMIT")
    assert int(response.headers["retry-after"]) == 59
    harness.clock.advance(58.5)
    response = await harness.ai_post(
        course.teacher,
        f"/quizzes/{rejected_draft['id']}/generate",
        {"expected_revision": 0},
        key=rejected_key,
    )
    assert_error(response, 429, "AI_APP_RATE_LIMIT")
    assert int(response.headers["retry-after"]) == 1
    harness.clock.advance(0.5)
    response = await harness.ai_post(
        course.teacher,
        f"/quizzes/{rejected_draft['id']}/generate",
        {"expected_revision": 0},
        key=rejected_key,
    )
    assert response.status_code == 202, response.text
    await harness.drain()
    assert len(harness.gateway.calls) == 31


async def test_all_features_share_the_same_rolling_allowance(course: Course) -> None:
    harness = course.harness
    quiz = await course.published()
    attempt = await course.attempt(quiz)
    response = await harness.ai_post(
        course.students[0],
        f"/attempts/{attempt['id']}/questions/{quiz['questions'][0]['id']}/hints",
    )
    assert response.status_code == 202
    await harness.drain()
    await course.submit(quiz)
    await course.submit(quiz, index=1)
    response = await harness.ai_post(course.admin, f"/quizzes/{quiz['id']}/summary")
    assert response.status_code == 202
    await harness.drain()
    for index in range(27):
        draft = await course.draft(title=f"Shared quota {index}")
        response = await harness.ai_post(
            course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
        )
        assert response.status_code == 202
        await harness.drain()
    assert {call["model"] for call in harness.gateway.calls} == {
        "quiz-model",
        "hint-model",
        "summary-model",
    }
    assert len(harness.gateway.calls) == 30
    response = await harness.ai_post(
        course.admin, f"/quizzes/{quiz['id']}/summary", {"action": "new"}
    )
    assert_error(response, 429, "AI_APP_RATE_LIMIT")
    assert len(harness.gateway.calls) == 30


async def test_pre_start_cancellation_is_persisted_and_counted(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    draft = await course.draft()
    manager = course.harness.app.state.tasks
    register = manager.register

    def cancel_before_execution(task_id: str, admission_time: float) -> None:
        register(task_id, admission_time)
        manager.active[task_id].cancel()

    monkeypatch.setattr(manager, "register", cancel_before_execution)
    response = await course.harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
    )
    await course.harness.drain()
    state = (await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")).json()
    assert state["status"] == "failed"
    assert state["error"]["code"] == "AI_REQUEST_INTERRUPTED"
    assert state["version"] == 2
    assert not course.harness.gateway.calls
    async with course.harness.app.state.db.read() as conn:
        count = await one(conn, "SELECT COUNT(*) AS n FROM ai_requests")
    assert count == {"n": 1}
    assert response.json()["task_id"] == state["task_id"]


async def test_registration_failure_retains_key_and_admission(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    draft = await course.draft()
    key = str(uuid4())

    def fail_registration(task_id: str, admission_time: float) -> None:
        raise RuntimeError("simulated task creation failure")

    monkeypatch.setattr(course.harness.app.state.tasks, "register", fail_registration)
    response = await course.harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}, key=key
    )
    assert response.status_code == 200
    state = response.json()
    assert state["status"] == "failed" and state["error"]["code"] == "AI_REQUEST_INTERRUPTED"
    replay = await course.harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}, key=key
    )
    assert replay.json() == state
    assert not course.harness.gateway.calls
    async with course.harness.app.state.db.read() as conn:
        count = await one(conn, "SELECT COUNT(*) AS n FROM ai_requests")
        binding = await one(
            conn, "SELECT ai_request_id FROM ai_operation_keys WHERE idempotency_key=?", (key,)
        )
    assert count == {"n": 1} and binding == {"ai_request_id": state["task_id"]}


async def test_overall_timeout_is_terminal_and_late_output_cannot_apply(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    draft = await course.draft()
    harness = course.harness
    harness.gateway.blocked = True
    monkeypatch.setattr(task_module, "EXECUTION_SECONDS", 0.05)
    accepted = await harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
    )
    assert accepted.status_code == 202
    await asyncio.wait_for(harness.drain(), 5)
    state = (await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")).json()
    assert state["status"] == "failed" and state["error"]["code"] == "AI_TIMEOUT"
    assert state["error"]["http_status"] == 504
    harness.gateway.release.set()
    await harness.app.state.tasks.succeed(state["task_id"], AIResult(quiz_output(), {}, 200))
    latest = (await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")).json()
    assert latest == state
    current = (await course.teacher.get(f"{API}/quizzes/{draft['id']}")).json()
    assert current["revision"] == 0 and current["questions"] == []


async def test_unexpected_task_error_is_sanitized_and_terminal(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    draft = await course.draft()

    async def crash(snapshot: dict[str, Any]) -> Any:
        raise RuntimeError("private credentials and notes")

    monkeypatch.setattr(course.harness.app.state.ai, "generate_quiz", crash)
    accepted = await course.harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
    )
    assert accepted.status_code == 202
    await course.harness.drain()
    response = await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")
    assert response.json()["status"] == "failed"
    assert "private credentials" not in response.text


async def test_duplicate_success_cannot_apply_twice(course: Course) -> None:
    quiz = await course.generated()
    state = (await course.teacher.get(f"{API}/quizzes/{quiz['id']}/generation")).json()
    await course.harness.app.state.tasks.succeed(state["task_id"], AIResult(quiz_output(), {}, 200))
    current = (await course.teacher.get(f"{API}/quizzes/{quiz['id']}")).json()
    assert current["revision"] == 1 and current["questions"] == quiz["questions"]
    assert (await course.teacher.get(f"{API}/quizzes/{quiz['id']}/generation")).json() == state


async def test_deadline_expiring_during_apply_rolls_back_result_and_retains_usage(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    quiz = await course.generated()
    harness = course.harness
    manager = harness.app.state.tasks
    original_apply = manager.apply

    async def expire_during_apply(*args: Any, **kwargs: Any) -> dict[str, Any]:
        result = await original_apply(*args, **kwargs)
        harness.clock.advance(task_module.EXECUTION_SECONDS + 1)
        return result

    harness.gateway.output(quiz_output())
    monkeypatch.setattr(manager, "apply", expire_during_apply)
    response = await harness.ai_post(
        course.teacher, f"/quizzes/{quiz['id']}/generate", {"expected_revision": 1, "action": "new"}
    )
    assert response.status_code == 202
    await harness.drain()
    state = (await course.teacher.get(f"{API}/quizzes/{quiz['id']}/generation")).json()
    assert state["status"] == "failed" and state["error"]["code"] == "AI_TIMEOUT"
    current = (await course.teacher.get(f"{API}/quizzes/{quiz['id']}")).json()
    assert current["revision"] == 1 and current["questions"] == quiz["questions"]
    async with harness.app.state.db.read() as conn:
        usage = await one(
            conn,
            "SELECT input_tokens,output_tokens,total_tokens FROM ai_requests WHERE id=?",
            (state["task_id"],),
        )
    assert usage == {"input_tokens": 20, "output_tokens": 30, "total_tokens": 50}


async def test_cancelled_browser_handler_does_not_cancel_accepted_work(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    draft = await course.draft()
    harness = course.harness
    manager = harness.app.state.tasks
    original = manager._commit_admission
    committed = asyncio.Event()
    release_handler = asyncio.Event()

    async def hold_after_admission(*args: Any, **kwargs: Any) -> dict[str, Any]:
        result = await original(*args, **kwargs)
        committed.set()
        await release_handler.wait()
        return result

    monkeypatch.setattr(manager, "_commit_admission", hold_after_admission)
    browser = asyncio.create_task(
        harness.ai_post(
            course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
        )
    )
    await asyncio.wait_for(committed.wait(), 5)
    browser.cancel()
    with pytest.raises(asyncio.CancelledError):
        await browser
    release_handler.set()
    await asyncio.wait_for(harness.drain(), 5)
    state = (await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")).json()
    assert state["status"] == "success"
    assert len(harness.gateway.calls) == 1


async def test_restart_interrupts_running_records_without_replay_and_keeps_rate(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    harness = course.harness
    # Simulate a crash after committed admission but before coroutine creation.
    monkeypatch.setattr(harness.app.state.tasks, "register", lambda task_id, admission_time: None)
    drafts = [await course.draft(title=f"Crash target {index}") for index in range(31)]
    admitted = []
    for draft in drafts[:30]:
        response = await harness.ai_post(
            course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
        )
        assert response.status_code == 202
        admitted.append(response.json())
    assert not harness.gateway.calls
    app = create_app(
        harness.settings, transport=httpx.MockTransport(harness.gateway.handle), clock=harness.clock
    )
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            headers={"Origin": ORIGIN},
        ) as client:
            client.cookies.update(course.teacher.cookies)
            state = await client.get(f"{API}/quizzes/{drafts[0]['id']}/generation")
            assert state.json()["status"] == "failed"
            assert state.json()["error"]["code"] == "AI_REQUEST_INTERRUPTED"
            assert state.json()["version"] == admitted[0]["version"] + 1
            rejected = await client.post(
                f"{API}/quizzes/{drafts[30]['id']}/generate",
                json={"expected_revision": 0},
                headers={"Idempotency-Key": str(uuid4())},
            )
            assert_error(rejected, 429, "AI_APP_RATE_LIMIT")
            assert int(rejected.headers["retry-after"]) == 60
            async with app.state.db.read() as conn:
                tasks = await all_rows(conn, "SELECT status FROM ai_requests")
            assert len(tasks) == 30 and all(task["status"] == "failed" for task in tasks)
            assert not app.state.tasks.active and not harness.gateway.calls


async def test_restart_preserves_successful_results_and_session(course: Course) -> None:
    quiz = await course.generated()
    harness = course.harness
    old = (await course.teacher.get(f"{API}/quizzes/{quiz['id']}/generation")).json()
    app = create_app(
        harness.settings, transport=httpx.MockTransport(harness.gateway.handle), clock=harness.clock
    )
    async with (
        app.router.lifespan_context(app),
        httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            cookies=course.teacher.cookies,
        ) as client,
    ):
        response = await client.get(f"{API}/quizzes/{quiz['id']}/generation")
        assert response.status_code == 200 and response.json() == old
        current = (await client.get(f"{API}/quizzes/{quiz['id']}")).json()
        assert current["revision"] == 1 and current["questions"] == quiz["questions"]
    assert len(harness.gateway.calls) == 1


async def test_shutdown_drains_tasks_registered_by_an_inflight_admission(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    manager = harness.app.state.tasks
    blocked = asyncio.Event()
    shutdown_started = asyncio.Event()
    original_wait = asyncio.wait

    async def notify_shutdown_wait(*args: Any, **kwargs: Any) -> Any:
        shutdown_started.set()
        return await original_wait(*args, **kwargs)

    async def indefinitely_running(task_id: str, admission_time: float) -> None:
        await blocked.wait()

    async def final_admission() -> dict[str, Any]:
        await shutdown_started.wait()
        manager.register("newly-registered", asyncio.get_running_loop().time())
        return {}

    monkeypatch.setattr(manager, "run", indefinitely_running)
    monkeypatch.setattr(task_module.asyncio, "wait", notify_shutdown_wait)
    admission = asyncio.create_task(final_admission())
    manager.admissions.add(admission)
    admission.add_done_callback(manager._admission_done)
    await asyncio.wait_for(manager.shutdown(), 5)
    assert not manager.active
    assert not manager.admissions
    await manager.drain()
