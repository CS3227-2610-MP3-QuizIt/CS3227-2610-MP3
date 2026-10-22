import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../src/api/client";
import type { SavedAnswer } from "../src/api/types";
import { HintStore } from "../src/student/HintStore";
import type { HintTransport } from "../src/student/HintStore";
import { QuizList } from "../src/student/QuizList";
import { QuizPage } from "../src/student/QuizPage";
import {
  assignment,
  deferred,
  hintState,
  results,
  studentAttempt,
  studentQuiz,
} from "./studentFixtures";

describe("student workspace", () => {
  let store: HintStore;
  const read = vi.fn<HintTransport["read"]>();
  const generate = vi.fn<HintTransport["generate"]>();
  beforeEach(() => {
    read.mockReset();
    generate.mockReset();
    read.mockImplementation(async (key) => {
      const [attempt, question] = key.split(":").map(Number);
      return hintState(0, "not_requested", attempt, question);
    });
    store = new HintStore({ read, generate });
    vi.spyOn(api, "studentQuiz").mockResolvedValue(studentQuiz());
    vi.spyOn(api, "startAttempt").mockResolvedValue(studentAttempt());
    vi.spyOn(api, "attempt").mockResolvedValue(studentAttempt());
    vi.spyOn(api, "saveAnswer").mockImplementation(
      async (_id, question_id, selected_option) => ({
        question_id,
        selected_option,
        updated_at: "now",
      }),
    );
    vi.spyOn(api, "submitAttempt").mockResolvedValue(results());
    vi.spyOn(api, "results").mockResolvedValue(results());
  });
  afterEach(() => store.dispose());
  const open = () => render(<QuizPage id={1} store={store} />);
  it("uses assigned quizzes directly and exposes Start, Resume, and View results", async () => {
    vi.spyOn(api, "studentQuizzes").mockResolvedValue({
      items: [
        assignment("not_started", 1),
        assignment("in_progress", 2),
        assignment("submitted", 3),
      ],
    });
    const classes = vi.spyOn(api, "classes");
    render(<QuizList />);
    expect(
      await screen.findByRole("link", { name: "Start: Practice 1" }),
    ).toHaveAttribute("href", "#/student/attempt/1");
    expect(
      screen.getByRole("link", { name: "Resume: Practice 2" }),
    ).toHaveAttribute("href", "#/student/attempt/2");
    await userEvent.setup().click(screen.getByRole("tab", { name: /All/ }));
    expect(
      screen.getByRole("link", { name: "View results: Practice 3" }),
    ).toHaveAttribute("href", "#/student/results/3");
    expect(classes).not.toHaveBeenCalled();
  });
  it("filters the complete collection by status, search, and class ID with in-progress items first", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "studentQuizzes").mockResolvedValue({
      items: [
        {
          ...assignment("not_started", 1),
          class_id: 11,
          class_name: "Science",
        },
        {
          ...assignment("in_progress", 2),
          class_id: 22,
          class_name: "Science",
        },
        {
          ...assignment("submitted", 3),
          class_id: 11,
          class_name: "Science",
          score: 0,
        },
        {
          ...assignment("in_progress", 4),
          class_id: 33,
          class_name: "History",
        },
      ],
    });
    render(<QuizList />);
    await screen.findByRole("link", { name: "Resume: Practice 2" });
    expect(
      screen
        .getAllByRole("link", { name: /^(Start|Resume):/ })
        .map((link) => link.textContent),
    ).toEqual(["Resume", "Resume", "Start"]);
    expect(screen.getByRole("tab", { name: /To do/ })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /Submitted/ })).toHaveTextContent(
      "1",
    );
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("4");
    expect(
      screen.getByRole("option", { name: "Science (class 11)" }),
    ).toHaveValue("11");
    expect(
      screen.getByRole("option", { name: "Science (class 22)" }),
    ).toHaveValue("22");

    await user.click(screen.getByRole("tab", { name: /Submitted/ }));
    expect(
      screen.getByRole("link", { name: "View results: Practice 3" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Score 0 / 2")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Class"), "11");
    await user.clear(screen.getByLabelText("Find a quiz"));
    await user.type(screen.getByLabelText("Find a quiz"), " practice 3 ");
    expect(
      screen.getByRole("link", { name: "View results: Practice 3" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Practice 2/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(
      screen.getByRole("link", { name: "View results: Practice 3" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("tab", { name: /To do/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.selectOptions(screen.getByLabelText("Class"), "22");
    expect(
      screen.getByRole("link", { name: "Resume: Practice 2" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Start: Practice 1" }),
    ).not.toBeInTheDocument();
  });
  it("keeps tabs and unknown counts before success, and shows recoverable selected-empty states", async () => {
    const user = userEvent.setup();
    const response = deferred<{ items: ReturnType<typeof assignment>[] }>();
    vi.spyOn(api, "studentQuizzes").mockReturnValue(response.promise);
    render(<QuizList />);
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("—");
    expect(screen.getByRole("tab", { name: /To do/ })).toBeInTheDocument();
    await act(async () =>
      response.resolve({ items: [assignment("submitted")] }),
    );
    await user.click(screen.getByRole("tab", { name: /To do/ }));
    expect(screen.getByText("No to do quizzes")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All/ })).toHaveTextContent("1");
  });
  it("preserves loaded cards after a failed refresh and resets a class removed by a successful refresh", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "studentQuizzes")
      .mockResolvedValueOnce({ items: [assignment("not_started", 1)] })
      .mockRejectedValueOnce(new Error("Refresh offline"))
      .mockResolvedValueOnce({
        items: [{ ...assignment("not_started", 1), class_id: 2 }],
      });
    render(<QuizList />);
    await screen.findByRole("link", { name: "Start: Practice 1" });
    await user.selectOptions(screen.getByLabelText("Class"), "1");
    await user.click(screen.getByRole("button", { name: "Refresh quizzes" }));
    await screen.findByText("Refresh offline");
    expect(
      screen.getByRole("link", { name: "Start: Practice 1" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Class")).toHaveValue("all"),
    );
    expect(screen.getByRole("tab", { name: /To do/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("keeps submitted scores private to submitted cards and renders unavailable values clearly", async () => {
    vi.spyOn(api, "studentQuizzes").mockResolvedValue({
      items: [
        { ...assignment("not_started", 1), score: 9 },
        { ...assignment("submitted", 2), score: null, question_count: 1 },
      ],
    });
    render(<QuizList />);
    await screen.findByRole("link", { name: "Start: Practice 1" });
    expect(screen.queryByText("9")).not.toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("tab", { name: /Submitted/ }));
    expect(screen.getByLabelText("Score unavailable")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toHaveClass(
      "student-score-unavailable",
    );
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent?.includes("1 question") === true,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View results: Practice 2" }),
    ).toHaveClass("button-secondary");
  });
  it("supports quiz list loading, errors, refresh and empty state", async () => {
    vi.spyOn(api, "studentQuizzes")
      .mockRejectedValueOnce(new Error("List offline"))
      .mockResolvedValue({ items: [] });
    render(<QuizList />);
    expect(screen.getByText("Loading assigned quizzes…")).toBeInTheDocument();
    await screen.findByText("List offline");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("No quizzes yet");
  });
  it("starts/resumes, restores answers, renders four radios per question and withholds results", async () => {
    open();
    expect(
      await screen.findByRole("radio", { name: "B Beta 1" }),
    ).toBeChecked();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(api.startAttempt).toHaveBeenCalledWith(1, expect.any(AbortSignal));
    expect(api.results).not.toHaveBeenCalled();
    expect(screen.queryByText("Explanation 1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit quiz" })).toBeDisabled();
  });
  it("preserves a failed selection and explicitly retries it without submitting", async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveAnswer).mockRejectedValueOnce(new Error("Save offline"));
    open();
    await user.click(await screen.findByRole("radio", { name: "A Alpha 2" }));
    await screen.findByText("Save failed");
    expect(screen.getByRole("radio", { name: "A Alpha 2" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Submit quiz" }));
    await screen.findByText("Retry failed answer saves before submitting.");
    expect(api.submitAttempt).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(screen.getAllByText("Saved")).toHaveLength(2));
    expect(api.saveAnswer).toHaveBeenLastCalledWith(
      10,
      2,
      "A",
      expect.any(AbortSignal),
    );
  });
  it("freezes only the saving question, waits for saves on submit, then shows immutable authoritative results", async () => {
    const user = userEvent.setup();
    const save = deferred<SavedAnswer>();
    vi.mocked(api.saveAnswer).mockReturnValue(save.promise);
    open();
    await user.click(await screen.findByRole("radio", { name: "B Beta 2" }));
    expect(screen.getByRole("radio", { name: "A Alpha 2" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "A Alpha 1" })).toBeEnabled();
    expect(api.results).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Submit quiz" }));
    expect(screen.getByRole("radio", { name: "A Alpha 1" })).toBeDisabled();
    expect(api.submitAttempt).not.toHaveBeenCalled();
    await act(async () =>
      save.resolve({ question_id: 2, selected_option: "B", updated_at: "now" }),
    );
    await screen.findByText("50.00%");
    expect(api.submitAttempt).toHaveBeenCalledOnce();
    expect(api.results).toHaveBeenCalledWith(10, expect.any(AbortSignal));
    expect(screen.getByText("Explanation 1")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Submit quiz" }),
    ).not.toBeInTheDocument();
  });
  it("opens submitted attempts without starting and guards direct results links before submission", async () => {
    const view = render(<QuizPage id={1} store={store} resultsOnly />);
    await screen.findByText("Question 1?");
    expect(api.results).not.toHaveBeenCalled();
    expect(api.startAttempt).not.toHaveBeenCalled();
    view.unmount();
    vi.mocked(api.attempt).mockResolvedValue({
      ...studentAttempt(),
      status: "submitted",
    });
    vi.mocked(api.studentQuiz).mockResolvedValue({
      ...studentQuiz(),
      attempt_status: "submitted",
    });
    render(<QuizPage id={1} store={store} />);
    await screen.findByText("50.00%");
    expect(api.startAttempt).not.toHaveBeenCalled();
  });
  it("reconciles an uncertain committed submission before restoring controls", async () => {
    vi.mocked(api.startAttempt).mockResolvedValue({
      ...studentAttempt(),
      answers: [1, 2].map((question_id) => ({
        question_id,
        selected_option: "B",
        updated_at: "now",
      })),
    });
    vi.mocked(api.submitAttempt).mockRejectedValue(
      new ApiError(0, { code: "NETWORK_ERROR", message: "Uncertain submit" }),
    );
    const confirmation = deferred<ReturnType<typeof studentAttempt>>();
    vi.mocked(api.attempt).mockReturnValue(confirmation.promise);
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Submit quiz" }));
    await waitFor(() => expect(api.attempt).toHaveBeenCalledOnce());
    expect(screen.getByRole("radio", { name: "A Alpha 1" })).toBeDisabled();
    expect(api.results).not.toHaveBeenCalled();
    await act(async () =>
      confirmation.resolve({ ...studentAttempt(), status: "submitted" }),
    );
    await screen.findByText("50.00%");
  });
  it("keeps editing locked when submission reconciliation fails and permits a state read retry", async () => {
    vi.mocked(api.startAttempt).mockResolvedValue({
      ...studentAttempt(),
      answers: [1, 2].map((question_id) => ({
        question_id,
        selected_option: "B",
        updated_at: "now",
      })),
    });
    vi.mocked(api.submitAttempt).mockRejectedValue(
      new Error("Submission conflict"),
    );
    vi.mocked(api.attempt)
      .mockRejectedValueOnce(new Error("Read offline"))
      .mockResolvedValue(studentAttempt());
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Submit quiz" }));
    await screen.findByText(/Unable to confirm submission/);
    expect(screen.getByRole("radio", { name: "A Alpha 1" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check submission" }));
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "A Alpha 1" })).toBeEnabled(),
    );
    expect(api.submitAttempt).toHaveBeenCalledOnce();
  });
  it("keeps ordinary quiz work available during running and failed hints", async () => {
    read.mockImplementation(async (key) =>
      hintState(
        1,
        key.endsWith(":1") ? "in_progress" : "failed",
        10,
        Number(key.split(":")[1]),
      ),
    );
    const user = userEvent.setup();
    open();
    await screen.findByText(
      "Preparing your hint… The active request keeps its original prompt.",
    );
    await user.click(screen.getByRole("radio", { name: "B Beta 2" }));
    await user.click(screen.getByRole("button", { name: "Submit quiz" }));
    await screen.findByText("50.00%");
  });
  it("stops submission when a pending save fails and preserves the selection", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(api.saveAnswer).mockReturnValue(
      new Promise((_, no) => {
        reject = no;
      }),
    );
    open();
    fireEvent.click(await screen.findByRole("radio", { name: "A Alpha 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit quiz" }));
    await act(async () => reject(new Error("Pending save failed")));
    await screen.findByText("Retry failed answer saves before submitting.");
    expect(screen.getByRole("radio", { name: "A Alpha 2" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "B Beta 2" })).toBeEnabled();
    expect(api.submitAttempt).not.toHaveBeenCalled();
    expect(api.results).not.toHaveBeenCalled();
  });
  it("allows saving and submission when initial hint reads are offline", async () => {
    read.mockRejectedValue(new Error("Hints offline"));
    open();
    await screen.findAllByText("Hints offline");
    fireEvent.click(screen.getByRole("radio", { name: "B Beta 2" }));
    await waitFor(() => expect(screen.getAllByText("Saved")).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Submit quiz" }));
    await screen.findByText("50.00%");
    expect(generate).not.toHaveBeenCalled();
  });
  it("does not let a late answer save update another quiz", async () => {
    const late = deferred<SavedAnswer>();
    vi.mocked(api.saveAnswer).mockReturnValue(late.promise);
    const view = open();
    fireEvent.click(await screen.findByRole("radio", { name: "A Alpha 2" }));
    const signal = vi.mocked(api.saveAnswer).mock.calls[0][3]!;
    vi.mocked(api.studentQuiz).mockResolvedValue(studentQuiz(2));
    vi.mocked(api.startAttempt).mockResolvedValue(studentAttempt(20));
    view.rerender(<QuizPage key={2} id={2} store={store} />);
    await screen.findByText("Practice 2");
    expect(signal.aborted).toBe(true);
    await act(async () =>
      late.resolve({ question_id: 2, selected_option: "A", updated_at: "now" }),
    );
    expect(screen.getByRole("radio", { name: "A Alpha 2" })).not.toBeChecked();
    expect(api.results).not.toHaveBeenCalled();
  });
});
