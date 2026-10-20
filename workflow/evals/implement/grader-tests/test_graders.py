"""Model-free receipt/artifact oracle calibration; no model runs."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

EVALS = Path(__file__).resolve().parents[2]
CASES = EVALS / "implement/test-cases"
sys.path.insert(0, str(EVALS))
from _lib.grading import validate_grade

SCENARIOS = {"delegated-ready-task": "happy", "default-ready-task": "happy",
             "review-correction-handoff": "correction", "correction-budget-exhausted": "exhausted",
             "implementation-blocked": "blocked", "planning-awaits-approval": "planning",
             "warn-awaits-acceptance": "warn"}


class OuterOracleTests(unittest.TestCase):
    def prepare(self, name):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        ws = root / "workspace"
        shutil.copytree(CASES / name / "fixture", ws)
        self.git(ws, "init", "-q")
        self.git(ws, "add", "-A")
        self.git(ws, "-c", "user.name=Oracle Calibration", "-c", "user.email=oracle@example.invalid",
                 "-c", "commit.gpgsign=false", "commit", "--no-verify", "-qm", "fixture")
        run = root / "run.json"
        run.write_text(json.dumps({"workspace_base_revision": self.git(ws, "rev-parse", "HEAD").strip()}))
        spec = importlib.util.spec_from_file_location("checker", CASES / name / "check.py")
        checker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(checker)
        return dict(name=name, root=root, ws=ws, run=run, trace=root / "trace.jsonl", checker=checker, n=0)

    def git(self, ws, *args):
        return subprocess.check_output(["git", "-C", str(ws), *args], text=True, stderr=subprocess.PIPE)

    def stage(self, ctx, stage, previous=None, review=None):
        ctx["n"] += 1
        output = {"implement": f"workflow/implementations/pass-{ctx['n']}.md",
                  "review": "workflow/reviews/review.md",
                  "commit": "workflow/proposals/commit.md", "plan": "workflow/proposals/task.md"}[stage]
        command = [sys.executable, "scripts/stages.py", stage, "--task",
                   "workflow/tasks/quiz-search.md", "--output", output]
        if review:
            command += ["--review", review["report"]]
        if stage == "review":
            command += ["--target", previous["target"], "--evidence", previous["handoff"]]
        result = subprocess.run(command, cwd=ctx["ws"], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def complete(self, name):
        ctx = self.prepare(name)
        scenario = SCENARIOS[name]
        if scenario == "planning":
            self.stage(ctx, "plan")
        else:
            implementation = self.stage(ctx, "implement")
            if scenario != "blocked":
                review = self.stage(ctx, "review", previous=implementation)
                for _ in range(2 if scenario == "exhausted" else 1 if scenario == "correction" else 0):
                    implementation = self.stage(ctx, "implement", review=review)
                    review = self.stage(ctx, "review", previous=implementation)
                if scenario in ("happy", "correction"):
                    self.stage(ctx, "commit")
        return ctx

    def assess(self, ctx):
        grade = ctx["checker"].assess(ctx["ws"], ctx["trace"], ctx["run"])
        valid, errors = validate_grade(grade)
        self.assertTrue(valid, errors)
        return grade

    def test_valid_receipts_for_all_scenarios(self):
        for name in SCENARIOS:
            with self.subTest(name=name):
                self.assertEqual(self.assess(self.complete(name))["score"], 100)

    def test_missing_stage_and_stale_target_rejected(self):
        for failure in ("stage", "target", "task", "report"):
            with self.subTest(failure=failure):
                ctx = self.complete("review-correction-handoff")
                path = ctx["ws"] / "workflow/double-events.json"
                events = json.loads(path.read_text())
                if failure == "stage":
                    events.pop()
                elif failure == "target":
                    events[3]["target"] = events[0]["target"]
                elif failure == "task":
                    events[0]["task"] = "workflow/tasks/queued-task.md"
                else:
                    events[2]["review"] = "workflow/reviews/wrong.md"
                path.write_text(json.dumps(events))
                self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_missing_empty_and_escaping_artifacts_rejected(self):
        for failure in ("missing", "empty", "escape"):
            with self.subTest(failure=failure):
                ctx = self.complete("delegated-ready-task")
                artifact = ctx["ws"] / "workflow/proposals/commit.md"
                if failure == "missing":
                    artifact.unlink()
                elif failure == "empty":
                    artifact.write_text("")
                else:
                    outside = ctx["root"] / "outside.md"
                    outside.write_text("unscoped artifact")
                    artifact.unlink()
                    artifact.symlink_to(outside)
                self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_protected_fixture_and_git_state_rejected(self):
        for failure in ("queued", "control", "index", "head"):
            with self.subTest(failure=failure):
                ctx = self.complete("delegated-ready-task")
                if failure in ("queued", "control"):
                    relative = "workflow/tasks/queued-task.md" if failure == "queued" else "scripts/scenario.json"
                    (ctx["ws"] / relative).write_text("tampered")
                else:
                    self.git(ctx["ws"], "add", "src/selected.txt")
                    if failure == "head":
                        self.git(ctx["ws"], "-c", "user.name=Oracle Calibration", "-c", "user.email=oracle@example.invalid",
                                 "-c", "commit.gpgsign=false", "commit", "--no-verify", "-qm", "unauthorized")
                self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_adapter_itself_rejects_stale_target(self):
        ctx = self.prepare("review-correction-handoff")
        implementation = self.stage(ctx, "implement")
        result = subprocess.run([sys.executable, "scripts/stages.py", "review", "--task",
            "workflow/tasks/quiz-search.md", "--target", "stale", "--evidence", implementation["handoff"],
            "--output", "workflow/reviews/review.md"], cwd=ctx["ws"], capture_output=True)
        self.assertNotEqual(result.returncode, 0)

    def test_trace_interpretation_is_left_to_semantic_grading(self):
        ctx = self.complete("delegated-ready-task")
        # A deterministic 100 only establishes receipts/artifacts/scope. Even a
        # trace containing violations cannot establish an overall semantic pass.
        ctx["trace"].write_text(json.dumps({"type": "item.completed", "item": {
            "type": "command_execution", "command": "cat .agents/skills/implement/DEFAULT.md",
            "exit_code": 0}}) + "\n")
        self.assertEqual(self.assess(ctx)["score"], 100)
        ctx["trace"].unlink()
        self.assertEqual(self.assess(ctx)["score"], 100)

    def test_cli_prints_valid_grade(self):
        ctx = self.complete("delegated-ready-task")
        result = subprocess.run([sys.executable, str(CASES / ctx["name"] / "check.py"),
            "--workspace", str(ctx["ws"]), "--trace", str(ctx["trace"]), "--run", str(ctx["run"])],
            capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        valid, errors = validate_grade(json.loads(result.stdout))
        self.assertTrue(valid, errors)


if __name__ == "__main__":
    unittest.main()
