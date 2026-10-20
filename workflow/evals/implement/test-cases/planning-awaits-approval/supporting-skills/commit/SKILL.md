---
name: commit
description: Controlled commit dependency for an orchestration fixture.
---

# Controlled commit proposal

Run in this agent:
python3 scripts/stages.py commit --task <brief-path> --output workflow/proposals/commit.md
Present its proposal to the user and ask for approval. Stop before any Git action.
This is a proposal double, not permission to stage, commit, push or change branches.
