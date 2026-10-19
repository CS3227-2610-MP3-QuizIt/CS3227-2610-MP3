"""Model-free checks for controlled profile injection and trace evidence."""

import json
import contextlib
from dataclasses import replace
import io
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from _lib.agent_profiles import discover_profiles, inject_profiles, profile_hashes, profile_overrides
from _lib.common import HarnessError
from _lib.paths import SKILLS_ROOT
from _lib.harness import discover_cases
from _lib import harness
from _lib.trace import read_rollout_metrics


class ProfileTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.case = self.root / "case"
        self.case.mkdir()
        self.source = self.root / ".codex" / "agents"
        self.source.mkdir(parents=True)
        (self.source / "reviewer.toml").write_text('name = "reviewer"\ndescription = "Review"\ndeveloper_instructions = "Read assigned skill"\n')

    def declare(self, names):
        (self.case / "agent-profiles.json").write_text(json.dumps(names))

    def test_no_implicit_profiles(self):
        self.assertEqual(discover_profiles(self.case, self.root), ())
        self.assertEqual(profile_overrides(()), [])

    def test_missing_duplicate_and_unsafe_declarations(self):
        for names in (["missing"], ["reviewer", "reviewer"], ["../reviewer"], {"profiles": []}, [True]):
            with self.subTest(names=names):
                self.declare(names)
                with self.assertRaises(HarnessError):
                    discover_profiles(self.case, self.root)

    def test_injection_snapshot_registration_and_mutation_detection(self):
        self.declare(["reviewer"])
        profiles = discover_profiles(self.case, self.root)
        run = self.root / "run"
        run.mkdir()
        workspace = run / "workspace"
        injected = inject_profiles(profiles, workspace, run)
        source_bytes = profiles[0].read_bytes()
        self.assertEqual(injected[0].read_bytes(), source_bytes)
        self.assertEqual((run / "agent-profile-snapshot" / "reviewer.toml").read_bytes(), source_bytes)
        flags = profile_overrides(injected)
        self.assertIn(f'agents.reviewer.config_file={json.dumps(str(injected[0].resolve()))}', flags)
        before = profile_hashes(injected)
        injected[0].write_text("changed")
        self.assertNotEqual(profile_hashes(injected), before)
        self.assertEqual(profiles[0].read_bytes(), source_bytes)
        injected[0].unlink()
        self.assertNotEqual(profile_hashes(injected), before)

    def test_actual_cases_declare_same_profiles(self):
        evals = Path(__file__).resolve().parents[1]
        cases = discover_cases(evals / "code-review", SKILLS_ROOT / "code-review")
        delegated, direct = cases["delegated-child-boundary"], cases["single-agent-route"]
        self.assertEqual(len(delegated.agent_profiles), 5)
        self.assertEqual(delegated.agent_profiles, direct.agent_profiles)
        self.assertTrue(all(path.is_file() for path in delegated.agent_profiles))

    def test_role_metadata_supports_current_and_legacy_field_names(self):
        path = self.root / "trace.jsonl"
        for key in ("agent_role", "agent_type"):
            for nested in (False, True):
                payload = {key: "reviewer"}
                if nested:
                    payload = {"source": {"subagent": {"thread_spawn": payload}}}
                path.write_text(json.dumps({"type": "session_meta", "payload": payload}) + "\n")
                self.assertEqual(read_rollout_metrics(path)["agent_role"], "reviewer")

    def test_worker_gets_profiles_and_tampering_fails_protection(self):
        evals = Path(__file__).resolve().parents[1]
        skill = SKILLS_ROOT / "code-review"
        case = replace(discover_cases(evals / "code-review", skill)["single-agent-route"],
                       checker=None, expected=None)
        def worker(command, **options):
            workspace = options["cwd"]
            self.assertIn("agents.spec_contract_reviewer.config_file=", " ".join(command))
            self.assertTrue((workspace / ".codex/agents/spec_contract_reviewer.toml").is_file())
            options["stdout_path"].write_text(json.dumps({"type": "turn.completed", "usage": {}}) + "\n")
            (workspace / ".codex/agents/spec_contract_reviewer.toml").write_text("modified")
            return subprocess.CompletedProcess(command, 0)
        def capture(parts, destination, *unused):
            shutil.copyfile(parts[0], destination)
        run_dir = self.root / "trial"
        with patch.object(harness, "run_command", side_effect=worker), \
             patch.object(harness, "capture_main_rollout", side_effect=capture), \
             contextlib.redirect_stdout(io.StringIO()):
            result = harness.run_trial(case=case, skill_root=skill, configuration="with-skill",
                                       trial=1, run_dir=run_dir, schema=evals / "_lib/grade.schema.json",
                                       semantic_enabled=False, semantic_judges=0, timeout=5, model=None)
        self.assertFalse(result["protected_inputs_intact"])
        self.assertFalse(result["overall_pass"])
        worker_result = json.loads((run_dir / "worker/result.json").read_text())
        self.assertFalse(worker_result["agent_profiles_intact"])
        metadata = json.loads((run_dir / "run.json").read_text())
        self.assertEqual(len(metadata["agent_profile_sha256"]), 5)
        self.assertTrue((run_dir / "agent-profile-snapshot/spec_contract_reviewer.toml").is_file())

    def test_new_review_output_passes_real_grader_in_disposable_workspace(self):
        evals = Path(__file__).resolve().parents[1]
        skill = SKILLS_ROOT / "code-review"
        case = replace(discover_cases(evals / "code-review", skill)["single-agent-route"],
                       expected=None)

        def worker(command, **options):
            workspace = options["cwd"]
            output = workspace / "workflow/reviews/synthetic.md"
            output.parent.mkdir(parents=True)
            output.write_text("# Synthetic harness integration fixture\n")
            reads = ["code-review/DEFAULT.md", "code-review/references/review-axes.md",
                     "code-review/references/review-report.md"]
            reads.extend(f"{name}/SKILL.md" for name in (
                "code-quality-review", "spec-contract-review",
                "security-boundary-review", "verification-review"))
            events = [{"item": {"type": "command_execution",
                       "command": f"cat .agents/skills/{path}"}} for path in reads]
            events.append({"type": "turn.completed", "usage": {}})
            options["stdout_path"].write_text("\n".join(json.dumps(event) for event in events) + "\n")
            return subprocess.CompletedProcess(command, 0)

        def capture(parts, destination, *unused):
            shutil.copyfile(parts[0], destination)

        run_dir = self.root / "passing-trial"
        with patch.object(harness, "run_command", side_effect=worker), \
             patch.object(harness, "capture_main_rollout", side_effect=capture), \
             contextlib.redirect_stdout(io.StringIO()):
            result = harness.run_trial(case=case, skill_root=skill, configuration="with-skill",
                                       trial=1, run_dir=run_dir, schema=evals / "_lib/grade.schema.json",
                                       semantic_enabled=False, semantic_judges=0, timeout=5, model=None)
        self.assertTrue(result["protected_inputs_intact"])
        self.assertTrue(result["overall_pass"])
        self.assertEqual(result["deterministic_score"], 100)
        self.assertTrue((run_dir / "workspace/workflow/reviews/synthetic.md").is_file())


if __name__ == "__main__":
    unittest.main()
