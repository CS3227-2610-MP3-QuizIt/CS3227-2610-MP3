"""Small attempt service; both entry points enforce the same answer contract."""
def _authorize(attempt, actor):
    if attempt["owner"] != actor or attempt["status"] != "in_progress":
        raise PermissionError("attempt unavailable")


def save_answer(attempt, actor, question_id, answer):
    _authorize(attempt, actor)
    if question_id not in ("q1", "q2"):
        raise ValueError("unknown question")
    if not isinstance(answer, int):
        raise ValueError("invalid answer")
    attempt["answers"][question_id] = answer
    return attempt


def submit_attempt(attempt, actor, answers):
    _authorize(attempt, actor)
    if set(answers) != {"q1", "q2"}:
        raise ValueError("complete answers required")
    for answer in answers.values():
        if not isinstance(answer, int):
            raise ValueError("invalid answer")
    attempt["answers"] = dict(answers)
    attempt["status"] = "submitted"
    return attempt
