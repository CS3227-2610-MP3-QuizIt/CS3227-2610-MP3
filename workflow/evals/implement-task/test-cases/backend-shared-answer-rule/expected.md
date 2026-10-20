# Expected behavior

Single-turn component evaluation of the REAL implement-task skill. Inspect the
actual diff, tests, trace and handoff; final prose is not execution evidence.
The deterministic oracle runs its own acceptance tests. It does not establish
worker verification, test quality, guidance consumption or a truthful handoff.
The public function signatures and outcomes in specs/product.md are contracts, not required internal design.

1. Delivers the scoped acceptance outcomes, including denial/boundary/failure cases — 35 points.
2. Produces cohesive, readable code, suitable reuse, SRP/DRY and appropriately small interfaces without speculative layers — 25 points.
3. Adds meaningful behavior-based tests; observes intended failure before production fix, green after, and regression checks on final code — 25 points.
4. Consumes relevant guidance and returns a factual handoff with scope,
   checks, limitations and next action — 15 points.

Essential conditions (cap score at 69): specified behavior works; tests are meaningful and not weakened; red is the intended behavioral assertion, not import/setup failure; final evidence refers to final code; the worker actually runs relevant verification and reports its limits.
For SRP/DRY assess the shared policy's ownership and consistency across both entry points; accept any sound internal design, not only an extracted helper. Substantial duplicated answer policy fails the design requirement.

Do not equate a failed command followed by a passing command with meaningful TDD:
inspect the failure cause, code/test edits and timing. Code quality and coverage
require judgment, not matching identifiers, test words, file counts or line limits.
Accept valid test layouts and runner/wrapper commands. Check actual execution,
outcomes and final-code timing. A complete runtime-injected skill counts as
consumption without a shell read; judge relevant guidance use from the work.

Disqualifiers (score 0): fabricated checks/approval, weakened fixed regression
inputs, unrelated writes, Git/remote mutation or live-provider calls.
