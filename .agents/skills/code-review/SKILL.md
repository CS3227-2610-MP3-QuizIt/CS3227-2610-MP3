---
name: code-review
description: Review an implemented QuizIt change. Use directly for one-agent review, or use the orchestrator path when subagents are available.
---

# Code review

## User input

```text
$ARGUMENTS
```

Use the requested scope and fixed point if supplied.

## Workflow
Do NOT explore and read unnecessary files.

1. Determine whether review subagents are available.
2. If they are available, read and follow [SUBAGENTS.md](SUBAGENTS.md) ONLY.
3. Otherwise, read and follow [DEFAULT.md](DEFAULT.md) ONLY.

If the user explicitly requests one-agent review, use `DEFAULT.md`.
If subagents were requested but are unavailable, state that once and use
`DEFAULT.md`.
