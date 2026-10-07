import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { api, errorMessage } from "../api/client";
import type { ClassRoom, User } from "../api/types";
import { useResource } from "../shared/useResource";
import {
  EmptyState,
  Icon,
  Loading,
  Notice,
  PageHeading,
  RoleBadge,
  formatDate,
} from "../shared/ui";

export function ClassesPage({
  classes,
  users,
  selectedId,
  refresh,
}: {
  classes: ClassRoom[];
  users: User[];
  selectedId: number | null;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = classes.find((item) => item.id === selectedId);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name")).trim();
    if (!name) {
      setError("Enter a class name.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const created = await api.createClass(name);
      form.reset();
      setOpen(false);
      await refresh();
      setMessage(`${created.name} is ready. Assign members to get started.`);
      window.location.hash = `/admin/classes?id=${created.id}`;
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZE YOUR CLASSROOM"
        title="Classes"
        description="Bring the right students and teachers together."
        action={
          <button
            className="button button-primary"
            onClick={() => {
              setOpen(!open);
              setError("");
            }}
            aria-expanded={open}
          >
            <Icon name="plus" />
            {open ? "Close form" : "Create class"}
          </button>
        }
      />
      {message ? <Notice kind="success">{message}</Notice> : null}
      {open ? (
        <section className="panel creation-panel">
          <h2>A new place to learn</h2>
          <form className="inline-form" onSubmit={create}>
            <label>
              Class name
              <input
                name="name"
                required
                maxLength={150}
                placeholder="e.g. CS3227 · Software Engineering"
                disabled={busy}
              />
            </label>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Creating…" : "Create class"}
            </button>
          </form>
          {error ? <Notice>{error}</Notice> : null}
        </section>
      ) : null}
      {classes.length ? (
        <div className="class-layout">
          <section className="class-list" aria-label="Classes">
            {classes.map((item) => (
              <a
                key={item.id}
                href={`#/admin/classes?id=${item.id}`}
                className={`class-card ${selected?.id === item.id ? "selected" : ""}`}
                aria-current={selected?.id === item.id ? "page" : undefined}
              >
                <div className="class-card-icon">
                  <Icon name="class" />
                </div>
                <div>
                  <h3>{item.name}</h3>
                  <p>Created {formatDate(item.created_at)}</p>
                </div>
                <Icon name="arrow" />
              </a>
            ))}
          </section>
          {selected ? (
            <MembersPanel
              key={selected.id}
              classroom={selected}
              users={users}
            />
          ) : (
            <section className="panel">
              <EmptyState
                title={selectedId ? "Class not found" : "Choose a class"}
              >
                {selectedId
                  ? "Select an available class to manage its members."
                  : "Select a class to view and manage its students and teachers."}
              </EmptyState>
            </section>
          )}
        </div>
      ) : (
        <section className="panel">
          <EmptyState title="Start with a class">
            Create a class, then assign its students and teachers.
          </EmptyState>
        </section>
      )}
    </>
  );
}

function MembersPanel({
  classroom,
  users,
}: {
  classroom: ClassRoom;
  users: User[];
}) {
  const load = useCallback(
    (signal: AbortSignal) => api.members(classroom.id, signal),
    [classroom.id],
  );
  const resource = useResource(load);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const members = resource.data?.items ?? [];
  const available = users.filter(
    (user) => !members.some((member) => member.id === user.id),
  );
  async function change(userId: number, assign: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (assign) await api.assign(classroom.id, userId);
      else await api.unassign(classroom.id, userId);
      setAccountId("");
      setMessage(
        assign
          ? "Member assigned to this class."
          : "Member removed. Existing published student attempts are preserved.",
      );
      await resource.refresh();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel members-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">CLASS MEMBERS</span>
          <h2>{classroom.name}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Refresh members"
          onClick={() => {
            void resource.refresh();
          }}
          disabled={busy || resource.loading}
        >
          <Icon name="refresh" />
        </button>
      </div>
      <p className="membership-note">
        Membership changes apply to future quizzes. Published student rosters
        stay the same. Removing a teacher prevents further draft management and
        publication.
      </p>
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
      {error ? <Notice>{error}</Notice> : null}
      {message ? <Notice kind="success">{message}</Notice> : null}
      {resource.data ? (
        <>
          <form
            className="assign-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (accountId) void change(Number(accountId), true);
            }}
          >
            <label>
              Assign an account
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={busy || resource.loading}
                required
              >
                <option value="">Choose a student or teacher</option>
                {available.map((user) => (
                  <option value={user.id} key={user.id}>
                    {user.display_name} (@{user.username}) · {user.role}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button-primary"
              disabled={!accountId || busy || resource.loading}
            >
              <Icon name="plus" />
              Assign
            </button>
          </form>
          <div className="member-counts">
            <span>
              {members.filter((member) => member.role === "student").length}{" "}
              students
            </span>
            <span>
              {members.filter((member) => member.role === "teacher").length}{" "}
              teachers
            </span>
          </div>
          {members.length ? (
            <ul className="member-list">
              {members.map((member) => (
                <li key={member.id}>
                  <div className="person">
                    <span className={`avatar avatar-${member.role}`}>
                      {member.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{member.display_name}</strong>
                      <small>@{member.username}</small>
                    </div>
                  </div>
                  <RoleBadge role={member.role} />
                  <button
                    className="text-button remove-button"
                    aria-label={`Unassign ${member.display_name}`}
                    disabled={busy || resource.loading}
                    onClick={() => {
                      void change(member.id, false);
                    }}
                  >
                    Unassign
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="users" title="A class waiting for its people">
              Assign a student or teacher using the selector above.
            </EmptyState>
          )}
        </>
      ) : resource.loading ? (
        <Loading>Loading members…</Loading>
      ) : null}
      {busy ? <Loading>Updating membership…</Loading> : null}
    </section>
  );
}
