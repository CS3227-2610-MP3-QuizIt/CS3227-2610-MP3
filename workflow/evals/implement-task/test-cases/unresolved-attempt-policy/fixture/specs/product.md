# Attempt contract

A-001: save_answer(attempt, actor, question_id, answer) and
submit_attempt(attempt, actor, answers) require the owner and in_progress state.
Answers are integers 1..4, excluding booleans; invalid answers raise ValueError.
Only q1/q2 are valid; submission requires both. Validate the entire operation
before mutation. Denied operations raise PermissionError and preserve state.
