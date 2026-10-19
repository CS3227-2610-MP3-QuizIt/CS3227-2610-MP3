"""Synthetic trace regressions for the two case-local routing graders."""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


CASES = Path(__file__).resolve().parents[1] / "code-review" / "test-cases"
SKILLS = ("code-quality-review", "spec-contract-review", "security-boundary-review", "verification-review")
PROFILES = ("code_quality_reviewer", "spec_contract_reviewer", "security_boundary_reviewer", "verification_reviewer")


class RoutingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.workspace = self.root / "workspace"
        (self.workspace / "reviews").mkdir(parents=True)
        (self.workspace / "reviews" / "report.md").write_text("# Canonical report\n")
        for name in SKILLS:
            skill = self.workspace / ".agents" / "skills" / name / "SKILL.md"
            skill.parent.mkdir(parents=True)
            skill.write_text(f"# {name}\nReview this axis only.\n")
        parent = self.workspace / ".agents" / "skills" / "code-review"
        parent.mkdir()
        (parent / "SUBAGENTS.md").write_text("# Delegated instructions\nSpawn specialists, then aggregate.\n")
        (parent / "AGGREGATOR.md").write_text("# Aggregator instructions\nCombine child findings without rereview.\n")
        self.worker = self.root / "worker"
        (self.worker / "subagents").mkdir(parents=True)
        self.trace = self.worker / "trace.jsonl"

    def trace_file(self, path, commands, shape="persisted"):
        events = []
        for command in commands:
            item = {"type": "CommandExecution" if shape == "persisted" else "command_execution", "command": command}
            if shape == "persisted":
                events.append({"payload": {"type": "item_completed", "item": item}})
            elif shape == "legacy":
                events.append({"payload": {"type": "exec_command_end", "command": command}})
            else:
                events.append({"item": item})
        path.write_text("\n".join(json.dumps(event) for event in events))

    def grade(self, case):
        result = subprocess.run(
            [sys.executable, "-B", str(CASES / case / "check.py"),
             "--workspace", str(self.workspace), "--trace", str(self.trace),
             "--run", str(self.root / "run.json")],
            check=True, capture_output=True, text=True,
        )
        grade = json.loads(result.stdout)
        self.assertEqual(grade["overall_pass"], grade["score"] >= 70)
        self.assertLessEqual(grade["score"], 100)
        return grade

    def append_output(self, command, output, shape="persisted"):
        item = {"type": "CommandExecution", "command": command, "aggregated_output": output}
        if shape == "persisted":
            event = {"payload": {"type": "item_completed", "item": item}}
        elif shape == "legacy":
            event = {"payload": {**item, "type": "exec_command_end"}}
        else:
            event = {"item": {**item, "type": "command_execution"}}
        with self.trace.open("a") as stream:
            stream.write("\n" + json.dumps(event))

    def default(self, shape="persisted"):
        commands = ["cat .agents/skills/code-review/DEFAULT.md",
                    "cat .agents/skills/code-review/references/review-axes.md",
                    "cat .agents/skills/code-review/references/review-report.md"]
        commands += [f"cat .agents/skills/{name}/SKILL.md" for name in SKILLS]
        self.trace_file(self.trace, commands, shape)
        (self.worker / "metrics.json").write_text(json.dumps({"subagent_spawn_count": 0}))
        return commands

    def delegated(self):
        commands = ["cat .agents/skills/code-review/SUBAGENTS.md",
                    "cat .agents/skills/code-review/references/review-axes.md"]
        self.trace_file(self.trace, commands)
        children = []
        for index, name in enumerate(SKILLS):
            thread = f"specialist-{index}"
            children.append({"thread_id": thread, "agent_role": PROFILES[index], "prompt": "Target: fixture-base..fixture-target; Output: assigned artifact"})
            self.trace_file(self.worker / "subagents" / f"{thread}.jsonl", [f"cat .agents/skills/{name}/SKILL.md"])
            (self.workspace / "reviews" / f"{name}.md").write_text("# Axis findings\n")
        children.append({"thread_id": "aggregator", "agent_role": "review_aggregator", "prompt": "Aggregate assigned artifacts"})
        self.trace_file(self.worker / "subagents" / "aggregator.jsonl", [
            "cat .agents/skills/code-review/AGGREGATOR.md",
            "cat .agents/skills/code-review/references/review-axes.md",
            "cat .agents/skills/code-review/references/review-report.md",
        ])
        (self.worker / "metrics.json").write_text(json.dumps({
            "subagents": children, "subagent_wait_count": 1,
        }))
        return commands

    def test_default_passes_supported_event_shapes(self):
        for shape in ("persisted", "live", "legacy"):
            with self.subTest(shape=shape):
                self.default(shape)
                self.assertEqual(self.grade("single-agent-route")["score"], 100)

    def test_default_missing_roster_or_child_fails(self):
        for fragment in ("review-axes", "verification-review"):
            with self.subTest(fragment=fragment):
                commands = self.default()
                self.trace_file(self.trace, [command for command in commands if fragment not in command])
                self.assertFalse(self.grade("single-agent-route")["overall_pass"])

    def test_default_can_read_skills_with_glob(self):
        commands = self.default()
        self.trace_file(self.trace, commands[:3] + ["cat .agents/skills/*/SKILL.md"])
        self.assertTrue(self.grade("single-agent-route")["overall_pass"])

    def test_loop_reads_use_observed_contents_in_every_event_shape(self):
        paths = [f".agents/skills/{name}/SKILL.md" for name in SKILLS]
        loop = "for f in " + " ".join(paths) + '; do echo "### $f"; sed -n \'1,220p\' "$f"; done'
        for shape in ("persisted", "live", "legacy"):
            with self.subTest(shape=shape):
                commands = self.default()
                self.trace_file(self.trace, commands[:3])
                output = "\n".join((self.workspace / path).read_text() for path in paths)
                self.append_output(loop, output, shape)
                self.assertTrue(self.grade("single-agent-route")["overall_pass"])
        self.trace_file(self.trace, commands[:3])
        self.append_output(loop, "\n".join((self.workspace / path).read_text() for path in paths[:-1]))
        self.assertFalse(self.grade("single-agent-route")["overall_pass"])

    def test_loop_filename_listing_does_not_prove_content_reads(self):
        commands = self.default()
        self.trace_file(self.trace, commands[:3])
        self.append_output("for f in .agents/skills/*/SKILL.md; do echo $f; done",
                           "\n".join(f".agents/skills/{name}/SKILL.md" for name in SKILLS))
        self.assertFalse(self.grade("single-agent-route")["overall_pass"])

    def test_git_content_exposure_fails_but_stats_do_not(self):
        for case, prepare, name in (("single-agent-route", self.default, "SUBAGENTS.md"),
                                    ("delegated-child-boundary", self.delegated, "AGGREGATOR.md")):
            with self.subTest(case=case):
                prepare()
                path = f".agents/skills/code-review/{name}"
                self.append_output("git show --stat HEAD", f" {path} | 2 ++\n")
                self.assertTrue(self.grade(case)["overall_pass"])
                content = (self.workspace / path).read_text()
                patch = f"diff --git a/{path} b/{path}\n+++ b/{path}\n" + "\n".join("+" + row for row in content.splitlines())
                self.append_output("git show HEAD --", patch)
                self.assertFalse(self.grade(case)["overall_pass"])

    def test_default_delegated_read_fails_but_listing_does_not(self):
        commands = self.default()
        self.trace_file(self.trace, commands + ["ls .agents/skills/code-review/SUBAGENTS.md", "echo AGGREGATOR.md"])
        self.assertTrue(self.grade("single-agent-route")["overall_pass"])
        self.trace_file(self.trace, commands + ["/bin/zsh -lc 'cat .agents/skills/code-review/SUBAGENTS.md'"])
        self.assertFalse(self.grade("single-agent-route")["overall_pass"])

    def test_default_spawn_missing_metrics_or_extra_artifact_fails(self):
        for mutation in ("spawn", "missing-metrics", "extra-artifact"):
            with self.subTest(mutation=mutation):
                self.default()
                if mutation == "spawn":
                    (self.worker / "metrics.json").write_text('{"subagent_spawn_count": 1}')
                elif mutation == "missing-metrics":
                    (self.worker / "metrics.json").unlink()
                else:
                    (self.workspace / "reviews" / "quality.md").write_text("# Extra artifact\n")
                self.assertFalse(self.grade("single-agent-route")["overall_pass"])

    def test_delegated_valid_routing_passes(self):
        self.delegated()
        self.assertEqual(self.grade("delegated-child-boundary")["score"], 100)

    def test_profile_name_in_prompt_is_not_selection_evidence(self):
        self.delegated()
        path = self.worker / "metrics.json"
        metrics = json.loads(path.read_text())
        metrics["subagents"][0]["agent_role"] = "default"
        metrics["subagents"][0]["prompt"] = "Use code_quality_reviewer and code-quality-review/SKILL.md"
        path.write_text(json.dumps(metrics))
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])

    def test_full_history_fork_is_rejected(self):
        self.delegated()
        event = {"payload": {"type": "custom_tool_call", "input": "spawn_agent({fork_context:true, message:'review'})"}}
        with self.trace.open("a") as stream:
            stream.write("\n" + json.dumps(event))
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])

    def test_main_must_not_read_profile_instructions(self):
        commands = self.delegated()
        self.trace_file(self.trace, commands + ["cat .codex/agents/spec_contract_reviewer.toml"])
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])

    def test_delegated_main_forbidden_reads_fail(self):
        for target in ("DEFAULT.md", "AGGREGATOR.md", "code-quality-review/SKILL.md", "reviews/quality.md", ".agents/skills/*/SKILL.md"):
            with self.subTest(target=target):
                commands = self.delegated()
                self.trace_file(self.trace, commands + [f"cat {target}"])
                self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])

    def test_delegated_missing_roster_or_child_read_fails(self):
        commands = self.delegated()
        self.trace_file(self.trace, commands[:1])
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])
        self.delegated()
        (self.worker / "subagents" / "specialist-0.jsonl").write_text("")
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])

    def test_aggregator_must_read_contract_and_not_skills(self):
        self.delegated()
        path = self.worker / "subagents" / "aggregator.jsonl"
        self.trace_file(path, ["cat code-review/AGGREGATOR.md"])
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])
        self.delegated()
        with path.open("a") as stream:
            stream.write("\n" + json.dumps({"item": {"type": "command_execution", "command": "cat code-quality-review/SKILL.md"}}))
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])

    def test_aggregator_parent_skill_before_entrypoint_fails(self):
        self.delegated()
        path = self.worker / "subagents" / "aggregator.jsonl"
        self.trace_file(path, [
            "cat .agents/skills/code-review/SKILL.md && cat .agents/skills/code-review/AGGREGATOR.md",
            "cat .agents/skills/code-review/references/review-axes.md",
            "cat .agents/skills/code-review/references/review-report.md",
        ])
        self.assertFalse(self.grade("delegated-child-boundary")["overall_pass"])

    def test_prompts_fix_product_target_not_setup_commit(self):
        for case in ("single-agent-route", "delegated-child-boundary"):
            prompt = (CASES / case / "prompt.md").read_text()
            self.assertIn("fixture-base..fixture-target", prompt)
            self.assertIn("exclude it from the review", prompt)

    def test_source_mutation_is_hard_failure_in_both_modes(self):
        (self.root / "git").mkdir()
        (self.root / "git" / "changes.patch").write_text("diff --git a/src/quiz.ts b/src/quiz.ts\n+++ b/src/quiz.ts\n")
        for case, prepare in (("single-agent-route", self.default), ("delegated-child-boundary", self.delegated)):
            with self.subTest(case=case):
                prepare()
                self.assertFalse(self.grade(case)["overall_pass"])

    def test_supporting_skills_match_between_modes(self):
        for name in SKILLS:
            relative = Path("supporting-skills") / name / "SKILL.md"
            self.assertEqual((CASES / "single-agent-route" / relative).read_bytes(),
                             (CASES / "delegated-child-boundary" / relative).read_bytes())


if __name__ == "__main__":
    unittest.main()
