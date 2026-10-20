# student-quiz-discovery-refresh — Find quizzes easily in a refreshed student list

Status: READY — scope confirmed; existing API supports it; no blocking decisions or dependencies.
Depends on: none.
Sources: user decisions in this conversation (2026-10-19): quiz list (`2`), discovery plus presentation (`C`), frontend-only and existing theme (`frontend and A`); [frontend screens](../../specs/frontend-spec.md#frontend-screens), [product rules](../../specs/frontend-spec.md#scope-and-product-rules).
Baseline: `ee7e3b9dd31b6bea95c6cdd15d8875d90ad3880b`; application files clean at planning start; unrelated untracked `.agents/skills/plan-task/` preserved.

## Outcome and scope

[QuizList](../../frontend/src/student/QuizList.tsx) already shows assigned quizzes,
title, class, question count, status and Start / Resume / View results. It has
loading, retry, refresh and empty states, but no search or status filter.
The [existing student tests](../../frontend/tests/StudentUI.test.tsx) cover those
baseline behaviours; [prior delivery evidence](../student-ui.md) is historical.

Deliver one frontend slice: search title/class, filter attempt status and refresh
card hierarchy, spacing, status distinctions, action placement and mobile layout.
Retain the existing green classroom theme and student navigation shell.

Primary touchpoints: `frontend/src/student/QuizList.tsx`,
`frontend/src/student/student.css`, student component tests/fixtures and
`specs/frontend-spec.md`. Reuse shared styling; scope new styles to this page.
No matching task draft was found. Preserve the existing student implementation
and coordinate any concurrent edits to these touchpoints before implementation.

Exclusions: backend/API/schema changes, dependencies, new sorting/pagination,
filter persistence across page visits, extra quiz metrics, quiz-taking/results
redesign, teacher/admin screens, global theme changes and Developer Guide edits.

Spec delta: extend the frontend screen requirements with the discovery and
presentation behaviours below during implementation; preserve existing contracts.
Decisions: the user approved both functional and visual improvements, frontend-only,
within the current theme. Use the conventional search/filter defaults below;
control type and component structure remain implementation choices.

Security boundary: unchanged. Filter only the existing authenticated quiz response;
do not derive eligibility from current class membership. No new data, AI, upload
or tool boundary requires a threat-model update for this scope.

## Acceptance and planned verification

All test commands below run from `frontend/`. S1 means the user-approved discovery
scope; S2 means the approved presentation/theme scope. These are local source
labels, not new canonical requirement IDs.

| ID | Observable outcome | Source | Test/manual scenario and working directory |
|---|---|---|---|
| AC-01 | Search matches a trimmed, case-insensitive substring of title **or** class name. An empty/whitespace query imposes no search restriction. | S1 | Component tests with mixed case, partial titles, class names, whitespace and nonmatches; `frontend/`. |
| AC-02 | Status defaults to All and supports Not started, In progress and Submitted. Search and status intersect; matching cards retain API order. | S1 | Component tests for every status, combined controls and ordering; `frontend/`. |
| AC-03 | An empty assignment list and a nonempty list with no matching quizzes have distinct messages. Clearing search and selecting All restores every loaded quiz. | S1 | Component tests for both empty states and recovery; `frontend/`. |
| AC-04 | Cards retain title, class, question count and readable status. Start / Resume / View results still target the correct quiz, including after filtering. | S1; frontend screens | Extend existing action-link tests across all statuses and filtered results; `frontend/`. |
| AC-05 | Search/filter changes make no requests. Refresh/retry retain chosen controls and apply them to the latest successful response. Loading and error feedback remain usable; no class-membership lookup is introduced. | S1; existing list behaviour | Mock fetch success/failure/recovery and changed response data; assert request counts and no `api.classes` call; `frontend/`. |
| AC-06 | Cards and controls use the current palette, clearer hierarchy and visible actions. At 320px and 1280px, long titles/classes remain readable without page-level horizontal overflow. Controls have accessible names, keyboard operation and visible focus; status is not conveyed by colour alone. | S2 | Component accessibility assertions plus browser checks at both widths with long names and keyboard-only interaction; run dev server from `frontend/`. Record screenshots and observations. |
| AC-07 | Changes stay confined to the agreed page/spec/tests; existing student session, attempt and result behaviour remains intact. | Approved frontend-only scope; product rules | Focused student regressions, full frontend checks and diff review; commands below. Browser smoke-check adjacent student screens for style leakage. |

## Implementer handoff

First action: update the relevant frontend specification and add failing
search/filter regression cases using [student fixtures](../../frontend/tests/studentFixtures.ts).
Then implement this single task; no separate layer-level tasks are needed.

- Use [React best practices](../../.agents/skills/vercel-react-best-practices/SKILL.md)
  when changing components/state; existing [shared UI](../../frontend/src/shared/ui.tsx)
  and [list item types](../../frontend/src/api/types.ts) are reference points.
- Use [web design guidelines](../../.agents/skills/web-design-guidelines/SKILL.md)
  for the UI/accessibility review, then [code review](../../.agents/skills/code-review/SKILL.md).
- Run `npm test -- tests/StudentUI.test.tsx tests/StudentSession.test.tsx tests/studentApi.test.ts`
  (include any new test file), then `npm test`, `npm run build`, `npm run lint`
  and `npm run format:check`, from `frontend/`. Run `git diff --check` from the repo root.
- Browser verification needs a running frontend and a test student with representative
  assigned quizzes; use existing setup instructions. No live AI call is needed.

Planning evidence: source, specs, test definitions and available commands inspected;
no application tests or browser checks run. All verification above is planned.
Implementation requires its own assignment; this planning run changes only this brief.
