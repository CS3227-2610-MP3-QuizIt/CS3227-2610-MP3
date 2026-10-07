# Teacher UI implementation and acceptance evidence

Scope: implement the teacher browser workspace against `specs/frontend-spec.md` and
the existing backend contracts. Product requirements, backend behavior, database
schema, and dependencies are unchanged. No SDD toolkit or deployment was used.

Read the repository guidance, assignment brief, frontend specification, relevant
backend specification/routes/schemas, and existing frontend implementation. Applied
the local React performance skill. Implemented separate teacher screens while reusing
authentication, typed cookie API access, visual components, and the existing summary
reconciliation algorithm through a shared generic store and SSE hook.

| Acceptance behavior | Implementation / evidence |
| --- | --- |
| Authenticated teachers see their assigned classes and own quizzes | `TeacherApp`, `TeacherLists`; session routing test; backend scopes list reads |
| DOCX upload followed by private draft creation | `CreateQuizPage`; multipart API test; upload success/rejection, file type/size, class-change, and no-class component tests |
| Default five questions, range 1–10; bounded title/prompt | Draft setup and generation forms; defaults and request payload tested; backend validates independently |
| Initial ensure; explicit reprompt/retry uses new and fresh key | Draft component and generation-store tests |
| Uncertain repeats retain original revision, prompt, action, and key | Generation-store test; no automatic POST retry |
| Latest state with version guards, coalesced reads, backoff and five-second polling | Shared `TargetStore`; existing 11 summary tests plus teacher generation tests |
| Subscribe before reads; reconnect/focus/online reconciliation; clear on session loss | Shared SSE hook; session tests including React StrictMode cleanup |
| Draft stays visible during running/failed work; latest failure shown | Generation-store and draft component tests; no fallback to older task success |
| Review keys/explanations and publish exact reviewed revision | Draft component tests cover review gate, new revision reset, pending controls, stale publication rejection and success |
| Current quiz comes from separate read; historical result cannot replace it | Store and component tests; monotonic revision/published-status merge |
| Generated markup renders safely as text; SSE cannot supply result/error | Draft text-rendering and session notification tests |
| Published content has no generation/publication controls | Publication component test and read-only published view |

Final observed checks (2026-10-07): `npm run build` passed TypeScript compilation and
Vite production bundling; `npm test -- --reporter=dot` passed all 39 tests across five
files; `npm run lint` exited successfully with seven existing warnings in unchanged
authentication/shared UI/resource files; `npm run format:check` passed. `git diff --check`
passed. Final source review also checked route/session scoping, frontend/backend payload
alignment, frozen publication controls, safe text rendering, and secret/storage boundaries.
The suite includes the existing admin
summary regression tests. All backend and EventSource behavior in tests is mocked.
Upload component tests use the React form handler directly because jsdom's native
file-input validity does not recognize user-event's synthetic FileList.

No Playwright, browser end-to-end tests, live AI requests, backend mutations, commits,
or deployments are performed by this task. Manual checks remain for desktop/mobile
appearance, native file selection, keyboard navigation, and a teacher workflow against
the configured backend. Backend authorization/upload parsing/atomic publication remain
covered by its own existing implementation and tests, which were not rerun here.
