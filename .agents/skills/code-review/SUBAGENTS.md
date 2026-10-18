# Subagent code review

Use this path when review subagents are available.

The main agent orchestrates. It resolves the fixed target, changed files, task
or requirements, relevant evidence, and one unique artifact path per review.
It does not perform the review axes itself and does not read child
artifacts. It passes the same review context to each child and waits for all
children.

The main agent must NOT read `DEFAULT.md`, child `SKILL.md` files,
`AGGREGATOR.md`, or child artifacts; it passes their paths to the relevant agents.

## 1. Spawn review children

Read [review axes](references/review-axes.md). Spawn one child per row
concurrently, passing its resolved skill path, scope and ID prefix.
Read the roster ONLY for dispatch; do NOT follow its skill links in main.

Each child receives the fixed target, changed files, task or requirements,
relevant evidence, and its unique artifact path. Instruct each child to run
the assigned skill, review only its axis, write to that path, and return only
the path and finding count.

## 2. Spawn aggregator

After all children finish, spawn one aggregator. Give it the roster path,
run directory, returned artifact paths, fixed target, and report path under
`reviews/`. Its first instruction must be:

```text
MUST START by reading and following code-review/AGGREGATOR.md.
```

Do not read or summarize the child artifacts in the main agent. Return only the
aggregator's report path and verdict.

## 3. Completion

Require one artifact per roster row and one aggregator report. If a child is
missing or blocked, the aggregator must record that limitation; it must not
call the overall review passed. The main agent reports the final path and
verdict without editing the reviewed repository.
