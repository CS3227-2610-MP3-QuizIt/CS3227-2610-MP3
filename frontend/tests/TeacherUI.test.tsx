import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../src/api/client";
import { CreateQuizPage } from "../src/teacher/CreateQuizPage";
import { DraftPage } from "../src/teacher/DraftPage";
import { GenerationStore } from "../src/teacher/GenerationStore";
import type { GenerationTransport } from "../src/teacher/GenerationStore";
import { classes, deferred, generation, quiz } from "./teacherFixtures";
import type { GenerationState } from "../src/api/types";

describe("teacher draft review", () => {
  const read = vi.fn<GenerationTransport["read"]>();
  const generate = vi.fn<GenerationTransport["generate"]>();
  const onDeleted = vi.fn().mockResolvedValue(undefined);
  let store: GenerationStore;
  beforeEach(() => {
    read.mockReset();
    generate.mockReset();
    onDeleted.mockClear();
    read.mockResolvedValue(generation());
    store = new GenerationStore({ read, generate });
  });
  afterEach(() => store.dispose());
  const open = () =>
    render(
      <DraftPage
        id={1}
        classes={classes}
        store={store}
        onPublished={vi.fn().mockResolvedValue(undefined)}
        onDeleted={onDeleted}
      />,
    );

  it("shows all options, keys, and explanations and requires explicit review of the current revision", async () => {
    const user = userEvent.setup();
    const publish = vi.spyOn(api, "publishQuiz").mockResolvedValue({
      ...quiz(),
      status: "published",
      assigned_student_count: 2,
    });
    open();
    await screen.findByText("Question in revision 1?");
    expect(screen.getByText("Correct answer")).toBeInTheDocument();
    expect(
      screen.getByText(quiz().questions[0].explanation),
    ).toBeInTheDocument();
    for (const option of Object.values(quiz().questions[0].options))
      expect(screen.getByText(option)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish quiz" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publish quiz" }));
    expect(publish).toHaveBeenCalledWith(1, 1, expect.any(AbortSignal));
    await screen.findByText("Published to 2 students.");
    expect(
      screen.queryByRole("button", { name: "Regenerate questions" }),
    ).not.toBeInTheDocument();
  });
  it("resets review after a later revision arrives and never publishes a stale reviewed revision", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByText("Question in revision 1?");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Publish quiz" })).toBeEnabled();
    read.mockResolvedValue(generation(4, "success", quiz(2)));
    await act(() => store.reconcile(1));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Publish quiz" })).toBeDisabled();
    expect(screen.getByText("Question in revision 2?")).toBeInTheDocument();
  });
  it("keeps the prior draft visible and disables generation and publication while accepted work runs", async () => {
    read.mockResolvedValue(generation(3, "in_progress"));
    open();
    await screen.findByText("Question in revision 1?");
    expect(
      screen.getByRole("button", { name: "Regenerate questions" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish quiz" })).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByLabelText(/Generation instructions/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeDisabled();
  });
  it("requires confirmation, permits cancellation, and retires state after deletion", async () => {
    const user = userEvent.setup();
    const deletion = vi.spyOn(api, "deleteQuiz").mockResolvedValue(undefined);
    open();
    await screen.findByText("Question in revision 1?");
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(deletion).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("button", { name: "Confirm deletion" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
    expect(deletion).toHaveBeenCalledWith(1, expect.any(AbortSignal));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(window.location.hash).toBe("#/teacher/quizzes");
    expect(store.snapshot(1).state).toBeNull();
  });
  it("hides deletion for published quizzes", async () => {
    read.mockResolvedValue(
      generation(2, "success", { ...quiz(), status: "published" }),
    );
    open();
    await screen.findByText("This quiz is published");
    expect(
      screen.queryByRole("button", { name: "Delete draft" }),
    ).not.toBeInTheDocument();
  });
  it("disables deletion during a state refresh", async () => {
    open();
    await screen.findByText("Question in revision 1?");
    const refresh = deferred<GenerationState>();
    read.mockReturnValueOnce(refresh.promise);
    let pending: Promise<void>;
    act(() => {
      pending = store.reconcile(1);
    });
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeDisabled();
    await act(async () => {
      refresh.resolve(generation());
      await pending;
    });
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeEnabled();
  });
  it("disables generation and publication while deletion is pending", async () => {
    const user = userEvent.setup();
    const response = deferred<void>();
    vi.spyOn(api, "deleteQuiz").mockReturnValue(response.promise);
    open();
    await screen.findByText("Question in revision 1?");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Regenerate questions" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish quiz" })).toBeDisabled();
    await act(async () => {
      response.resolve();
    });
    expect(onDeleted).toHaveBeenCalledOnce();
  });
  it("disables deletion when a state refresh fails", async () => {
    open();
    await screen.findByText("Question in revision 1?");
    read.mockRejectedValue(new Error("Unable to refresh"));
    await act(() => store.reconcile(1));
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeDisabled();
  });
  it("shows deletion conflicts and reconciles running generation", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "deleteQuiz").mockRejectedValue(
      new ApiError(409, {
        code: "AI_REQUEST_IN_PROGRESS",
        message: "Wait for generation before deleting.",
      }),
    );
    open();
    await screen.findByText("Question in revision 1?");
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    read.mockResolvedValue(generation(3, "in_progress"));
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
    await screen.findByText("Wait for generation before deleting.");
    expect(
      screen.getByRole("button", { name: "Confirm deletion" }),
    ).toBeDisabled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(store.snapshot(1).state?.status).toBe("in_progress");
  });
  it("sends ensure on the initial generation and new plus the current revision on reprompt", async () => {
    const user = userEvent.setup();
    read.mockResolvedValue(generation(0, "not_requested", quiz(0)));
    generate.mockResolvedValue(generation(1, "in_progress", quiz(0)));
    open();
    await screen.findByRole("button", { name: "Generate questions" });
    await user.type(
      screen.getByLabelText(/Generation instructions/),
      "Focus on security",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate questions" }),
    );
    expect(generate.mock.calls[0][1]).toEqual({
      expected_revision: 0,
      prompt: "Focus on security",
      action: "ensure",
    });
    read.mockResolvedValue(generation(2, "success"));
    await act(() => store.reconcile(1));
    await user.click(
      screen.getByRole("button", { name: "Regenerate questions" }),
    );
    expect(generate.mock.calls[1][1]).toEqual({
      expected_revision: 1,
      prompt: "Focus on security",
      action: "new",
    });
    expect(generate.mock.calls[1][2]).not.toBe(generate.mock.calls[0][2]);
  });
  it("clears review and reloads after a publication revision conflict", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "publishQuiz").mockRejectedValue(
      new ApiError(409, {
        code: "STALE_REVISION",
        message: "Review the latest revision.",
      }),
    );
    open();
    await screen.findByText("Question in revision 1?");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publish quiz" }));
    await screen.findByText("Review the latest revision.");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("renders generated markup as plain text", async () => {
    const current = quiz();
    current.questions[0].question = '<img src=x onerror="alert(1)">';
    current.questions[0].explanation = "<script>bad()</script>";
    read.mockResolvedValue(generation(2, "success", current));
    const { container } = open();
    await screen.findByText(current.questions[0].question);
    expect(container.querySelector("img, script")).toBeNull();
    expect(
      screen.getByText(current.questions[0].explanation),
    ).toBeInTheDocument();
  });
  it("does not render historical task result questions as current content", async () => {
    const state = generation(6, "success", quiz(3));
    state.result = quiz(1);
    read.mockResolvedValue(state);
    open();
    await screen.findByText("Question in revision 3?");
    expect(
      screen.queryByText("Question in revision 1?"),
    ).not.toBeInTheDocument();
  });
  it("keeps generation controls disabled during submission", async () => {
    const user = userEvent.setup();
    const slow = deferred<GenerationState>();
    generate.mockReturnValue(slow.promise);
    open();
    await screen.findByText("Question in revision 1?");
    await user.click(
      screen.getByRole("button", { name: "Regenerate questions" }),
    );
    expect(
      screen.getByRole("button", { name: "Regenerate questions" }),
    ).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    slow.resolve(generation(3, "in_progress"));
    await act(async () => {
      await slow.promise;
    });
  });
});

describe("teacher DOCX and draft creation", () => {
  // jsdom reports valueMissing for user-event's FileList despite a selected file.
  // Exercise the React form handler; native file-dialog behavior is a manual check.
  const submitUpload = () => {
    const button = screen.getByRole("button", { name: "Upload notes" });
    expect(button).toBeEnabled();
    fireEvent.submit(button.closest("form")!);
  };
  const onCreated = vi.fn().mockResolvedValue(undefined);
  const open = (rooms = classes) =>
    render(
      <CreateQuizPage
        classes={rooms}
        initialClassId={1}
        onCreated={onCreated}
      />,
    );
  const validFile = () =>
    new File(["bounded docx test fixture"], "notes.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  const uploaded = {
    id: 3,
    class_id: 1,
    original_filename: "notes.docx",
    extracted_characters: 200,
    created_at: "2026-10-01T00:00:00Z",
  };

  it("requires a successful upload before creating a draft and defaults to five questions", async () => {
    const user = userEvent.setup();
    const upload = vi.spyOn(api, "uploadNote").mockResolvedValue(uploaded);
    const create = vi.spyOn(api, "createDraft").mockResolvedValue(quiz(0));
    open();
    expect(screen.getByLabelText(/Number of questions/)).toHaveValue("5");
    await user.type(
      screen.getByLabelText(/Quiz title/),
      "Security fundamentals",
    );
    expect(screen.getByRole("button", { name: "Create draft" })).toBeDisabled();
    await user.upload(
      screen.getByLabelText(/Choose your teaching notes/),
      validFile(),
    );
    submitUpload();
    await screen.findByText("notes.docx");
    expect(upload).toHaveBeenCalledWith(
      1,
      expect.any(File),
      expect.any(AbortSignal),
    );
    await user.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        {
          class_id: 1,
          note_id: 3,
          title: "Security fundamentals",
          question_count: 5,
        },
        expect.any(AbortSignal),
      ),
    );
    expect(window.location.hash).toBe("#/teacher/quiz/1");
  });
  it("rejects non-DOCX and oversized files before sending a request", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const upload = vi.spyOn(api, "uploadNote");
    open();
    await user.upload(
      screen.getByLabelText(/Choose your teaching notes/),
      new File(["pdf"], "notes.pdf"),
    );
    submitUpload();
    await screen.findByText(/Choose a .docx document/);
    await user.upload(
      screen.getByLabelText(/Choose your teaching notes/),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "notes.docx"),
    );
    submitUpload();
    await screen.findByText(/no larger than 5 MiB/);
    expect(upload).not.toHaveBeenCalled();
  });
  it("clears an uploaded note when switching classes", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "uploadNote").mockResolvedValue(uploaded);
    open([
      ...classes,
      { id: 2, name: "Other class", created_at: classes[0].created_at },
    ]);
    await user.type(screen.getByLabelText(/Quiz title/), "A quiz");
    await user.upload(
      screen.getByLabelText(/Choose your teaching notes/),
      validFile(),
    );
    submitUpload();
    await screen.findByText("notes.docx");
    expect(screen.getByRole("button", { name: "Create draft" })).toBeEnabled();
    await user.selectOptions(screen.getByLabelText("Class"), "2");
    expect(screen.getByRole("button", { name: "Create draft" })).toBeDisabled();
    expect(screen.queryByText("notes.docx")).not.toBeInTheDocument();
  });
  it("shows server upload rejection and does not create or generate a quiz", async () => {
    const user = userEvent.setup();
    vi.spyOn(api, "uploadNote").mockRejectedValue(
      new ApiError(422, {
        code: "INVALID_DOCX",
        message: "Invalid document archive.",
      }),
    );
    const create = vi.spyOn(api, "createDraft");
    const generate = vi.spyOn(api, "generateQuiz");
    open();
    await user.upload(
      screen.getByLabelText(/Choose your teaching notes/),
      validFile(),
    );
    submitUpload();
    await screen.findByText("Invalid document archive.");
    expect(screen.getByRole("button", { name: "Create draft" })).toBeDisabled();
    expect(create).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it("has no creation actions without an assigned class", () => {
    open([]);
    expect(screen.getByText("A class comes first")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create draft" }),
    ).not.toBeInTheDocument();
  });
});
