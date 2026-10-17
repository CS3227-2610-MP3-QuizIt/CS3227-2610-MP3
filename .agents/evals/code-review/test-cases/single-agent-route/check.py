#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


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


def commands(path: Path) -> list[str]:
    values: list[str] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        item = event.get("item") if isinstance(event, dict) else None
        payload = event.get("payload") if isinstance(event, dict) else None
        candidates = []
        if isinstance(item, dict) and item.get("type") in {"command_execution", "CommandExecution"}:
            candidates.append(item.get("command"))
        if isinstance(payload, dict) and payload.get("type") == "item_completed":
            completed = payload.get("item")
            if isinstance(completed, dict) and completed.get("type") in {"command_execution", "CommandExecution"}:
                candidates.append(completed.get("command"))
        if isinstance(payload, dict) and payload.get("type") == "exec_command_end":
            candidates.append(payload.get("command"))
        for command in candidates:
            if isinstance(command, list):
                values.append(" ".join(str(part) for part in command).lower())
            elif command is not None:
                values.append(str(command).lower())
    return values


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--trace", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()
    text = "\n".join(commands(args.trace))
    metrics_path = args.run.parent / "worker" / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.is_file() else {}
    spawned = int(metrics.get("subagent_spawn_count", 0) or 0)
    reports = list((args.workspace / "reviews").glob("*.md"))
    checks = [
        {"id": "reads-default", "pass": "default.md" in text, "points": 35 if "default.md" in text else 0, "notes": "DEFAULT.md must be read."},
        {"id": "does-not-read-delegated-files", "pass": "subagents.md" not in text and "aggregator.md" not in text, "points": 25 if "subagents.md" not in text and "aggregator.md" not in text else 0, "notes": "Delegated workflow files must not be read."},
        {"id": "no-spawn", "pass": spawned == 0, "points": 20 if spawned == 0 else 0, "notes": f"spawn_count={spawned}"},
        {"id": "report", "pass": bool(reports), "points": 15 if reports else 0, "notes": f"reports={len(reports)}"},
        {
            "id": "fixture-source-preserved",
            "pass": not [path for path in changed_paths(args.run.parent) if not path.startswith("reviews/")],
            "points": 5 if not [path for path in changed_paths(args.run.parent) if not path.startswith("reviews/")] else 0,
            "notes": "Only review artifacts may be changed.",
        },
    ]
    score = sum(check["points"] for check in checks)
    print(json.dumps({"overall_pass": score >= 70, "score": score, "checks": checks, "limitations": []}))


if __name__ == "__main__":
    main()
