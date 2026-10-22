# UI-02 implementation handoff — 2026-10-22

## Status and target

- **Status:** IMPLEMENTED; independent acceptance/review remains with the parent.
- **Task:** [ui-02-fix-sign-in-feedback-and-recovery](../tasks/ui-02-fix-sign-in-feedback-and-recovery.md)
- **Baseline:** repository `HEAD` was `0a86132` on `feat/student-ui`. This differs from the brief's original planning baseline (`bd30398`); implementation was continued on the requested shared worktree, which already contained staged and unstaged UI-01 changes.
- **Final target:** `HEAD` remains `0a86132`; the implementation is an uncommitted working-tree diff on top of it. No staging, unstage, commit, reset, merge or push operation was run.
- **Existing shared work preserved:** staged UI-01 edits and the user's unstaged shared wordmark/home-link changes remain. Some files touched by UI-02 (`LoginPage.tsx`, `index.css`, `frontend-spec.md`) also already had staged UI-01 content; this handoff reports only UI-02 additions and leaves the index untouched.

## Changed paths for UI-02

- `frontend/src/auth/LoginPage.tsx`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/api/client.ts`
- `frontend/src/App.tsx`
- `frontend/src/shared/useAIEvents.ts`
- `frontend/src/index.css`
- `frontend/tests/LoginPage.test.tsx`
- `specs/frontend-spec.md`
- `specs/backend-spec.md`
- `docs/UserGuide.md`

No Developer Guide, backend implementation, schema or security-matrix edits were made.

## Implementation and evidence

- **AC-01/02:** Login trims and validates username length/ASCII character set and validates password length without trimming. Inline errors are associated with their fields; the first invalid field receives focus, and invalid input makes no request. Password stays masked/toggleable, valid submissions show `Signing in…`, duplicate submissions are guarded, passwords clear on failure, and only `401 INVALID_CREDENTIALS` receives the generic credential message and Password focus. Focused tests cover short-username rejection/no request and credential feedback/password clearing/focus. Other length/character boundaries and short valid passwords are implemented but not individually tested here.
- **AC-03/04:** Login POST and identity GET failures are distinguished. Transport loss and evidenced request timeout require an explicit `/auth/me` check; identity-confirmation failure never maps to wrong credentials. Checks do not replay credentials, retain a retry after failure, and route successful identity to the actual role. Tests cover an unknown login outcome and retained timeout wording. All role results, POST response loss followed by an active cookie, repeated check failures and all identity status classes were not individually exercised.
- **AC-05:** `LOGIN_RATE_LIMIT` shows the specified static text. Only a positive integer JSON retry value starts an elapsed-time countdown; input edits do not reset it, expiry only re-enables an explicit attempt, and countdown updates do not use a live announcement. The focused test suite does not include controlled-clock, malformed retry data, response replacement, or background-tab timing cases.
- **AC-06/07:** Session-loss events carry the returned error code. A known expiry or `AUTH_REQUIRED` after a confirmed identity sets an in-memory notice; unknown initial sign-out and deliberate logout remain quiet. Session generation and auth epoch checks prevent a delayed 401 or identity/logout completion from overwriting a newer session. Disposed SSE callbacks and their session-check request are guarded/aborted. Existing role session tests ran in the full suite, but the new race scenarios, loss cause table and persisted-answer/results regressions were not individually added as focused tests.
- **AC-08:** Existing compact layout was retained; inline errors use small text and the countdown stays quiet to assistive technology. No browser, screen-reader, viewport, zoom or keyboard manual check was run.
- **Contracts/docs:** Frontend auth behavior, backend credential and retry timing contracts, and User Guide sign-in recovery help were updated. Backend auth/session policy and credentials were not changed.

## Checks actually run

All commands below ran from `frontend/`, except the last source-diff check which ran at the repository root.

- `npm test` — **exit 0**, 13 files and 117 tests passed; mocked frontend suite. Evidence: terminal output from this implementation run.
- `npm run lint` — **exit 0**; existing/style warnings remain, including pre-existing warnings in `shared/ui.tsx` and `shared/useResource.ts`, plus hook/ref warnings in touched auth code. No lint errors.
- `npm run format:check` — **exit 0**; all matched frontend files formatted.
- `npm run build` — **exit 0**; TypeScript project build and Vite production build completed.
- `git diff --check` — **exit 0**; no whitespace errors.
- An earlier full `npm test` run had one transient `AdminSession.test.tsx` title assertion failure; the test passed when run alone and the subsequent full suite passed 117/117. This transient run is retained as evidence, not treated as a product failure.

## Limitations and follow-up

- No real browser/manual responsive or assistive-technology checks were performed.
- The specified acceptance matrix is broader than the new focused tests. In particular, API-level 429 malformed/replacement timing, all auth transition races, error/focus behavior for every input boundary, and all role/session recovery cases still need independent review or additional tests.
- No live backend/auth check was run. SoCLaaS and private data are not involved.
- Lint completed successfully with warnings described above.

## logging_summary

- **Outcome:** UI-02 login validation, staged auth-failure feedback, explicit uncertainty recovery, server wait countdown, known session-loss notice and stale async work guards implemented. Material choices: the auth epoch guards identity commits; a client request generation suppresses stale protected-401 events; only the request wrapper's retained `TimeoutError` evidence gets timeout wording; valid rate timing comes only from the JSON error body. Actual skills used: `implement-task`, `vercel-react-best-practices`, and `owasp-threat-modeling` (scope/control review; no matrix change was assigned).
- **Checks:** Executor: this worker. From `frontend/`: `npm test` (0; 117/117, mocked), `npm run lint` (0 with warnings), `npm run format:check` (0), `npm run build` (0). From repository root: `git diff --check` (0). The earlier transient full-test failure and successful focused rerun are recorded above. No browser/live checks.
- **Unverified:** full AC boundary/race matrix and manual responsive/accessibility checks remain unverified; see limitations. No decisions/blockers.
