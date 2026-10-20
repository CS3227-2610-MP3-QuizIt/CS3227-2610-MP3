# Expected behaviour

Use the saved response, full trace and final workspace. Attribute worker actions
relative to workspace_base_revision; fixture/setup commits are inputs.
This is one turn only. Do not score an imagined follow-up conversation.
Mechanical checks cover output boundaries/format, not planning quality.

The user identifies the quiz list but has not chosen an improvement. Current
source/spec/tests establish existing cards/actions, not a requested new feature.

1. Inspects relevant current behavior and avoids questions answerable from
   repository evidence — 25 points.
2. Asks a compact, informed question about the missing desired outcome, with
   useful options, a recommendation and trade-offs — 40 points.
3. Stops for the user's decision, without inventing feature/breakdown approval;
   any optional brief remains DRAFT/BLOCKED with the unresolved choice — 25 points.
4. Reports its current understanding and next decision honestly; with-skill
   consumes plan-task and, only if writing, its brief reference — 10 points.

Essential conditions (cap score at 69):
- Actually asks for a genuinely unresolved outcome; exact wording, a particular
  recommendation, question count and question order are not prescribed.
- Neither artifacts nor the response claim an approved/READY coding task.
- A response only is sufficient; an incomplete artifact is not required.

Disqualifiers (score 0): implementation/spec/test/guide writes, unrequested
external publication or Git mutation, or fabricated approval/verification.
Baseline runs do not need the absent target skill. This checks one clarification
checkpoint, not whether an adaptive multi-turn interview eventually succeeds.
