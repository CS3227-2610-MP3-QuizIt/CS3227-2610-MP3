import asyncio
import io
import json
from collections import deque
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

import httpx
import pytest
from fastapi import FastAPI
from pydantic import SecretStr

from quiz_backend.config import Settings
from quiz_backend.core import Core
from quiz_backend.db import Database
from quiz_backend.main import create_app
from quiz_backend.time import stamp

PASSWORD = "correct-horse-battery-staple"
API = "/api/v1"
ORIGIN = "http://localhost:5173"
OPTIONS = {
    "A": "Last item is removed first",
    "B": "Earliest item is removed first",
    "C": "Items are selected randomly",
    "D": "Only the largest item is removed",
}


def quiz_output(count: int = 2) -> dict[str, Any]:
    return {
        "questions": [
            {
                "question": f"Which removal order follows FIFO, example {index + 1}?",
                "options": OPTIONS.copy(),
                "correct_option": "B",
                "explanation": "FIFO removes the earliest item first.",
            }
            for index in range(count)
        ]
    }


def docx_bytes(
    text: str = "Queue notes: FIFO preserves arrival order.", *, table: bool = False
) -> bytes:
    paragraph = f"<w:p><w:r><w:t>{escape(text)}</w:t></w:r></w:p>"
    if table:
        paragraph += "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table example</w:t></w:r></w:p></w:tc></w:tr></w:tbl>"
    document = f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{paragraph}</w:body></w:document>'
    stream = io.BytesIO()
    with ZipFile(stream, "w", ZIP_DEFLATED) as archive:
        archive.writestr(
            "[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
        )
        archive.writestr(
            "_rels/.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
        )
        archive.writestr("word/document.xml", document)
    return stream.getvalue()


@dataclass
class Clock:
    value: datetime = datetime(2026, 10, 7, 2, 59, 59, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += timedelta(seconds=seconds)


@dataclass
class Gateway:
    calls: list[dict[str, Any]] = field(default_factory=list)
    responses: deque[httpx.Response] = field(default_factory=deque)
    blocked: bool = False
    release: asyncio.Event = field(default_factory=asyncio.Event)
    entered: asyncio.Event = field(default_factory=asyncio.Event)

    def output(
        self, content: Any, *, status: int = 200, headers: dict[str, str] | None = None
    ) -> None:
        value = content if isinstance(content, str) else json.dumps(content)
        self.responses.append(
            httpx.Response(
                status,
                json={
                    "output_text": value,
                    "usage": {"input_tokens": 20, "output_tokens": 30, "total_tokens": 50},
                },
                headers=headers,
            )
        )

    def failure(self, status: int, headers: dict[str, str] | None = None) -> None:
        self.responses.append(
            httpx.Response(
                status,
                json={"error": {"message": "private upstream credential test-key"}},
                headers=headers,
            )
        )

    async def handle(self, request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/v1/responses"
        assert request.headers["authorization"] == "Bearer test-key"
        payload = json.loads(request.content)
        assert payload["stream"] is False
        assert set(payload) <= {"model", "instructions", "input", "stream", "max_output_tokens"}
        self.calls.append(payload)
        self.entered.set()
        if self.blocked:
            await self.release.wait()
        if self.responses:
            return self.responses.popleft()
        model = payload["model"]
        if model == "quiz-model":
            content = quiz_output()
        elif model == "hint-model":
            content = {"hint": "Think about how arrival order relates to removal order."}
        else:
            assert model == "summary-model"
            content = {
                "overview": "Students show varied understanding of FIFO.",
                "strengths": ["Arrival order"],
                "areas_to_review": ["Removal order"],
            }
        return httpx.Response(200, json={"output_text": json.dumps(content)})


@dataclass
class Harness:
    app: FastAPI
    settings: Settings
    clock: Clock
    gateway: Gateway
    clients: list[httpx.AsyncClient] = field(default_factory=list)

    def client(self) -> httpx.AsyncClient:
        client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app),
            base_url="http://test",
            headers={"Origin": ORIGIN},
        )
        self.clients.append(client)
        return client

    async def login(self, username: str = "admin") -> httpx.AsyncClient:
        client = self.client()
        response = await client.post(
            f"{API}/auth/login", json={"username": username, "password": PASSWORD}
        )
        assert response.status_code == 200, response.text
        return client

    async def drain(self) -> None:
        await self.app.state.tasks.drain()

    async def ai_post(
        self,
        client: httpx.AsyncClient,
        path: str,
        body: dict[str, Any] | None = None,
        *,
        key: str | None = None,
    ) -> httpx.Response:
        return await client.post(
            f"{API}{path}", json=body or {}, headers={"Idempotency-Key": key or str(uuid4())}
        )


@pytest.fixture
async def harness(tmp_path: Any) -> AsyncIterator[Harness]:
    env_options: dict[str, Any] = {"_env_file": None}
    settings = Settings(
        **env_options,
        database_path=tmp_path / "quiz.sqlite3",
        storage_path=tmp_path / "uploads",
        soclaas_base_url="https://gateway.example.com",
        soclaas_api_key=SecretStr("test-key"),
        soclaas_hint_model="hint-model",
        soclaas_quiz_model="quiz-model",
        soclaas_summary_model="summary-model",
        soclaas_hint_context_tokens=100000,
        soclaas_quiz_context_tokens=100000,
        soclaas_summary_context_tokens=100000,
        shutdown_grace_seconds=0.05,
    )
    clock = Clock()
    db = Database(settings.database_path)
    await db.initialize()
    password_hash = await asyncio.to_thread(Core(db, settings).password_hasher.hash, PASSWORD)
    async with db.write() as conn:
        await conn.execute(
            "INSERT INTO users(username, display_name, password_hash, role, created_at) "
            "VALUES ('admin', 'Administrator', ?, 'admin', ?)",
            (password_hash, stamp(clock())),
        )
    gateway = Gateway()
    app = create_app(settings, transport=httpx.MockTransport(gateway.handle), clock=clock)
    value = Harness(app, settings, clock, gateway)
    async with app.router.lifespan_context(app):
        try:
            yield value
        finally:
            gateway.release.set()
            await value.drain()
            for client in value.clients:
                await client.aclose()


@dataclass
class Course:
    harness: Harness
    admin: httpx.AsyncClient
    teacher: httpx.AsyncClient
    students: list[httpx.AsyncClient]
    class_id: int
    teacher_id: int
    student_ids: list[int]
    note_id: int

    async def draft(self, *, title: str = "FIFO quiz", count: int = 2) -> dict[str, Any]:
        response = await self.teacher.post(
            f"{API}/quizzes",
            json={
                "class_id": self.class_id,
                "note_id": self.note_id,
                "title": title,
                "question_count": count,
            },
        )
        assert response.status_code == 201, response.text
        return response.json()

    async def generated(self) -> dict[str, Any]:
        draft = await self.draft()
        response = await self.harness.ai_post(
            self.teacher, f"/quizzes/{draft['id']}/generate", {"expected_revision": 0}
        )
        assert response.status_code == 202, response.text
        await self.harness.drain()
        state = await self.teacher.get(f"{API}/quizzes/{draft['id']}/generation")
        assert state.json()["status"] == "success", state.text
        response = await self.teacher.get(f"{API}/quizzes/{draft['id']}")
        return response.json()

    async def published(self) -> dict[str, Any]:
        draft = await self.generated()
        response = await self.teacher.post(
            f"{API}/quizzes/{draft['id']}/publish", json={"expected_revision": draft["revision"]}
        )
        assert response.status_code == 200, response.text
        return draft

    async def attempt(self, quiz: dict[str, Any], index: int = 0) -> dict[str, Any]:
        response = await self.students[index].post(f"{API}/quizzes/{quiz['id']}/attempt", json={})
        assert response.status_code == 200, response.text
        return response.json()

    async def submit(
        self, quiz: dict[str, Any], index: int = 0, choice: str = "B"
    ) -> dict[str, Any]:
        attempt = await self.attempt(quiz, index)
        for question in quiz["questions"]:
            response = await self.students[index].put(
                f"{API}/attempts/{attempt['id']}/answers/{question['id']}",
                json={"selected_option": choice},
            )
            assert response.status_code == 200, response.text
        response = await self.students[index].post(
            f"{API}/attempts/{attempt['id']}/submit", json={}
        )
        assert response.status_code == 200, response.text
        return response.json()


@pytest.fixture
async def course(harness: Harness) -> Course:
    admin = await harness.login()
    users = []
    for username, role in [
        ("teacher", "teacher"),
        ("student-one", "student"),
        ("student-two", "student"),
    ]:
        response = await admin.post(
            f"{API}/users",
            json={
                "username": username,
                "display_name": username,
                "password": PASSWORD,
                "role": role,
            },
        )
        assert response.status_code == 201, response.text
        users.append(response.json())
    response = await admin.post(f"{API}/classes", json={"name": "Data structures"})
    assert response.status_code == 201, response.text
    class_id = response.json()["id"]
    for user in users:
        response = await admin.put(f"{API}/classes/{class_id}/members/{user['id']}")
        assert response.status_code == 200, response.text
    teacher = await harness.login("teacher")
    students = [await harness.login("student-one"), await harness.login("student-two")]
    response = await teacher.post(
        f"{API}/classes/{class_id}/notes",
        files={
            "file": (
                "notes.docx",
                docx_bytes(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert response.status_code == 201, response.text
    return Course(
        harness,
        admin,
        teacher,
        students,
        class_id,
        users[0]["id"],
        [users[1]["id"], users[2]["id"]],
        response.json()["id"],
    )


def assert_error(response: httpx.Response, status: int, code: str) -> dict[str, Any]:
    assert response.status_code == status, response.text
    assert response.json()["error"]["code"] == code, response.text
    return response.json()["error"]


def assert_no_answers(value: Any) -> None:
    if isinstance(value, dict):
        assert not {"correct_option", "explanation", "is_correct"}.intersection(value)
        for item in value.values():
            assert_no_answers(item)
    elif isinstance(value, list):
        for item in value:
            assert_no_answers(item)
