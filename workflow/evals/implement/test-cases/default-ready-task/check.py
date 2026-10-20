import argparse
import json
from pathlib import Path
import subprocess
import sys


def git_state(workspace, base):
    def git(*args):
        return subprocess.check_output(["git", "-C", str(workspace), *args], text=True).strip()
    paths = set(git("diff", "--name-only", base, "--").splitlines())
    paths.update(git("ls-files", "--others", "--exclude-standard").splitlines())
    return paths, git("rev-parse", "HEAD") == base and not git("diff", "--cached", "--name-only")


def grade(checks, limitations):
    score = sum(c["points"] for c in checks)
    if any(not c["pass"] for c in checks):
        score = min(score, 69)
    return {"overall_pass": score >= 70, "verdict": "pass" if score >= 70 else "partial",
            "score": score, "checks": checks, "limitations": limitations}


def check(checks, name, passed, weight, notes):
    checks.append({"id": name, "pass": bool(passed), "verdict": "pass" if passed else "fail",
                   "points": weight if passed else 0, "notes": notes})


def main():
    parser = argparse.ArgumentParser()
    for name in ("workspace", "trace", "run"):
        parser.add_argument("--" + name, type=Path, required=True)
    args = parser.parse_args()
    try:
        result = assess(args.workspace.resolve(), args.trace, args.run)
    except Exception as error:
        result = grade([{"id": "evidence-readable", "pass": False, "verdict": "fail",
                         "points": 0, "notes": str(error)}], ["Checker could not assess the supplied evidence."])
    print(json.dumps(result))


def assess(workspace, trace, run_path):
    workspace = workspace.resolve()
    case = Path(__file__).parent
    scenario = json.loads((case / "fixture/scripts/scenario.json").read_text())["scenario"]
    event_path = workspace / "workflow/double-events.json"
    events = json.loads(event_path.read_text()) if event_path.is_file() else []
    stages = [e.get("stage") for e in events]
    expected = {"happy": ["implement", "review", "commit"],
                "correction": ["implement", "review", "implement", "review", "commit"],
                "exhausted": ["implement", "review"] * 3, "blocked": ["implement"],
                "planning": ["plan"], "warn": ["implement", "review"]}[scenario]
    flow = stages == expected or (scenario == "warn" and stages == expected + ["implement"])
    fidelity, artifacts, latest, report = bool(events), bool(events), None, None
    for event in events:
        fidelity &= event.get("task") == "workflow/tasks/quiz-search.md"
        if event["stage"] == "implement":
            fidelity &= not latest or event.get("review") == report
            latest = event
        elif event["stage"] == "review":
            fidelity &= bool(latest and event.get("target") == latest.get("target")
                             and event.get("evidence") == latest.get("output"))
            report = event["output"]
        output = workspace / event["output"]
        artifacts &= (output.resolve().is_relative_to(workspace) and output.is_file()
                      and not output.is_symlink() and bool(output.read_text().strip()))

    base = json.loads(run_path.read_text())["workspace_base_revision"]
    paths, unchanged_git = git_state(workspace, base)
    scope = unchanged_git and all(
        p in ("src/selected.txt", "workflow/double-events.json", "logs/eval.md")
        or p.startswith(("workflow/implementations/", "workflow/reviews/", "workflow/proposals/"))
        for p in paths)
    for original in (case / "fixture").rglob("*"):
        if not original.is_file():
            continue
        relative = str(original.relative_to(case / "fixture"))
        if relative == "logs/eval.md" or (relative == "src/selected.txt" and scenario not in ("planning", "blocked")):
            continue
        current = workspace / relative
        scope &= current.is_file() and not current.is_symlink() and current.read_bytes() == original.read_bytes()

    checks = []
    check(checks, "stage-progression", flow, 35, "Receipt stages: " + repr(stages))
    check(checks, "receipt-consistency", fidelity, 25, "Selected task and current target/report/evidence references agree.")
    check(checks, "stage-artifacts", artifacts, 15, "Each receipt points to a nonempty local stage artifact.")
    check(checks, "scope-and-git-state", scope, 25, "Protected fixture files, allowed changes, HEAD and index checked.")
    return grade(checks, [
        "Receipts/artifacts do not prove who executed a stage or that execution claims are honest.",
        "Semantic judges assess actual delegation/waits, instruction use, context boundaries, handoffs, "
        "approval gates, correction handling, command attempts and reporting from traces and artifacts.",
        "Controlled doubles do not assess inner coding or specialist-review quality."])


if __name__ == "__main__":
    main()
