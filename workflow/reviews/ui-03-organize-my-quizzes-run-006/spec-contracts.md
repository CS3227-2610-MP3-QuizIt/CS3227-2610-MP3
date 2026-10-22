# Specification and Contract Review

## Status
- Target: `b683612e13e21cb7bdad18dea9df94e15ce0c8d7..4f747db` plus current working-tree changes to `frontend/tests/StudentUI.test.tsx`, `specs/frontend-spec.md`, and `docs/UserGuide.md`.
- Scope: UI-03 student quiz collection requirements, changed frontend specification and user guidance, and supplied acceptance evidence.
- Overall: PASS
- Independent human review: READY

## Requirement mapping

| Requirement | Implementation and evidence | Assessment |
| --- | --- | --- |
| Status tabs, combined title/class search and class-ID filtering, count semantics, stable in-progress-first ordering | `QuizList.tsx` derives class choices and counts from the complete fetched collection, filters by class ID and trimmed case-insensitive title/class substring, and moves in-progress items first while retaining relative order within groups. Parent reports the focused UI suite passes 19 tests. | verified by source and supplied automated evidence |
| Empty/loading/error behavior and refresh handling | Tabs remain present before data; counts remain unknown until successful data; selected-empty/no-match states provide recovery. Failed refresh preserves prior data, and the added stale-response test ensures an older request cannot overwrite a newer result. | verified by source and supplied automated evidence |
| Preference lifetime: navigation retention, reload/session/account reset, and removed-class fallback | `StudentWorkspace` owns in-memory preferences keyed by authenticated user ID; route navigation keeps them, while workspace unmount/account change resets them. A successful collection missing the selected class falls back to All classes. The test now selects non-default tab, class and search for account B, unmounts/remounts the same account, then asserts all three defaults; it separately exercises session loss and account change. | verified by source and updated acceptance test |
| Card actions, submitted-only score and zero/unavailable behavior, singular question count | Original attempt/results routes and action labels remain; only submitted cards display collection score, with null/omitted unavailable and zero retained; singular question wording is implemented. Parent-reported focused tests and fixture browser runs 005–006 cover these behaviors. | verified by source and supplied evidence |
| Layout and target dimensions | CSS implements the collection panel, footer, wrapping and 44px targets. Runs 005–006 report fixture-backed browser geometry at 320, 390, 1280 CSS px and 200% zoom, including row action alignment, title wrapping and overflow. | verified within recorded fixture/browser scope |
| Updated user and frontend specification claims | `frontend-spec.md` now specifies tab keyboard behavior, controls, counts, ordering, submitted score handling and workspace-local selections. The User Guide explains the controls, keyboard navigation, counts, submitted scores and retention while navigating during the signed-in session. These claims match the implementation and task. | verified/aligned |

## Checks and evidence

| Area | Status | Evidence |
| --- | --- | --- |
| Specification validation | Complete | Compared UI-03 task criteria with implementation, changed spec and guide. |
| Documentation consistency | Complete | Read changed User Guide and frontend specification; no contradiction found. |
| Automated tests | Supplied evidence | Parent reports focused UI suite passes 19 tests. The updated same-account remount test now starts from non-default preferences. This reviewer did not rerun tests. |
| Formatting | Supplied evidence | Parent reports `npm run format:check` passes on 2026-10-22; not rerun here. |
| Browser acceptance | Supplied evidence | Runs 005–006 report local mocked-fixture Chrome checks, including measured geometry. These are not live backend or deployed checks. |

## Next actions
- Implementation follow-up required: NO
- Edit documentation: NO
- Rerun code-review skill: NO
- Reason: Requirements and user-facing claims align. The previous test coverage gap is corrected and the supplied focused-suite result passes.

## Agent handoff
- Follow-up required: NO
- Current implementation/review state: UI-03 behavior and changed contracts align; prior SC-ui03-01 test-coverage gap is fixed.
- Next responsible skill or human: None required by this review.
- Priority and finding addressed: Previous Medium finding `SC-ui03-01`, now Fixed.
- Exact files and line locations: `frontend/tests/StudentUI.test.tsx`, test “resets quiz-list preferences after session loss and a different account signs in”.
- Required change or investigation: None.
- Constraints and out-of-scope work: No application behavior or persistence change required.
- Verification commands: Parent reports focused UI suite and `npm run format:check` passed; this reviewer did not execute commands.
- Manual checks: No additional manual check required by this specification review; supplied runs 005–006 address recorded browser geometry and flows.
- Success criteria: Same-account remount after non-default selections resets tab, class and search; met by the updated test and supplied suite result.
- Documentation impact: None.
- Required next rerun: None.
- Blocker or decision needed: None.

## Findings
- `SC-ui03-01` — [Medium] Reload-remount reset is not exercised from a non-default state — Status: Fixed
- Category: Acceptance coverage / requirement verification
- Location: `frontend/tests/StudentUI.test.tsx`, test “resets quiz-list preferences after session loss and a different account signs in”.
- Requirement: UI-03 AC-03 requires reload/session/account reset; preferences are in-memory and clear on reload, session loss, sign-out or account change.
- Evidence: The test now sets Submitted, class ID 22 and a nonempty search for account B before unmounting. It remounts `StudentApp` with the same account identity and asserts To do, All classes and empty search. Parent reports the focused UI suite passes.
- Expected / actual: Expected an effective same-account remount check from non-default selections; actual updated test performs that check and verifies reset.
- Reproduction or inspection path: Inspect the account-B interactions immediately before `firstSession.unmount()` and the default assertions after remount in `frontend/tests/StudentUI.test.tsx`.
- Impact: The reload/remount lifetime contract now has a regression check.
- Likely cause / confidence: Original test began the remount phase with already-default preferences; that setup is corrected. High confidence.
- Fix direction and affected responsibility: Fixed by strengthening the test setup and same-account remount assertion; no production change required.
- Tests to add/update: Updated existing StudentUI test; parent reports focused suite passed.
- Documentation impact: None.
- Verification after fixing: Parent reports focused UI suite passed (19 tests) and frontend formatting check passed on 2026-10-22.

## Positive observations
- The class selector is derived from the fetched student collection and distinguishes duplicate names by ID.
- Submitted scores use the collection payload and avoid per-card results reads; zero and unavailable values are handled distinctly.
- Browser records clearly identify mocked fixture scope and include concrete measurements at the required narrow, intermediate, desktop and 200% views.

## Gaps and limitations
- Test and formatting results were supplied by the parent and not independently rerun.
- Browser runs use locally intercepted API fixtures, not a live backend, AI provider or deployed environment.

## Manual checks for user
- No additional manual checks required by this specification review; run records 005–006 contain the relevant fixture-backed browser observations.

## Conclusion
The scoped UI-03 implementation, frontend specification and User Guide align with the approved requirements. The previous SC-ui03-01 acceptance-test gap is fixed by exercising same-account remount from non-default preferences. No open specification-contract findings remain.
