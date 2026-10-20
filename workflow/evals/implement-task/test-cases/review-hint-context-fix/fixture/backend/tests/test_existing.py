import unittest
from hints import make_hint_request

class ExistingHints(unittest.TestCase):
    def test_question_identity(self):
        result = make_hint_request({"id": "q1", "prompt": "Trees"})
        self.assertEqual(result["question_id"], "q1")
        self.assertEqual(result["prompt"], "Trees")
