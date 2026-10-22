import { StrictMode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { api, SESSION_LOST } from "../src/api/client";
import {
  deferred,
  hintState,
  results,
  studentAttempt,
  studentQuiz,
} from "./studentFixtures";
import type { HintState, StudentResults } from "../src/api/types";

describe("student session and SSE", () => {
  let sources: FakeSource[];
  let calls: string[];
  class FakeSource extends EventTarget {
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;
    close = vi.fn();
    constructor(
      public url: string,
      public options: EventSourceInit,
    ) {
      super();
      sources.push(this);
      calls.push("subscribe");
    }
  }
  beforeEach(() => {
    sources = [];
    calls = [];
    document.title = "Workspace title";
    vi.stubGlobal("EventSource", FakeSource);
    window.location.hash = "/student/attempt/1";
    vi.spyOn(api, "me").mockResolvedValue({
      id: 3,
      username: "student",
      display_name: "Demo Student",
      role: "student",
    });
    vi.spyOn(api, "studentQuiz").mockResolvedValue(studentQuiz());
    vi.spyOn(api, "startAttempt").mockResolvedValue(studentAttempt());
    vi.spyOn(api, "hint").mockImplementation(async (attempt, question) => {
      calls.push("read");
      return hintState(0, "not_requested", attempt, question);
    });
    vi.spyOn(api, "logout").mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("routes students into their workspace and subscribes with cookies before initial hint reads", async () => {
    render(<App />);
    await screen.findByText("Question 1?");
    expect(
      screen.getByRole("navigation", { name: "Student navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "QuizIt student home" }),
    ).toHaveAttribute("href", "#/student/quizzes");
    expect(screen.getByText("QuizIt")).toBeInTheDocument();
    await waitFor(() => expect(calls).toContain("read"));
    expect(calls.indexOf("subscribe")).toBeLessThan(calls.indexOf("read"));
    expect(sources[0].options.withCredentials).toBe(true);
    expect(sources[0].url).toBe("/api/v1/ai/events");
  });
  it("reads only the scoped target on SSE and recovers on reconnect, focus and online", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Question 1?");
    vi.mocked(api.hint).mockResolvedValue(hintState(2, "success"));
    const count = vi.mocked(api.hint).mock.calls.length;
    act(() =>
      sources[0].dispatchEvent(
        new MessageEvent("ai_state_changed", {
          data: JSON.stringify({
            feature: "hint",
            quiz_id: 1,
            attempt_id: 10,
            question_id: 1,
            version: 2,
            result: "FORGED CONTENT",
            error: "FORGED CONTENT",
          }),
        }),
      ),
    );
    const toggle = await screen.findByRole("button", { name: "Your hint" });
    expect(api.hint).toHaveBeenCalledTimes(count + 1);
    await user.click(toggle);
    expect(
      await screen.findByText("Consider the concept."),
    ).toBeInTheDocument();
    expect(screen.queryByText("FORGED CONTENT")).not.toBeInTheDocument();
    for (const recover of [
      () => sources[0].onopen?.(),
      () => window.dispatchEvent(new Event("focus")),
      () => window.dispatchEvent(new Event("online")),
    ]) {
      const before = vi.mocked(api.hint).mock.calls.length;
      act(recover);
      await waitFor(() =>
        expect(vi.mocked(api.hint).mock.calls.length).toBeGreaterThan(before),
      );
    }
  });
  it("shows known loss when a protected request requires authentication for a confirmed user", async () => {
    render(<App />);
    await screen.findByText("Question 1?");
    act(() => {
      window.dispatchEvent(
        new CustomEvent(SESSION_LOST, { detail: "AUTH_REQUIRED" }),
      );
    });
    expect(
      await screen.findByText(
        "Your session has ended. Sign in again to continue.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("cleans session state on expiry and suppresses late reads in a later session", async () => {
    const late = deferred<HintState>();
    vi.mocked(api.hint).mockReturnValue(late.promise);
    render(<App />);
    await screen.findByText("Question 1?");
    await waitFor(() => expect(api.hint).toHaveBeenCalled());
    fireEvent.click(
      screen.getAllByRole("button", { name: "Mark for review" })[0],
    );
    expect(screen.getByRole("button", { name: "Review marked" })).toBeEnabled();
    const signal = vi.mocked(api.hint).mock.calls[0][2]!;
    act(() => window.dispatchEvent(new Event(SESSION_LOST)));
    await screen.findByRole("button", { name: "Sign in" });
    expect(document.title).toBe("Sign in · QuizIt");
    expect(sources[0].close).toHaveBeenCalledOnce();
    expect(signal.aborted).toBe(true);
    const count = vi.mocked(api.hint).mock.calls.length;
    act(() => window.dispatchEvent(new Event("online")));
    expect(api.hint).toHaveBeenCalledTimes(count);
    const identity = {
      id: 4,
      username: "new-student",
      display_name: "New Student",
      role: "student" as const,
    };
    vi.spyOn(api, "login").mockResolvedValue({ user: identity });
    vi.mocked(api.me).mockResolvedValue(identity);
    vi.mocked(api.studentQuiz).mockResolvedValue({
      ...studentQuiz(),
      attempt_id: 40,
    });
    vi.mocked(api.startAttempt).mockResolvedValue({
      ...studentAttempt(40),
      quiz_id: 1,
    });
    vi.mocked(api.hint).mockImplementation(async (attempt, question) => ({
      ...hintState(0, "not_requested", attempt, question),
    }));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "new-student");
    await user.type(screen.getByLabelText("Password"), "test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText("New Student");
    expect(document.title).toBe("Workspace title");
    await screen.findByText("Question 1?");
    expect(
      screen.getByRole("button", { name: "Review marked" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "⚑ Unmark review" }),
    ).not.toBeInTheDocument();
    expect(sources).toHaveLength(2);
    await act(async () => late.resolve(hintState(2, "success")));
    expect(
      screen.queryByRole("button", { name: "Your hint" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Consider the concept.")).not.toBeInTheDocument();
    expect(sources[1].close).not.toHaveBeenCalled();
  });
  it("clears loaded answer keys and disclosures on session loss", async () => {
    window.location.hash = "/student/results/1";
    vi.mocked(api.studentQuiz).mockResolvedValue({
      ...studentQuiz(),
      attempt_status: "submitted",
    });
    vi.spyOn(api, "attempt").mockResolvedValue({
      ...studentAttempt(),
      status: "submitted",
    });
    vi.spyOn(api, "results").mockResolvedValue(results());
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      await screen.findByRole("button", { name: "Explanation for question 1" }),
    );
    expect(screen.getByText("Explanation 1")).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event(SESSION_LOST)));
    await screen.findByRole("button", { name: "Sign in" });
    expect(screen.queryByText("Explanation 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(sources[0].close).toHaveBeenCalledOnce();
  });
  it("suppresses a late answer-key response in a later student session", async () => {
    window.location.hash = "/student/results/1";
    vi.mocked(api.studentQuiz).mockResolvedValue({
      ...studentQuiz(),
      attempt_status: "submitted",
    });
    vi.spyOn(api, "attempt").mockResolvedValue({
      ...studentAttempt(),
      status: "submitted",
    });
    const late = deferred<StudentResults>();
    vi.spyOn(api, "results").mockReturnValueOnce(late.promise);
    render(<App />);
    await waitFor(() => expect(api.results).toHaveBeenCalledOnce());
    const signal = vi.mocked(api.results).mock.calls[0][1]!;
    act(() => window.dispatchEvent(new Event(SESSION_LOST)));
    await screen.findByRole("button", { name: "Sign in" });
    expect(signal.aborted).toBe(true);
    const identity = {
      id: 4,
      username: "next-student",
      display_name: "Next Student",
      role: "student" as const,
    };
    vi.spyOn(api, "login").mockResolvedValue({ user: identity });
    vi.mocked(api.me).mockResolvedValue(identity);
    vi.mocked(api.studentQuiz).mockResolvedValue({
      ...studentQuiz(),
      attempt_id: 40,
      attempt_status: "submitted",
    });
    vi.mocked(api.attempt).mockResolvedValue({
      ...studentAttempt(40),
      status: "submitted",
    });
    const next = results(40);
    next.score = 2;
    next.score_percent = 100;
    next.questions = next.questions.map((question) => ({
      ...question,
      explanation: "New session saved explanation",
    }));
    vi.mocked(api.results).mockResolvedValue(next);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Username"), "next-student");
    await user.type(screen.getByLabelText("Password"), "test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent === "Score for this quiz: 2 out of 2",
    );
    await act(async () => late.resolve(results()));
    expect(
      screen.queryByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "Score for this quiz: 1 out of 2",
      ),
    ).not.toBeInTheDocument();
    const disclosure = screen.getByRole("button", {
      name: "Explanation for question 1",
    });
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await user.click(disclosure);
    expect(
      screen.getByText("New session saved explanation"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Explanation 1")).not.toBeInTheDocument();
  });
  it("closes SSE on logout", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Question 1?");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("button", { name: "Sign in" });
    expect(document.title).toBe("Sign in · QuizIt");
    expect(api.logout).toHaveBeenCalledOnce();
    expect(sources[0].close).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("Your session has ended. Sign in again to continue."),
    ).not.toBeInTheDocument();
  });
  it("keeps deliberate logout quiet when a session-loss event races a failed logout", async () => {
    vi.mocked(api.logout).mockImplementationOnce(async () => {
      window.dispatchEvent(
        new CustomEvent(SESSION_LOST, { detail: "SESSION_EXPIRED" }),
      );
      throw new Error("Logout unavailable");
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Question 1?");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Logout unavailable")).toBeInTheDocument();
    expect(screen.getByText("Question 1?")).toBeInTheDocument();
    expect(
      screen.queryByText("Your session has ended. Sign in again to continue."),
    ).not.toBeInTheDocument();
    expect(sources[0].close).not.toHaveBeenCalled();
  });
  it("creates a fresh usable store after StrictMode cleanup", async () => {
    const view = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await screen.findByText("Question 1?");
    await waitFor(() => expect(api.hint).toHaveBeenCalled());
    expect(sources.length).toBeGreaterThan(1);
    expect(sources[0].close).toHaveBeenCalledOnce();
    expect(sources.at(-1)!.close).not.toHaveBeenCalled();
    view.unmount();
    expect(sources.at(-1)!.close).toHaveBeenCalledOnce();
  });
});
