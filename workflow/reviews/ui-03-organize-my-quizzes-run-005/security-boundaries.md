# Security Boundary Review

## Review scope and evidence

- Target: `b683612e13e21cb7bdad18dea9df94e15ce0c8d7..4f747db`, plus current working-tree changes to `frontend/tests/StudentUI.test.tsx`, `docs/UserGuide.md`, and `specs/frontend-spec.md`.
- Scope: account-scoped in-memory preferences, collection refresh races, submitted score exposure, and the new persistence/race assertions.
- Requirements: `workflow/tasks/ui-03-organize-my-quizzes.md`, `specs/frontend-spec.md`, and `workflow/security/ui-03-my-quizzes-security.md`.
- Evidence supplied: focused UI suite passed 19 tests; `npm run format:check` passed; prior mocked browser evidence in implementation runs 005 and 006. I inspected the changed source and tests. I did not rerun checks or use a live backend/browser.
- Overall: PASS

## Checks

| Boundary | Status | Evidence |
| --- | --- | --- |
| Account/session preference isolation | Complete | `StudentApp.tsx:21-24,41-42` puts preferences inside a workspace keyed by authenticated `user.id`; no local/session storage, URL, or backend persistence is used. Added test exercises session loss/sign-in as another account and a fresh provider mount. |
| Collection ownership and score display | Complete | `QuizList.tsx:37-51,64-79` consumes the existing authenticated student collection and filters locally. `QuizList.tsx`'s `QuizCard` displays score only when status is submitted. Backend `core.py:492,508` selects a student's own published assignments and includes score from that student's attempt. |
| Stale collection response | Complete | `useResource` sequence behavior is covered by the added deferred-response test; it resolves the newer response first and verifies the older response does not replace displayed collection data. |
| Unsafe rendering / mutation side effects | Complete by source inspection | Search, class and title values are rendered as React text. Filtering invokes no attempt, answer, result-detail, or AI operation; cards retain existing navigation routes. |
| Secrets, tokens, private data, logging | Not affected | Changes add only in-memory UI state and tests/docs; no credentials, logging, session implementation, or network contract changes. |

## Findings

None. Finding count: 0.

## Gaps and limitations

- The supplied evidence is mocked frontend execution and does not independently demonstrate backend authorization or a deployed session transition. The backend collection authorization was source-inspected only for this review.
- The new account test verifies sign-in after session loss and a new provider mount; it does not simulate a real browser reload or cross-tab session event. No security defect was identified in the inspected implementation.

## Handoff

- Implementation follow-up required: NO.
- Edit documentation: NO.
- Rerun code review: NO.
- Independent human review: READY, with the evidence limitations above.
- Manual checks for user: No security-specific manual check is required by this review; supplied browser/layout evidence remains separate from this security assessment.
