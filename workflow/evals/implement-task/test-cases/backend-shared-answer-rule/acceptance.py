"""Private behavioral acceptance oracle; never injected into the worker."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest

root = Path(sys.argv.pop())
spec = importlib.util.spec_from_file_location("subject", root / "backend/answers.py")
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)


class AnswerContract(unittest.TestCase):
    def attempt(self):
        return {"owner": "s1", "status": "in_progress", "answers": {"q2": 3}}

    def test_valid_boundaries(self):
        for value in (1, 2, 3, 4):
            a = self.attempt()
            subject.save_answer(a, "s1", "q1", value)
            self.assertEqual(a["answers"], {"q1": value, "q2": 3})
            b = self.attempt()
            subject.submit_attempt(b, "s1", {"q1": value, "q2": 4})
            self.assertEqual(b["status"], "submitted")
            self.assertEqual(b["answers"], {"q1": value, "q2": 4})

    def test_invalid_values_leave_state_unchanged(self):
        for value in (0, -1, 5, 100, True, False, 1.0, "1", None, []):
            for entry in ("save", "submit"):
                with self.subTest(value=value, entry=entry):
                    a = self.attempt()
                    before = copy.deepcopy(a)
                    with self.assertRaises(ValueError):
                        if entry == "save":
                            subject.save_answer(a, "s1", "q1", value)
                        else:
                            subject.submit_attempt(a, "s1", {"q1": 2, "q2": value})
                    self.assertEqual(a, before)

    def test_denied_ownership_and_state(self):
        for actor, status in (("other", "in_progress"), ("s1", "submitted")):
            for entry in ("save", "submit"):
                a = self.attempt()
                a["status"] = status
                before = copy.deepcopy(a)
                with self.assertRaises(PermissionError):
                    if entry == "save":
                        subject.save_answer(a, actor, "q1", 1)
                    else:
                        subject.submit_attempt(a, actor, {"q1": 1, "q2": 2})
                self.assertEqual(a, before)

    def test_incomplete_and_unknown_questions(self):
        for answers in ({}, {"q1": 1}, {"q1": 1, "q2": 2, "q3": 3}):
            a = self.attempt()
            before = copy.deepcopy(a)
            with self.assertRaises(ValueError):
                subject.submit_attempt(a, "s1", answers)
            self.assertEqual(a, before)
        a = self.attempt()
        before = copy.deepcopy(a)
        with self.assertRaises(ValueError):
            subject.save_answer(a, "s1", "unknown", 1)
        self.assertEqual(a, before)


if __name__ == "__main__":
    unittest.main()
