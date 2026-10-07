-- Initial application migration, derived from specs/schema.sql.
-- Database.initialize applies this once within a versioned transaction.
-- Enable foreign_keys and busy_timeout on every application connection.
PRAGMA foreign_keys = ON;
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

CREATE TABLE login_failures (
    username TEXT NOT NULL,
    source_ip TEXT NOT NULL,
    failed_at TEXT NOT NULL
);
CREATE INDEX idx_login_failures_scope_time
    ON login_failures(username, source_ip, failed_at);

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

-- Durable targets provide latest-task identity and per-target ordering.
-- The circular latest-task reference is populated only after inserting its task
-- in the same admission transaction. A null latest pointer has version zero.
CREATE TABLE ai_targets (
    id INTEGER PRIMARY KEY,
    feature TEXT NOT NULL CHECK (feature IN ('quiz_generation', 'hint', 'summary')),
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    attempt_id INTEGER,
    question_id INTEGER,
    version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
    latest_request_id TEXT,
    FOREIGN KEY (attempt_id, quiz_id) REFERENCES quiz_attempts(id, quiz_id),
    FOREIGN KEY (question_id, quiz_id) REFERENCES quiz_questions(id, quiz_id),
    FOREIGN KEY (latest_request_id, id) REFERENCES ai_requests(id, target_id),
    CHECK (
        (feature IN ('quiz_generation', 'summary')
            AND attempt_id IS NULL AND question_id IS NULL) OR
        (feature = 'hint' AND attempt_id IS NOT NULL AND question_id IS NOT NULL)
    ),
    CHECK (
        (version = 0 AND latest_request_id IS NULL) OR
        (version > 0 AND latest_request_id IS NOT NULL)
    )
);
CREATE UNIQUE INDEX uq_generation_target ON ai_targets(quiz_id)
    WHERE feature = 'quiz_generation';
CREATE UNIQUE INDEX uq_summary_target ON ai_targets(quiz_id)
    WHERE feature = 'summary';
CREATE UNIQUE INDEX uq_hint_target ON ai_targets(attempt_id, question_id)
    WHERE feature = 'hint';

-- Database rows persist operation history and rolling admission timestamps;
-- they do not schedule or resume work. Restart fails leftover running tasks.
-- State/result/version changes and latest pointers must commit atomically.
CREATE TABLE ai_requests (
    id TEXT NOT NULL PRIMARY KEY,
    target_id INTEGER NOT NULL REFERENCES ai_targets(id),
    actor_id INTEGER NOT NULL REFERENCES users(id),
    expected_revision INTEGER CHECK (expected_revision >= 0),
    status TEXT NOT NULL CHECK (
        status IN ('running', 'succeeded', 'failed')
    ),
    state_version INTEGER NOT NULL CHECK (state_version > 0),
    input_json TEXT NOT NULL,
    model_id TEXT NOT NULL,
    input_tokens INTEGER CHECK (input_tokens >= 0),
    output_tokens INTEGER CHECK (output_tokens >= 0),
    total_tokens INTEGER CHECK (total_tokens >= 0),
    provider_status INTEGER,
    error_code TEXT,
    http_status INTEGER,
    response_json TEXT,
    created_at TEXT NOT NULL,
    deadline_at TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    UNIQUE (id, target_id),
    CHECK (
        (status = 'running'
            AND finished_at IS NULL AND error_code IS NULL
            AND http_status IS NULL AND response_json IS NULL) OR
        (status = 'succeeded' AND finished_at IS NOT NULL AND error_code IS NULL
            AND http_status = 200 AND http_status IS NOT NULL
            AND response_json IS NOT NULL) OR
        (status = 'failed' AND finished_at IS NOT NULL AND error_code IS NOT NULL
            AND http_status IS NOT NULL AND http_status BETWEEN 400 AND 599
            AND response_json IS NOT NULL)
    )
);
CREATE INDEX idx_ai_requests_actor_time ON ai_requests(actor_id, created_at);
CREATE INDEX idx_ai_requests_admission_time ON ai_requests(created_at);
CREATE INDEX idx_ai_requests_deadline ON ai_requests(status, deadline_at);
CREATE UNIQUE INDEX uq_unfinished_target ON ai_requests(target_id)
    WHERE status = 'running';

-- Accepted calls that reuse work still bind their key to that existing task.
-- Multiple users/keys may refer to one shared summary task. Admission rejections
-- create no binding. Method, route, and canonical body/action are in request_hash.
CREATE TABLE ai_operation_keys (
    actor_id INTEGER NOT NULL REFERENCES users(id),
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    ai_request_id TEXT NOT NULL REFERENCES ai_requests(id),
    created_at TEXT NOT NULL,
    PRIMARY KEY (actor_id, idempotency_key)
);
CREATE INDEX idx_ai_operation_keys_task ON ai_operation_keys(ai_request_id);

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
    FOREIGN KEY (question_id, quiz_id) REFERENCES quiz_questions(id, quiz_id)
);
CREATE INDEX idx_hints_allowance ON hints(attempt_id, question_id);

-- One currently applied successful summary; explicit regeneration replaces it.
-- Older normalized results remain in ai_requests.response_json. Latest target
-- state determines UI success/failure even if this row holds an older success.
CREATE TABLE quiz_summaries (
    quiz_id INTEGER PRIMARY KEY REFERENCES quizzes(id),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    metrics_json TEXT NOT NULL,
    summary_json TEXT NOT NULL,
    ai_request_id TEXT NOT NULL UNIQUE REFERENCES ai_requests(id),
    created_at TEXT NOT NULL
);

-- Backend BEGIN IMMEDIATE transactions enforce the remaining specification:
-- roles, immutable snapshots, matching feature/target/result references,
-- expected_revision present only for generation, shared rolling rate admission,
-- monotonic versions, valid state transitions and deadline handling, atomic
-- result/terminal-state application, hint allowance, and summary eligibility.
-- Conditional state updates/completions must check affected rows; provider I/O must
-- never occur inside these transactions. This schema is not a migration runner.
