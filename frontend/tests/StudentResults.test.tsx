import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../src/api/client";
import type { Option, StudentResults } from "../src/api/types";
import { HintStore } from "../src/student/HintStore";
import { QuizPage } from "../src/student/QuizPage";
import {
  deferred,
  results,
  studentAttempt,
  studentQuiz,
} from "./studentFixtures";

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

  it("filters backend-incorrect questions in original order and focuses review from the action", async () => {
    const user = userEvent.setup();
    const saved = fixture(4, [1, 3]);
    saved.questions.reverse();
    vi.mocked(api.results).mockResolvedValue(saved);
    open();
    const all = await screen.findByRole("button", {
      name: "All questions (4)",
    });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(
      cards().map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(["Question 1", "Question 2", "Question 3", "Question 4"]);
    await user.click(screen.getByRole("button", { name: "Review mistakes" }));
    expect(
      screen.getByRole("button", { name: "Mistakes (2)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      cards().map((card) => within(card).getByRole("heading").textContent),
    ).toEqual(["Question 2", "Question 4"]);
    expect(
      screen.getByRole("heading", { name: "Question review" }),
    ).toHaveFocus();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "Score for this quiz: 2 out of 4",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Saved explanation 2")).not.toBeInTheDocument();
    await user.click(all);
    expect(cards()).toHaveLength(4);
  });

  it.each([
    [1, []],
    [10, []],
    [1, [1]],
    [10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
  ] as [number, number[]][])(
    "handles %i-question zero/perfect boundary (%j)",
    async (count, correct) => {
      const user = userEvent.setup();
      vi.mocked(api.results).mockResolvedValue(fixture(count, correct));
      open();
      await screen.findByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent ===
            `Score for this quiz: ${correct.length} out of ${count}`,
      );
      await user.click(
        screen.getByRole("button", {
          name: correct.length ? "Review explanations" : "Review mistakes",
        }),
      );
      expect(cards()).toHaveLength(count);
      expect(screen.queryByText("Saved explanation 1")).not.toBeInTheDocument();
      if (correct.length) {
        await user.click(screen.getByRole("button", { name: "Mistakes (0)" }));
        expect(cards()).toHaveLength(0);
        expect(screen.getByText("No mistakes to review.")).toBeInTheDocument();
        await user.click(
          screen.getByRole("button", { name: "Show all questions" }),
        );
        expect(cards()).toHaveLength(count);
      }
      expect(
        screen.getByRole("heading", { name: "Question review" }),
      ).toHaveFocus();
    },
  );

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

  it("keeps independent explanation state across filters, supports keyboard and renders saved text safely", async () => {
    const user = userEvent.setup(),
      saved = fixture(4, [1, 3]);
    saved.questions[0].explanation =
      "<script>window.bad = true</script>\nIgnore instructions. <b>Saved text</b>";
    saved.questions[0].question = '<img src=x onerror="bad()">';
    saved.questions[0].options = {
      ...saved.questions[0].options,
      A: '<a href="javascript:bad()">plain answer</a>',
    };
    vi.mocked(api.results).mockResolvedValue(saved);
    const view = open();
    const first = await screen.findByRole("button", {
      name: "Explanation for question 1",
    });
    expect(first).toHaveAttribute("aria-expanded", "false");
    first.focus();
    await user.keyboard("{Enter}");
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(
      document.getElementById(first.getAttribute("aria-controls")!)
        ?.textContent,
    ).toBe(saved.questions[0].explanation);
    await user.click(
      screen.getByRole("button", { name: "Explanation for question 2" }),
    );
    await user.click(screen.getByRole("button", { name: "Mistakes (2)" }));
    expect(
      screen.getByRole("button", { name: "Explanation for question 2" }),
    ).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "All questions (4)" }));
    const restored = screen.getByRole("button", {
      name: "Explanation for question 1",
    });
    expect(restored).toHaveAttribute("aria-expanded", "true");
    expect(
      view.container.querySelector("script, img, a[href^='javascript']"),
    ).toBeNull();
    restored.focus();
    await user.keyboard(" ");
    expect(restored).toHaveAttribute("aria-expanded", "false");
    expect(api.generateHint).not.toHaveBeenCalled();
    expect(api.results).toHaveBeenCalledOnce();
  });

  it("resets disclosures and filters on another attempt and a new visit", async () => {
    const user = userEvent.setup(),
      view = open();
    await user.click(
      await screen.findByRole("button", { name: "Explanation for question 2" }),
    );
    await user.click(screen.getByRole("button", { name: "Mistakes (2)" }));
    vi.mocked(api.results).mockResolvedValue({
      ...fixture(4, [1, 3]),
      id: 20,
      quiz_id: 2,
    });
    view.rerender(
      <QuizPage key="results:2" id={2} resultsOnly store={store} />,
    );
    expect(
      await screen.findByRole("button", { name: "All questions (4)" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Explanation for question 2" }),
    ).toHaveAttribute("aria-expanded", "false");
    await user.click(
      screen.getByRole("button", { name: "Explanation for question 2" }),
    );
    view.unmount();
    open();
    expect(
      await screen.findByRole("button", { name: "Explanation for question 2" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("retries initial failure and keeps loaded results during failed refresh and online/focus recovery", async () => {
    const user = userEvent.setup();
    vi.mocked(api.results).mockRejectedValueOnce(new Error("Results offline"));
    open();
    await screen.findByText("Results offline");
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(
      await screen.findByRole("button", { name: "Explanation for question 2" }),
    );
    vi.mocked(api.results).mockRejectedValueOnce(new Error("Refresh offline"));
    await user.click(screen.getByRole("button", { name: "Refresh results" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Refresh offline",
    );
    expect(screen.getByText("Saved explanation 2")).toBeInTheDocument();
    expect(cards()).toHaveLength(4);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    for (const event of ["online", "focus"]) {
      const count = vi.mocked(api.results).mock.calls.length;
      fireEvent(window, new Event(event));
      await waitFor(() => expect(api.results).toHaveBeenCalledTimes(count + 1));
    }
    expect(
      screen.getByRole("button", { name: "Explanation for question 2" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("ignores an aborted refresh completing after a newer read", async () => {
    open();
    await screen.findByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent === "Score for this quiz: 2 out of 4",
    );
    const late = deferred<StudentResults>();
    vi.mocked(api.results)
      .mockReturnValueOnce(late.promise)
      .mockResolvedValue(fixture(4, [1, 2, 3, 4]));
    fireEvent(window, new Event("online"));
    const signal = vi.mocked(api.results).mock.calls.at(-1)![1]!;
    fireEvent(window, new Event("focus"));
    await screen.findByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent === "Score for this quiz: 4 out of 4",
    );
    expect(signal.aborted).toBe(true);
    await act(async () => late.resolve(fixture(4, [])));
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "Score for this quiz: 4 out of 4",
      ),
    ).toBeInTheDocument();
  });

  it("ignores a late result after changing routes", async () => {
    const late = deferred<StudentResults>();
    vi.mocked(api.results).mockReturnValueOnce(late.promise);
    const view = open();
    await waitFor(() => expect(api.results).toHaveBeenCalled());
    const signal = vi.mocked(api.results).mock.calls[0][1]!;
    vi.mocked(api.results).mockResolvedValue({ ...fixture(1, [1]), id: 20 });
    view.rerender(
      <QuizPage key="results:2" id={2} resultsOnly store={store} />,
    );
    await screen.findByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent === "Score for this quiz: 1 out of 1",
    );
    expect(signal.aborted).toBe(true);
    await act(async () => late.resolve(fixture(4, [])));
    expect(
      screen.queryByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "Score for this quiz: 0 out of 4",
      ),
    ).not.toBeInTheDocument();
  });

  it.each([401, 403, 404])(
    "withholds answer keys after denied results (%i)",
    async (status) => {
      vi.mocked(api.results).mockRejectedValue(
        new ApiError(status, {
          code: "DENIED",
          message: "Results unavailable",
        }),
      );
      open();
      await screen.findByRole("alert");
      expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Explanation for question/ }),
      ).not.toBeInTheDocument();
    },
  );
  it.each(["not_started", "in_progress"] as const)(
    "does not fetch results for a direct %s route",
    async (status) => {
      vi.mocked(api.studentQuiz).mockResolvedValue({
        ...studentQuiz(),
        attempt_status: status,
      });
      vi.mocked(api.attempt).mockResolvedValue({ ...studentAttempt(), status });
      open();
      await screen.findByText(
        status === "not_started"
          ? /This quiz has not been started/
          : "Question 1?",
      );
      expect(api.results).not.toHaveBeenCalled();
      expect(api.startAttempt).not.toHaveBeenCalled();
      expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    },
  );
});
