"""Private hint-input acceptance oracle."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
root = Path(sys.argv.pop())
spec = importlib.util.spec_from_file_location("subject", root / "backend/hints.py")
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)


class HintInputs(unittest.TestCase):
    def test_only_question_context_is_exposed(self):
        for q in (
            {"id": "q1", "prompt": "Explain trees", "options": ["secret"], "answer": 2,
             "explanation": "private", "student_id": "s1"},
            {"id": "q2", "prompt": "Explain arrays", "extra": {"correct": 1}},
        ):
            before = copy.deepcopy(q)
            self.assertEqual(subject.make_hint_request(q), {"question_id": q["id"], "prompt": q["prompt"]})
            self.assertEqual(q, before)


if __name__ == "__main__":
    unittest.main()
