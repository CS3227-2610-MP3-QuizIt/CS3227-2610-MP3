import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../src/api/client";
import type { GenerationTransport } from "../src/teacher/GenerationStore";
import { GenerationStore } from "../src/teacher/GenerationStore";
import { deferred, generation, quiz } from "./teacherFixtures";
import type { GenerationState } from "../src/api/types";

describe("teacher generation reconciliation", () => {
  const read = vi.fn<GenerationTransport["read"]>();
  const generate = vi.fn<GenerationTransport["generate"]>();
  let store: GenerationStore;
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    generate.mockReset();
    store = new GenerationStore({ read, generate });
    store.subscribe(1, () => undefined);
  });
  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it("recovers dropped completion notifications and reads the updated draft after five seconds", async () => {
    read
      .mockResolvedValueOnce(generation(3, "in_progress"))
      .mockResolvedValue(generation(4, "success", quiz(2)));
    await store.reconcile(1);
    expect(store.snapshot(1).state?.quiz?.revision).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.snapshot(1).state?.quiz?.revision).toBe(2);
    expect(store.snapshot(1).state?.status).toBe("success");
    await vi.advanceTimersByTimeAsync(10000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(generate).not.toHaveBeenCalled();
  });
  it("preserves current draft content during admission and displays latest failure without an older success result", async () => {
    read
      .mockResolvedValueOnce(generation())
      .mockResolvedValue(generation(4, "failed"));
    const accepted = generation(3, "in_progress");
    delete accepted.quiz;
    generate.mockResolvedValue(accepted);
    await store.reconcile(1);
    await store.generate(1, {
      expected_revision: 1,
      prompt: "Simpler wording",
      action: "new",
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(1).state?.quiz?.revision).toBe(1);
    expect(store.snapshot(1).state?.status).toBe("failed");
    expect(store.snapshot(1).state?.result).toBeNull();
  });
  it("reads current quiz content separately instead of trusting a historical generation result", async () => {
    store.dispose();
    store = new GenerationStore();
    vi.spyOn(api, "generation").mockResolvedValue(
      generation(6, "success", quiz(1)),
    );
    vi.spyOn(api, "teacherQuiz").mockResolvedValue(quiz(3));
    await store.reconcile(1);
    expect(store.snapshot(1).state?.quiz?.revision).toBe(3);
    expect(store.snapshot(1).state?.result?.revision).toBe(1);
  });
  it("never rolls draft content or published status back when responses have the same target version", async () => {
    const published = { ...quiz(3), status: "published" as const };
    read
      .mockResolvedValueOnce(generation(6, "success", published))
      .mockResolvedValue(generation(6, "success", quiz(3)));
    await store.reconcile(1);
    await store.reconcile(1);
    expect(store.snapshot(1).state?.quiz?.status).toBe("published");
    read.mockResolvedValue(generation(6, "success", quiz(1)));
    await store.reconcile(1);
    expect(store.snapshot(1).state?.quiz?.revision).toBe(3);
  });
  it("repeats uncertain requests with the original prompt, revision, action, and key", async () => {
    read.mockResolvedValue(generation());
    generate
      .mockRejectedValueOnce(
        new ApiError(0, { code: "NETWORK_ERROR", message: "Offline" }),
      )
      .mockResolvedValue(generation(3, "in_progress"));
    await store.reconcile(1);
    const input = {
      expected_revision: 1,
      prompt: "Focus on access checks",
      action: "new" as const,
    };
    await store.generate(1, input);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(1).canRepeat).toBe(true);
    await store.generate(
      1,
      { expected_revision: 9, prompt: "Changed", action: "ensure" },
      true,
    );
    expect(generate.mock.calls[1][1]).toEqual(input);
    expect(generate.mock.calls[1][2]).toBe(generate.mock.calls[0][2]);
  });
  it("suppresses an outstanding draft read across new generation admission", async () => {
    const old = deferred<GenerationState>();
    const admission = deferred<GenerationState>();
    read
      .mockResolvedValueOnce(generation())
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(generation(4, "success", quiz(2)));
    generate.mockReturnValue(admission.promise);
    await store.reconcile(1);
    const readRequest = store.reconcile(1);
    const request = store.generate(1, {
      expected_revision: 1,
      prompt: "Refine",
      action: "new",
    });
    old.resolve(generation(3, "success", quiz(9)));
    await readRequest;
    expect(store.snapshot(1).state?.quiz?.revision).toBe(1);
    admission.resolve(generation(3, "in_progress"));
    await request;
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(1).state?.quiz?.revision).toBe(2);
  });
  it("retains prior content on rate rejection and never automatically resubmits", async () => {
    read.mockResolvedValue(generation());
    generate.mockRejectedValue(
      new ApiError(429, {
        code: "AI_APP_RATE_LIMIT",
        message: "Limit",
        retry_after_seconds: 12,
      }),
    );
    await store.reconcile(1);
    await store.generate(1, {
      expected_revision: 1,
      prompt: "Refine",
      action: "new",
    });
    await vi.advanceTimersByTimeAsync(60000);
    expect(store.snapshot(1).actionError).toBe(
      "AI request limit reached. Please try again in 12 seconds.",
    );
    expect(store.snapshot(1).submitting).toBe(false);
    expect(store.snapshot(1).state?.quiz?.revision).toBe(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("ignores notifications from another feature or target and aborts reads on session disposal", async () => {
    read.mockResolvedValue(generation(3, "in_progress"));
    await store.reconcile(1);
    store.notify({ feature: "summary", quiz_id: 1, version: 9 });
    store.notify({ feature: "quiz_generation", quiz_id: 2, version: 9 });
    expect(read).toHaveBeenCalledTimes(1);
    const signal = read.mock.calls[0][1];
    store.dispose();
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(10000);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
