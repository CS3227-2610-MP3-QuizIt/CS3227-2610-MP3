import { afterEach, expect, it, vi } from "vitest";
import { api } from "../src/api/client";
afterEach(() => vi.unstubAllGlobals());
it("matches student endpoint methods, bodies and cookie authentication", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetch);
  await api.studentQuizzes();
  await api.studentQuiz(1);
  await api.startAttempt(1);
  await api.attempt(10);
  await api.saveAnswer(10, 2, "C");
  await api.submitAttempt(10);
  await api.results(10);
  await api.hint(10, 2);
  const input = { action: "new" as const, prompt: "Conceptual clue" };
  await api.generateHint(10, 2, input, "operation-key");
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    "/api/v1/quizzes",
    "/api/v1/quizzes/1",
    "/api/v1/quizzes/1/attempt",
    "/api/v1/attempts/10",
    "/api/v1/attempts/10/answers/2",
    "/api/v1/attempts/10/submit",
    "/api/v1/attempts/10/results",
    "/api/v1/attempts/10/questions/2/hints",
    "/api/v1/attempts/10/questions/2/hints",
  ]);
  for (const [, request] of fetch.mock.calls) {
    expect(request.credentials).toBe("include");
    expect(request.cache).toBe("no-store");
  }
  expect(fetch.mock.calls[2][1].method).toBe("POST");
  expect(fetch.mock.calls[4][1].method).toBe("PUT");
  expect(JSON.parse(fetch.mock.calls[4][1].body)).toEqual({
    selected_option: "C",
  });
  expect(fetch.mock.calls[5][1].method).toBe("POST");
  expect(JSON.parse(fetch.mock.calls[8][1].body)).toEqual(input);
  expect(fetch.mock.calls[8][1].headers["Idempotency-Key"]).toBe(
    "operation-key",
  );
});
