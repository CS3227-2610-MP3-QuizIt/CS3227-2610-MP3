# ui-06-improve-quiz-results — Update the results page and answer review

Status: READY — requirements approved on 2026-10-21; consolidation and simpler wording requested on 2026-10-22.
Depends on: none. Steps within this task are delivered together.
Baseline: `bd30398` on `plan/student-ui`; inspect the current scoped files before editing.

## What this task does

Give submitted quizzes a compact score summary, submission details on the right, and a clear scrolling review of answers. Let students focus on mistakes and open the saved explanations they want to read.

## Work to do

### Summary and review controls

- Show a compact score above Question review as `Score for this quiz: X out of Y`, with the submitted date underneath. Put Submitted and question count together beneath the quiz title, left aligned. The RIGHT submission-details panel repeats the score fraction and submitted date, and contains percentage, correct/incorrect counts, concise finality, review action, secondary Refresh results and back link. This summary/detail repetition is intentional. On mobile, details flow above the review.
- Use existing backend `score`, `score_percent`, total and `submitted_at`. Correct count is score; incorrect is total minus score. Use the existing percentage formatter and `formatDate` behavior (`Intl.DateTimeFormat("en", {dateStyle: "medium"})`, browser timezone); verify actual output rather than a sample date.
- Add All questions / Mistakes controls with full-result counts, initially All. Mistakes includes exactly backend-incorrect questions. Keep original question order/numbers; filtering changes neither score nor details.
- Keep Mistakes (0) visible and usable for perfect scores, with an empty-state action returning to All. Main action is Review mistakes for zero/partial scores and Review explanations for perfect scores. It selects the proper view and focuses/scrolls to the review heading without opening every explanation.

### Per-question review

- Thin border, 4px corners and light numbered header; compact green/cream styling. Show 0/1 or 1/1 point from backend `is_correct`, plus Correct/Incorrect text with a symbol and color.
- Keep read-only individually bordered A–D answer boxes matching the active attempt with explicit Your answer / Correct answer labels. A picked correct answer conveys both roles. No editable radio/answer/submit controls.
- Each saved explanation has a keyboard-operable disclosure, initially closed. Keep open/closed state by question ID across All/Mistakes switches during the visit; another attempt/visit resets it. Opening uses saved text, never AI generation.
- Preserve backend order, selected/correct options, explanation and submission data; normal safe text rendering; owner/submitted-only access and immutable results.
- Preserve initial load/error/retry, refresh, focus/online and session recovery. Failed refresh keeps loaded results visible with the existing compact red message and retry. Old/aborted requests cannot populate a different attempt/session.

## Layout in words

Keep the quiz title and Submitted indicator at the top, with the existing back link. Under the heading, the main review column occupies most of the width. A compact white right panel uses the same thin border, 10px corners and 14px padding as the desktop attempt navigator and stays visible while the desktop review scrolls; all its contents must remain reachable. Keep the score line above `Question review`, without a large filled score banner. The rail lists correct/incorrect counts, the submitted date, finality reminder, primary Review mistakes/Review explanations action, secondary Refresh results and a quiet back link. On narrow screens, move the rail above the review and allow its details to wrap naturally.

Place the All questions and Mistakes controls beside the Question review heading when space permits. Use compact outlined controls; the selected view has a light sage tint. Wrap them below the heading on narrow screens. Keep question cards in a vertical stack.

Each question's light header has `Question N` at the left and the correctness symbol/text plus point value at the right. The stem and answer rows sit in the white body below. Results use separate read-only answer boxes matching the active attempt’s 14px padding, 10px gaps, 7px corners and thin borders. These replace the earlier divider-separated rows; do not add editable answer controls. Use the same bold green A–D letter treatment as the active attempt, without extra selection circles or punctuation. Mark the selected answer with the explicit Your answer label; identify the correct answer separately, showing both labels on a picked-correct row. Use restrained green/red outcome cues with text, not color alone. The explanation is a simple full-width disclosure row below the answers, separated by a quiet rule, with an expand/collapse indicator and no large filled feedback box. It starts closed as specified above.

## Files and specification

Results portion of [QuizPage.tsx](../../frontend/src/student/QuizPage.tsx), results-scoped [student.css](../../frontend/src/student/student.css), relevant result/session tests and [frontend-spec.md](../../specs/frontend-spec.md). Existing results fields and guards suffice; no new endpoint, grading or data-layer work. Style changes must preserve the active attempt page. See [results security checks](../security/ui-06-results-security.md).

No retake, multiple attempts, kept score, duration/timer, manual grades, weights, ranking, pass threshold, new visibility settings, saved-hint disclosure, hint-use tracking or chat.

## Done when

| ID | Expected result | Planned verification |
| --- | --- | --- |
| AC-01 | Actual summary, fraction/percentage/counts/date and responsive rail match the requirements. | 0/partial/perfect results with 1–10 questions, date-boundary timestamp, actual formatter output and wide/mobile layout. |
| AC-02 | All/Mistakes counts, order, empty perfect-score view and review actions agree. | Unsorted input sorted by backend positions, nonadjacent mistakes, 0/1 and 10/10, switching and keyboard focus/scroll. |
| AC-03 | Read-only answers show both roles where appropriate, point values and non-color correctness cues. | All selected/correct option combinations, especially picked-correct A/D; no save/submit calls. |
| AC-04 | Explanations start closed, toggle independently and retain state across filters only for the current visit/attempt. | Keyboard/pointer, All → Mistakes → All, another attempt, multiline/HTML-like saved text; zero AI requests. |
| AC-05 | Loaded results survive failed refresh, and denied/unsubmitted/session-switched views expose no answer key or prior-user data. | Initial error/retry, focus/online recovery, stale response, owner denial, direct unsubmitted route and session loss. |
| AC-06 | Long review content, controls and labels remain readable without breaking attempts. | Long title/stem/options/explanations, 320–390px and desktop, 200% zoom, keyboard/focus/contrast; attempt regression checks. |

## Implementation handoff

Use this brief and the linked files inside MP3 as the complete input. Follow the local [implement workflow](../../.agents/skills/implement/SKILL.md) and [coding stage](../../.agents/skills/implement-task/SKILL.md). Keep source, the affected specification and focused acceptance tests together. Preserve other completed changes. Do not edit the Developer Guide. Start implementation only when requested.

The verification described above is planned, not completed. Use mocked APIs for automated checks; no private database or live AI is needed. From `frontend/`, run the relevant focused tests and documented lint, formatting and build checks during implementation. Record actual results and any manual checks that could not be performed.

## Approved visual polish — 23 October 2026

The owner approved direct polish after comparing the results page with the active quiz. Keep layout B and its behaviour. Match the active quiz’s whole bordered option boxes, padding, gaps and A–D letters; remove extra selection circles. The owner clarified that matching letters alone was insufficient. Align answer labels after the text on desktop and below it on mobile, using pale red for picked-wrong rows and pale green for correct rows. Place Submitted/question count beneath the title instead of in the top right; move Refresh results to the rail. Keep the compact main score/date summary and repeat score/date with percentage in the rail, as subsequently requested by the owner. Remove the generic supporting sentence and detached top-right controls. Keep quiet detail-row separators and group correctness with its quieter point value. Earlier verification/review evidence predates these edits and does not certify this revised target.

Results rail follow-up: match the attempt navigator’s white bordered panel, 10px corners and 14px padding. Keep internal details as quiet aligned rows. Group the percentage directly beneath the prominent score fraction. Preserve responsive stacking, sticky desktop placement and reachable controls.
