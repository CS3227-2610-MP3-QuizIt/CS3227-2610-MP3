import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { api, SESSION_LOST } from "../src/api/client";
import {
  deferred,
  hintState,
  studentAttempt,
  studentQuiz,
} from "./studentFixtures";
import type { HintState } from "../src/api/types";

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
    expect(calls.indexOf("subscribe")).toBeLessThan(calls.indexOf("read"));
    expect(sources[0].options.withCredentials).toBe(true);
    expect(sources[0].url).toBe("/api/v1/ai/events");
  });
  it("reads only the scoped target on SSE and recovers on reconnect, focus and online", async () => {
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
    await screen.findByText("Consider the concept.");
    expect(api.hint).toHaveBeenCalledTimes(count + 1);
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
  it("cleans session state on expiry and suppresses late reads in a later session", async () => {
    const late = deferred<HintState>();
    vi.mocked(api.hint).mockReturnValue(late.promise);
    render(<App />);
    await screen.findByText("Question 1?");
    const signal = vi.mocked(api.hint).mock.calls[0][2]!;
    act(() => window.dispatchEvent(new Event(SESSION_LOST)));
    await screen.findByRole("button", { name: "Sign in" });
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
    await screen.findByText("Question 1?");
    expect(sources).toHaveLength(2);
    await act(async () => late.resolve(hintState(2, "success")));
    expect(screen.queryByText("Consider the concept.")).not.toBeInTheDocument();
    expect(sources[1].close).not.toHaveBeenCalled();
  });
  it("closes SSE on logout", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Question 1?");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("button", { name: "Sign in" });
    expect(api.logout).toHaveBeenCalledOnce();
    expect(sources[0].close).toHaveBeenCalledOnce();
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
