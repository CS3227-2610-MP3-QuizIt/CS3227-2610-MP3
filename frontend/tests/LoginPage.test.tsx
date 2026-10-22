import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import { api, ApiError, SESSION_LOST } from "../src/api/client";

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
      new ApiError(401, { code: "INVALID_CREDENTIALS", message: "Invalid." }),
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

  it("submits valid credentials on Enter and ignores duplicate activation while pending", async () => {
    let resolveLogin!: (value: {
      user: {
        id: number;
        username: string;
        display_name: string;
        role: "student";
      };
    }) => void;
    const loginResult = new Promise<{
      user: {
        id: number;
        username: string;
        display_name: string;
        role: "student";
      };
    }>((resolve) => (resolveLogin = resolve));
    const login = vi.spyOn(api, "login").mockReturnValue(loginResult);
    vi.spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockResolvedValue({
        id: 1,
        username: "student",
        display_name: "Student",
        role: "student",
      });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student");
    const password = screen.getByLabelText("Password");
    await user.type(password, "password");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(login).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    fireEvent.submit(password.closest("form")!);
    expect(login).toHaveBeenCalledOnce();
    resolveLogin({
      user: {
        id: 1,
        username: "student",
        display_name: "Student",
        role: "student",
      },
    });
    expect(
      await screen.findByRole("heading", { name: "My quizzes" }),
    ).toBeInTheDocument();
  });

  it("keeps Show/Hide password state accessible and does not change the value", async () => {
    const user = userEvent.setup();
    render(<App />);
    const password = await screen.findByLabelText("Password");
    await user.type(password, "secret");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Password")).toHaveValue("secret");
  });

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

  it("classifies only the approved invalid credential code and clears the password", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(401, { code: "INVALID_CREDENTIALS", message: "Invalid." }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    const password = screen.getByLabelText("Password");
    await user.type(password, "short");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sign in. Check your username and password.",
    );
    expect(password).toHaveValue("");
    await waitFor(() => expect(password).toHaveFocus());
  });

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

  it("requires an explicit session check after an uncertain login", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(0, { code: "NETWORK_ERROR", message: "Network" }),
    );
    vi.spyOn(api, "me").mockRejectedValueOnce(
      new ApiError(401, { code: "UNAUTHENTICATED", message: "Signed out" }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText(/We couldn’t confirm your sign-in/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Check session" }),
    ).toHaveLength(2);
  });

  it("uses timeout wording only when the client retains timeout evidence", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(0, { code: "REQUEST_TIMEOUT", message: "Timed out." }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText(/The sign-in request timed out/),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Check session" }),
    ).toHaveLength(2);
  });

  it("restores credentials after a confirmed signed-out check without replaying login", async () => {
    const login = vi
      .spyOn(api, "login")
      .mockRejectedValueOnce(
        new ApiError(0, { code: "NETWORK_ERROR", message: "Lost response" }),
      )
      .mockResolvedValueOnce({
        user: {
          id: 1,
          username: "student01",
          display_name: "Student",
          role: "student",
        },
      });
    vi.spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockResolvedValue({
        id: 1,
        username: "student01",
        display_name: "Student",
        role: "student",
      });
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(
      (await screen.findAllByRole("button", { name: "Check session" }))[0],
    );

    expect(
      await screen.findByText("You’re signed out. Sign in to continue."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeEnabled();
    expect(screen.getByLabelText("Password")).toBeEnabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(login).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText("Password"), "new-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByRole("heading", { name: "My quizzes" }),
    ).toBeInTheDocument();
    expect(login).toHaveBeenCalledTimes(2);
  });

  it("keeps recovery available after a non-401 session-check failure", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(0, { code: "NETWORK_ERROR", message: "Lost response" }),
    );
    vi.spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockRejectedValueOnce(
        new ApiError(503, {
          code: "SERVICE_UNAVAILABLE",
          message: "Unavailable",
        }),
      );
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(
      (await screen.findAllByRole("button", { name: "Check session" }))[0],
    );

    expect(
      await screen.findByText(
        "Unable to check your session. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeDisabled();
    expect(screen.getByLabelText("Password")).toBeDisabled();
    expect(
      screen
        .getAllByRole("button", { name: "Check session" })
        .every((button) => !button.hasAttribute("disabled")),
    ).toBe(true);
    expect(api.login).toHaveBeenCalledTimes(1);

    await user.click(
      screen.getAllByRole("button", { name: "Check session" })[0],
    );
    expect(
      await screen.findByText("You’re signed out. Sign in to continue."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeEnabled();
    expect(api.login).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, "AUTH_REQUIRED"],
    [503, "SERVICE_UNAVAILABLE"],
    [0, "NETWORK_ERROR"],
  ])(
    "treats post-login identity failure %s/%s as uncertain, never bad credentials",
    async (status, code) => {
      vi.spyOn(api, "login").mockResolvedValue({
        user: {
          id: 1,
          username: "student01",
          display_name: "Student",
          role: "student",
        },
      });
      vi.spyOn(api, "me")
        .mockRejectedValueOnce(
          new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
        )
        .mockRejectedValueOnce(
          new ApiError(status, { code, message: "Identity unavailable" }),
        );
      const user = userEvent.setup();
      render(<App />);
      await user.type(await screen.findByLabelText("Username"), "student01");
      await user.type(screen.getByLabelText("Password"), "pw");
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      expect(
        await screen.findByText(/We couldn’t confirm your sign-in/),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Check your username and password/),
      ).not.toBeInTheDocument();
      expect(api.login).toHaveBeenCalledOnce();
      expect(
        screen.getAllByRole("button", { name: "Check session" }),
      ).toHaveLength(2);
    },
  );

  it("does not poll a failed session check and replaces its message only after an explicit retry", async () => {
    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(0, { code: "NETWORK_ERROR", message: "Lost response" }),
    );
    const me = vi
      .spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockRejectedValueOnce(
        new ApiError(503, {
          code: "SERVICE_UNAVAILABLE",
          message: "Unavailable",
        }),
      )
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      );
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(
      (await screen.findAllByRole("button", { name: "Check session" }))[0],
    );
    expect(
      await screen.findByText(
        "Unable to check your session. Check your connection and try again.",
      ),
    ).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(me).toHaveBeenCalledTimes(2);

    await user.click(
      screen.getAllByRole("button", { name: "Check session" })[0],
    );
    expect(
      await screen.findByText("You’re signed out. Sign in to continue."),
    ).toBeInTheDocument();
    expect(me).toHaveBeenCalledTimes(3);
    expect(api.login).toHaveBeenCalledOnce();
  });

  it("does not let a late identity response restore a session after session loss", async () => {
    let resolveIdentity!: (identity: {
      id: number;
      username: string;
      display_name: string;
      role: "student";
    }) => void;
    const identity = new Promise<{
      id: number;
      username: string;
      display_name: string;
      role: "student";
    }>((resolve) => (resolveIdentity = resolve));
    vi.spyOn(api, "login").mockResolvedValue({
      user: {
        id: 1,
        username: "student01",
        display_name: "Student",
        role: "student",
      },
    });
    const me = vi
      .spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockReturnValueOnce(identity);
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText("Username"), "student01");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(me).toHaveBeenCalledTimes(2));

    window.dispatchEvent(
      new CustomEvent(SESSION_LOST, { detail: "SESSION_EXPIRED" }),
    );
    expect(
      await screen.findByText(
        "Your session has ended. Sign in again to continue.",
      ),
    ).toBeInTheDocument();
    resolveIdentity({
      id: 1,
      username: "student01",
      display_name: "Student",
      role: "student",
    });
    expect(
      await screen.findByRole("heading", { name: "Welcome back." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "My quizzes" }),
    ).not.toBeInTheDocument();
  });

  it("keeps a known session-ended reason through uncertain recovery and signed-out confirmation", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByLabelText("Username");
    window.dispatchEvent(
      new CustomEvent(SESSION_LOST, { detail: "SESSION_EXPIRED" }),
    );
    expect(
      await screen.findByText(
        "Your session has ended. Sign in again to continue.",
      ),
    ).toBeInTheDocument();

    vi.spyOn(api, "login").mockRejectedValue(
      new ApiError(0, { code: "NETWORK_ERROR", message: "Lost" }),
    );
    vi.spyOn(api, "me")
      .mockRejectedValueOnce(
        new ApiError(401, { code: "AUTH_REQUIRED", message: "Signed out" }),
      )
      .mockRejectedValueOnce(
        new ApiError(401, {
          code: "AUTH_REQUIRED",
          message: "Still signed out",
        }),
      );
    await user.type(screen.getByLabelText("Username"), "student01");
    await user.type(screen.getByLabelText("Password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByText(/We couldn’t confirm your sign-in/),
    ).toBeInTheDocument();
    await user.click(
      (await screen.findAllByRole("button", { name: "Check session" }))[0],
    );
    expect(
      await screen.findByText(
        "Your session has ended. Sign in again to continue.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("You’re signed out. Sign in to continue."),
    ).not.toBeInTheDocument();
  });

  it("does not label a fresh signed-out visit as a session-ended visit", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Sign in" });
    expect(
      screen.queryByText("Your session has ended. Sign in again to continue."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("You’re signed out. Sign in to continue."),
    ).not.toBeInTheDocument();
  });
});
