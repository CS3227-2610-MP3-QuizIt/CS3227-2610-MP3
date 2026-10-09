# Hint generation and verification

## Approved behavior

The user requested a second AI call to verify relevance and answer leakage, with
the hint remaining in progress during both calls. During planning, the user chose
private answer context for verification, AI as the content judge, the existing
hint model for both calls, and explicit student retry after rejection.

The backend/frontend specifications and repository guidance now distinguish hint
generation inputs from private verification inputs. The generator omits answer
context. The verifier receives the candidate, question, notes, student prompt,
options, correct option, and explanation as untrusted JSON separate from fixed
instructions. Only an exact boolean verdict approving relevance and rejecting
answer leakage permits success. Deterministic validation checks structure, not
semantic content or literal option overlap.

## Implementation and review evidence

- One managed task, admission record, target, and 300-second deadline cover both
  stateless calls. The existing frontend `in_progress` state covers verification.
- No candidate is persisted or returned before approval. Completion still checks
  eligibility and commits the hint, task state, and version atomically.
- Usage is summed when both values are valid and fit SQLite; unknown totals stay
  null. Interrupted verification retains known generation usage in memory for
  failure persistence. Restart fails running tasks without replay.
- No schema migration, new model configuration, queue, retry loop, or dependency
  was introduced. The existing model/context/output settings serve both calls.
- Source and diff inspection confirmed that no transaction spans gateway I/O and
  SSE continues to publish only committed IDs and versions. Private task snapshots
  contain answer context, but response envelopes do not serialize those snapshots.
- Live-check fixtures and help now describe four metered calls. No live call was
  made during implementation. AI judgment quality still requires manual evaluation
  with the deployment's configured model; mocked verdicts prove orchestration and
  validation rather than the model's accuracy.

Tests mock both stages independently, including held verification, relevance and
leakage rejection, malformed verdicts, harmless option overlap, instruction/data
separation, token accounting, idempotency, timeout, submission, restart, private
response content, latest-failure semantics, and explicit retry/allowance behavior.
Existing tests were aligned with current output and upload limits; the hint-cap
test now explicitly configures two successes rather than relying on a stale default.

## Validation

Commands run from `backend/` or `frontend/` respectively. All provider traffic was
mocked. Database-backed tests stalled in the filesystem sandbox, with permission
diagnostics; approved execution outside the sandbox completed the tests.

- Focused backend contracts/AI/verification: 98 passed before the final two
  integration cases were added.
- Frontend hint component, hint store, and student session: 19 passed in 3 files.
- Ruff lint and formatting checks passed; mypy passed for application and tests.
- First full backend run: 164 passed, one stale upload-boundary test failed. The
  test used 12,001 characters against the existing 16,000-character setting; its
  boundary was corrected to 16,001 without changing application upload behavior.

- Final full backend suite: `.venv/bin/python -m pytest -q` — **167 passed in
  45.29 seconds**, including the new verification failure/retry integration cases
  and corrected upload boundary.
- Frontend command: `npm test -- tests/QuestionHint.test.tsx tests/HintStore.test.ts
  tests/StudentSession.test.tsx` — **19 passed in 3 files**.
- Static commands: `.venv/bin/ruff format --check .`, `.venv/bin/ruff check .`, and
  `.venv/bin/mypy src/quiz_backend tests` — passed (27 source/test files typed).

Remaining manual check: request several hints with the deployed SoCLaaS model,
including ordinary helpful clues, requests for answers, and unrelated prompts.
Assess whether the model's verifier judgments match the intended criteria. This
semantic quality check was not performed against a live gateway.
