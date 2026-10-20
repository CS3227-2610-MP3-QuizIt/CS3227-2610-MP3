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
    blocked = case.name == "unresolved-attempt-policy"
    frontend = case.name == "frontend-quiz-search"
    base = json.loads(run_path.read_text())["workspace_base_revision"]
    paths, unchanged_git = git_state(workspace, base)
    prefix = "frontend/" if frontend else "backend/"
    scope = unchanged_git and all(
        p.startswith("workflow/implementations/") or (not blocked and (
            p.startswith(prefix) or (frontend and p == "specs/product.md"))) for p in paths)
    for original in (case / "fixture").rglob("*"):
        if not original.is_file():
            continue
        relative = str(original.relative_to(case / "fixture"))
        editable = relative in ("frontend/quiz-list.mjs", "frontend/QuizList.tsx",
                                "backend/answers.py", "backend/hints.py")
        if not blocked and (editable or (frontend and relative == "specs/product.md")):
            continue
        current = workspace / relative
        scope &= current.is_file() and not current.is_symlink() and current.read_bytes() == original.read_bytes()

    if blocked:
        correct, detail = True, "No implementation authorized; scope check enforces unchanged product inputs."
    else:
        command = ["node", str(case / "acceptance.mjs"), str(workspace)] if frontend else [
            sys.executable, "-B", str(case / "acceptance.py"), str(workspace)]
        result = subprocess.run(command, cwd=workspace, capture_output=True, text=True, timeout=30)
        correct, detail = result.returncode == 0, (result.stdout + result.stderr)[-3000:]
    records = [p for p in (workspace / "workflow/implementations").glob("*.md")
               if p.is_file() and not p.is_symlink() and p.read_text().strip()]
    checks = []
    check(checks, "specified-behavior", correct, 60, detail or "Private acceptance passed.")
    check(checks, "scope-and-git-state", scope, 25, "Protected fixture/regression files, allowed changes, HEAD and index checked.")
    check(checks, "handoff-present", bool(records), 15, "Nonempty implementation record; content is assessed semantically.")
    return grade(checks, [
        "Private acceptance is grader-run verification, not proof the worker ran its own checks.",
        "Semantic judges assess tests/TDD, final-code verification, SRP/DRY, guidance use, "
        "scope interpretation, command attempts and factual handoffs.",
        "Frontend oracle tests view-model behavior, not browser rendering; blocked-case policy reasoning is semantic."])


if __name__ == "__main__":
    main()
