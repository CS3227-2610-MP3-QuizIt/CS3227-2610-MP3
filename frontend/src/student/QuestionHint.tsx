import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Notice } from "../shared/ui";
import { hintKey, HintStore } from "./HintStore";

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
  const [prompt, setPrompt] = useState("");
  useEffect(() => {
    void store.reconcile(key);
  }, [store, key]);
  const state = target.state;
  const running = target.submitting || state?.status === "in_progress";
  const unresolved = target.unresolved;
  const blocked = disabled || running || unresolved;
  const action = state?.status === "not_requested" ? "ensure" : "new";
  return (
    <section
      className="student-hint"
      aria-label={`Hint for question ${questionId}`}
    >
      <h3>Need a little guidance?</h3>
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
        <Notice>
          {state.error?.code}:{" "}
          {state.error?.message ?? "The hint could not be generated."}
          {state.error?.retry_after_seconds != null
            ? ` Try again in ${state.error.retry_after_seconds} seconds.`
            : ""}
        </Notice>
      ) : null}
      {target.readError ? (
        <Notice>
          {target.readError}{" "}
          <button
            className="text-button"
            onClick={() => void store.reconcile(key)}
          >
            Refresh hint
          </button>
        </Notice>
      ) : null}
      {target.actionError ? <Notice>{target.actionError}</Notice> : null}
      <label htmlFor={`hint-prompt-${key}`}>
        Optional hint prompt{" "}
        <span className="muted">(500 characters maximum)</span>
      </label>
      <textarea
        id={`hint-prompt-${key}`}
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
            className="button button-secondary"
            disabled={blocked}
            onClick={() => void store.generate(key, { action, prompt }, true)}
          >
            Repeat previous request
          </button>
        </>
      ) : (
        <button
          className="button button-secondary"
          disabled={blocked}
          onClick={() => void store.generate(key, { action, prompt })}
        >
          {state?.status === "success"
            ? "Another hint"
            : state?.status === "failed"
              ? "Retry hint"
              : "Ask for a hint"}
        </button>
      )}
    </section>
  );
}
