def open_attempt(record, student_id):
    if record["student_id"] != student_id:
        raise PermissionError("Not your attempt")
    if record["status"] == "not_started":
        record["status"] = "in_progress"
    return record


def read_result(record, student_id):
    if record["student_id"] != student_id or record["status"] != "submitted":
        raise PermissionError("Result unavailable")
    return record["result"]
