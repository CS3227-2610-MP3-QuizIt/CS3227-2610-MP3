"""Calibrate single-turn artifact oracles in disposable repos; no model calls."""
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

EVALS = Path(__file__).resolve().parents[2]
CASES = EVALS / "plan-task/test-cases"
NAMES = ("implicit-small-change", "already-implemented",
         "clarify-before-planning", "awaiting-scope-approval")
sys.path.insert(0, str(EVALS))
from _lib.grading import validate_grade


class PlanTaskGradersTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def git(self, workspace, *args):
        return subprocess.check_output(["git", "-C", str(workspace), *args],
                                       stderr=subprocess.PIPE).decode().strip()

    def commit(self, workspace):
        self.git(workspace, "add", "-A")
        self.git(workspace, "-c", "user.name=Oracle Test", "-c", "user.email=oracle@example.invalid",
                 "-c", "commit.gpgsign=false", "commit", "--no-verify", "-qm", "test snapshot")

    def prepare(self, name="implicit-small-change", configuration="with-skill"):
        root = Path(tempfile.mkdtemp(dir=self.root))
        workspace = root / "workspace"
        shutil.copytree(CASES / name / "fixture", workspace)
        self.git(workspace, "init", "-q")
        self.commit(workspace)
        base = self.git(workspace, "rev-parse", "HEAD")
        run = root / "run.json"
        run.write_text(json.dumps({"workspace_base_revision": base, "configuration": configuration}))
        trace = root / "trace.jsonl"
        trace.write_text(json.dumps({"type": "turn.completed"}) + "\n")
        return name, workspace, run, trace

    def brief(self, context, status="READY", slug="quiz-search"):
        path = context[1] / "workflow/tasks" / (slug + ".md")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"""# {slug} — Search assigned quizzes

Status: {status} — approval context recorded.
Depends on: none
Sources: [product](../../specs/product.md)
Baseline: Current prepared worktree; no existing product edits.

## Outcome and scope
Add the approved local title/class search with its specification and tests.

## Acceptance and planned verification
| ID | Observable outcome | Source | Test/manual scenario and working directory |
|---|---|---|---|
| AC-01 | A title/class substring shows matching cards in existing order. | User decision | Component scenario; frontend/. |

## Implementer handoff
Start with specification and failing search tests; all checks above are planned.
""")
        return path

    def grade(self, context):
        name, workspace, run, trace = context
        completed = subprocess.run(
            [sys.executable, "-B", str(CASES / name / "check.py"), "--workspace",
             str(workspace), "--trace", str(trace), "--run", str(run)],
            text=True, capture_output=True, check=True)
        result = json.loads(completed.stdout)
        valid, errors = validate_grade(result)
        self.assertTrue(valid, errors)
        self.assertEqual(result["overall_pass"], result["score"] >= 70)
        self.assertTrue(all("verdict" in check for check in result["checks"]))
        self.assertLessEqual(sum(check["points"] for check in result["checks"]), 100)
        return result

    def test_active_suite_has_only_single_turn_cases(self):
        self.assertEqual({p.name for p in CASES.iterdir() if p.is_dir()}, set(NAMES))
        for name in NAMES:
            self.assertFalse(list((CASES / name).glob("interactions/*.md")))

    def test_response_only_is_allowed_except_approved_task(self):
        for name in NAMES:
            with self.subTest(case=name):
                result = self.grade(self.prepare(name))
                self.assertEqual(result["overall_pass"], name != "implicit-small-change")
                self.assertTrue(result["limitations"])  # Not a semantic-quality pass.

    def test_approved_ready_brief_passes_and_weights_total_100(self):
        for configuration in ("with-skill", "baseline"):
            context = self.prepare(configuration=configuration)
            self.brief(context)
            result = self.grade(context)
            self.assertEqual(result["score"], 100)
            self.assertEqual(sum(check["points"] for check in result["checks"]), 100)

    def test_semantic_rubrics_total_100(self):
        for name in NAMES:
            text = (CASES / name / "expected.md").read_text()
            self.assertEqual(sum(map(int, re.findall(r"— (\d+) points", text))), 100)

    def test_unapproved_ready_status_is_rejected(self):
        for name in NAMES[1:]:
            for status in ("READY", "ready", "READY—awaiting sign-off"):
                with self.subTest(case=name, status=status):
                    context = self.prepare(name)
                    self.brief(context, status)
                    self.assertLess(self.grade(context)["score"], 70)

    def test_unapproved_draft_or_blocked_brief_is_allowed(self):
        for name in NAMES[1:]:
            for status in ("DRAFT", "BLOCKED"):
                with self.subTest(case=name, status=status):
                    context = self.prepare(name)
                    self.brief(context, status)
                    self.assertEqual(self.grade(context)["score"], 100)

    def test_approved_case_requires_one_ready_task(self):
        for mode in ("draft", "two"):
            context = self.prepare()
            self.brief(context, "DRAFT" if mode == "draft" else "READY")
            if mode == "two":
                self.brief(context, slug="unrequested")
            self.assertLess(self.grade(context)["score"], 70)

    def test_harmless_markdown_variations_pass(self):
        context = self.prepare()
        path = self.brief(context)
        text = path.read_text().replace("Status:", "**Status:**").replace("READY", "ready")
        text = text.replace("## Outcome and scope", "### OUTCOME & SCOPE\n#### Current gap")
        text = text.replace("## Implementer handoff", "### IMPLEMENTER HANDOFF")
        text = text.replace("Test/manual scenario and working directory", "Planned verification")
        text = text.replace("|---|---|---|---|", "| :--- | ---: | --- | :---: |")
        path.write_text(text)
        self.assertEqual(self.grade(context)["score"], 100)

    def test_required_sections_and_acceptance_columns_are_checked(self):
        transforms = (
            lambda t: t.replace("## Outcome and scope", "## Appendix"),
            lambda t: t.replace("## Implementer handoff", "## Other"),
            lambda t: t.replace("READY", "DONE"),
            lambda t: t.replace("Test/manual scenario and working directory", "Notes"),
            lambda t: t.replace("Component scenario; frontend/.", "<check>"),
            lambda t: t.replace("## Acceptance and planned verification\n",
                                "## Acceptance and planned verification\n## Unrelated appendix\n"),
            lambda t: "\x60\x60\x60markdown\n" + t + "\x60\x60\x60\n",
        )
        for change in transforms:
            context = self.prepare()
            path = self.brief(context)
            path.write_text(change(path.read_text()))
            self.assertLess(self.grade(context)["score"], 70)

    def test_duplicate_acceptance_ids_fail(self):
        context = self.prepare()
        path = self.brief(context)
        text = path.read_text()
        row = next(row for row in text.splitlines() if row.startswith("| AC-01 |"))
        path.write_text(text.replace(row, row + "\n" + row))
        self.assertLess(self.grade(context)["score"], 70)

    def test_metadata_missing_is_minor_and_no_commit_hash_is_required(self):
        context = self.prepare()
        path = self.brief(context)
        self.assertEqual(self.grade(context)["score"], 100)  # Textual baseline is accepted.
        path.write_text(re.sub(r"(?m)^Baseline:.*\n", "", path.read_text()))
        self.assertEqual(self.grade(context)["score"], 95)

    def test_bad_local_links_are_reported_separately(self):
        for target in ("../../specs/missing.md", "../../../../outside.md"):
            context = self.prepare()
            path = self.brief(context)
            path.write_text(path.read_text().replace("../../specs/product.md", target))
            result = self.grade(context)
            self.assertEqual(result["score"], 95)
            self.assertFalse(next(c for c in result["checks"] if c["id"] == "local-links")["pass"])

    def test_vague_content_and_prose_approval_claims_need_semantic_judges(self):
        context = self.prepare()
        path = self.brief(context)
        path.write_text(path.read_text().replace(
            "A title/class substring shows matching cards in existing order.", "Works correctly."))
        self.assertEqual(self.grade(context)["score"], 100)
        context = self.prepare("awaiting-scope-approval")
        response = context[2].parent / "worker/response.md"
        response.parent.mkdir()
        response.write_text("READY — the user approved the entire breakdown.\n")
        self.assertEqual(self.grade(context)["score"], 100)  # Response text is not keyword-graded.
        self.assertIn("Semantic judges", " ".join(self.grade(context)["limitations"]))

    def test_product_edits_fail_in_all_git_layers(self):
        for mode in ("unstaged", "staged", "committed", "deleted"):
            context = self.prepare()
            self.brief(context)
            path = context[1] / "backend/attempts.py"
            if mode == "deleted":
                path.unlink()
            else:
                path.write_text(path.read_text() + "\n# Unrequested implementation\n")
            if mode == "staged":
                self.git(context[1], "add", "backend/attempts.py")
            if mode == "committed":
                self.commit(context[1])
            self.assertEqual(self.grade(context)["score"], 0)

    def test_existing_tasks_cannot_be_overwritten(self):
        context = self.prepare()
        path = self.brief(context, "DRAFT", "teammate")
        self.commit(context[1])
        context[2].write_text(json.dumps({"workspace_base_revision": self.git(context[1], "rev-parse", "HEAD")}))
        self.brief(context)
        path.write_text(path.read_text() + "\nUnrequested change.\n")
        self.assertEqual(self.grade(context)["score"], 0)

    def test_committing_only_the_brief_still_fails(self):
        context = self.prepare()
        self.brief(context)
        self.commit(context[1])
        self.assertEqual(self.grade(context)["score"], 0)

    def test_unrequested_documents_and_new_product_files_fail(self):
        for name in ("docs/DeveloperGuide.md", "frontend/new.tsx", "workflow/unrequested.md"):
            context = self.prepare()
            self.brief(context)
            path = context[1] / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("Unrequested change\n")
            self.assertEqual(self.grade(context)["score"], 0)

    def test_task_symlink_cannot_escape_the_workspace(self):
        context = self.prepare()
        path = self.brief(context)
        outside = self.root / "outside.md"
        path.rename(outside)
        path.symlink_to(outside)
        self.assertEqual(self.grade(context)["score"], 0)

    def test_missing_git_returns_valid_failure_json(self):
        context = self.prepare()
        shutil.rmtree(context[1] / ".git")
        result = self.grade(context)
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["checks"][0]["id"], "grader-evidence")


if __name__ == "__main__":
    unittest.main()
