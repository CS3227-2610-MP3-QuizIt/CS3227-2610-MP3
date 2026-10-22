# Security Boundary Review — UI-03 My quizzes

## Status
- Target: Current complete working tree at `b683612e13e21cb7bdad18dea9df94e15ce0c8d7`; tracked product diff SHA-256 `dd66c070b65971eeb8dc1321d3941808ff4fb3addcf42b089a6e19b4a4ff4f43`; untracked preferences module SHA-256 `2c72fb3f7667337859a3c6360788714f64ce4688c4bd9112a4365b7c26946d7a`.
- Scope: Security and trust boundaries affected by the My quizzes collection UI, including authorization assumptions, score visibility, preference lifetime, unsafe rendering, and read/mutation behavior. Reviewed task brief, AGENTS.md, frontend spec, User Guide, security note, changed implementation, and implementation evidence runs 001–006.
- Overall: PASS
- Findings: 0

## Boundary assessment

| Boundary | Result | Evidence |
| --- | --- | --- |
| Authenticated collection ownership | Pass | Frontend continues using only `api.studentQuizzes()` for the collection; the request is `GET /quizzes`. The route receives `CurrentUser`; `Core.list_quizzes` scopes student rows to `a.student_id = user["id"]` and published quizzes. Class filtering in the browser narrows that response and grants no authority. |
| Score and answer exposure | Pass | The backend emits `score` only when the student's own attempt status is `submitted`; the UI likewise renders score only in a submitted card. Unfinished/inconsistent score fields are not displayed. Card rendering does not request result details, which remain on the existing results route. No answer keys or explanations were added to cards. |
| Preference privacy and identity lifetime | Pass | Search, class ID, and tab are held in React state in the student workspace. `StudentApp` keys the workspace by authenticated user ID, so session loss unmounts the state and a different identity gets a fresh workspace. No local/session storage, URL, or backend persistence was introduced. Run-002 provides an AuthProvider regression test for session loss then account switch. Run-003 records browser reload/sign-out reset; run-005 records route return retaining same-user selection. |
| Untrusted titles/class names | Pass | Quiz title and class name are interpolated as ordinary React text in cards and native `<option>` elements. No `dangerouslySetInnerHTML`, HTML parsing, or URL construction from these text values was introduced. Literal markup remains text under React rendering. |
| Collection actions and mutation surface | Pass | Search, tabs, and class selection filter the already-loaded collection in memory. The implementation adds no class membership, result-detail, attempt start, answer save/submit, or AI calls in collection render/filter paths. Existing Start/Resume and View results links preserve fixed ID-based routes. Explicit refresh remains the pre-existing collection GET. |
| Logging/secrets/private content | Pass | The change adds no logging, credentials, storage, uploads, provider calls, or private response fields. |

## Evidence and limitations

- Source inspection covered `frontend/src/student/QuizList.tsx`, `StudentApp.tsx`, `quizListPreferences.ts`, `frontend/src/api/client.ts`, `frontend/src/auth/AuthProvider.tsx`, and the student collection route/core implementation in `backend/src/quiz_backend/api.py` and `core.py`.
- Implementation runs 001–002 report focused/full frontend tests and build/lint/format checks. Run-005/006 report isolated fixture browser checks; fixture API requests were locally intercepted, with no backend, database, or AI provider access. These records support rendered-flow observations but do not constitute a live authorization integration test.
- The existing backend scoping and submitted-only score emission were verified by source inspection, not by attempting cross-account requests against a live server during this review. The backend was not changed by this task.
- No Semgrep scan was run: this review found no security configuration or backend trust-boundary implementation change that requires a scan under the skill procedure.
- Browser evidence covered isolated fixtures and the specified 320px, 390px, desktop/intermediate, and confirmed 200% zoom geometry. No new manual check remains for the assessed security boundaries.

## Conclusion

No security-boundary defect was found in the reviewed change. Existing backend ownership remains authoritative; UI filters do not expand access, scores stay limited to submitted cards, and preference state is confined to the signed-in workspace lifetime. No follow-up action is required.
