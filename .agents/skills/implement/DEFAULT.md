# Single-agent implementation workflow

Execute stages in this agent. Do NOT read `SUBAGENTS.md` or profile instructions.
Use a task list to track the selected task and stage.

1. Follow [implement-task](../implement-task/SKILL.md) for the selected READY brief.
   Assign a unique implementation record under `workflow/implementations/`.
   Resolve planning gaps in main with `plan-task`; resume after any required
   approval. Surface environment/access blockers.
2. Follow [code-review](../code-review/SKILL.md), explicitly selecting one-agent
   review, on the returned target, changed paths, brief and evidence. Select a
   matching canonical report under `workflow/reviews/`. This is self-review,
   not independent agent verification.
3. For non-PASS review, read its required follow-up and return in-scope fixes to
   `implement-task`, then rerun review on the new target. Surface unresolved
   requirements or disputed findings to the user. Stop after two correction
   passes without acceptance; keep the report, findings and blocker visible.
   WARN requires the user's explicit acceptance of remaining findings.
4. Return task/brief, implementation record, review path/verdict, checks and
   remaining manual work. Record prompts, stage outcomes and verification in
   the selected owner's existing `logs/` convention; obtain a missing owner/
   destination before writing a personal log. Follow [commit](../commit/SKILL.md)
   to propose focused commits for this task and wait at its approval gates.
   Stop here; leave other tasks queued. Branch/remote/deployment actions require
   their own authorization.
