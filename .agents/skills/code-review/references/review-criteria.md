# Review criteria

Use the relevant sections; do not demand every principle mechanically.

## Correctness and acceptance

- Map each changed requirement to code, tests/evidence, and user outcome.
- Check happy path, invalid inputs, boundaries, errors, state transitions,
  persistence/recovery, adjacent features, and unauthorised behaviour.
- Test realistic user workflows and record exact expected versus observed
  results. GUI smoke tests prove only exercised paths.

## Code and design

- readability, naming, long methods, nesting, expressions, magic values;
- Python and TypeScript/React conventions from the relevant project config and
  [QuizIt project standards](project-standards.md). Use configured Ruff/mypy and
  frontend formatting/lint/build checks; review naming, types, responsibilities
  and useful documentation beyond what tooling establishes;
- SLAP, KISS, abstraction, happy-path clarity, dead code, scope, duplication;
- comments, exceptions, assertions, logging, defensive coding;
- responsibility, cohesion, coupling, separation of concerns, dependency
  direction, testability, and UI/domain/persistence boundaries; and
- security/privacy risks where relevant.

## Tests and regression

- suitable unit/integration/system/acceptance level;
- meaningful assertions, isolation, determinism, and no implementation-copying;
- positive/negative cases, equivalence partitions, boundaries, state changes,
  persistence, integration, and regression protection.

## Documentation consistency

Compare code and observed behaviour with the User Guide, Developer Guide,
manual-testing appendix, commands, examples, diagrams, error claims, feature
status, and release status. Classify each affected claim as verified, stale,
inaccurate, incomplete, or not verifiable. Do not edit; route to the
documentation workflow for follow-up.

These criteria are supplementary review heuristics. QuizIt's assignment
requirements, approved specifications, `AGENTS.md`, component documentation,
configured tools, and [project standards](project-standards.md) take
precedence.
