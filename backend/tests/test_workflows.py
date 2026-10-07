import asyncio
import hashlib
from typing import Any

import pytest

from quiz_backend.db import all_rows, one

from .conftest import API, PASSWORD, Course, Harness, assert_error, assert_no_answers


async def test_complete_workflow_frozen_roster_and_anonymous_summary(course: Course) -> None:
    harness = course.harness
    quiz = await course.published()
    quiz_id = quiz["id"]
    publication = await course.teacher.post(
        f"{API}/quizzes/{quiz_id}/publish", json={"expected_revision": 1}
    )
    assert publication.json()["assigned_student_count"] == 2
    await course.admin.delete(f"{API}/classes/{course.class_id}/members/{course.student_ids[1]}")
    completion = await course.admin.get(f"{API}/quizzes/{quiz_id}/completion")
    assert completion.json()["assigned_count"] == 2
    rejected = await harness.ai_post(course.admin, f"/quizzes/{quiz_id}/summary")
    assert_error(rejected, 409, "QUIZ_INCOMPLETE")
    assert len(harness.gateway.calls) == 1
    first = await course.submit(quiz, choice="B")
    second = await course.submit(quiz, index=1, choice="A")
    assert first["score"] == 2
    assert second["score"] == 0
    completion = await course.admin.get(f"{API}/quizzes/{quiz_id}/completion")
    assert completion.json()["summary_eligible"] is True
    response = await harness.ai_post(course.admin, f"/quizzes/{quiz_id}/summary")
    assert response.status_code == 202
    await harness.drain()
    response = await course.admin.get(f"{API}/quizzes/{quiz_id}/summary")
    state = response.json()
    assert state["status"] == "success", response.text
    metrics = state["result"]["metrics"]
    assert metrics["assigned_count"] == metrics["submitted_count"] == 2
    assert metrics["question_count"] == 2
    assert metrics["average_score"] == 1
    assert metrics["average_score_percent"] == 50
    assert metrics["min_score"] == 0
    assert metrics["max_score"] == 2
    for item in metrics["questions"]:
        assert item["correct_count"] == item["incorrect_count"] == 1
        assert item["correct_percent"] == 50
        assert sum(item["option_counts"].values()) == 2
    summary_payload = harness.gateway.calls[-1]
    assert summary_payload["model"] == "summary-model"
    for private in ["student-one", "student-two", "student_id", "attempt_id", "password_hash"]:
        assert private not in str(summary_payload)
    ensured = await harness.ai_post(course.admin, f"/quizzes/{quiz_id}/summary")
    assert ensured.status_code == 200
    assert ensured.json()["task_id"] == state["task_id"]
    assert len(harness.gateway.calls) == 2


async def test_auth_session_password_and_token_storage(harness: Harness) -> None:
    anonymous = harness.client()
    assert_error(await anonymous.get(f"{API}/auth/me"), 401, "AUTH_REQUIRED")
    bad = await anonymous.post(
        f"{API}/auth/login", json={"username": "admin", "password": "wrong-password"}
    )
    assert_error(bad, 401, "INVALID_CREDENTIALS")
    client = await harness.login()
    response = await client.get(f"{API}/auth/me")
    assert response.status_code == 200
    assert set(response.json()) == {"id", "username", "display_name", "role"}
    token = client.cookies[harness.settings.session_cookie]
    async with harness.app.state.db.read() as conn:
        user = await one(conn, "SELECT * FROM users WHERE username='admin'")
        session = await one(conn, "SELECT * FROM sessions")
    assert user is not None and session is not None
    assert user["password_hash"].startswith("$argon2id$")
    assert PASSWORD not in user["password_hash"]
    assert session["token_hash"] == hashlib.sha256(token.encode()).hexdigest()
    assert session["token_hash"] != token
    logout = await client.post(f"{API}/auth/logout")
    assert logout.status_code == 204
    client.cookies.set(harness.settings.session_cookie, token, domain="test.local", path=API)
    assert (await client.get(f"{API}/auth/me")).status_code == 401


async def test_eight_hour_session_expiry(harness: Harness) -> None:
    client = await harness.login()
    harness.clock.advance(8 * 60 * 60)
    assert (await client.get(f"{API}/auth/me")).status_code == 401


async def test_failed_login_rate_limit_and_window(harness: Harness) -> None:
    client = harness.client()
    for _ in range(5):
        response = await client.post(
            f"{API}/auth/login", json={"username": "missing-user", "password": PASSWORD}
        )
        assert response.status_code == 401
    response = await client.post(
        f"{API}/auth/login", json={"username": "missing-user", "password": PASSWORD}
    )
    error = assert_error(response, 429, "LOGIN_RATE_LIMIT")
    assert int(response.headers["retry-after"]) == error["retry_after_seconds"]
    harness.clock.advance(300)
    response = await client.post(
        f"{API}/auth/login", json={"username": "missing-user", "password": PASSWORD}
    )
    assert response.status_code == 401


@pytest.mark.parametrize("origin", [None, "http://localhost:51730", "https://evil.example", "null"])
async def test_exact_origin_on_login(harness: Harness, origin: str | None) -> None:
    client = harness.client()
    client.headers.pop("origin")
    headers = {"Origin": origin} if origin is not None else {}
    response = await client.post(
        f"{API}/auth/login", json={"username": "admin", "password": PASSWORD}, headers=headers
    )
    assert_error(response, 403, "INVALID_ORIGIN")


async def test_cors_exact_origin_and_no_wildcard(harness: Harness) -> None:
    client = harness.client()
    response = await client.options(
        f"{API}/auth/login",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-credentials"] == "true"
    response = await client.options(
        f"{API}/auth/login",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in response.headers


async def test_account_uniqueness_roles_and_membership_idempotency(course: Course) -> None:
    response = await course.admin.post(
        f"{API}/users",
        json={
            "username": "TEACHER",
            "display_name": "Duplicate",
            "password": PASSWORD,
            "role": "teacher",
        },
    )
    assert_error(response, 409, "USERNAME_EXISTS")
    for client in [course.teacher, *course.students]:
        assert_error(await client.get(f"{API}/users"), 403, "FORBIDDEN_ROLE")
        assert_error(
            await client.put(f"{API}/classes/{course.class_id}/members/{course.teacher_id}"),
            403,
            "FORBIDDEN_ROLE",
        )
    assigned = await course.admin.put(
        f"{API}/classes/{course.class_id}/members/{course.teacher_id}"
    )
    assert assigned.status_code == 200
    members = (await course.admin.get(f"{API}/classes/{course.class_id}/members")).json()["items"]
    assert len(members) == 3
    assert len({member["id"] for member in members}) == 3


@pytest.mark.parametrize(
    "payload",
    [
        {"username": "abc", "display_name": "Name", "password": PASSWORD, "role": "admin"},
        {
            "username": "abc",
            "display_name": "Name",
            "password": PASSWORD,
            "role": "student",
            "owner_id": 1,
        },
        {"username": "bad name", "display_name": "Name", "password": PASSWORD, "role": "student"},
        {"username": "abc", "display_name": "Name", "password": "short", "role": "student"},
    ],
)
async def test_account_input_rejection(harness: Harness, payload: dict[str, Any]) -> None:
    admin = await harness.login()
    assert_error(await admin.post(f"{API}/users", json=payload), 422, "VALIDATION_ERROR")


async def test_drafts_hidden_and_answer_keys_only_after_submission(course: Course) -> None:
    draft = await course.generated()
    quiz_id = draft["id"]
    for client in [course.admin, *course.students]:
        assert (await client.get(f"{API}/quizzes/{quiz_id}")).status_code in {403, 404}
        listed = (await client.get(f"{API}/quizzes")).json()["items"]
        assert not any(item["id"] == quiz_id for item in listed)
    await course.teacher.post(f"{API}/quizzes/{quiz_id}/publish", json={"expected_revision": 1})
    student = course.students[0]
    assert_no_answers((await student.get(f"{API}/quizzes/{quiz_id}")).json())
    assert_no_answers((await student.get(f"{API}/quizzes")).json())
    attempt = await course.attempt(draft)
    assert_no_answers(attempt)
    assert_error(
        await student.get(f"{API}/attempts/{attempt['id']}/results"), 409, "ATTEMPT_NOT_SUBMITTED"
    )
    question = draft["questions"][0]
    response = await student.put(
        f"{API}/attempts/{attempt['id']}/answers/{question['id']}", json={"selected_option": "B"}
    )
    assert_no_answers(response.json())
    refreshed = (await student.get(f"{API}/attempts/{attempt['id']}")).json()
    assert_no_answers(refreshed)
    assert refreshed["answers"]
    await course.submit(draft)
    results = (await student.get(f"{API}/attempts/{attempt['id']}/results")).json()
    assert results["score"] == 2
    assert all(
        question["correct_option"] == "B" and question["is_correct"]
        for question in results["questions"]
    )
    assert_no_answers((await student.get(f"{API}/attempts/{attempt['id']}")).json())


async def test_attempt_ownership_incomplete_and_immutable_submission(course: Course) -> None:
    quiz = await course.published()
    attempt = await course.attempt(quiz)
    attempt_id = attempt["id"]
    assert_error(await course.students[1].get(f"{API}/attempts/{attempt_id}"), 404, "NOT_FOUND")
    assert_error(
        await course.students[0].post(f"{API}/attempts/{attempt_id}/submit", json={}),
        422,
        "ANSWERS_INCOMPLETE",
    )
    started_again = await course.attempt(quiz)
    assert started_again["id"] == attempt_id
    result = await course.submit(quiz)
    second = await course.students[0].post(f"{API}/attempts/{attempt_id}/submit", json={})
    assert second.json() == result
    changed = await course.students[0].put(
        f"{API}/attempts/{attempt_id}/answers/{quiz['questions'][0]['id']}",
        json={"selected_option": "A"},
    )
    assert_error(changed, 409, "ATTEMPT_SUBMITTED")


async def test_answer_submission_race_preserves_final_result(course: Course) -> None:
    quiz = await course.published()
    attempt = await course.attempt(quiz)
    student = course.students[0]
    for question in quiz["questions"]:
        await student.put(
            f"{API}/attempts/{attempt['id']}/answers/{question['id']}",
            json={"selected_option": "B"},
        )
    submitted, saved = await asyncio.gather(
        student.post(f"{API}/attempts/{attempt['id']}/submit", json={}),
        student.put(
            f"{API}/attempts/{attempt['id']}/answers/{quiz['questions'][0]['id']}",
            json={"selected_option": "A"},
        ),
    )
    assert submitted.status_code == 200
    assert saved.status_code in {200, 409}
    result = (await student.get(f"{API}/attempts/{attempt['id']}/results")).json()
    assert result["score"] == submitted.json()["score"]
    assert result["score"] == sum(item["is_correct"] for item in result["questions"])
    assert (
        await student.post(f"{API}/attempts/{attempt['id']}/submit", json={})
    ).json() == submitted.json()


async def test_cross_quiz_answers_and_teacher_ownership(course: Course) -> None:
    first = await course.published()
    second = await course.published()
    attempt = await course.attempt(first)
    response = await course.students[0].put(
        f"{API}/attempts/{attempt['id']}/answers/{second['questions'][0]['id']}",
        json={"selected_option": "B"},
    )
    assert_error(response, 404, "NOT_FOUND")
    response = await course.admin.post(
        f"{API}/users",
        json={
            "username": "other-teacher",
            "display_name": "Other teacher",
            "password": PASSWORD,
            "role": "teacher",
        },
    )
    other_id = response.json()["id"]
    await course.admin.put(f"{API}/classes/{course.class_id}/members/{other_id}")
    other = await course.harness.login("other-teacher")
    assert_error(await other.get(f"{API}/quizzes/{first['id']}"), 404, "NOT_FOUND")
    response = await other.post(
        f"{API}/quizzes",
        json={
            "class_id": course.class_id,
            "note_id": course.note_id,
            "title": "Stolen",
            "question_count": 2,
        },
    )
    assert_error(response, 404, "NOT_FOUND")


async def test_publication_requires_review_and_frozen_roster(course: Course) -> None:
    quiz = await course.generated()
    assert_error(
        await course.teacher.post(
            f"{API}/quizzes/{quiz['id']}/publish", json={"expected_revision": 0}
        ),
        409,
        "STALE_REVISION",
    )
    response = await course.teacher.post(
        f"{API}/quizzes/{quiz['id']}/publish", json={"expected_revision": 1}
    )
    assert response.status_code == 200
    published = response.json()
    await course.admin.delete(f"{API}/classes/{course.class_id}/members/{course.student_ids[0]}")
    repeated = await course.teacher.post(
        f"{API}/quizzes/{quiz['id']}/publish", json={"expected_revision": 1}
    )
    assert repeated.json() == published
    async with course.harness.app.state.db.read() as conn:
        attempts = await all_rows(
            conn, "SELECT student_id FROM quiz_attempts WHERE quiz_id=?", (quiz["id"],)
        )
    assert {item["student_id"] for item in attempts} == set(course.student_ids)


async def test_no_students_cannot_publish(course: Course) -> None:
    quiz = await course.generated()
    for student_id in course.student_ids:
        await course.admin.delete(f"{API}/classes/{course.class_id}/members/{student_id}")
    assert_error(
        await course.teacher.post(
            f"{API}/quizzes/{quiz['id']}/publish", json={"expected_revision": 1}
        ),
        409,
        "NO_STUDENTS",
    )


async def test_database_connections_have_security_pragmas(harness: Harness) -> None:
    async with harness.app.state.db.connection() as conn:
        foreign_keys = await one(conn, "PRAGMA foreign_keys")
        timeout = await one(conn, "PRAGMA busy_timeout")
        journal = await one(conn, "PRAGMA journal_mode")
    assert foreign_keys == {"foreign_keys": 1}
    assert timeout == {"timeout": 5000}
    assert journal == {"journal_mode": "wal"}
