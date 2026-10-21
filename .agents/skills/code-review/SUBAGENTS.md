# Subagent code review

Use this path when review subagents are available.

Spawn every specialist and the aggregator with fresh conversation context.
Do NOT fork the parent conversation; share the repository, not the conversation.

The main agent orchestrates. It resolves the fixed target, changed files, task
or requirements, relevant evidence, and one unique artifact path per review.
It does not perform the review axes itself and does not read child
artifacts. It passes the same target/evidence packet to each child and waits for all
children.

The main agent must NOT read `DEFAULT.md`, child `SKILL.md` files,
`AGGREGATOR.md`, profile instruction files, or child artifacts.

## 1. Spawn review children

Read [review axes](references/review-axes.md). Spawn one child per row
concurrently using its named agent profile. If a profile is unavailable, report
`BLOCKED`; do not substitute a general-purpose agent.
Read the roster ONLY for dispatch; do NOT follow its skill links in main.

Each child receives the repository root, fixed target, changed files,
requirements/evidence paths and its unique artifact path. The profile binds
the skill, axis and return contract; do not paste its instructions into main.

Pass task arguments only:

```text
Repository: <root>
Target: <revision and diff range>
Changed files: <paths>
Requirements: <paths>
Evidence: <paths>
Output: <unique artifact path>
```

Append only relevant task context, not parent workflow instructions.

## 2. Spawn aggregator

After all children finish, spawn `review_aggregator` with fresh context.
If unavailable, report `BLOCKED`. Give it the repository root, roster path,
run directory, returned artifact paths, fixed target, and report path under
`workflow/reviews/`. Its profile binds `AGGREGATOR.md` and the return contract.

Do not read or summarize the child artifacts in the main agent. Return only the
aggregator's report path, verdict, finding count and `logging_summary` unchanged.
Retain that compact return for the caller's later logging stage. Request missing
material summary fields from the aggregator before closing it; do not open
reports or child artifacts to fill gaps yourself.

## 3. Completion

Require one artifact per roster row and one aggregator report. If a child is
missing or blocked, the aggregator must record that limitation; it must not
call the overall review passed. The main agent reports the final path and
verdict without editing the reviewed repository.
