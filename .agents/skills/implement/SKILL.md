---
name: implement
description: Run a QuizIt change through task planning, implementation, review and bounded corrections. Use for end-to-end delivery; use implement-task for only the coding stage.
---

# Implement

Complete one selected task per run; leave other tasks queued. Keep planning
approval, implementation and acceptance distinct. Propose commits after accepted
review; wait for the commit skill's approvals.

Do NOT explore and read unnecessary files.

1. Plan interactively in main using [plan-task](../plan-task/SKILL.md) when the
   request is unclear or its brief unapproved. Read the planning context needed
   to discuss decisions directly with the user; wait for breakdown approval.
   An unchanged approved READY brief skips planning. If already satisfied,
   return evidence and stop. If several tasks are READY and none selected,
   ask the user to select one.
2. If subagents are available and one-agent execution was not requested, read
   and follow [SUBAGENTS.md](SUBAGENTS.md) ONLY.
3. Otherwise, read and follow
   [DEFAULT.md](DEFAULT.md) ONLY.

If subagents were requested but unavailable, state that once before using
`DEFAULT.md`. A configured profile does not prove runtime isolation or execution.
