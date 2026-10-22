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
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    Element.prototype.scrollIntoView = vi.fn();
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
  afterEach(() => {
    store.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
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
    expect(
      screen.getByRole("link", { name: "View results: Practice 3" }),
    ).toHaveAttribute("href", "#/student/results/3");
    expect(classes).not.toHaveBeenCalled();
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
    expect(
      screen.getAllByRole("button", { name: "Submit quiz" })[0],
    ).toBeDisabled();
  });
  it("preserves a failed selection and explicitly retries it without submitting", async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveAnswer).mockRejectedValueOnce(new Error("Save offline"));
    open();
    await user.click(await screen.findByRole("radio", { name: "A Alpha 2" }));
    await screen.findAllByText("Save failed");
    expect(screen.getByRole("radio", { name: "A Alpha 2" })).toBeChecked();
    await user.click(screen.getAllByRole("button", { name: "Submit quiz" })[0]);
    expect(
      screen.getAllByText(/Retry failed answer saves before submitting/),
    ).toHaveLength(2);
    expect(api.submitAttempt).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Retry save" }));
    await waitFor(() => expect(screen.getAllByText("Saved")).toHaveLength(4));
    expect(
      screen.queryByText(/Retry failed answer saves before submitting/),
    ).not.toBeInTheDocument();
    expect(api.saveAnswer).toHaveBeenLastCalledWith(
      10,
      2,
      "A",
      expect.any(AbortSignal),
    );
  });
  it("blocks submission while saving, then confirms once and shows authoritative results", async () => {
    const user = userEvent.setup();
    const save = deferred<SavedAnswer>();
    vi.mocked(api.saveAnswer).mockReturnValue(save.promise);
    open();
    await user.click(await screen.findByRole("radio", { name: "B Beta 2" }));
    expect(screen.getByRole("radio", { name: "A Alpha 2" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "A Alpha 1" })).toBeEnabled();
    expect(api.results).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole("button", { name: "Submit quiz" })[0]);
    expect(screen.getByRole("radio", { name: "A Alpha 1" })).toBeEnabled();
    expect(
      screen.getAllByRole("button", { name: "Submit quiz" })[0],
    ).toBeDisabled();
    expect(api.submitAttempt).not.toHaveBeenCalled();
    await act(async () =>
      save.resolve({ question_id: 2, selected_option: "B", updated_at: "now" }),
    );
    await user.click(screen.getAllByRole("button", { name: "Submit quiz" })[0]);
    await user.click(
      screen.getByRole("button", { name: "Confirm submission" }),
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
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Submit quiz" }))[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm submission" }));
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
    fireEvent.click(
      (await screen.findAllByRole("button", { name: "Submit quiz" }))[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm submission" }));
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
    await screen.findByRole("button", { name: "Preparing your hint…" });
    expect(
      screen.getByRole("button", { name: "Hint unavailable — try again" }),
    ).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("radio", { name: "B Beta 2" }));
    await user.click(screen.getAllByRole("button", { name: "Submit quiz" })[0]);
    await user.click(
      screen.getByRole("button", { name: "Confirm submission" }),
    );
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
    fireEvent.click(screen.getAllByRole("button", { name: "Submit quiz" })[0]);
    await act(async () => reject(new Error("Pending save failed")));
    expect(
      screen.getAllByText(/Retry failed answer saves before submitting/),
    ).toHaveLength(2);
    expect(screen.getByRole("radio", { name: "A Alpha 2" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "B Beta 2" })).toBeEnabled();
    expect(api.submitAttempt).not.toHaveBeenCalled();
    expect(api.results).not.toHaveBeenCalled();
  });
  it("allows saving and submission when initial hint reads are offline", async () => {
    read.mockRejectedValue(new Error("Hints offline"));
    open();
    const toggles = await screen.findAllByRole("button", {
      name: "Hint unavailable — try again",
    });
    fireEvent.click(toggles[0]);
    await screen.findByText("Hints offline");
    fireEvent.click(screen.getByRole("radio", { name: "B Beta 2" }));
    await waitFor(() => expect(screen.getAllByText("Saved")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("button", { name: "Submit quiz" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm submission" }));
    await screen.findByText("50.00%");
    expect(generate).not.toHaveBeenCalled();
  });
  it("navigates without requests or losing prompts and keeps review marks only until remount", async () => {
    const user = userEvent.setup();
    const view = open();
    await screen.findByText("Question 1?");
    const hintToggles = await screen.findAllByRole("button", {
      name: "Need a hint?",
    });
    await user.click(hintToggles[0]);
    await user.type(screen.getByRole("textbox"), "A conceptual clue");
    await user.click(
      screen.getAllByRole("button", { name: "Mark for review" })[0],
    );
    await user.click(screen.getByRole("button", { name: "Next unanswered" }));
    expect(
      screen.getByRole("heading", { name: "Question 2", exact: true }),
    ).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Review marked" }));
    expect(
      screen.getByRole("heading", { name: "Question 1", exact: true }),
    ).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("A conceptual clue");
    await user.click(hintToggles[0]);
    expect(hintToggles[0]).toHaveAttribute("aria-expanded", "false");
    await user.click(hintToggles[0]);
    expect(screen.getByRole("textbox")).toHaveValue("A conceptual clue");
    expect(
      screen.getByRole("button", {
        name: /Question 1, Saved, Marked for review/,
      }),
    ).toHaveAttribute("aria-current", "step");
    expect(api.saveAnswer).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    view.unmount();
    open();
    await screen.findByText("Question 1?");
    expect(
      screen.getByRole("button", { name: "Review marked" }),
    ).toBeDisabled();
  });
  it("shares saved readiness and confirmation, cancels with focus and guards changed readiness", async () => {
    const user = userEvent.setup();
    open();
    await user.click(await screen.findByRole("radio", { name: "A Alpha 2" }));
    await waitFor(() =>
      screen
        .getAllByRole("button", { name: "Submit quiz" })
        .forEach((button) => expect(button).toBeEnabled()),
    );
    await user.click(
      screen.getAllByRole("button", { name: "Mark for review" })[1],
    );
    const invoke = screen.getAllByRole("button", { name: "Submit quiz" })[1];
    await user.click(invoke);
    expect(api.submitAttempt).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Marked for review: Question 2",
    );
    await user.click(screen.getByRole("button", { name: "Keep reviewing" }));
    expect(invoke).toHaveFocus();
    await user.click(screen.getAllByRole("button", { name: "Submit quiz" })[0]);
    const save = deferred<SavedAnswer>();
    vi.mocked(api.saveAnswer).mockReturnValue(save.promise);
    fireEvent.click(screen.getByRole("radio", { name: "A Alpha 1" }));
    expect(
      screen.getByRole("button", { name: "Confirm submission" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm submission" }));
    expect(api.submitAttempt).not.toHaveBeenCalled();
    await act(async () =>
      save.resolve({ question_id: 1, selected_option: "A", updated_at: "now" }),
    );
    const post = deferred<ReturnType<typeof results>>();
    vi.mocked(api.submitAttempt).mockReturnValue(post.promise);
    const confirm = screen.getByRole("button", { name: "Confirm submission" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.submitAttempt).toHaveBeenCalledOnce();
    await act(async () => post.resolve(results()));
    await screen.findByText("50.00%");
  });
  it("wraps navigation across ten mixed states, tracks manual scrolling and respects reduced motion", async () => {
    const quiz = studentQuiz();
    quiz.questions = Array.from({ length: 10 }, (_, index) => ({
      ...quiz.questions[0],
      id: index + 1,
      position: index + 1,
      question: `Question ${index + 1}?`,
    }));
    quiz.question_count = 10;
    vi.mocked(api.studentQuiz).mockResolvedValue(quiz);
    const save = deferred<SavedAnswer>();
    vi.mocked(api.saveAnswer).mockImplementation(async (_, id, option) => {
      if (id === 2) return save.promise;
      if (id === 3) throw new Error("Offline");
      return { question_id: id, selected_option: option, updated_at: "now" };
    });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    let top = 100;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const id = Number(this.id.split("-").at(-1));
        return {
          top: this.tagName === "H2" ? top + (id - 1) * 500 : 0,
          height: 100,
        } as DOMRect;
      },
    );
    open();
    await screen.findByText("Question 10?");
    fireEvent.click(screen.getAllByRole("radio")[4]);
    fireEvent.click(screen.getAllByRole("radio")[8]);
    await screen.findAllByText("Save failed");
    expect(
      screen.getByRole("button", { name: "Question 1, Saved" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Question 2, Saving" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Question 3, Save failed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 of 10 answered")).toBeInTheDocument();
    expect(
      screen.getAllByText(/7 unanswered.*1 saving.*1 failed/),
    ).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Question 10, Unanswered" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next unanswered" }));
    expect(
      screen.getByRole("heading", { name: "Question 4", exact: true }),
    ).toHaveFocus();
    expect(Element.prototype.scrollIntoView).toHaveBeenLastCalledWith({
      block: "start",
      behavior: "instant",
    });
    top = -2000;
    fireEvent.scroll(window);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Question 5, Unanswered" }),
      ).toHaveAttribute("aria-current", "step"),
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark for review" })[1],
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark for review" })[6],
    );
    fireEvent.click(screen.getByRole("button", { name: "Review marked" }));
    expect(
      screen.getByRole("heading", { name: "Question 8", exact: true }),
    ).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Review marked" }));
    expect(
      screen.getByRole("heading", { name: "Question 2", exact: true }),
    ).toHaveFocus();
    fireEvent.click(
      screen.getAllByRole("button", { name: "⚑ Unmark review" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: "Review marked" }));
    expect(
      screen.getByRole("heading", { name: "Question 8", exact: true }),
    ).toHaveFocus();
    await act(async () =>
      save.resolve({ question_id: 2, selected_option: "A", updated_at: "now" }),
    );
    expect(
      screen.getByRole("button", {
        name: /Question 8, Unanswered, Marked for review/,
      }),
    ).toBeInTheDocument();
    expect(api.saveAnswer).toHaveBeenCalledTimes(2);
    expect(generate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("keeps a single question accessible with native keyboard selection and Escape cancellation", async () => {
    const quiz = studentQuiz();
    quiz.questions = [quiz.questions[0]];
    quiz.question_count = 1;
    vi.mocked(api.studentQuiz).mockResolvedValue(quiz);
    const user = userEvent.setup();
    open();
    const radio = await screen.findByRole("radio", { name: "B Beta 1" });
    expect(
      screen.getByRole("group", { name: "Question 1?" }),
    ).toBeInTheDocument();
    radio.focus();
    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "C Gamma 1" })).toBeChecked(),
    );
    expect(
      screen.getByRole("button", { name: "Next unanswered" }),
    ).toBeDisabled();
    const submit = screen.getAllByRole("button", { name: "Submit quiz" })[0];
    await user.click(submit);
    expect(
      screen.getByRole("button", { name: "Keep reviewing" }),
    ).toHaveFocus();
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: true, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(submit).toHaveFocus();
    expect(api.submitAttempt).not.toHaveBeenCalled();
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
