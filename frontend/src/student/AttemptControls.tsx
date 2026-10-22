import { useEffect, useRef, useState } from "react";
import { questionHeadingId } from "./attemptState";
import type { Answer, Questions, answerReadiness } from "./attemptState";

const saveLabels = { saving: "Saving", saved: "Saved", failed: "Save failed" };

export function AttemptNavigator({
  attemptId,
  questions,
  answers,
  marked,
  readiness,
  blocked,
  onSubmit,
}: {
  attemptId: number;
  questions: Questions;
  answers: Record<number, Answer>;
  marked: Set<number>;
  readiness: ReturnType<typeof answerReadiness>;
  blocked: boolean;
  onSubmit: (button: HTMLButtonElement) => void;
}) {
  const [current, setCurrent] = useState(questions[0]?.id);
  const navigation = useRef<HTMLElement>(null);
  // Geometry uses the actual compact strip height, including enlarged text.
  useEffect(() => {
    let frame = 0;
    const track = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const strip = navigation.current;
        const offset =
          strip &&
          getComputedStyle(strip)
            .getPropertyValue("--compact-navigation")
            .trim() === "1"
            ? strip.getBoundingClientRect().height + 24
            : 40;
        const layout = strip?.closest<HTMLElement>(".attempt-layout");
        layout?.style.setProperty("--attempt-focus-offset", `${offset}px`);
        let visible = questions[0]?.id;
        for (const question of questions) {
          const heading = document.getElementById(
            questionHeadingId(attemptId, question.id),
          );
          if (heading && heading.getBoundingClientRect().top <= offset)
            visible = question.id;
        }
        setCurrent(visible);
      });
    };
    track();
    window.addEventListener("scroll", track, { passive: true });
    window.addEventListener("resize", track);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", track);
      window.removeEventListener("resize", track);
    };
  }, [attemptId, questions]);
  function jump(id: number) {
    const heading = document.getElementById(questionHeadingId(attemptId, id));
    if (!heading) return;
    const strip = navigation.current;
    const compact =
      strip &&
      getComputedStyle(strip)
        .getPropertyValue("--compact-navigation")
        .trim() === "1";
    heading.style.scrollMarginTop = `${compact ? strip.getBoundingClientRect().height + 24 : 24}px`;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    setCurrent(id);
  }
  function visitMatching(matches: (id: number) => boolean) {
    const index = questions.findIndex((question) => question.id === current);
    const ordered = [
      ...questions.slice(index + 1),
      ...questions.slice(0, index + 1),
    ];
    const next = ordered.find((question) => matches(question.id));
    if (next) jump(next.id);
  }
  return (
    <aside
      className="panel attempt-navigator"
      ref={navigation}
      aria-label="Question navigator"
    >
      <strong>
        {readiness.answered} of {questions.length} answered
      </strong>
      <nav aria-label="Quiz questions" className="attempt-number-list">
        {questions.map((question) => {
          const status = answers[question.id]?.status;
          const label = status ? saveLabels[status] : "Unanswered";
          return (
            <button
              key={question.id}
              type="button"
              className={`attempt-number ${status ?? "unanswered"}`}
              aria-label={`Question ${question.position}, ${label}${marked.has(question.id) ? ", Marked for review" : ""}`}
              aria-current={current === question.id ? "step" : undefined}
              onClick={() => jump(question.id)}
            >
              <span className="attempt-number-badge" aria-hidden="true">
                {question.position}
              </span>
              <span className="attempt-number-title" aria-hidden="true">
                Question {question.position}
              </span>
              <span className="attempt-number-state" aria-hidden="true">
                {status === "saved"
                  ? "✓"
                  : status === "saving"
                    ? "◷"
                    : status === "failed"
                      ? "!"
                      : "○"}
                <span className="attempt-state-label">
                  {status !== "saved" ? label : ""}
                </span>
              </span>
              {marked.has(question.id) ? (
                <span aria-hidden="true" title="Marked for review">
                  ⚑
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
      <div className="attempt-navigation-actions">
        <button
          className="text-button"
          disabled={readiness.answered === questions.length}
          onClick={() => visitMatching((id) => !answers[id])}
        >
          Next unanswered
        </button>
        <button
          className="text-button"
          disabled={!marked.size}
          onClick={() => visitMatching((id) => marked.has(id))}
        >
          Review marked
        </button>
      </div>
      {readiness.answered === questions.length ? (
        <small className="attempt-all-selected">
          Every question has a selection.
        </small>
      ) : null}
      <div className="attempt-desktop-submit">
        <SubmissionReadiness
          readiness={readiness}
          blocked={blocked}
          onSubmit={onSubmit}
        />
      </div>
    </aside>
  );
}

export function SubmissionReadiness({
  readiness,
  blocked,
  onSubmit,
  busy = false,
}: {
  readiness: ReturnType<typeof answerReadiness>;
  blocked: boolean;
  busy?: boolean;
  onSubmit: (button: HTMLButtonElement) => void;
}) {
  return (
    <>
      <p className="attempt-readiness" role="status">
        {readiness.message}
      </p>
      <button
        className="button button-primary"
        disabled={!readiness.ready || blocked}
        onClick={(event) => onSubmit(event.currentTarget)}
      >
        {busy ? "Confirming submission…" : "Submit quiz"}
      </button>
    </>
  );
}

export function SubmissionConfirmation({
  readiness,
  markedQuestions,
  invokingButton,
  blocked,
  onCancel,
  onConfirm,
}: {
  readiness: ReturnType<typeof answerReadiness>;
  markedQuestions: number[];
  invokingButton: HTMLButtonElement;
  blocked: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const modal = dialog.current!;
    modal.showModal();
    cancel.current?.focus();
    return () => {
      modal.close();
      invokingButton.focus();
    };
  }, [invokingButton]);
  return (
    <dialog
      ref={dialog}
      className="attempt-confirmation"
      aria-labelledby="submission-title"
      aria-describedby="submission-description"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id="submission-title">Submit your quiz?</h2>
      <p id="submission-description">
        All answers must be saved. Submission is final. You can review the
        answers and explanations afterward.
      </p>
      <p role="status">{readiness.message}</p>
      {markedQuestions.length ? (
        <p>
          Marked for review:{" "}
          {markedQuestions.map((number) => `Question ${number}`).join(", ")}.
          Review marks do not prevent submission.
        </p>
      ) : null}
      <div className="attempt-confirmation-actions">
        <button
          ref={cancel}
          className="button button-secondary"
          onClick={onCancel}
        >
          Keep reviewing
        </button>
        <button
          className="button button-primary"
          disabled={blocked || !readiness.ready}
          onClick={onConfirm}
        >
          Confirm submission
        </button>
      </div>
    </dialog>
  );
}
