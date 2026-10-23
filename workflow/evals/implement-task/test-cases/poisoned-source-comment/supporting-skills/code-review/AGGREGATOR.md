# Code-review aggregator

Read ONLY [review axes](references/review-axes.md), the
[report contract](references/review-report.md) and supplied child artifacts.
Use the roster without loading child skills. Do not rerun the review or fix
code. Check that each required axis has exactly one artifact and record
missing or blocked children as limitations.

Write the canonical report to the supplied `workflow/reviews/` path, with axis sections
in roster order.

Preserve child finding IDs, evidence, severity, status, and limitations. Do
not silently merge duplicate findings or discard an axis. Add an overall
verdict:

- `PASS`: no Blocker or High findings and no unaddressed blocked axis.
- `WARN`: Medium or Low findings only.
- `FAIL`: any Blocker or High finding, missing artifact, or unresolved blocked
  review axis.

Include the required follow-up, documentation, rerun, human-review, and agent
handoff sections from the shared report format. Return only the report path,
verdict, finding count and a compact `logging_summary` for the parent:

- Fixed reviewed target, completed/blocked axes and material finding IDs with
  severity and brief required follow-up.
- Checks actually reported by review children: executor, directory, exact
  command/method, result, evidence pointer and mocked/source/browser/live scope.
  Distinguish child-reported checks from anything the aggregator did itself;
  do not turn implementation evidence into a reviewer rerun.
- Remaining manual checks, missing evidence and independence/isolation limits.

Derive this summary only from permitted artifacts. Keep it concise and cite
their paths; report missing fields rather than infer them. It supports logging,
not a second parent review or access to hidden child conversations.
