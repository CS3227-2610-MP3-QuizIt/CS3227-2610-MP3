import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { HintState, SafeError } from "../api/types";
import type { TargetSnapshot } from "../shared/TargetStore";
import { Notice } from "../shared/ui";
import { hintKey, HintStore } from "./HintStore";

function retryWait(seconds: unknown): number | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : null;
}

function appendRetry(message: string, seconds: number | null): string {
  return seconds != null
    ? `${message} Try again in ${seconds} seconds.`
    : message;
}

function formatHintFailure(error: SafeError | null | undefined): string {
  const code = typeof error?.code === "string" ? error.code : "";
  const details =
    error?.details &&
    typeof error.details === "object" &&
    !Array.isArray(error.details)
      ? error.details
      : null;
  const stage = typeof details?.stage === "string" ? details.stage : null;
  const reason = typeof details?.reason === "string" ? details.reason : null;
  const retryAfter = retryWait(error?.retry_after_seconds);

  if (code === "AI_INVALID_OUTPUT") {
    if (stage === "hint_verification" && reason === "hint_reveals_answer") {
      return "This hint could reveal the answer, so we couldn’t show it. Try again, or change your prompt first.";
    }
    if (stage === "hint_verification" && reason === "hint_irrelevant") {
      return "This hint wasn’t relevant enough to the question, so we couldn’t show it. Try again, or make your prompt more specific.";
    }
    return appendRetry(
      "We couldn’t generate a usable hint for this question. Try again, or adjust your prompt.",
      retryAfter,
    );
  }
  if (code === "AI_TIMEOUT") {
    return appendRetry(
      "Taking too long to generate a hint. Try again when you’re ready.",
      retryAfter,
    );
  }
  if (code === "AI_REQUEST_INTERRUPTED") {
    return appendRetry(
      "The hint request was interrupted before it finished. Try again when you’re ready.",
      retryAfter,
    );
  }
  if (code === "AI_CONFIGURATION_ERROR") {
    return "Hints aren’t available right now due to a service configuration issue.";
  }
  if (code === "AI_PROVIDER_LIMIT" || code === "AI_APP_RATE_LIMIT") {
    return retryAfter != null
      ? `The AI hint service is busy right now. Please try again in ${retryAfter} seconds.`
      : "The AI hint service is busy right now. Please try again shortly.";
  }
  return retryAfter != null
    ? `Hints are temporarily unavailable. Please try again in ${retryAfter} seconds.`
    : "Hints are temporarily unavailable. Please try again.";
}

function disclosureLabel(target: TargetSnapshot<HintState>): string {
  const state = target.state;
  const running = target.submitting || state?.status === "in_progress";
  if (running) return "Preparing your hint…";
  if (target.canRepeat) return "Hint request needs attention";
  if (
    state?.status === "failed" ||
    Boolean(target.readError) ||
    Boolean(target.actionError)
  ) {
    return "Hint unavailable — try again";
  }
  if (state?.status === "success" && state.result) return "Your hint";
  return "Need a hint?";
}

export function QuestionHint({
  attemptId,
  questionId,
  disabled,
  store,
}: {
  attemptId: number;
  questionId: number;
  disabled: boolean;
  store: HintStore;
}) {
  const key = hintKey(attemptId, questionId);
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(key, listener),
    [store, key],
  );
  const snapshot = useCallback(() => store.snapshot(key), [store, key]);
  const target = useSyncExternalStore(subscribe, snapshot);
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState("");
  useEffect(() => {
    void store.reconcile(key);
  }, [store, key]);
  const state = target.state;
  const running = target.submitting || state?.status === "in_progress";
  const unresolved = target.unresolved;
  const blocked = disabled || running || unresolved;
  const action = state?.status === "not_requested" ? "ensure" : "new";
  const panelId = `hint-panel-${attemptId}-${questionId}`;
  const promptId = `hint-prompt-${attemptId}-${questionId}`;
  return (
    <section
      className="student-hint"
      aria-label={`Hint for question ${questionId}`}
    >
      <button
        type="button"
        className="student-hint-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((open) => !open)}
      >
        <span>{disclosureLabel(target)}</span>
        <span className="student-hint-indicator" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded ? (
        <div id={panelId} className="student-hint-body">
          <p className="muted">
            AI hints offer a conceptual clue. Review them critically.
          </p>
          {state?.status === "success" && state.result ? (
            <p className="student-hint-text">{state.result.hint}</p>
          ) : null}
          {unresolved && !running && !target.readError ? (
            <p role="status">Checking hint state…</p>
          ) : null}
          {running ? (
            <p role="status">
              Preparing your hint… The active request keeps its original prompt.
            </p>
          ) : null}
          {state?.status === "failed" ? (
            <Notice>{formatHintFailure(state.error)}</Notice>
          ) : null}
          {target.readError ? (
            <Notice>
              {target.readError}{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => void store.reconcile(key)}
              >
                Refresh hint
              </button>
            </Notice>
          ) : null}
          {target.actionError ? <Notice>{target.actionError}</Notice> : null}
          <label htmlFor={promptId}>
            Optional hint prompt{" "}
            <span className="muted">(500 characters maximum)</span>
          </label>
          <textarea
            id={promptId}
            maxLength={500}
            rows={2}
            value={prompt}
            disabled={blocked || target.canRepeat}
            onChange={(event) => setPrompt(event.target.value)}
          />
          {target.canRepeat ? (
            <>
              <p className="muted">
                Check the latest state or repeat your previous request with its
                original prompt and key.
              </p>
              <button
                type="button"
                className="button button-secondary"
                disabled={blocked}
                onClick={() =>
                  void store.generate(key, { action, prompt }, true)
                }
              >
                Repeat previous request
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button button-secondary"
              disabled={blocked}
              onClick={() => void store.generate(key, { action, prompt })}
            >
              {state?.status === "success"
                ? "Another hint"
                : state?.status === "failed"
                  ? "Try again"
                  : "Ask for a hint"}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
