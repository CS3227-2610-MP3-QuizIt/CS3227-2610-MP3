import { useState } from "react";
import type { FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { User } from "../api/types";
import { EmptyState, Icon, Notice, PageHeading, RoleBadge } from "../shared/ui";

export function AccountsPage({
  users,
  refresh,
}: {
  users: User[];
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const visible = users.filter(
    (user) =>
      (filter === "all" || user.role === filter) &&
      `${user.username} ${user.display_name}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const user = await api.createUser({
        username: String(fields.get("username")).trim(),
        display_name: String(fields.get("display_name")).trim(),
        password: String(fields.get("password")),
        role,
      });
      form.reset();
      setOpen(false);
      setMessage(`Account created for ${user.display_name}.`);
      await refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="PEOPLE & ACCESS"
        title="Accounts"
        description="Give students and teachers a place in your classroom."
        action={
          <button
            className="button button-primary"
            onClick={() => {
              setOpen(!open);
              setError("");
              setMessage("");
            }}
            aria-expanded={open}
          >
            <Icon name="plus" />
            {open ? "Close form" : "Create account"}
          </button>
        }
      />
      {message ? <Notice kind="success">{message}</Notice> : null}
      {open ? (
        <section className="panel creation-panel">
          <div>
            <h2>Create an account</h2>
            <p className="muted">
              Share the initial password with the account holder securely.
            </p>
          </div>
          <form onSubmit={create} className="form-grid">
            <label>
              Display name
              <input
                name="display_name"
                required
                maxLength={100}
                placeholder="e.g. Alex Tan"
                disabled={busy}
              />
            </label>
            <label>
              Username
              <input
                name="username"
                required
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9_.\-]+"
                placeholder="e.g. alex.tan"
                aria-describedby="username-help"
                disabled={busy}
              />
              <small id="username-help">
                3–50 letters, numbers, periods, underscores, or hyphens.
              </small>
            </label>
            <label>
              Role
              <select
                value={role}
                onChange={(e) =>
                  setRole(e.target.value as "student" | "teacher")
                }
                disabled={busy}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
              </select>
            </label>
            <label>
              Initial password
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                aria-describedby="password-help"
                disabled={busy}
              />
              <small id="password-help">Use 12–128 characters.</small>
            </label>
            <div className="form-actions">
              {error ? <Notice>{error}</Notice> : null}
              <button className="button button-primary" disabled={busy}>
                {busy ? "Creating…" : "Create account"}
                <Icon name="arrow" />
              </button>
            </div>
          </form>
        </section>
      ) : null}
      <section className="panel">
        <div className="panel-toolbar">
          <div className="tabs" aria-label="Filter accounts">
            {["all", "student", "teacher"].map((value) => (
              <button
                key={value}
                className={filter === value ? "tab active" : "tab"}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "All accounts"
                  : `${value[0].toUpperCase()}${value.slice(1)}s`}
                <span>
                  {value === "all"
                    ? users.length
                    : users.filter((user) => user.role === value).length}
                </span>
              </button>
            ))}
          </div>
          <label className="search-field">
            <Icon name="search" />
            <input
              aria-label="Search accounts"
              placeholder="Search people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {visible.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Username</th>
                  <th scope="col">Role</th>
                  <th scope="col">Account ID</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="person">
                        <span className={`avatar avatar-${user.role}`}>
                          {user.display_name.slice(0, 1).toUpperCase()}
                        </span>
                        <strong>{user.display_name}</strong>
                      </div>
                    </td>
                    <td className="muted">{user.username}</td>
                    <td>
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="muted">#{user.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon="users"
            title={
              users.length ? "No matching accounts" : "Your people go here"
            }
          >
            {users.length
              ? "Try a different name or account filter."
              : "Create your first student or teacher account to get started."}
          </EmptyState>
        )}
        <div className="table-footer">
          {visible.length} {visible.length === 1 ? "account" : "accounts"}
          <span>One account. One role.</span>
        </div>
      </section>
    </>
  );
}
