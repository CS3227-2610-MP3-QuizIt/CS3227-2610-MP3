import type {
  Attempt,
  HintState,
  StudentQuiz,
  StudentQuizItem,
  StudentResults,
} from "../src/api/types";
export { deferred } from "./teacherFixtures";
export const studentQuiz = (id = 1): StudentQuiz => ({
  id,
  class_id: 1,
  title: `Practice ${id}`,
  question_count: 2,
  status: "published",
  revision: 1,
  created_at: "2026-10-01T00:00:00Z",
  published_at: "2026-10-01T00:00:00Z",
  attempt_id: id * 10,
  attempt_status: "in_progress",
  score: null,
  questions: [1, 2].map((position) => ({
    id: position,
    position,
    question: `Question ${position}?`,
    options: {
      A: `Alpha ${position}`,
      B: `Beta ${position}`,
      C: `Gamma ${position}`,
      D: `Delta ${position}`,
    },
  })),
});
export const assignment = (
  status: StudentQuizItem["attempt_status"],
  id = 1,
): StudentQuizItem => ({
  ...studentQuiz(id),
  class_name: "Former class",
  attempt_status: status,
});
export const studentAttempt = (id = 10): Attempt => ({
  id,
  quiz_id: id / 10,
  status: "in_progress",
  started_at: "2026-10-01T00:00:00Z",
  answers: [
    {
      question_id: 1,
      selected_option: "B",
      updated_at: "2026-10-01T00:00:00Z",
    },
  ],
  hints: [],
});
export const hintState = (
  version = 0,
  status: HintState["status"] = "not_requested",
  attemptId = 10,
  questionId = 1,
): HintState => ({
  target_id: version ? 1 : null,
  feature: "hint",
  quiz_id: attemptId / 10,
  attempt_id: attemptId,
  question_id: questionId,
  task_id: version ? "task" : null,
  version,
  status,
  result:
    status === "success"
      ? {
          id: 1,
          question_id: questionId,
          hint: "Consider the concept.",
          ai_request_id: "task",
        }
      : null,
  error:
    status === "failed"
      ? { code: "AI_INVALID_OUTPUT", message: "Hint withheld." }
      : null,
});
export const results = (id = 10): StudentResults => ({
  id,
  quiz_id: id / 10,
  status: "submitted",
  score: 1,
  total_questions: 2,
  score_percent: 50,
  submitted_at: "2026-10-01T00:00:00Z",
  questions: studentQuiz().questions.map((question) => ({
    ...question,
    selected_option: "B",
    correct_option: question.id === 1 ? "B" : "A",
    is_correct: question.id === 1,
    explanation: `Explanation ${question.id}`,
  })),
});
