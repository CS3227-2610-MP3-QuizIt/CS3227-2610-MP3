import { useState, useSyncExternalStore } from "react";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { Brand, EmptyState, Icon, Loading, Notice } from "../shared/ui";
import { useResource } from "../shared/useResource";
import { useAIEvents } from "../shared/useAIEvents";
import { GenerationStore } from "./GenerationStore";
import { TeacherClasses, TeacherQuizzes } from "./TeacherLists";
import { CreateQuizPage } from "./CreateQuizPage";
import { DraftPage } from "./DraftPage";
import "./teacher.css";

const subscribeRoute = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
const routeSnapshot = () => window.location.hash;
const createStore = () => new GenerationStore();
const loadTeacher = async (signal: AbortSignal) => {
  const [classes, quizzes] = await Promise.all([
    api.classes(signal),
    api.teacherQuizzes(signal),
  ]);
  return { classes: classes.items, quizzes: quizzes.items };
};

export function TeacherApp() {
  const { user, signOut } = useAuth();
  const resource = useResource(loadTeacher);
  const store = useAIEvents(createStore);
  const hash = useSyncExternalStore(subscribeRoute, routeSnapshot);
  const [path, query] = hash.replace(/^#/, "").split("?");
  const parts = path?.split("/") ?? [];
  const slug = parts[1] === "teacher" ? parts[2] || "classes" : "classes";
  const params = new URLSearchParams(query);
  const classId = Number(params.get("class")) || null;
  const quizId = Number(parts[3]);
  const label = (
    {
      classes: "My classes",
      quizzes: "My quizzes",
      create: "Create quiz",
      quiz: "Quiz review",
    } as Record<string, string>
  )[slug];
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  if (!user) return null;
  return (
    <div className="app-shell teacher-workspace">
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
          href="#/teacher/classes"
          aria-label="Classroom teacher home"
        >
          <Brand />
        </a>
        <div className="workspace-label">TEACHER WORKSPACE</div>
        <nav aria-label="Teacher navigation">
          {(
            [
              { slug: "classes", label: "My classes", icon: "class" },
              { slug: "quizzes", label: "My quizzes", icon: "book" },
              { slug: "create", label: "Create quiz", icon: "plus" },
            ] as const
          ).map((link) => (
            <a
              key={link.slug}
              href={`#/teacher/${link.slug}`}
              className={`nav-link ${slug === link.slug || (link.slug === "quizzes" && slug === "quiz") ? "active" : ""}`}
              aria-current={slug === link.slug ? "page" : undefined}
            >
              <Icon name={link.icon} />
              {link.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-icon">
            <Icon name="spark" />
          </span>
          <h3>Your notes. New possibilities.</h3>
          <p>
            Turn your teaching material into thoughtful questions. Review every
            answer before sharing.
          </p>
        </div>
        <div className="sidebar-account">
          <div className="person">
            <span className="avatar avatar-teacher">
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.display_name}</strong>
              <small>Teacher</small>
            </div>
          </div>
          <button
            className="icon-button"
            disabled={loggingOut}
            aria-label={loggingOut ? "Signing out" : "Sign out"}
            onClick={async () => {
              setLoggingOut(true);
              setLogoutError("");
              try {
                await signOut();
              } catch (error) {
                setLogoutError(errorMessage(error));
              } finally {
                setLoggingOut(false);
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
            <strong>{label ?? "Page not found"}</strong>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {logoutError ? <Notice>{logoutError}</Notice> : null}
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
          {resource.data ? (
            <>
              {slug === "classes" ? (
                <TeacherClasses {...resource.data} name={user.display_name} />
              ) : slug === "quizzes" ? (
                <TeacherQuizzes
                  key={classId}
                  {...resource.data}
                  classId={classId}
                />
              ) : slug === "create" ? (
                <CreateQuizPage
                  key={classId}
                  classes={resource.data.classes}
                  initialClassId={classId}
                  onCreated={resource.refresh}
                />
              ) : slug === "quiz" &&
                Number.isSafeInteger(quizId) &&
                quizId > 0 &&
                store ? (
                <DraftPage
                  key={quizId}
                  id={quizId}
                  classes={resource.data.classes}
                  store={store}
                  onPublished={resource.refresh}
                  onDeleted={resource.refresh}
                />
              ) : (
                <EmptyState title="Page not found">
                  Choose a page from the teacher navigation.
                </EmptyState>
              )}
            </>
          ) : resource.loading ? (
            <Loading>Getting your workspace ready…</Loading>
          ) : null}
        </main>
      </div>
    </div>
  );
}
