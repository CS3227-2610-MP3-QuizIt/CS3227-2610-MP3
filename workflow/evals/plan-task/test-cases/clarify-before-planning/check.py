#!/usr/bin/env python3
"""Mechanical output checks only; interview and planning quality are semantic."""
import argparse
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote

CASE = Path(__file__).parent.name
TASKS = "workflow/tasks/"
APPROVED = CASE == "implicit-small-change"


def git(workspace, *args):
    return subprocess.check_output(
        ["git", "-C", str(workspace), *args], stderr=subprocess.PIPE
    ).decode()


def normal(text):
    return re.sub(r"\s+", " ", re.sub(r"[*_\x60]", "", text).replace("&", "and")).strip().lower()


def visible(text):
    return re.sub(r"(?ms)^[ \t]*(\x60{3,}|~{3,}).*?^[ \t]*\1[ \t]*$", "", text)


def field(text, name):
    for line in visible(text).splitlines():
        clean = re.sub(r"[*\x60]", "", line).strip().removeprefix("- ")
        if ":" in clean and normal(clean.split(":", 1)[0]) == name:
            return clean.split(":", 1)[1].strip()
    return ""


def sections(text):
    headings = list(re.finditer(r"(?m)^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$", visible(text)))
    bodies = {}
    for i, heading in enumerate(headings):
        end = next((h.start() for h in headings[i + 1:] if len(h[1]) <= len(heading[1])), len(text))
        bodies[normal(heading[2])] = visible(text)[heading.end():end].strip()
    return bodies


def cells(line):
    return [cell.strip() for cell in re.split(r"(?<!\\)\|", line.strip().strip("|"))]


def criteria(text):
    lines = sections(text).get("acceptance and planned verification", "").splitlines()
    aliases = (
        {"id", "criterion id"}, {"observable outcome", "outcome"},
        {"source", "sources", "requirement"},
        {"test/manual scenario and working directory", "planned verification",
         "verification", "check and working directory"},
    )
    for i, line in enumerate(lines[:-1]):
        header = [normal(c) for c in cells(line)]
        indices = [next((j for j, c in enumerate(header) if c in names), None) for names in aliases]
        if None in indices or not re.fullmatch(r"[\s|:\-]+", lines[i + 1]):
            continue
        rows = []
        for row in lines[i + 2:]:
            if not row.strip() or "|" not in row:
                break
            values = cells(row)
            if len(values) < len(header):
                return []
            chosen = [values[j] for j in indices]
            if any(not c or re.fullmatch(r"<[^>]+>|TBD|\.\.\.", c, re.I) for c in chosen):
                return []
            rows.append(chosen)
        return rows
    return []


def brief_valid(text):
    bodies = sections(text)
    rows = criteria(text)
    return bool(
        re.search(r"(?m)^#\s+\S", visible(text))
        and re.match(r"^(DRAFT|READY|BLOCKED)\b", field(text, "status"), re.I)
        and all(bodies.get(h) for h in
                ("outcome and scope", "acceptance and planned verification", "implementer handoff"))
        and rows and len({normal(row[0]) for row in rows}) == len(rows)
    )


def bad_links(workspace, path, text):
    broken = []
    for raw in re.findall(r"\[[^\]]*\]\(([^)]+)\)", visible(text)):
        link = raw[1:].split(">", 1)[0] if raw.startswith("<") else raw.split(maxsplit=1)[0]
        if re.match(r"[a-z][a-z0-9+.-]*:", link, re.I):
            continue
        target = (path.parent / unquote(link.split("#", 1)[0])).resolve() if not link.startswith("#") else path
        if not target.is_relative_to(workspace) or not target.is_file():
            broken.append(f"{path.name}: {link}")
    return broken


def assess(workspace, run_path):
    workspace = workspace.resolve()
    base = json.loads(run_path.read_text())["workspace_base_revision"]
    tracked = set(filter(None, git(workspace, "diff", "--name-only", "-z", base, "--").split("\0")))
    new = set(filter(None, git(workspace, "ls-files", "--others", "--exclude-standard", "-z").split("\0")))
    changed = tracked | new
    paths = sorted(workspace / p for p in changed if p.startswith(TASKS) and p.endswith(".md"))
    outside = sorted(tracked | {p for p in new if not (p.startswith(TASKS) and p.endswith(".md"))})
    unsafe = [str(p.relative_to(workspace)) for p in paths
              if p.is_symlink() or not p.resolve().is_relative_to(workspace) or not p.is_file()]
    texts = {p: p.read_text() for p in paths if str(p.relative_to(workspace)) not in unsafe}
    unchanged_head = git(workspace, "rev-parse", "HEAD").strip() == base
    matches = [re.match(r"^(DRAFT|READY|BLOCKED)\b", field(text, "status"), re.I) for text in texts.values()]
    statuses = [match[1].upper() if match else "" for match in matches]
    artifact_ok = (len(texts) == 1 and statuses == ["READY"]) if APPROVED else (
        not any(status == "READY" for status in statuses)
    )
    formatted = all(brief_valid(text) for text in texts.values())
    metadata = all(field(text, key) for text in texts.values()
                   for key in ("depends on", "sources", "baseline"))
    links = [issue for path, text in texts.items() for issue in bad_links(workspace, path, text)]
    checks = []

    def add(name, ok, weight, notes):
        checks.append({"id": name, "pass": bool(ok), "verdict": "pass" if ok else "fail",
                       "points": weight if ok else 0, "notes": notes})

    add("planning-only-writes", not outside and not unsafe, 30,
        f"Out-of-scope paths={outside}; unsafe task paths={unsafe}")
    add("no-worker-commits", unchanged_head, 10, "Worker HEAD must remain at the prepared baseline.")
    add("artifact-and-readiness", artifact_ok, 30,
        f"Approved breakdown={APPROVED}; changed briefs={len(texts)}; statuses={statuses}. "
        "Unapproved cases permit a response only or DRAFT/BLOCKED, not READY.")
    add("brief-format", formatted, 20,
        "Written briefs need a title, valid status, three populated contract sections "
        "and acceptance rows with unique IDs and four populated columns.")
    add("brief-metadata", metadata, 5, "Written briefs include dependencies, sources and baseline context.")
    add("local-links", not links, 5, f"Missing or escaping local file links={links}")
    score = sum(check["points"] for check in checks)
    if outside or unsafe or not unchanged_head:
        score = 0
    elif not artifact_ok or not formatted:
        score = min(score, 69)
    return {"overall_pass": score >= 70, "verdict": "pass" if score >= 70 else "partial" if score else "fail",
            "score": score, "checks": checks, "limitations": [
                "A mechanical pass is not a planning-quality pass. Semantic judges assess actual "
                "questions, approval claims in responses, factual grounding, scope, criterion meaning, "
                "skill/template use and honest verification from the response and full trace.",
                "Git checks cover final tracked/nonignored changes and HEAD, not every transient write, "
                "ignored file or external side effect. Links check file targets, not remote URLs or anchors. "
                "Metadata values and baseline truth require semantic review; no commit-hash spelling gate.",
                "This single-turn case does not evaluate adaptive interviews or multi-turn revision."
            ]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--trace", type=Path, required=True)
    parser.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = assess(args.workspace, args.run)
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        result = {"overall_pass": False, "verdict": "fail", "score": 0,
                  "checks": [{"id": "grader-evidence", "pass": False, "verdict": "fail",
                              "points": 0, "notes": str(error)}],
                  "limitations": ["Required workspace/Git evidence unavailable; no success inferred."]}
    print(json.dumps(result))


if __name__ == "__main__":
    main()
