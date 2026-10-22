# Security Boundary Review — UI-03

## Review scope and evidence

- Target: baseline `b683612e13e21cb7bdad18dea9df94e15ce0c8d7` through HEAD `4f747db`, plus working-tree changes to `frontend/tests/StudentUI.test.tsx`, `specs/frontend-spec.md`, and `docs/UserGuide.md`.
- Scope: student identity/workspace lifetime, assigned quiz and score exposure, local search/filter rendering, and whether controls create protected actions or extra data reads.
- Requirements: `workflow/tasks/ui-03-organize-my-quizzes.md`, `specs/frontend-spec.md`, and `workflow/security/ui-03-my-quizzes-security.md`.
- Evidence: source and test inspection; parent-observed 19-test focused UI suite and `npm run format:check` passed on 2026-10-22; browser fixture evidence in implementation runs 005 and 006. No tests were independently rerun.

## Status

- Overall: PASS for the changed frontend security boundaries, with the backend authorization limitation below.
- Implementation follow-up required: NO.
- Edit documentation: NO.
- Rerun code review: NO.
- Independent human review: READY, limited to this security axis.

## Boundary checks

| Boundary | Assessment and evidence |
| --- | --- |
| Student identity and preferences | `StudentApp` does not render the workspace without an authenticated user. `StudentWorkspace` is keyed by `user.id`, and owns the three list preferences in component state. The list does not use local/session storage, URL parameters, or backend preference persistence. A session loss removes the authenticated user through `AuthProvider`; a different identity remounts the keyed workspace. The corrected test now selects non-default tab, class, and search values for account B before unmount/remount and asserts defaults, addressing prior `SC-ui03-01` test-coverage finding. |
| Assignment and score exposure | `QuizList` uses only `api.studentQuizzes` results, which the existing contract describes as assignments for the signed-in student. Cards render titles/class metadata as React text. Only `attempt_status === "submitted"` cards display `quiz.score`; `score == null` yields “Unavailable” and zero remains a value. No result detail, answer, or explanation is rendered in cards. This is a frontend control and does not replace server-side ownership enforcement. |
| User-controlled text | Quiz title and class name are interpolated as JSX text, not HTML; search only filters local strings. No `dangerouslySetInnerHTML`, external fetch, or interpretation of title/class text was introduced in the reviewed path. |
| Actions and request surface | Filter, tab, reset, and search handlers update local state. The only collection request is the existing collection fetch/refresh. Card links preserve the existing attempt/results route. No per-card result request, class-membership request, attempt start, save/submit mutation, or AI request is triggered by rendering/filtering. |
| Stale data | The source passes the existing fetch abstraction an abort signal and derives displayed items from its current resource value; the supplied focused suite includes an out-of-order response regression test. This supports the UI claim that an older list response does not replace the newer collection, but does not prove session-generation behavior outside the tested harness. |

## Findings

None.

## Positive observations

- Score display is sourced from the assigned collection and gated by submitted state; there is no inference of a score from answer data.
- Search and class choices are local presentation controls, and class filtering compares IDs even for duplicate class names.
- Preference memory is scoped to the signed-in student workspace and naturally discarded when the workspace is recreated.
- The correction for `SC-ui03-01` now establishes reset from a non-default same-account workspace state rather than merely asserting already-default values.

## Gaps and limitations

- This is a frontend-only change. Backend authorization and the correctness of the student collection's score scoping were not re-audited or exercised here. Existing security mapping points to AUTH-01/AUTH-03 and backend ownership tests; those controls remain the authority for cross-student access.
- Browser runs 005/006 used local mocked API responses, not a live authenticated application or backend. They establish rendering and geometry only for their fixtures. No malicious markup-specific browser run is cited, though source uses ordinary React text rendering.
- The test suite and formatting command are parent-reported evidence, not independently rerun during this review.

## Manual checks for user

No additional security-specific manual check is required for the changed frontend path. Cross-student authorization remains a backend responsibility outside this review's changed scope.

## Conclusion

No security-boundary defect was found in the changed UI-03 files. The implementation continues to rely on the existing authenticated collection endpoint for assignment and score authority, keeps preferences in the current student workspace, and limits score presentation to submitted cards. This verdict does not independently certify backend authorization.
