# Delegated implementation workflow

After interactive planning in main, delegate implementation and review. Track
dispatch, stage results and correction count in the task list.

Spawn workers with fresh conversation context. Do NOT fork the parent
conversation. Share relevant decisions and artifact pointers, not chat history.
During delegation, main must NOT read `DEFAULT.md`, the implementation skill,
profile instructions, implementation records, review child artifacts or canonical
reports. Workers inspect source/tests; main uses compact returns for routing.
Source inspection in main belongs only to planning or authorized commit review.

## 1. Implement one task

Spawn `task_implementer` for the selected READY brief; supply task arguments only.
If the profile is unavailable, report `BLOCKED`; do not substitute roles.

```text
Repository: <root>
Task: <brief path>
Decisions/approval: <relevant user decisions or references>
Existing work: <known unrelated changes or ownership constraints>
Review: <canonical report path for corrections, otherwise none>
Output: <unique workflow/implementations/task-run-pass.md>
```

Append only relevant scope and explicit exclusions. The worker reads its own
skills and records baseline, changed paths, final target and checks.
Wait for its compact return, including `logging_summary`. Retain the returned
check rows, correction IDs, limits and evidence pointers in main's checkpoint
summary. Ask the worker for missing material fields before closing its thread;
do not read its record to reconstruct them. Then close it before review.
Resolve `NEEDS_DECISION` and planning gaps directly with the user using
`plan-task` in main. Resume after required approval; surface environment/access
blockers rather than retrying unchanged inputs.

## 2. Review and correct

Follow [code-review](../code-review/SKILL.md) in main as the review dispatcher,
not as another child orchestrator. Pass the worker's exact target, changed
paths, brief/requirements and evidence pointers. Keep writers paused during
review; include relevant uncommitted and untracked changes in the target.
Use a unique canonical `workflow/reviews/<task-id>-<run-id>.md` for this task.
Do NOT read reviewer skills, `AGGREGATOR.md`, profiles or reports.

Retain each review's returned `logging_summary` alongside its path/verdict;
use the verdict for routing, not a parent reinterpretation of findings.
On `PASS`, retain the returned path/verdict. For a non-PASS verdict, pass the
unread report to `task_implementer` for required in-scope follow-up. Decisions
and disputed findings return to the user. After edits, rerun the complete review
stage on the updated target using the matching canonical report and finding IDs.
Stop after two correction passes without acceptance, or a worker blocker;
report unresolved state rather than manufacturing a pass. WARN requires the
user's explicit acceptance of remaining findings before closeout.

## 3. Log

Return task/brief, implementation record, review path/verdict, check summary,
limitations and manual work; distinguish agent review from human acceptance.
After accepted review, call [logging](../logging/SKILL.md) in main. Supply the
material user decisions, actual dispatches and compact implementation/review
returns. Mark this task's commit outcome pending; include earlier commit hashes
only when already observed. Main still must not read child instructions or
artifacts.
Label worker-reported facts, cite their paths and disclose unavailable details.
The skill obtains missing attribution, presents the complete draft and waits
for content approval before writing. Do not report the log written while its
approval is pending. Carry the approved log path into the commit stage; do not
start commit while required log content approval remains pending.

## 4. Commit and finish

Main follows [commit](../commit/SKILL.md) to propose focused commits, including
the approved log with its matching outcome, and waits at its approval gates.
Its scoped diff inspection is a closeout exception, not permission to reread
worker instructions or review artifacts. Record actual commit hashes in the
final response; do not amend merely to insert the log's own resulting hash.
An explicit user instruction to skip logging or defer commits takes precedence;
state that disposition rather than inventing a completed stage.

Return the task, commit results, log path or pending draft, verification limits
and next action. Leave other tasks queued. A blocked/unfinished implementation
or review does not enter commit; standalone logging remains available on request.
Branch/remote/deployment actions require their own authorization.
