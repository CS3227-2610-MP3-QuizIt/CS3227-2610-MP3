# Student UI implementation and acceptance evidence

Scope: implement the supplied student-workspace plan against `specs/frontend-spec.md`
and the existing backend API. Requirements, backend contracts, schema, dependencies,
and deployment are unchanged. The plan was supplied as a previous-agent handoff;
this implementation and verification ran in one agent context. No SDD toolkit was used.

Read repository guidance, the assignment brief, frontend specification, relevant backend
specification/routes/schemas, and existing authentication, teacher/admin UI, shared
reconciliation, and tests. Applied the local React performance skill. The reference to
`specs/specification.md` in repository guidance has no corresponding file; acceptance
behavior was taken from the frontend specification and backend acceptance table.

| Acceptance behavior | Implementation and mocked evidence |
| --- | --- |
| Authenticated students enter their own workspace | `StudentApp`, App routing; student session tests |
| Frozen-roster quiz list with Start, Resume, View results | `QuizList`; assignment actions and no current-membership query tested |
| Loading, error/retry, refresh, empty list | Quiz list component test |
| Start/resume and restore answers; four radios per question | `QuizPage`; component and API payload tests |
| Save immediately, disable only saving question, preserve failure and retry | Attempt component tests with deferred saves and failures |
| Require all selections; wait for saves and stop on failure | Incomplete submit control, pending-success and pending-failure tests |
| Submit immutably and recover conflicts/uncertain responses | Locked submission reconciliation tests; failed state reads retain lock until explicit retry |
| Keys/explanations only from confirmed submitted results | Direct results-link guard and pre-submission no-results-read assertions; immutable result view tests |
| Backend score, percentage, choices, keys, correctness and explanations | Submitted result component test; grades displayed without recomputation |
| Composite hints isolate question and attempt targets | `HintStore`; composite key isolation, malformed/foreign event tests |
| Version guards, coalesced reads, admission barrier | Hint-store stale GET/POST, notification-during-read, and in-flight admission tests |
| Read below notified version remains unresolved | Shared `unresolved` snapshot and hint-store test; hint generation disabled |
| Dropped terminal events and failed reads converge | Five-second polling and exponential read-backoff tests; no automatic generation |
| Subscribe before reads; recover on reconnect/focus/online | Student EventSource lifecycle tests; credentialed subscription |
| Ensure first; new and fresh UUID for another/retry | Hint component/store tests; explicit uncertain repeats preserve original prompt/input/key |
| Latest running/failed state replaces older success | Hint store and safe-text component tests |
| Rate rejection retains previous state and displays timing | Hint store/component tests; no resubmission after advancing time |
| Backend enforces hint allowance without invented remaining count | Component allowance rejection test; UI does not compute usage |
| Hints cannot block ordinary quiz work | Running/failed task and initial hint-read outage tests still save and submit |
| Generated markup is inert text; SSE supplies no content | React escaped-markup and forged-event tests |
| No late updates across attempts or sessions | Deferred answer navigation test; expiry and later-login deferred hint test |
| Dispose SSE, timers and I/O on logout/expiry/unmount | Store and session tests, including StrictMode effect cleanup |

Final observed checks (2026-10-09), run from `frontend/`:

- `npm test`: 80 tests passed in 10 files, including existing teacher/admin regressions.
- `npm run build`: TypeScript compilation and Vite production bundling passed.
- `npm run lint`: passed with seven existing warnings in `AuthProvider`, shared UI,
  and `useResource`; no warnings in student code.
- `npm run format:check`: passed for every configured frontend file.
- `git diff --check`: passed from the repository root.

Formatting also normalized two existing teacher-component snippets, with no behavior
change. No new dependencies were installed. Automated tests mocked APIs and EventSource;
no backend records or gateway calls were used. No end-to-end tests, live AI requests,
commits, or deployments were run. Desktop/mobile appearance, native browser keyboard
behavior, and real backend integration remain unverified. Existing backend authorization,
answer withholding, grading and persistence tests were not rerun for this frontend task.

The frontend README and user/developer guides describe the delivered workflow and reused
material. `logs/student-ui.md` records the factual interaction summary.
