# Code Review Report

## Status

- Target: `HEAD 0a86132f87a4e4caa32825611671e2c46cacf85d` plus combined index and worktree diff, including relevant untracked UI-02 files; UI-01 is prerequisite context and remains preserved.
- Scope: UI-02 sign-in validation, feedback, uncertainty recovery, rate-limit waiting, session-loss notices, stale-work guards, affected specifications and User Guide.
- Overall: WARN
- Independent human review: NOT READY on verification evidence; the verification specialist explicitly retains this status pending named acceptance and manual checks.

## Checks

| Area | Status | Command/evidence |
| --- | --- | --- |
| Compilation | Passed; verification reviewer ran `npm run build` from `frontend/`, exit 0. Code-quality and security reports also cite pass-two executor evidence. |
| Tests | Passed with coverage gaps; verification reviewer ran `npm test` from `frontend/`, 14 files / 148 tests, exit 0. Mocked frontend scope; does not establish live backend or deployed behavior. |
| Smoke/acceptance testing | Incomplete. Pass-two handoff reports desktop Chrome inspection at 1512×750 CSS px, dpr 2, covering desktop fit, associated long validation error and keyboard order. Parent-reported local backend recovery smoke is not independently rerun. Phone/breakpoint, reliable 200% zoom and screen-reader checks remain unverified. |
| Static analysis | `npm run lint` from `frontend/` exited 0 with warnings per verification report. Security reviewer ran `sh workflow/security/semgrep.sh` from repository root: Semgrep 1.170.0, 225 rules, 42 of 48 tracked files scanned, zero findings, exit 0; partial parsing warning at `backend/src/quiz_backend/ai.py:301`. Untracked UI-02 files/tests/docs were outside tracked-file scan scope. |
| Packaging/resources | Not applicable; no packaging/resource behavior changed in UI-02. |
| Specification validation | Code-quality and contract axes report PASS; requirements and contract alignment inspected. Verification retains an open Medium finding for named unverified AC partitions. |
| Documentation consistency | Contract axis reports PASS; prior `SC-ui-02-01` is Fixed. User Guide now advises Check session for uncertain outcomes and describes signed-out/failed-check outcomes. |
| Formatting and diff hygiene | Verification reviewer reports `npm run format:check` from `frontend/` and repository-root `git diff --check` passed. |

## Next actions

- Implementation follow-up required: YES
- Edit documentation: NO
- Rerun code-review skill: AFTER FOLLOW-UP WORK
- Reason: The behavioral recovery and documentation defects are fixed. `VR-UI02-01` remains Open for incomplete acceptance evidence, including timing cleanup/replacement, identity race permutations and AC-08 manual checks. Add or record evidence for the applicable partitions; rerun affected review axes afterward.

## Agent handoff

- Follow-up required: YES
- Current implementation/review state: All four axes supplied. `CQ-UI02-01`, `SC-ui-02-01`, and `SB-ui02-1` are Fixed. `VR-UI02-01` remains Open, Medium; it identifies verification gaps and does not assert an application defect.
- Next responsible skill or human: Verification follow-up, then rerun affected review axes; human acceptance review after evidence is complete or remaining limitations are explicitly accepted.
- Priority and finding addressed: Medium `VR-UI02-01`; residual AC-05/06/07 and AC-08 evidence.
- Exact files and line locations: `frontend/tests/LoginPage.test.tsx`, `frontend/tests/authApi.test.ts`, `frontend/tests/StudentSession.test.tsx`; UI-02 AC-05–AC-08.
- Required change or investigation: Add controlled-clock evidence for shorter retry-deadline replacement and timer cleanup/unmount where relied upon; cover late logout completion after another identity and broader account-switch/session-loss ordering; record available responsive and accessibility checks. Treat unavailable platform checks as limitations.
- Constraints and out-of-scope work: Preserve UI-01 prerequisite changes. No backend auth/session/cookie/Origin changes are indicated by these reviews.
- Verification commands: From `frontend/`: `npm test`, `npm run format:check`, `npm run lint`, `npm run build`; record browser dimensions, interactions and assistive technology/platform evidence actually available.
- Manual checks: Phone layout, 640/641px boundary, long messages at narrow width, reliable 200% zoom, actual screen-reader announcements, and saved-answer/submission/results recovery. Desktop fit, error association and keyboard order have reported evidence only.
- Success criteria: Named applicable partitions have direct regression or manual evidence, and any unavailable platform checks remain explicit; then rerun affected review axes.
- Documentation impact: No further User Guide edit identified. Keep implementation/review evidence aligned with any additional manual results.
- Required next rerun: Code-quality, security-boundary, contract and verification review as applicable after test, implementation, documentation or evidence changes.
- Blocker or decision needed: None reported.

## Findings

### Code quality

- `CQ-UI02-01` — Medium — Explicit signed-out recovery leaves the form locked in recovery mode — Status: Fixed
- Category: State ownership / maintainability with functional consequence
- Location: `frontend/src/auth/AuthProvider.tsx:81-101`; recovery UI and tests in `frontend/src/auth/LoginPage.tsx` and `frontend/tests/LoginPage.test.tsx`.
- Requirement: A current explicit check confirming signed out restores credential entry; other failed checks retain recovery.
- Evidence: Current 401 clears `uncertainSignIn`; stale work does not mutate state and non-401 failure keeps uncertainty. Supplied tests cover restored fields, no login POST during checking, deliberate subsequent login and 503 retention.
- Expected / actual: Expected signed-out confirmation to end recovery without replaying credentials; source and tests now show that transition.
- Reproduction or inspection path: Inspect `checkSession` and signed-out/failed-check test outcomes.
- Impact: Prior recovery dead end resolved.
- Likely cause / confidence: Prior branch omitted the state transition; high confidence from source and outcome tests.
- Fix direction and affected responsibility: Implemented in `AuthProvider.checkSession`; no further change indicated.
- Tests to add/update: None for this finding.
- Documentation impact: None further.
- Verification after fixing: Executor reports focused and full suites passed; reviewer inspected evidence but did not rerun these checks.

### Specification and contracts

- `SC-ui-02-01` — Low — User Guide retained obsolete sign-in recovery instructions — Status: Fixed
- Category: Documentation consistency
- Location: `docs/UserGuide.md`, sign-in instructions in sections 1 and 3.
- Requirement: Uncertain sign-in is checked before resubmitting credentials and guidance names the actual recovery action.
- Evidence: Updated guide directs users to Check session, explains signed-out restoration and failed-check behavior, and removes obsolete Reconnect advice.
- Expected / actual: Expected guidance consistent with current recovery controls; final guide is reported aligned.
- Reproduction or inspection path: Compare updated guide recovery text with the UI-02 recovery behavior.
- Impact: Prior misleading recovery advice resolved.
- Likely cause / confidence: Earlier text was not reconciled with the revised flow; fixed in final target.
- Fix direction and affected responsibility: Implemented in User Guide; no further change indicated.
- Tests to add/update: None required for this documentation correction.
- Documentation impact: Finding resolved.
- Verification after fixing: Contract reviewer inspected guide and UI labels; no checks were rerun by that reviewer.

### Security boundaries

- `SB-ui02-1` — Medium — Explicit signed-out session check leaves login locked in recovery — Status: Fixed
- Category: Session recovery / authentication availability
- Location: `frontend/src/auth/AuthProvider.tsx:92-99`; recovery state in `frontend/src/auth/LoginPage.tsx`.
- Requirement: A confirmed signed-out check restores credential entry without replay; other check failures retain recovery.
- Evidence: Current `/auth/me` 401 clears uncertainty; focused test verifies editable fields, no automatic login replay, deliberate subsequent login, and 503 retention.
- Expected / actual: Expected explicit retry path after signed-out confirmation; current source/test demonstrate it.
- Reproduction or inspection path: Inspect `checkSession()` 401 branch and focused recovery test.
- Impact: Prior authentication recovery availability defect resolved; no bypass or exposure was identified.
- Likely cause / confidence: Prior 401 branch omitted reset; direct source/test evidence, high confidence.
- Fix direction and affected responsibility: No further security fix indicated.
- Tests to add/update: None required for this finding.
- Documentation impact: None.
- Verification after fixing: Focused test inspected; supplied pass-two checks are not security-reviewer reruns.

### Verification and evidence

- `VR-UI02-01` — Medium — Remaining sign-in timing, race and usability partitions lack direct verification — Status: Open
- Category: Verification coverage
- Location: `frontend/tests/LoginPage.test.tsx`, `frontend/tests/authApi.test.ts`, `frontend/tests/StudentSession.test.tsx`; UI-02 AC-01–AC-08.
- Requirement: Material acceptance partitions require regression or manual evidence for rate deadlines, stale work and login usability/accessibility.
- Evidence: Verification reviewer ran the full frontend suite (14 files / 148 tests) successfully. Pass two adds signed-out recovery/no-replay/explicit retry and representative validation, timing, session and stale-work outcomes. Remaining partitions are explicitly listed in its report.
- Expected / actual: Expected applicable partitions to have direct evidence; shorter-deadline replacement, timer cleanup/unmount/background behavior, late logout/account-switch ordering, and much of AC-08 remain unverified.
- Reproduction or inspection path: Compare task AC-05–AC-08 verification plan with the pass-two handoff coverage and residual limits summarized in `verification.md`.
- Impact: Passing suite does not establish these lifecycle/race permutations or responsive and assistive-technology behavior. No specific code defect is asserted.
- Likely cause / confidence: Bounded pass prioritized core recovery and representative cases; high confidence, gaps are acknowledged in handoff.
- Fix direction and affected responsibility: Add controlled-clock and deferred-promise tests for the named partitions, and record available viewport/accessibility evidence. Preserve unavailable platform checks as limitations.
- Tests to add/update: AC-05 shorter deadline replacement and timer cleanup; AC-06/07 late logout and overlapping identity/account-switch outcomes; AC-08 viewport and accessibility evidence as available.
- Documentation impact: Keep handoff and residual matrix aligned; no User Guide change required.
- Verification after fixing: From `frontend/`, run `npm test`, `npm run format:check`, `npm run lint`, `npm run build`; record browser dimensions/interactions and accessibility platform actually used.

## Positive observations

- The current explicit 401 recovery transition now restores credential entry without credential replay, and failed checks remain actionable.
- Credentials remain transient and backend-submitted; role authority remains based on `/auth/me`.
- Session generation and stale-response guards are explicit; AI SSE is described as metadata-only with authoritative state fetched separately.
- Pass-two tests assert user-visible outcomes, including no polling or automatic login during recovery.
- Reviews distinguish mocked frontend tests, source inspection, local desktop browser inspection, parent-reported backend smoke, and live/deployed behavior.

## Gaps and limitations

- All four required axes have exactly one artifact; none is missing or marked blocked.
- Code-quality and contract reviewers ran no checks; they relied on supplied execution evidence. Security scan is advisory and had one partial-parsing warning; it scanned 42 of 48 tracked files and excluded untracked UI-02 files/tests/docs.
- No backend test, cross-origin, deployed, live-service or database-persistence check is evidenced. Parent-reported backend recovery smoke was not independently rerun. Mocked role routing does not prove backend authorization or persistence.
- Remaining verification gaps are AC-05 shorter deadline replacement, timer cleanup/background behavior and malformed JSON shape completeness; AC-06/07 late logout/account-switch ordering; and AC-08 phone layout, 640/641px boundary, reliable 200% zoom and actual screen-reader announcements.
- The axes inspect the same UI-02 target; they are separate responsibilities, not independent implementation replicas. UI-01 remains context and is not a finding.

## Manual checks for user

- Check phone layout, the 640/641px boundary, long messages at narrow widths, reliable 200% zoom, actual screen-reader announcements, and saved-answer/submission/results recovery. Desktop-only fit, error association and keyboard order have reported evidence. No live/deployed authentication behavior is established.

## Conclusion

The recovery and User Guide findings are fixed in the final target. The verification review retains one Medium Open finding for specific untested timing, race and accessibility partitions, so the aggregate verdict is WARN and independent human review is not ready on the current evidence. Reported build, tests, lint, formatting, diff hygiene and Semgrep results are attributed to their respective reviewers or handoff and are not aggregator reruns.

## logging_summary

- **Fixed target and axes:** `HEAD 0a86132f87a4e4caa32825611671e2c46cacf85d` plus combined index/worktree diff and relevant untracked UI-02 files; UI-01 preserved as context. All four axes complete, no missing/blocked child. Sources: `workflow/reviews/ui-02-fix-sign-in-feedback-and-recovery-2026-10-22/{code-quality,spec-contract,security,verification}.md`.
- **Finding disposition:** `CQ-UI02-01` Medium Fixed; `SC-ui-02-01` Low Fixed; `SB-ui02-1` Medium Fixed; `VR-UI02-01` Medium Open. Follow-up: add/record AC-05 deadline lifecycle, AC-06/07 race ordering and AC-08 manual evidence; then rerun applicable axes. No further documentation edit identified.
- **Checks reported by review children:** Verification reviewer, `frontend/`: `npm test` passed, 14 files/148 tests (mocked frontend); `npm run format:check` passed; `npm run lint` exit 0 with warnings; `npm run build` passed. Repository root: `git diff --check` passed. Evidence: `verification.md`. Security reviewer, repository root: `sh workflow/security/semgrep.sh`, Semgrep 1.170.0/225 rules, 42 of 48 tracked files, zero findings, exit 0, partial parsing warning at `backend/src/quiz_backend/ai.py:301`; evidence: `security.md`. Code-quality cites pass-two executor reports of focused 5-file/48-test and full 14-file/148-test runs, format, lint, build and diff-check; code-quality reviewer did not run checks (`code-quality.md`). Contract reviewer ran no checks and cites the correction handoff (`spec-contract.md`). Pass-two handoff also reports desktop Chrome inspection at 1512×750 CSS px, dpr 2; parent separately reports local backend signed-out recovery smoke. These latter checks were not independently rerun by the verification reviewer. No live/deployed scope is claimed.
- **Remaining/manual and independence limits:** AC-05 shorter deadline replacement, timer cleanup/unmount/background behavior; AC-06/07 late logout/account-switch ordering; AC-08 phone/breakpoint/zoom/screen-reader and saved-answer/submission/results recovery; no backend/deployed/cross-origin/persistence evidence. Axes review one shared target; aggregator performed no checks.
