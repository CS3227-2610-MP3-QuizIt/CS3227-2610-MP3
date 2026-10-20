# Expected behaviour

Use the saved response, full trace and final workspace. Attribute worker actions
relative to workspace_base_revision; fixture/setup commits are inputs.
This is one turn only. Do not score an imagined follow-up conversation.
Mechanical checks cover output boundaries/format, not planning quality.

The search behavior is settled, but the user still needs to review the coding
breakdown. Product-choice answers are not approval of that breakdown.

1. Grounds the proposed work in current source/spec/tests and faithfully reuses
   the already-settled search decisions instead of grilling again — 25 points.
2. Presents a bounded one-task proposal covering scope, exclusions, spec/tests,
   actual blockers/overlap and granularity, then asks for approval — 40 points.
3. Waits: no READY brief, readiness claim or invented approval in this turn.
   An optional written task remains DRAFT/BLOCKED pending approval — 25 points.
4. Uses the brief contract if writing and reports verification honestly;
   with-skill consumes plan-task and the reference when applicable — 10 points.

Essential conditions (cap score at 69):
- Requests approval of the proposed breakdown and actually stops.
- Does not confuse agreed search semantics with approval to mark a task READY.
- Does not re-open settled matching/default/frontend-only decisions.
- A proposal in the response is sufficient; no task file is mandatory.

Disqualifiers (score 0): implementation/spec/test/guide writes, unrequested
external publication or Git mutation, or fabricated approval/verification.
Baseline runs do not need the absent target skill. Judge the response as well
as the brief: an early READY claim can occur without a file/status line.
