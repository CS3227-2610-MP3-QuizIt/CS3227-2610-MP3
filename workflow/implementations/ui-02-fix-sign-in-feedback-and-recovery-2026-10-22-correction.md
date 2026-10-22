# UI-02 correction implementation handoff

## Status and target

- Status: `IMPLEMENTED` (review findings corrected; acceptance and independent review remain with the parent).
- Task: [ui-02-fix-sign-in-feedback-and-recovery](../tasks/ui-02-fix-sign-in-feedback-and-recovery.md).
- Baseline: `HEAD 0a86132` on `feat/student-ui`, with UI-01 staged and unstaged work already present. The original brief baseline `bd30398` was stale for this correction pass.
- Final target: current combined shared worktree at `HEAD 0a86132`; no Git index or commit action was performed. UI-01 staged and unstaged state was preserved.
- Exact UI-02 correction paths: `frontend/src/auth/AuthProvider.tsx`, `frontend/tests/LoginPage.test.tsx`, `frontend/tests/authApi.test.ts` (new), `docs/UserGuide.md`, and this handoff. UI-01 and other shared files remain outside this correction scope.

## Findings and changes

- `CQ-UI02-01` and `SB-ui02-1`: `checkSession` now clears `uncertainSignIn` only when the current explicit identity check gets 401. It returns the signed-out state, so the UI restores credential entry and the ordinary Sign in action. The existing session-ended notice is retained when present; otherwise UI shows the generic signed-out notice. It does not automatically POST credentials. A current non-401 check failure preserves uncertainty and the Check session recovery action. Superseded checks do not mutate state.
- `SC-ui-02-01`: User Guide section 3 now directs an uncertain sign-in to **Check session** before re-entering credentials, explains confirmed signed-out and failed-check outcomes, and removes obsolete **Reconnect** guidance.
- `VR-UI02-01`: Added outcome-oriented login and client-wrapper tests for normalized invalid username/length, maximum username and preserved password whitespace, maximum password rejection, confirmed signed-out recovery and subsequent explicit retry, repeated uncertain check failure followed by signed-out recovery, positive and zero retry timing, timeout error evidence, JSON retry timing versus header-only timing, late protected-401 body parsing after session generation advances, and a late sign-in identity response after a current session-loss event. Full front-end suite and static checks passed. AC-08 browser checks were partially performed as described below; the remaining matrix is still unverified.

## Checks and evidence

All package commands below ran from `frontend/` unless stated otherwise.

- `npm test -- tests/LoginPage.test.tsx tests/authApi.test.ts` — passed, 2 files / 19 tests (focused evidence).
- `npm test` — passed, 14 files / 129 tests (mocked front-end suite).
- `npm run format:check` — passed.
- `npm run lint` — exit 0; existing warnings include `only-export-components` in shared UI/AuthProvider, `set-state-in-effect` in `shared/useResource.tsx`/AuthProvider, refs cleanup in AuthProvider, missing user deps in AuthProvider, and render-time refs in LoginPage.
- `npm run build` — passed (TypeScript and Vite production build).
- `npx prettier --write src/auth/AuthProvider.tsx tests/LoginPage.test.tsx tests/authApi.test.ts docs/UserGuide.md` — failed because it was run from `frontend/` while `docs/UserGuide.md` is at repository root; Prettier formatted the preceding frontend targets before reporting no matching docs file. The correctly scoped rerun `npm test && npm run format:check && npm run lint && npm run build` from `frontend/` passed all four commands.
- `git diff --check` — passed from repository root; no whitespace errors in the combined diff.
- `sh workflow/security/semgrep.sh` — could not start Semgrep: permission denied while opening `/Users/junhaong/.semgrep/semgrep.log`. No source finding result is claimed for this correction run.
- Browser/manual (Chrome at `http://127.0.0.1:5173`, local Vite only; no backend): inspected desktop sign-in rendering, browser accessibility tree, and keyboard focus order. The current page exposed Username, Password, Show/Hide, Sign in; the explicit Check session action was available after a failed local initial session check, and clicking it retained actionable recovery when the backend was unavailable. No credentials were entered. This did not verify authenticated role recovery or a live server.

## Unverified acceptance and limits

- AC-01: not every requested boundary was individually tested (notably username 0/3 and non-ASCII, password 0/1/128, and all click/Enter combinations).
- AC-02: duplicate activation, visibility/autocomplete behavior, and all error focus partitions were not exhaustively exercised.
- AC-03: no live/backend check; all three roles, active-cookie loss, and every GET failure category were not independently exercised in this correction pass.
- AC-04: representative repeated non-401 then 401 recovery is covered; all message replacement permutations and automatic polling absence are not exhaustively tested.
- AC-05: known 30-second wait blocks form submission, JSON timing is honored, header-only timing is ignored, and zero timing does not invent a deadline. Background-tab elapsed time, timer expiry, malformed/nonfinite values, successive deadline replacement, and deadline cleanup are not all covered by dedicated outcomes.
- AC-06/07: representative current session-loss notice, stale identity completion, and late 401 body parsing are covered. Deliberate logout failures, all event cause/race permutations, overlapping identity reads, account switching, and saved-answer/submitted-result recovery are not fully covered here.
- AC-08: desktop layout, accessibility tree, and keyboard focus order were manually inspected. Phone layout, 640/641 px boundary, long-message layout, reliable 200% zoom, actual screen-reader announcements, and saved-answer/submission/results recovery were unavailable and remain unverified. The browser's zoom shortcut did not provide reliable evidence; no screen reader was available.
- No backend, deployed, cross-origin, SoCLaaS, or live-service checks were run.

## logging_summary

- Outcome: implemented assigned correction pass for UI-02. Actual skills used: `implement-task`; project standards and `vercel-react-best-practices` were read and applied. Material choice: only a current explicit `/auth/me` 401 exits uncertain recovery; no automatic credential replay; non-401 failures retain the recovery lock.
- Finding changes: `CQ-UI02-01` and `SB-ui02-1` corrected in current-401 state transition with explicit-only retry coverage; `SC-ui-02-01` corrected in User Guide; `VR-UI02-01` materially improved with tests and partial browser evidence but remains partially open for unverified acceptance partitions listed above.
- Checks (executor: this implementation agent): from `frontend/`, focused `npm test -- tests/LoginPage.test.tsx tests/authApi.test.ts` passed (2 files/19 tests); `npm test` passed (14 files/129 tests); `npm run format:check` passed; `npm run lint` exit 0 with warnings; `npm run build` passed. The incorrect-root Prettier invocation failed for the docs path and was followed by a successful correctly scoped combined check run. From repository root, `git diff --check` passed. `sh workflow/security/semgrep.sh` failed before scanning because `/Users/junhaong/.semgrep/semgrep.log` was not writable. Evidence is worker-reported, mocked/source scope except the explicitly described local browser inspection.
- Remaining checks/limits: AC-08 phone/breakpoint/long-message/200%-zoom/screen-reader checks unavailable; no backend/deployed/live checks; additional AC-01–07 partitions remain as detailed above. No unresolved product decision or dependency blocker.
