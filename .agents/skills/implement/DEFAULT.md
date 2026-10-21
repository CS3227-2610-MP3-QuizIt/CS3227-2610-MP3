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
   remaining manual work. After accepted review, call
   [logging](../logging/SKILL.md) with material prompts/decisions, stage outcomes,
   observed verification and any actual earlier commit results. Mark this
   task's commit outcome pending.
   Identify self-review honestly. Obtain the summary's content approval before
   writing; retain its approved path. Do not start commit while required log
   approval is pending.
5. Follow [commit](../commit/SKILL.md) to group the approved log with its matching
   outcome and propose focused commits; wait at the normal approval gates.
   Return actual hashes, log path, checks and remaining manual work. Do not
   amend merely to insert the log's own hash or recursively log the commit.
   Respect explicit user instructions to skip logging or defer commits and
   report the actual disposition.
   Leave other tasks queued. Blocked implementation/review does not enter commit;
   standalone logging remains available on request. Branch/remote/deployment
   actions require their own authorization.
