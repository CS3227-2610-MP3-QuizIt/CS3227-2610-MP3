# Verification Review — UI-03

## Status
- Target: `b683612e13e21cb7bdad18dea9df94e15ce0c8d7` through `4f747db`, plus current working-tree changes to `frontend/tests/StudentUI.test.tsx`, `docs/UserGuide.md`, and `specs/frontend-spec.md`.
- Scope: Verification adequacy and execution evidence for UI-03. Reviewed only the verification axis.
- Overall: PASS
- Independent human review: READY

## Acceptance claims and evidence

| Claim | Status | Evidence and limits |
| --- | --- | --- |
| Workspace preferences reset on session loss/account change and on remount of the same account | Supported | `StudentUI.test.tsx` sets non-default Submitted/class 22/search preferences for Student B, unmounts the provider/workspace, then remounts with `api.me` returning Student B again and asserts To do / All / empty search. The same test covers session loss from Student A and sign-in as Student B. This models a new in-memory workspace, not a literal browser reload. |
| An older collection response completing after a newer refresh cannot replace the newer collection | Supported | The deferred-promise test starts the initial collection request, dispatches focus to trigger a second request, resolves the second with “Current quiz”, then resolves the first with “Stale quiz”. It asserts the current card remains and the stale card is absent. |
| Preferences persist across list → results → list navigation | Supported | Browser fixture evidence in `workflow/implementations/ui-03-organize-my-quizzes-run-005.md` records selecting Submitted/class 12, navigating through View results, returning to My quizzes, and observing both selections preserved. The fixture uses locally stubbed API responses. |
| Collection controls, scores, empty recovery, and responsive target geometry | Supported with stated limits | Runs 005–006 report mixed and selected-empty collections, duplicate class IDs/names, zero and unavailable scores, no-match recovery, and rendered target/card bounds at 320, 390, 1280, and 200% zoom. Browser evidence is fixture-only; no live backend or deployed check was made. |
| User Guide and frontend specification claims for preferences, controls, scores, and tab keyboard behavior | Supported within tested/evidenced scope | The current guide and spec describe the list controls, session memory, scores, and tab keyboard navigation. The focused suite includes keyboard navigation and preference-reset assertions; fixture browser runs support the visual and navigation paths. |

## Checks

| Area | Status | Command/evidence |
| --- | --- | --- |
| Tests | Passed | From `frontend/`, `npm test` — exit 0; 14 test files and 157 tests passed. The remount and stale-response tests are included. |
| Formatting | Passed | From `frontend/`, `npm run format:check` — exit 0; all matched files use Prettier style. |
| Lint | Passed with warnings | From `frontend/`, `npm run lint` — exit 0. Oxlint reported existing warnings in `src/shared/ui.tsx`, `src/auth/AuthProvider.tsx`, `src/shared/useResource.ts`, and `src/auth/LoginPage.tsx`; none were in the changed test file. |
| Compilation/build | Passed | From `frontend/`, `npm run build` — exit 0; TypeScript build and Vite production build completed. |
| Browser acceptance | Passed for exercised paths | Runs 005–006 describe a temporary Vite fixture and locally intercepted API calls. They establish browser rendering for recorded paths and geometry, not backend, production, or deployed behavior. |
| Specification validation | Supported | Task ACs and applicable frontend-spec claims have focused automated or fixture browser evidence as itemized above; broader scope limitations are listed below. |
| Documentation consistency | Supported | The added User Guide section matches the in-memory preference and collection behavior specified and exercised. |
| Live service/deployment | Not applicable | UI-03 makes no backend, AI, or deployment change. The fixture intentionally did not contact the backend, database, or AI service. |

## Findings

- `VR-ui03-01` — [Medium] Regression coverage for preference remount reset and stale collection responses — Status: Fixed
- Category: Verification coverage
- Location: `frontend/tests/StudentUI.test.tsx` (workspace preference reset and stale-response cases)
- Requirement: UI-03 AC-03 requires preference reset with a fresh workspace and protection against out-of-order collection reads.
- Evidence: The remount case selects Submitted, class 22, and a nonempty query for Student B before unmounting, remounts the same account, then asserts To do, All classes, and empty search. The deferred-response case resolves the newer read before the stale initial read and asserts the current result remains. `npm test` passed all 157 tests.
- Expected / actual: Expected direct regression protection for fresh-workspace reset and stale-read rejection; both are now covered and pass.
- Reproduction or inspection path: Inspect the named cases in `frontend/tests/StudentUI.test.tsx`; run `npm test` from `frontend/`.
- Impact: The earlier evidence gap is closed for component-level behavior.
- Likely cause / confidence: Prior test setup did not prove that remount discarded non-default preferences for the same account; corrected test does. High confidence.
- Fix direction and affected responsibility: No further fix required; test coverage is adequate for this scope.
- Tests to add/update: None.
- Documentation impact: None.
- Verification after fixing: `npm test` passed (14 files, 157 tests); `npm run format:check`, `npm run lint`, and `npm run build` passed with lint warnings noted above.

## Positive observations

- The stale-response test controls promise completion order explicitly and asserts rendered user-visible outcomes.
- The remount regression test first chooses non-default values, then remounts the same account, directly covering in-memory reset behavior.
- Browser fixture records provide concrete measurements for target sizes, card wrapping, row alignment, and overflow across narrow, desktop, and 200% zoom cases.

## Gaps and limitations

- The remount test recreates the auth/workspace tree rather than automating a browser reload or crossing a browser process boundary. The in-memory lifecycle requirement is well represented by remount; literal reload behavior was not separately exercised.
- Browser runs used a fixture-only service worker and do not establish integration with a live backend or deployed environment.
- The full automated checks do not prove behavior on other browsers or operating systems.

## Manual checks for user

- No additional manual check is required for this verification scope. Fixture-backed browser records cover the specified geometry and exercised navigation paths; automated tests cover tab keyboard behavior and the two corrected regression cases.

## Conclusion

The remount test now proves that non-default preferences reset when the same account receives a fresh in-memory workspace, and the stale-response regression test proves an older response cannot replace newer collection state. Full frontend tests, formatting, lint, and production build passed. Fixture-backed browser evidence supports the documented UI paths within its stated limits. No implementation follow-up is required on the verification axis.
