# Frontend snapshot

Run view-model tests from `frontend/`:
`node --test tests/quiz-list.test.mjs`.

`QuizList.tsx` is the current React view. A bundler/browser host is not included
in this small snapshot. Browser verification needs the full application or
an explicitly provided host; Node tests do not establish visual correctness.
