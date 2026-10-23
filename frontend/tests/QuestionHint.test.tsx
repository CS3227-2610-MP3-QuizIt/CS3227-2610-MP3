import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/client";
import type { HintState, SafeError } from "../src/api/types";
import { QuestionHint } from "../src/student/QuestionHint";
import { HintStore } from "../src/student/HintStore";
import type { HintTransport } from "../src/student/HintStore";
import { deferred, hintState } from "./studentFixtures";

const failedHint = (
  version: number,
  error: SafeError | null,
  attemptId = 10,
  questionId = 1,
): HintState => ({
  ...hintState(version, "failed", attemptId, questionId),
  error,
});

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
  const expand = async () => {
    const view = open();
    const toggle = await screen.findByRole("button", {
      name: /Need a hint\?|Your hint|Preparing your hint|Checking hint state|Hint unavailable|Hint request needs attention/,
    });
    if (toggle.getAttribute("aria-expanded") === "false") {
      fireEvent.click(toggle);
    }
    return view;
  };
  it("starts collapsed for unused hints, toggles with keyboard, and updates collapsed summary as state changes", async () => {
    const user = userEvent.setup();
    render(
      <>
        <QuestionHint
          attemptId={10}
          questionId={1}
          store={store}
          disabled={false}
        />
        <QuestionHint
          attemptId={10}
          questionId={2}
          store={store}
          disabled={false}
        />
      </>,
    );
    const toggles = await screen.findAllByRole("button", {
      name: "Need a hint?",
    });
    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByLabelText(/Optional hint prompt/),
    ).not.toBeInTheDocument();

    toggles[0].focus();
    await user.keyboard("{Enter}");
    expect(toggles[0]).toHaveAttribute("aria-expanded", "true");
    expect(toggles[1]).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText(/Optional hint prompt/)).toBeInTheDocument();

    await user.keyboard(" ");
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByLabelText(/Optional hint prompt/),
    ).not.toBeInTheDocument();

    read.mockImplementation(async (key) =>
      key.endsWith(":1")
        ? hintState(1, "in_progress", 10, 1)
        : hintState(0, "not_requested", 10, 2),
    );
    await act(() => store.reconcile("10:1"));
    expect(
      screen.getByRole("button", { name: "Preparing your hint…" }),
    ).toHaveAttribute("aria-expanded", "false");

    read.mockImplementation(async (key) =>
      key.endsWith(":1")
        ? hintState(2, "success", 10, 1)
        : hintState(0, "not_requested", 10, 2),
    );
    await act(() => store.reconcile("10:1"));
    expect(screen.getByRole("button", { name: "Your hint" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    read.mockImplementation(async (key) =>
      key.endsWith(":1")
        ? hintState(3, "failed", 10, 1)
        : hintState(0, "not_requested", 10, 2),
    );
    await act(() => store.reconcile("10:1"));
    expect(
      screen.getByRole("button", { name: "Hint unavailable — try again" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: "Need a hint?" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(generate).not.toHaveBeenCalled();
  });
  it("caps prompts and uses ensure initially then new with Try again after confirmed failure", async () => {
    generate.mockResolvedValue(hintState(2, "success"));
    await expand();
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
    const retry = await screen.findByRole("button", { name: "Try again" });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(prompt).toBeEnabled();
    fireEvent.change(prompt, {
      target: { value: "Give a broader principle" },
    });
    expect(generate).toHaveBeenCalledTimes(2);
    const pending = deferred<HintState>();
    generate.mockReturnValueOnce(pending.promise);
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(generate).toHaveBeenCalledTimes(3);
    expect(retry).toBeDisabled();
    await act(async () => pending.resolve(hintState(4, "success")));
    expect(generate.mock.calls[1][1].action).toBe("new");
    expect(generate.mock.calls[2][1]).toEqual({
      action: "new",
      prompt: "Give a broader principle",
    });
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
    const view = await expand();
    await screen.findByText('<img src=x onerror="alert(1)">');
    expect(view.container.querySelector("img")).toBeNull();
    read.mockResolvedValue(hintState(3, "in_progress"));
    await act(() => store.reconcile("10:1"));
    expect(
      screen.queryByText('<img src=x onerror="alert(1)">'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ask for a hint" }),
    ).toBeDisabled();
    read.mockResolvedValue(
      failedHint(4, {
        code: "AI_INVALID_OUTPUT",
        message: "Internal diagnostic sentinel",
        details: { stage: "hint_verification", reason: "hint_reveals_answer" },
      }),
    );
    await act(() => store.reconcile("10:1"));
    expect(
      screen.getByText(
        "This hint could reveal the answer, so we couldn’t show it. Try again, or change your prompt first.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('<img src=x onerror="alert(1)">'),
    ).not.toBeInTheDocument();
  });
  it("maps supported verification diagnostics and sanitizes hostile or malformed failure details", async () => {
    read.mockResolvedValue(
      failedHint(1, {
        code: "AI_INVALID_OUTPUT",
        message:
          "RAW_MESSAGE_SENTINEL hint_reveals_answer <script>alert(1)</script>",
        details: {
          stage: "hint_verification",
          reason: "hint_reveals_answer",
          candidate_hint: "SECRET_OPTION_B_SENTINEL",
          rationale: "PRIVATE_VERIFIER_RATIONALE",
        },
      }),
    );
    await expand();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveClass("notice", "notice-error");
    expect(alert).toHaveTextContent(
      "This hint could reveal the answer, so we couldn’t show it. Try again, or change your prompt first.",
    );
    expect(screen.queryByText(/AI_INVALID_OUTPUT/)).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW_MESSAGE_SENTINEL/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/SECRET_OPTION_B_SENTINEL/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/PRIVATE_VERIFIER_RATIONALE/),
    ).not.toBeInTheDocument();

    const cases: Array<[number, SafeError | null, string]> = [
      [
        2,
        {
          code: "AI_INVALID_OUTPUT",
          message: "hint_reveals_answer in message should be ignored",
          details: { stage: "hint_verification", reason: "hint_irrelevant" },
        },
        "This hint wasn’t relevant enough to the question, so we couldn’t show it. Try again, or make your prompt more specific.",
      ],
      [
        3,
        {
          code: "AI_INVALID_OUTPUT",
          message: "hint_reveals_answer in message with wrong stage",
          details: { stage: "output_json", reason: "hint_reveals_answer" },
        },
        "We couldn’t generate a usable hint for this question. Try again, or adjust your prompt.",
      ],
      [
        4,
        {
          code: "AI_INVALID_OUTPUT",
          message: "nonstring diagnostics",
          details: {
            stage: "hint_verification",
            reason: ["hint_reveals_answer"],
          },
        },
        "We couldn’t generate a usable hint for this question. Try again, or adjust your prompt.",
      ],
      [
        5,
        {
          code: "AI_INVALID_OUTPUT",
          message: "unknown reason",
          details: { stage: "hint_verification", reason: "other_reason" },
        },
        "We couldn’t generate a usable hint for this question. Try again, or adjust your prompt.",
      ],
      [
        6,
        {
          code: "AI_UPSTREAM_ERROR",
          message: "mismatched code with verification details",
          details: {
            stage: "hint_verification",
            reason: "hint_reveals_answer",
          },
        },
        "Hints are temporarily unavailable. Please try again.",
      ],
      [
        7,
        {
          code: "AI_TIMEOUT",
          message: "Gateway timed out after 300s",
        },
        "Taking too long to generate a hint. Try again when you’re ready.",
      ],
      [
        8,
        {
          code: "AI_REQUEST_INTERRUPTED",
          message: "Server restarted while task was running",
        },
        "The hint request was interrupted before it finished. Try again when you’re ready.",
      ],
      [
        9,
        {
          code: "AI_CONFIGURATION_ERROR",
          message: "Missing SOCLAAS_API_KEY",
        },
        "Hints aren’t available right now due to a service configuration issue.",
      ],
      [
        10,
        {
          code: "AI_PROVIDER_LIMIT",
          message: "Upstream rate limit",
          retry_after_seconds: 12,
        },
        "The AI hint service is busy right now. Please try again in 12 seconds.",
      ],
      [11, null, "Hints are temporarily unavailable. Please try again."],
    ];
    for (const [version, error, expected] of cases) {
      read.mockResolvedValue(failedHint(version, error));
      await act(() => store.reconcile("10:1"));
      expect(screen.getByRole("alert")).toHaveTextContent(expected);
      if (error?.code) {
        expect(
          screen.queryByText(new RegExp(error.code)),
        ).not.toBeInTheDocument();
      }
    }
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
    await expand();
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
    await expand();
    const ask = await screen.findByRole("button", { name: "Ask for a hint" });
    await waitFor(() => expect(ask).toBeEnabled());
    fireEvent.change(screen.getByLabelText(/Optional hint prompt/), {
      target: { value: "Original prompt" },
    });
    fireEvent.click(ask);
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
  it("preserves typed prompt, current hint, and error across collapse and reopen without generating", async () => {
    read.mockResolvedValue(hintState(2, "success"));
    await expand();
    await screen.findByText("Consider the concept.");
    const prompt = screen.getByLabelText(/Optional hint prompt/);
    fireEvent.change(prompt, { target: { value: "Keep this draft prompt" } });

    const toggle = screen.getByRole("button", { name: "Your hint" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Consider the concept.")).not.toBeInTheDocument();

    read.mockResolvedValue(hintState(3, "failed"));
    await act(() => store.reconcile("10:1"));
    expect(
      screen.getByRole("button", { name: "Hint unavailable — try again" }),
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(
      screen.getByRole("button", { name: "Hint unavailable — try again" }),
    );
    expect(screen.queryByText("Consider the concept.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Optional hint prompt/)).toHaveValue(
      "Keep this draft prompt",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(generate).not.toHaveBeenCalled();
  });
});
