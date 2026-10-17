---
name: verification-review
description: Review QuizIt changes for test adequacy and execution evidence across boundaries, negative cases, state transitions, persistence, recovery, browser, deployment, and live-service limitations. Invoke when behaviour, tests, persistence, concurrency, AI tasks, release checks, or acceptance evidence change.
---

# Verification review

Review whether changed behaviour is proven. Use [project checks](../code-review/references/project-checks.md),
approved requirements, and [project standards](../code-review/references/project-standards.md).

## Inputs

Use the fixed target, changed files, acceptance criteria, command results, and
browser/container/deployment evidence. If evidence is missing, run applicable
configured checks with existing dependencies and record blocked checks.

## Procedure

1. Pin the range and list claims requiring evidence.
2. Classify the needed level: unit, integration, system, browser, container,
   deployment, or live service.
3. Inspect positive/negative cases, partitions, boundaries, role/resource/state
   matrices, persistence, concurrency, stale results, timeout, and recovery.
4. Check outcome-based assertions and state preservation after rejection/failure.
5. Record commands, directories, results, limitations, and manual checks.
   Mocked AI/API tests do not prove live, browser, container, or deployed behaviour.

## Completion criterion

Classify every changed acceptance claim as supported, unsupported, blocked, or
not applicable with a reason. Record every command/result and unverified boundary.

## Output

Use the shared [report format](../code-review/references/review-report.md).
Use the parent artifact path, or a unique `reviews/` path standalone. Use
`VR-<review>-<number>` IDs; a parent may remap them.
