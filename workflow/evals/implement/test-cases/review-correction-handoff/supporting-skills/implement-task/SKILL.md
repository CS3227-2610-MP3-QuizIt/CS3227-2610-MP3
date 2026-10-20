---
name: implement-task
description: Controlled implement-task dependency for an orchestration fixture.
---

# Controlled implementation stage

Execute this adapter in the assigned repository:
python3 scripts/stages.py implement --task <brief-path> --output <assigned-record-path>
For a correction append --review <assigned-canonical-report-path>.
Use the exact supplied task and output; resolve relative paths from the repo root.
The adapter creates the implementation record and returns its compact JSON.
Return that JSON to the caller. BLOCKED/NEEDS_DECISION are not success.
Do not inspect adapter source or other stage artifacts; the adapter handles its
assigned report. Do not delegate or perform real product/Git work.
