from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Role = Literal["student", "teacher", "admin"]
Option = Literal["A", "B", "C", "D"]
Username = Annotated[
    str, StringConstraints(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
]
DisplayName = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Password = Annotated[str, StringConstraints(min_length=12, max_length=128)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Empty(StrictModel):
    pass


class Login(StrictModel):
    username: Username
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class UserCreate(StrictModel):
    username: Username
    display_name: DisplayName
    password: Password
    role: Literal["student", "teacher"]


class PublicUser(StrictModel):
    id: int
    username: str
    display_name: str
    role: Role


class LoginResponse(StrictModel):
    user: PublicUser


class UsersResponse(StrictModel):
    items: list[PublicUser]


class ClassCreate(StrictModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]


class ClassResponse(StrictModel):
    id: int
    name: str
    created_at: str


class ClassesResponse(StrictModel):
    items: list[ClassResponse]


class Member(PublicUser):
    assigned_at: str


class MembersResponse(StrictModel):
    items: list[Member]


class NoteResponse(StrictModel):
    id: int
    class_id: int
    original_filename: str
    extracted_characters: int
    created_at: str


class QuizCreate(StrictModel):
    class_id: Annotated[int, Field(strict=True, gt=0)]
    note_id: Annotated[int, Field(strict=True, gt=0)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
    question_count: Annotated[int, Field(strict=True, ge=1, le=10)] = 5


class RevisionRequest(StrictModel):
    expected_revision: Annotated[int, Field(strict=True, ge=0)]


class Options(StrictModel):
    A: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    B: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    C: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    D: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]

    @model_validator(mode="after")
    def distinct(self) -> Options:
        normalized = [value.casefold() for value in self.model_dump().values()]
        if len(set(normalized)) != 4:
            raise ValueError("All four options must be distinct")
        return self


class StudentQuestion(StrictModel):
    id: int
    position: int
    question: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)
    ]
    options: Options


class TeacherQuestion(StudentQuestion):
    correct_option: Option
    explanation: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1500)
    ]


class QuizMetadata(StrictModel):
    id: int
    class_id: int
    title: str
    question_count: int
    status: Literal["draft", "published"]
    revision: int
    created_at: str
    published_at: str | None


class TeacherQuiz(QuizMetadata):
    teacher_id: int
    note_id: int
    questions: list[TeacherQuestion]


class StudentQuiz(QuizMetadata):
    attempt_id: int
    attempt_status: Literal["not_started", "in_progress", "submitted"]
    score: int | None = None
    questions: list[StudentQuestion]


class AdminQuiz(QuizMetadata):
    pass


class TeacherQuizListItem(QuizMetadata):
    class_name: str


class StudentQuizListItem(QuizMetadata):
    class_name: str
    attempt_id: int
    attempt_status: Literal["not_started", "in_progress", "submitted"]
    score: int | None = None


class AdminQuizListItem(QuizMetadata):
    class_name: str


class QuizzesResponse(StrictModel):
    items: list[StudentQuizListItem | TeacherQuizListItem | AdminQuizListItem]


class Publication(QuizMetadata):
    assigned_student_count: int


class AnswerRequest(StrictModel):
    selected_option: Option


class SavedAnswer(StrictModel):
    question_id: int
    selected_option: Option
    updated_at: str


class AttemptResponse(StrictModel):
    id: int
    quiz_id: int
    status: Literal["not_started", "in_progress", "submitted"]
    started_at: str | None
    answers: list[SavedAnswer]
    hints: list[dict[str, Any]]


class ScoreResponse(StrictModel):
    id: int
    quiz_id: int
    status: Literal["submitted"]
    score: int
    total_questions: int
    score_percent: float
    submitted_at: str


class ResultQuestion(TeacherQuestion):
    selected_option: Option
    is_correct: bool


class ResultsResponse(ScoreResponse):
    questions: list[ResultQuestion]


class CompletionResponse(StrictModel):
    quiz_id: int
    assigned_count: int
    submitted_count: int
    not_started_count: int
    in_progress_count: int
    summary_eligible: bool
    has_summary: bool


class GenerationRequest(RevisionRequest):
    prompt: Annotated[str, StringConstraints(max_length=1000)] = ""
    action: Literal["ensure", "new"] = "ensure"

    @field_validator("prompt")
    @classmethod
    def normalize_prompt(cls, value: str) -> str:
        return " ".join(value.split())


class HintRequest(StrictModel):
    prompt: Annotated[str, StringConstraints(max_length=500)] = "Give me a conceptual clue."
    action: Literal["ensure", "new"] = "ensure"

    @field_validator("prompt")
    @classmethod
    def normalize_prompt(cls, value: str) -> str:
        return " ".join(value.split()) or "Give me a conceptual clue."


class SummaryRequest(StrictModel):
    action: Literal["ensure", "new"] = "ensure"
