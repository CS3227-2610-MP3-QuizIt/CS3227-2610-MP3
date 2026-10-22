# Security Boundary Review — UI-03 Organize My quizzes

## Review scope and evidence

- **Target:** `b683612e13e21cb7bdad18dea9df94e15ce0c8d7` plus the assigned working-tree changes.
- **Fingerprint:** tracked diff SHA-256 `dd66c070b65971eeb8dc1321d3941808ff4fb3addcf42b089a6e19b4a4ff4f43`; untracked preferences module SHA-256 `2c72fb3f7667337859a3c6360788714f64ce4688c4bd9112a4365b7c26946d7a`. Both match the supplied target.
- **Scope:** student quiz collection filtering, in-memory selection lifetime, display of submitted collection scores, and the correction resetting preferences across identity/session changes. No backend authorization, schema, or security configuration changed.
- **Overall:** PASS within the inspected scope.
- **Independent human review:** READY, with the browser and backend verification limitations below.

## Checks

| Boundary | Status | Evidence |
| --- | --- | --- |
| Identity and session lifetime | Complete by source inspection and recorded regression test | `StudentApp` renders no workspace without an authenticated user and keys `StudentWorkspace` by `user.id`. Preferences are owned by that workspace in React state, so session loss unmounts it and a different account ID mounts defaults. The added AuthProvider test sets all three preferences, dispatches session loss, signs in as a second user, and asserts default tab/class/search. Handoff records this test failed before the correction and passed after. |
| Collection ownership and data source | Complete by source inspection | `QuizList` reads only `api.studentQuizzes` and filters the returned assignments locally. No per-card result or class-membership request was introduced. Backend `core.py:list_quizzes` selects a student's own attempts by authenticated `student_id` and emits `score` only when the attempt status is submitted. The UI diff does not change backend authority. |
| Score and answer exposure | Complete by source inspection and reported tests | `QuizCard` reads the collection score and renders it only for `submitted`; null/missing is labeled unavailable and numeric zero remains visible. Recorded tests include an intentionally inconsistent unfinished score and unavailable submitted score. No answer key or explanation is rendered in collection cards. |
| Untrusted display content and query privacy | Complete by source inspection | Titles and class names render as ordinary React text. Search is local; no storage, URL, or API persistence of the search query was added. No `dangerouslySetInnerHTML` or equivalent is present in the changed collection path. |
| Unintended actions / authority | Complete by source inspection and reported tests | Filtering/counts act on the existing collection; navigation retains the existing attempt/results routes. No mutation, AI, or per-card result call was added. |
| Verification evidence | Recorded, not rerun for this review | Handoff reports 17 focused tests, 155 tests across 14 files, build and formatting passed, lint exit 0 with existing warnings, and `git diff --check` passed. This review independently confirmed both supplied fingerprints and inspected the regression assertions; it did not rerun the frontend checks. |

## Findings

None. Finding count: **0**.

## Gaps and limitations

- Browser-driven route navigation, reload, sign-out, session recovery, and account-switch behavior were not exercised. The correction's recorded AuthProvider test covers session loss followed by a different account sign-in; it does not establish browser behavior across reload or manual sign-out.
- No browser checks were run for rendered content or session transitions. Source inspection confirms ordinary React text rendering and workspace-local state.
- Backend authorization tests were not rerun; this UI-only change continues to rely on the existing authenticated student collection and attempt/result ownership controls.
- Automated tests use mocked APIs and do not establish deployed behavior or live backend responses.

## Handoff

- **Implementation follow-up required:** NO.
- **Edit documentation:** NO.
- **Rerun security review:** NO, unless follow-up changes touch collection authorization, score visibility, or preference lifetime.
- **Independent human review:** READY with the limitations above.
- **Manual checks still useful:** In a browser, navigate list → attempt/results → list and confirm selections persist; reload and confirm defaults; sign out/session-loss then sign in as a different student and confirm no prior selections or cards remain. A markup-like title/class can also confirm literal text display.
