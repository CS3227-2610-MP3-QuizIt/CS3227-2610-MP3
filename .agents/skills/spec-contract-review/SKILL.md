---
name: spec-contract-review
description: Review QuizIt changes for alignment with approved requirements, API and schema contracts, acceptance criteria, and affected user/developer documentation. Invoke when product behaviour, routes, schemas, specs, guides, diagrams, or deployment claims change.
---

# Specification and contract review

Read the [report contract](../code-review/references/review-report.md) before review.
Review contract alignment. Use the assignment brief, `AGENTS.md`, relevant
specifications, acceptance criteria, and [project standards](../code-review/references/project-standards.md).

## Inputs

Use the fixed target, changed files, task/spec reference, and supplied evidence.
If no requirement source exists, report the limitation.

## Procedure

1. Pin the range and identify the task or requirement.
2. Map each requirement to implementation, evidence, and user outcome.
3. Check omissions, partial or incorrect behaviour, and scope creep.
4. Compare affected routes, schemas, persistence, User Guide, Developer Guide,
   diagrams, commands, examples, error claims, manual-testing instructions and
   feature/release status and deployment claims with observed behaviour.
5. Mark each claim `verified`, `stale`, `inaccurate`, `incomplete`, or
   `not verifiable`. Report contradictions.

## Completion criterion

Map every changed requirement and contract, or state why it could not be assessed.

## Output

Use the report contract and parent output mode, or a unique `workflow/reviews/` path
standalone. Use `SC-<review>-<number>` IDs; a parent may remap them.
