import { useState, useSyncExternalStore } from "react";
import { errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { Brand, EmptyState, Icon, Notice } from "../shared/ui";
import { useAIEvents } from "../shared/useAIEvents";
import { HintStore } from "./HintStore";
import { QuizList } from "./QuizList";
import { QuizPage } from "./QuizPage";
import "./student.css";
const subscribeRoute = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
const routeSnapshot = () => window.location.hash;
const createStore = () => new HintStore();
export function StudentApp() {
  const { user, signOut } = useAuth();
  const store = useAIEvents(createStore);
  const hash = useSyncExternalStore(subscribeRoute, routeSnapshot);
  const parts = hash.replace(/^#/, "").split("/");
  const page = parts[1] === "student" ? parts[2] || "quizzes" : "quizzes";
  const id = Number(parts[3]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  return (
    <div className="app-shell student-workspace">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand-link"
          href="#/student/quizzes"
          aria-label="Classroom student home"
        >
          <Brand />
        </a>
        <div className="workspace-label">STUDENT WORKSPACE</div>
        <nav aria-label="Student navigation">
          <a
            className="nav-link active"
            href="#/student/quizzes"
            aria-current={page === "quizzes" ? "page" : undefined}
          >
            <Icon name="book" />
            My quizzes
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-icon">
            <Icon name="spark" />
          </span>
          <h3>A little practice. A clearer picture.</h3>
          <p>
            Take your time, use a hint when you need one, and learn from every
            answer.
          </p>
        </div>
        <div className="sidebar-account">
          <div className="person">
            <span className="avatar">
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.display_name}</strong>
              <small>Student</small>
            </div>
          </div>
          <button
            className="icon-button"
            disabled={busy}
            aria-label={busy ? "Signing out" : "Sign out"}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await signOut();
              } catch (error) {
                setError(errorMessage(error));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>
              {page === "attempt"
                ? "Quiz attempt"
                : page === "results"
                  ? "Quiz results"
                  : "My quizzes"}
            </strong>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {error ? <Notice>{error}</Notice> : null}
          {page === "quizzes" ? (
            <QuizList />
          ) : (page === "attempt" || page === "results") &&
            Number.isSafeInteger(id) &&
            id > 0 ? (
            store ? (
              <QuizPage
                key={`${page}:${id}`}
                id={id}
                resultsOnly={page === "results"}
                store={store}
              />
            ) : null
          ) : (
            <EmptyState title="Page not found">
              Choose My quizzes to continue.
            </EmptyState>
          )}
        </main>
      </div>
    </div>
  );
}
