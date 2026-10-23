export type QuizListTab = "todo" | "submitted" | "all";
export interface QuizListPreferences {
  tab: QuizListTab;
  classId: string;
  search: string;
}
export const defaultQuizListPreferences: QuizListPreferences = {
  tab: "todo",
  classId: "all",
  search: "",
};
