# Code Review Report

## Status
- Target: UI-03, `b683612e13e21cb7bdad18dea9df94e15ce0c8d7..4f747db` plus current working-tree changes in `frontend/tests/StudentUI.test.tsx`, `docs/UserGuide.md`, and `specs/frontend-spec.md`.
- Scope: Aggregate of the four supplied review axes for UI-03.
- Overall: FINDINGS
- Independent human review: READY (no unresolved Blocker/High finding; one Medium coverage finding remains).

## Checks
| Area | Status | Command/evidence |
| --- | --- | --- |
| Compilation | Not reported | No compilation result supplied in child artifacts. |
| Tests | Passed (parent-reported) | `cd frontend && npm test -- --run tests/StudentUI.test.tsx` passed 19 tests on 2026-10-22, as reported in `verification.md`; not run by aggregator. |
| Smoke/acceptance testing | Partial; fixture browser paths reported | Implementation runs 005–006 exercise UI paths and geometry with locally intercepted API responses; no live backend/deployment. See `verification.md` and `spec-contracts.md`. |
| Static analysis | Formatting passed (parent-reported); lint/type checks not reported | `npm run format:check` passed after formatting, as reported by children; no independent aggregator run. |
| Packaging/resources | N/A | No packaging/resource changes reported by code-quality reviewer. |
| Specification validation | Complete with finding | `spec-contracts.md` maps UI-03 requirements and identifies `SC-ui03-01`; no separate command reported. |
| Documentation consistency | Complete with minor omission | User Guide and frontend spec reviewed by `spec-contracts.md`; guide omits explicit statement that reload/session loss clears selections. Child classified this as minor, not contradictory, and did not request edits. |

## Next actions
- Implementation follow-up required: NO
- Edit documentation: NO
- Rerun code-review skill: AFTER FOLLOW-UP WORK
- Reason: No implementation or documentation defect was identified. The open Medium finding requests stronger automated coverage of the reset requirement from a non-default same-account state; rerun verification review after that test change.

## Agent handoff
- Follow-up required: YES
- Current implementation/review state: Code-quality and security axes pass; specification/contract axis has one open Medium acceptance-coverage finding; verification axis reports pass based on component-level reset and stale-response coverage plus fixture browser evidence.
- Next responsible skill or human: Verification reviewer or implementer maintaining `frontend/tests/StudentUI.test.tsx`.
- Priority and finding addressed: Medium, `SC-ui03-01`.
- Exact files and line locations: `frontend/tests/StudentUI.test.tsx`, test “resets quiz-list preferences after session loss and a different account signs in” (line number not supplied).
- Required change or investigation: Set non-default tab, class, and search for the same account before unmount/remount; assert all three return to defaults after remount. Preserve session-loss and distinct-account assertions.
- Constraints and out-of-scope work: Preferences remain in-memory; do not add persistence.
- Verification commands: From `frontend/`, run the focused StudentUI test suite and formatting check; the child specified `npm test -- --run tests/StudentUI.test.tsx` and `npm run format:check`.
- Manual checks: No additional manual check follows from the open finding. If UI geometry acceptance remains required, use the existing browser evidence limits: fixture-backed only, no live backend/deployment.
- Success criteria: Test fails if preferences survive a same-account workspace remount from non-default values and passes when all reset.
- Documentation impact: None required for this finding.
- Required next rerun: Verification review after the test coverage change; spec-contract review only if requirements or user-facing claims change.
- Blocker or decision needed: None.

## Findings
- `SC-ui03-01` — Medium: Reload-remount reset is not exercised from a non-default state — Status: Open
- Category: Acceptance coverage / requirement verification
- Location: `frontend/tests/StudentUI.test.tsx`, “resets quiz-list preferences after session loss and a different account signs in”.
- Requirement: UI-03 AC-03 requires reload/session/account reset; task defines preferences as in-memory and cleared on reload, session loss, sign-out, or account change.
- Evidence: `spec-contracts.md` reports that account A selects non-default values, then session loss/sign-in establishes account B defaults; the subsequent same-account remount occurs while account B is already at defaults. Therefore that remount assertion cannot detect preference retention from a non-default state. `verification.md` considers teardown/recreation evidence adequate for fresh-workspace reset, but does not contradict the reported test sequence. The focused suite is parent-reported passing (19 tests); no aggregator rerun.
- Expected / actual: Expected a same-account remount assertion from non-default selections; actual same-account remount starts from defaults already established after account change.
- Reproduction or inspection path: Inspect the test sequence and verify no tab/class/search interaction for account B occurs between its initial defaults and unmount.
- Impact: The in-memory reset implementation appears aligned by source inspection, but this specific regression condition lacks effective automated coverage.
- Likely cause / confidence: Test setup reuses account B's already-default state for the remount assertion; high confidence per spec-contract reviewer.
- Fix direction and affected responsibility: Update the test to select non-default tab, class, and search for account B before unmount/remount, then assert all reset for that same account.
- Tests to add/update: Update the existing StudentUI test as described.
- Documentation impact: None.
- Verification after fixing: Focused StudentUI suite and frontend format check; then rerun verification review.

## Positive observations
- Code-quality reviewer found explicit workspace ownership for list preferences and focused, accessible interaction tests.
- Security reviewer found preferences account-scoped and in-memory, collection filtering local, and submitted score exposure consistent with existing ownership behavior.
- Verification reviewer reports the deferred-response test rejects stale collection data and browser fixture evidence exercises navigation, filtering, score states, and target geometry.

## Gaps and limitations
- Four axes supplied: code quality, specification/contracts, security boundaries, and verification. No axis is missing or marked blocked.
- Review children report parent-run focused tests and formatting; the aggregator did not rerun checks. Compilation, lint, and type-check results were not supplied.
- Browser evidence is fixture-backed with intercepted APIs; it does not establish live backend, production, or deployed behavior. Actual browser reload/process-boundary behavior was not separately exercised.
- Code-quality reviewer notes the recorded browser evidence does not document all intermediate-width and 200% geometry measurements; contract and verification reviewers report geometry coverage at listed widths/zoom. Preserve this evidence limitation rather than treating it as a failure finding.
- The security review source-inspected backend collection authorization but did not independently test it.

## Manual checks for user
- No additional manual check is required by the open coverage finding. Browser runs are fixture-only; no live service or deployment check was reported.

## Conclusion
The supplied reviews report no implementation or security defect and find the UI-03 behavior aligned with its task and specification. One Medium coverage finding remains open: same-account remount reset should be tested after that account has selected non-default preferences. Overall verdict is FINDINGS.
