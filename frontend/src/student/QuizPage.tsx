import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, errorMessage } from "../api/client";
import type {
  Attempt,
  Option,
  StudentQuiz,
  StudentResults,
} from "../api/types";
import { Loading, Notice, PageHeading, percent } from "../shared/ui";
import { useResource } from "../shared/useResource";
import { HintStore } from "./HintStore";
import { QuestionHint } from "./QuestionHint";

const options: Option[] = ["A", "B", "C", "D"];
interface Entry {
  quiz: StudentQuiz;
  attempt: Attempt;
}
export function QuizPage({
  id,
  resultsOnly = false,
  store,
}: {
  id: number;
  resultsOnly?: boolean;
  store: HintStore;
}) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<Entry> => {
      const quiz = await api.studentQuiz(id, signal);
      const attempt =
        resultsOnly || quiz.attempt_status === "submitted"
          ? await api.attempt(quiz.attempt_id, signal)
          : await api.startAttempt(id, signal);
      return { quiz, attempt };
    },
    [id, resultsOnly],
  );
  const resource = useResource(load);
  return (
    <>
      <a className="text-button student-back" href="#/student/quizzes">
        ← My quizzes
      </a>
      {resource.error ? (
        <Notice>
          {resource.error}{" "}
          <button
            className="text-button"
            onClick={() => void resource.refresh()}
          >
            Try again
          </button>
        </Notice>
      ) : null}
      {!resource.data && resource.loading ? (
        <Loading>Opening your quiz…</Loading>
      ) : null}
      {resource.data ? (
        <AttemptWorkspace
          key={resource.data.attempt.id}
          entry={resource.data}
          store={store}
        />
      ) : null}
    </>
  );
}

type Answer = {
  option: Option;
  status: "saving" | "saved" | "failed";
  error?: string;
};
// Answer state stays in this attempt's memory. Resource recovery cannot overwrite
// an unsaved local selection. Backend submission is monotonic and always wins.
export function AttemptWorkspace({
  entry,
  store,
}: {
  entry: Entry;
  store: HintStore;
}) {
  const { quiz } = entry;
  const [attempt, setAttempt] = useState(entry.attempt);
  const [answers, setAnswers] = useState<Record<number, Answer>>(() =>
    Object.fromEntries(
      entry.attempt.answers.map((answer) => [
        answer.question_id,
        { option: answer.selected_option, status: "saved" },
      ]),
    ),
  );
  const answerRef = useRef(answers);
  const pending = useRef(new Map<number, Promise<void>>());
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    return () => {
      current.abort();
    };
  }, []);
  const signal = () => controller.current!.signal;
  const active = () =>
    !!controller.current && !controller.current.signal.aborted;
  const updateAnswer = (id: number, answer: Answer) => {
    answerRef.current = { ...answerRef.current, [id]: answer };
    setAnswers(answerRef.current);
  };
  const submitted =
    attempt.status === "submitted" || entry.attempt.status === "submitted";
  async function reconcileSubmission() {
    setBusy(true);
    locked.current = true;
    try {
      const latest = await api.attempt(attempt.id, signal());
      if (!active()) return;
      setAttempt(latest);
      setUncertain(false);
      locked.current = latest.status === "submitted";
    } catch (error) {
      if (!active()) return;
      setUncertain(true);
      setError(`Unable to confirm submission. ${errorMessage(error)}`);
    } finally {
      if (active()) setBusy(false);
    }
  }
  async function save(id: number, option: Option) {
    if (locked.current || submitted || pending.current.has(id)) return;
    updateAnswer(id, { option, status: "saving" });
    const operation = (async () => {
      try {
        await api.saveAnswer(attempt.id, id, option, signal());
        if (active()) updateAnswer(id, { option, status: "saved" });
      } catch (error) {
        if (!active()) return;
        updateAnswer(id, {
          option,
          status: "failed",
          error: errorMessage(error),
        });
        if (error instanceof ApiError && error.code === "ATTEMPT_SUBMITTED") {
          setUncertain(true);
          locked.current = true;
          void reconcileSubmission();
        }
      }
    })();
    pending.current.set(id, operation);
    await operation;
    pending.current.delete(id);
  }
  async function submit() {
    if (locked.current || submitted) return;
    if (!quiz.questions.every((question) => answerRef.current[question.id])) {
      setError("Select an answer for every question before submitting.");
      return;
    }
    locked.current = true;
    setBusy(true);
    setError("");
    await Promise.all([...pending.current.values()]);
    if (!active()) return;
    if (
      quiz.questions.some(
        (question) => answerRef.current[question.id]?.status !== "saved",
      )
    ) {
      setError("Retry failed answer saves before submitting.");
      locked.current = false;
      setBusy(false);
      return;
    }
    try {
      await api.submitAttempt(attempt.id, signal());
      if (!active()) return;
      setAttempt((previous) => ({ ...previous, status: "submitted" }));
    } catch (error) {
      if (!active()) return;
      setError(errorMessage(error));
      setUncertain(true);
      // Even a conflict or failed HTTP response may follow a committed submission.
      // Controls remain frozen until an authoritative read succeeds.
      await reconcileSubmission();
    } finally {
      if (active()) setBusy(false);
    }
  }
  if (submitted) return <ResultsPage quiz={quiz} attemptId={attempt.id} />;
  if (attempt.status === "not_started")
    return (
      <Notice kind="info">
        This quiz has not been started.{" "}
        <a className="text-button" href={`#/student/attempt/${quiz.id}`}>
          Start quiz
        </a>
      </Notice>
    );
  const complete = quiz.questions.every((question) => answers[question.id]);
  return (
    <>
      <PageHeading
        eyebrow="QUIZ ATTEMPT"
        title={quiz.title}
        description="Your choices save as you go. Submit when you’ve answered every question."
      />
      {error ? <Notice>{error}</Notice> : null}
      {uncertain ? (
        <Notice>
          Editing is paused until submission is confirmed.{" "}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void reconcileSubmission()}
          >
            Check submission
          </button>
        </Notice>
      ) : null}
      {[...quiz.questions]
        .sort((a, b) => a.position - b.position)
        .map((question) => {
          const answer = answers[question.id];
          return (
            <article className="panel student-question" key={question.id}>
              <fieldset
                disabled={busy || uncertain || answer?.status === "saving"}
              >
                <legend>
                  <span className="question-number">{question.position}</span>{" "}
                  {question.question}
                </legend>
                <div className="student-options">
                  {options.map((option) => (
                    <label
                      className={`student-option ${answer?.option === option ? "selected" : ""}`}
                      key={option}
                    >
                      <input
                        type="radio"
                        name={`answer-${attempt.id}-${question.id}`}
                        value={option}
                        checked={answer?.option === option}
                        onChange={() => void save(question.id, option)}
                      />
                      <span className="student-option-letter">{option}</span>{" "}
                      <span>{question.options[option]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="student-save-state" role="status">
                {answer?.status === "saving"
                  ? "Saving…"
                  : answer?.status === "saved"
                    ? "Saved"
                    : answer?.status === "failed"
                      ? "Save failed"
                      : "Choose an answer"}
              </div>
              {answer?.status === "failed" ? (
                <Notice>
                  {answer.error}{" "}
                  <button
                    className="text-button"
                    disabled={busy || uncertain}
                    onClick={() => void save(question.id, answer.option)}
                  >
                    Retry save
                  </button>
                </Notice>
              ) : null}
              <QuestionHint
                attemptId={attempt.id}
                questionId={question.id}
                store={store}
                disabled={busy || uncertain}
              />
            </article>
          );
        })}
      <div className="panel student-submit">
        <div>
          <strong>
            {Object.keys(answers).length} of {quiz.questions.length} answered
          </strong>
          <p className="muted">
            Submission is final. You can review the answers and explanations
            afterward.
          </p>
        </div>
        <button
          className="button button-primary"
          disabled={!complete || busy || uncertain}
          onClick={() => void submit()}
        >
          {busy ? "Confirming submission…" : "Submit quiz"}
        </button>
      </div>
    </>
  );
}
function ResultsPage({
  quiz,
  attemptId,
}: {
  quiz: StudentQuiz;
  attemptId: number;
}) {
  const load = useCallback(
    (signal: AbortSignal) => api.results(attemptId, signal),
    [attemptId],
  );
  const resource = useResource<StudentResults>(load);
  const result = resource.data;
  return (
    <>
      <PageHeading
        eyebrow="QUIZ RESULTS"
        title={quiz.title}
        description="Your submitted attempt is complete. Review what you learned."
        action={
          <button
            className="button button-secondary"
            disabled={resource.loading}
            onClick={() => void resource.refresh()}
          >
            Refresh results
          </button>
        }
      />
      {resource.error ? (
        <Notice>
          {resource.error}{" "}
          <button
            className="text-button"
            onClick={() => void resource.refresh()}
          >
            Try again
          </button>
        </Notice>
      ) : null}
      {resource.loading ? <Loading>Loading your results…</Loading> : null}
      {result ? (
        <>
          <div className="panel student-score">
            <span className="badge badge-success">Submitted</span>
            <h2>
              {result.score} / {result.total_questions}
            </h2>
            <p>{percent(result.score_percent)}</p>
            <p className="muted">Final score.</p>
          </div>
          {[...result.questions]
            .sort((a, b) => a.position - b.position)
            .map((question) => (
              <article className="panel student-question" key={question.id}>
                <h2>
                  {question.position}. {question.question}
                </h2>
                <span
                  className={`badge ${question.is_correct ? "badge-success" : "badge-pending"}`}
                >
                  {question.is_correct ? "Correct" : "Incorrect"}
                </span>
                <ul className="student-result-options">
                  {options.map((option) => (
                    <li key={option}>
                      <strong>{option}.</strong> {question.options[option]}{" "}
                      {option === question.selected_option ? (
                        <span className="badge">Your answer</span>
                      ) : null}{" "}
                      {option === question.correct_option ? (
                        <span className="badge badge-success">
                          Correct answer
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <div className="student-explanation">
                  <h3>Explanation</h3>
                  <p>{question.explanation}</p>
                </div>
              </article>
            ))}
        </>
      ) : null}
    </>
  );
}
