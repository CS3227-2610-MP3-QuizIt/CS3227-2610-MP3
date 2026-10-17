# Code-review aggregator

Read the four supplied child artifacts. Do not rerun the review or fix code.
Check that each required axis has exactly one artifact and record missing or
blocked children as limitations.

Write the canonical report to the supplied `reviews/` path. Keep sections in
this order:

1. Code quality
2. Specification and contracts
3. Security boundaries
4. Verification and evidence

Preserve child finding IDs, evidence, severity, status, and limitations. Do
not silently merge duplicate findings or discard an axis. Add an overall
verdict:

- `PASS`: no Blocker or High findings and no unaddressed blocked axis.
- `WARN`: Medium or Low findings only.
- `FAIL`: any Blocker or High finding, missing artifact, or unresolved blocked
  review axis.

Include the required follow-up, documentation, rerun, human-review, and agent
handoff sections from the shared report format. Return only the report path,
verdict, and finding count.
