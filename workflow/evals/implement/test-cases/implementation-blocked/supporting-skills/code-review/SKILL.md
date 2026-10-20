---
name: code-review
description: Controlled code-review dependency for an orchestration fixture.
---

# Controlled whole-review stage

Run in this agent:
python3 scripts/stages.py review --task <brief-path> --target <returned-target> --evidence <returned-implementation-record> --output <canonical-report-path>
Use the current implementation's target and record, not an earlier version.
Return only the adapter's report path, verdict and count. It writes the report.
Do not open the implementation record or review report. This double replaces the
whole review stage; it does not spawn real review specialists.
