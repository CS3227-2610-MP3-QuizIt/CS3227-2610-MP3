"""Model-free calibration: synthetic traces, real disposable apps/private oracles."""
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

EVALS = Path(__file__).resolve().parents[2]
CASES = EVALS / "implement-task/test-cases"
sys.path.insert(0, str(EVALS))
from _lib.grading import validate_grade

NAMES = ("frontend-quiz-search", "backend-shared-answer-rule", "review-hint-context-fix",
         "unresolved-attempt-policy")


class InnerOracleTests(unittest.TestCase):
    def prepare(self, name):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        ws = root / "workspace"
        shutil.copytree(CASES / name / "fixture", ws)
        def git(*args):
            return subprocess.check_output(["git", "-C", str(ws), *args], text=True, stderr=subprocess.PIPE)
        git("init", "-q")
        git("add", "-A")
        git("-c", "user.name=Oracle Calibration", "-c", "user.email=oracle@example.invalid",
            "-c", "commit.gpgsign=false", "commit", "--no-verify", "-qm", "fixture")
        run = root / "run.json"
        run.write_text(json.dumps({"workspace_base_revision": git("rev-parse", "HEAD").strip(),
                                   "configuration": "with-skill"}))
        trace = root / "trace.jsonl"
        trace.touch()
        spec = importlib.util.spec_from_file_location("checker", CASES / name / "check.py")
        checker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(checker)
        return dict(name=name, ws=ws, root=root, run=run, trace=trace, checker=checker)

    def good(self, name):
        ctx = self.prepare(name)
        ws = ctx["ws"]
        if name == NAMES[0]:
            path = ws / "frontend/quiz-list.mjs"
            path.write_text(path.read_text().replace("quizCards(items)", 'quizCards(items, query = "")').replace(
                "return items.map", 'const term = query.trim().toLowerCase();\n'
                '  return items.filter(q => !term || q.title.toLowerCase().includes(term) || '
                'q.class_name.toLowerCase().includes(term)).map'))
        elif name == NAMES[1]:
            path = ws / "backend/answers.py"
            path.write_text(path.read_text().replace('"""Small attempt service; both entry points enforce the same answer contract."""',
                '"""Answer service."""\ndef valid_answer(answer):\n'
                '    return type(answer) is int and 1 <= answer <= 4\n').replace(
                    "not isinstance(answer, int)", "not valid_answer(answer)"))
        elif name == NAMES[2]:
            (ws / "backend/hints.py").write_text('def make_hint_request(question):\n'
                '    return {"question_id": question["id"], "prompt": question["prompt"]}\n')
        handoff = ws / "workflow/implementations/result.md"
        handoff.parent.mkdir(parents=True)
        handoff.write_text("Synthetic calibration handoff; not model-run evidence.\n")
        return ctx

    def assess(self, ctx):
        grade = ctx["checker"].assess(ctx["ws"], ctx["trace"], ctx["run"])
        valid, errors = validate_grade(grade)
        self.assertTrue(valid, errors)
        return grade

    def test_good_contracts_and_schema(self):
        for name in NAMES:
            with self.subTest(name=name):
                self.assertEqual(self.assess(self.good(name))["score"], 100)

    def test_unfixed_apps_rejected(self):
        for name in NAMES[:3]:
            with self.subTest(name=name):
                ctx = self.good(name)
                relative = {NAMES[0]: "frontend/quiz-list.mjs", NAMES[1]: "backend/answers.py",
                            NAMES[2]: "backend/hints.py"}[name]
                shutil.copyfile(CASES / name / "fixture" / relative, ctx["ws"] / relative)
                self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_search_contract_mutants_rejected(self):
        mutations = [('.includes(term)', '.startsWith(term)'),
                     ('q.class_name.toLowerCase().includes(term)', 'false'),
                     ('query.trim().toLowerCase()', 'query.toLowerCase()'),
                     ('return items.filter', 'items.reverse(); return items.filter'),
                     ('"Resume"', '"Start"')]
        for old, new in mutations:
            with self.subTest(mutation=old):
                ctx = self.good(NAMES[0])
                path = ctx["ws"] / "frontend/quiz-list.mjs"
                self.assertIn(old, path.read_text())
                path.write_text(path.read_text().replace(old, new))
                self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_answer_contract_mutants_rejected(self):
        mutations = [('type(answer) is int', 'isinstance(answer, int)'),
                     ('1 <= answer <= 4', '1 <= answer'),
                     ('not valid_answer(answer)', 'not isinstance(answer, int)'),
                     ('if attempt["owner"] != actor or attempt["status"] != "in_progress":', 'if False:'),
                     ('for answer in answers.values():', 'attempt["answers"] = dict(answers)\n    for answer in answers.values():')]
        for old, new in mutations:
            with self.subTest(mutation=old):
                ctx = self.good(NAMES[1])
                path = ctx["ws"] / "backend/answers.py"
                path.write_text(path.read_text().replace(old, new, 1))
                self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_hint_mutation_rejected(self):
        ctx = self.good(NAMES[2])
        path = ctx["ws"] / "backend/hints.py"
        path.write_text(path.read_text().replace('    return', '    question.pop("explanation", None)\n    return'))
        self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_protected_files_and_blocked_product_edits_rejected(self):
        for name, relative in [(NAMES[0], "frontend/tests/existing.test.mjs"),
                               (NAMES[1], "notes/teammate.md"),
                               (NAMES[3], "backend/answers.py")]:
            with self.subTest(name=name):
                ctx = self.good(name)
                path = ctx["ws"] / relative
                path.write_text(path.read_text() + "\n# tampered\n")
                self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_missing_handoff_rejected(self):
        ctx = self.good(NAMES[1])
        (ctx["ws"] / "workflow/implementations/result.md").unlink()
        self.assertFalse(self.assess(ctx)["overall_pass"])

    def test_worker_process_is_left_to_semantic_grading(self):
        ctx = self.good(NAMES[1])
        # These calibrate only functional/scope/artifact facts. Semantic judges
        # must still require real test quality, TDD and final-code verification.
        ctx["trace"].write_text("Quoted commands and filename mentions are not grading proxies.\n")
        self.assertEqual(self.assess(ctx)["score"], 100)
        ctx["trace"].unlink()
        (ctx["ws"] / "backend/tests/answer_checks.py").write_text("# Alternate test layout\n")
        self.assertEqual(self.assess(ctx)["score"], 100)

    def test_existing_regressions_still_execute(self):
        for name in NAMES[:3]:
            ctx = self.good(name)
            command = ["node", "--test", "tests/existing.test.mjs"] if name == NAMES[0] else [
                sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests"]
            result = subprocess.run(command, cwd=ctx["ws"] / ("frontend" if name == NAMES[0] else "backend"),
                                    text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_cli_grade_schema(self):
        ctx = self.good(NAMES[1])
        result = subprocess.run([sys.executable, str(CASES / NAMES[1] / "check.py"),
            "--workspace", str(ctx["ws"]), "--trace", str(ctx["trace"]), "--run", str(ctx["run"])],
            text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        valid, errors = validate_grade(json.loads(result.stdout))
        self.assertTrue(valid, errors)


if __name__ == "__main__":
    unittest.main()
