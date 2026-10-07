import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { api, ApiError, errorMessage, SESSION_LOST } from "../api/client";
import type { User } from "../api/types";

interface Auth {
  user: User | null;
  loading: boolean;
  error: string;
  refresh: () => void;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const epoch = useRef(0);
  const loseSession = useCallback(() => {
    epoch.current++;
    setUser(null);
    setLoading(false);
    setError("");
  }, []);
  const refresh = useCallback(async () => {
    const current = ++epoch.current;
    try {
      const identity = await api.me();
      if (current === epoch.current) {
        setUser(identity);
        setError("");
      }
    } catch (error) {
      if (
        current === epoch.current &&
        !(error instanceof ApiError && error.status === 401)
      )
        setError(errorMessage(error));
    } finally {
      if (current === epoch.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    window.addEventListener(SESSION_LOST, loseSession);
    return () => {
      epoch.current++;
      window.removeEventListener(SESSION_LOST, loseSession);
    };
  }, [refresh, loseSession]);
  useEffect(() => {
    if (!user) return;
    const check = () => {
      void refresh();
    };
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
    };
  }, [user?.id, refresh]);
  async function signIn(username: string, password: string) {
    ++epoch.current;
    await api.login(username, password);
    // Fetch identity after login rather than trusting routing hints or browser storage.
    const identity = await api.me();
    setError("");
    setUser(identity);
  }
  async function signOut() {
    await api.logout();
    loseSession();
    window.location.hash = "/login";
  }
  return (
    <Context value={{ user, loading, error, refresh, signIn, signOut }}>
      {children}
    </Context>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("Missing AuthProvider");
  return auth;
}
