# Single-agent code review

Review the requested QuizIt scope; do not fix. Inspect the relevant
implementation, tests, specifications, acceptance evidence, User Guide,
Developer Guide, diagrams, and Git diff.
Preserve unrelated changes. Do not edit code, tests, guides, specifications,
build files, logs, Git, or GitHub; do not install tools or dependencies.

Write each review to a unique, logical report under `reviews/`, using a number
when useful. For a rerun, update only the matching report; do not overwrite
unrelated reviews.

## Truth and gates

Read `AGENTS.md` for project routing. Use `assignment-brief.md`, relevant
specifications, approved task acceptance criteria, and
`references/project-standards.md` to establish expected
behaviour and design boundaries. Implementation and execution evidence
establish actual behaviour; current guides do not override approved
requirements. Report material contradictions.

Use `references/project-checks.md` and run applicable configured
compilation, tests, smoke checks, static analysis, packaging, and resource
checks. Read `references/review-criteria.md` and
`references/review-report.md`.

Use the native todo or plan facility to create one item for every applicable
review check. Mark an item complete only after obtaining evidence; do not
report `PASS` while an applicable check is incomplete, unverified, or marked
not applicable without a reason.

Stop or report `BLOCKED` if the requested scope, release status, or required
evidence is unavailable. Never call an unavailable check passed. Do not call
unverified behaviour available.

## Workflow

1. Identify the requested scope, target issue or release if any, diff, changed
   files, tests, docs, diagrams, and unrelated changes.
2. Read project checks and run applicable configured checks.
3. Read review criteria. Validate every changed requirement against
   implementation and evidence.
4. Exercise the changed feature as a user: happy path, invalid inputs,
   boundaries, state changes, recovery, persistence, and adjacent workflows.
5. Review code quality and design: responsibility, cohesion, coupling,
   dependency direction, duplication, complexity, testability, maintainability,
   and relevant frontend/backend boundaries. Review tests, regression
   protection, and security where applicable.
6. Compare code and observed behaviour with affected guides, commands,
   examples, diagrams, error claims, and manual-testing instructions.
7. Write or update the canonical report with findings, limitations, rerun
   decisions, and the agent handoff. Re-read the report and final diff.

Steps 1–3 are mandatory for a normal feature review. Narrow later steps only
when irrelevant; report what was skipped and why.

For Python and TypeScript/React changes, use the relevant project's configured
formatting, lint and type checks, project standards, and review conventions.
Do not impose conventions from another language or project.

## Finding rules

Report only evidence-based findings. Distinguish defects, risks, suggestions,
and unanswered questions:

- `Blocker`: build, test, launch, required acceptance, or safe release fails.
- `High`: likely functional, data-loss, security, serious regression, or major
  architecture defect.
- `Medium`: meaningful robustness, testability, maintainability, or doc defect.
- `Low`: local readability, naming, style, or cleanup issue.

Each finding must contain location, requirement, evidence, expected and actual
behaviour, reproduction or inspection path, impact, likely cause, confidence,
fix direction, files or responsibility, tests, documentation impact, and
post-fix checks.

Give every finding a stable ID in the form `CR-<review>-<number>` and a status:
`Open`, `Accepted`, `In progress`, `Fixed`, `Rejected`, `Not reproducible`, or
`Deferred`. `Open` is the default. A resolved status includes evidence and
verification; do not silently delete old findings.

## Rerun decisions

Report all four explicitly:

- `Implementation follow-up required: YES` for implementation defects, unmet
  criteria, broken behaviour, data-loss or security risk, serious regression,
  or code-level defensive/design fixes; otherwise `NO`.
- `Edit documentation: YES` for stale or missing docs, diagrams, commands,
  examples, or user claims; `AFTER CODE FIX` when code changes first;
  otherwise `NO`.
- `Rerun code-review skill: AFTER FOLLOW-UP WORK` after relevant code, tests,
  or documentation changes; otherwise `NO`.
- `Independent human review: READY` only when no unresolved Blocker or High
  findings remain and limitations are explicit; otherwise `NOT READY` or
  `BLOCKED`.

Do not update docs to describe an unverified fix.

## Handoff requirement

The canonical report is the handoff for the next agent. Its `Agent handoff`
section must be complete whenever follow-up is needed. For each action, state
the responsible skill or human, priority, exact files and line locations, the
requirement or finding addressed, expected change, tests or manual checks,
success criteria, documentation impact, and required next rerun.

If no follow-up is needed, state that explicitly and record final checks and
human-review status. Keep findings and handoff synchronized on reruns: resolve
or retain each finding with evidence rather than appending contradictions.

## User handoff

After every completed review, tell the user exactly which manual checks remain.
Keep this short and tied to behaviours not proven by automated evidence, such
as visual layout, native dialogs, keyboard flow, or target-platform behaviour.
State `No manual checks required` only when the evidence covers all applicable
manual acceptance concerns.
