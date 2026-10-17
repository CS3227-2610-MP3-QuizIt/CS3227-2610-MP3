#!/usr/bin/env python3
"""Deterministic routing checks for delegated code review."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


CHILD_SKILLS = (
    "code-quality-review/skill.md",
    "spec-contract-review/skill.md",
    "security-boundary-review/skill.md",
    "verification-review/skill.md",
)


def commands(path: Path) -> list[str]:
    values: list[str] = []
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        item = event.get("item") if isinstance(event, dict) else None
        if isinstance(item, dict) and item.get("type") in {"command_execution", "CommandExecution"}:
            command = item.get("command")
            if isinstance(command, list):
                values.append(" ".join(str(part) for part in command).lower())
            elif command is not None:
                values.append(str(command).lower())
        payload = event.get("payload") if isinstance(event, dict) else None
        if isinstance(payload, dict) and payload.get("type") == "item_completed":
            item = payload.get("item")
            if isinstance(item, dict) and item.get("type") in {"command_execution", "CommandExecution"}:
                command = item.get("command")
                if isinstance(command, list):
                    values.append(" ".join(str(part) for part in command).lower())
                elif command is not None:
                    values.append(str(command).lower())
        if isinstance(payload, dict) and payload.get("type") == "exec_command_end":
            command = payload.get("command")
            if isinstance(command, list):
                values.append(" ".join(str(part) for part in command).lower())
            elif command is not None:
                values.append(str(command).lower())
    return values


def changed_paths(run_dir: Path) -> set[str]:
    paths: set[str] = set()
    for patch in (run_dir / "git").glob("*.patch"):
        for line in patch.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("+++ b/"):
                paths.add(line[6:])
            elif line.startswith("diff --git a/"):
                parts = line.split()
                if len(parts) >= 4 and parts[3].startswith("b/"):
                    paths.add(parts[3][2:])
    return paths


def rollout_for(run_dir: Path, thread_id: str) -> Path | None:
    matches = sorted((run_dir / "worker" / "subagents").glob(f"*{thread_id}*.jsonl"))
    return matches[0] if matches else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--trace", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()

    main_commands = commands(args.trace)
    main_text = "\n".join(main_commands)
    metrics_path = args.run.parent / "worker" / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.is_file() else {}
    subagents = [
        child for child in metrics.get("subagents", [])
        if isinstance(child, dict) and isinstance(child.get("thread_id"), str)
    ]
    waits = int(metrics.get("subagent_wait_count", 0) or 0)
    reports = list((args.workspace / "reviews").glob("*.md"))
    specialist_ids = {
        prefix: [
            child["thread_id"] for child in subagents
            if skill in str(child.get("prompt", "")).lower()
        ]
        for prefix, skill in (
            ("CQ", "code-quality-review/skill.md"),
            ("SC", "spec-contract-review/skill.md"),
            ("SB", "security-boundary-review/skill.md"),
            ("VR", "verification-review/skill.md"),
        )
    }
    aggregator_ids = [
        child["thread_id"] for child in subagents
        if "aggregator.md" in str(child.get("prompt", "")).lower()
    ]

    checks = []
    def add(identifier: str, passed: bool, points: int, notes: str) -> None:
        checks.append({"id": identifier, "pass": passed, "points": points if passed else 0, "notes": notes})

    route_ok = "subagents.md" in main_text and "default.md" not in main_text
    add("main-routes-to-subagents", route_ok, 15, "Main trace must select SUBAGENTS.md without reading DEFAULT.md.")
    forbidden = [path for path in CHILD_SKILLS if path in main_text]
    add("main-does-not-read-child-skills", not forbidden, 25, "Forbidden main-agent child reads: " + ", ".join(forbidden))
    all_specialists = [thread_id for ids in specialist_ids.values() for thread_id in ids]
    specialists_ok = (
        all(len(ids) == 1 for ids in specialist_ids.values())
        and len(set(all_specialists)) == 4
    )
    add("four-specialists", specialists_ok, 20, f"specialist_ids={specialist_ids}")
    add("waits-for-children", waits >= 1, 10, f"wait_count={waits}")
    aggregator_rollouts = [
        rollout_for(args.run.parent, thread_id) for thread_id in aggregator_ids
    ]
    aggregator_rollouts = [path for path in aggregator_rollouts if path is not None]
    aggregator_reads = any(
        "aggregator.md" in "\n".join(commands(path)) for path in aggregator_rollouts
    )
    aggregator_ok = len(aggregator_ids) == 1 and aggregator_reads
    add("aggregator-reads-own-instructions", aggregator_ok, 15, f"aggregator_ids={aggregator_ids}, rollouts={len(aggregator_rollouts)}")
    add("canonical-report", bool(reports), 10, f"reports={len(reports)}")
    changed = changed_paths(args.run.parent)
    source_changes = sorted(path for path in changed if not path.startswith("reviews/"))
    add("source-preserved", not source_changes, 5, f"non-review changes={source_changes}")

    score = sum(check["points"] for check in checks)
    if not (route_ok and not forbidden and specialists_ok and aggregator_ok and reports):
        score = min(score, 69)
    print(json.dumps({"overall_pass": score >= 70, "score": score, "checks": checks, "limitations": []}))


if __name__ == "__main__":
    main()
