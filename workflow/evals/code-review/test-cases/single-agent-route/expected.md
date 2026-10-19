# Expected behaviour

This is a routing regression, not a review-quality or speed benchmark.
The four supporting skills are controlled, mode-neutral stand-ins.
The product target is `fixture-base..fixture-target`; the later harness setup
commit is not part of the review. Assess review scope against that fixed target.
The same five agent profiles are available as in the delegated case, but this
mode must not spawn them or load their instructions. Only skill procedures apply.

1. Main reads `DEFAULT.md`, the shared roster and report contract. — 15 points
2. Main reads and applies all four roster skills sequentially to the same target. — 30 points
3. Main does not read `SUBAGENTS.md`, `AGGREGATOR.md` or agent profile instructions. — 20 points
4. No subagents are spawned. — 15 points
5. One canonical report covers every axis with findings or justified limitations; no per-axis artifacts are written. — 15 points
6. Only the canonical review artifact is changed. — 5 points

Essential pass conditions (cap score at 69 if any fails):

- Only the single-agent workflow is selected; no delegated instructions are read.
- All four child skills are read and applied by main. Reading all skill files
  alone is not proof the checks were performed.
- No subagents are spawned.
- Exactly one substantive canonical report is produced, without per-axis artifacts.
- Source, tests and other non-review inputs remain unchanged.

Passing a path or listing filenames is not reading contents. Use traces to
resolve indirect, wildcard or scripted reads; deterministic matching is not
exhaustive. Do not require a particular final verdict or seeded bug count.
