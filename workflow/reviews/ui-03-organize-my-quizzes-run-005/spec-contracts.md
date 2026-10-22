# Specification and Contract Review

## Status
- Target: `b683612e13e21cb7bdad18dea9df94e15ce0c8d7..4f747db` plus current working-tree changes to `frontend/tests/StudentUI.test.tsx`, `specs/frontend-spec.md`, and `docs/UserGuide.md`.
- Scope: UI-03 student quiz collection requirements, changed frontend contract/spec and user guidance, and supplied acceptance evidence.
- Overall: FINDINGS

## Requirement mapping

| Requirement | Implementation and evidence | Assessment |
| --- | --- | --- |
| Status tabs, combined title/class search and class-ID filtering, count semantics, stable in-progress-first ordering | `QuizList.tsx` derives options and counts from the full fetched collection, filters by ID and trimmed case-insensitive title/class substring, and preserves relative ordering within sorted groups. Focused tests cover mixed states, duplicate class names, counts, and filtering. Parent reports the focused suite passes 19 tests. | verified by source and supplied automated evidence |
| Empty/loading/error behavior and refresh handling | Tabs remain rendered before data; counts are unknown until successful data; empty selected states and clear/reset recovery are implemented. Existing tests cover selected-empty and preservation after failed refresh; stale-response test verifies a late older collection does not replace the newer collection. | verified by source and supplied automated evidence |
| Preference lifetime: navigation retention, reload/session/account reset, and removed-class fallback | Preferences are held in `StudentWorkspace` state keyed by authenticated user ID, so route navigation retains them and workspace unmount/account change discards them. `QuizList` falls back to All classes only after a successful collection omits the selected ID. Tests cover session loss and different-account reset; a same-account unmount/remount is present, but only after preferences have already been reset. | implementation aligns; reload-remount test does not establish reset from non-default preferences (SC-ui03-01) |
| Card actions, submitted-only score and zero/unavailable behavior, singular question count | Actions and original routes are preserved; the collection score is used only for submitted cards and `score == null` preserves zero. Focused suite and supplied browser fixture evidence cover score zero, unavailable, action routes, and card presentation. | verified by source and supplied evidence |
| Layout and target dimensions | CSS implements the panel, footer, wrapping and 44px controls. Runs 005 and 006 provide mocked-browser geometry at 320, 390, 1280 CSS px and 200% zoom, including row action alignment, target heights, title wrapping, and overflow. | verified within the fixture/browser evidence limits |
| User and frontend specification claims | The frontend spec documents controls, counts, ordering, score privacy and workspace-local selections. The User Guide documents navigation, keyboard tab controls, search/class filtering and submitted score display. | aligned; User Guide does not explicitly say reload/session loss clears selections, while the spec states reset on a new workspace. This is a minor omission, not a contradictory claim. |

## Checks and evidence

| Area | Status | Evidence |
| --- | --- | --- |
| Specification validation | Complete | Compared UI-03 task acceptance criteria with changed implementation and current spec. |
| Documentation consistency | Complete with minor omission | Reviewed changed User Guide and frontend specification. |
| Automated tests | Supplied evidence | Parent reports focused UI suite passes 19 tests; this reviewer did not rerun it. New stale-response test is meaningful. |
| Formatting | Supplied evidence | Parent reports `npm run format:check` passes after formatting; not rerun here. |
| Browser acceptance | Supplied evidence | Runs 005–006 report fixture-backed Chrome checks. They are not live backend checks and do not establish behavior outside the recorded browser/environment. |

## Next actions
- Implementation follow-up required: NO
- Edit documentation: NO
- Rerun code-review skill: NO
- Reason: No product behavior/spec contradiction found. Addressing the test coverage finding requires strengthening acceptance evidence, not changing the implementation contract.

## Agent handoff
- Follow-up required: YES
- Current implementation/review state: UI-03 behavior aligns with the approved task and specification; one acceptance-test gap remains for reload-remount reset.
- Next responsible skill or human: Verification reviewer or implementer maintaining `StudentUI.test.tsx`.
- Priority and finding addressed: Medium, `SC-ui03-01`.
- Exact files and line locations: `frontend/tests/StudentUI.test.tsx`, test “resets quiz-list preferences after session loss and a different account signs in”.
- Required change or investigation: Before unmounting, set non-default tab, class and search for the current account; unmount/remount the same account as a reload simulation, then assert defaults. Keep the distinct-account/session-loss assertions.
- Constraints and out-of-scope work: Do not add persistence; preferences are specified as in-memory only.
- Verification commands: From `frontend/`, run the focused StudentUI test suite and formatting check.
- Manual checks: No additional manual check follows from this finding; supplied browser evidence already covers the listed UI geometry and user flows.
- Success criteria: The test fails if list preferences survive a same-account workspace remount and passes when remount resets all three values.
- Documentation impact: None required for this finding.
- Required next rerun: Re-run verification review after the coverage change; spec-contract review only if the requirement or user-facing claims change.
- Blocker or decision needed: None.

## Findings

- `SC-ui03-01` — Medium: Reload-remount reset is not exercised from a non-default state — Status: Open
- Category: Acceptance coverage / requirement verification
- Location: `frontend/tests/StudentUI.test.tsx`, “resets quiz-list preferences after session loss and a different account signs in”
- Requirement: UI-03 AC-03 requires reload/session/account reset; the task defines preferences as in-memory and cleared on reload, session loss, sign-out or account change.
- Evidence: The test sets non-default preferences for account A, triggers `SESSION_LOST`, and confirms account B starts at defaults. It then unmounts and remounts account B, but account B has not selected non-default preferences before that unmount. Thus the remount assertion only reconfirms an already-default state. The component implementation's in-memory workspace state appears to satisfy the requirement, but the newly added remount coverage cannot detect accidental persistence across remount.
- Expected / actual: Expected a same-account remount assertion from non-default selections; actual same-account remount starts from defaults already established by the preceding account/session reset.
- Reproduction or inspection path: Read the test sequence; note no tab/class/search interaction for account B occurs between its initial assertions and `firstSession.unmount()`.
- Impact: The reload-reset contract lacks the intended regression check, though source inspection supports the behavior.
- Likely cause / confidence: Test setup reuses the account-B default assertion as the remount assertion; high confidence.
- Fix direction and affected responsibility: In the test, select non-default tab, class and search for account B before unmount/remount, then assert all reset for that same account.
- Tests to add/update: Update the existing StudentUI test as described.
- Documentation impact: None.
- Verification after fixing: Focused StudentUI suite and frontend format check.

## Positive observations

- The implementation uses the collection score and avoids per-card result reads, matching the task's data-source contract.
- The class selector derives from the full collection and distinguishes duplicate class names using IDs.
- Supplied browser records provide concrete layout measurements while clearly identifying the mocked fixture and the earlier 200% evidence gap closure.

## Gaps and limitations

- This review relied on the parent-supplied test/format results and implementation run records; commands were not independently rerun.
- Browser evidence uses a local fixture with intercepted API calls, not a live backend or deployed environment.

## Manual checks for user

- No manual checks required based on this specification review; the remaining finding is automated test coverage.

## Conclusion

The UI-03 implementation and updated frontend specification align with the task requirements, and the User Guide accurately describes the new student collection controls. One acceptance test should exercise same-account reload/remount reset from non-default preferences so that the in-memory lifetime rule has an effective regression check.
