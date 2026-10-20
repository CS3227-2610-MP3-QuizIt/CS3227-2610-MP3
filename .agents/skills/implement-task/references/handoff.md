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
changed paths, check summary and unresolved questions/blockers. The caller can
route these fields without reading the implementation record or source.
