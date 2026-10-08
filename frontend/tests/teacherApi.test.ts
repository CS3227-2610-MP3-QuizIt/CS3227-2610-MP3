import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError, errorMessage } from "../src/api/client";

afterEach(() => vi.unstubAllGlobals());
it("deletes a quiz with cookies and accepts an empty 204 response", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetch);
  await expect(api.deleteQuiz(3)).resolves.toBeUndefined();
  const [path, request] = fetch.mock.calls[0];
  expect(path).toBe("/api/v1/quizzes/3");
  expect(request.method).toBe("DELETE");
  expect(request.credentials).toBe("include");
  expect(request.body).toBeUndefined();
});
it("shows provider retry timing as well as the required application rate-limit message", () => {
  expect(
    errorMessage(
      new ApiError(429, {
        code: "AI_PROVIDER_LIMIT",
        message: "The AI service is busy.",
        retry_after_seconds: 8,
      }),
    ),
  ).toBe("The AI service is busy. Try again in 8 seconds.");
  expect(
    errorMessage(
      new ApiError(429, {
        code: "AI_APP_RATE_LIMIT",
        message: "Limit",
        retry_after_seconds: 12,
      }),
    ),
  ).toBe("AI request limit reached. Please try again in 12 seconds.");
});
it("uploads multipart DOCX with cookies and lets the browser set the boundary", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 201 }),
    );
  vi.stubGlobal("fetch", fetch);
  const file = new File(["docx"], "notes.docx");
  await api.uploadNote(2, file);
  const [path, request] = fetch.mock.calls[0];
  expect(path).toBe("/api/v1/classes/2/notes");
  expect(request.credentials).toBe("include");
  expect(request.body).toBeInstanceOf(FormData);
  expect(request.body.get("file")).toBe(file);
  expect(request.headers["Content-Type"]).toBeUndefined();
});
it("binds generation input and the operation key to the teacher generation endpoint", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ version: 1 }), { status: 202 }),
    );
  vi.stubGlobal("fetch", fetch);
  const input = {
    expected_revision: 2,
    prompt: "Simplify",
    action: "new" as const,
  };
  await api.generateQuiz(3, input, "operation-key");
  const [path, request] = fetch.mock.calls[0];
  expect(path).toBe("/api/v1/quizzes/3/generate");
  expect(JSON.parse(request.body)).toEqual(input);
  expect(request.headers["Idempotency-Key"]).toBe("operation-key");
});
