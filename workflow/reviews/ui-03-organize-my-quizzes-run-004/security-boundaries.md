# Security-boundary review — UI-03 My quizzes

## Scope and evidence

- Target: baseline `b683612e13e21cb7bdad18dea9df94e15ce0c8d7` through `4f747db`, including current working-tree changes observed for the assigned files.
- Scope: student score display, local search/class/status controls, preference lifetime across routes and accounts, and keyboard-driven status selection. Reviewed the task brief, frontend specification, linked UI-03 security checks, changed frontend code, backend collection query/response, focused tests, and supplied run-005/run-006 browser evidence.
- Security result: **PASS — no security-boundary finding identified.**

## Boundary assessment

| Boundary | Evidence and assessment |
| --- | --- |
| Score ownership and answer exposure | `backend/src/quiz_backend/core.py:491-508` scopes student collection rows to `a.student_id = user["id"]` and only serializes score for submitted attempts. The UI displays score only when `attempt_status === "submitted"` and displays null as unavailable (`frontend/src/student/QuizList.tsx:307-346`). It does not request per-card results or include answer keys/explanations. The focused test supplies a deliberately inconsistent unfinished score and verifies it is not rendered, plus checks unavailable submitted score (`frontend/tests/StudentUI.test.tsx:257-283`). This change does not weaken backend authority.
| Account-scoped preference state | Preferences are held in React state in the signed-in `StudentWorkspace`; the workspace is keyed by `user.id`, and it is absent while no user is authenticated (`frontend/src/student/StudentApp.tsx:21-43`). Route changes preserve the parent state while the list component is replaced; no browser storage, URL, or backend persistence is introduced. A focused test exercises session loss followed by another account and checks defaults (`frontend/tests/StudentUI.test.tsx:54-105`).
| Filtering and controls | Search, status, class options, counts, and ordering operate on the one authenticated collection response (`frontend/src/student/QuizList.tsx:37-105`). The class selector is keyed by class ID, including duplicate names. Controls only update local preferences; links retain existing attempt/results routes. No new authority or mutation path is introduced.
| Untrusted titles/class labels | Quiz titles and class names are interpolated as React text nodes/options (`frontend/src/student/QuizList.tsx:319-322, 225-237`), preserving React escaping. No `dangerouslySetInnerHTML`, HTML parsing, or dynamic code execution is introduced in the changed rendering path. The supplied tests do not appear to include literal markup-like fixture text; source inspection establishes the safe rendering mechanism.
| Keyboard interaction | Tab navigation changes only the local selected tab and focus (`frontend/src/student/QuizList.tsx:157-191`). It does not invoke API mutations or privileged operations. No trust-boundary change arises from the keyboard refinement.

## Findings

None. Finding count: **0**.

## Verification and limitations

- Parent-provided evidence: `cd frontend && npm test -- --run tests/StudentUI.test.tsx` passed 18 tests and `npm run format:check` passed on 2026-10-22. These are treated as supplied execution evidence, not independently rerun.
- Supplied run-005/run-006 records describe isolated mocked-browser checks. They support rendered behavior and layout; they are not evidence of live backend authorization, browser/deployment session behavior, or AI/provider behavior. No live service was required for this frontend-only boundary review.
- Account reset and unfinished-score hiding have focused tests. There is no explicit supplied test for a stale in-flight collection response completing after account switch, nor a literal markup-like title/class fixture. The account-keyed workspace unmount and escaped React text rendering provide source-level controls; residual race behavior is not independently established here.
- No manual security check is required for this UI-only change based on the reviewed implementation. Backend authorization remains the controlling boundary and is unchanged by the target.
