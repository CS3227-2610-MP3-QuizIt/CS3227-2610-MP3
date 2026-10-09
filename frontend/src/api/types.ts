export type Role = "admin" | "teacher" | "student";
export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
}
export interface AccountInput {
  username: string;
  display_name: string;
  password: string;
  role: "student" | "teacher";
}
export interface ClassRoom {
  id: number;
  name: string;
  created_at: string;
}
export interface Member extends User {
  assigned_at: string;
}
export interface Quiz {
  id: number;
  class_id: number;
  class_name: string;
  title: string;
  question_count: number;
  status: "published";
  revision: number;
  created_at: string;
  published_at: string | null;
}
export interface Completion {
  quiz_id: number;
  assigned_count: number;
  submitted_count: number;
  not_started_count: number;
  in_progress_count: number;
  summary_eligible: boolean;
  has_summary: boolean;
}
export interface SafeError {
  code: string;
  message: string;
  retry_after_seconds?: number | null;
  details?: Record<string, unknown>;
}
export interface QuestionMetric {
  id: number;
  position: number;
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  correct_option: "A" | "B" | "C" | "D";
  correct_count: number;
  incorrect_count: number;
  correct_percent: number;
  option_counts: Record<"A" | "B" | "C" | "D", number>;
}
export interface SummaryResult {
  quiz_id: number;
  ai_request_id: string;
  created_at: string;
  metrics: {
    assigned_count: number;
    submitted_count: number;
    question_count: number;
    average_score: number;
    min_score: number;
    max_score: number;
    average_score_percent: number;
    questions: QuestionMetric[];
  };
  summary: { overview: string; strengths: string[]; areas_to_review: string[] };
}
export interface SummaryState {
  target_id: number | null;
  feature: "summary";
  quiz_id: number;
  attempt_id: null;
  question_id: null;
  task_id: string | null;
  version: number;
  status: "not_requested" | "in_progress" | "success" | "failed";
  result: SummaryResult | null;
  error: (SafeError & { http_status?: number }) | null;
}
export interface AIChange {
  feature: string;
  target_id?: number | null;
  task_id?: string | null;
  attempt_id?: number | null;
  question_id?: number | null;
  quiz_id: number;
  version: number;
}

export type Option = "A" | "B" | "C" | "D";
export interface TeacherQuizItem extends Omit<Quiz, "status"> {
  status: "draft" | "published";
}
export interface TeacherQuestion {
  id: number;
  position: number;
  question: string;
  options: Record<Option, string>;
  correct_option: Option;
  explanation: string;
}
export interface TeacherQuiz extends Omit<TeacherQuizItem, "class_name"> {
  teacher_id: number;
  note_id: number;
  questions: TeacherQuestion[];
}
export interface NoteUpload {
  id: number;
  class_id: number;
  original_filename: string;
  extracted_characters: number;
  created_at: string;
}
export interface DraftInput {
  class_id: number;
  note_id: number;
  title: string;
  question_count: number;
}
export interface GenerationInput {
  expected_revision: number;
  prompt: string;
  action: "ensure" | "new";
}
export interface GenerationState extends Omit<
  SummaryState,
  "feature" | "result"
> {
  feature: "quiz_generation";
  result: Omit<TeacherQuiz, "teacher_id" | "note_id"> | null;
  // Content always comes from GET /quizzes/:id, never a historical task result.
  quiz?: TeacherQuiz;
}
export interface Publication extends Omit<
  TeacherQuiz,
  "teacher_id" | "note_id" | "questions"
> {
  assigned_student_count: number;
}

export type AttemptStatus = "not_started" | "in_progress" | "submitted";
export interface StudentQuizItem extends Quiz {
  attempt_id: number;
  attempt_status: AttemptStatus;
  score: number | null;
}
export interface StudentQuestion {
  id: number;
  position: number;
  question: string;
  options: Record<Option, string>;
}
export interface StudentQuiz extends Omit<StudentQuizItem, "class_name"> {
  questions: StudentQuestion[];
}
export interface SavedAnswer {
  question_id: number;
  selected_option: Option;
  updated_at: string;
}
export interface Attempt {
  id: number;
  quiz_id: number;
  status: AttemptStatus;
  started_at: string | null;
  answers: SavedAnswer[];
  hints: HintState[];
}
export interface SubmissionScore {
  id: number;
  quiz_id: number;
  status: "submitted";
  score: number;
  total_questions: number;
  score_percent: number;
  submitted_at: string;
}
export interface StudentResults extends SubmissionScore {
  questions: (TeacherQuestion & {
    selected_option: Option;
    is_correct: boolean;
  })[];
}
export interface HintInput {
  action: "ensure" | "new";
  prompt: string;
}
export interface HintState extends Omit<
  SummaryState,
  "feature" | "attempt_id" | "question_id" | "result"
> {
  feature: "hint";
  attempt_id: number;
  question_id: number;
  result: {
    id: number;
    question_id: number;
    hint: string;
    ai_request_id: string;
  } | null;
}
