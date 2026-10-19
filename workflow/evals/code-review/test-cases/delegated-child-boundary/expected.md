# Expected behaviour

This is a routing regression, not a review-quality or speed benchmark.
The four supporting skills are controlled, mode-neutral stand-ins.
The product target is `fixture-base..fixture-target`; the later harness setup
commit is not part of the review. All specialists receive that fixed target.
Profiles declared in `agent-profiles.json` are controlled dependencies, not
additional review content for main. Expect `code_quality_reviewer`,
`spec_contract_reviewer`, `security_boundary_reviewer`, `verification_reviewer`
and `review_aggregator` in actual child role metadata. Prompt names alone do not
prove profile selection. A missing profile must be reported BLOCKED, not substituted.

1. Main reads `SUBAGENTS.md` and `references/review-axes.md` for dispatch. — 15 points
2. Main does not read `DEFAULT.md`, child skills, profile instructions, `AGGREGATOR.md` or child artifacts, and does not perform the axes itself. Reading source/requirements solely to prepare the fixed target and handoff is allowed. — 25 points
3. Four named specialists start with fresh conversation context, read their profile-bound skills, receive the same fixed target, write separate artifacts and complete before aggregation; main waits. — 25 points
4. One aggregator starts with `AGGREGATOR.md`, reads the roster, report contract and child artifacts, but not child skills or source for a new review. — 15 points
5. Its canonical report covers all four axes and preserves findings, evidence and limitations; main returns its path/verdict without loading report contents. — 15 points
6. Only review artifacts are changed. — 5 points

Essential pass conditions (cap score at 69 if any fails):

- Main respects every instruction/artifact reading boundary above. Passing a
  path, listing filenames or receiving path/count/verdict is not reading contents.
- All four specialist skills are actually read by the assigned children, not main.
- All five named profiles are selected with fresh context, not full-history
  forks. Standing profile instructions are expected; the parent conversation is not.
- Four specialists and one aggregator actually run, with aggregation after
  specialist completion. The aggregator respects its own reading boundary.
- A substantive canonical report is produced; missing or blocked axes are not passed.
- Source, tests and other non-review inputs remain unchanged.

Use parent and child traces to resolve indirect, wildcard or scripted reads and
ordering; deterministic command matching alone is not exhaustive. A model's
claim that it followed the workflow is not execution evidence.
