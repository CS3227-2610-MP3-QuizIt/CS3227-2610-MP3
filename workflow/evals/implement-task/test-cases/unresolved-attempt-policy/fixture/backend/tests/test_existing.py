import unittest
from answers import save_answer, submit_attempt

class ExistingAttempts(unittest.TestCase):
    def test_valid_save(self):
        a = {"owner": "s1", "status": "in_progress", "answers": {}}
        save_answer(a, "s1", "q1", 2)
        self.assertEqual(a["answers"], {"q1": 2})

    def test_other_owner_denied(self):
        a = {"owner": "s1", "status": "in_progress", "answers": {}}
        with self.assertRaises(PermissionError):
            submit_attempt(a, "other", {"q1": 1, "q2": 2})
        self.assertEqual(a["answers"], {})
