import asyncio
from pathlib import Path
from uuid import uuid4

import httpx
import pytest

from quiz_backend.db import all_rows, one
from quiz_backend.main import create_app

from .conftest import API, PASSWORD, Course, assert_error, docx_bytes


async def note_path(course: Course) -> Path:
    async with course.harness.app.state.db.read() as conn:
        note = await one(conn, "SELECT storage_key FROM notes WHERE id=?", (course.note_id,))
    assert note is not None
    return course.harness.settings.storage_path / note["storage_key"]


@pytest.mark.parametrize("generated", [False, True])
async def test_delete_draft_cascades_and_preserves_ai_history(
    course: Course, generated: bool
) -> None:
    quiz = await course.generated() if generated else await course.draft()
    path = await note_path(course)
    async with course.harness.app.state.db.read() as conn:
        requests = await all_rows(conn, "SELECT * FROM ai_requests")
        bindings = await all_rows(conn, "SELECT * FROM ai_operation_keys")
    response = await course.teacher.delete(f"{API}/quizzes/{quiz['id']}")
    assert response.status_code == 204, response.text
    assert response.content == b""
    assert not path.exists()
    async with course.harness.app.state.db.read() as conn:
        assert await one(conn, "SELECT id FROM quizzes WHERE id=?", (quiz["id"],)) is None
        assert not await all_rows(
            conn, "SELECT id FROM quiz_questions WHERE quiz_id=?", (quiz["id"],)
        )
        assert await one(conn, "SELECT id FROM notes WHERE id=?", (course.note_id,)) is None
        assert await all_rows(conn, "SELECT * FROM ai_requests") == requests
        assert await all_rows(conn, "SELECT * FROM ai_operation_keys") == bindings
        assert not await all_rows(conn, "PRAGMA foreign_key_check")
        if generated:
            target = await one(conn, "SELECT quiz_id FROM ai_targets")
            assert target is not None and target["quiz_id"] is None
    for suffix in ["", "/generation"]:
        assert (await course.teacher.get(f"{API}/quizzes/{quiz['id']}{suffix}")).status_code == 404
    if generated:
        assert (await course.teacher.get(f"{API}/ai/tasks/{requests[0]['id']}")).status_code == 404
        replay = await course.harness.ai_post(
            course.teacher,
            f"/quizzes/{quiz['id']}/generate",
            {"expected_revision": 0},
            key=bindings[0]["idempotency_key"],
        )
        assert replay.status_code == 404
    assert (await course.teacher.delete(f"{API}/quizzes/{quiz['id']}")).status_code == 404
    assert (await course.teacher.get(f"{API}/quizzes")).json()["items"] == []


async def test_shared_note_survives_until_last_quiz_is_deleted(course: Course) -> None:
    first, second = await course.generated(), await course.draft()
    path = await note_path(course)
    assert (await course.teacher.delete(f"{API}/quizzes/{first['id']}")).status_code == 204
    assert path.exists()
    assert (await course.teacher.get(f"{API}/quizzes/{second['id']}")).status_code == 200
    # The remaining quiz can still generate using the shared source.
    response = await course.harness.ai_post(
        course.teacher, f"/quizzes/{second['id']}/generate", {"expected_revision": 0}
    )
    assert response.status_code == 202
    await course.harness.drain()
    assert (await course.teacher.delete(f"{API}/quizzes/{second['id']}")).status_code == 204
    assert not path.exists()


@pytest.mark.parametrize("running", [False, True])
async def test_shared_note_survives_published_or_running_other_quiz(
    course: Course, running: bool
) -> None:
    draft = await course.draft()
    path = await note_path(course)
    if running:
        other = await course.draft()
        course.harness.gateway.blocked = True
        accepted = await course.harness.ai_post(
            course.teacher, f"/quizzes/{other['id']}/generate", {"expected_revision": 0}
        )
        assert accepted.status_code == 202
    else:
        other = await course.published()
    assert (await course.teacher.delete(f"{API}/quizzes/{draft['id']}")).status_code == 204
    assert path.exists()
    assert (await course.teacher.get(f"{API}/quizzes/{other['id']}")).status_code == 200
    if running:
        course.harness.gateway.release.set()
        await course.harness.drain()
        state = (await course.teacher.get(f"{API}/quizzes/{other['id']}/generation")).json()
        assert state["status"] == "success"


async def test_published_quiz_rejects_deletion_without_changes(course: Course) -> None:
    quiz = await course.published()
    path = await note_path(course)
    assert_error(await course.teacher.delete(f"{API}/quizzes/{quiz['id']}"), 409, "QUIZ_PUBLISHED")
    assert path.exists()
    async with course.harness.app.state.db.read() as conn:
        assert (
            len(
                await all_rows(conn, "SELECT id FROM quiz_questions WHERE quiz_id=?", (quiz["id"],))
            )
            == 2
        )
        assert (
            len(await all_rows(conn, "SELECT id FROM quiz_attempts WHERE quiz_id=?", (quiz["id"],)))
            == 2
        )


async def test_running_generation_blocks_deletion_then_failed_draft_can_be_deleted(
    course: Course,
) -> None:
    quiz = await course.draft()
    gateway = course.harness.gateway
    gateway.blocked = True
    gateway.failure(503)
    accepted = await course.harness.ai_post(
        course.teacher, f"/quizzes/{quiz['id']}/generate", {"expected_revision": 0}
    )
    assert accepted.status_code == 202
    await asyncio.wait_for(gateway.entered.wait(), 2)
    assert_error(
        await course.teacher.delete(f"{API}/quizzes/{quiz['id']}"), 409, "AI_REQUEST_IN_PROGRESS"
    )
    assert (await note_path(course)).exists()
    gateway.release.set()
    await course.harness.drain()
    state = (await course.teacher.get(f"{API}/quizzes/{quiz['id']}/generation")).json()
    assert state["status"] == "failed"
    assert (await course.teacher.delete(f"{API}/quizzes/{quiz['id']}")).status_code == 204


async def test_deletion_authorization_and_origin(course: Course) -> None:
    quiz = await course.draft()
    url = f"{API}/quizzes/{quiz['id']}"
    assert (await course.harness.client().delete(url)).status_code == 401
    for client in [course.admin, *course.students]:
        assert_error(await client.delete(url), 403, "FORBIDDEN_ROLE")
    assert_error(
        await course.teacher.delete(url, headers={"Origin": "https://evil.example"}),
        403,
        "INVALID_ORIGIN",
    )
    account = await course.admin.post(
        f"{API}/users",
        json={
            "username": "other-teacher",
            "display_name": "Other",
            "role": "teacher",
            "password": PASSWORD,
        },
    )
    assert account.status_code == 201
    await course.admin.put(f"{API}/classes/{course.class_id}/members/{account.json()['id']}")
    other = await course.harness.login("other-teacher")
    assert (await other.delete(url)).status_code == 404
    await course.admin.delete(f"{API}/classes/{course.class_id}/members/{course.teacher_id}")
    assert (await course.teacher.delete(url)).status_code == 404
    assert (await note_path(course)).exists()


async def test_delete_and_generation_admission_serialize(course: Course) -> None:
    quiz = await course.draft()
    course.harness.gateway.blocked = True
    deletion, generation = await asyncio.gather(
        course.teacher.delete(f"{API}/quizzes/{quiz['id']}"),
        course.harness.ai_post(
            course.teacher, f"/quizzes/{quiz['id']}/generate", {"expected_revision": 0}
        ),
    )
    assert (deletion.status_code, generation.status_code) in [(204, 404), (409, 202)]
    if deletion.status_code == 409:
        assert_error(deletion, 409, "AI_REQUEST_IN_PROGRESS")
    else:
        assert not course.harness.gateway.calls
    course.harness.gateway.release.set()
    await course.harness.drain()
    async with course.harness.app.state.db.read() as conn:
        assert not await all_rows(conn, "PRAGMA foreign_key_check")


async def test_delete_and_publication_serialize(course: Course) -> None:
    quiz = await course.generated()
    deletion, publication = await asyncio.gather(
        course.teacher.delete(f"{API}/quizzes/{quiz['id']}"),
        course.teacher.post(f"{API}/quizzes/{quiz['id']}/publish", json={"expected_revision": 1}),
    )
    assert (deletion.status_code, publication.status_code) in [(204, 404), (409, 200)]
    if deletion.status_code == 409:
        assert_error(deletion, 409, "QUIZ_PUBLISHED")
    async with course.harness.app.state.db.read() as conn:
        attempts = await all_rows(
            conn, "SELECT id FROM quiz_attempts WHERE quiz_id=?", (quiz["id"],)
        )
        assert len(attempts) == (2 if publication.status_code == 200 else 0)
        assert not await all_rows(conn, "PRAGMA foreign_key_check")


async def test_delete_and_shared_note_reference_serialize(course: Course) -> None:
    quiz = await course.draft()
    path = await note_path(course)
    deletion, creation = await asyncio.gather(
        course.teacher.delete(f"{API}/quizzes/{quiz['id']}"),
        course.teacher.post(
            f"{API}/quizzes",
            json={"class_id": course.class_id, "note_id": course.note_id, "title": "Second quiz"},
        ),
    )
    assert deletion.status_code == 204
    assert creation.status_code in [201, 404]
    assert path.exists() == (creation.status_code == 201)
    async with course.harness.app.state.db.read() as conn:
        assert not await all_rows(conn, "PRAGMA foreign_key_check")


async def test_deleted_quiz_and_note_ids_are_not_reused(course: Course) -> None:
    quiz = await course.draft()
    assert (await course.teacher.delete(f"{API}/quizzes/{quiz['id']}")).status_code == 204
    upload = await course.teacher.post(
        f"{API}/classes/{course.class_id}/notes", files={"file": ("new.docx", docx_bytes())}
    )
    assert upload.status_code == 201
    assert upload.json()["id"] > course.note_id
    course.note_id = upload.json()["id"]
    new_quiz = await course.draft()
    assert new_quiz["id"] > quiz["id"]


async def test_deletion_does_not_refund_ai_admissions(course: Course) -> None:
    quizzes = []
    for _ in range(30):
        quiz = await course.draft()
        quizzes.append(quiz)
        accepted = await course.harness.ai_post(
            course.teacher, f"/quizzes/{quiz['id']}/generate", {"expected_revision": 0}
        )
        assert accepted.status_code == 202
    await course.harness.drain()
    assert (await course.teacher.delete(f"{API}/quizzes/{quizzes[0]['id']}")).status_code == 204
    extra = await course.draft()
    response = await course.harness.ai_post(
        course.teacher, f"/quizzes/{extra['id']}/generate", {"expected_revision": 0}
    )
    assert_error(response, 429, "AI_APP_RATE_LIMIT")
    assert len(course.harness.gateway.calls) == 30


async def test_file_cleanup_failure_and_startup_recovery(
    course: Course, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    quiz = await course.draft()
    path = await note_path(course)

    def fail_unlink(self: Path, *, missing_ok: bool = False) -> None:
        raise OSError("private file path or note content")

    with monkeypatch.context() as patch:
        patch.setattr(Path, "unlink", fail_unlink)
        assert (await course.teacher.delete(f"{API}/quizzes/{quiz['id']}")).status_code == 204
    assert "startup will retry" in caplog.text
    assert "private file path or note content" not in caplog.text
    assert path.exists()
    # Uploaded notes without a quiz remain valid; unrelated files are untouched.
    upload = await course.teacher.post(
        f"{API}/classes/{course.class_id}/notes", files={"file": ("retained.docx", docx_bytes())}
    )
    course.note_id = upload.json()["id"]
    retained = await note_path(course)
    unrelated = path.parent / "operator.txt"
    unrelated.write_text("keep")
    orphan = path.parent / f"{uuid4().hex}.docx"
    orphan.write_bytes(b"orphan")
    restarted = create_app(
        course.harness.settings,
        transport=httpx.MockTransport(course.harness.gateway.handle),
        clock=course.harness.clock,
    )
    async with restarted.router.lifespan_context(restarted):
        assert not path.exists() and not orphan.exists()
        assert retained.exists() and unrelated.exists()


async def test_disconnect_does_not_cancel_delete_cleanup(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    quiz = await course.draft()
    core = course.harness.app.state.core
    path = await note_path(course)
    entered, release = asyncio.Event(), asyncio.Event()
    cleanup = core.remove_note_file

    async def paused_cleanup(key: str) -> None:
        entered.set()
        await release.wait()
        await cleanup(key)

    monkeypatch.setattr(core, "remove_note_file", paused_cleanup)
    async with core.db.read() as conn:
        user = await one(conn, "SELECT * FROM users WHERE id=?", (course.teacher_id,))
    assert user is not None
    caller = asyncio.create_task(core.delete_quiz(user, quiz["id"]))
    await asyncio.wait_for(entered.wait(), 2)
    caller.cancel()
    with pytest.raises(asyncio.CancelledError):
        await caller
    assert path.exists()
    release.set()
    await core.drain_deletions()
    assert not path.exists()
