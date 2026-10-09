import { api } from "../api/client";
import { EmptyState, Loading, Notice, PageHeading } from "../shared/ui";
import { useResource } from "../shared/useResource";
const load = (signal: AbortSignal) => api.studentQuizzes(signal);
export function QuizList() {
  const resource = useResource(load);
  return (
    <>
      <PageHeading
        eyebrow="YOUR CLASSROOM"
        title="My quizzes"
        description="Pick up where you left off, or start something new."
        action={
          <button
            className="button button-secondary"
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
      {resource.data?.items.length === 0 ? (
        <EmptyState title="No quizzes yet" icon="book">
          Your assigned published quizzes will appear here.
        </EmptyState>
      ) : null}
      <div className="student-quiz-grid">
        {resource.data?.items.map((quiz) => (
          <article className="panel student-quiz-card" key={quiz.id}>
            <span
              className={`badge ${quiz.attempt_status === "submitted" ? "badge-success" : "badge-pending"}`}
            >
              {quiz.attempt_status.replaceAll("_", " ")}
            </span>
            <h2>{quiz.title}</h2>
            <p className="muted">
              {quiz.class_name} · {quiz.question_count} questions
            </p>
            <a
              className="button button-primary"
              href={`#/student/${quiz.attempt_status === "submitted" ? "results" : "attempt"}/${quiz.id}`}
              aria-label={`${quiz.attempt_status === "submitted" ? "View results" : quiz.attempt_status === "in_progress" ? "Resume" : "Start"}: ${quiz.title}`}
            >
              {quiz.attempt_status === "submitted"
                ? "View results"
                : quiz.attempt_status === "in_progress"
                  ? "Resume"
                  : "Start"}
            </a>
          </article>
        ))}
      </div>
    </>
  );
}
