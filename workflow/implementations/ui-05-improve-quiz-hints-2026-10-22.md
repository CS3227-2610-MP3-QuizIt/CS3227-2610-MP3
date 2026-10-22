# Implementation Handoff: UI-05 Improve Quiz Hints

## Status and Target

- **Task**: [`workflow/tasks/ui-05-improve-quiz-hints.md`](../tasks/ui-05-improve-quiz-hints.md)
- **Status**: `IMPLEMENTED`
- **Branch**: `feat/quiz-attempt-and-hints`
- **Baseline HEAD**: `440d80b1a5179098a5ca31890aefcc90e9c8f9ac` (`docs(student-ui): Document attempt navigation and confirmation`)
- **Pre-existing uncommitted changes**: `workflow/implementations/ui-04-improve-quiz-attempt-page-2026-04-19.md` (untracked from Task 4)
- **Scoped worktree changes for UI-05**:
  - `frontend/src/student/QuestionHint.tsx`
  - `frontend/src/student/student.css`
  - `frontend/tests/QuestionHint.test.tsx`
  - `frontend/tests/StudentUI.test.tsx`
  - `frontend/tests/StudentSession.test.tsx`
  - `specs/frontend-spec.md`
  - `docs/UserGuide.md`

## Acceptance Criteria and Evidence

- **AC-01 (Collapsed by default & dynamic disclosure summary)**:
  - **Red**: `npm --prefix frontend test -- --run tests/QuestionHint.test.tsx tests/StudentUI.test.tsx` exited `1` (10 tests failed) when `QuestionHint` rendered expanded by default without a disclosure toggle button.
  - **Green**: `QuestionHint` renders a full-width, left-aligned `<button type="button" className="student-hint-toggle" aria-expanded={expanded} aria-controls={panelId}>` with a right-aligned indicator (`▸` / `▾`). Unused hints start collapsed (`Need a hint?`, `aria-expanded="false"`), and the collapsed summary updates to `Preparing your hint…`, `Your hint`, `Hint request needs attention`, or `Hint unavailable — try again` without auto-expanding. Verified in `frontend/tests/QuestionHint.test.tsx` (`starts collapsed by default, updates collapsed summary across states, and opens via keyboard and pointer`) and `frontend/tests/StudentSession.test.tsx`.
- **AC-02 (Clear verification failure reason & safe error mapping)**:
  - **Red**: Failed when `QuestionHint` rendered raw `state.error.message` instead of mapped safe copy.
  - **Green**: `formatHintFailure` maps structured `error.code` and `error.details` (`stage === "hint_verification"` with `reason === "hint_reveals_answer"` or `"hint_irrelevant"`, general/malformed `AI_INVALID_OUTPUT`, `AI_TIMEOUT`, `AI_REQUEST_INTERRUPTED`, `AI_CONFIGURATION_ERROR`, `AI_PROVIDER_LIMIT` / `AI_APP_RATE_LIMIT`, and general unavailability) while preserving positive `retry_after_seconds` and never reading `error.message` or exposing raw error codes, candidate text, or verifier rationale. Verified in `frontend/tests/QuestionHint.test.tsx` (`maps verification and fallback failures from code and details without leaking raw messages or error codes`).
- **AC-03 (Prompt-adjustable retry vs uncertain POST repeat)**:
  - **Red**: Failed when `state.status === "failed"` showed `Ask for a hint` instead of `Try again`.
  - **Green**: Confirmed failures render an enabled 500-character `Optional hint prompt` textarea and a `Try again` button that sends the edited prompt with `action: "new"` and a fresh idempotency key on explicit click; uncertain POST (`canRepeat`) keeps the textarea disabled and offers `Repeat previous request` with the original input and key. Verified in `frontend/tests/QuestionHint.test.tsx` (`supports prompt-adjustable Try again on confirmed failure and keeps uncertain POST repeat separate`).
- **AC-04 (No automatic generation & latest failure replaces older success)**:
  - **Red**: Failed before collapsible disclosure and failure-mapping assertions were in place.
  - **Green**: Opening/closing, typing, SSE notifications, and failures never trigger `generateHint`; a newer failed version (`version: 3, status: "failed"`) hides older successful hint text whether the disclosure is open or collapsed (`Hint unavailable — try again`). Verified in `frontend/tests/QuestionHint.test.tsx` (`never auto-generates on render, edit, collapse, reopen, or failure, and latest failure hides older success whether open or collapsed`).
- **AC-05 (Preserves state across collapse/navigation & never blocks attempt)**:
  - **Red**: `StudentUI.test.tsx` failed when testing collapsible disclosure state preservation across question jumps.
  - **Green**: Typed prompt, active hint, and error state survive collapsing/reopening and jumping between questions in `AttemptWorkspace`, and hint unavailability/running/failure never blocks saving answers or submitting the quiz. Verified in `frontend/tests/QuestionHint.test.tsx` and `frontend/tests/StudentUI.test.tsx`.
- **AC-06 (Compact layout & safe literal rendering)**:
  - **Green**: Hint strings and safe failure notices render as literal React text nodes (no `dangerouslySetInnerHTML`), escaping HTML/script/markdown-like content such as `<script>alert("xss")</script>` and `[link](javascript:alert(1))`. Verified in `frontend/tests/QuestionHint.test.tsx` (`renders untrusted hint text safely as literal text without interpreting HTML or markdown`).

## Approved Spec and Documentation Deltas Applied

- [`specs/frontend-spec.md`](../../specs/frontend-spec.md): Updated Student Experience (`#/student/attempt/:quizId`) to specify that each question's hint control starts collapsed (`Need a hint?`), shows compact state in its disclosure summary, and maps task failures from `error.code` and `error.details` with an editable prompt and `Try again` action.
- [`docs/UserGuide.md`](../../docs/UserGuide.md): Updated the Hints section and Troubleshooting FAQ to describe expanding `Need a hint?`, adjusting the optional prompt, and clicking `Try again` when a hint is blocked for revealing the answer or being off-topic.

## Verification Checks

1. **Focused TDD Red**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3`
   - Command: `npm --prefix frontend test -- --run tests/QuestionHint.test.tsx tests/StudentUI.test.tsx`
   - Result: Exit `1` (10 failed, 13 passed) before `QuestionHint.tsx` implementation.
2. **Focused TDD Green**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3`
   - Command: `npm --prefix frontend test -- --run tests/QuestionHint.test.tsx tests/StudentUI.test.tsx`
   - Result: Exit `0` (2 files, 23 passed).
3. **Full Frontend Test Suite**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3`
   - Command: `npm --prefix frontend test -- --run`
   - Result: Exit `0` (14 test files, 157 tests passed).
4. **Linter**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3`
   - Command: `npm --prefix frontend run lint`
   - Result: Exit `0` (0 errors, 8 pre-existing warnings in `ui.tsx`, `useResource.ts`, `AuthProvider.tsx`, `LoginPage.tsx`; 0 warnings in `QuestionHint.tsx`).
5. **Formatting Check**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3`
   - Command: `npm --prefix frontend run format:check`
   - Result: Exit `0` (`All matched files use Prettier code style!`).
6. **Production Build & Typecheck**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3`
   - Command: `npm --prefix frontend run build`
   - Result: Exit `0` (`tsc -b && vite build` succeeded in 110ms).

## Limitations and Open Items

- Automated component and integration tests verify all acceptance criteria (`AC-01` through `AC-06`), keyboard activation (`Enter` / `Space`), ARIA attributes (`aria-expanded`, `aria-controls`), state preservation across question jumps, and CSS rules in `student.css`. Live browser visual geometry inspection was not re-run for Task 5.
- No unresolved questions or blockers.

