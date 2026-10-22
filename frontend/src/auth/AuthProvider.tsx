import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  advanceSessionGeneration,
  api,
  ApiError,
  errorMessage,
  LoginFlowError,
  SESSION_LOST,
} from "../api/client";
import type { User } from "../api/types";

interface Auth {
  user: User | null;
  loading: boolean;
  error: string;
  sessionEnded: boolean;
  uncertainSignIn: boolean;
  checkSession: () => Promise<"signed-in" | "signed-out" | "failed">;
  refresh: () => void;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [uncertainSignIn, setUncertainSignIn] = useState(false);
  const epoch = useRef(0);
  const userRef = useRef<User | null>(null);
  const deliberateLogout = useRef(false);
  const setCurrentUser = (identity: User | null) => {
    userRef.current = identity;
    setUser(identity);
  };
  const loseSession = useCallback(
    (rawEvent: Event = new Event(SESSION_LOST)) => {
      const event = rawEvent as CustomEvent<string>;
      if (deliberateLogout.current) return;
      if (
        event?.detail === "SESSION_EXPIRED" ||
        (event?.detail === "AUTH_REQUIRED" && userRef.current)
      )
        setSessionEnded(true);
      advanceSessionGeneration();
      epoch.current++;
      setCurrentUser(null);
      setLoading(false);
      setError("");
    },
    [],
  );
  const refresh = useCallback(async () => {
    const current = ++epoch.current;
    try {
      const identity = await api.me();
      if (current === epoch.current) {
        setCurrentUser(identity);
        setError("");
        setSessionEnded(false);
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
  const checkSession = useCallback(async () => {
    const current = ++epoch.current;
    try {
      const identity = await api.me(true);
      if (current !== epoch.current) return "failed";
      setCurrentUser(identity);
      setError("");
      setUncertainSignIn(false);
      setSessionEnded(false);
      setLoading(false);
      return "signed-in";
    } catch (caught) {
      if (current !== epoch.current) return "failed";
      setLoading(false);
      setError("");
      if (caught instanceof ApiError && caught.status === 401) {
        setUncertainSignIn(false);
        return "signed-out";
      }
      return "failed";
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
    advanceSessionGeneration();
    const current = ++epoch.current;
    try {
      await api.login(username, password);
    } catch (error) {
      if (current !== epoch.current)
        throw new LoginFlowError("identity", error);
      if (
        !(error instanceof ApiError) ||
        error.code === "NETWORK_ERROR" ||
        error.code === "REQUEST_TIMEOUT"
      )
        setUncertainSignIn(true);
      throw new LoginFlowError("login", error);
    }
    // Fetch identity after login rather than trusting routing hints or browser storage.
    let identity: User;
    try {
      identity = await api.me(true);
    } catch (error) {
      if (current === epoch.current) setUncertainSignIn(true);
      throw new LoginFlowError("identity", error);
    }
    if (current !== epoch.current)
      throw new LoginFlowError(
        "identity",
        new Error("Sign-in was superseded."),
      );
    setError("");
    setUncertainSignIn(false);
    setSessionEnded(false);
    setCurrentUser(identity);
  }
  async function signOut() {
    const current = ++epoch.current;
    deliberateLogout.current = true;
    advanceSessionGeneration();
    try {
      await api.logout();
    } finally {
      deliberateLogout.current = false;
    }
    if (current !== epoch.current) return;
    setSessionEnded(false);
    setUncertainSignIn(false);
    loseSession();
    window.location.hash = "/login";
  }
  return (
    <Context
      value={{
        user,
        loading,
        error,
        sessionEnded,
        uncertainSignIn,
        checkSession,
        refresh,
        signIn,
        signOut,
      }}
    >
      {children}
    </Context>
  );
}
export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error("Missing AuthProvider");
  return auth;
}
