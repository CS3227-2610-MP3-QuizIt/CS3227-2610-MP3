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
});
