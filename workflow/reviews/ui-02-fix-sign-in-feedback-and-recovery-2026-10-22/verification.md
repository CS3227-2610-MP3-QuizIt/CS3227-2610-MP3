# Verification Review

## Status
- Target: `HEAD 0a86132f87a4e4caa32825611671e2c46cacf85d` plus combined index and worktree diff, including UI-02 untracked tests and evidence.
- Scope: UI-02 AC-01–AC-08 verification coverage and execution evidence; final reassessment of `VR-UI02-01`.
- Overall: FINDINGS
- Independent human review: NOT READY on verification evidence; the remaining AC-08 manual checks and several named acceptance partitions have not been exercised.

## Checks
| Area | Status | Command/evidence |
| --- | --- | --- |
| Compilation | Passed | From `frontend/`, `npm run build`, exit 0; TypeScript and Vite production build. |
| Tests | Passed, with coverage gaps | From `frontend/`, `npm test`, exit 0; 14 files / 148 tests. Mocked frontend behavior; no live backend/deployed behavior established. |
| Smoke/acceptance testing | Incomplete | Pass-two handoff reports desktop Chrome at 1512×750 CSS px, dpr 2; inspected associated long validation error, desktop fit and keyboard order. Parent separately reports backend-at-127.0.0.1:7000 explicit Check session restored signed-out copy and Sign in; parent-reported, not independently rerun. No phone/breakpoint, reliable 200% zoom or actual screen-reader evidence. |
| Static analysis | Passed with warnings | From `frontend/`, `npm run lint`, exit 0; warnings in `useResource`, shared UI, AuthProvider effect/ref/dependency patterns and LoginPage ref access. |
| Packaging/resources | Not applicable | No packaging/resource behavior changed for UI-02. |
| Specification validation | Supported in part | Compared UI-02 AC-01–AC-08 with final test inventory and pass-two handoff; evidence is materially improved but not exhaustive (see finding). |
| Documentation consistency | Supported in scope | Handoff reports the User Guide recovery wording update. No user-guide behavior was independently exercised. |
| Formatting | Passed | From `frontend/`, `npm run format:check`, exit 0. |
| Diff hygiene | Passed | Repository root `git diff --check`, exit 0. |

## Prior finding resolution
- `VR-UI02-01` — Medium — Important login timing, race, and usability acceptance partitions remain unverified — **Partially resolved; remains Open**.
- Pass two closes the specifically identified signed-out recovery dead end with tests showing a current explicit 401 restores credential entry, does not replay login, and allows only explicit subsequent retry; failed checks remain actionable and do not poll. This verifies the core recovery correction that was only partial in pass one.
- New regression evidence covers username empty/short/non-ASCII and max boundary, short/maximum/preserved-space password, Enter and duplicate activation, Show/Hide, invalid-field focus, identity GET 401/503/transport classification, controlled elapsed wait expiry and a subsequent deadline, malformed nonfinite/negative timing, session-ended reason retention, deliberate logout racing session loss, and stale identity/401/SSE outcomes. Combined student/teacher/admin tests cover mocked role routing. Pass-two focused run is reported as 5 files / 48 tests; the full suite independently rerun here passes 14 files / 148 tests.
- Finding remains open because identifiable acceptance partitions remain uncovered: AC-05 shorter-deadline replacement and unmount/cleanup/background-tab behavior; AC-06/07 late logout completion after another identity and broader overlapping identity/account-switch event orders; AC-08 phone, 640/641 breakpoint, reliable 200% zoom and screen-reader announcements. Other gaps are itemized below. These are verification gaps, not asserted implementation defects.

## Findings
- `VR-UI02-01` — Medium — Remaining sign-in timing, race and usability partitions lack direct verification — Status: Open
- Category: Verification coverage
- Location: `frontend/tests/LoginPage.test.tsx`, `frontend/tests/authApi.test.ts`, `frontend/tests/StudentSession.test.tsx`; UI-02 AC-01–AC-08.
- Requirement: UI-02's planned verification requires boundary and state-transition outcomes, rate-deadline behavior, stale-work protection, and compact login browser/accessibility checks.
- Evidence: Pass two adds outcome-based tests for the corrected recovery path and several previously missing partitions. Final local run passes all 148 frontend tests. Its handoff explicitly lists remaining timing/race/manual limits; browser inspection is implementer-reported, and the additional working-backend recovery smoke is parent-reported.
- Expected / actual: Each material acceptance partition should have regression or manual evidence. Actual: the core failed-check-to-signed-out recovery, non-replay, explicit retry, and representative timing/stale-work cases are now tested; some timing replacement/cleanup and identity-race permutations and much of AC-08 remain untested.
- Reproduction or inspection path: Compare task AC-05–AC-08 planned verification with pass-two handoff sections “Verification finding and coverage added” and “Remaining verification limits”; inspect tests named `expires a known retry wait...`, `keeps recovery available...`, and stale identity/session tests.
- Impact: Passing tests do not establish the untested deadline lifecycle/race permutations or responsive and assistive technology experience. No specific code defect is claimed.
- Likely cause / confidence: The bounded pass prioritized core recovery and representative partitions; high confidence, as the implementation handoff explicitly acknowledges these gaps.
- Fix direction and affected responsibility: Add controlled-clock coverage for shorter replacement and cleanup/unmount where those behaviors are relied on, deferred-promise coverage for late logout/account identity ordering, and complete available viewport/accessibility checks. Treat unavailable screen-reader/platform checks as explicit limitations rather than inferred passes.
- Tests to add/update: AC-05 shorter-deadline replacement and timer cleanup; AC-06/07 late logout and overlapping identity/account-switch outcomes; AC-08 supported viewport and accessibility evidence. Add only if parent requires complete acceptance evidence.
- Documentation impact: Keep the pass-two handoff and this residual matrix aligned; no User Guide change is needed for this evidence finding.
- Verification after fixing: From `frontend/`, run `npm test`, `npm run format:check`, `npm run lint`, `npm run build`; record browser dimensions, interactions and assistive technology/platform evidence actually available.

## Positive observations
- The previously dead-ended uncertain sign-in state now has direct outcome tests for explicit signed-out recovery, restored credentials and explicit-only login retry.
- Tests assert no polling after failed explicit checks and preserve current recovery actionability.
- API-wrapper tests retain actual timeout evidence, prefer JSON retry timing over header-only timing, and guard late protected 401 dispatch after generation changes.
- Pass-two evidence distinguishes local desktop inspection from backend and deployed behavior and candidly records unavailable checks.

## Gaps and limitations
- AC-05: actual browser background-tab throttling, deadline unmount/cleanup and shorter replacement are not verified. Malformed JSON shape coverage is not exhaustive.
- AC-06/07: no dedicated late logout response after a different current identity or exhaustive overlapping identity/account-switch/session-loss event ordering is exercised. Mocked existing saved-answer/submission/results tests do not prove backend persistence.
- AC-08: phone layout, exact 640/641px breakpoint, reliable 200% zoom, and actual screen-reader announcements remain unverified. Handoff attributes the limits to no viewport override, ineffective zoom shortcuts and no screen-reader application.
- No backend test, cross-origin, deployed, live service, database persistence or authenticated role-recovery check was run in this review. Pass-two role routing evidence is mocked.
- Lint exited successfully with warnings; no lint failure was observed. Semgrep is outside this axis and no successful scan is claimed.

## Manual checks for user
- Complete AC-08 evidence where the target environment permits: phone layout, 640/641px boundary, long messages at narrow width, reliable 200% zoom, real screen-reader announcements, and saved-answer/submission/results recovery. Existing desktop evidence covers only desktop rendering, accessibility tree association and keyboard focus order.

## Conclusion
Pass two materially resolves the recovery defect in `VR-UI02-01`: explicit session confirmation can return a user to sign-in without replaying credentials, and failed checks remain actionable. The final 148-test suite, formatting check, lint, and build pass. Keep the finding open for the specifically listed timing/race partitions and AC-08 manual evidence; distinguish those evidence limits from environmental constraints (viewport control and screen-reader unavailability) and from untested acceptance behaviors (shorter deadline replacement, timer cleanup, late logout/account-switch ordering). No application defect is asserted by this finding.

## logging_summary
- **Target and scope:** `HEAD 0a86132` plus combined index/worktree diff and UI-02 evidence; verification-only reassessment of `VR-UI02-01`.
- **Verdict:** Finding partially resolved, remains Open. Pass two directly covers the corrected signed-out recovery, non-replay and explicit retry, plus new validation, timing, role-routing, session-loss and stale-work outcomes. Residual gaps are enumerated in the finding and limitations.
- **Checks run by this reviewer:** from `frontend/`, `npm test` passed (14 files/148 tests); `npm run format:check` passed; `npm run lint` exited 0 with warnings; `npm run build` passed. From repo root, `git diff --check` passed.
- **Other evidence:** pass-two handoff reports focused 5-file/48-test run and local desktop Chrome inspection at 1512×750 CSS px, dpr 2, including error association and keyboard order. Parent-reported backend smoke saw explicit Check session restore signed-out copy and Sign in. Neither was independently rerun here. No backend/deployed/live-service check is claimed.
- **Remaining:** shorter deadline replacement, timer cleanup/background behavior, late logout/account-switch race orderings, phone/breakpoint/200% zoom/screen-reader and persistence/deployment evidence.
