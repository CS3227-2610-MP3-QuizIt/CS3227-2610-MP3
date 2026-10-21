# ui-03-organize-my-quizzes — Organize My quizzes and show submitted scores

Status: READY — requirements approved on 2026-10-21; consolidation and simpler wording requested on 2026-10-22.
Depends on: none. Steps within this task are delivered together.
Baseline: `bd30398` on `plan/student-ui`; inspect the current scoped files before editing.

## What this task does

Help students find unfinished quizzes and revisit submitted work. Add status tabs, search and a class filter to the existing card grid; show scores only on submitted cards. Include the small card/control fixes in the same pass.

## Work to do

### Collection controls

- Add To do / Submitted / All tabs. To do means not_started plus in_progress. Keep every tab visible for an empty collection, an empty tab and no matches.
- Add labeled title-or-class search and a Class selector with All classes. Search is a trimmed, case-insensitive substring match; combine search, class and status. Use class IDs, even when names match.
- Derive classes from the complete student collection, independently of the current search/tab. Keep former-class assignments; do not fetch current memberships or one result per card.
- Tab counts apply the current search/class before status. Selected count equals visible cards; All equals To do plus Submitted. Before initial success, counts are unknown rather than fabricated zeros. Preserve loaded cards/counts on failed refresh.
- Default/reset to To do, All classes and empty search. Clear search affects only search. If a successful refresh removes the selected class, fall back to All classes while preserving tab/search.
- Remember only those three selections in memory across list/attempt/results navigation in the current signed-in student workspace. Clear on reload, session loss, sign-out or account change; no storage/URL/backend persistence.
- Put in-progress matches first, preserving collection order within that set and all other matches. No score ranking.
- Use quiet count badges and aligned search/class controls in a white control panel. Keep existing global empty language; selected-empty/no-match states explain the condition and provide clear/reset recovery.

### Cards and controls

| API state | Display status | Action |
| --- | --- | --- |
| not_started | Not started | Start, existing solid green |
| in_progress | In progress | Resume, existing solid green |
| submitted | Submitted | View results, existing outlined secondary |

- Keep original routes and title-specific accessible names. Rendering/filtering must not start an attempt, save/submit answers or generate AI.
- Submitted footer: quiet divider, View results on the left, labeled Score fraction on the right. Use actual `score / question_count` from the collection. Real zero stays zero; null/omitted score says unavailable. Never show unfinished scores or fetch per-card results.
- Keep Start/Resume on the left. Align action bottoms within each actual grid row despite wrapping titles. Keep full titles, content-sized buttons, existing grid/gap/padding and metadata.
- Show `1 question` for count 1 and `N questions` otherwise.
- Sign out gets at least a 44×44 CSS pixel clickable area. Refresh quizzes and card actions get at least 44px clickable height. Preserve compact icon/text sizes, disabled states, existing colors, sidebar and phone framing.

## Layout in words

Keep the current page heading and Refresh quizzes action above the collection. Below them, use one white panel with a quiet border and rounded corners. The three status tabs form its top row, with an underline for the selected tab and small muted count badges. Put the search and class controls underneath in that same panel, aligned along their lower edges; search takes the remaining width and the class selector is narrower. Label search `Find a quiz`, use placeholder `Search title or class`, and label the selector `Class`. Put Clear search inside the search field and keep the separate reset/clear action close to the controls. Stack/wrap controls cleanly on narrow screens. Keep the panel and tabs present above empty messages.

Cards remain the existing grid. On submitted cards, a thin horizontal divider separates metadata from the footer. View results sits at the footer's left. On the right, put a small muted `Score` label above the fraction: the earned number is larger and darker; the slash and total are smaller and muted. Keep the score compact rather than turning it into a badge, colored score panel or percentage. Preserve zero and unavailable handling. Start/Resume stay at the same left edge and bottom position as View results. Keep full card titles readable.

## Files and specification

[QuizList.tsx](../../frontend/src/student/QuizList.tsx), [StudentApp.tsx](../../frontend/src/student/StudentApp.tsx), [student.css](../../frontend/src/student/student.css), student fixtures/tests and [frontend-spec.md](../../specs/frontend-spec.md); update UserGuide list instructions where needed. The existing unpaginated student collection already supplies class/status/count/submitted score; no backend or schema change is planned. See [collection security checks](../security/ui-03-my-quizzes-security.md).

Keep original typography, card surfaces, supporting-text colors, headings and assignment metadata. No dashboard, deadlines, retakes, pass/rank rules, empty-copy rewrite or unrelated phone redesign.

## Done when

| ID | Expected result | Planned verification |
| --- | --- | --- |
| AC-01 | Tabs, search, class options, counts and stable ordering agree. | Mixed/all-submitted/all-to-do collections; cross-product of controls; duplicate class names/IDs, former classes and intentionally interleaved order. |
| AC-02 | Tabs stay visible with real zeros after successful empty responses; empty states recover correctly. | Globally empty, empty selected tab, no search/class matches, Clear search and Reset. |
| AC-03 | Defaults and memory lifetime match the rules; stale/failed refresh does not erase good data. | Navigate away/back, refresh removal of class, initial failure/retry, out-of-order reads, reload/logout/session/account change. |
| AC-04 | States/actions, panel arrangement and score-footer hierarchy match, including zero vs unavailable and no unfinished score. | All statuses; 0/1, 0/10, partial/full, missing/null and inconsistent pre-submit score fixtures. |
| AC-05 | Controls retain names/routes/disabled behavior; singular count is correct. | Keyboard/native-link assertions, deferred refresh/logout, counts 1/2/10 and no extra mutation/results/class calls. |
| AC-06 | Click targets meet their dimensions; actions align without truncation. | Render actual bounds at desktop/intermediate/320–390px, mixed long titles/classes, multiple rows and 200% zoom; do not claim geometry from JSDOM. |

## Implementation handoff

Use this brief and the linked files inside MP3 as the complete input. Follow the local [implement workflow](../../.agents/skills/implement/SKILL.md) and [coding stage](../../.agents/skills/implement-task/SKILL.md). Keep source, the affected specification and focused acceptance tests together. Preserve other completed changes. Do not edit the Developer Guide. Start implementation only when requested.

The verification described above is planned, not completed. Use mocked APIs for automated checks; no private database or live AI is needed. From `frontend/`, run the relevant focused tests and documented lint, formatting and build checks during implementation. Record actual results and any manual checks that could not be performed.
