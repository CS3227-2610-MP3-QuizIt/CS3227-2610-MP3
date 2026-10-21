# ui-04-improve-quiz-attempt-page — Add question navigation and safer submission

Status: READY — requirements approved on 2026-10-21; consolidation and simpler wording requested on 2026-10-22.
Depends on: none. Steps within this task are delivered together.
Baseline: `bd30398` on `plan/student-ui`; inspect the current scoped files before editing.

## What this task does

Keep the quiz as a scrolling page, add a question navigator on the right, let students mark questions for review, and show when their answers are ready to submit. Deliver these connected controls together.

## Work to do

### Question boxes and navigation

- Give each question a thin outer border, 4px corners and a light numbered header. Place Mark for review at the header's right.
- Preserve the original individually bordered A–D options: native radios, full clickable labels, gaps/padding, bold letters and selected green border/tint. Keep an accessible question legend.
- Keep every question in normal document flow. Add a desktop RIGHT numbered navigator and a compact horizontal mobile strip; no single-question pagination.
- Track the current question during manual scrolling. Number activation scrolls and focuses the target without losing its answer, typed hint prompt, disclosure or latest hint state. Respect reduced motion and keep focused targets unobscured.
- Distinguish unanswered, saving, saved and failed with meaningful text/symbols and accessible state. A selected saving/failed choice is not unanswered. Keep the summary compact; no invented topic labels or correctness/grade hints.
- Next unanswered visits questions with no selection, wrapping as needed; with all selected, show an understandable unavailable state. Navigation never saves answers or generates AI.

### Review marks

- Mark/unmark independently of answer/save/hint state. Show the matching flag in desktop/mobile navigation and provide Review marked to reach marked questions.
- Marks last only while the current attempt page stays mounted, including jumps, answer retry and hint activity. Clear on leaving/remount/reload, session loss/sign-out, user or attempt change. No browser/backend persistence.
- Marks never block otherwise valid submission.

### Readiness and final confirmation

- Keep the original bottom submit panel and add readiness plus Submit below the desktop navigator. Both use the same facts and final confirmation. Mobile keeps accessible bottom readiness; no floating submit bar.
- Require every answer selected AND confirmed saved. Missing choices, pending saves and failed saves block both entry points/final activation with a clear explanation. Hint running/failure does not block submission.
- Opening confirmation sends no request. Cancel returns to the unchanged attempt with usable focus. Final confirmation posts once despite duplicate activation or either entry point; guard again if readiness changes.
- Preserve existing uncertain-submission recovery: editing/fresh hints/submission remain locked until an authoritative read establishes submitted vs in-progress. Failed reconciliation retains Check submission. Never unlock because a modal closes or the original POST failed.
- Confirmed submitted attempts stay immutable and route to results; backend grading and answer privacy remain unchanged.

## Layout in words

Use a wide question column on the left and a narrower navigation panel on the right. The right panel stays visible as the document scrolls, with a safe top offset; if taller than the available viewport, its contents remain reachable. Keep one compact answered count at its top. Each desktop row has a question number, `Question N`, and a saved check or prominent saving/failed exception. Keep accessible state descriptions even when a saved check replaces repeated visible Saved text. Show the current question separately from its save state. Next unanswered and Review marked sit below the numbers; readiness and Submit sit beneath those actions.

On narrow screens the navigator moves above the questions as a compact, horizontally scrollable numbered strip that stays available while scrolling. Show current/save/flag indicators without repeating full desktop descriptions. Omit the tall desktop submission block from that strip; retain the bottom submit panel. Scrolling or jumping must not hide a question heading or keyboard focus behind the strip.

Each question's light header contains `Question N` on the left and its review toggle on the right. Put the question stem below that header, followed by the original separate bordered A–D choices, then save feedback and the hint area. Keep the stem in the accessible radio-group legend; avoid a second visible number badge that duplicates the header.

The shared confirmation explains that all answers are saved and submission is final. Use a secondary `Keep reviewing` action and a primary `Confirm submission` action. If review marks exist, mention their count/question numbers without blocking confirmation. Closing/cancelling returns focus to the invoking submit control.

## Files and specification

[QuizPage.tsx](../../frontend/src/student/QuizPage.tsx), [student.css](../../frontend/src/student/student.css), student component/session tests and [frontend-spec.md](../../specs/frontend-spec.md). Reuse existing answer/save states, retries and recovery; scope CSS so results and other screens are preserved. No backend/schema/API, timer, retake, grading or pre-submit answer-key change. Hint disclosure/error wording is owned by [the hints task](ui-05-improve-quiz-hints.md); preserve it if already completed.

Triage only: source shows the global `Retry failed answer saves before submitting.` warning is not cleared by successful Retry save. A separate fix is not approved here. If implementing readiness necessarily changes that path, surface the concrete scope interaction rather than silently expanding it.

## Done when

| ID | Expected result | Planned verification |
| --- | --- | --- |
| AC-01 | Question frames change while original A–D controls and save behavior remain. | 1/10 questions, keyboard radio/label selection, long stems/options and actual before/after rendering. |
| AC-02 | Number jumps/manual scrolling/current state/Next unanswered work without losing work. | Mixed unanswered/saving/saved/failed states, end wrapping, all selected, typed prompt and store updates; assert no navigation-triggered save/AI call. |
| AC-03 | Marked state is independent, navigable and confined to the mounted attempt; confirmation can remind users of marks without blocking submission. | Multiple marks, remove current mark, no marks, save/hint activity, route/remount/reload and account boundaries. |
| AC-04 | Both submit locations agree; only all-confirmed-saved answers can reach final submission. | Missing/pending/failed/mixed/all saved, marks and unavailable hints; retry-save success and readiness changing during confirmation. |
| AC-05 | Cancel sends nothing; confirm sends once; uncertain outcomes remain locked until authoritative recovery. | Both entry points, duplicate click/Enter, focus restoration, lost response, failed GET, confirmed submitted/in-progress and late answer saves. |
| AC-06 | Navigation, focus, controls and long text fit across screen sizes. | Desktop/right sidebar, compact mobile strip, 320–390px, intermediate widths, 200%/400% zoom, reduced motion and visible focus. Preserve session/results recovery and no pre-submit keys. |

## Implementation handoff

Use this brief and the linked files inside MP3 as the complete input. Follow the local [implement workflow](../../.agents/skills/implement/SKILL.md) and [coding stage](../../.agents/skills/implement-task/SKILL.md). Keep source, the affected specification and focused acceptance tests together. Preserve other completed changes. Do not edit the Developer Guide. Start implementation only when requested.

The verification described above is planned, not completed. Use mocked APIs for automated checks; no private database or live AI is needed. From `frontend/`, run the relevant focused tests and documented lint, formatting and build checks during implementation. Record actual results and any manual checks that could not be performed.
