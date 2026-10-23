# Implementation Handoff: UI-04 Improve Quiz Attempt Page

## Status and Target

- **Task**: [`workflow/tasks/ui-04-improve-quiz-attempt-page.md`](../tasks/ui-04-improve-quiz-attempt-page.md)
- **Status**: `IMPLEMENTED`
- **Branch**: `feat/quiz-attempt-and-hints`
- **Baseline HEAD**: `c804e5c6058c72ff88d8a8dd321466387e81dac8` (`origin/master`)
- **Scoped worktree changes for UI-04**:
  - `frontend/src/student/attemptState.ts`
  - `frontend/src/student/AttemptControls.tsx`
  - `frontend/src/student/QuizPage.tsx`
  - `frontend/src/student/student.css`
  - `frontend/tests/StudentUI.test.tsx`
  - `frontend/tests/StudentSession.test.tsx`
  - `specs/frontend-spec.md`
  - `docs/UserGuide.md`

## Acceptance Criteria and Evidence

- **AC-01 (Sticky question navigator & focus jump)**:
  - **Green**: `AttemptNavigator` renders a sticky question index bar with answered/unanswered/review-marked status pills, `Jump to next unanswered` action, and shared `SubmissionReadiness`. Clicking a question pill or `Jump to next unanswered` scrolls and moves focus to that question heading (`getQuestionHeadingId`) while keeping all question cards mounted in a single scrolling page. Verified in `frontend/tests/StudentUI.test.tsx` and `frontend/tests/StudentSession.test.tsx`.
- **AC-02 (Temporary session-only review marks)**:
  - **Green**: Each question card includes a `Mark for review` toggle button (`aria-pressed`) stored in component state for the active attempt session without modifying backend schemas or triggering answer-save API calls; switching attempts or sessions resets the review marks. Verified in `frontend/tests/StudentUI.test.tsx` and `frontend/tests/StudentSession.test.tsx`.
- **AC-03 (Shared submission readiness & save status)**:
  - **Green**: `deriveSubmissionReadiness` computes answered/remaining counts, review-marked counts, in-flight save state (`Saving answers…`), and unsaved selection warnings, displayed consistently in both the sticky navigator and the bottom submission card while disabling submission until every question is saved and no answer save is in flight. Verified in `frontend/tests/StudentUI.test.tsx`.
- **AC-04 (Explicit submission confirmation step)**:
  - **Green**: Clicking `Submit quiz` when ready opens `SubmissionConfirmation` (`Confirm quiz submission` with answered/marked counts, finality notice, `Confirm and submit`, and `Keep reviewing`) before calling `submitAttempt`. Changing an answer or encountering a save error dismisses the confirmation step before final submission. Verified in `frontend/tests/StudentUI.test.tsx`.
- **AC-05 (Preserves mounted question and hint state)**:
  - **Green**: Jumping between questions and toggling review marks preserves all mounted question cards, selected options, and per-question `QuestionHint` state without extra backend requests. Verified in `frontend/tests/StudentUI.test.tsx`.

## Approved Spec and Documentation Deltas Applied

- [`specs/frontend-spec.md`](../../specs/frontend-spec.md): Updated Student Experience (`#/student/attempt/:quizId`) to specify the sticky question navigator, `Jump to next unanswered` control, temporary session-only `Mark for review` toggle, shared submission readiness messaging, and explicit `Confirm and submit` / `Keep reviewing` confirmation step.
- [`docs/UserGuide.md`](../../docs/UserGuide.md): Documented the question navigator, `Mark for review` toggle, `Jump to next unanswered` shortcut, save-readiness status, and two-step quiz submission confirmation in the Student section.

## Verification Checks

1. **Focused Student UI & Session Tests**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3/frontend`
   - Command: `npx vitest run tests/StudentUI.test.tsx tests/StudentSession.test.tsx`
   - Result: Exit `0` (2 files, 35 tests passed).
2. **Full Frontend Test Suite**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3/frontend`
   - Command: `npm test`
   - Result: Exit `0` (14 test files, 154 tests passed).
3. **Linter**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3/frontend`
   - Command: `npm run lint`
   - Result: Exit `0` (0 errors, 8 pre-existing warnings in unchanged shared/auth files; 0 warnings in new Task 4 files).
4. **Formatting & Build**:
   - Working directory: `/Users/junhaong/Documents/y3s1/CS3227/CS3227-2610-MP3/frontend`
   - Command: `npm run format:check && npm run build`
   - Result: Exit `0` (Prettier check, TypeScript compilation, and Vite build passed).
5. **Browser Preview Check**:
   - Loaded local preview fixture in native Chrome tab (HTTP 200) without backend or live AI calls; deleted temporary preview files before committing.

## Limitations and Open Items

- Multi-agent code review was omitted at user direction.
- No unresolved questions or blockers.
