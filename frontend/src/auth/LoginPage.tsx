import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, LoginFlowError } from "../api/client";
import { Brand, Icon, Notice } from "../shared/ui";
import { useAuth } from "./AuthProvider";

type Errors = { username?: string; password?: string };
const usernamePattern = /^[A-Za-z0-9_.-]+$/;

export function LoginPage() {
  const {
    signIn,
    error: connectionError,
    sessionEnded,
    uncertainSignIn,
    checkSession,
  } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const checkingRef = useRef(false);
  const uncertainRef = useRef(uncertainSignIn);
  uncertainRef.current = uncertainSignIn;
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Sign in · QuizIt";
    return () => {
      document.title = previousTitle;
    };
  }, []);
  const recovery = uncertainSignIn;
  async function runCheck() {
    if (checkingRef.current || busyRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setMessage("Checking your session…");
    const outcome = await checkSession();
    checkingRef.current = false;
    setChecking(false);
    if (outcome === "signed-in") return;
    setMessage(
      outcome === "failed"
        ? "Unable to check your session. Check your connection and try again."
        : sessionEnded
          ? "Your session has ended. Sign in again to continue."
          : "You’re signed out. Sign in to continue.",
    );
  }
  function validate(): Errors {
    const normalized = username.trim();
    const next: Errors = {};
    if (!normalized) next.username = "Enter your username.";
    else if (normalized.length < 3)
      next.username = "Enter at least 3 characters for your username.";
    else if (normalized.length > 50)
      next.username = "Enter no more than 50 characters for your username.";
    else if (!usernamePattern.test(normalized))
      next.username =
        "Use only letters, numbers, underscores, dots, or hyphens in your username.";
    if (!password) next.password = "Enter your password.";
    else if (password.length > 128)
      next.password = "Enter no more than 128 characters for your password.";
    return next;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || checkingRef.current) return;
    if (recovery) {
      await runCheck();
      return;
    }
    const next = validate();
    setErrors(next);
    setMessage("");
    if (next.username || next.password) {
      (next.username ? usernameRef : passwordRef).current?.focus();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      await signIn(username.trim(), password);
    } catch (caught) {
      setPassword("");
      const flow = caught instanceof LoginFlowError ? caught : null;
      const error = flow
        ? (caught as Error & { cause?: unknown }).cause
        : caught;
      if (flow?.stage === "identity") {
        setMessage(
          "We couldn’t confirm your sign-in. Check your session before entering your details again.",
        );
      } else if (
        error instanceof ApiError &&
        error.code === "LOGIN_RATE_LIMIT"
      ) {
        setMessage(
          "Too many sign-in attempts. Please wait before trying again.",
        );
      } else if (
        error instanceof ApiError &&
        error.status === 401 &&
        error.code === "INVALID_CREDENTIALS"
      ) {
        setMessage("Unable to sign in. Check your username and password.");
        window.setTimeout(() => passwordRef.current?.focus(), 0);
      } else if (
        error instanceof ApiError &&
        error.code === "REQUEST_TIMEOUT"
      ) {
        setMessage(
          "The sign-in request timed out. Check your session before trying to sign in again.",
        );
      } else if (uncertainRef.current) {
        setMessage(
          "We couldn’t confirm your sign-in. Check your session before entering your details again.",
        );
      } else if (error instanceof ApiError && error.code === "NETWORK_ERROR") {
        setMessage(
          "We couldn’t confirm your sign-in. Check your session before entering your details again.",
        );
      } else if (error instanceof ApiError && error.status >= 500) {
        setMessage(
          "QuizIt is unavailable right now. Please try again shortly.",
        );
      } else if (error instanceof ApiError && error.status === 0) {
        setMessage(
          "Unable to reach QuizIt. Check your connection and try again.",
        );
      } else setMessage("Unable to sign in. Please try again.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const displayedMessage = message;
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand light />
        <div className="login-story-body">
          <p className="login-story-title">
            Good learning
            <br />
            starts with
            <br />
            <span>good questions.</span>
          </p>
          <p>
            Turn class notes into quizzes, get hints when you need them, and
            review your answers after submission.
          </p>
          <div className="learning-illustration" aria-hidden="true">
            <div className="illustration-card">
              <span className="tiny-label">FROM NOTES TO FEEDBACK</span>
              <div className="cycle-step">
                <span>01</span> Notes to quizzes <Icon name="users" />
              </div>
              <div className="cycle-step">
                <span>02</span> Hints when you’re stuck <Icon name="book" />
              </div>
              <div className="cycle-step">
                <span>03</span> Review your answers <Icon name="spark" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="login-form-section">
        <div className="login-mobile-brand">
          <Brand />
        </div>
        <div className="login-form-wrap">
          <h1>Welcome back.</h1>
          <p className="muted">Sign in to pick up where you left off.</p>
          {connectionError ? (
            <Notice>
              Unable to check your session. Check your connection and try again.{" "}
              <button
                type="button"
                className="text-button"
                onClick={runCheck}
                disabled={checking}
              >
                {checking ? "Please wait." : "Check session"}
              </button>
            </Notice>
          ) : null}
          {sessionEnded && !recovery && !message ? (
            <Notice kind="info">
              Your session has ended. Sign in again to continue.
            </Notice>
          ) : null}
          <form onSubmit={submit} className="form-stack" noValidate>
            <label>
              Username
              <input
                ref={usernameRef}
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={busy || checking || recovery}
                aria-invalid={!!errors.username}
                aria-describedby={
                  errors.username ? "username-error" : undefined
                }
              />
              {errors.username ? (
                <small className="field-error" id="username-error">
                  {errors.username}
                </small>
              ) : null}
            </label>
            <label>
              Password
              <div className="password-field">
                <input
                  ref={passwordRef}
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={busy || checking || recovery}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? "password-error" : undefined
                  }
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {" "}
                  {visible ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password ? (
                <small className="field-error" id="password-error">
                  {errors.password}
                </small>
              ) : null}
            </label>
            {displayedMessage ? (
              <div
                className={`notice ${(sessionEnded && !message) ? "notice-info" : "notice-error"}`}
                role={sessionEnded && !message ? "status" : "alert"}
              >
                {displayedMessage}
                {recovery ||
                message.startsWith("The sign-in request timed out") ||
                message.startsWith("We couldn’t confirm") ||
                message.startsWith("Unable to check your session") ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="text-button"
                      onClick={runCheck}
                      disabled={checking}
                    >
                      {checking ? "Please wait." : "Check session"}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <button
              className="button button-primary login-submit"
              disabled={busy || checking}
            >
              {checking
                ? "Checking your session…"
                : busy
                  ? "Signing in…"
                  : recovery
                    ? "Check session"
                    : "Sign in"}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="login-help">
            Need an account or help signing in? Contact your class
            administrator.
          </p>
        </div>
      </section>
    </main>
  );
}
