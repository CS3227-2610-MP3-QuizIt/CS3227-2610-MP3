import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, errorMessage } from "../api/client";
import { Brand, Icon, Notice } from "../shared/ui";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { signIn, error: connectionError, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signIn(username.trim(), password);
    } catch (error) {
      setPassword("");
      setError(
        error instanceof ApiError &&
          (error.status === 401 || error.status === 422)
          ? "Unable to sign in. Check your username and password."
          : error instanceof ApiError && error.code === "LOGIN_RATE_LIMIT"
            ? `Too many sign-in attempts. Please try again${error.retryAfter != null ? ` in ${error.retryAfter} seconds` : " later"}.`
            : errorMessage(error),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand light />
        <div className="login-story-body">
          <span className="story-label">
            A little clarity. A lot of possibility.
          </span>
          <h1>
            Good learning
            <br />
            starts with
            <br />
            <span>good questions.</span>
          </h1>
          <p>
            One place to bring your classes together, turn knowledge into
            quizzes, and see learning take shape.
          </p>
          <div className="learning-illustration" aria-hidden="true">
            <div className="illustration-card">
              <span className="tiny-label">THE LEARNING CYCLE</span>
              <div className="cycle-step">
                <span>01</span> Bring your class together <Icon name="users" />
              </div>
              <div className="cycle-step">
                <span>02</span> Make space for questions <Icon name="book" />
              </div>
              <div className="cycle-step">
                <span>03</span> Discover what comes next <Icon name="spark" />
              </div>
            </div>
            <span className="illustration-note">
              <Icon name="check" /> Every question is a step forward.
            </span>
          </div>
        </div>
        <p className="login-footer">
          Built for the classroom. Designed for learning.
        </p>
      </section>
      <section className="login-form-section">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-form-wrap">
          <span className="section-tag">
            <Icon name="lock" /> YOUR CLASSROOM, CONNECTED
          </span>
          <h2>Welcome back.</h2>
          <p className="muted">Sign in to pick up where you left off.</p>
          {connectionError ? (
            <Notice>
              {connectionError}{" "}
              <button className="text-button" onClick={refresh}>
                Reconnect
              </button>
            </Notice>
          ) : null}
          <form onSubmit={submit} className="form-stack">
            <label>
              Username
              <input
                name="username"
                autoComplete="username"
                required
                minLength={3}
                maxLength={50}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={busy}
              />
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {error ? <Notice>{error}</Notice> : null}
            <button
              className="button button-primary login-submit"
              disabled={busy}
            >
              {busy ? "Signing in…" : "Sign in"}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="login-help">
            Your account is provided by your administrator.
            <br />
            Need access? Contact your class administrator.
          </p>
          <div className="secure-note">
            <Icon name="lock" /> A secure space for students, teachers, and
            admins.
          </div>
        </div>
        <p className="login-copyright">
          CLASSROOM &nbsp; / &nbsp; LEARN SOMETHING NEW
        </p>
      </section>
    </main>
  );
}
