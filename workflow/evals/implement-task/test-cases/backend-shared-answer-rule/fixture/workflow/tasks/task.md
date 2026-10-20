# backend-shared-answer-rule

Status: READY — user approved this unchanged task
Owner: Eval owner
Depends on: none
Sources: ../../specs/product.md
Baseline: Prepared fixture HEAD; inspect current worktree before editing.

## Outcome and scope
Fix the missing answer validation for both service entry points. Keep one
shared answer-validity policy with cohesive ownership, per SRP/DRY.

Allowed scope: backend/answers.py, optional focused backend/*.py helpers, and new
backend/tests/test_*.py. Preserve existing tests and public call contracts.

## Acceptance and planned verification
- AC-01: both entry points accept integer 1..4 and reject bool, out-of-range and other types; unittest partitions/boundaries.
- AC-02: invalid/denied operations preserve the entire attempt, including when the last submitted answer is invalid.
- AC-03: existing owner/state/question/completeness behavior remains intact; regressions pass.

## Implementer handoff
Start with a focused behavioral regression, then the smallest complete fix.
Write observed evidence to workflow/implementations/task.md.
