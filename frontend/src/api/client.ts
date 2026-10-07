import type {
  AccountInput,
  ClassRoom,
  Completion,
  Member,
  Quiz,
  SafeError,
  SummaryState,
  User,
  DraftInput,
  GenerationInput,
  GenerationState,
  NoteUpload,
  Publication,
  TeacherQuiz,
  TeacherQuizItem,
} from "./types";

export const SESSION_LOST = "classroom:session-lost";
export class ApiError extends Error {
  status: number;
  code: string;
  retryAfter: number | null;
  constructor(status: number, error: SafeError) {
    super(error.message);
    this.status = status;
    this.code = error.code;
    this.retryAfter = error.retry_after_seconds ?? null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  publicRequest = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      credentials: "include",
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, {
      code: "NETWORK_ERROR",
      message:
        "Unable to reach the server. Check your connection and try again.",
    });
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: SafeError;
    } | null;
    if (response.status === 401 && !publicRequest)
      window.dispatchEvent(new Event(SESSION_LOST));
    throw new ApiError(
      response.status,
      body?.error ?? {
        code: "REQUEST_FAILED",
        message: "The request could not be completed. Please try again.",
      },
    );
  }
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
export const api = {
  me: () => request<User>("/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: User }>(
      "/auth/login",
      json("POST", { username, password }),
      true,
    ),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  users: () => request<{ items: User[] }>("/users"),
  createUser: (input: AccountInput) =>
    request<User>("/users", json("POST", input)),
  classes: (signal?: AbortSignal) =>
    request<{ items: ClassRoom[] }>("/classes", { signal }),
  createClass: (name: string) =>
    request<ClassRoom>("/classes", json("POST", { name })),
  members: (id: number, signal?: AbortSignal) =>
    request<{ items: Member[] }>(`/classes/${id}/members`, { signal }),
  assign: (classId: number, userId: number) =>
    request<Member>(`/classes/${classId}/members/${userId}`, { method: "PUT" }),
  unassign: (classId: number, userId: number) =>
    request<void>(`/classes/${classId}/members/${userId}`, {
      method: "DELETE",
    }),
  quizzes: () => request<{ items: Quiz[] }>("/quizzes"),
  teacherQuizzes: (signal?: AbortSignal) =>
    request<{ items: TeacherQuizItem[] }>("/quizzes", { signal }),
  teacherQuiz: (id: number, signal?: AbortSignal) =>
    request<TeacherQuiz>(`/quizzes/${id}`, { signal }),
  uploadNote: (classId: number, file: File, signal?: AbortSignal) => {
    const body = new FormData();
    body.append("file", file);
    return request<NoteUpload>(`/classes/${classId}/notes`, {
      method: "POST",
      body,
      signal,
    });
  },
  createDraft: (input: DraftInput, signal?: AbortSignal) =>
    request<TeacherQuiz>("/quizzes", { ...json("POST", input), signal }),
  generation: (id: number, signal?: AbortSignal) =>
    request<GenerationState>(`/quizzes/${id}/generation`, { signal }),
  generateQuiz: (
    id: number,
    input: GenerationInput,
    key: string,
    signal?: AbortSignal,
  ) =>
    request<GenerationState>(`/quizzes/${id}/generate`, {
      ...json("POST", input),
      headers: { "Idempotency-Key": key },
      signal,
    }),
  publishQuiz: (id: number, expected_revision: number, signal?: AbortSignal) =>
    request<Publication>(`/quizzes/${id}/publish`, {
      ...json("POST", { expected_revision }),
      signal,
    }),
  completion: (id: number, signal?: AbortSignal) =>
    request<Completion>(`/quizzes/${id}/completion`, { signal }),
  summary: (id: number, signal?: AbortSignal) =>
    request<SummaryState>(`/quizzes/${id}/summary`, { signal }),
  generateSummary: (
    id: number,
    action: "ensure" | "new",
    key: string,
    signal?: AbortSignal,
  ) =>
    request<SummaryState>(`/quizzes/${id}/summary`, {
      ...json("POST", { action }),
      headers: { "Idempotency-Key": key },
      signal,
    }),
};
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === "AI_APP_RATE_LIMIT") {
    return error.retryAfter != null
      ? `AI request limit reached. Please try again in ${error.retryAfter} seconds.`
      : "AI request limit reached. Please try again shortly.";
  }
  if (error instanceof ApiError && error.retryAfter != null)
    return `${error.message} Try again in ${error.retryAfter} seconds.`;
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
