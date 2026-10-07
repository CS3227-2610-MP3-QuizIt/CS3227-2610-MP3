import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: string;
  }>({ data: null, loading: true, error: "" });
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ ...previous, loading: true, error: "" }));
    try {
      const data = await load(current.signal);
      if (!current.signal.aborted)
        setState({ data, loading: false, error: "" });
    } catch (error) {
      if (!current.signal.aborted)
        setState((previous) => ({
          ...previous,
          loading: false,
          error: errorMessage(error),
        }));
    }
  }, [load]);
  useEffect(() => {
    void refresh();
    const recover = () => {
      void refresh();
    };
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    return () => {
      controller.current?.abort();
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
    };
  }, [refresh]);
  return { ...state, refresh };
}
