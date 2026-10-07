import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ClassRoom, Quiz, SummaryResult } from "../api/types";
import { api } from "../api/client";
import { useResource } from "../shared/useResource";
import {
  EmptyState,
  Icon,
  Loading,
  Notice,
  PageHeading,
  formatDate,
  percent,
} from "../shared/ui";
import { SummaryStore } from "./SummaryStore";

export function PerformancePage({
  quizzes,
  classes,
  selectedId,
  store,
}: {
  quizzes: Quiz[];
  classes: ClassRoom[];
  selectedId: number | null;
  store: SummaryStore;
}) {
  const [classId, setClassId] = useState("all");
  const visible = quizzes.filter(
    (quiz) => classId === "all" || quiz.class_id === Number(classId),
  );
  const selected = quizzes.find((quiz) => quiz.id === selectedId);
  return (
    <>
      <PageHeading
        eyebrow="FROM ANSWERS TO UNDERSTANDING"
        title="Quiz performance"
        description="Follow completion and discover where your class can grow."
      />
      <div className="performance-layout">
        <section className="panel quiz-picker">
          <div className="panel-heading">
            <h2>Published quizzes</h2>
            <span className="count-badge">{quizzes.length}</span>
          </div>
          <label className="class-filter">
            Class
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="all">All classes</option>
              {classes.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {visible.length ? (
            <ul className="quiz-list">
              {visible.map((quiz) => (
                <li key={quiz.id}>
                  <a
                    href={`#/admin/performance?id=${quiz.id}`}
                    className={selectedId === quiz.id ? "selected" : ""}
                    aria-current={selectedId === quiz.id ? "page" : undefined}
                  >
                    <small>{quiz.class_name}</small>
                    <h3>{quiz.title}</h3>
                    <p>
                      {quiz.question_count} questions
                      <span>Published {formatDate(quiz.published_at)}</span>
                    </p>
                    <Icon name="arrow" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="book" title="No published quizzes">
              {quizzes.length
                ? "Choose another class to see its quizzes."
                : "Quizzes appear here after a teacher reviews and publishes them."}
            </EmptyState>
          )}
        </section>
        {selected ? (
          <QuizPerformance key={selected.id} quiz={selected} store={store} />
        ) : (
          <section className="panel performance-placeholder">
            <EmptyState
              icon="chart"
              title={
                selectedId
                  ? "Quiz not found"
                  : "See the learning behind the scores"
              }
            >
              {selectedId
                ? "Choose an available published quiz."
                : "Choose a quiz to view completion and its class performance summary."}
            </EmptyState>
          </section>
        )}
      </div>
    </>
  );
}

function QuizPerformance({ quiz, store }: { quiz: Quiz; store: SummaryStore }) {
  const load = useCallback(
    (signal: AbortSignal) => api.completion(quiz.id, signal),
    [quiz.id],
  );
  const completion = useResource(load);
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(quiz.id, listener),
    [store, quiz.id],
  );
  const snapshot = useCallback(() => store.snapshot(quiz.id), [store, quiz.id]);
  const task = useSyncExternalStore(subscribe, snapshot);
  useEffect(() => {
    void store.reconcile(quiz.id);
  }, [store, quiz.id]);
  const state = task.state;
  const busy = task.submitting || state?.status === "in_progress";
  const counts = completion.data;
  const canGenerate =
    counts?.summary_eligible &&
    !completion.error &&
    !completion.loading &&
    !busy &&
    state &&
    !task.readError &&
    !task.reading;
  const refresh = () => {
    void completion.refresh();
    void store.reconcile(quiz.id);
  };
  const label = task.submitting
    ? "Requesting…"
    : state?.status === "in_progress"
      ? "Generating…"
      : state?.status === "success"
        ? "Regenerate summary"
        : state?.status === "failed"
          ? "Retry summary"
          : "Generate summary";
  return (
    <div className="performance-detail">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{quiz.class_name}</p>
            <h2>{quiz.title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh quiz performance"
            disabled={completion.loading || task.reading || task.submitting}
            onClick={refresh}
          >
            <Icon name="refresh" />
          </button>
        </div>
        <p className="detail-meta">
          {quiz.question_count} questions &nbsp;·&nbsp; Published{" "}
          {formatDate(quiz.published_at)}
        </p>
        {completion.error ? (
          <Notice>
            {completion.error}{" "}
            <button className="text-button" onClick={refresh}>
              Try again
            </button>
          </Notice>
        ) : null}
        {counts ? (
          <>
            <div className="completion-title">
              <h3>Class completion</h3>
              <span
                className={`badge ${counts.summary_eligible ? "badge-success" : "badge-pending"}`}
              >
                {counts.summary_eligible
                  ? "Ready for insights"
                  : "Awaiting submissions"}
              </span>
            </div>
            <div className="completion-number">
              {counts.submitted_count}
              <span>/ {counts.assigned_count} submitted</span>
            </div>
            <progress
              value={counts.submitted_count}
              max={Math.max(1, counts.assigned_count)}
              aria-label="Quiz submissions"
            />
            <div className="completion-breakdown">
              <span>
                <i className="dot dot-green" />
                {counts.submitted_count} submitted
              </span>
              <span>
                <i className="dot dot-amber" />
                {counts.in_progress_count} in progress
              </span>
              <span>
                <i className="dot" />
                {counts.not_started_count} not started
              </span>
            </div>
            <p className="membership-note">
              Completion uses the student roster frozen at publication. Later
              membership changes do not affect these counts.
            </p>
          </>
        ) : completion.loading ? (
          <Loading>Loading completion…</Loading>
        ) : null}
      </section>
      <section className="panel summary-panel">
        <div className="panel-heading">
          <div className="summary-heading">
            <span className="summary-icon">
              <Icon name="spark" />
            </span>
            <div>
              <h2>Class performance summary</h2>
              <p className="muted">
                A fresh perspective on your class’s results.
              </p>
            </div>
          </div>
          <span className="badge badge-ai">AI generated</span>
        </div>
        {counts && !counts.summary_eligible ? (
          <Notice kind="info">
            A summary is available after every student in the publication roster
            submits.
            {counts.assigned_count > 0
              ? ` ${counts.assigned_count - counts.submitted_count} ${counts.assigned_count - counts.submitted_count === 1 ? "submission" : "submissions"} remaining.`
              : ""}
          </Notice>
        ) : null}
        {task.readError ? (
          <Notice>
            {task.readError}{" "}
            <button
              className="text-button"
              onClick={() => {
                void store.reconcile(quiz.id);
              }}
            >
              Refresh summary
            </button>
          </Notice>
        ) : null}
        {task.actionError ? <Notice>{task.actionError}</Notice> : null}
        {task.submitting ? (
          <Loading>Requesting a summary…</Loading>
        ) : state?.status === "in_progress" ? (
          <div className="generation-state">
            <Loading>Finding the story in your class’s results…</Loading>
            <p>
              You can leave this page. Your summary will be here when it’s
              ready.
            </p>
          </div>
        ) : state?.status === "failed" ? (
          <Notice>
            <strong>The latest summary could not be generated.</strong>
            <p>
              {state.error?.message ?? "Please try again."}
              {state.error?.retry_after_seconds != null
                ? ` Try again in ${state.error.retry_after_seconds} seconds.`
                : ""}
            </p>
          </Notice>
        ) : state?.status === "success" && state.result ? (
          <SummaryContent result={state.result} />
        ) : task.reading ? (
          <Loading>Checking summary state…</Loading>
        ) : (
          <div className="summary-intro">
            <Icon name="chart" />
            <h3>A clearer picture of learning.</h3>
            <p>
              Turn anonymous quiz results into an overview of strengths and
              concepts to revisit.
            </p>
          </div>
        )}
        <div className="summary-actions">
          <p>
            AI observations need human judgment.
            <br />
            Exact metrics come from submitted quiz results.
          </p>
          {task.canRepeat ? (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                void store.generate(quiz.id, "ensure", true);
              }}
            >
              Repeat previous request
            </button>
          ) : (
            <button
              className="button button-primary"
              disabled={!canGenerate}
              onClick={() => {
                void store.generate(
                  quiz.id,
                  state?.status === "not_requested" ? "ensure" : "new",
                );
              }}
            >
              <Icon name="spark" />
              {label}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function SummaryContent({ result }: { result: SummaryResult }) {
  const { metrics, summary } = result;
  return (
    <>
      <div className="metric-grid">
        <div>
          <small>Average score</small>
          <strong>
            {metrics.average_score.toFixed(2)}
            <span> / {metrics.question_count}</span>
          </strong>
        </div>
        <div>
          <small>Average percentage</small>
          <strong>{percent(metrics.average_score_percent)}</strong>
        </div>
        <div>
          <small>Score range</small>
          <strong>
            {metrics.min_score}–{metrics.max_score}
            <span> / {metrics.question_count}</span>
          </strong>
        </div>
        <div>
          <small>Submitted roster</small>
          <strong>
            {metrics.submitted_count}
            <span> / {metrics.assigned_count}</span>
          </strong>
        </div>
      </div>
      <div className="ai-observations">
        <h3>Overview</h3>
        <p>{summary.overview}</p>
        <div className="observation-columns">
          <div>
            <h3>
              <span className="dot dot-green" />
              Strengths
            </h3>
            {summary.strengths.length ? (
              <ul>
                {summary.strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No specific strengths identified.</p>
            )}
          </div>
          <div>
            <h3>
              <span className="dot dot-amber" />
              Areas to review
            </h3>
            {summary.areas_to_review.length ? (
              <ul>
                {summary.areas_to_review.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>No specific review areas identified.</p>
            )}
          </div>
        </div>
      </div>
      <div className="question-metrics">
        <h3>
          Question breakdown <span className="badge">Exact metrics</span>
        </h3>
        {metrics.questions.map((question) => (
          <details key={question.id}>
            <summary>
              <span className="question-number">{question.position}</span>
              <span>{question.question}</span>
              <strong>{percent(question.correct_percent)} correct</strong>
            </summary>
            <div className="question-metric-body">
              <p>
                {question.correct_count} correct · {question.incorrect_count}{" "}
                incorrect
              </p>
              <div className="option-counts">
                {(["A", "B", "C", "D"] as const).map((option) => (
                  <div
                    key={option}
                    className={
                      question.correct_option === option ? "correct-option" : ""
                    }
                  >
                    <strong>{option}</strong>
                    <span>
                      {question.options[option]}
                      {question.correct_option === option ? (
                        <small>Correct answer</small>
                      ) : null}
                    </span>
                    <b>{question.option_counts[option]}</b>
                  </div>
                ))}
              </div>
            </div>
          </details>
        ))}
      </div>
      <p className="summary-date">Generated {formatDate(result.created_at)}</p>
    </>
  );
}
