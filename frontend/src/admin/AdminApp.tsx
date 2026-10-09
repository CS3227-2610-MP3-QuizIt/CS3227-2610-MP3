import { useCallback, useState, useSyncExternalStore } from "react";
import { api, errorMessage } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import {
  Brand,
  EmptyState,
  Icon,
  Loading,
  Notice,
  PageHeading,
} from "../shared/ui";
import type { IconName } from "../shared/ui";
import { useResource } from "../shared/useResource";
import { useAIEvents } from "../shared/useAIEvents";
import { AccountsPage } from "./AccountsPage";
import { ClassesPage } from "./ClassesPage";
import { PerformancePage } from "./PerformancePage";
import { SummaryStore } from "./SummaryStore";

const links: { slug: string; label: string; icon: IconName }[] = [
  { slug: "overview", label: "Overview", icon: "grid" },
  { slug: "accounts", label: "Accounts", icon: "users" },
  { slug: "classes", label: "Classes", icon: "class" },
  { slug: "performance", label: "Quiz performance", icon: "chart" },
];
const subscribeRoute = (listener: () => void) => {
  window.addEventListener("hashchange", listener);
  return () => window.removeEventListener("hashchange", listener);
};
const routeSnapshot = () => window.location.hash;
const createStore = () => new SummaryStore();
const loadAdmin = async () => {
  const [users, classes, quizzes] = await Promise.all([
    api.users(),
    api.classes(),
    api.quizzes(),
  ]);
  return { users: users.items, classes: classes.items, quizzes: quizzes.items };
};

export function AdminApp() {
  const { user, signOut } = useAuth();
  const resource = useResource(loadAdmin);
  const store = useAIEvents(createStore);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const hash = useSyncExternalStore(subscribeRoute, routeSnapshot);
  const [path, query] = hash.replace(/^#/, "").split("?");
  const slug = path?.split("/")[2] || "overview";
  const page = links.find((link) => link.slug === slug);
  const id = Number(new URLSearchParams(query).get("id")) || null;
  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      await signOut();
    } catch (error) {
      setLogoutError(errorMessage(error));
    } finally {
      setLoggingOut(false);
    }
  }, [signOut, loggingOut]);
  if (!user) return null;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand-link"
          href="#/admin/overview"
          aria-label="Classroom overview"
        >
          <Brand />
        </a>
        <div className="workspace-label">ADMIN WORKSPACE</div>
        <nav aria-label="Admin navigation">
          {links.map((link) => (
            <a
              href={`#/admin/${link.slug}`}
              className={`nav-link ${slug === link.slug ? "active" : ""}`}
              key={link.slug}
              aria-current={slug === link.slug ? "page" : undefined}
            >
              <Icon name={link.icon} />
              {link.label}
              {slug === link.slug ? <span className="nav-indicator" /> : null}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-note-icon">
            <Icon name="book" />
          </span>
          <h3>A place for every learner.</h3>
          <p>Keep your classes connected and your learning in focus.</p>
        </div>
        <div className="sidebar-account">
          <div className="person">
            <span className="avatar avatar-admin">
              {user.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.display_name}</strong>
              <small>Administrator</small>
            </div>
          </div>
          <button
            className="icon-button"
            disabled={loggingOut}
            aria-label={loggingOut ? "Signing out" : "Sign out"}
            onClick={() => {
              void logout();
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
            <strong>{page?.label ?? "Page not found"}</strong>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {logoutError ? <Notice>{logoutError}</Notice> : null}
          {resource.error ? (
            <Notice>
              {resource.error}{" "}
              <button
                className="text-button"
                onClick={() => {
                  void resource.refresh();
                }}
              >
                Try again
              </button>
            </Notice>
          ) : null}
          {resource.data ? (
            <>
              {slug === "overview" ? (
                <Overview data={resource.data} name={user.display_name} />
              ) : slug === "accounts" ? (
                <AccountsPage
                  users={resource.data.users}
                  refresh={resource.refresh}
                />
              ) : slug === "classes" ? (
                <ClassesPage
                  classes={resource.data.classes}
                  users={resource.data.users}
                  selectedId={id}
                  refresh={resource.refresh}
                />
              ) : slug === "performance" && store ? (
                <PerformancePage
                  quizzes={resource.data.quizzes}
                  classes={resource.data.classes}
                  selectedId={id}
                  store={store}
                />
              ) : (
                <EmptyState title="Page not found">
                  Choose a page from the admin navigation.
                </EmptyState>
              )}
            </>
          ) : resource.loading ? (
            <Loading>Getting your workspace ready…</Loading>
          ) : null}
          <footer className="workspace-footer">
            <Brand />
            <span>A little progress, every day.</span>
            <button
              className="text-button"
              disabled={resource.loading}
              onClick={() => {
                void resource.refresh();
              }}
            >
              {resource.loading ? "Refreshing…" : "Refresh workspace"}
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Overview({
  data,
  name,
}: {
  data: Awaited<ReturnType<typeof loadAdmin>>;
  name: string;
}) {
  const students = data.users.filter((user) => user.role === "student").length;
  const teachers = data.users.filter((user) => user.role === "teacher").length;
  return (
    <>
      <PageHeading
        eyebrow="YOUR CLASSROOM AT A GLANCE"
        title={`Welcome, ${name.split(" ")[0]}.`}
        description="A good day to bring people and learning together."
      />
      <section className="stat-grid" aria-label="Workspace totals">
        {[
          {
            label: "Students",
            value: students,
            icon: "users",
            href: "accounts",
            note: "Ready to learn",
          },
          {
            label: "Teachers",
            value: teachers,
            icon: "class",
            href: "accounts",
            note: "Guiding the way",
          },
          {
            label: "Classes",
            value: data.classes.length,
            icon: "book",
            href: "classes",
            note: "Places to connect",
          },
          {
            label: "Published quizzes",
            value: data.quizzes.length,
            icon: "chart",
            href: "performance",
            note: "Learning in action",
          },
        ].map((stat) => (
          <a
            className="stat-card"
            key={stat.label}
            href={`#/admin/${stat.href}`}
          >
            <div>
              <span>{stat.label}</span>
              <Icon name={stat.icon as IconName} />
            </div>
            <strong>{stat.value}</strong>
            <p>
              {stat.note}
              <Icon name="arrow" />
            </p>
          </a>
        ))}
      </section>
      <div className="overview-bottom">
        <section className="panel">
          <div className="panel-heading">
            <h2>Your classes</h2>
            <a className="text-button" href="#/admin/classes">
              View all
              <Icon name="arrow" />
            </a>
          </div>
          {data.classes.length ? (
            <ul className="overview-class-list">
              {data.classes.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <a href={`#/admin/classes?id=${item.id}`}>
                    <span className="class-card-icon">
                      <Icon name="class" />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <small>Manage students and teachers</small>
                    </div>
                    <Icon name="arrow" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Your first class starts here">
              Create a class and bring your students and teachers together.
            </EmptyState>
          )}
        </section>
        <section className="getting-started">
          <span className="eyebrow">A SIMPLE START</span>
          <h2>Set learning in motion.</h2>
          <ol>
            <li>
              <span>1</span>
              <div>
                <a href="#/admin/accounts">Create your accounts</a>
                <p>Welcome students and teachers.</p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <a href="#/admin/classes">Bring your classes together</a>
                <p>Assign the people who belong.</p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <a href="#/admin/performance">Look beyond the score</a>
                <p>Explore results after everyone submits.</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}
