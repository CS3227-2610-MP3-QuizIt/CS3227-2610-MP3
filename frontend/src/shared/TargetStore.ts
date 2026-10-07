import { ApiError, errorMessage } from "../api/client";
import type { AIChange } from "../api/types";

export interface TaskState {
  version: number;
  status: "not_requested" | "in_progress" | "success" | "failed";
}

export interface TargetSnapshot<S extends TaskState> {
  state: S | null;
  reading: boolean;
  submitting: boolean;
  readError: string;
  actionError: string;
  canRepeat: boolean;
}
interface Target<S extends TaskState, I> {
  snapshot: TargetSnapshot<S>;
  listeners: Set<() => void>;
  applied: number;
  notified: number;
  epoch: number;
  fetching: boolean;
  dirty: boolean;
  failures: number;
  timer?: ReturnType<typeof setTimeout>;
  operation?: { input: I; key: string };
}
export interface TargetTransport<S extends TaskState, I> {
  read: (id: number, signal: AbortSignal) => Promise<S>;
  generate: (
    id: number,
    input: I,
    key: string,
    signal: AbortSignal,
  ) => Promise<S>;
  merge?: (previous: S | null, next: S) => S;
}

// A session-owned store per feature, scoped by quiz even before a target exists.
export class TargetStore<S extends TaskState, I> {
  private targets = new Map<number, Target<S, I>>();
  private controller = new AbortController();
  private stopped = false;
  private transport: TargetTransport<S, I>;
  private feature: string;
  constructor(feature: string, transport: TargetTransport<S, I>) {
    this.feature = feature;
    this.transport = transport;
  }
  private target(id: number): Target<S, I> {
    let target = this.targets.get(id);
    if (!target) {
      target = {
        snapshot: {
          state: null,
          reading: true,
          submitting: false,
          readError: "",
          actionError: "",
          canRepeat: false,
        },
        listeners: new Set(),
        applied: -1,
        notified: -1,
        epoch: 0,
        fetching: false,
        dirty: false,
        failures: 0,
      };
      this.targets.set(id, target);
    }
    return target;
  }
  snapshot = (id: number) => this.target(id).snapshot;
  subscribe = (id: number, listener: () => void) => {
    const target = this.target(id);
    target.listeners.add(listener);
    return () => {
      target.listeners.delete(listener);
      if (!target.listeners.size) clearTimeout(target.timer);
    };
  };
  private update(target: Target<S, I>, patch: Partial<TargetSnapshot<S>>) {
    if (this.stopped) return;
    target.snapshot = { ...target.snapshot, ...patch };
    target.listeners.forEach((listener) => listener());
  }
  private apply(target: Target<S, I>, state: S) {
    if (state.version < target.applied) return;
    target.applied = state.version;
    this.update(target, {
      state: this.transport.merge?.(target.snapshot.state, state) ?? state,
      readError: "",
    });
  }
  notify(event: AIChange) {
    if (
      event.feature !== this.feature ||
      !Number.isSafeInteger(event.quiz_id) ||
      !Number.isSafeInteger(event.version) ||
      event.version < 0
    )
      return;
    const target = this.targets.get(event.quiz_id);
    if (!target || event.version <= target.applied) return;
    target.notified = Math.max(target.notified, event.version);
    if (target.listeners.size) void this.reconcile(event.quiz_id);
  }
  refreshAll() {
    this.targets.forEach((target, id) => {
      if (target.listeners.size) void this.reconcile(id);
    });
  }
  private schedule(id: number, target: Target<S, I>) {
    clearTimeout(target.timer);
    if (this.stopped || !target.listeners.size || target.snapshot.submitting)
      return;
    const needsRead =
      target.snapshot.state?.status === "in_progress" ||
      target.notified > target.applied ||
      target.snapshot.readError ||
      target.snapshot.canRepeat;
    if (needsRead) {
      const delay = target.failures
        ? Math.min(30_000, 1_000 * 2 ** Math.min(target.failures - 1, 5))
        : 5_000;
      target.timer = setTimeout(() => {
        void this.reconcile(id);
      }, delay);
    }
  }
  async reconcile(id: number): Promise<void> {
    if (this.stopped) return;
    const target = this.target(id);
    if (target.snapshot.submitting) {
      target.dirty = true;
      return;
    }
    if (target.fetching) {
      target.dirty = true;
      return;
    }
    clearTimeout(target.timer);
    target.fetching = true;
    target.dirty = false;
    const epoch = target.epoch;
    this.update(target, { reading: true });
    let succeeded = false;
    try {
      const state = await this.transport.read(id, this.controller.signal);
      if (this.stopped || epoch !== target.epoch || target.snapshot.submitting)
        return;
      this.apply(target, state);
      target.failures = 0;
      succeeded = true;
    } catch (error) {
      if (this.stopped || epoch !== target.epoch) return;
      target.failures++;
      this.update(target, { readError: errorMessage(error) });
    } finally {
      target.fetching = false;
      if (!this.stopped) {
        this.update(target, { reading: false });
        // A fetch requested while this one was in flight needs a fresh snapshot.
        const again = target.dirty && !target.snapshot.submitting;
        target.dirty = false;
        if (again && (succeeded || epoch !== target.epoch))
          void this.reconcile(id);
        else this.schedule(id, target);
      }
    }
  }
  async generate(id: number, input: I, repeat = false) {
    if (this.stopped) return;
    const target = this.target(id);
    if (
      target.snapshot.submitting ||
      target.snapshot.state?.status === "in_progress"
    )
      return;
    const operation =
      repeat && target.operation
        ? target.operation
        : { input, key: crypto.randomUUID() };
    target.operation = operation;
    // Earlier GETs are suppressed until this operation is accepted/rejected.
    target.epoch++;
    clearTimeout(target.timer);
    this.update(target, {
      submitting: true,
      actionError: "",
      canRepeat: false,
    });
    try {
      const state = await this.transport.generate(
        id,
        operation.input,
        operation.key,
        this.controller.signal,
      );
      if (this.stopped) return;
      this.apply(target, state);
      target.operation = undefined;
    } catch (error) {
      if (this.stopped) return;
      const uncertain =
        error instanceof ApiError &&
        (error.status === 0 || error.status >= 500);
      if (!uncertain) target.operation = undefined;
      this.update(target, {
        actionError: errorMessage(error),
        canRepeat: uncertain,
      });
    } finally {
      if (!this.stopped) {
        this.update(target, { submitting: false });
        // Also reconciles admission rejection and historical key replays.
        void this.reconcile(id);
      }
    }
  }
  dispose() {
    this.stopped = true;
    this.controller.abort();
    this.targets.forEach((target) => {
      clearTimeout(target.timer);
      target.listeners.clear();
    });
    this.targets.clear();
  }
}
