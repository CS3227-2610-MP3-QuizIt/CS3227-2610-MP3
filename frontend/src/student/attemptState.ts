import type { Option, StudentQuiz } from "../api/types";

export type Answer = {
  option: Option;
  status: "saving" | "saved" | "failed";
  error?: string;
};
export type Questions = StudentQuiz["questions"];
export function answerReadiness(
  questions: Questions,
  answers: Record<number, Answer>,
) {
  const missing = questions.filter((question) => !answers[question.id]).length;
  const saving = questions.filter(
    (question) => answers[question.id]?.status === "saving",
  ).length;
  const failed = questions.filter(
    (question) => answers[question.id]?.status === "failed",
  ).length;
  const ready = !missing && !saving && !failed;
  const message = ready
    ? "All answers saved. Ready to submit."
    : [
        missing
          ? `${missing} unanswered. Select an answer for every question.`
          : "",
        saving
          ? `${saving} saving. Wait for answer saves before submitting.`
          : "",
        failed
          ? `${failed} failed. Retry failed answer saves before submitting.`
          : "",
      ]
        .filter(Boolean)
        .join(" ");
  return { ready, message, answered: questions.length - missing };
}
export const questionHeadingId = (attemptId: number, questionId: number) =>
  `attempt-${attemptId}-question-${questionId}`;
