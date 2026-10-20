# Task brief

Use a stable, descriptive slug as the task ID; preserve task and criterion IDs
on revision. Link approved contracts rather than copying them. Resolve local
links relative to the brief. Omit optional fields when irrelevant.

```markdown
# <task-id> — <bounded outcome>

Status: <DRAFT | READY | BLOCKED; reason>
Owner: <if assigned>
Depends on: <local task links and observed status, or none>
Sources: <request and approved spec sections>
Baseline: <commit and relevant worktree changes>

## Outcome and scope
<Current behavior/evidence → intended behavior and remaining gap.>
<Affected interfaces/files, exclusions and teammate overlap.>
Spec delta: <proposed contract changes and pending approvals, if any.>
Decisions: <agreed choices, brief rationale and approval source, if any.>

## Acceptance and planned verification
| ID | Observable outcome | Source | Test/manual scenario and working directory |
|---|---|---|---|
| AC-01 | <condition/action → expected result> | <requirement/section or proposed delta> | <check> |

## Implementer handoff
<First unblocked action; applicable coding-skill paths and when to use them.>
<Required access, unresolved decisions and verification limits, if any.>
```

Cover relevant success, denied, boundary and failure cases. Link affected
security-matrix rows when threat modeling applies. Checks above are planned;
record observed results separately with evidence.
