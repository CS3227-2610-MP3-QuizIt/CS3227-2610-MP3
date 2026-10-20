import unittest
from attempts import open_attempt, read_result


class AttemptsTests(unittest.TestCase):
    def test_reopen_preserves_answers(self):
        record = {"student_id": 7, "status": "in_progress", "answers": {1: "B"}}
        self.assertIs(open_attempt(record, 7), record)
        self.assertEqual(open_attempt(record, 7)["answers"], {1: "B"})

    def test_start_and_owner_isolation(self):
        record = {"student_id": 7, "status": "not_started", "answers": {}}
        self.assertEqual(open_attempt(record, 7)["status"], "in_progress")
        with self.assertRaises(PermissionError):
            open_attempt(record, 8)

    def test_result_boundary(self):
        record = {"student_id": 7, "status": "in_progress", "result": {"score": 1}}
        with self.assertRaises(PermissionError):
            read_result(record, 7)
        record["status"] = "submitted"
        self.assertEqual(read_result(record, 7), {"score": 1})
        with self.assertRaises(PermissionError):
            read_result(record, 8)
