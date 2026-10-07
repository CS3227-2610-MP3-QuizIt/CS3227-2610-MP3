import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummaryStore } from "../src/admin/SummaryStore";
import { ApiError } from "../src/api/client";
import type { SummaryState } from "../src/api/types";

const state = (
  version: number,
  status: SummaryState["status"] = "in_progress",
): SummaryState => ({
  target_id: version ? 1 : null,
  feature: "summary",
  quiz_id: 1,
  attempt_id: null,
  question_id: null,
  task_id: version ? "task" : null,
  version,
  status,
  result: null,
  error: null,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
describe("authoritative summary reconciliation", () => {
  let store: SummaryStore;
  const read =
    vi.fn<(id: number, signal: AbortSignal) => Promise<SummaryState>>();
  const generate =
    vi.fn<
      (
        id: number,
        action: "ensure" | "new",
        key: string,
        signal: AbortSignal,
      ) => Promise<SummaryState>
    >();
  beforeEach(() => {
    vi.useFakeTimers();
    read.mockReset();
    generate.mockReset();
    store = new SummaryStore({ read, generate });
    store.subscribe(1, () => undefined);
  });
  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it("recovers a lost terminal event with a read after five seconds and stops polling", async () => {
    read.mockResolvedValueOnce(state(1)).mockResolvedValue(state(2, "success"));
    await store.reconcile(1);
    await vi.advanceTimersByTimeAsync(4999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.snapshot(1).state?.status).toBe("success");
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(generate).not.toHaveBeenCalled();
  });
  it("ignores duplicate/older events and never uses event content as a result", async () => {
    read.mockResolvedValue(state(5, "success"));
    await store.reconcile(1);
    store.notify({ feature: "summary", quiz_id: 1, version: 5 });
    store.notify({ feature: "summary", quiz_id: 1, version: 4 });
    store.notify({ feature: "hint", quiz_id: 1, version: 20 });
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.snapshot(1).state?.version).toBe(5);
  });
  it("coalesces events and rereads when an event arrives during a fetch", async () => {
    const slow = deferred<SummaryState>();
    read
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue(state(4, "success"));
    const initial = store.reconcile(1);
    store.notify({ feature: "summary", quiz_id: 1, version: 3 });
    store.notify({ feature: "summary", quiz_id: 1, version: 4 });
    expect(read).toHaveBeenCalledTimes(1);
    slow.resolve(state(2));
    await initial;
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.snapshot(1).state?.version).toBe(4);
  });
  it("does not advance applied version on failed reads and retries with backoff", async () => {
    read
      .mockResolvedValueOnce(state(1, "success"))
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(state(3, "success"));
    await store.reconcile(1);
    store.notify({ feature: "summary", quiz_id: 1, version: 3 });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(1).state?.version).toBe(1);
    expect(store.snapshot(1).readError).toBe("Offline");
    await vi.advanceTimersByTimeAsync(999);
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(store.snapshot(1).state?.version).toBe(3);
  });
  it("never regresses state with older GET or POST replay responses", async () => {
    read
      .mockResolvedValueOnce(state(8, "success"))
      .mockResolvedValue(state(2, "success"));
    generate.mockResolvedValue(state(3, "success"));
    await store.reconcile(1);
    await store.reconcile(1);
    await store.generate(1, "new");
    expect(store.snapshot(1).state?.version).toBe(8);
  });
  it("suppresses earlier in-flight reads during admission and reconciles accepted state", async () => {
    const old = deferred<SummaryState>();
    const admission = deferred<SummaryState>();
    read
      .mockResolvedValueOnce(state(2, "success"))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(state(4, "failed"));
    generate.mockReturnValue(admission.promise);
    await store.reconcile(1);
    const earlierRead = store.reconcile(1);
    const request = store.generate(1, "new");
    old.resolve(state(3, "success"));
    await earlierRead;
    expect(store.snapshot(1).state?.version).toBe(2);
    expect(store.snapshot(1).submitting).toBe(true);
    admission.resolve(state(3));
    await request;
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(1).state?.version).toBe(4);
    expect(store.snapshot(1).state?.status).toBe("failed");
  });
  it("retains the prior state and clears loading on rate rejection without automatically resubmitting", async () => {
    read.mockResolvedValue(state(2, "success"));
    generate.mockRejectedValue(
      new ApiError(429, {
        code: "AI_APP_RATE_LIMIT",
        message: "Limit",
        retry_after_seconds: 17,
      }),
    );
    await store.reconcile(1);
    await store.generate(1, "new");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(1).state?.version).toBe(2);
    expect(store.snapshot(1).submitting).toBe(false);
    expect(store.snapshot(1).actionError).toBe(
      "AI request limit reached. Please try again in 17 seconds.",
    );
    expect(read).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it("uses the same key and input when explicitly repeating an uncertain request", async () => {
    read.mockResolvedValue(state(0, "not_requested"));
    generate
      .mockRejectedValueOnce(
        new ApiError(0, { code: "NETWORK_ERROR", message: "Offline" }),
      )
      .mockResolvedValue(state(1));
    await store.reconcile(1);
    await store.generate(1, "ensure");
    await vi.advanceTimersByTimeAsync(0);
    expect(store.snapshot(1).canRepeat).toBe(true);
    await store.generate(1, "new", true);
    expect(generate.mock.calls[1][1]).toBe("ensure");
    expect(generate.mock.calls[1][2]).toBe(generate.mock.calls[0][2]);
  });
  it("uses fresh keys for distinct explicit retries and blocks new requests during running work", async () => {
    read.mockResolvedValue(state(2, "failed"));
    generate.mockResolvedValue(state(2, "failed"));
    await store.reconcile(1);
    await store.generate(1, "new");
    await vi.advanceTimersByTimeAsync(0);
    await store.generate(1, "new");
    expect(generate.mock.calls[1][2]).not.toBe(generate.mock.calls[0][2]);
    read.mockResolvedValue(state(3));
    await vi.advanceTimersByTimeAsync(0);
    await store.reconcile(1);
    await store.generate(1, "new");
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("isolates targets and clears timers and pending reads on session disposal", async () => {
    read.mockResolvedValue(state(1));
    await store.reconcile(1);
    store.notify({ feature: "summary", quiz_id: 99, version: 7 });
    expect(read).toHaveBeenCalledTimes(1);
    const signal = read.mock.calls[0][1];
    store.dispose();
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("recovers initial read failure without an SSE connection", async () => {
    read
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValue(state(0, "not_requested"));
    await store.reconcile(1);
    expect(store.snapshot(1).state).toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(store.snapshot(1).state?.status).toBe("not_requested");
  });
});
