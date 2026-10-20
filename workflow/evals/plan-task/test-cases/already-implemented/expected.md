# Expected behaviour

Use the saved response, full trace and final workspace. Attribute worker actions
relative to workspace_base_revision; fixture/setup commits are inputs.
This is one turn only. Do not score an imagined follow-up conversation.
Mechanical checks cover output boundaries/format, not planning quality.

The requested resume behavior exists: open_attempt returns the same owner's
record without resetting answers; test_reopen_preserves_answers exercises it.
The existing frontend card also offers Resume. No new endpoint is needed.

1. Establishes the source/test evidence for reopening and preserving answers,
   including ownership and status boundaries — 45 points.
2. Concludes no new implementation task is needed instead of inventing work.
   Any proposed verification follow-up names a specific genuine gap — 35 points.
3. Gives an honest response distinguishing inspection, tests actually run and
   remaining limits; with-skill consumes plan-task — 20 points.

Essential conditions (cap score at 69):
- Recognizes the behavior exists and does not plan to implement it again.
- Does not push questions answerable from the source back to the user.
- A response with evidence is sufficient; no task artifact or template read
  is required unless it chooses to write a justified verification brief.

Disqualifiers (score 0): implementation/spec/test/guide writes, unrequested
external publication or Git mutation, or fabricated verification evidence.
Baseline runs do not need the absent target skill. Mechanical checks cannot
decide whether an optional verification follow-up is genuinely warranted.
