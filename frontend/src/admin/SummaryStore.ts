import { api } from "../api/client";
import type { SummaryState } from "../api/types";
import { TargetStore } from "../shared/TargetStore";
import type { TargetSnapshot, TargetTransport } from "../shared/TargetStore";

export type SummaryTransport = TargetTransport<SummaryState, "ensure" | "new">;
export type { TargetSnapshot };
export class SummaryStore extends TargetStore<SummaryState, "ensure" | "new"> {
  constructor(
    transport: SummaryTransport = {
      read: api.summary,
      generate: api.generateSummary,
    },
  ) {
    super("summary", transport);
  }
}
