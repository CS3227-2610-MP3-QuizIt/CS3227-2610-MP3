---
name: plan-task
description: Controlled plan-task dependency for an orchestration fixture.
---

# Controlled planning stage

Run in main:
python3 scripts/stages.py plan --task workflow/tasks/quiz-search.md --output workflow/proposals/task.md
Present the returned one-task proposal and approval question directly to the user.
Wait for their answer. Write no READY brief and start no implementation.
