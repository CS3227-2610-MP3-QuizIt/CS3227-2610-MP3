export function quizCards(items) {
  return items.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    className: quiz.class_name,
    count: quiz.question_count,
    status: quiz.attempt_status,
    action: quiz.attempt_status === "submitted" ? "View results"
      : quiz.attempt_status === "in_progress" ? "Resume" : "Start",
    href: "#/student/" + (quiz.attempt_status === "submitted" ? "results/" : "attempt/") + quiz.id,
  }));
}
