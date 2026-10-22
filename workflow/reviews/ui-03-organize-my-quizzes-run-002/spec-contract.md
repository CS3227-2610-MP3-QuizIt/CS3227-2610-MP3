# Specification and Contract Review

## Review scope and evidence

- Target: corrected working tree based on HEAD `b683612e13e21cb7bdad18dea9df94e15ce0c8d7`; tracked diff fingerprint `dd66c070b65971eeb8dc1321d3941808ff4fb3addcf42b089a6e19b4a4ff4f43`; untracked `quizListPreferences.ts` fingerprint `2c72fb3f7667337859a3c6360788714f64ce4688c4bd9112a4365b7c26946d7a`.
- Scope: student quiz-list organization, score display, state lifetime, affected frontend specification and User Guide, and relevant security/task requirements.
- Sources: `workflow/tasks/ui-03-organize-my-quizzes.md`, `AGENTS.md`, `specs/frontend-spec.md`, `docs/UserGuide.md`, `workflow/security/ui-03-my-quizzes-security.md`, both implementation handoffs, and changed source/tests.
- Review axis: requirements, behavior and documentation contracts only. No independent commands or browser run were performed; execution evidence below is from the supplied implementation handoffs.

## Requirement mapping

| Requirement / contract | Implementation and evidence | Status |
| --- | --- | --- |
| To do / Submitted / All tabs remain visible; search and class filter combine; counts are computed after search/class and unknown before first success. | `QuizList.tsx` derives filtered sets/counts from the complete response. Tests reported for combined filters, counts, and unknown counts. | verified |
| Search is trimmed and case-insensitive over title/class; classes use IDs, are drawn from the full collection, and duplicate names are distinguishable. | `QuizList.tsx` uses trimmed lowercase query, builds options from all items, keys by class ID and disambiguates repeated names. Focused tests cover duplicate names/IDs and filtering. | verified |
| In-progress items come first while preserving collection order within groups. | Stable partition comparator in `QuizList.tsx`; handoff reports interleaved order test. | verified |
| Empty collection, selected-empty and no-match states preserve controls and offer recovery; global empty wording remains. | Controls render independently of data; global `No quizzes yet` copy is retained, with selected-empty/no-match recovery actions. Handoff reports empty-state and retry coverage. | verified |
| Failed refresh preserves loaded cards; a successful refresh that removes selected class resets only class selection. | `useResource` data remains used while refresh errors render; successful loader checks class existence and updates class to `all` while retaining other current preferences. Focused tests reported for both cases. | verified |
| Preferences default/reset to To do, All classes, empty search; persist only in memory across routes and clear on reload/session loss/sign-out/account change. | State is owned by the keyed `StudentWorkspace` in `StudentApp`; key is `user.id`. Auth regression test sets all three preferences, loses session, signs in as another account, and checks defaults. Route return/reload/manual sign-out were not browser exercised. Source ownership supports the contract; browser lifecycle evidence remains limited. | incomplete |
| Cards preserve original routes and title-specific names; score appears only for submitted entries, uses collection score, distinguishes zero from missing, and makes no per-card fetch. | `QuizCard` conditionally renders submitted score and original results/attempt paths. Tests reported for zero, unavailable, unfinished-score privacy, actions and no class call; render path uses one collection request. | verified |
| Singular question wording, minimum controls, aligned actions and responsive layout requirements. | Singular wording and CSS minimum heights/flex layout are present. Handoff explicitly says responsive target geometry, multiple-row alignment and 200% zoom were not measured in a browser. | not verifiable |
| Security boundary: local filtering does not grant access; only assigned collection is used and unfinished score/answer data is not exposed. | No backend or schema change. UI consumes authenticated student collection, displays score only for submitted state, and introduces no other request in render/filter paths. This review does not independently validate backend ownership; security handoff describes it as unchanged. | incomplete |
| Frontend specification and User Guide accurately describe new user behavior and state lifetime. | Spec describes filters, count basis, stable ordering, score behavior and in-workspace memory/reset. User Guide explains tabs, search/class, filtered counts, submitted score and navigation retention. Neither claims browser-measured geometry or backend changes. | verified |
| Assignment/product invariants: one resumable attempt, immutable submission, answers only after own submission; no AI or backend authority changes. | Changes are limited to student collection presentation/state; actions retain existing routes, and the task/security records explicitly disallow local filtering from starting work or granting authority. No conflicting product behavior found. | verified |

## Findings

None.

## Documentation claim assessment

- `specs/frontend-spec.md`: the changed Student quiz list contract matches the task brief and implementation, including default state, in-memory workspace lifetime, count semantics, stable in-progress ordering, and submitted-only score display. **verified**.
- `docs/UserGuide.md`: the added student guidance matches the implemented controls and states that selections stay available during navigation in the signed-in workspace; it does not promise persistence across reloads. **verified**.
- Developer documentation, API/schema contracts and deployment claims were not changed and are not implicated by this frontend-only behavior.

## Gaps and limitations

- No manual browser geometry or route/reload/sign-out checks were supplied. In particular, actual 44px hit-box bounds, alignment across rendered grid rows, narrow viewport wrapping, and 200% zoom remain unverified. This is an acceptance-evidence gap, not an observed spec contradiction.
- Automated UI tests are mocked and do not establish deployed/backend behavior. Backend ownership and collection scoping were not re-reviewed in this frontend contract pass.
- The earlier run-001 handoff's test totals are superseded by run-002's correction handoff, which reports the final focused 17-test and full 155-test results.

## Review decisions

- Implementation follow-up required: NO
- Edit documentation: NO
- Rerun code review: NO
- Independent human review: READY, with the manual layout/lifecycle limitations above disclosed.
- Manual checks remaining: inspect the quiz list at desktop, intermediate and 320–390px widths; confirm click-target geometry and action alignment with long titles and multiple rows; inspect at 200% zoom; navigate list → attempt/results → list, reload, sign out/session loss and sign back in. The supplied auth regression covers session loss and a different account in automated tests, but not the listed browser flows.
