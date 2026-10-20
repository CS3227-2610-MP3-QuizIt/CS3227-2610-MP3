# frontend-quiz-search

Status: READY — user approved this unchanged task
Owner: Eval owner
Depends on: none
Sources: ../../specs/product.md
Baseline: Prepared fixture HEAD; inspect current worktree before editing.

## Outcome and scope
Add local title/class search to the student list. The user approved one
vertical slice, including the UI, view model, focused tests and P-002 spec delta.
Spec delta approved: quizCards(items, query = "") filters title OR class name
case-insensitively after trimming; blank resets, literal text is not a regex.

Allowed scope: frontend/quiz-list.mjs, frontend/QuizList.tsx, new frontend/tests/*.test.mjs,
and specs/product.md. Preserve existing regression tests. No backend/API changes.

## Acceptance and planned verification
- AC-01: quizCards(items, query = "") follows the approved matching/blank/literal contract; Node behavior tests.
- AC-02: matching cards retain order/actions/links and inputs are not mutated; Node regression tests.
- AC-03: the React view has a labelled search input, clear/reset and a no-match state; source inspection with browser verification explicitly unavailable.

## Implementer handoff
Start with a focused behavioral regression, then the smallest complete fix.
Write observed evidence to workflow/implementations/task.md.
