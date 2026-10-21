# ui-01-update-login-page — Update login text and the QuizIt name

Status: READY — requirements approved on 2026-10-21; consolidation and simpler wording requested on 2026-10-22.
Depends on: none. Steps within this task are delivered together.
Baseline: `bd30398` on `plan/student-ui`; inspect the current scoped files before editing.

## What this task does

Change the wording on the existing login page and rename the shared product wordmark to QuizIt. Keep the current appearance. Also make two small login usability repairs if rendered inspection confirms they are needed.

## Work to do

In [LoginPage.tsx](../../frontend/src/auth/LoginPage.tsx), replace these existing strings:

| Current text | New text |
| --- | --- |
| Bring your class together | Notes to quizzes |
| Make space for questions | Hints when you’re stuck |
| Discover what comes next | Review your answers |
| THE LEARNING CYCLE | FROM NOTES TO FEEDBACK |
| One place to bring your classes together, turn knowledge into quizzes, and see learning take shape. | Turn class notes into quizzes, get hints when you need them, and review your answers after submission. |
| The existing two-sentence account-help text | Need an account or help signing in? Contact your class administrator. |

- Keep the help container; remove the old hard-coded break between its sentences.
- In [shared/ui.tsx](../../frontend/src/shared/ui.tsx), change the shared wordmark from `classroom` to `QuizIt`. Keep its book icon and separate trailing dot. This applies to its existing login, loading, student, teacher and admin uses.
- Keep the existing home-link destinations. Change their accessible names to exactly `QuizIt student home`, `QuizIt teacher home` and `QuizIt overview`.
- While login is displayed, set the browser title to `Sign in · QuizIt`, including login shown after session loss at a role URL. On leaving login, restore the previous/default non-login title. Other route titles are outside this task.
- Inspect account-help contrast in the rendered page. If the authored `#788271` on `#fafbf7` is confirmed below 4.5:1, change only help text to existing sage `#66755f`. Keep its 11px size and spacing. If already sufficient, record that and make no color repair.
- Inspect the heading structure. Make `Welcome back.` the single primary `h1` and keep the slogan as visually identical prose if the current source finding is confirmed. Adjust only the relevant selectors so changing tags does not change typography.

Keep `Welcome back.`, `Sign in to pick up where you left off.`, form labels/placeholders, Show/Hide names, and the slogan's exact words, line breaks, serif and italic treatment. Keep card tilt, shadow, icons, numbers, dimensions, compact typography and green/cream colors. The story/card stays hidden at widths up to 640px. Show/Hide target size is investigation-only; no enlargement is approved here.

## Files and specification

Likely changes: login markup, shared Brand, the three role brand-link names, login-scoped [index.css](../../frontend/src/index.css), and focused login/session tests. Update the Login and logout / screen requirements in [frontend-spec.md](../../specs/frontend-spec.md). No authentication, role, backend, ordinary descriptive “classroom” wording, internal identifier, favicon or guide-wide renaming changes.

## Done when

| ID | Expected result | Planned verification |
| --- | --- | --- |
| AC-01 | All six copy replacements match the table; the existing form/slogan copy remains. | Mocked login rendering and scoped source diff. |
| AC-02 | Every shared wordmark uses QuizIt; home links keep their routes and approved names. | Mocked student/teacher/admin navigation checks. |
| AC-03 | Login has the exact browser title regardless of hash; successful sign-in releases that title for all roles. | Login, failed login, session loss, logout, direct role entry and StrictMode/unmount cases. |
| AC-04 | Conditional help/heading repairs meet the stated rules without visual redesign. | Record computed colors/typography and heading structure before/after; close already-satisfied repairs without changes. |
| AC-05 | Desktop and phone retain the current hierarchy without clipping. | Render at 320/390px, 640/641px and desktop; long help/errors, 200% zoom, keyboard and Show/Hide checks. |

## Implementation handoff

Use this brief and the linked files inside MP3 as the complete input. Follow the local [implement workflow](../../.agents/skills/implement/SKILL.md) and [coding stage](../../.agents/skills/implement-task/SKILL.md). Keep source, the affected specification and focused acceptance tests together. Preserve other completed changes. Do not edit the Developer Guide. Start implementation only when requested.

The verification described above is planned, not completed. Use mocked APIs for automated checks; no private database or live AI is needed. From `frontend/`, run the relevant focused tests and documented lint, formatting and build checks during implementation. Record actual results and any manual checks that could not be performed.
