import asyncio
import io
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from quiz_backend.db import one
from quiz_backend.errors import AppError

from .conftest import API, Course, assert_error, docx_bytes


async def test_docx_paragraphs_tables_and_private_storage(course: Course) -> None:
    original = "../../unsafe name.docx"
    response = await course.teacher.post(
        f"{API}/classes/{course.class_id}/notes",
        files={"file": (original, docx_bytes("Paragraph content", table=True))},
    )
    assert response.status_code == 201, response.text
    note = response.json()
    assert note["extracted_characters"] >= len("Paragraph content") + len("Table example")
    assert "storage_key" not in note
    assert "extracted_text" not in note
    async with course.harness.app.state.db.read() as conn:
        saved = await one(conn, "SELECT * FROM notes WHERE id=?", (note["id"],))
    assert saved is not None
    assert "Paragraph content" in saved["extracted_text"]
    assert "Table example" in saved["extracted_text"]
    assert "/" not in saved["storage_key"]
    assert "unsafe" not in saved["storage_key"]
    assert (course.harness.settings.storage_path / saved["storage_key"]).is_file()


@pytest.mark.parametrize(
    "filename,content,code",
    [
        ("notes.docx", b"not a zip archive", "INVALID_DOCX"),
        ("notes.txt", docx_bytes(), "INVALID_DOCX"),
        ("notes.docx", docx_bytes("   "), "EMPTY_NOTES"),
        ("notes.docx", docx_bytes("a" * 16001), "NOTES_TOO_LONG"),
    ],
)
async def test_rejected_uploads_have_no_storage_or_database_effect(
    course: Course, filename: str, content: bytes, code: str
) -> None:
    before = set(course.harness.settings.storage_path.iterdir())
    response = await course.teacher.post(
        f"{API}/classes/{course.class_id}/notes", files={"file": (filename, content)}
    )
    assert_error(response, 422, code)
    assert set(course.harness.settings.storage_path.iterdir()) == before
    async with course.harness.app.state.db.read() as conn:
        count = await one(conn, "SELECT COUNT(*) AS n FROM notes")
    assert count == {"n": 1}


async def test_file_and_archive_expansion_caps(course: Course) -> None:
    path = f"{API}/classes/{course.class_id}/notes"
    response = await course.teacher.post(
        path, files={"file": ("oversized.docx", b"x" * (5 * 1024 * 1024 + 1))}
    )
    assert_error(response, 413, "UPLOAD_TOO_LARGE")
    stream = io.BytesIO()
    with ZipFile(stream, "w", ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", "<Types />")
        archive.writestr("word/document.xml", "<document />")
        archive.writestr("word/media/expansion.bin", b"x" * (20 * 1024 * 1024 + 1))
    response = await course.teacher.post(
        path, files={"file": ("expansion.docx", stream.getvalue())}
    )
    assert_error(response, 413, "DOCX_EXPANSION_TOO_LARGE")


async def test_docx_xml_entities_are_rejected(course: Course) -> None:
    stream = io.BytesIO()
    with ZipFile(io.BytesIO(docx_bytes())) as source, ZipFile(stream, "w", ZIP_DEFLATED) as target:
        for info in source.infolist():
            content = source.read(info.filename)
            if info.filename == "word/document.xml":
                content = b'<!DOCTYPE foo [<!ENTITY secret SYSTEM "file:///etc/passwd">]><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>&secret;</w:t></w:r></w:p></w:body></w:document>'
            target.writestr(info.filename, content)
    response = await course.teacher.post(
        f"{API}/classes/{course.class_id}/notes",
        files={"file": ("entities.docx", stream.getvalue())},
    )
    assert_error(response, 422, "INVALID_DOCX")


async def test_docx_external_link_is_never_fetched(course: Course) -> None:
    stream = io.BytesIO()
    with ZipFile(io.BytesIO(docx_bytes())) as source, ZipFile(stream, "w", ZIP_DEFLATED) as target:
        for info in source.infolist():
            target.writestr(info.filename, source.read(info.filename))
        target.writestr(
            "word/_rels/document.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLink" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://private.example/credentials" TargetMode="External"/></Relationships>',
        )
    response = await course.teacher.post(
        f"{API}/classes/{course.class_id}/notes", files={"file": ("links.docx", stream.getvalue())}
    )
    assert response.status_code in {201, 422}
    assert not course.harness.gateway.calls


async def test_single_file_and_teacher_upload_authorization(course: Course) -> None:
    path = f"{API}/classes/{course.class_id}/notes"
    response = await course.teacher.post(
        path, files=[("file", ("one.docx", docx_bytes())), ("file", ("two.docx", docx_bytes()))]
    )
    assert_error(response, 422, "VALIDATION_ERROR")
    for client in [course.admin, *course.students]:
        response = await client.post(path, files={"file": ("notes.docx", docx_bytes())})
        assert_error(response, 403, "FORBIDDEN_ROLE")


async def test_stored_upload_is_removed_if_database_persistence_fails(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    harness = course.harness
    before = set(harness.settings.storage_path.iterdir())
    user = (await course.teacher.get(f"{API}/auth/me")).json()

    @asynccontextmanager
    async def failed_write() -> AsyncIterator[Any]:
        raise RuntimeError("simulated database persistence failure")
        yield  # pragma: no cover

    with monkeypatch.context() as scoped:
        scoped.setattr(harness.app.state.db, "write", failed_write)
        with pytest.raises(RuntimeError, match="persistence failure"):
            await harness.app.state.core.upload_note(
                user, course.class_id, "cleanup.docx", docx_bytes()
            )
        await harness.app.state.core.drain_uploads()
    assert set(harness.settings.storage_path.iterdir()) == before
    async with harness.app.state.db.read() as conn:
        count = await one(conn, "SELECT COUNT(*) AS n FROM notes")
    assert count == {"n": 1}


async def test_membership_revoked_after_storage_rejects_and_removes_new_file(
    course: Course, monkeypatch: pytest.MonkeyPatch
) -> None:
    harness = course.harness
    user = (await course.teacher.get(f"{API}/auth/me")).json()
    before = set(harness.settings.storage_path.iterdir())
    stored = asyncio.Event()
    release = asyncio.Event()
    original_write = harness.app.state.db.write
    first = True

    @asynccontextmanager
    async def hold_first_write() -> AsyncIterator[Any]:
        nonlocal first
        if first:
            first = False
            stored.set()
            await release.wait()
        async with original_write() as conn:
            yield conn

    monkeypatch.setattr(harness.app.state.db, "write", hold_first_write)
    upload = asyncio.create_task(
        harness.app.state.core.upload_note(user, course.class_id, "revoked.docx", docx_bytes())
    )
    await asyncio.wait_for(stored.wait(), 5)
    assert len(set(harness.settings.storage_path.iterdir()) - before) == 1
    response = await course.admin.delete(
        f"{API}/classes/{course.class_id}/members/{course.teacher_id}"
    )
    assert response.status_code == 204
    release.set()
    with pytest.raises(AppError) as failure:
        await asyncio.wait_for(upload, 5)
    assert failure.value.status == 404
    await harness.app.state.core.drain_uploads()
    assert set(harness.settings.storage_path.iterdir()) == before
    async with harness.app.state.db.read() as conn:
        count = await one(conn, "SELECT COUNT(*) AS n FROM notes")
    assert count == {"n": 1}
