import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginPage } from "./auth/LoginPage";
import { AdminApp } from "./admin/AdminApp";
import { TeacherApp } from "./teacher/TeacherApp";
import { Brand, Loading } from "./shared/ui";
import { StudentApp } from "./student/StudentApp";

function Screens() {
  const auth = useAuth();
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
  return <StudentApp key={auth.user.id} />;
}
export default function App() {
  return (
    <AuthProvider>
      <Screens />
    </AuthProvider>
  );
}
