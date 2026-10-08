import { useState } from "react";
import type { ClassRoom, TeacherQuizItem } from "../api/types";
import { EmptyState, formatDate, Icon, PageHeading } from "../shared/ui";

interface Lists {
  classes: ClassRoom[];
  quizzes: TeacherQuizItem[];
}
export function TeacherClasses({
  classes,
  quizzes,
  name,
}: Lists & { name: string }) {
  return (
    <>
      <PageHeading
        eyebrow="YOUR TEACHING SPACE"
        title={`Welcome, ${name.split(" ")[0]}.`}
        description="Bring your notes to life, one thoughtful quiz at a time."
        action={
          <a className="button button-primary" href="#/teacher/create">
            <Icon name="plus" />
            Create quiz
          </a>
        }
      />
      <div className="teacher-section-heading">
        <h2>
          My classes <span className="badge">{classes.length}</span>
        </h2>
        <p className="muted">Your administrator manages class assignments.</p>
      </div>
      {classes.length ? (
        <div className="teacher-class-grid">
          {classes.map((item) => {
            const own = quizzes.filter((quiz) => quiz.class_id === item.id);
            return (
              <article className="panel teacher-class-card" key={item.id}>
                <span className="class-card-icon">
                  <Icon name="class" />
                </span>
                <h3>{item.name}</h3>
                <p className="muted">
                  {own.filter((quiz) => quiz.status === "draft").length} drafts
                  · {own.filter((quiz) => quiz.status === "published").length}{" "}
                  published
                </p>
                <div className="teacher-card-actions">
                  <a
                    className="text-button"
                    href={`#/teacher/quizzes?class=${item.id}`}
                  >
                    View quizzes
                    <Icon name="arrow" />
                  </a>
                  <a
                    className="button button-secondary"
                    href={`#/teacher/create?class=${item.id}`}
                  >
                    <Icon name="plus" />
                    Create quiz
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <EmptyState title="Your classroom is on its way">
            Ask your administrator to assign you to a class before creating a
            quiz.
          </EmptyState>
        </section>
      )}
    </>
  );
}

export function TeacherQuizzes({
  classes,
  quizzes,
  classId,
}: Lists & { classId: number | null }) {
  const [selectedClass, setSelectedClass] = useState(
    classId ? String(classId) : "",
  );
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const filtered = quizzes.filter(
    (quiz) =>
      (!selectedClass || quiz.class_id === Number(selectedClass)) &&
      (!status || quiz.status === status) &&
      `${quiz.title} ${quiz.class_name}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="CREATE, REVIEW, SHARE"
        title="My quizzes"
        description="Pick up a draft or revisit the questions you’ve shared."
        action={
          <a
            className="button button-primary"
            href={`#/teacher/create${selectedClass ? `?class=${selectedClass}` : ""}`}
          >
            <Icon name="plus" />
            Create quiz
          </a>
        }
      />
      <section className="panel">
        <div className="teacher-filters">
          <label>
            Search quizzes
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by title or class…"
            />
          </label>
          <label>
            Class
            <select
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
            >
              <option value="">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All quizzes</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </label>
        </div>
        {filtered.length ? (
          <ul className="teacher-quiz-list">
            {filtered.map((quiz) => (
              <li key={quiz.id}>
                <a href={`#/teacher/quiz/${quiz.id}`}>
                  <span className="class-card-icon">
                    <Icon
                      name={quiz.status === "published" ? "check" : "book"}
                    />
                  </span>
                  <div className="teacher-quiz-title">
                    <strong>{quiz.title}</strong>
                    <small>
                      {quiz.class_name} · {quiz.question_count} questions ·{" "}
                      {formatDate(quiz.published_at ?? quiz.created_at)}
                    </small>
                  </div>
                  <span
                    className={`badge ${quiz.status === "published" ? "badge-success" : "badge-pending"}`}
                  >
                    {quiz.status === "published" ? "Published" : "Draft"}
                  </span>
                  <span className="teacher-quiz-action">
                    {quiz.status === "published" ? "View quiz" : "Review draft"}
                    <Icon name="arrow" />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon="book"
            title={
              quizzes.length
                ? "No matching quizzes"
                : "Your first quiz starts with your notes"
            }
          >
            {quizzes.length
              ? "Try another class, status, or search term."
              : "Upload a DOCX, generate questions, and review them before publishing."}
          </EmptyState>
        )}
      </section>
    </>
  );
}
