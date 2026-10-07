import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any, cast

import pytest
from starlette.requests import Request

from quiz_backend.events import EventHub
from quiz_backend.tasks_api import event_stream

from .conftest import API, Course, Harness


def stream_request(harness: Harness, token: str) -> Request:
    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": f"{API}/ai/events",
            "query_string": b"",
            "headers": [(b"cookie", f"{harness.settings.session_cookie}={token}".encode())],
            "app": harness.app,
            "scheme": "http",
            "server": ("test", 80),
        },
        receive=receive,
    )


async def test_sse_notification_only_metadata_and_committed_versions(course: Course) -> None:
    harness = course.harness
    draft = await course.draft()
    token = course.teacher.cookies[harness.settings.session_cookie]
    stream = cast(AsyncGenerator[str], event_stream(stream_request(harness, token)))
    assert await anext(stream) == ": connected\n\n"
    notification = asyncio.ensure_future(anext(stream))
    response = await harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
    )
    event = await asyncio.wait_for(notification, 5)
    assert event.startswith("event: ai_state_changed\ndata: ")
    metadata = json.loads(event.split("data: ", 1)[1])
    assert set(metadata) == {
        "target_id",
        "feature",
        "quiz_id",
        "attempt_id",
        "question_id",
        "task_id",
        "version",
    }
    assert metadata["task_id"] == response.json()["task_id"]
    state = (await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")).json()
    assert state["version"] >= metadata["version"]
    assert state["task_id"] == metadata["task_id"]
    await stream.aclose()
    assert not harness.app.state.tasks.events.subscribers


async def test_sse_revoked_session_closes_on_next_notification(course: Course) -> None:
    harness = course.harness
    draft = await course.draft()
    stream = cast(
        AsyncGenerator[str],
        event_stream(
            stream_request(harness, course.teacher.cookies[harness.settings.session_cookie])
        ),
    )
    await anext(stream)
    await course.teacher.post(f"{API}/auth/logout")
    harness.app.state.tasks.events.publish(
        {
            "target_id": 999,
            "feature": "quiz_generation",
            "quiz_id": draft["id"],
            "attempt_id": None,
            "question_id": None,
            "task_id": "inaccessible",
            "version": 1,
        }
    )
    try:
        await asyncio.wait_for(anext(stream), 5)
        raise AssertionError("Revoked sessions must close their SSE stream")
    except StopAsyncIteration:
        pass
    assert not harness.app.state.tasks.events.subscribers


async def test_sse_idle_session_expiry_closes_stream(harness: Harness) -> None:
    client = await harness.login()
    stream = cast(
        AsyncGenerator[str],
        event_stream(stream_request(harness, client.cookies[harness.settings.session_cookie])),
    )
    await anext(stream)
    harness.clock.advance(8 * 60 * 60)
    try:
        await asyncio.wait_for(anext(stream), 5)
        raise AssertionError("Expired sessions must close idle SSE streams")
    except StopAsyncIteration:
        pass


async def test_sse_filters_unauthorized_target_events(course: Course) -> None:
    harness = course.harness
    quiz = await course.published()
    attempt = await course.attempt(quiz)
    teacher_token = course.teacher.cookies[harness.settings.session_cookie]
    stream = cast(AsyncGenerator[str], event_stream(stream_request(harness, teacher_token)))
    await anext(stream)
    draft = await course.draft()
    notification = asyncio.ensure_future(anext(stream))
    await harness.ai_post(
        course.students[0],
        f"/attempts/{attempt['id']}/questions/{quiz['questions'][0]['id']}/hints",
    )
    response = await harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
    )
    event = await asyncio.wait_for(notification, 5)
    metadata = json.loads(event.split("data: ", 1)[1])
    assert metadata["feature"] == "quiz_generation"
    assert metadata["task_id"] == response.json()["task_id"]
    await stream.aclose()


async def test_sse_expiry_is_rechecked_while_waiting_for_idle_heartbeat(
    harness: Harness, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = await harness.login()
    harness.settings.sse_heartbeat_seconds = 0.01
    authenticated = asyncio.Event()
    original = harness.app.state.core.authenticate

    async def observe_authentication(token: str | None) -> dict[str, Any]:
        user = await original(token)
        authenticated.set()
        return user

    monkeypatch.setattr(harness.app.state.core, "authenticate", observe_authentication)
    stream = cast(
        AsyncGenerator[str],
        event_stream(stream_request(harness, client.cookies[harness.settings.session_cookie])),
    )
    await anext(stream)
    pending = asyncio.ensure_future(anext(stream))
    await asyncio.wait_for(authenticated.wait(), 5)
    harness.clock.advance(8 * 60 * 60)
    with pytest.raises(StopAsyncIteration):
        await asyncio.wait_for(pending, 5)
    assert not harness.app.state.tasks.events.subscribers


async def test_sse_membership_revocation_filters_already_buffered_events(course: Course) -> None:
    harness = course.harness
    harness.settings.sse_heartbeat_seconds = 0.01
    draft = await course.draft()
    stream = cast(
        AsyncGenerator[str],
        event_stream(
            stream_request(harness, course.teacher.cookies[harness.settings.session_cookie])
        ),
    )
    await anext(stream)
    response = await harness.ai_post(
        course.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
    )
    assert response.status_code == 202
    await harness.drain()
    await course.admin.delete(f"{API}/classes/{course.class_id}/members/{course.teacher_id}")
    assert await asyncio.wait_for(anext(stream), 5) == ": heartbeat\n\n"
    assert (await course.teacher.get(f"{API}/quizzes/{draft['id']}/generation")).status_code == 404
    await stream.aclose()


async def test_bounded_notification_buffers_retain_latest_metadata() -> None:
    hub = EventHub()
    async with hub.subscribe() as queue:
        for version in range(100):
            hub.publish(
                {
                    "target_id": 1,
                    "feature": "hint",
                    "quiz_id": 1,
                    "attempt_id": 2,
                    "question_id": 3,
                    "task_id": "task",
                    "version": version,
                    "status": "failed",
                    "error": {"message": "private"},
                    "result": {"hint": "private"},
                }
            )
        assert queue.qsize() == queue.maxsize == 64
        events = [queue.get_nowait() for _ in range(queue.qsize())]
        assert events[0]["version"] == 36 and events[-1]["version"] == 99
        assert all(
            "status" not in event and "error" not in event and "result" not in event
            for event in events
        )
    assert not hub.subscribers
