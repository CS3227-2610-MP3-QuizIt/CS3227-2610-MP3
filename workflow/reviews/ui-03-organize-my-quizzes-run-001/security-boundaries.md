# Security Boundary Review — UI-03 Organize My quizzes

## Review scope and evidence

- **Target:** `b683612e13e21cb7bdad18dea9df94e15ce0c8d7` plus the assigned scoped working-tree diff.
- **Fingerprint:** tracked diff SHA-256 `e3ecdc210dd2a416e1cf9be3e031eac82cfbe4159cfb3b1c75dad5c347feb64b`; untracked preferences module SHA-256 `2c72fb3f7667337859a3c6360788714f64ce4688c4bd9112a4365b7c26946d7a`. Both match the supplied target.
- **Scope:** student collection UI, in-memory selection lifetime, and display of collection-provided submitted scores. No backend, schema, auth, or security configuration changed.
- **Overall:** PASS within the inspected scope.
- **Independent human review:** READY, with the browser verification limitation below.

## Checks

| Boundary | Status | Evidence |
| --- | --- | --- |
| Identity and session lifetime | Complete by source inspection | `App.tsx` keys each role workspace by authenticated `user.id`; `StudentApp.tsx` owns preference state and renders nothing when user is absent. Sign-out/session loss removes the workspace; a later account gets a new keyed instance. Preferences are not persisted to storage, URL, or backend. |
| Collection ownership and data source | Complete by source inspection | `QuizList.tsx` uses only the existing `api.studentQuizzes` collection read (lines 36–50); no per-card result, membership, or other request was added. Backend authorization remains the existing AUTH-01/AUTH-03 boundary in `workflow/security/security-matrix.md`; this UI diff does not alter it. |
| Score and answer exposure | Complete by source inspection and recorded tests | `QuizCard` renders score only when `attempt_status === "submitted"` (lines 263–307), takes the score from the collection, preserves zero, and labels null/missing unavailable. The implementation handoff records focused tests for zero, unavailable, and a deliberately inconsistent unfinished score fixture; focused suite was 16 passed. |
| Untrusted display content | Complete by source inspection | Titles and class names are interpolated as ordinary React text nodes (`QuizCard`, lines 275–278); no HTML injection API is used. Search is local and does not transmit query text. |
| Unintended actions / authority | Complete by source inspection and recorded tests | Filtering/counting operates on loaded items; the only collection request is the existing load/explicit refresh. Card links retain existing attempt/results routes. Handoff records no additional class API call in tests and no new mutation/AI/result request path. |
| Verification evidence | Recorded, not rerun for this review | Handoff records 16 focused tests, 154 tests across 14 files, build/format passed, lint exit 0 with no warnings in changed files, and `git diff --check` passed. This review independently confirmed the diff fingerprint and `git diff --check`; it did not rerun frontend tests. |

## Findings

None. Finding count: **0**.

## Gaps and limitations

- No browser session exercised navigation persistence, reload, sign-out/session loss, or account switching. Source ownership and workspace keying support the intended clearing behavior, but the acceptance scenarios have not been exercised end to end.
- No hostile markup-like title/class fixture is recorded in the supplied run. Source inspection confirms ordinary React text rendering, which escapes text content.
- No backend authorization test was rerun. This UI-only change continues to rely on the existing authenticated student collection and attempt/result ownership controls.
- Manual rendered geometry and navigation/session-boundary checks were not performed, as noted in the implementation evidence. Geometry is outside this security verdict but remains an acceptance limitation.

## Handoff

- **Implementation follow-up required:** NO.
- **Edit documentation:** NO.
- **Rerun security review:** NO, unless follow-up changes touch collection authorization, score visibility, or preference lifetime.
- **Independent human review:** READY with the limitations above.
- **Manual checks still useful:** In a browser, navigate list → attempt/results → list, reload, sign out and sign in as another student; confirm selections persist only within the original live workspace and no previous account's selections/cards appear in the new workspace. Exercise a title/class containing markup-like text and confirm it is displayed literally.
