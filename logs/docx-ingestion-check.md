# DOCX ingestion check — 2026-10-07

Request: test the supplied `Photosynthesis_O_Level.docx` using the demo teacher credentials.

Verified against the running backend at `http://127.0.0.1:7000/api/v1`:

- Logged in as `teacher1` and confirmed the teacher identity and assigned Class 1.
- Uploaded the supplied DOCX through the authenticated multipart notes endpoint: HTTP 201, note ID 1.
- File size: 14,272 bytes. Extraction: 6,788 characters across 122 nonempty paragraphs. The extracted text contains the photosynthesis topic.
- Created an unpublished five-question draft titled “Photosynthesis O Level — ingestion check”: HTTP 201, quiz ID 1. Reading the draft back confirmed its association with note ID 1.
- Logged out successfully: HTTP 204. The uploaded note and draft remain on the running backend for review.

Verified separately in an isolated application instance with fresh automatically seeded demo accounts and the same supplied DOCX:

- Authenticated demo teacher upload and draft creation succeeded.
- Persisted extracted text matched extraction; the stored checksum matched the source file; private stored bytes matched the source and file permissions were 0600.
- Upload responses omitted extracted text, storage keys, and checksums.
- Gateway transport rejected any unexpected request; ingestion made no gateway calls.

Existing upload regression suite: `backend/.venv/bin/python -m pytest -q tests/test_uploads.py`, executed from `backend/`: **11 passed in 4.32s**. Covers paragraph/table extraction, invalid and empty uploads, size limits, XML entities, external links, authorization, failed-write cleanup, and membership revocation during persistence.

Limitations: the running backend's database is separate from the checkout's configured local database, so private persistence assertions were performed in the isolated instance. Teacher frontend screens currently show a placeholder; this was an API check, not a browser upload check. Quiz generation and publication were not invoked. Sandbox stream restrictions stalled the initial isolated checks; those runs were interrupted and successfully rerun outside the sandbox. No application code was changed.

## Follow-up: live AI generation

The user subsequently requested live AI generation and display of the resulting quiz. Logged in as the demo teacher and submitted one generation request for draft 1 using its current revision and a fresh idempotency key. The backend accepted the request with HTTP 202. Authoritative polling reported a terminal failure: `AI_INVALID_OUTPUT`, nested HTTP 502, message “The AI service returned invalid content. Request a new generation to retry.” The task returned no result. No automatic retry or publication was performed. Logged out after checking the outcome.

## Follow-up: failure investigation

Read safe metadata for the failed task from the running container: provider HTTP 200; 2,347 input tokens, 3,058 output tokens, 5,405 total tokens; completion approximately 42 seconds after admission. Draft readback showed revision 0 with zero saved questions. These observations rule out the recorded timeout, credential, and rate-limit error paths; they do not identify the exact content-validation failure.

The backend maps response-envelope, generated-JSON, and feature-schema validation failures to the same generic error. It does not retain raw rejected output or a specific validation reason, so the original cause cannot be reconstructed from persisted metadata.

Made one operator diagnostic call using the original immutable input snapshot, current configured quiz model (`qwen3.8:27b`), and existing `SoCLaaS.generate_quiz` service. This call was separate from an application task and did not update draft 1. Response content stayed in process memory; only structural diagnostics were printed. The response was HTTP 200/completed, contained plain JSON with exactly five questions, the required question fields and four option labels, and passed the existing validator. Reported usage: 2,347 input tokens, 2,130 output tokens. The initial failure was not reproduced. No automatic retries, model switching, or validation relaxation was added.

Ran `backend/.venv/bin/python -m pytest -q tests/test_gateway_contracts.py tests/test_ai.py` from `backend/`: **75 passed in 13.82s**. This supports existing contract/validation behavior but does not prove the absence of all integration bugs. No application code was changed.

## Goal follow-up: save questions and identify rejection causes

The user required investigation of the rejection and working generation from the uploaded DOCX. Added fixed validation stage/reason categories to `AI_INVALID_OUTPUT`, persisting them through the existing terminal error envelope, without raw content or arbitrary exception messages. Strengthened quiz instructions with a placeholder JSON example while retaining strict validation and the same configured model. Updated backend specification, developer/user guides, and regression coverage together. Used the repository's `python-general` skill; no subagents were invoked for this follow-up.

Verified **81 targeted tests** and **133 full-suite tests**, Ruff lint/format, mypy, Docker build, and Git whitespace checks. The local backend now runs `quiz-backend:docx-diagnostics`, preserving its original environment and `quiz-backend-data` volume. Its previous container is retained stopped for rollback; no production system was deployed.

Logged in as the demo teacher and explicitly requested fresh generation for draft 1. Task `2b0629e1-a87b-4c7b-8b24-e66c22f66766` succeeded: five questions saved, revision 1, still unpublished. An authoritative quiz GET and direct persistence check confirmed the five saved questions and successful task. The uploaded file's stored checksum matches the supplied file. Provider usage: 2,448 input tokens, 1,759 output tokens, 4,207 total tokens. Logged out. Quiz preview/output artifacts are temporary private files, not committed development logs.

Two operator comparison calls using the original instructions and immutable input also passed (2,705 and 2,173 output tokens respectively). Together with the earlier successful comparison, these do not reproduce the initial failure. Checked the old container logs for validation diagnostics or exception traces: neither is present. The exact original rejection rule remains unknown because it was discarded; asked whether the user can access gateway evidence for that original request. No raw response, source notes, session tokens, or credentials were recorded here. Detailed verified checks and limitations are in `workflow/backend-validation.md`.

## Continuation audit — original response unavailable

Rechecked the running database: the original failure still has empty error details,
provider HTTP 200, and non-null usage; draft 1 still has five saved questions, revision
1, unpublished, with no running application tasks. Inspection of the original AI
implementation proves reported usage was extracted only after the complete response
passed the byte cap and outer JSON decoding. Thus the original rejection was after
those checks: response completion/error validation, generated JSON parsing, or quiz
schema validation. The specific branch was not persisted. The provider response ID
was not retained either. The supplied gateway contract says persisted retrieval is
not implemented and its temporary response cache lasts 15 minutes; at the audit's
11:33:58 UTC, the original failure was already more than 15 minutes old. No additional
live calls were made, because new valid or invalid outputs cannot recover the discarded
original response. Exact diagnosis remains dependent on upstream operator evidence;
the earlier question to the user is still unanswered. This is the second consecutive
goal turn encountering that missing-evidence condition; the goal remains active.

Third consecutive goal-turn audit confirmed the same condition: the original task's
details remain empty, no original response or upstream evidence has been supplied,
and no application task is running. The five saved questions remain intact. The prior
audit narrowed the possible failure paths but did not recover the exact rule. Further
generation calls cannot establish what was in the discarded response. Marked the goal
blocked on access to original gateway/operator evidence; working DOCX generation and
the diagnostic improvements remain delivered and verified.

## User-requested regeneration

The user asked whether the backend was still running and requested another quiz API
call with the result displayed. Demo teacher login returned HTTP 200. Submitted an
explicit `action: new` generation for draft 1 with expected revision 1 and a fresh
operation key: HTTP 202. Task `645fd919-709b-4aaa-9562-0fba580b72e5` reached success.
The authoritative quiz GET confirmed five questions saved at revision 2, still an
unpublished draft associated with note 1. Displayed the returned quiz to the user and
logged out successfully. No automatic provider retry or publication occurred. This
does not recover the original failed response or resolve the blocked historical
diagnosis.
