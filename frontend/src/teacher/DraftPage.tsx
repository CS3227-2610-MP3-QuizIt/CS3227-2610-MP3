import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ClassRoom } from "../api/types";
import { api, ApiError, errorMessage } from "../api/client";
import { formatDate, Icon, Loading, Notice, PageHeading } from "../shared/ui";
import { GenerationStore } from "./GenerationStore";

export function DraftPage({
  id,
  classes,
  store,
  onPublished,
  onDeleted,
}: {
  id: number;
  classes: ClassRoom[];
  store: GenerationStore;
  onPublished: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const subscribe = useCallback(
    (listener: () => void) => store.subscribe(id, listener),
    [store, id],
  );
  const snapshot = useCallback(() => store.snapshot(id), [store, id]);
  const task = useSyncExternalStore(subscribe, snapshot);
  const [prompt, setPrompt] = useState("");
  const [reviewed, setReviewed] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [publishedCount, setPublishedCount] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    void store.reconcile(id);
    return () => controller.current?.abort();
  }, [store, id]);
  const state = task.state;
  const quiz = state?.quiz;
  const running = state?.status === "in_progress";
  const busy = task.submitting || running || publishing || deleting;
  const reviewToken = quiz ? `${quiz.revision}:${state?.version}` : "";
  const complete =
    !!quiz &&
    quiz.revision > 0 &&
    quiz.questions.length === quiz.question_count;
  const fresh = !task.reading && !task.readError && !task.canRepeat;
  const publishable =
    complete &&
    fresh &&
    !busy &&
    quiz?.status === "draft" &&
    reviewed === reviewToken;
  const deletable =
    fresh && !busy && quiz?.status === "draft" && publishedCount === null;
  async function deleteDraft() {
    if (!deletable || !confirmDelete) return;
    const current = new AbortController();
    controller.current = current;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.deleteQuiz(id, current.signal);
    } catch (error) {
      if (!current.signal.aborted) {
        setDeleteError(errorMessage(error));
        setDeleting(false);
        await store.reconcile(id);
      }
      return;
    }
    if (!current.signal.aborted) {
      store.retire(id);
      window.location.hash = "/teacher/quizzes";
      void onDeleted();
    }
  }
  async function publish() {
    if (!quiz || !publishable) return;
    const current = new AbortController();
    controller.current = current;
    setPublishing(true);
    setPublishError("");
    try {
      const publication = await api.publishQuiz(
        id,
        quiz.revision,
        current.signal,
      );
      if (!current.signal.aborted) {
        setPublishedCount(publication.assigned_student_count);
        setReviewed(null);
        await store.reconcile(id);
        void onPublished();
      }
    } catch (error) {
      if (!current.signal.aborted) {
        setPublishError(errorMessage(error));
        if (
          error instanceof ApiError &&
          [
            "STALE_REVISION",
            "AI_REQUEST_IN_PROGRESS",
            "QUIZ_PUBLISHED",
          ].includes(error.code)
        )
          setReviewed(null);
        await store.reconcile(id);
      }
    } finally {
      if (!current.signal.aborted) setPublishing(false);
    }
  }
  return (
    <>
      <a className="text-button teacher-back" href="#/teacher/quizzes">
        ← Back to my quizzes
      </a>
      <PageHeading
        eyebrow={
          quiz?.status === "published"
            ? "SHARED WITH YOUR CLASS"
            : "YOUR QUIZ DRAFT"
        }
        title={quiz?.title ?? "Quiz review"}
        description={
          quiz
            ? `${classes.find((item) => item.id === quiz.class_id)?.name ?? "Class"} · ${quiz.question_count} questions · Revision ${quiz.revision}`
            : "Loading your current quiz and generation state."
        }
        action={
          <button
            className="button button-secondary"
            disabled={task.reading || task.submitting || publishing || deleting}
            onClick={() => void store.reconcile(id)}
          >
            <Icon name="refresh" />
            Refresh quiz
          </button>
        }
      />
      {task.readError ? (
        <Notice>
          {task.readError}{" "}
          <button
            className="text-button"
            onClick={() => void store.reconcile(id)}
          >
            Try again
          </button>
        </Notice>
      ) : null}
      {!quiz ? (
        task.reading ? (
          <Loading>Opening your quiz…</Loading>
        ) : null
      ) : (
        <>
          {quiz.status === "published" || publishedCount !== null ? (
            <Notice kind="success">
              <strong>
                Published
                {publishedCount !== null
                  ? ` to ${publishedCount} ${publishedCount === 1 ? "student" : "students"}`
                  : ""}
                .
              </strong>{" "}
              The questions and student roster are frozen.
              {quiz.published_at
                ? ` Shared ${formatDate(quiz.published_at)}.`
                : ""}
            </Notice>
          ) : null}
          <div className="teacher-draft-layout">
            <section
              className="teacher-question-column"
              aria-label="Quiz questions and answer key"
            >
              <div className="teacher-section-heading">
                <h2>
                  {quiz.questions.length
                    ? "Questions & answer key"
                    : "Ready for your first questions"}
                </h2>
                <span className="badge badge-ai">AI generated</span>
              </div>
              {quiz.questions.length ? (
                <>
                  <p className="muted teacher-review-guidance">
                    Read each question, check the correct answer, and verify the
                    explanation.
                  </p>
                  {[...quiz.questions]
                    .sort((a, b) => a.position - b.position)
                    .map((question) => (
                      <article
                        className="panel teacher-question"
                        key={question.id}
                      >
                        <div className="teacher-question-heading">
                          <span className="question-number">
                            {question.position}
                          </span>
                          <h3>{question.question}</h3>
                        </div>
                        <ol className="teacher-options">
                          {(["A", "B", "C", "D"] as const).map((option) => (
                            <li
                              className={
                                option === question.correct_option
                                  ? "teacher-correct"
                                  : ""
                              }
                              key={option}
                            >
                              <span className="teacher-option-letter">
                                {option}
                              </span>
                              <span>{question.options[option]}</span>
                              {option === question.correct_option ? (
                                <span className="teacher-answer-tag">
                                  <Icon name="check" />
                                  Correct answer
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                        <div className="teacher-explanation">
                          <h4>Explanation</h4>
                          <p>{question.explanation}</p>
                        </div>
                      </article>
                    ))}
                </>
              ) : (
                <section className="panel teacher-draft-empty">
                  <span className="empty-icon">
                    <Icon name="spark" />
                  </span>
                  <h3>Turn your notes into a quiz.</h3>
                  <p className="muted">
                    Add any guidance, then select Generate questions. Your draft
                    stays private until you review and publish it.
                  </p>
                </section>
              )}
            </section>
            <aside className="teacher-draft-controls">
              {quiz.status === "draft" && publishedCount === null ? (
                <>
                  <section className="panel teacher-control-panel">
                    <div className="teacher-step-title">
                      <span className="summary-icon">
                        <Icon name="spark" />
                      </span>
                      <div>
                        <h2>
                          {quiz.questions.length
                            ? "Refine your questions"
                            : "Generate questions"}
                        </h2>
                        <p className="muted">Your notes guide the AI.</p>
                      </div>
                    </div>
                    {task.actionError ? (
                      <Notice>{task.actionError}</Notice>
                    ) : null}
                    {task.submitting ? (
                      <Loading>Requesting generation…</Loading>
                    ) : running ? (
                      <div className="generation-state">
                        <Loading>Preparing your questions…</Loading>
                        <p>
                          You can leave this page and return later. The accepted
                          request’s instructions stay unchanged.
                        </p>
                      </div>
                    ) : state?.status === "failed" ? (
                      <Notice>
                        <strong>The latest generation failed.</strong>
                        <p>
                          {state.error
                            ? errorMessage(
                                new ApiError(
                                  state.error.http_status ?? 502,
                                  state.error,
                                ),
                              )
                            : "Please try again."}{" "}
                          Your previous draft is preserved.
                        </p>
                      </Notice>
                    ) : state?.status === "success" ? (
                      <Notice kind="success">
                        Questions ready. Review the current draft before
                        publishing.
                      </Notice>
                    ) : null}
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!fresh || busy) return;
                        setReviewed(null);
                        setPublishError("");
                        void store.generate(id, {
                          expected_revision: quiz.revision,
                          prompt,
                          action:
                            state?.status === "not_requested"
                              ? "ensure"
                              : "new",
                        });
                      }}
                    >
                      <label>
                        Generation instructions <small>(optional)</small>
                        <textarea
                          value={prompt}
                          onChange={(event) => setPrompt(event.target.value)}
                          maxLength={1000}
                          rows={5}
                          disabled={busy || task.canRepeat}
                          placeholder={
                            quiz.questions.length
                              ? "e.g. Focus on the first two sections and simplify the wording."
                              : "e.g. Include application questions and keep the difficulty moderate."
                          }
                        />
                        <small>
                          {prompt.length}/1,000 characters ·{" "}
                          {quiz.question_count} questions
                        </small>
                      </label>
                      {task.canRepeat ? (
                        <>
                          <p className="teacher-action-help">
                            The server may have accepted your request. Check its
                            state or repeat the same request safely.
                          </p>
                          <button
                            type="button"
                            className="button button-secondary"
                            disabled={busy || task.reading || !!task.readError}
                            onClick={() => {
                              setReviewed(null);
                              void store.generate(
                                id,
                                {
                                  expected_revision: quiz.revision,
                                  prompt,
                                  action: "ensure",
                                },
                                true,
                              );
                            }}
                          >
                            Repeat previous request
                          </button>
                        </>
                      ) : (
                        <button
                          className="button button-primary"
                          type="submit"
                          disabled={!fresh || busy}
                        >
                          <Icon name="spark" />
                          {state?.status === "failed"
                            ? "Retry generation"
                            : quiz.questions.length
                              ? "Regenerate questions"
                              : "Generate questions"}
                        </button>
                      )}
                    </form>
                    <p className="teacher-action-help">
                      AI can make mistakes. You’re responsible for the answer
                      key and explanations.
                    </p>
                  </section>
                  <section className="panel teacher-control-panel">
                    <div className="teacher-step-title">
                      <span className="summary-icon">
                        <Icon name="check" />
                      </span>
                      <div>
                        <h2>Ready to share?</h2>
                        <p className="muted">
                          Review first. Publish when ready.
                        </p>
                      </div>
                    </div>
                    <p className="teacher-action-help">
                      Publishing freezes these questions and assigns one attempt
                      to every student currently in the class. At least one
                      student must be assigned.
                    </p>
                    <label className="teacher-review-check">
                      <input
                        type="checkbox"
                        checked={reviewed === reviewToken}
                        disabled={!complete || !fresh || busy}
                        onChange={(event) =>
                          setReviewed(event.target.checked ? reviewToken : null)
                        }
                      />
                      <span>
                        I have reviewed every question, correct answer, and
                        explanation in revision {quiz.revision}.
                      </span>
                    </label>
                    {publishError ? <Notice>{publishError}</Notice> : null}
                    <button
                      className="button button-primary"
                      disabled={!publishable}
                      onClick={() => void publish()}
                    >
                      <Icon name="check" />
                      {publishing ? "Publishing…" : "Publish quiz"}
                    </button>
                  </section>
                  <section
                    className="panel teacher-control-panel"
                    aria-label="Delete draft"
                  >
                    <h2>Delete draft</h2>
                    <p className="teacher-action-help">
                      Permanently delete this draft and its questions. Its
                      uploaded notes are also deleted if no other quiz uses
                      them.
                    </p>
                    {running ? (
                      <p className="muted">
                        Wait for quiz generation to finish before deleting.
                      </p>
                    ) : null}
                    {deleteError ? <Notice>{deleteError}</Notice> : null}
                    {confirmDelete ? (
                      <>
                        <p>Delete this draft permanently?</p>
                        <button
                          className="button button-secondary"
                          disabled={!deletable}
                          onClick={() => void deleteDraft()}
                          style={{ background: "red", color: "white" }}
                        >
                          {deleting ? "Deleting…" : "Confirm deletion"}
                        </button>
                        <button
                          className="text-button"
                          disabled={deleting}
                          onClick={() => setConfirmDelete(false)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="button button-secondary"
                        disabled={!deletable}
                        onClick={() => setConfirmDelete(true)}
                      >
                        Delete draft
                      </button>
                    )}
                  </section>
                </>
              ) : (
                <section className="panel teacher-control-panel">
                  <Icon name="lock" />
                  <h2>This quiz is published</h2>
                  <p className="teacher-action-help">
                    Its content is fixed. Create a new quiz to share a different
                    set of questions.
                  </p>
                  <a
                    className="button button-secondary"
                    href={`#/teacher/create?class=${quiz.class_id}`}
                  >
                    <Icon name="plus" />
                    Create another quiz
                  </a>
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </>
  );
}
