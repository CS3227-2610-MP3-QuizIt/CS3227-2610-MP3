import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { api, ApiError } from "../src/api/client";

describe("login page", () => {
  beforeEach(() => {
    window.location.hash = "/admin/overview";
    document.title = "Existing non-login title";
    vi.spyOn(api, "me").mockRejectedValue(
      new ApiError(401, { code: "UNAUTHENTICATED", message: "Sign in." }),
    );
  });

  it("shows the approved copy, a single primary heading, and login title", async () => {
    render(<App />);

    await screen.findByRole("heading", {
      level: 1,
      name: "Welcome back.",
    });
    expect(document.querySelectorAll("h1")).toHaveLength(1);
    expect(document.title).toBe("Sign in · QuizIt");
    expect(screen.getByText("FROM NOTES TO FEEDBACK")).toBeInTheDocument();
    expect(screen.getByText("Notes to quizzes")).toBeInTheDocument();
    expect(screen.getByText("Hints when you’re stuck")).toBeInTheDocument();
    expect(screen.getByText("Review your answers")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Turn class notes into quizzes, get hints when you need them, and review your answers after submission.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Need an account or help signing in? Contact your class administrator.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("QuizIt")).toHaveLength(2);
    expect(screen.getByLabelText("Username")).toHaveAttribute(
      "placeholder",
      "Enter your username",
    );
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "placeholder",
      "Enter your password",
    );
  });

  it("keeps the login title after a failed sign-in and restores the prior title on unmount", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(401, { code: "BAD_CREDENTIALS", message: "Invalid." }),
    );
    const user = userEvent.setup();
    const view = render(<App />);

    await screen.findByRole("button", { name: "Sign in" });
    await user.type(screen.getByLabelText("Username"), "student");
    await user.type(screen.getByLabelText("Password"), "incorrect");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sign in. Check your username and password.",
    );
    expect(document.title).toBe("Sign in · QuizIt");
    view.unmount();
    await waitFor(() =>
      expect(document.title).toBe("Existing non-login title"),
    );
  });

  it("sets and restores the title through StrictMode effect cleanup", async () => {
    const view = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await screen.findByRole("button", { name: "Sign in" });
    expect(document.title).toBe("Sign in · QuizIt");
    view.unmount();
    await waitFor(() =>
      expect(document.title).toBe("Existing non-login title"),
    );
  });

  it("validates normalized usernames and blank passwords without calling login", async () => {
    const login = vi.spyOn(api, "login");
    const user = userEvent.setup();
    render(<App />);
    const username = await screen.findByLabelText("Username");
    await user.type(username, "ab");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText("Enter at least 3 characters for your username."),
    ).toBeInTheDocument();
    expect(username).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });

  it.each([
    ["", "Enter your username."],
    ["ab", "Enter at least 3 characters for your username."],
    [
      "ééé",
      "Use only letters, numbers, underscores, dots, or hyphens in your username.",
    ],
  ])(
    "rejects normalized username %j with the expected message",
    async (value, message) => {
      const login = vi.spyOn(api, "login");
      const user = userEvent.setup();
      render(<App />);
      const username = await screen.findByLabelText("Username");
      await user.clear(username);
      if (value) await user.type(username, value);
      await user.type(screen.getByLabelText("Password"), "p");
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(username).toHaveFocus();
      expect(login).not.toHaveBeenCalled();
    },
  );

  it.each(["p", "p".repeat(128)])(
    "submits password boundary length %i",
    async (passwordValue) => {
      const login = vi.spyOn(api, "login").mockRejectedValue(
        new ApiError(401, {
          code: "INVALID_CREDENTIALS",
          message: "Invalid.",
        }),
      );
      const user = userEvent.setup();
      render(<App />);
      await user.type(await screen.findByLabelText("Username"), "abc");
      await user.type(screen.getByLabelText("Password"), passwordValue);
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      await waitFor(() =>
        expect(login).toHaveBeenCalledWith("abc", passwordValue),
      );
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Unable to sign in. Check your username and password.",
      );
    },
  );
  it("accepts a 50-character username and preserves a one-space login password", async () => {
    const login = vi.spyOn(api, "login").mockResolvedValue({
      user: {
        id: 1,
        username: "a".repeat(50),
        display_name: "Student",
        role: "student",
      },
    });
    vi.spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockResolvedValue({
        id: 1,
        username: "a".repeat(50),
        display_name: "Student",
        role: "student",
      });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "a".repeat(50));
    await user.type(screen.getByLabelText("Password"), " ");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith("a".repeat(50), " "),
    );
  });

  it.each([
    [
      "bad name",
      "Use only letters, numbers, underscores, dots, or hyphens in your username.",
    ],
    ["a".repeat(51), "Enter no more than 50 characters for your username."],
  ])(
    "rejects username boundary %s without a request",
    async (invalid, expected) => {
      const login = vi.spyOn(api, "login");
      const user = userEvent.setup();
      render(<App />);
      await user.type(await screen.findByLabelText("Username"), invalid);
      await user.type(screen.getByLabelText("Password"), "pw");
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      expect(await screen.findByText(expected)).toBeInTheDocument();
      expect(login).not.toHaveBeenCalled();
    },
  );
  it("rejects a 129-character password and leaves focus on Password", async () => {
    const login = vi.spyOn(api, "login");
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    const password = screen.getByLabelText("Password");
    await user.type(password, "x".repeat(129));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText(
        "Enter no more than 128 characters for your password.",
      ),
    ).toBeInTheDocument();
    expect(password).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });
});
