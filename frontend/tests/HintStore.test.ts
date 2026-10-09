import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/api/client";
import { HintStore, hintKey } from "../src/student/HintStore";
import type { HintTransport } from "../src/student/HintStore";
import type { HintState } from "../src/api/types";
import { deferred, hintState } from "./studentFixtures";

describe("composite hint target reconciliation", () => {
  let store: HintStore;
  const read = vi.fn<HintTransport["read"]>();
  const generate = vi.fn<HintTransport["generate"]>();
  const key = hintKey(10, 1);
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    generate.mockReset();
    store = new HintStore({ read, generate });
    store.subscribe(key, () => undefined);
  });
  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });
  it("isolates questions and attempts, validates scoped event IDs, and ignores stale/foreign events", async () => {
    read.mockImplementation(async (key) => {
      const [attempt, question] = key.split(":").map(Number);
      return hintState(2, "success", attempt, question);
    });
    for (const target of [hintKey(10, 1), hintKey(10, 2), hintKey(20, 1)]) {
      store.subscribe(target, () => undefined);
      await store.reconcile(target);
    }
    const event = {
      feature: "hint",
      quiz_id: 1,
      attempt_id: 10,
      question_id: 2,
      version: 3,
    };
    store.notify({ ...event, version: 2 });
    store.notify({ ...event, feature: "summary", version: 100 });
    store.notify({ ...event, attempt_id: null });
    store.notify({ ...event, question_id: NaN });
    store.notify({ ...event, attempt_id: 999 });
    expect(read).toHaveBeenCalledTimes(3);
    read.mockResolvedValue(hintState(3, "failed", 10, 2));
    store.notify(event);
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(hintKey(10, 2)).state?.status).toBe("failed");
    expect(store.snapshot(hintKey(10, 1)).state?.status).toBe("success");
    expect(store.snapshot(hintKey(20, 1)).state?.status).toBe("success");
  });
  it("coalesces notifications during a read and performs a follow-up authoritative read", async () => {
    const pending = deferred<HintState>();
    read
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(hintState(4, "success"));
    const initial = store.reconcile(key);
    store.notify({
      feature: "hint",
      quiz_id: 1,
      attempt_id: 10,
      question_id: 1,
      version: 3,
    });
    store.notify({
      feature: "hint",
      quiz_id: 1,
      attempt_id: 10,
      question_id: 1,
      version: 4,
    });
    expect(read).toHaveBeenCalledOnce();
    pending.resolve(hintState(2, "in_progress"));
    await initial;
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.snapshot(key).state?.version).toBe(4);
  });
  it("keeps a target unresolved when a read is older than the notified version", async () => {
    read.mockResolvedValue(hintState(2, "success"));
    await store.reconcile(key);
    store.notify({
      feature: "hint",
      quiz_id: 1,
      attempt_id: 10,
      question_id: 1,
      version: 4,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(key).unresolved).toBe(true);
    read.mockResolvedValue(hintState(4, "failed"));
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.snapshot(key).unresolved).toBe(false);
  });
  it("polls unfinished hints every five seconds to recover a dropped terminal event", async () => {
    read
      .mockResolvedValueOnce(hintState(1, "in_progress"))
      .mockResolvedValue(hintState(2, "success"));
    await store.reconcile(key);
    await vi.advanceTimersByTimeAsync(4999);
    expect(read).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(store.snapshot(key).state?.status).toBe("success");
    await vi.advanceTimersByTimeAsync(20000);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("backs off failed reads without advancing versions or resubmitting generation", async () => {
    read
      .mockResolvedValueOnce(hintState(1, "in_progress"))
      .mockRejectedValueOnce(new Error("Offline"))
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(hintState(3, "failed"));
    await store.reconcile(key);
    await store.reconcile(key);
    expect(store.snapshot(key).state?.version).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1999);
    expect(read).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.snapshot(key).state?.version).toBe(3);
    expect(generate).not.toHaveBeenCalled();
  });
  it("guards older GETs and key replays and replaces latest success with failure", async () => {
    read
      .mockResolvedValueOnce(hintState(4, "success"))
      .mockResolvedValue(hintState(2, "success"));
    generate.mockResolvedValue(hintState(3, "success"));
    await store.reconcile(key);
    await store.reconcile(key);
    await store.generate(key, { action: "new", prompt: "" });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(key).state?.version).toBe(4);
    read.mockResolvedValue(hintState(6, "failed"));
    await store.reconcile(key);
    expect(store.snapshot(key).state?.result).toBeNull();
    expect(store.snapshot(key).state?.status).toBe("failed");
  });
  it("suppresses pre-admission reads until POST resolution", async () => {
    const old = deferred<HintState>();
    const admission = deferred<HintState>();
    read
      .mockResolvedValueOnce(hintState(2, "success"))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(hintState(4, "failed"));
    generate.mockReturnValue(admission.promise);
    await store.reconcile(key);
    const reading = store.reconcile(key);
    const request = store.generate(key, { action: "new", prompt: "" });
    old.resolve(hintState(3, "success"));
    await reading;
    expect(store.snapshot(key).state?.version).toBe(2);
    admission.resolve(hintState(3, "in_progress"));
    await request;
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(key).state?.version).toBe(4);
  });
  it("preserves success on rejected admission and shows timing without automatic resubmission", async () => {
    read.mockResolvedValue(hintState(2, "success"));
    generate.mockRejectedValue(
      new ApiError(429, {
        code: "AI_APP_RATE_LIMIT",
        message: "Limit",
        retry_after_seconds: 12,
      }),
    );
    await store.reconcile(key);
    await store.generate(key, { action: "new", prompt: "" });
    await vi.advanceTimersByTimeAsync(60000);
    expect(store.snapshot(key).state?.result?.hint).toBe(
      "Consider the concept.",
    );
    expect(store.snapshot(key).actionError).toContain("12 seconds");
    expect(store.snapshot(key).submitting).toBe(false);
    expect(generate).toHaveBeenCalledOnce();
  });
  it("uses original input/key for an uncertain repeat and fresh keys for explicit new work", async () => {
    read.mockResolvedValue(hintState());
    generate
      .mockRejectedValueOnce(
        new ApiError(0, { code: "NETWORK_ERROR", message: "Offline" }),
      )
      .mockResolvedValue(hintState());
    await store.reconcile(key);
    await store.generate(key, { action: "ensure", prompt: "original" });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(key).canRepeat).toBe(true);
    await store.generate(key, { action: "new", prompt: "changed" }, true);
    await vi.advanceTimersByTimeAsync(0);
    expect(generate.mock.calls[1][1]).toEqual({
      action: "ensure",
      prompt: "original",
    });
    expect(generate.mock.calls[1][2]).toBe(generate.mock.calls[0][2]);
    await store.generate(key, { action: "new", prompt: "changed" });
    expect(generate.mock.calls[2][2]).not.toBe(generate.mock.calls[1][2]);
    read.mockResolvedValue(hintState(1, "in_progress"));
    await vi.advanceTimersByTimeAsync(0);
    await store.reconcile(key);
    await store.generate(key, { action: "new", prompt: "" });
    expect(generate).toHaveBeenCalledTimes(3);
  });
  it("disposes session state, aborts outstanding I/O and ignores late responses", async () => {
    const pending = deferred<HintState>();
    read.mockReturnValue(pending.promise);
    const initial = store.reconcile(key);
    const signal = read.mock.calls[0][1];
    const listener = vi.fn();
    store.subscribe(key, listener);
    store.dispose();
    pending.resolve(hintState(7, "success"));
    await initial;
    expect(signal.aborted).toBe(true);
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60000);
    expect(read).toHaveBeenCalledOnce();
    expect(generate).not.toHaveBeenCalled();
  });
});
