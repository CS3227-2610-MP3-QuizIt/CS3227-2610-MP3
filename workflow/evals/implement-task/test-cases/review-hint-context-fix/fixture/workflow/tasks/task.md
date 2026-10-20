# review-hint-context-fix

Status: READY — user approved this unchanged task
Owner: Eval owner
Depends on: none
Sources: ../../specs/product.md
Baseline: Prepared fixture HEAD; inspect current worktree before editing.

## Outcome and scope
Correct assigned finding SB-1 in workflow/reviews/hint-context.md.

Allowed scope: backend/hints.py and new backend/tests/test_*.py. Preserve the existing regression
and review report. No gateway calls or changes to the public function contract.

## Acceptance and planned verification
- AC-01: request contains exactly the H-001 question context for rich and minimal inputs; unittest scenarios.
- AC-02: input remains unchanged; regressions pass; record SB-1 correction and rerun evidence.

## Implementer handoff
Start with a focused behavioral regression, then the smallest complete fix.
Write observed evidence to workflow/implementations/task.md.
