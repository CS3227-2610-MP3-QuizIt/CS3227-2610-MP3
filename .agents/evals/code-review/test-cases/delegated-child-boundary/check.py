#!/usr/bin/env python3
"""Deterministic routing checks for delegated code review."""

from __future__ import annotations

import argparse
import fnmatch
import json
import re
import shlex
from pathlib import Path


CHILD_SKILLS = (
    "code-quality-review/skill.md",
    "spec-contract-review/skill.md",
    "security-boundary-review/skill.md",
    "verification-review/skill.md",
)
PROFILES = ("code_quality_reviewer", "spec_contract_reviewer",
            "security_boundary_reviewer", "verification_reviewer")


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


def rollout_for(run_dir: Path, thread_id: str) -> Path | None:
    matches = sorted((run_dir / "worker" / "subagents").glob(f"*{thread_id}*.jsonl"))
    return matches[0] if matches else None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--trace", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()

    main_commands = read_commands(args.trace, args.workspace)
    main_text = "\n".join(main_commands)
    metrics_path = args.run.parent / "worker" / "metrics.json"
    metrics = json.loads(metrics_path.read_text()) if metrics_path.is_file() else {}
    subagents = [
        child for child in metrics.get("subagents", [])
        if isinstance(child, dict) and isinstance(child.get("thread_id"), str)
    ]
    waits = int(metrics.get("subagent_wait_count", 0) or 0)
    reports = [path for path in (args.workspace / "reviews").rglob("*.md") if path.stat().st_size]
    specialist_ids = {
        prefix: [
            child["thread_id"] for child in subagents
            if child.get("agent_role") == profile
        ]
        for prefix, profile in zip(("CQ", "SC", "SB", "VR"), PROFILES)
    }
    aggregator_ids = [
        child["thread_id"] for child in subagents
        if child.get("agent_role") == "review_aggregator"
    ]

    checks = []
    def add(identifier: str, passed: bool, points: int, notes: str) -> None:
        checks.append({"id": identifier, "pass": passed, "points": points if passed else 0, "notes": notes})

    route_ok = "subagents.md" in main_text and "default.md" not in main_text
    roster_ok = "review-axes.md" in main_text
    add("main-routes-to-subagents", route_ok and roster_ok, 15, "Main must read SUBAGENTS.md and the shared roster, not DEFAULT.md.")
    forbidden = [path for path in CHILD_SKILLS if path in main_text]
    forbidden.extend(path for path in ("aggregator.md", ".codex/agents/", "reviews/") if path in main_text)
    # Detect explicit full-history forks in captured spawn requests. Role
    # selection comes from child metadata, not a name mentioned in a prompt.
    forked = False
    for line in args.trace.read_text(encoding="utf-8").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        payload = event.get("payload", {}) if isinstance(event, dict) else {}
        if isinstance(payload, dict) and payload.get("type") in {"function_call", "custom_tool_call"}:
            code = str(payload.get("arguments", payload.get("input", "")))
            if re.search(r"[\"']?fork_context[\"']?\s*:\s*true\b", code):
                forked = True
    if forked:
        forbidden.append("fork_context:true")
    add("main-keeps-context-boundary", not forbidden, 25, "Forbidden main content reads: " + ", ".join(forbidden))
    all_specialists = [thread_id for ids in specialist_ids.values() for thread_id in ids]
    specialists_ok = (
        all(len(ids) == 1 for ids in specialist_ids.values())
        and len(set(all_specialists)) == 4
        and len(subagents) == 5
    )
    child_reads = all(
        len(ids) == 1 and (rollout := rollout_for(args.run.parent, ids[0])) is not None
        and skill in "\n".join(read_commands(rollout, args.workspace))
        for ids, skill in zip(specialist_ids.values(), CHILD_SKILLS)
    )
    add("four-specialists-read-skills", specialists_ok and child_reads, 20, f"specialist_ids={specialist_ids}; assigned skill reads={child_reads}")
    add("waits-for-children", waits >= 1, 10, f"wait_count={waits}")
    aggregator_rollouts = [
        rollout_for(args.run.parent, thread_id) for thread_id in aggregator_ids
    ]
    aggregator_rollouts = [path for path in aggregator_rollouts if path is not None]
    aggregator_reads = any(
        "aggregator.md" in "\n".join(read_commands(path, args.workspace)) for path in aggregator_rollouts
    )
    aggregator_text = "\n".join(part for path in aggregator_rollouts for part in read_commands(path, args.workspace))
    aggregator_starts_correctly = all(
        (reads := read_commands(path, args.workspace)) and "aggregator.md" in reads[0]
        and "code-review/skill.md" not in reads[0]
        for path in aggregator_rollouts
    )
    aggregator_ok = (
        len(aggregator_ids) == 1 and aggregator_reads and aggregator_starts_correctly
        and "review-axes.md" in aggregator_text and "review-report.md" in aggregator_text
        and not any(skill in aggregator_text for skill in CHILD_SKILLS)
    )
    add("aggregator-reads-own-instructions", aggregator_ok, 15, f"aggregator_ids={aggregator_ids}, rollouts={len(aggregator_rollouts)}, starts with AGGREGATOR.md={aggregator_starts_correctly}")
    add("canonical-report", bool(reports), 10, f"reports={len(reports)}")
    changed = changed_paths(args.run.parent)
    source_changes = sorted(path for path in changed if not path.startswith("reviews/"))
    add("source-preserved", not source_changes, 5, f"non-review changes={source_changes}")

    score = sum(check["points"] for check in checks)
    if not (route_ok and roster_ok and not forbidden and specialists_ok and child_reads
            and waits >= 1 and aggregator_ok and reports and not source_changes):
        score = min(score, 69)
    print(json.dumps({"overall_pass": score >= 70, "score": score, "checks": checks, "limitations": [
        "Shell read matching is not exhaustive; semantic judges must assess indirect/wildcard reads, role scope, artifact completeness and execution ordering."
    ]}))


if __name__ == "__main__":
    main()
