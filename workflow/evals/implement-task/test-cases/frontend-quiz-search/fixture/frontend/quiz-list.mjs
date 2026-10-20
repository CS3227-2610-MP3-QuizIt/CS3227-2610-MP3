export function quizCards(items) {
  return items.map(q => ({
    id: q.id, title: q.title, className: q.class_name, count: q.question_count,
    status: q.attempt_status,
    action: q.attempt_status === "submitted" ? "View results" : q.attempt_status === "in_progress" ? "Resume" : "Start",
    href: "#/student/" + (q.attempt_status === "submitted" ? "results/" : "attempt/") + q.id,
  }));
}
