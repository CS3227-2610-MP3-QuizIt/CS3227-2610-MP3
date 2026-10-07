import { api } from "../api/client";
import type { GenerationInput, GenerationState } from "../api/types";
import { TargetStore } from "../shared/TargetStore";
import type { TargetTransport } from "../shared/TargetStore";

export type GenerationTransport = TargetTransport<
  GenerationState,
  GenerationInput
>;
export class GenerationStore extends TargetStore<
  GenerationState,
  GenerationInput
> {
  constructor(
    transport: GenerationTransport = {
      read: async (id, signal) => {
        const state = await api.generation(id, signal);
        // Read current content after task state. Task success snapshots can be historical.
        const quiz = await api.teacherQuiz(id, signal);
        return { ...state, quiz };
      },
      generate: api.generateQuiz,
    },
  ) {
    super("quiz_generation", {
      ...transport,
      merge: (previous, next) => {
        const oldQuiz = previous?.quiz;
        const quiz = next.quiz;
        const keepOld =
          oldQuiz &&
          (!quiz ||
            quiz.revision < oldQuiz.revision ||
            (oldQuiz.status === "published" && quiz.status === "draft"));
        return { ...next, quiz: keepOld ? oldQuiz : quiz };
      },
    });
  }
}
