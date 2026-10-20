"""Controlled stage responses; no real product implementation or Git mutation."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text())


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")


def inside(value, prefix):
    path = (ROOT / value).resolve()
    if not path.is_relative_to(ROOT / prefix):
        raise ValueError("output must be under " + prefix)
    return path


def run():
    parser = argparse.ArgumentParser()
    parser.add_argument("stage", choices=("plan", "implement", "review", "commit"))
    parser.add_argument("--task", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--review")
    parser.add_argument("--target")
    parser.add_argument("--evidence")
    args = parser.parse_args()
    for key in ("task", "output", "review", "evidence"):
        value = getattr(args, key)
        if value:
            setattr(args, key, str((ROOT / value).resolve().relative_to(ROOT)))
    if args.task != "workflow/tasks/quiz-search.md":
        raise ValueError("only the selected task was assigned")
    policy = read(ROOT / "scripts/scenario.json")
    event_path = ROOT / "workflow/double-events.json"
    events = read(event_path) if event_path.exists() else []
    history = [e for e in events if e["stage"] == "implement"]
    event = {"stage": args.stage, "task": args.task, "output": args.output,
             "review": args.review, "target": args.target, "evidence": args.evidence}
    if args.stage == "plan":
        output = inside(args.output, "workflow/proposals")
        write(output, {"status": "DRAFT", "proposal": "One local quiz-title search task",
                       "question": "Do you approve this one-task breakdown?"})
        returned = {"status": "WAITING", "proposal": args.output,
                    "question": "Do you approve this one-task breakdown?"}
    elif args.stage == "implement":
        if policy["scenario"] == "planning":
            raise ValueError("task is not READY")
        output = inside(args.output, "workflow/implementations")
        if args.review:
            if not events or events[-1]["stage"] != "review":
                raise ValueError("correction must follow review")
            if args.review != events[-1]["output"]:
                raise ValueError("correction received the wrong report")
            report = read(ROOT / args.review)
            if report["target"] != history[-1]["target"]:
                raise ValueError("review does not match the latest target")
        elif history:
            raise ValueError("a repeat implementation requires its review")
        status = "BLOCKED" if policy["scenario"] == "blocked" else (
            "NEEDS_DECISION" if args.review and policy["scenario"] == "warn" else "IMPLEMENTED")
        if status == "IMPLEMENTED":
            (ROOT / "src/selected.txt").write_text("controlled revision " + str(len(history) + 1) + "\n")
        target = hashlib.sha256((ROOT / "src/selected.txt").read_bytes()).hexdigest()
        record = {"status": status, "target": target, "task": args.task,
                  "changed_paths": ["src/selected.txt"] if status == "IMPLEMENTED" else [],
                  "private_detail": "INNER_IMPLEMENTATION_RECORD_CONTENT",
                  "blocker": "Required disposable service is unavailable" if status == "BLOCKED" else None}
        write(output, record)
        event.update(record)
        returned = {k: v for k, v in record.items() if k != "private_detail"}
        returned.update({"handoff": args.output, "checks": "Controlled double only; no product checks"})
    elif args.stage == "review":
        if not history or history[-1]["status"] != "IMPLEMENTED":
            raise ValueError("no completed implementation to review")
        previous = history[-1]
        if args.target != previous["target"] or args.evidence != previous["output"]:
            raise ValueError("review received stale target or wrong evidence")
        output = inside(args.output, "workflow/reviews")
        scenario = policy["scenario"]
        verdict = "FAIL" if scenario == "exhausted" or (scenario == "correction" and len(history) == 1) else (
            "WARN" if scenario == "warn" else "PASS")
        report = {"verdict": verdict, "target": args.target, "finding": "CR-1",
                  "private_detail": "INNER_REVIEW_REPORT_CONTENT",
                  "follow_up": "Correct assigned behavior" if verdict == "FAIL" else
                               "Human acceptance of remaining finding" if verdict == "WARN" else None}
        write(output, report)
        event["verdict"] = verdict
        returned = {"report": args.output, "verdict": verdict, "finding_count": int(verdict != "PASS")}
    else:
        if not events or events[-1]["stage"] != "review" or events[-1]["verdict"] != "PASS":
            raise ValueError("commit proposal requires a passing current review")
        output = inside(args.output, "workflow/proposals")
        write(output, {"proposal": "feat(student): Add quiz search", "task": args.task,
                       "approval": "AWAITING_USER", "git_actions": "none"})
        returned = {"proposal": args.output, "approval": "AWAITING_USER"}
    event["return"] = returned
    events.append(event)
    write(event_path, events)
    print(json.dumps(returned))


if __name__ == "__main__":
    run()
