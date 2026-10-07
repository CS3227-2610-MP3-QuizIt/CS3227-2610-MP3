import { useEffect, useRef, useState } from "react";
import type { ClassRoom, NoteUpload } from "../api/types";
import { api, errorMessage } from "../api/client";
import { EmptyState, Icon, Loading, Notice, PageHeading } from "../shared/ui";

export function CreateQuizPage({
  classes,
  initialClassId,
  onCreated,
}: {
  classes: ClassRoom[];
  initialClassId: number | null;
  onCreated: () => Promise<void>;
}) {
  const [classId, setClassId] = useState(
    classes.some((item) => item.id === initialClassId)
      ? String(initialClassId)
      : String(classes[0]?.id ?? ""),
  );
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState<NoteUpload | null>(null);
  const [title, setTitle] = useState("");
  const [count, setCount] = useState(5);
  const [busy, setBusy] = useState<"upload" | "create" | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function upload() {
    if (!file || busy) return;
    if (!/\.docx$/i.test(file.name)) {
      setError("Choose a .docx document. Other file types are not supported.");
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("Choose a nonempty DOCX no larger than 5 MiB.");
      return;
    }
    if (file.name.length > 255) {
      setError("Shorten the filename to at most 255 characters.");
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setBusy("upload");
    setError("");
    try {
      const uploaded = await api.uploadNote(
        Number(classId),
        file,
        current.signal,
      );
      if (!current.signal.aborted) setNote(uploaded);
    } catch (error) {
      if (!current.signal.aborted) setError(errorMessage(error));
    } finally {
      if (!current.signal.aborted) setBusy(null);
    }
  }
  async function create() {
    if (!note || busy || !title.trim() || note.class_id !== Number(classId))
      return;
    const current = new AbortController();
    controller.current = current;
    setBusy("create");
    setError("");
    try {
      const draft = await api.createDraft(
        {
          class_id: Number(classId),
          note_id: note.id,
          title: title.trim(),
          question_count: count,
        },
        current.signal,
      );
      if (!current.signal.aborted) {
        window.location.hash = `/teacher/quiz/${draft.id}`;
        void onCreated();
      }
    } catch (error) {
      if (!current.signal.aborted) setError(errorMessage(error));
    } finally {
      if (!current.signal.aborted) setBusy(null);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="A NEW START"
        title="Create a quiz"
        description="Start with your class notes. You’ll generate and review the questions next."
      />
      {!classes.length ? (
        <section className="panel">
          <EmptyState title="A class comes first">
            Ask your administrator to assign you to a class.
          </EmptyState>
        </section>
      ) : (
        <div className="teacher-create-layout">
          <section className="panel teacher-form-panel">
            <div className="teacher-step-title">
              <span className="question-number">1</span>
              <div>
                <h2>Upload your notes</h2>
                <p className="muted">One DOCX document for this quiz.</p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void upload();
              }}
            >
              <fieldset disabled={busy !== null} className="teacher-fields">
                <label>
                  Class
                  <select
                    value={classId}
                    onChange={(event) => {
                      setClassId(event.target.value);
                      setNote(null);
                      setFile(null);
                      setError("");
                    }}
                  >
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="teacher-upload" htmlFor="notes-file">
                  <span className="empty-icon">
                    <Icon name="book" />
                  </span>
                  <strong>Choose your teaching notes</strong>
                  <small>DOCX only · up to 5 MiB</small>
                  <input
                    key={classId}
                    id="notes-file"
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    required
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                      setNote(null);
                      setError("");
                    }}
                  />
                </label>
                <button
                  type="submit"
                  className="button button-secondary"
                  disabled={!file || !!note}
                >
                  {busy === "upload"
                    ? "Uploading…"
                    : note
                      ? "Notes uploaded"
                      : "Upload notes"}
                  <Icon name={note ? "check" : "arrow"} />
                </button>
              </fieldset>
            </form>
            {note ? (
              <Notice kind="success">
                <strong>{note.original_filename}</strong> is ready.{" "}
                {note.extracted_characters.toLocaleString()} text characters
                extracted.
              </Notice>
            ) : null}
            {busy === "upload" ? (
              <Loading>Checking and extracting your document…</Loading>
            ) : null}
            {error ? <Notice>{error}</Notice> : null}
            <div className="teacher-step-title teacher-step-divider">
              <span className="question-number">2</span>
              <div>
                <h2>Set up your draft</h2>
                <p className="muted">
                  Give it a name and choose how many questions to generate.
                </p>
              </div>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <fieldset className="teacher-fields" disabled={busy !== null}>
                <label>
                  Quiz title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={150}
                    required
                    placeholder="e.g. Introduction to software security"
                  />
                  <small>{title.length}/150 characters</small>
                </label>
                <label>
                  Number of questions
                  <select
                    value={count}
                    onChange={(event) => setCount(Number(event.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        {index + 1} {index === 0 ? "question" : "questions"}
                      </option>
                    ))}
                  </select>
                  <small>
                    Each question has four options and one correct answer.
                  </small>
                </label>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={
                    !note ||
                    !title.trim() ||
                    !classes.some((item) => item.id === Number(classId))
                  }
                >
                  {busy === "create" ? "Creating draft…" : "Create draft"}
                  <Icon name="arrow" />
                </button>
              </fieldset>
            </form>
          </section>
          <aside className="getting-started teacher-create-help">
            <span className="eyebrow">GOOD QUESTIONS START HERE</span>
            <h2>A little preparation goes a long way.</h2>
            <ol>
              <li>
                <span>1</span>
                <div>
                  <h3>Keep your notes focused</h3>
                  <p>
                    Text and tables work best. Images and equations aren’t
                    extracted. Use at most 12,000 text characters.
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>Guide the generation</h3>
                  <p>
                    Add optional instructions about topics or difficulty after
                    creating your draft.
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>Review before sharing</h3>
                  <p>
                    Check every question, answer, and explanation. Publishing
                    freezes the quiz and student roster.
                  </p>
                </div>
              </li>
            </ol>
          </aside>
        </div>
      )}
    </>
  );
}
