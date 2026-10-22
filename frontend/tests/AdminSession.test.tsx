import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { api, ApiError } from "../src/api/client";

describe("admin brand navigation", () => {
  beforeEach(() => {
    window.location.hash = "/admin/overview";
    document.title = "Workspace title";
    vi.spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, {
          code: "UNAUTHENTICATED",
          message: "Sign in.",
        }),
      )
      .mockResolvedValue({
        id: 1,
        username: "admin",
        display_name: "Demo Admin",
        role: "admin",
      });
    vi.spyOn(api, "login").mockResolvedValue({
      user: {
        id: 1,
        username: "admin",
        display_name: "Demo Admin",
        role: "admin",
      },
    });
    vi.spyOn(api, "users").mockResolvedValue({ items: [] });
    vi.spyOn(api, "classes").mockResolvedValue({ items: [] });
    vi.spyOn(api, "quizzes").mockResolvedValue({ items: [] });
    vi.stubGlobal(
      "EventSource",
      class extends EventTarget {
        onopen: (() => void) | null = null;
        onerror: (() => void) | null = null;
        close = vi.fn();
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses the approved overview link name and restores the non-login title after sign-in", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("button", { name: "Sign in" });
    expect(document.title).toBe("Sign in · QuizIt");
    await user.type(screen.getByLabelText("Username"), "admin");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("link", { name: "QuizIt overview" }),
    ).toHaveAttribute("href", "#/admin/overview");
    expect(
      screen.getByRole("link", { name: "QuizIt overview" }),
    ).toHaveTextContent("QuizIt.");
    expect(document.title).toBe("Workspace title");
  });
});
