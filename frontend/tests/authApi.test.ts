import { afterEach, expect, it, vi } from "vitest";
import {
  advanceSessionGeneration,
  api,
  ApiError,
  SESSION_LOST,
} from "../src/api/client";

afterEach(() => vi.unstubAllGlobals());

it("reads login retry timing from the JSON error and ignores a header-only retry", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "LOGIN_RATE_LIMIT",
            message: "Wait",
            retry_after_seconds: 7,
          },
        }),
        { status: 429, headers: { "Retry-After": "90" } },
      ),
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "LOGIN_RATE_LIMIT",
            message: "Wait",
            retry_after_seconds: null,
          },
        }),
        { status: 429, headers: { "Retry-After": "90" } },
      ),
    );
  vi.stubGlobal("fetch", fetch);

  await expect(api.login("student01", " pass ")).rejects.toMatchObject({
    code: "LOGIN_RATE_LIMIT",
    retryAfter: 7,
  });
  await expect(api.login("student01", " pass ")).rejects.toMatchObject({
    code: "LOGIN_RATE_LIMIT",
    retryAfter: null,
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    username: "student01",
    password: " pass ",
  });
});

it("retains evidence from an actual fetch timeout", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")),
  );
  await expect(api.login("student01", "password")).rejects.toMatchObject({
    status: 0,
    code: "REQUEST_TIMEOUT",
  } satisfies Partial<ApiError>);
});

it("does not dispatch an old protected 401 after its body finishes parsing", async () => {
  let resolveBody!: (body: unknown) => void;
  const body = new Promise<unknown>((resolve) => (resolveBody = resolve));
  const response = new Response(null, { status: 401 });
  vi.spyOn(response, "json").mockReturnValue(body);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  const onLost = vi.fn();
  window.addEventListener(SESSION_LOST, onLost);
  const request = api.me();
  await Promise.resolve();
  await Promise.resolve();
  advanceSessionGeneration();
  resolveBody({ error: { code: "AUTH_REQUIRED", message: "Expired" } });
  await expect(request).rejects.toMatchObject({ status: 401 });
  expect(onLost).not.toHaveBeenCalled();
  window.removeEventListener(SESSION_LOST, onLost);
});
