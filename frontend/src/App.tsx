import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { AdminApp } from "./admin/AdminApp";
import { TeacherApp } from "./teacher/TeacherApp";
import { Brand, Loading, Notice } from "./shared/ui";
import { errorMessage } from "./api/client";

function Screens() {
  const auth = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.loading)
    return (
      <main className="session-loading">
        <Brand />
        <Loading>Opening your classroom…</Loading>
      </main>
    );
  if (!auth.user) return <LoginPage />;
  if (auth.user.role === "admin") return <AdminApp key={auth.user.id} />;
  if (auth.user.role === "teacher") return <TeacherApp key={auth.user.id} />;
  return (
    <main className="role-placeholder">
      <Brand />
      <span className="badge">{auth.user.role} workspace</span>
      <h1>Welcome, {auth.user.display_name}.</h1>
      <p>
        You’re signed in. The {auth.user.role} screens are scheduled for the
        next frontend delivery.
      </p>
      {error ? <Notice>{error}</Notice> : null}
      <button
        className="button button-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await auth.signOut();
          } catch (error) {
            setError(errorMessage(error));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
    </main>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <Screens />
    </AuthProvider>
  );
}
