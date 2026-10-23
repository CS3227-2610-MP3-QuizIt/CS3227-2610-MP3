# Review report

## Review scope and evidence

Review only. Preserve unrelated changes. Write only the assigned review
artifacts; leave code, tests, guides, specs, build files, logs, Git and GitHub
unchanged. Use existing tools/dependencies and check modes, not installs or fixes.
Normal build/cache outputs are allowed as described in [project checks](project-checks.md).

For source review, read `AGENTS.md` for project routing. Requirements come from
the assignment brief, approved specs and task acceptance criteria. Implementation
and execution evidence establish actual behaviour; guides do not override
approved requirements.
Report contradictions and unavailable scope, release status or required evidence
as limitations or `BLOCKED`. Never present an unavailable check as passed or
unverified behaviour as available.

Assess every applicable check; mark it complete only with evidence. Explain
skips and non-applicability. An incomplete or unverified applicable check
precludes `PASS`.

## Findings

Distinguish defects, risks, suggestions and unanswered questions. Use evidence:

- `Blocker`: build, test, launch, required acceptance or safe release fails.
- `High`: likely functional, data-loss, security, serious regression or major
  architecture defect.
- `Medium`: meaningful robustness, testability, maintainability or doc defect.
- `Low`: local readability, naming, style or cleanup issue.

Every finding has a stable ID in the form `CR-<review>-<number>` and a status.
Specialist outputs use their skill's prefix; the parent controls consolidation.
Keep IDs across reruns. Valid statuses are `Open` (default), `Accepted`,
`In progress`, `Fixed`, `Rejected`, `Not reproducible` and `Deferred`.
Resolved statuses require justification/evidence and verification; retain old
findings and synchronize their handoff actions instead of silently deleting them.

Include every finding field in the template below.

## Completion and handoff

For the final review, write one selected canonical report under `workflow/reviews/`, such as
`workflow/reviews/quiz-publication-01.md`; reuse only its matching report on reruns.
Specialists use the parent's output mode: in-memory findings or an assigned
artifact instead. Standalone specialists select a unique `workflow/reviews/` path.

Report these decisions explicitly:

- Implementation follow-up: `YES` for implementation defects, unmet criteria,
  broken behaviour, data-loss/security risk, serious regression or code-level
  defensive/design fixes; otherwise `NO`.
- Edit documentation: `YES` for stale/missing docs, diagrams, commands, examples
  or user claims; `AFTER CODE FIX` when code must change first; otherwise `NO`.
- Rerun code review: `AFTER FOLLOW-UP WORK` after relevant code, test or doc
  changes; otherwise `NO`.
- Independent human review: `READY` only with no unresolved Blocker/High findings
  and explicit limitations; otherwise `NOT READY` or `BLOCKED`.

Complete the handoff fields below for each follow-up action. If none remains,
state that and record final checks and human-review status. Documentation
follow-up must not describe an unverified fix as working.

Tell the user which manual checks remain, tied to unproven behaviours such as
layout, native dialogs, keyboard flow or target-platform behaviour. State
`No manual checks required` only with evidence covering applicable manual concerns.

## Format

```markdown
# Code Review Report

## Status
- Target:
- Scope:
- Overall: PASS | FINDINGS | BLOCKED
- Independent human review: READY | NOT READY | BLOCKED

## Checks
| Area | Status | Command/evidence |
| --- | --- | --- |
| Compilation | | |
| Tests | | |
| Smoke/acceptance testing | | |
| Static analysis | | |
| Packaging/resources | | |
| Specification validation | | |
| Documentation consistency | | |

## Next actions
- Implementation follow-up required: YES | NO
- Edit documentation: YES | NO | AFTER CODE FIX
- Rerun code-review skill: YES | NO | AFTER FOLLOW-UP WORK
- Reason:

## Agent handoff
- Follow-up required: YES | NO | BLOCKED
- Current implementation/review state:
- Next responsible skill or human:
- Priority and finding addressed:
- Exact files and line locations:
- Required change or investigation:
- Constraints and out-of-scope work:
- Verification commands:
- Manual checks:
- Success criteria:
- Documentation impact:
- Required next rerun:
- Blocker or decision needed:

## Findings
- `CR-<review>-<number>` — [severity] Title — Status: Open | Accepted | In progress | Fixed | Rejected | Not reproducible | Deferred
- Category:
- Location:
- Requirement:
- Evidence:
- Expected / actual:
- Reproduction or inspection path:
- Impact:
- Likely cause / confidence:
- Fix direction and affected responsibility:
- Tests to add/update:
- Documentation impact:
- Verification after fixing:

## Positive observations
-
## Gaps and limitations
-

## Manual checks for user
-

## Conclusion
-
```
