import { api } from "../api/client";
import type { HintInput, HintState } from "../api/types";
import { TargetStore } from "../shared/TargetStore";
import type { TargetTransport } from "../shared/TargetStore";

export type HintKey = `${number}:${number}`;
export const hintKey = (attemptId: number, questionId: number): HintKey =>
  `${attemptId}:${questionId}`;
export type HintTransport = TargetTransport<HintState, HintInput, HintKey>;
export class HintStore extends TargetStore<HintState, HintInput, HintKey> {
  constructor(
    transport: HintTransport = {
      read: (key, signal) => {
        const [attempt, question] = key.split(":").map(Number);
        return api.hint(attempt!, question!, signal);
      },
      generate: (key, input, operation, signal) => {
        const [attempt, question] = key.split(":").map(Number);
        return api.generateHint(attempt!, question!, input, operation, signal);
      },
    },
  ) {
    super("hint", transport, (event) =>
      Number.isSafeInteger(event.attempt_id) &&
      Number(event.attempt_id) > 0 &&
      Number.isSafeInteger(event.question_id) &&
      Number(event.question_id) > 0
        ? hintKey(event.attempt_id!, event.question_id!)
        : null,
    );
  }
}
