---
name: verification-review
description: Review QuizIt changes for test adequacy and execution evidence across boundaries, negative cases, state transitions, persistence, recovery, browser, deployment, and live-service limitations. Invoke when behaviour, tests, persistence, concurrency, AI tasks, release checks, or acceptance evidence change.
---

# Verification review

Read the [report contract](../code-review/references/review-report.md) before review.
Review whether changed behaviour is proven. Use [project checks](../code-review/references/project-checks.md),
approved requirements, and [project standards](../code-review/references/project-standards.md).

## Inputs

Use the fixed target, changed files, acceptance criteria, command results, and
browser/container/deployment evidence. If evidence is missing, run applicable
configured checks with existing dependencies and record blocked checks.

## Procedure

1. Pin the range and list claims requiring evidence.
2. Classify the needed level: unit, integration, system, acceptance, browser,
   container, deployment or live service. Run applicable configured compilation,
   formatting, lint, type, test, smoke, static-analysis, packaging and resource
   checks; explain omissions.
3. Inspect positive/negative cases, equivalence partitions, boundaries,
   role/resource/state matrices, persistence, concurrency, stale results,
   timeout and recovery.
4. Check outcome-based assertions, isolation, determinism, regression protection
   and state preservation after rejection/failure. Flag tests that merely copy
   implementation logic.
5. Exercise realistic user workflows: happy path, invalid inputs, boundaries,
   errors, state changes, persistence/recovery, adjacent features and unauthorized
   behaviour. Record expected versus observed outcomes; GUI smoke checks prove
   only the exercised paths.
6. Record commands, directories, results, limitations, and manual checks.
   Mocked AI/API tests do not prove live, browser, container, or deployed behaviour.

## Completion criterion

Classify every changed acceptance claim as supported, unsupported, blocked, or
not applicable with a reason. Record every command/result and unverified boundary.

## Output

Use the report contract and parent output mode, or a unique `reviews/` path
standalone. Use `VR-<review>-<number>` IDs; a parent may remap them.
