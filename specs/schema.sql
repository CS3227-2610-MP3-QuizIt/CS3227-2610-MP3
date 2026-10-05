-- Reference SQLite schema for the core quiz application.
-- This defines the specification; it is not an application migration runner.
-- Enable foreign_keys and busy_timeout on every application connection.
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    display_name TEXT NOT NULL CHECK (length(trim(display_name)) > 0),
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    created_at TEXT NOT NULL
);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE classes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL
);

CREATE TABLE class_memberships (
    class_id INTEGER NOT NULL REFERENCES classes(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    assigned_at TEXT NOT NULL,
    PRIMARY KEY (class_id, user_id)
);
CREATE INDEX idx_memberships_user ON class_memberships(user_id, class_id);

CREATE TABLE notes (
    id INTEGER PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    uploaded_by INTEGER NOT NULL REFERENCES users(id),
    original_filename TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    file_sha256 TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
    extracted_text TEXT NOT NULL CHECK (length(trim(extracted_text)) > 0),
    created_at TEXT NOT NULL,
    UNIQUE (id, class_id, uploaded_by)
);

CREATE TABLE quizzes (
    id INTEGER PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    teacher_id INTEGER NOT NULL REFERENCES users(id),
    note_id INTEGER NOT NULL,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    question_count INTEGER NOT NULL CHECK (question_count BETWEEN 1 AND 10),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
    created_at TEXT NOT NULL,
    published_at TEXT,
    FOREIGN KEY (note_id, class_id, teacher_id)
        REFERENCES notes(id, class_id, uploaded_by),
    CHECK (
        (status = 'draft' AND published_at IS NULL) OR
        (status = 'published' AND published_at IS NOT NULL AND revision > 0)
    )
);
CREATE INDEX idx_quizzes_class_status ON quizzes(class_id, status);
CREATE INDEX idx_quizzes_teacher ON quizzes(teacher_id, class_id);

CREATE TABLE quiz_questions (
    id INTEGER PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    position INTEGER NOT NULL CHECK (position BETWEEN 1 AND 10),
    question_text TEXT NOT NULL CHECK (length(trim(question_text)) > 0),
    option_a TEXT NOT NULL CHECK (length(trim(option_a)) > 0),
    option_b TEXT NOT NULL CHECK (length(trim(option_b)) > 0),
    option_c TEXT NOT NULL CHECK (length(trim(option_c)) > 0),
    option_d TEXT NOT NULL CHECK (length(trim(option_d)) > 0),
    correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT NOT NULL CHECK (length(trim(explanation)) > 0),
    UNIQUE (quiz_id, position),
    UNIQUE (id, quiz_id)
);

-- Publication creates one attempt per student and thereby freezes the roster.
CREATE TABLE quiz_attempts (
    id INTEGER PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN ('not_started', 'in_progress', 'submitted')),
    score INTEGER CHECK (score >= 0),
    started_at TEXT,
    submitted_at TEXT,
    UNIQUE (quiz_id, student_id),
    UNIQUE (id, quiz_id),
    CHECK (
        (status = 'not_started' AND started_at IS NULL
            AND submitted_at IS NULL AND score IS NULL) OR
        (status = 'in_progress' AND started_at IS NOT NULL
            AND submitted_at IS NULL AND score IS NULL) OR
        (status = 'submitted' AND started_at IS NOT NULL
            AND submitted_at IS NOT NULL AND score IS NOT NULL)
    )
);
CREATE INDEX idx_attempts_student ON quiz_attempts(student_id, quiz_id);
CREATE INDEX idx_attempts_completion ON quiz_attempts(quiz_id, status);

CREATE TABLE attempt_answers (
    attempt_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    selected_option TEXT NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (attempt_id, question_id),
    FOREIGN KEY (attempt_id, quiz_id) REFERENCES quiz_attempts(id, quiz_id),
    FOREIGN KEY (question_id, quiz_id) REFERENCES quiz_questions(id, quiz_id)
);

-- Only admitted AI operations get an idempotency record. Result JSON contains
-- the role-specific success response or normalized error, never provider secrets.
CREATE TABLE ai_requests (
    id TEXT NOT NULL PRIMARY KEY,
    actor_id INTEGER NOT NULL REFERENCES users(id),
    feature TEXT NOT NULL CHECK (feature IN ('quiz_generation', 'hint', 'summary')),
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    attempt_id INTEGER,
    question_id INTEGER,
    expected_revision INTEGER CHECK (expected_revision >= 0),
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    model_id TEXT NOT NULL,
    input_tokens INTEGER CHECK (input_tokens >= 0),
    output_tokens INTEGER CHECK (output_tokens >= 0),
    total_tokens INTEGER CHECK (total_tokens >= 0),
    provider_status INTEGER,
    error_code TEXT,
    http_status INTEGER,
    response_json TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT,
    UNIQUE (actor_id, idempotency_key),
    FOREIGN KEY (attempt_id, quiz_id) REFERENCES quiz_attempts(id, quiz_id),
    FOREIGN KEY (question_id, quiz_id) REFERENCES quiz_questions(id, quiz_id),
    CHECK (
        (feature = 'quiz_generation' AND expected_revision IS NOT NULL
            AND attempt_id IS NULL AND question_id IS NULL) OR
        (feature = 'hint' AND expected_revision IS NULL
            AND attempt_id IS NOT NULL AND question_id IS NOT NULL) OR
        (feature = 'summary' AND expected_revision IS NULL
            AND attempt_id IS NULL AND question_id IS NULL)
    ),
    CHECK (
        (status = 'running' AND finished_at IS NULL AND error_code IS NULL
            AND http_status IS NULL AND response_json IS NULL) OR
        (status = 'succeeded' AND finished_at IS NOT NULL AND error_code IS NULL
            AND http_status IS NOT NULL AND http_status = 200
            AND response_json IS NOT NULL) OR
        (status = 'failed' AND finished_at IS NOT NULL AND error_code IS NOT NULL
            AND http_status IS NOT NULL AND http_status BETWEEN 400 AND 599
            AND response_json IS NOT NULL)
    )
);
CREATE INDEX idx_ai_requests_actor_time ON ai_requests(actor_id, created_at);
CREATE UNIQUE INDEX uq_running_generation ON ai_requests(quiz_id)
    WHERE feature = 'quiz_generation' AND status = 'running';
CREATE UNIQUE INDEX uq_running_summary ON ai_requests(quiz_id)
    WHERE feature = 'summary' AND status = 'running';
CREATE UNIQUE INDEX uq_running_hint ON ai_requests(attempt_id, question_id)
    WHERE feature = 'hint' AND status = 'running';

CREATE TABLE hints (
    id INTEGER PRIMARY KEY,
    attempt_id INTEGER NOT NULL,
    quiz_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    prompt TEXT NOT NULL,
    prompt_hash TEXT NOT NULL,
    hint_text TEXT NOT NULL CHECK (length(trim(hint_text)) > 0),
    ai_request_id TEXT NOT NULL UNIQUE REFERENCES ai_requests(id),
    created_at TEXT NOT NULL,
    FOREIGN KEY (attempt_id, quiz_id) REFERENCES quiz_attempts(id, quiz_id),
    FOREIGN KEY (question_id, quiz_id) REFERENCES quiz_questions(id, quiz_id),
    UNIQUE (attempt_id, question_id, prompt_hash)
);

CREATE TABLE quiz_summaries (
    quiz_id INTEGER PRIMARY KEY REFERENCES quizzes(id),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    metrics_json TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    ai_request_id TEXT NOT NULL UNIQUE REFERENCES ai_requests(id),
    created_at TEXT NOT NULL
);

-- Backend transactions enforce the remaining business rules listed in
-- Specification.md: roles, permissions, published content immutability,
-- exact question count, allowed state transitions and summary eligibility.
