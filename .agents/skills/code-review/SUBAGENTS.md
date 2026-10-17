# Subagent code review

Use this path when review subagents are available.

The main agent orchestrates. It resolves the fixed target, changed files, task
or requirements, relevant evidence, and one unique artifact path per review.
It does not perform the four review axes itself and does not read child
artifacts. It passes the same review context to each child and waits for all
children.

## 1. Spawn review children

Spawn these four children concurrently:

| Child | Skill | Scope | ID prefix |
|---|---|---|---|
| 1 | `../code-quality-review/SKILL.md` | Code quality and maintainability | `CQ-` |
| 2 | `../spec-contract-review/SKILL.md` | Requirements and contracts | `SC-` |
| 3 | `../security-boundary-review/SKILL.md` | Trust boundaries and exposure | `SB-` |
| 4 | `../verification-review/SKILL.md` | Tests and evidence | `VR-` |

Each child receives the fixed target, changed files, task or requirements,
relevant evidence, and its unique artifact path. Instruct each child to run
the assigned skill, review only its axis, write to that path, and return only
the path and finding count.

## 2. Spawn aggregator

After all four children finish, spawn one aggregator. Give it the run directory,
the four returned artifact paths, the fixed target, and the report path under
`reviews/`. Its first instruction must be:

```text
MUST START by reading and following code-review/AGGREGATOR.md.
```

Do not read or summarize the child artifacts in the main agent. Return only the
aggregator's report path and verdict.

## 3. Completion

Require exactly four child artifacts and one aggregator report. If a child is
missing or blocked, the aggregator must record that limitation; it must not
call the overall review passed. The main agent reports the final path and
verdict without editing the reviewed repository.
