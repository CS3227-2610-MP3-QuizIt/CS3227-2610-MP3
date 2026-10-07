import type { ClassRoom, GenerationState, TeacherQuiz } from "../src/api/types";

export const classes: ClassRoom[] = [
  { id: 1, name: "Software security", created_at: "2026-10-01T00:00:00Z" },
];
export const quiz = (revision = 1): TeacherQuiz => ({
  id: 1,
  class_id: 1,
  teacher_id: 2,
  note_id: 3,
  title: "Security basics",
  question_count: 1,
  status: "draft",
  revision,
  created_at: "2026-10-01T00:00:00Z",
  published_at: null,
  questions: revision
    ? [
        {
          id: revision,
          position: 1,
          question: `Question in revision ${revision}?`,
          options: {
            A: "First option",
            B: "Second option",
            C: "Third option",
            D: "Fourth option",
          },
          correct_option: "B",
          explanation:
            "The second option is correct because it validates access.",
        },
      ]
    : [],
});
export const generation = (
  version = 2,
  status: GenerationState["status"] = "success",
  current = quiz(),
): GenerationState => ({
  target_id: version ? 1 : null,
  feature: "quiz_generation",
  quiz_id: 1,
  attempt_id: null,
  question_id: null,
  task_id: version ? "task" : null,
  version,
  status,
  result: status === "success" ? current : null,
  error:
    status === "failed"
      ? {
          code: "AI_INVALID_OUTPUT",
          message: "The generated questions were invalid.",
        }
      : null,
  quiz: current,
});
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
