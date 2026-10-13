import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../src/api/client";
import type {
  Completion,
  Member,
  Quiz,
  SummaryResult,
  SummaryState,
  User,
} from "../src/api/types";
import { AccountsPage } from "../src/admin/AccountsPage";
import { ClassesPage } from "../src/admin/ClassesPage";
import { PerformancePage } from "../src/admin/PerformancePage";
import { SummaryStore } from "../src/admin/SummaryStore";
import type { SummaryTransport } from "../src/admin/SummaryStore";
import { classes, deferred } from "./teacherFixtures";

const users: User[] = [
  { id: 3, username: "alex.tan", display_name: "Alex Tan", role: "student" },
  { id: 4, username: "lee", display_name: "Teacher Lee", role: "teacher" },
  { id: 5, username: "sam", display_name: "Sam Lim", role: "student" },
];
const member = (user: User): Member => ({
  ...user,
  assigned_at: classes[0].created_at,
});
const published: Quiz = {
  id: 1,
  class_id: 1,
  class_name: classes[0].name,
  title: "Security basics",
  question_count: 1,
  status: "published",
  revision: 1,
  created_at: classes[0].created_at,
  published_at: classes[0].created_at,
};
const completion = (eligible = true): Completion => ({
  quiz_id: 1,
  assigned_count: 3,
  submitted_count: eligible ? 3 : 1,
  in_progress_count: eligible ? 0 : 1,
  not_started_count: eligible ? 0 : 1,
  summary_eligible: eligible,
  has_summary: false,
});
const result = (): SummaryResult => ({
  quiz_id: 1,
  ai_request_id: "task",
  created_at: classes[0].created_at,
  metrics: {
    assigned_count: 3,
    submitted_count: 3,
    question_count: 1,
    average_score: 2 / 3,
    average_score_percent: 200 / 3,
    min_score: 0,
    max_score: 1,
    questions: [
      {
        id: 10,
        position: 1,
        question: "Which check protects access?",
        options: {
          A: "Authentication",
          B: "Colour",
          C: "Layout",
          D: "Spacing",
        },
        correct_option: "A",
        correct_count: 2,
        incorrect_count: 1,
        correct_percent: 200 / 3,
        option_counts: { A: 2, B: 1, C: 0, D: 0 },
      },
    ],
  },
  summary: {
    overview: "Access checks need review.",
    strengths: ["Recognising authentication"],
    areas_to_review: ["Checking every request"],
  },
});
const summary = (
  status: SummaryState["status"] = "not_requested",
): SummaryState => ({
  target_id: status === "not_requested" ? null : 1,
  feature: "summary",
  quiz_id: 1,
  attempt_id: null,
  question_id: null,
  task_id: status === "not_requested" ? null : "task",
  version: status === "not_requested" ? 0 : 2,
  status,
  result: status === "success" ? result() : null,
  error:
    status === "failed"
      ? {
          code: "AI_PROVIDER_LIMIT",
          message: "Service budget reached.",
          retry_after_seconds: 17,
        }
      : null,
});

beforeEach(() => {
  window.location.hash = "";
});

describe("admin accounts", () => {
  const refresh = vi.fn<() => Promise<void>>();
  beforeEach(() => {
    refresh.mockReset();
    refresh.mockResolvedValue(undefined);
  });
  const open = () => render(<AccountsPage users={users} refresh={refresh} />);
  async function fill(role: "student" | "teacher" = "student") {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByLabelText("Display name"), " New Person ");
    await user.type(screen.getByLabelText(/^Username/), "new.person");
    await user.type(
      screen.getByLabelText(/^Initial password/),
      " a long password ",
    );
    await user.selectOptions(screen.getByLabelText("Role"), role);
    return user;
  }
  const submit = () =>
    within(screen.getByLabelText(/^Username/).closest("form")!).getByRole(
      "button",
      { name: "Create account" },
    );

  it.each(["student", "teacher"] as const)(
    "creates a %s account and refreshes public account data",
    async (role) => {
      const create = vi
        .spyOn(api, "createUser")
        .mockResolvedValue({ ...users[0], display_name: "New Person", role });
      open();
      const user = await fill(role);
      expect(
        within(screen.getByLabelText("Role"))
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Student", "Teacher"]);
      // jsdom does not enforce native minlength validity; verify the declared
      // bounds here and exercise required/pattern validation in the cases below.
      expect(screen.getByLabelText(/^Username/)).toHaveAttribute(
        "minlength",
        "3",
      );
      expect(screen.getByLabelText(/^Username/)).toHaveAttribute(
        "maxlength",
        "50",
      );
      expect(screen.getByLabelText("Display name")).toHaveAttribute(
        "maxlength",
        "100",
      );
      expect(screen.getByLabelText(/^Initial password/)).toHaveAttribute(
        "minlength",
        "12",
      );
      expect(screen.getByLabelText(/^Initial password/)).toHaveAttribute(
        "maxlength",
        "128",
      );
      expect(screen.getByLabelText(/^Initial password/)).toHaveAttribute(
        "type",
        "password",
      );
      await user.click(submit());
      expect(create).toHaveBeenCalledWith({
        username: "new.person",
        display_name: "New Person",
        password: " a long password ",
        role,
      });
      await screen.findByText("Account created for New Person.");
      expect(
        screen.queryByLabelText(/^Initial password/),
      ).not.toBeInTheDocument();
      expect(refresh).toHaveBeenCalledOnce();
    },
  );
  it.each([
    ["Username", "bad name"],
    ["Initial password", ""],
    ["Display name", ""],
  ])(
    "blocks invalid %s input (%s) before calling the API",
    async (label, value) => {
      const create = vi.spyOn(api, "createUser");
      open();
      const user = await fill();
      await user.clear(screen.getByLabelText(new RegExp(`^${label}`)));
      if (value)
        await user.type(screen.getByLabelText(new RegExp(`^${label}`)), value);
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeInvalid();
      await user.click(submit());
      expect(create).not.toHaveBeenCalled();
      expect(refresh).not.toHaveBeenCalled();
    },
  );
  it("retains input and shows a server username conflict", async () => {
    vi.spyOn(api, "createUser").mockRejectedValue(
      new ApiError(409, {
        code: "USERNAME_EXISTS",
        message: "Username already exists.",
      }),
    );
    open();
    const user = await fill();
    await user.click(submit());
    await screen.findByText("Username already exists.");
    expect(screen.getByLabelText(/^Username/)).toHaveValue("new.person");
    expect(submit()).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
  it("disables account inputs and duplicate submission while creation is pending", async () => {
    const pending = deferred<User>();
    const create = vi.spyOn(api, "createUser").mockReturnValue(pending.promise);
    open();
    const user = await fill();
    const button = submit();
    await user.click(button);
    for (const label of [
      "Display name",
      "Username",
      "Role",
      "Initial password",
    ])
      expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeDisabled();
    expect(button).toHaveTextContent("Creating");
    await user.click(button);
    expect(create).toHaveBeenCalledOnce();
    await act(async () => {
      pending.resolve(users[0]);
    });
    await screen.findByText("Account created for Alex Tan.");
  });
});

describe("admin classes and membership", () => {
  const refresh = vi.fn<() => Promise<void>>();
  beforeEach(() => {
    refresh.mockReset();
    refresh.mockResolvedValue(undefined);
  });
  const open = (selectedId: number | null = 1) =>
    render(
      <ClassesPage
        classes={classes}
        users={users}
        selectedId={selectedId}
        refresh={refresh}
      />,
    );
  it("creates a trimmed class name and opens its membership route", async () => {
    const create = vi
      .spyOn(api, "createClass")
      .mockResolvedValue({ ...classes[0], id: 2, name: "New class" });
    const user = userEvent.setup();
    open(null);
    await user.click(screen.getByRole("button", { name: "Create class" }));
    await user.type(screen.getByLabelText("Class name"), " New class ");
    await user.click(
      within(screen.getByLabelText("Class name").closest("form")!).getByRole(
        "button",
        { name: "Create class" },
      ),
    );
    await screen.findByText(
      "New class is ready. Assign members to get started.",
    );
    expect(create).toHaveBeenCalledWith("New class");
    expect(refresh).toHaveBeenCalledOnce();
    expect(window.location.hash).toBe("#/admin/classes?id=2");
  });
  it("rejects a whitespace-only class name", async () => {
    const create = vi.spyOn(api, "createClass");
    const user = userEvent.setup();
    open(null);
    await user.click(screen.getByRole("button", { name: "Create class" }));
    await user.type(screen.getByLabelText("Class name"), "   ");
    await user.click(
      within(screen.getByLabelText("Class name").closest("form")!).getByRole(
        "button",
        { name: "Create class" },
      ),
    );
    await screen.findByText("Enter a class name.");
    expect(create).not.toHaveBeenCalled();
  });
  it("loads selected members, counts roles, and excludes them from assignment choices", async () => {
    const read = vi
      .spyOn(api, "members")
      .mockResolvedValue({ items: users.slice(0, 2).map(member) });
    open();
    const selector = await screen.findByLabelText("Assign an account");
    expect(read).toHaveBeenCalledWith(1, expect.any(AbortSignal));
    expect(screen.getByText("1 students")).toBeInTheDocument();
    expect(screen.getByText("1 teachers")).toBeInTheDocument();
    expect(
      within(selector).queryByRole("option", { name: /Alex Tan|Teacher Lee/ }),
    ).not.toBeInTheDocument();
    expect(
      within(selector).getByRole("option", { name: /Sam Lim/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
  });
  it.each([users[0], users[1]])(
    "assigns a $role and reloads authoritative membership",
    async (account) => {
      const read = vi
        .spyOn(api, "members")
        .mockResolvedValueOnce({ items: [] })
        .mockResolvedValue({ items: [member(account)] });
      const assign = vi.spyOn(api, "assign").mockResolvedValue(member(account));
      const user = userEvent.setup();
      open();
      await user.selectOptions(
        await screen.findByLabelText("Assign an account"),
        String(account.id),
      );
      await user.click(screen.getByRole("button", { name: "Assign" }));
      await screen.findByRole("button", {
        name: `Unassign ${account.display_name}`,
      });
      expect(assign).toHaveBeenCalledWith(1, account.id);
      expect(read).toHaveBeenCalledTimes(2);
      expect(screen.getByLabelText("Assign an account")).toHaveValue("");
      expect(
        within(screen.getByLabelText("Assign an account")).queryByRole(
          "option",
          { name: new RegExp(account.display_name) },
        ),
      ).not.toBeInTheDocument();
      expect(screen.getAllByText(account.display_name)).toHaveLength(1);
      expect(
        screen.getByText("Member assigned to this class."),
      ).toBeInTheDocument();
    },
  );
  it("unassigns a member while explaining published roster preservation", async () => {
    vi.spyOn(api, "members")
      .mockResolvedValueOnce({ items: [member(users[0])] })
      .mockResolvedValue({ items: [] });
    const remove = vi.spyOn(api, "unassign").mockResolvedValue(undefined);
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "Unassign Alex Tan" }),
    );
    await screen.findByText("A class waiting for its people");
    expect(remove).toHaveBeenCalledWith(1, 3);
    expect(
      within(screen.getByLabelText("Assign an account")).getByRole("option", {
        name: /Alex Tan/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Member removed. Existing published student attempts are preserved.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Published student rosters stay the same/),
    ).toHaveTextContent(
      "Removing a teacher prevents further draft management and publication.",
    );
  });
  it("shows initial loading and recovers a member read failure through Try again", async () => {
    const pending = deferred<{ items: Member[] }>();
    const read = vi
      .spyOn(api, "members")
      .mockRejectedValueOnce(new Error("Members unavailable."))
      .mockReturnValueOnce(pending.promise);
    const user = userEvent.setup();
    open();
    expect(screen.getByText(/Loading members/)).toBeInTheDocument();
    await screen.findByText("Members unavailable.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText(/Loading members/)).toBeInTheDocument();
    await act(async () => {
      pending.resolve({ items: [member(users[0])] });
    });
    await screen.findByRole("button", { name: "Unassign Alex Tan" });
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Members unavailable.")).not.toBeInTheDocument();
  });
  it.each(["assign", "unassign"] as const)(
    "disables membership controls during %s and preserves rows on rejection",
    async (operation) => {
      vi.spyOn(api, "members").mockResolvedValue({ items: [member(users[0])] });
      let reject!: (error: Error) => void;
      const pending = new Promise<never>((_, no) => {
        reject = no;
      });
      const change = vi.spyOn(api, operation).mockReturnValue(pending);
      const user = userEvent.setup();
      open();
      await screen.findByRole("button", { name: "Unassign Alex Tan" });
      if (operation === "assign") {
        await user.selectOptions(
          screen.getByLabelText("Assign an account"),
          "4",
        );
        await user.click(screen.getByRole("button", { name: "Assign" }));
      } else
        await user.click(
          screen.getByRole("button", { name: "Unassign Alex Tan" }),
        );
      expect(screen.getByLabelText("Assign an account")).toBeDisabled();
      for (const name of ["Assign", "Unassign Alex Tan", "Refresh members"])
        expect(screen.getByRole("button", { name })).toBeDisabled();
      expect(screen.getByText(/Updating membership/)).toBeInTheDocument();
      await act(async () => {
        reject(
          new ApiError(403, {
            code: "FORBIDDEN",
            message: "Membership change denied.",
          }),
        );
      });
      await screen.findByText("Membership change denied.");
      expect(
        screen.getByRole("button", { name: "Unassign Alex Tan" }),
      ).toBeEnabled();
      expect(
        screen.queryByText(/Member assigned|Member removed/),
      ).not.toBeInTheDocument();
      expect(change).toHaveBeenCalledOnce();
    },
  );
});

describe("admin performance presentation", () => {
  const read = vi.fn<SummaryTransport["read"]>();
  const generate = vi.fn<SummaryTransport["generate"]>();
  let store: SummaryStore;
  beforeEach(() => {
    read.mockReset();
    generate.mockReset();
    read.mockResolvedValue(summary());
    store = new SummaryStore({ read, generate });
    vi.spyOn(api, "completion").mockResolvedValue(completion());
  });
  afterEach(() => store.dispose());
  const open = () =>
    render(
      <PerformancePage
        quizzes={[published]}
        classes={classes}
        selectedId={1}
        store={store}
      />,
    );
  it.each(["partial", "empty"])(
    "shows %s completion and blocks summary generation",
    async (kind) => {
      const counts =
        kind === "partial"
          ? completion(false)
          : {
              ...completion(false),
              assigned_count: 0,
              submitted_count: 0,
              in_progress_count: 0,
              not_started_count: 0,
            };
      vi.mocked(api.completion).mockResolvedValue(counts);
      open();
      await screen.findByText("Awaiting submissions");
      const progress = screen.getByRole("progressbar", {
        name: "Quiz submissions",
      });
      expect(progress).toHaveAttribute("value", String(counts.submitted_count));
      expect(progress).toHaveAttribute(
        "max",
        String(Math.max(1, counts.assigned_count)),
      );
      expect(
        screen.getByText(`/ ${counts.assigned_count} submitted`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`${counts.in_progress_count} in progress`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(`${counts.not_started_count} not started`),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Completion uses the student roster frozen at publication/,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Generate summary" }),
      ).toBeDisabled();
      expect(generate).not.toHaveBeenCalled();
    },
  );
  it("refreshes completion and summary reads and enables generation after full submission", async () => {
    vi.mocked(api.completion)
      .mockResolvedValueOnce(completion(false))
      .mockResolvedValue(completion());
    const user = userEvent.setup();
    open();
    await screen.findByText("Awaiting submissions");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Refresh quiz performance" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Refresh quiz performance" }),
    );
    await screen.findByText("Ready for insights");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate summary" }),
      ).toBeEnabled(),
    );
    expect(api.completion).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledTimes(2);
    expect(generate).not.toHaveBeenCalled();
  });
  it.each([
    ["not_requested", "Generate summary", "ensure"],
    ["success", "Regenerate summary", "new"],
    ["failed", "Retry summary", "new"],
  ] as const)(
    "wires the %s summary control to %s with action %s",
    async (status, label, action) => {
      read.mockResolvedValue(summary(status));
      generate.mockResolvedValue(summary("in_progress"));
      const user = userEvent.setup();
      open();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: label })).toBeEnabled(),
      );
      await user.click(screen.getByRole("button", { name: label }));
      expect(generate).toHaveBeenCalledWith(
        1,
        action,
        expect.any(String),
        expect.any(AbortSignal),
      );
    },
  );
  it("shows pending admission and disables the summary action", async () => {
    const pending = deferred<SummaryState>();
    generate.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    open();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate summary" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Generate summary" }));
    expect(screen.getByRole("button", { name: /Requesting/ })).toBeDisabled();
    expect(screen.getByText(/Requesting a summary/)).toBeInTheDocument();
    await act(async () => {
      pending.resolve(summary("in_progress"));
    });
    await screen.findByRole("button", { name: /Generating/ });
  });
  it("shows running work without rendering a historical result", async () => {
    read.mockResolvedValue({ ...summary("in_progress"), result: result() });
    open();
    expect(
      await screen.findByRole("button", { name: /Generating/ }),
    ).toBeDisabled();
    expect(screen.getByText(/You can leave this page/)).toBeInTheDocument();
    expect(
      screen.queryByText("Access checks need review."),
    ).not.toBeInTheDocument();
  });
  it("renders AI observations with exact metrics and question option totals", async () => {
    read.mockResolvedValue(summary("success"));
    const user = userEvent.setup();
    open();
    await screen.findByText("Access checks need review.");
    expect(screen.getByText("AI generated")).toBeInTheDocument();
    expect(
      screen.getByText(/AI observations need human judgment/),
    ).toHaveTextContent("Exact metrics come from submitted quiz results.");
    expect(screen.getByText("Recognising authentication")).toBeInTheDocument();
    expect(screen.getByText("Checking every request")).toBeInTheDocument();
    const metric = (label: string) => screen.getByText(label).parentElement!;
    expect(metric("Average score")).toHaveTextContent("0.67 / 1");
    expect(metric("Average percentage")).toHaveTextContent("66.67%");
    expect(metric("Score range")).toHaveTextContent("0–1 / 1");
    expect(metric("Submitted roster")).toHaveTextContent("3 / 3");
    await user.click(screen.getByText("Which check protects access?"));
    const details = screen
      .getByText("Which check protects access?")
      .closest("details")!;
    expect(details).toHaveAttribute("open");
    expect(within(details).getByText("66.67% correct")).toBeInTheDocument();
    expect(
      within(details).getByText(/2 correct.*1 incorrect/),
    ).toBeInTheDocument();
    for (const [option, count] of Object.entries(
      result().metrics.questions[0].option_counts,
    )) {
      const row = within(details).getByText(option, {
        selector: "strong",
      }).parentElement!;
      expect(row.querySelector("b")).toHaveTextContent(String(count));
      expect(row).toHaveTextContent(
        result().metrics.questions[0].options[option as "A" | "B" | "C" | "D"],
      );
    }
    expect(
      within(details).getByText("Correct answer").parentElement,
    ).toHaveTextContent("Authentication");
  });
  it("escapes summary and question markup and handles empty observation arrays", async () => {
    const current = summary("success");
    current.result!.summary = {
      overview: '<img src=x onerror="alert(1)">',
      strengths: [],
      areas_to_review: [],
    };
    current.result!.metrics.questions[0].question = "<script>bad()</script>";
    read.mockResolvedValue(current);
    const { container } = open();
    await screen.findByText(current.result!.summary.overview);
    expect(screen.getByText("<script>bad()</script>")).toBeInTheDocument();
    expect(container.querySelector("img, script")).toBeNull();
    expect(
      screen.getByText("No specific strengths identified."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No specific review areas identified."),
    ).toBeInTheDocument();
  });
  it("keeps completion visible and shows latest failure with explicit retry timing", async () => {
    read.mockResolvedValue({ ...summary("failed"), result: result() });
    open();
    await screen.findByText("The latest summary could not be generated.");
    expect(screen.getByText(/Service budget reached/)).toHaveTextContent(
      "Try again in 17 seconds.",
    );
    expect(screen.getByText("Ready for insights")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry summary" })).toBeEnabled();
    expect(
      screen.queryByText("Access checks need review."),
    ).not.toBeInTheDocument();
  });
  it("disables generation after a summary read failure and offers manual refresh", async () => {
    read
      .mockRejectedValueOnce(new Error("Summary unavailable."))
      .mockResolvedValue(summary());
    const user = userEvent.setup();
    open();
    await screen.findByText("Summary unavailable.");
    expect(screen.getByText("Ready for insights")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate summary" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Refresh summary" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate summary" }),
      ).toBeEnabled(),
    );
    expect(screen.queryByText("Summary unavailable.")).not.toBeInTheDocument();
  });
  it("shows a completion read error and recovers through Try again", async () => {
    vi.mocked(api.completion)
      .mockRejectedValueOnce(new Error("Completion unavailable."))
      .mockResolvedValue(completion());
    const user = userEvent.setup();
    open();
    await screen.findByText("Completion unavailable.");
    expect(
      screen.getByRole("button", { name: "Generate summary" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Ready for insights");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Generate summary" }),
      ).toBeEnabled(),
    );
  });
});
