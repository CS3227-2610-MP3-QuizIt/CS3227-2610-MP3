# UI-03 browser verification follow-up — run 005

Date: 2026-10-22

## Status

**BLOCKED — browser evidence substantially completed; 200% card geometry remains unmeasured.** No product behavior defect was observed and no product source, tests, spec, or guide changed in this run.

## Target and preserved workspace

- Brief: [ui-03-organize-my-quizzes](../tasks/ui-03-organize-my-quizzes.md)
- Baseline HEAD: `b683612e13e21cb7bdad18dea9df94e15ce0c8d7`
- Final target remains the same shared working tree. The pre-existing tracked diff SHA-256 remains `dd66c070b65971eeb8dc1321d3941808ff4fb3addcf42b089a6e19b4a4ff4f43`; untracked `frontend/src/student/quizListPreferences.ts` SHA-256 remains `2c72fb3f7667337859a3c6360788714f64ce4688c4bd9112a4365b7c26946d7a`.
- No files were changed by this follow-up except this evidence record. Prior implementation/evaluation/review artifacts and the Task 2 plan were preserved.
- `git diff --check` from the repository root passed (exit 0).

## Isolated fixture lifecycle

A temporary copy of `frontend/` was created at `/private/tmp/ui03-browser-fixture`, with its own Vite server on `127.0.0.1:5178`. A fixture-only service worker intercepted `/api/v1/*` and returned deterministic local responses for a fixture student and five quizzes. Its data included duplicate class names under distinct IDs, one in-progress item, two not-started items, a submitted score of `0 / 1`, and a submitted null score. Attempt and results routes were stubbed only to support navigation checks. The worker did not call any backend, database, or AI provider.

The fixture browser tab was separate from the user's signed-in app at `localhost:5173`; that app and its database were not changed. Chrome browser zoom was restored from 200% to 100%, the fixture tab was closed, the Vite process was stopped, and the temporary fixture copy was removed.

## Browser actions and observations

| Check | Actions and observed result |
| --- | --- |
| Mixed collection and ordering | Opened the isolated fixture and observed To do 3, Submitted 2, All 5. The in-progress card appeared before not-started cards. All five fixture cards and class options rendered. |
| Submitted states and scores | Opened Submitted. The collection displayed `0 / 1` for the real zero and `Unavailable` for null. Both showed a footer divider and View results action. No unfinished score was shown. |
| Duplicate class IDs | Selected `Biology 101 (class 12)` with the native selector and observed only its matching card. The two same-name classes remained distinct by ID. |
| Search no-match and recovery | Entered `no fixture match`; the selected submitted count became 0 and the no-match explanation plus Clear search and Reset filters appeared. Clicked the in-field Clear search and the fixture card returned while the class preference remained. |
| Selected-empty status | With class 12 selected, clicked To do. The tab stayed visible at 0, with `No to do quizzes` and Reset filters. Reset restored the default To do / All classes / empty search state. |
| Navigation preference retention | Selected Submitted and class 12; opened the fixture's View results route, observed the results page, then clicked My quizzes. Submitted and class 12 remained selected and the matching card returned. |
| Layout at 320 CSS px | Used Chrome DevTools responsive mode; read-only page DOM evaluation reported `innerWidth=320`, document `scrollWidth=320`, DPR 2, Refresh quizzes 105.52 × 44 CSS px, Sign out 44 × 44 CSS px, and card action height 44px. The tree showed all five cards at this width, stacked one per row. |
| Layout at 390 CSS px | Read-only DOM evaluation reported `innerWidth=390`, document `scrollWidth=390`, DPR 2, Refresh quizzes 105.52 × 44 CSS px, Sign out 44 × 44 CSS px, five cards, and 44px card actions. Card tops were 613, 840, 1152, 1387, and 1590 CSS px, confirming a single-column wrapped layout without horizontal overflow. |
| Desktop/intermediate multi-row alignment | At a responsive viewport of 1280 CSS px, read-only evaluation reported document width 1280 and controls at 44px high. Five cards occupied three columns and two rows. All three first-row action bottoms were 704.78 CSS px; second-row actions shared a bottom at approximately 1016 CSS px. Long titles wrapped without truncation. |
| Browser zoom 200% | Set Chrome page zoom to 200%; the browser displayed the zoom indicator and the mixed-fixture collection remained rendered. The previously measured empty-state 200% viewport evidence is recorded in run-004. During this run, further DevTools viewport field interaction unexpectedly changed the emulated width to 1px, so I stopped geometry evaluation and restored zoom. I did not record card bounds, overflow, or action alignment at 200%. |

The fixture's SSE endpoint was also intercepted with JSON, which produced a console MIME warning; this did not affect collection or navigation checks. Vite's missing favicon produced 404 console messages. Neither is an application change or acceptance result.

## Checks and evidence scope

- Browser actions were performed by this implementer in Chrome against the temporary Vite copy with all API data locally stubbed. This is real browser rendering evidence, not a live backend or live AI check.
- Read-only DOM `getBoundingClientRect()` evaluations measured rendered CSS-pixel bounds at 320, 390 and 1280 CSS px. The 200% view is visual-only for this run; exact card geometry at 200% remains outstanding.
- Repository root: `git diff --check` — exit 0. No code changed, so automated tests, lint, formatting and build were not rerun; earlier run-002 results remain reported in that record.

## Acceptance and remaining work

The browser evidence now addresses nonempty card rendering, status/action labels, real zero and unavailable scores, duplicate-name classes, no-match and selected-empty recovery, same-user list/results/list preference retention, and rendered geometry at 320, 390 and 1280 CSS px. The 1280 multi-row action alignment and target heights passed. Existing run-004 covers the empty state at desktop, 390, 320 and 200% zoom.

The remaining unverified part is **card/action/footer bounds and alignment at 200% browser zoom with the nonempty fixture**. The limitation came from unreliable interaction with DevTools' viewport numeric control during measurement; the control altered the viewport unexpectedly, so I stopped before drawing a geometry conclusion. No implementation or policy decision is needed. A reviewer can close the last evidence gap by repeating the fixture at 200% and capturing actual `getBoundingClientRect()` output for the cards/actions and document overflow, then comparing action bottoms within each row.

Finding `VR-ui03-01` remains Fixed. No implementation finding was discovered. Overall acceptance is still not asserted by this handoff.
