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
Wait for its compact return; close completed worker threads before review.
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

On `PASS`, retain the returned path/verdict. For a non-PASS verdict, pass the
unread report to `task_implementer` for required in-scope follow-up. Decisions
and disputed findings return to the user. After edits, rerun the complete review
stage on the updated target using the matching canonical report and finding IDs.
Stop after two correction passes without acceptance, or a worker blocker;
report unresolved state rather than manufacturing a pass. WARN requires the
user's explicit acceptance of remaining findings before closeout.

## 3. Close out

Return task/brief, implementation record, review path/verdict, check summary,
limitations and manual work; distinguish agent review from human acceptance.
Record prompts, actual agent invocations and compact outcomes under the selected
owner's existing `logs/` convention. Distinguish worker-reported checks from
personally verified results. Obtain missing owner/destination before writing a
personal log; do not read child artifacts to reconstruct one.

Main follows [commit](../commit/SKILL.md) to propose focused commits for this
task and waits at its approval gates. Its scoped diff inspection is a closeout
exception, not permission to reread worker instructions
or review artifacts. Stop here; leave other tasks queued. Branch/remote/deployment
actions require their own authorization.
