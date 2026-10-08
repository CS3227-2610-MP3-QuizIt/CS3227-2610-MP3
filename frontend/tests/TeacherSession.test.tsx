import { StrictMode } from "react";
import userEvent from "@testing-library/user-event";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { api, SESSION_LOST } from "../src/api/client";
import { classes, generation, quiz } from "./teacherFixtures";

describe("teacher workspace session and notifications", () => {
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
    window.location.hash = "/teacher/quiz/1";
    vi.spyOn(api, "me").mockResolvedValue({
      id: 2,
      username: "teacher",
      display_name: "Demo Teacher",
      role: "teacher",
    });
    vi.spyOn(api, "classes").mockResolvedValue({ items: classes });
    vi.spyOn(api, "teacherQuizzes").mockResolvedValue({
      items: [{ ...quiz(), class_name: classes[0].name }],
    });
    vi.spyOn(api, "generation").mockImplementation(async () => {
      calls.push("read");
      return generation();
    });
    vi.spyOn(api, "teacherQuiz").mockResolvedValue(quiz());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("routes authenticated teachers to their workspace and opens scoped SSE before initial target reads", async () => {
    const users = vi.spyOn(api, "users");
    render(<App />);
    await screen.findByText("Question in revision 1?");
    expect(
      screen.getByRole("navigation", { name: "Teacher navigation" }),
    ).toBeInTheDocument();
    expect(users).not.toHaveBeenCalled();
    expect(calls.indexOf("subscribe")).toBeLessThan(calls.indexOf("read"));
    expect(sources[0].url).toBe("/api/v1/ai/events");
    expect(sources[0].options.withCredentials).toBe(true);
  });
  it("fetches authoritative state on new metadata, reconnect, focus, and network recovery without rendering event content", async () => {
    render(<App />);
    await screen.findByText("Question in revision 1?");
    vi.mocked(api.generation).mockResolvedValue(
      generation(4, "success", quiz(2)),
    );
    vi.mocked(api.teacherQuiz).mockResolvedValue(quiz(2));
    act(() =>
      sources[0].dispatchEvent(
        new MessageEvent("ai_state_changed", {
          data: JSON.stringify({
            feature: "quiz_generation",
            quiz_id: 1,
            version: 4,
            status: "failed",
            error: "UNTRUSTED EVENT CONTENT",
          }),
        }),
      ),
    );
    await screen.findByText("Question in revision 2?");
    expect(
      screen.queryByText("UNTRUSTED EVENT CONTENT"),
    ).not.toBeInTheDocument();
    const previous = vi.mocked(api.generation).mock.calls.length;
    act(() => sources[0].onopen?.());
    await waitFor(() =>
      expect(api.generation).toHaveBeenCalledTimes(previous + 1),
    );
    await screen.findByRole("button", { name: "Refresh quiz" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh quiz" }),
      ).toBeEnabled(),
    );
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() =>
      expect(api.generation).toHaveBeenCalledTimes(previous + 2),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh quiz" }),
      ).toBeEnabled(),
    );
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() =>
      expect(api.generation).toHaveBeenCalledTimes(previous + 3),
    );
  });
  it("closes SSE and discards teacher state when the session expires", async () => {
    render(<App />);
    await screen.findByText("Question in revision 1?");
    act(() => window.dispatchEvent(new Event(SESSION_LOST)));
    await screen.findByRole("button", { name: "Sign in" });
    expect(sources[0].close).toHaveBeenCalledOnce();
    expect(
      screen.queryByText("Question in revision 1?"),
    ).not.toBeInTheDocument();
    const reads = vi.mocked(api.generation).mock.calls.length;
    act(() => window.dispatchEvent(new Event("online")));
    expect(api.generation).toHaveBeenCalledTimes(reads);
  });
  it("survives StrictMode effect cleanup with a fresh usable store", async () => {
    const { unmount } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await screen.findByText("Question in revision 1?");
    expect(sources.length).toBeGreaterThan(1);
    expect(sources[0].close).toHaveBeenCalledOnce();
    expect(sources.at(-1)?.close).not.toHaveBeenCalled();
    unmount();
    expect(sources.at(-1)?.close).toHaveBeenCalledOnce();
  });
  it("returns to a refreshed quiz list after draft deletion", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "deleteQuiz").mockResolvedValue(undefined);
    render(<App />);
    await screen.findByText("Question in revision 1?");
    const reads = vi.mocked(api.teacherQuizzes).mock.calls.length;
    vi.mocked(api.teacherQuizzes).mockResolvedValue({ items: [] });
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
    await waitFor(() =>
      expect(api.teacherQuizzes).toHaveBeenCalledTimes(reads + 1),
    );
    expect(window.location.hash).toBe("#/teacher/quizzes");
    await waitFor(() =>
      expect(
        screen.queryByText("Question in revision 1?"),
      ).not.toBeInTheDocument(),
    );
  });
});
