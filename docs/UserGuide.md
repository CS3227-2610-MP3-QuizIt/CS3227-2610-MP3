# Class quiz backend user guide

This delivery supplies the backend API and browser login and admin screens. From
`frontend/`, run `npm ci` and `npm run dev`, then open http://localhost:5173.
Start the backend separately as described in the developer guide. There is no public
deployed application yet. A fresh deployment automatically creates
the demo accounts listed in [the backend README](../backend/README.md).

Administrators can use Accounts to create and filter student and teacher accounts;
Classes to create a class and assign or unassign members; and Quiz performance to
view frozen-roster completion and generate, retry, or regenerate an AI summary once
everyone submits. Summaries show exact backend metrics alongside labeled AI observations.
Latest running or failed work replaces older successful content in the display; rate
rejection retains the prior state. Refresh workspace reloads accounts, classes, and
quizzes, and each selected class or quiz has a refresh control. Sign out revokes the
session. Students and teachers currently see a signed-in placeholder; their workflows
below remain available through the backend API.

All paths below start with `/api/v1`. Local development listens on port 7000. The example configuration allows any browser Origin. With an explicit origin list,
your frontend must use one of the listed origins; the code default is `http://localhost:5173`. Login with `POST /auth/login` and
`{"username":"...","password":"..."}`. Retain the returned cookie; `GET /auth/me`
shows your identity and `POST /auth/logout` revokes the session. Sessions expire after
eight hours. All errors have an `error` object with a code, safe message, details, and
optional retry timing.

Administrators create student and teacher accounts through `POST /users`, supplying
username, display name, a password of 12–128 characters, and role `student` or `teacher`.
They list accounts with `GET /users`, create classes with `POST /classes`, and manage
membership through `PUT` or `DELETE /classes/{class_id}/members/{user_id}`. Repeated
assignments are safe. Creating additional administrators through the API is unsupported.

Teachers see their assigned classes and own quizzes. Upload one DOCX using multipart
field `file` at `POST /classes/{class_id}/notes`. The limits are 5 MiB compressed,
20 MiB expanded, and 12,000 extracted text characters. Paragraphs and table text are
supported; images, equations, and external content are not extracted. Create a draft
using `POST /quizzes` with `class_id`, `note_id`, `title`, and optional `question_count`
(default 5, range 1–10).

Generate a draft through `POST /quizzes/{quiz_id}/generate` with `expected_revision`,
optional `prompt`, and optional `action`. Read `GET /quizzes/{quiz_id}` to review all
questions, four options, correct options, and explanations. Use `action: "new"` with
a fresh operation key to reprompt. After reviewing the exact revision, explicitly
publish through `POST /quizzes/{quiz_id}/publish` with that `expected_revision`.
Publishing requires valid questions, at least one assigned student, and no active
generation. Published content and its student roster are frozen. A teacher must remain
assigned to manage or read their quizzes.

Students list their assigned published quizzes through `GET /quizzes`. Start or resume
with `POST /quizzes/{quiz_id}/attempt`. Read the quiz and attempt, and save selections
using `PUT /attempts/{attempt_id}/answers/{question_id}` with `selected_option` A–D.
Selections survive refresh. Students can request a conceptual hint through
`POST /attempts/{attempt_id}/questions/{question_id}/hints` with an optional prompt.
Each question allows two successful hints; failed hints do not count. New hints require
an in-progress attempt. Submit through `POST /attempts/{attempt_id}/submit` after saving
every answer. Submission freezes the result and computes the score without AI.
`GET /attempts/{attempt_id}/results` then reveals correct options and explanations.
An unassigned student still retains an existing frozen publication attempt.

Administrators read `GET /quizzes/{quiz_id}/completion`. A summary becomes eligible only
after every student in the frozen roster submits. Request it through
`POST /quizzes/{quiz_id}/summary` with `{}`; use `{"action":"new"}` to regenerate.
`GET /quizzes/{quiz_id}/summary` returns the latest task and, on success, exact backend
metrics alongside AI observations. Treat those observations as AI generated and review
them critically. No pass mark or pass rate is defined.

Each AI POST requires a UUID `Idempotency-Key` header. Keep the key and unchanged input
when repeating one action. `ensure` is the default: it returns existing latest work,
including an existing failure. Explicit retries or regenerations use `new` and a fresh
key. An active task is reused even if a later request proposes another prompt.
AI POSTs return immediately with 202 for active work or 200 for a reused terminal task.
Fetch generation, hint, summary, or historical task state to see the outcome. A failed
task is returned with HTTP 200 and a nested error containing its original failure status.
For invalid AI output, the error details also identify the validation stage and a safe
reason, such as malformed JSON or an incorrect question count. No partial questions
replace the draft. An explicit new generation is required to retry.

`GET /ai/events` sends change notifications containing IDs and versions only. Read the
relevant state endpoint afterward. A client should reconcile unfinished work every five
seconds, back off failed reads, and ignore responses older than its applied target
version. A browser disconnect does not cancel accepted work. Restarted running tasks
become interrupted failures; retry explicitly when eligible.

The application allows 30 fresh AI requests across all users and features in a rolling
60-second window. An excess request returns 429 `AI_APP_RATE_LIMIT` immediately with
matching `Retry-After` and `retry_after_seconds`. This timing reserves no slot. Gateway
rate or budget failures have code `AI_PROVIDER_LIMIT`. No provider call is retried
automatically. Hints cannot guarantee the absence of every semantic answer implication;
teachers remain responsible for quiz correctness. Ordinary answer saving, submission,
and publication of an already reviewed draft work during AI outages.
