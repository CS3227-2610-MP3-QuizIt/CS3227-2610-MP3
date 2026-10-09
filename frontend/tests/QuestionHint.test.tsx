import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/client";
import { QuestionHint } from "../src/student/QuestionHint";
import { HintStore } from "../src/student/HintStore";
import type { HintTransport } from "../src/student/HintStore";
import { hintState } from "./studentFixtures";

describe("question hint controls", () => {
  let store: HintStore;
  const read = vi.fn<HintTransport["read"]>();
  const generate = vi.fn<HintTransport["generate"]>();
  beforeEach(() => {
    read.mockReset();
    generate.mockReset();
    read.mockResolvedValue(hintState());
    store = new HintStore({ read, generate });
  });
  afterEach(() => store.dispose());
  const open = () =>
    render(
      <QuestionHint
        attemptId={10}
        questionId={1}
        store={store}
        disabled={false}
      />,
    );
  it("caps prompts and uses ensure initially then new for another hint and admitted failure retries", async () => {
    generate.mockResolvedValue(hintState(2, "success"));
    open();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Ask for a hint" }),
      ).toBeEnabled(),
    );
    const prompt = screen.getByLabelText(/Optional hint prompt/);
    expect(prompt).toHaveAttribute("maxlength", "500");
    fireEvent.change(prompt, { target: { value: "Help me reason" } });
    read.mockResolvedValue(hintState(2, "success"));
    fireEvent.click(screen.getByRole("button", { name: "Ask for a hint" }));
    await screen.findByRole("button", { name: "Another hint" });
    expect(generate.mock.calls[0][1]).toEqual({
      action: "ensure",
      prompt: "Help me reason",
    });
    read.mockResolvedValue(hintState(3, "failed"));
    generate.mockResolvedValue(hintState(3, "failed"));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Another hint" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Another hint" }));
    await screen.findByRole("button", { name: "Retry hint" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Retry hint" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry hint" }));
    expect(generate.mock.calls[1][1].action).toBe("new");
    expect(generate.mock.calls[2][1].action).toBe("new");
    expect(generate.mock.calls[2][2]).not.toBe(generate.mock.calls[1][2]);
  });
  it("renders generated markup as escaped text and hides prior content for running and failed targets", async () => {
    read.mockResolvedValue({
      ...hintState(2, "success"),
      result: {
        ...hintState(2, "success").result!,
        hint: '<img src=x onerror="alert(1)">',
      },
    });
    const view = open();
    await screen.findByText('<img src=x onerror="alert(1)">');
    expect(view.container.querySelector("img")).toBeNull();
    read.mockResolvedValue(hintState(3, "in_progress"));
    await act(() => store.reconcile("10:1"));
    expect(
      screen.queryByText('<img src=x onerror="alert(1)">'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
    read.mockResolvedValue(hintState(4, "failed"));
    await act(() => store.reconcile("10:1"));
    expect(screen.getByText(/Hint withheld/)).toBeInTheDocument();
    expect(
      screen.queryByText('<img src=x onerror="alert(1)">'),
    ).not.toBeInTheDocument();
  });
  it("retains previous success on rate rejection and displays backend allowance rejection without a made-up count", async () => {
    read.mockResolvedValue(hintState(2, "success"));
    generate
      .mockRejectedValueOnce(
        new ApiError(429, {
          code: "AI_APP_RATE_LIMIT",
          message: "Limit",
          retry_after_seconds: 9,
        }),
      )
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: "HINT_LIMIT_REACHED",
          message: "Successful hint allowance reached.",
        }),
      );
    open();
    await screen.findByText("Consider the concept.");
    fireEvent.click(screen.getByRole("button", { name: "Another hint" }));
    await screen.findByText(/9 seconds/);
    expect(screen.getByText("Consider the concept.")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Another hint" }),
      ).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Another hint" }));
    await screen.findByText("Successful hint allowance reached.");
    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
  });
  it("preserves uncertain input/key when the user explicitly repeats", async () => {
    generate
      .mockRejectedValueOnce(
        new ApiError(0, { code: "NETWORK_ERROR", message: "Uncertain" }),
      )
      .mockResolvedValue(hintState());
    open();
    await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Optional hint prompt/), {
      target: { value: "Original prompt" },
    });
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("button", { name: "Repeat previous request" });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Repeat previous request" }),
      ).toBeEnabled(),
    );
    expect(screen.getByLabelText(/Optional hint prompt/)).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Repeat previous request" }),
    );
    expect(generate.mock.calls[1][1]).toEqual(generate.mock.calls[0][1]);
    expect(generate.mock.calls[1][2]).toBe(generate.mock.calls[0][2]);
  });
});
