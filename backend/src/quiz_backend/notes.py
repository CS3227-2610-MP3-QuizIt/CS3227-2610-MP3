"""Private DOCX storage and bounded extraction without external resolution."""

import io
import os
import uuid
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any
from xml.etree.ElementTree import ParseError

from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException

from quiz_backend.errors import AppError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_EXPANDED_BYTES = 20 * 1024 * 1024
_WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
_STRICT_WORD_NS = "http://purl.oclc.org/ooxml/wordprocessingml/main"
_CONTENT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
_DOCUMENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"


def _invalid() -> AppError:
    return AppError(422, "INVALID_DOCX", "Upload a valid DOCX document containing readable text.")


def _xml(data: bytes) -> Any:
    return ElementTree.fromstring(data, forbid_dtd=True, forbid_entities=True, forbid_external=True)


def extract_docx(data: bytes, filename: str, max_characters: int = 12000) -> str:
    """Extract paragraphs (including table paragraphs); call outside the event loop.

    Archive paths are only ZIP member names. Nothing is extracted to disk and no
    relationships, hyperlinks, embedded documents, or external resources load.
    """
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError(413, "UPLOAD_TOO_LARGE", "DOCX uploads must be at most 5 MiB.")
    if not filename.casefold().endswith(".docx") or not data:
        raise _invalid()
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
            names = [member.filename for member in members]
            if len(names) != len(set(names)) or len(names) > 4096:
                raise _invalid()
            size = 0
            for member in members:
                path = PurePosixPath(member.filename)
                if (
                    path.is_absolute()
                    or ".." in path.parts
                    or "\\" in member.filename
                    or member.flag_bits & 0x1
                    or member.compress_type not in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}
                ):
                    raise _invalid()
                size += member.file_size
                if size > MAX_EXPANDED_BYTES:
                    raise AppError(
                        413, "DOCX_EXPANSION_TOO_LARGE", "The expanded DOCX archive exceeds 20 MiB."
                    )
            required = {"[Content_Types].xml", "_rels/.rels", "word/document.xml"}
            if not required.issubset(names):
                raise _invalid()
            # Check every member's CRC and actual expansion, rather than trusting
            # only directory declarations; unsupported parts remain inert bytes.
            contents: dict[str, bytes] = {}
            expanded = 0
            for member in members:
                with archive.open(member) as handle:
                    buffer = bytearray()
                    while chunk := handle.read(64 * 1024):
                        expanded += len(chunk)
                        if expanded > MAX_EXPANDED_BYTES:
                            raise AppError(
                                413,
                                "DOCX_EXPANSION_TOO_LARGE",
                                "The expanded DOCX archive exceeds 20 MiB.",
                            )
                        if member.filename in required:
                            buffer.extend(chunk)
                    if member.filename in required:
                        contents[member.filename] = bytes(buffer)
            types = _xml(contents["[Content_Types].xml"])
            if types.tag != f"{{{_CONTENT_NS}}}Types" or not any(
                element.tag == f"{{{_CONTENT_NS}}}Override"
                and element.get("PartName") == "/word/document.xml"
                and element.get("ContentType") == _DOCUMENT_TYPE
                for element in types
            ):
                raise _invalid()
            relationships = _xml(contents["_rels/.rels"])
            relation_ns = "http://schemas.openxmlformats.org/package/2006/relationships"
            if relationships.tag != f"{{{relation_ns}}}Relationships" or not any(
                relation.tag == f"{{{relation_ns}}}Relationship"
                and relation.get("Type", "").endswith("/officeDocument")
                and relation.get("Target", "").lstrip("/") == "word/document.xml"
                and relation.get("TargetMode", "Internal") == "Internal"
                for relation in relationships
            ):
                raise _invalid()
            document = _xml(contents["word/document.xml"])
            namespace = document.tag.removesuffix("}document").removeprefix("{")
            if (
                namespace not in {_WORD_NS, _STRICT_WORD_NS}
                or document.tag != f"{{{namespace}}}document"
            ):
                raise _invalid()
            body = document.find(f"{{{namespace}}}body")
            if body is None:
                raise _invalid()
            paragraphs: list[str] = []
            count = 0
            for paragraph in body.iter(f"{{{namespace}}}p"):
                pieces: list[str] = []
                for node in paragraph.iter():
                    if node.tag == f"{{{namespace}}}t":
                        pieces.append(node.text or "")
                    elif node.tag in {
                        f"{{{namespace}}}tab",
                        f"{{{namespace}}}br",
                        f"{{{namespace}}}cr",
                    }:
                        pieces.append(" ")
                text = " ".join("".join(pieces).split())
                if text:
                    count += len(text) + (1 if paragraphs else 0)
                    if count > max_characters:
                        raise AppError(
                            422,
                            "NOTES_TOO_LONG",
                            "Extracted notes are too long. Upload shorter notes.",
                        )
                    paragraphs.append(text)
            if not paragraphs:
                raise AppError(
                    422, "EMPTY_NOTES", "The document contains no readable paragraph or table text."
                )
            return "\n".join(paragraphs)
    except (
        zipfile.BadZipFile,
        zipfile.LargeZipFile,
        ParseError,
        DefusedXmlException,
        KeyError,
        RuntimeError,
        OSError,
        ValueError,
    ):
        raise _invalid() from None


def store_docx(storage_path: Path, data: bytes) -> str:
    """Store under an opaque key, never the uploaded filename."""
    storage_path.mkdir(parents=True, exist_ok=True, mode=0o700)
    key = uuid.uuid4().hex + ".docx"
    path = storage_path / key
    created = False
    try:
        with path.open("xb") as handle:
            created = True
            os.chmod(path, 0o600)
            handle.write(data)
    except BaseException:
        if created:
            path.unlink(missing_ok=True)
        raise
    return key
