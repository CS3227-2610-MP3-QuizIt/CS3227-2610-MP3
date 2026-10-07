import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AIChange } from "../api/types";

interface EventStore {
  notify: (event: AIChange) => void;
  refreshAll: () => void;
  dispose: () => void;
}
// Establish the stream before rendering targets that perform their entry reads.
export function useAIEvents<T extends EventStore>(create: () => T) {
  const [store, setStore] = useState<T | null>(null);
  useEffect(() => {
    const current = create();
    // Polling and initial reads also work where EventSource is unavailable.
    const source =
      typeof EventSource === "undefined"
        ? null
        : new EventSource("/api/v1/ai/events", { withCredentials: true });
    source?.addEventListener("ai_state_changed", (event) => {
      try {
        const metadata: unknown = JSON.parse((event as MessageEvent).data);
        if (metadata && typeof metadata === "object")
          current.notify(metadata as AIChange);
      } catch {
        /* Invalid notifications never update authoritative state. */
      }
    });
    const recover = () => current.refreshAll();
    if (source) {
      source.onopen = recover;
      source.onerror = () => {
        recover();
        void api.me().catch(() => undefined);
      };
    }
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    // Publish this effect-owned instance after opening SSE. StrictMode cleanup
    // disposes each instance, so a render-owned singleton would be reused disposed.
    // oxlint-disable-next-line react/set-state-in-effect
    setStore(current);
    return () => {
      source?.close();
      current.dispose();
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
    };
  }, [create]);
  return store;
}
