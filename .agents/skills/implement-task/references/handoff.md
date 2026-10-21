# Implementation handoff

Write observed evidence, not a second task specification. Link the brief and
contracts. Never include credentials, private data or raw sensitive AI content.

Record:

- Task and status: `IMPLEMENTED`, `BLOCKED` or `NEEDS_DECISION`.
- Baseline HEAD, relevant pre-existing changes, and final commit or scoped
  worktree fingerprint; identify the exact files/diff to review.
- Changed paths and acceptance IDs addressed; approved spec deltas applied.
- Per-criterion evidence, including observed red/green or justified alternatives.
- Checks: working directory, command, exit/result and evidence location.
- Review finding IDs addressed on correction runs and remaining findings.
- Unverified criteria, manual checks, limitations and exact decisions/blockers.

Return only status, task/brief path, handoff path, baseline/final target,
changed paths, check summary, unresolved questions/blockers and the following
compact `logging_summary`. The caller must be able to log the work without
reading the implementation record, source or child conversation.

`logging_summary` contains:

- Outcome and material implementation choices; actual skills used, not merely
  recommended skills or configured profile names.
- Each material check: executor, working directory, exact command or manual
  method, exit/result, evidence pointer and scope (mocked/source/browser/live).
  Include failed attempts and successful reruns; group repetitive checks.
- On correction runs, finding IDs addressed, what changed and unresolved IDs.
- Remaining unverified criteria, manual checks, decisions and environment limits.

Use short factual bullets; link detailed evidence rather than reproducing it.
Report only work actually performed. A returned summary is worker-reported
evidence; it does not make the parent its executor or prove human acceptance.
