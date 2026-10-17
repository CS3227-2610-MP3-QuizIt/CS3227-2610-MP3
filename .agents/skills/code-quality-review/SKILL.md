---
name: code-quality-review
description: Review changed QuizIt implementation for cohesion, responsibility boundaries, coupling, duplication, complexity, testability, and maintainability. Invoke when implementation, architecture, refactoring, error handling, logging, or frontend/backend boundaries change.
---

# Code-quality review

Review only. Read [project standards](../code-review/references/project-standards.md)
and use configured tools as evidence.

## Inputs

Use the fixed target, changed files, task context, and supplied evidence. If
scope is missing, report `BLOCKED`.

## Procedure

1. Pin the range and inspect the diff and affected paths.
2. Check responsibilities, cohesion, coupling, dependencies, duplication,
   complexity, naming, errors, logging, types, and testability.
3. Check affected frontend/backend, persistence, transaction, and async
   boundaries.
4. Treat size as a signal, not a defect. Report concrete maintenance risks only.
5. Cite location, evidence, impact, confidence, and verification.

## Completion criterion

Assess every changed implementation area or state the limitation. Every finding
needs location, evidence, impact, confidence, and verification.

## Output

Use the shared [report format](../code-review/references/review-report.md).
Use the parent artifact path, or a unique `reviews/` path standalone. Use
`CQ-<review>-<number>` IDs; a parent may remap them.
