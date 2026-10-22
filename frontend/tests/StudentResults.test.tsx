import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
import type { Option, StudentResults } from "../src/api/types";
import { HintStore } from "../src/student/HintStore";
import { QuizPage } from "../src/student/QuizPage";
import { results, studentAttempt, studentQuiz } from "./studentFixtures";

const letters: Option[] = ["A", "B", "C", "D"];
function fixture(count: number, correct: number[]): StudentResults {
  return {
    ...results(),
    score: correct.length,
    total_questions: count,
    score_percent: (100 * correct.length) / count,
    submitted_at: "2026-10-01T00:30:00Z",
    questions: Array.from({ length: count }, (_, index) => ({
      ...results().questions[0],
      id: 101 + index,
      position: index + 1,
      question: `Saved stem ${index + 1}`,
      selected_option: "B",
      correct_option: correct.includes(index + 1) ? "B" : "D",
      is_correct: correct.includes(index + 1),
      explanation: `Saved explanation ${index + 1}`,
    })),
  };
}

describe("submitted result review", () => {
  let store: HintStore;
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    store = new HintStore({ read: vi.fn(), generate: vi.fn() });
    vi.spyOn(api, "studentQuiz").mockImplementation(async (id) => ({
      ...studentQuiz(id),
      attempt_status: "submitted",
    }));
    vi.spyOn(api, "attempt").mockImplementation(async (id) => ({
      ...studentAttempt(id),
      status: "submitted",
    }));
    vi.spyOn(api, "startAttempt");
    vi.spyOn(api, "saveAnswer");
    vi.spyOn(api, "submitAttempt");
    vi.spyOn(api, "generateHint");
    vi.spyOn(api, "results").mockResolvedValue(fixture(4, [1, 3]));
  });
  afterEach(() => {
    store.dispose();
    vi.restoreAllMocks();
  });
  const open = () => render(<QuizPage id={1} resultsOnly store={store} />);
  const cards = () =>
    within(
      screen.getByRole("region", { name: "Question review" }),
    ).queryAllByRole("article");

  it("shows backend score, percentage, counts and actual submitted date", async () => {
    const saved = fixture(4, [1, 3]);
    saved.score_percent = 49.875;
    vi.mocked(api.results).mockResolvedValue(saved);
    open();
    await screen.findByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent === "Score for this quiz: 2 out of 4",
    );
    const details = screen.getByRole("complementary", {
      name: "Submission details",
    });
    expect(within(details).getByText("2 / 4")).toBeInTheDocument();
    expect(within(details).getByText("49.88%")).toBeInTheDocument();
    expect(
      within(details).getByText("Correct").nextElementSibling,
    ).toHaveTextContent("2");
    expect(
      within(details).getByText("Incorrect").nextElementSibling,
    ).toHaveTextContent("2");
    const expectedDate = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
    }).format(new Date("2026-10-01T00:30:00Z"));
    expect(screen.getAllByText(expectedDate)).toHaveLength(2);
    expect(
      document.querySelectorAll('time[datetime="2026-10-01T00:30:00Z"]'),
    ).toHaveLength(2);
    expect(
      screen.getByText("Submitted", { selector: ".badge" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4 questions")).toBeInTheDocument();
    expect(
      within(details).getByText(/final.*cannot be changed/i),
    ).toBeInTheDocument();
  });

  it.each(
    letters.flatMap((selected) =>
      letters.map((correct) => [selected, correct] as const),
    ),
  )(
    "labels saved choice %s and correct answer %s without editing",
    async (selected, correct) => {
      const saved = fixture(1, selected === correct ? [1] : []);
      saved.questions[0].selected_option = selected;
      saved.questions[0].correct_option = correct;
      vi.mocked(api.results).mockResolvedValue(saved);
      open();
      await screen.findByRole("heading", { name: "Question review" });
      const card = cards()[0],
        rows = within(card).getAllByRole("listitem");
      expect(rows).toHaveLength(4);
      expect(
        within(rows[letters.indexOf(selected)]).getByText("Your answer"),
      ).toBeInTheDocument();
      expect(
        within(rows[letters.indexOf(correct)]).getByText("Correct answer"),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(selected === correct ? "Correct" : "Incorrect"),
      ).toBeInTheDocument();
      expect(
        within(card).getByText(
          selected === correct ? "1/1 point" : "0/1 point",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("radio")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /submit|save answer/i }),
      ).not.toBeInTheDocument();
      expect(api.saveAnswer).not.toHaveBeenCalled();
      expect(api.submitAttempt).not.toHaveBeenCalled();
      expect(api.generateHint).not.toHaveBeenCalled();
    },
  );
});
