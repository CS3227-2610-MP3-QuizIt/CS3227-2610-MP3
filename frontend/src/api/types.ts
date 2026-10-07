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
  quiz_id: number;
  version: number;
}
