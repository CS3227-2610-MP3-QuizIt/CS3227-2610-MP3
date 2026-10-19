---
name: code-quality-review
description: Review changed QuizIt implementation for cohesion, responsibility boundaries, coupling, duplication, complexity, testability, and maintainability. Invoke when implementation, architecture, refactoring, error handling, logging, or frontend/backend boundaries change.
---

# Code-quality review

Read the [report contract](../code-review/references/review-report.md) and
[project standards](../code-review/references/project-standards.md) before review.
Use configured tools as evidence.

## Inputs

Use the fixed target, changed files, task context, and supplied evidence. If
scope is missing, report `BLOCKED`.

## Procedure

1. Pin the range and inspect the diff and affected paths.
2. Check readability, naming, long methods, nesting, expressions, magic values,
   SLAP, KISS, abstraction, happy-path clarity, dead code, duplication and scope.
3. Check responsibility, cohesion, coupling, separation of concerns, dependency
   direction, complexity, testability, maintainability, types, comments,
   exceptions, assertions, logging and defensive coding. Use the project's
   Python/TypeScript conventions and configured formatting, lint and type checks.
4. Check affected UI/domain, frontend/backend, persistence, transaction, and async
   boundaries.
5. Treat size as a signal, not a defect. Report concrete maintenance risks only;
   apply principles where relevant, not mechanically.
6. Cite location, evidence, impact, confidence, and verification.

## Completion criterion

Assess every changed implementation area or state the limitation. Every finding
needs location, evidence, impact, confidence, and verification.

## Output

Use the report contract and parent output mode, or a unique `workflow/reviews/` path
standalone. Use `CQ-<review>-<number>` IDs; a parent may remap them.
