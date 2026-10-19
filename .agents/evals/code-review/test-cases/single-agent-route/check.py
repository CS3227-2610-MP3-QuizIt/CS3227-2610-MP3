#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fnmatch
import json
import shlex
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


def read_commands(path: Path, workspace: Path) -> list[str]:
    """Recognize ordinary shell readers, not path mentions or directory listings."""
    readers = {"cat", "sed", "head", "tail", "less", "more", "awk", "rg", "grep", "python", "python3", "node", "perl"}
    def segments(command: str) -> list[str]:
        try:
            tokens = shlex.split(command)
            if tokens and Path(tokens[0]).name in {"sh", "bash", "zsh"}:
                for index, token in enumerate(tokens[1:], 1):
                    if token.startswith("-") and "c" in token:
                        return segments(" ".join(tokens[index + 1:]))
            lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|")
            lexer.whitespace_split = True
            parts, current = [], []
            for token in [*lexer, ";"]:
                if token and set(token) <= set(";&|"):
                    if current and Path(current[0]).name in readers:
                        if not (Path(current[0]).name == "rg" and "--files" in current):
                            parts.append(" ".join(current))
                    current = []
                else:
                    current.append(token)
            return parts
        except ValueError:
            return []
    parts = [part for command in commands(path) for part in segments(command)]
    # Expand ordinary file globs against actual case inputs, case-normalized.
    targets = [target for root in (workspace / ".agents" / "skills", workspace / "reviews")
               for target in root.rglob("*.md") if target.is_file()]
    targets.extend((workspace / ".codex" / "agents").glob("*.toml"))
    for part in list(parts):
        for token in shlex.split(part):
            if any(char in token for char in "*?["):
                parts.extend(str(target).lower() for target in targets if any(
                    fnmatch.fnmatchcase(candidate.lower(), token.removeprefix("./"))
                    for candidate in (str(target), str(target.relative_to(workspace)))
                ))
    # Observe content exposure, not shell syntax: loops and Git patches can
    # display files without putting their literal paths in a reader command.
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(event, dict):
            continue
        payload = event.get("payload", {})
        item = event.get("item")
        if isinstance(payload, dict) and payload.get("type") == "item_completed":
            item = payload.get("item")
        if isinstance(payload, dict) and payload.get("type") == "exec_command_end":
            item = payload
        if not isinstance(item, dict) or item.get("type") not in {"command_execution", "CommandExecution", "exec_command_end"}:
            continue
        output = str(item.get("aggregated_output", item.get("output", ""))).lower()
        unpatched = "\n".join(row[1:] if row.startswith(("+", "-", " ")) else row for row in output.splitlines())
        for target in targets:
            content = target.read_text(encoding="utf-8", errors="replace").strip().lower()
            if content and (content in output or content in unpatched):
                parts.append(str(target).lower())
    return parts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--trace", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()
    text = "\n".join(read_commands(args.trace, args.workspace))
    metrics_path = args.run.parent / "worker" / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.is_file() else {}
    spawned = int(metrics.get("subagent_spawn_count", -1))
    reports = [path for path in (args.workspace / "reviews").rglob("*.md") if path.stat().st_size]
    child_skills = (
        "code-quality-review/skill.md", "spec-contract-review/skill.md",
        "security-boundary-review/skill.md", "verification-review/skill.md",
    )
    routes = all(path in text for path in ("default.md", "review-axes.md", "review-report.md"))
    children = all(path in text for path in child_skills)
    boundary = all(path not in text for path in ("subagents.md", "aggregator.md", ".codex/agents/"))
    source_changes = [path for path in changed_paths(args.run.parent) if not path.startswith("reviews/")]
    checks = [
        {"id": "reads-default-and-shared-contracts", "pass": routes, "points": 15 if routes else 0, "notes": "Read DEFAULT.md, review-axes.md and review-report.md."},
        {"id": "main-reads-all-four-skills", "pass": children, "points": 30 if children else 0, "notes": "Main reads every roster skill."},
        {"id": "does-not-read-delegated-files", "pass": boundary, "points": 20 if boundary else 0, "notes": "Delegated workflow files must not be read."},
        {"id": "no-spawn", "pass": spawned == 0, "points": 15 if spawned == 0 else 0, "notes": f"spawn_count={spawned}"},
        {"id": "one-canonical-report", "pass": len(reports) == 1, "points": 15 if len(reports) == 1 else 0, "notes": f"nonempty Markdown reports={len(reports)}"},
        {
            "id": "fixture-source-preserved",
            "pass": not source_changes,
            "points": 5 if not source_changes else 0,
            "notes": "Only review artifacts may be changed.",
        },
    ]
    score = sum(check["points"] for check in checks)
    if not (routes and children and boundary and spawned == 0 and len(reports) == 1 and not source_changes):
        score = min(score, 69)
    print(json.dumps({"overall_pass": score >= 70, "score": score, "checks": checks, "limitations": [
        "Shell read matching is not exhaustive; semantic judges must assess indirect/wildcard reads, sequential application and substantive axis coverage."
    ]}))


if __name__ == "__main__":
    main()
