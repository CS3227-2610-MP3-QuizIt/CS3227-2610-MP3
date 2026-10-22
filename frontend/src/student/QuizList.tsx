import { useCallback, useRef, useState } from "react";
import type { StudentQuizItem } from "../api/types";
import { api } from "../api/client";
import { EmptyState, Loading, Notice, PageHeading } from "../shared/ui";
import { useResource } from "../shared/useResource";
import {
  defaultQuizListPreferences,
  type QuizListPreferences,
  type QuizListTab,
} from "./quizListPreferences";

const tabs: { id: QuizListTab; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "submitted", label: "Submitted" },
  { id: "all", label: "All" },
];

export function QuizList({
  preferences = defaultQuizListPreferences,
  onPreferencesChange,
}: {
  preferences?: QuizListPreferences;
  onPreferencesChange?: (preferences: QuizListPreferences) => void;
} = {}) {
  const [localPreferences, setLocalPreferences] = useState(preferences);
  const selection = onPreferencesChange ? preferences : localPreferences;
  const selectionRef = useRef(selection);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const update = useCallback(
    (next: QuizListPreferences) => {
      selectionRef.current = next;
      if (onPreferencesChange) onPreferencesChange(next);
      else setLocalPreferences(next);
    },
    [onPreferencesChange],
  );
  const load = useCallback(
    async (signal: AbortSignal) => {
      const data = await api.studentQuizzes(signal);
      const current = selectionRef.current;
      if (
        current.classId !== "all" &&
        !data.items.some((item) => String(item.class_id) === current.classId)
      ) {
        update({ ...current, classId: "all" });
      }
      return data;
    },
    [update],
  );
  const resource = useResource(load);

  const items = resource.data?.items ?? [];
  const classes = [
    ...new Map(items.map((item) => [item.class_id, item.class_name])).entries(),
  ].sort(
    (left, right) => left[1].localeCompare(right[1]) || left[0] - right[0],
  );
  const classNameCounts = new Map<string, number>();
  for (const [, name] of classes) {
    classNameCounts.set(name, (classNameCounts.get(name) ?? 0) + 1);
  }

  const query = selection.search.trim().toLocaleLowerCase();
  const matchingItems = items.filter((quiz) => {
    const matchesSearch =
      !query ||
      quiz.title.toLocaleLowerCase().includes(query) ||
      quiz.class_name.toLocaleLowerCase().includes(query);
    const matchesClass =
      selection.classId === "all" ||
      String(quiz.class_id) === selection.classId;
    return matchesSearch && matchesClass;
  });
  const todoItems = matchingItems.filter(
    (quiz) => quiz.attempt_status !== "submitted",
  );
  const submittedItems = matchingItems.filter(
    (quiz) => quiz.attempt_status === "submitted",
  );
  const counts = {
    todo: resource.data ? todoItems.length : null,
    submitted: resource.data ? submittedItems.length : null,
    all: resource.data ? todoItems.length + submittedItems.length : null,
  };
  const visibleItems = (
    selection.tab === "todo"
      ? todoItems
      : selection.tab === "submitted"
        ? submittedItems
        : matchingItems
  )
    .slice()
    .sort((left, right) => {
      if (
        left.attempt_status === "in_progress" &&
        right.attempt_status !== "in_progress"
      )
        return -1;
      if (
        right.attempt_status === "in_progress" &&
        left.attempt_status !== "in_progress"
      )
        return 1;
      return 0;
    });
  const hasSelection =
    selection.tab !== defaultQuizListPreferences.tab ||
    selection.classId !== defaultQuizListPreferences.classId ||
    selection.search !== defaultQuizListPreferences.search;

  return (
    <>
      <PageHeading
        eyebrow="YOUR CLASSROOM"
        title="My quizzes"
        description="Pick up where you left off, or start something new."
        action={
          <button
            className="button button-secondary student-refresh"
            disabled={resource.loading}
            onClick={() => void resource.refresh()}
          >
            Refresh quizzes
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
      {resource.loading ? <Loading>Loading assigned quizzes…</Loading> : null}

      <section className="panel student-collection" aria-label="My quizzes">
        <div
          className="student-collection-tabs"
          role="tablist"
          aria-label="Quiz status"
        >
          {tabs.map((tab, index) => (
            <button
              className={`student-collection-tab ${selection.tab === tab.id ? "selected" : ""}`}
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`quiz-status-${tab.id}`}
              role="tab"
              aria-selected={selection.tab === tab.id}
              tabIndex={selection.tab === tab.id ? 0 : -1}
              aria-controls="student-quiz-results"
              onClick={() => update({ ...selection, tab: tab.id })}
              onKeyDown={(event) => {
                const currentIndex = tabs.findIndex(
                  (item) => item.id === tab.id,
                );
                const nextIndex =
                  event.key === "ArrowRight"
                    ? (currentIndex + 1) % tabs.length
                    : event.key === "ArrowLeft"
                      ? (currentIndex - 1 + tabs.length) % tabs.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? tabs.length - 1
                          : null;
                if (nextIndex !== null) {
                  event.preventDefault();
                  update({ ...selection, tab: tabs[nextIndex].id });
                  tabRefs.current[nextIndex]?.focus();
                }
              }}
            >
              {tab.label}
              <span className="student-count">{counts[tab.id] ?? "—"}</span>
            </button>
          ))}
        </div>
        <div className="student-collection-controls">
          <div className="student-search-control">
            <label htmlFor="quiz-search">Find a quiz</label>
            <div className="student-search-field">
              <svg
                className="student-search-icon"
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
              >
                <circle cx="8.75" cy="8.75" r="5.75" />
                <path d="m13 13 4 4" />
              </svg>
              <input
                id="quiz-search"
                type="search"
                placeholder="Search title or class"
                value={selection.search}
                onChange={(event) =>
                  update({ ...selection, search: event.target.value })
                }
              />
              {selection.search ? (
                <button
                  className="student-search-clear"
                  aria-label="Clear search"
                  onClick={() => update({ ...selection, search: "" })}
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
          <div className="student-class-control">
            <label htmlFor="quiz-class">Class</label>
            <div className="student-class-select">
              <select
                id="quiz-class"
                value={selection.classId}
                onChange={(event) =>
                  update({ ...selection, classId: event.target.value })
                }
              >
                <option value="all">All classes</option>
                {classes.map(([classId, name]) => (
                  <option key={classId} value={String(classId)}>
                    {classNameCounts.get(name)! > 1
                      ? `${name} (class ${classId})`
                      : name}
                  </option>
                ))}
              </select>
              <svg
                className="student-class-chevron"
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
              >
                <path d="m5 7.5 5 5 5-5" />
              </svg>
            </div>
          </div>
          <button
            className="text-button student-reset"
            disabled={!hasSelection}
            onClick={() => update(defaultQuizListPreferences)}
          >
            Reset filters
          </button>
        </div>
      </section>
      <div
        id="student-quiz-results"
        role="tabpanel"
        aria-labelledby={`quiz-status-${selection.tab}`}
      >
        {resource.data?.items.length === 0 ? (
          <EmptyState title="No quizzes yet" icon="book">
            Your assigned published quizzes will appear here.
          </EmptyState>
        ) : null}
        {resource.data && items.length > 0 && visibleItems.length === 0 ? (
          <div className="student-filter-empty">
            <h2>
              {matchingItems.length === 0
                ? "No quizzes match these filters"
                : `No ${tabs.find((tab) => tab.id === selection.tab)?.label.toLocaleLowerCase()} quizzes`}
            </h2>
            <p className="muted">
              {matchingItems.length === 0
                ? "Try another search or class, or reset your filters."
                : "Choose another status tab or view all quizzes."}
            </p>
            {selection.search ? (
              <button
                className="text-button"
                onClick={() => update({ ...selection, search: "" })}
              >
                Clear search
              </button>
            ) : null}
            {hasSelection ? (
              <button
                className="text-button"
                onClick={() => update(defaultQuizListPreferences)}
              >
                Reset filters
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="student-quiz-grid">
          {visibleItems.map((quiz) => (
            <QuizCard quiz={quiz} key={quiz.id} />
          ))}
        </div>
      </div>
    </>
  );
}

function QuizCard({ quiz }: { quiz: StudentQuizItem }) {
  const submitted = quiz.attempt_status === "submitted";
  const inProgress = quiz.attempt_status === "in_progress";
  const action = submitted ? "View results" : inProgress ? "Resume" : "Start";
  const score = quiz.score;
  return (
    <article className="panel student-quiz-card">
      <span
        className={`badge ${submitted ? "badge-success" : "badge-pending"}`}
      >
        {submitted ? "Submitted" : inProgress ? "In progress" : "Not started"}
      </span>
      <h2>{quiz.title}</h2>
      <p className="muted">
        {quiz.class_name} · {quiz.question_count}{" "}
        {quiz.question_count === 1 ? "question" : "questions"}
      </p>
      {submitted ? (
        <div className="student-quiz-footer">
          <a
            className="button button-secondary"
            href={`#/student/results/${quiz.id}`}
            aria-label={`${action}: ${quiz.title}`}
          >
            {action}
          </a>
          <div
            className="student-card-score"
            aria-label={`Score ${score == null ? "unavailable" : `${score} / ${quiz.question_count}`}`}
          >
            <span>Score</span>
            {score == null ? (
              <span className="student-score-unavailable">Unavailable</span>
            ) : (
              <>
                <strong>{score}</strong>
                <small>/ {quiz.question_count}</small>
              </>
            )}
          </div>
        </div>
      ) : (
        <a
          className="button button-primary"
          href={`#/student/attempt/${quiz.id}`}
          aria-label={`${action}: ${quiz.title}`}
        >
          {action}
        </a>
      )}
    </article>
  );
}
