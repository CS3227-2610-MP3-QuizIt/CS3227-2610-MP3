# Single-agent code review

Review in this agent; do not delegate. Read [review axes](references/review-axes.md)
and the [report contract](references/review-report.md) before starting.
Do NOT read `SUBAGENTS.md` or `AGGREGATOR.md`.

## Workflow

1. Fix the requested scope, target issue/release, revision or worktree diff,
   changed files, requirements, tests, evidence, guides and diagrams. Identify
   unrelated changes and select a unique canonical report under `workflow/reviews/`;
   reuse only the matching report on reruns.
2. Read and apply each listed skill sequentially to that target in this agent.
   Use the native todo/plan facility for one item per applicable check. Collect
   findings in memory; write no per-axis artifacts. Reuse applicable check
   results only for the same target and record skips or limitations.
3. Consolidate all axes into the canonical report using the report contract.
   Assign stable `CR-<review>-<number>` IDs; record follow-up, documentation,
   rerun and human-review decisions. Re-read the report and final diff.
4. Return the report path, verdict and remaining manual checks.
