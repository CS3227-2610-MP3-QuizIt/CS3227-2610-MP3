# Classroom user guide

This delivery supplies the backend API and browser login, admin, teacher, and student screens. From
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
session.

Students open **My quizzes** to see published quizzes from their frozen assignment roster,
including quizzes from classes they have since left. Select **Start**, **Resume**, or
**View results**. **Refresh quizzes** reloads the list. The attempt shows every question
in order with four options and restores saved choices. Selecting an option saves it
immediately; that question is disabled while saving. Wait for **Saved**. **Save failed**
keeps your choice visible; select **Retry save** or change the choice explicitly.

Each question offers an optional hint prompt of at most 500 characters. **Ask for a hint**
restores existing latest work or requests a first conceptual hint. **Another hint** and
**Retry hint** request fresh work. Generation is disabled while hint state is unresolved
or running. The backend generates and then checks each hint for relevance and answer
leakage; the hint stays in progress until both steps finish. Rejected or unverifiable
hints are withheld; use **Retry hint** to request another. AI checks can still misjudge
a hint, so review its guidance critically. A latest running or failed hint replaces an older hint in the display;
rejected admission keeps the previous state. If a request is uncertain, **Repeat previous
request** preserves its original prompt and key. Rate errors show retry timing when known;
requests never repeat automatically. The backend enforces the successful-hint allowance;
the UI shows allowance errors without estimating a remaining count. Hint problems do not
prevent saving answers or submitting. Hint state recovers on focus, network recovery,
SSE reconnect, and five-second polling while unfinished, with backoff on failed reads.

Select **Submit quiz** after choosing every answer. Submission freezes editing and waits
for pending saves; retry failed saves before submitting. An uncertain submission pauses
editing until the backend confirms whether it committed. If that check fails, use
**Check submission**. After submission, the results show your final score, percentage,
selected and correct answers, correctness, and explanations. Submitted attempts cannot
be edited. Signing out clears browser session state; saved answers remain on the server.

Teachers open **My classes** to see assigned classes and **My quizzes** to search or
filter their own drafts and published quizzes. Select **Create quiz**, choose a class,
select a DOCX no larger than 5 MiB, and select **Upload notes**. After extraction succeeds,
enter a title (at most 150 characters), select 1–10 questions (default 5), and select
**Create draft**. This creates a private draft without calling AI.

In the draft, enter optional generation instructions (at most 1,000 characters) and
select **Generate questions**. Review every question, all four options, the marked
correct answer, and the explanation. To refine them, enter new instructions and select
**Regenerate questions**. The question count stays fixed. Your last valid questions
remain visible during generation and after a failure; generation and publication are
disabled while work is running. **Retry generation** explicitly retries failed work.
An uncertain network request offers **Repeat previous request**, which preserves the
original instructions and operation key. No generation is automatically retried.

Check the confirmation that you reviewed the displayed revision, then select
**Publish quiz**. A new revision or generation request clears that confirmation.
Publication requires at least one currently assigned student and freezes both the
questions and roster. Published quizzes are available for reading only. **Refresh quiz**,
page entry, window focus, and network recovery restore backend state. Running generation
is checked every five seconds, so you can leave and reopen the draft. Your administrator
must keep you assigned to the class for quiz access.

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

On the draft review screen, select **Delete draft**, then **Confirm deletion**.
Published quizzes and drafts with running generation cannot be deleted. Deletion
removes the draft and its questions; uploaded notes are also removed when no other
quiz uses them. After deletion, you return to your refreshed quiz list.

Students list their assigned published quizzes through `GET /quizzes`. Start or resume
with `POST /quizzes/{quiz_id}/attempt`. Read the quiz and attempt, and save selections
using `PUT /attempts/{attempt_id}/answers/{question_id}` with `selected_option` A–D.
Selections survive refresh. Students can request a conceptual hint through
`POST /attempts/{attempt_id}/questions/{question_id}/hints` with an optional prompt.
Each question allows the configured number of verified successful hints (default 1000); failed hints do not count. New hints require
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
version. AI generation has a 300-second execution deadline. A browser disconnect does
not cancel accepted work. Restarted running tasks become interrupted failures; retry
explicitly when eligible.

The application allows 1024 fresh AI requests across all users and features in a rolling
60-second window. An excess request returns 429 `AI_APP_RATE_LIMIT` immediately with
matching `Retry-After` and `retry_after_seconds`. This timing reserves no slot. Gateway
rate or budget failures have code `AI_PROVIDER_LIMIT`. No provider call is retried
automatically. Hints cannot guarantee the absence of every semantic answer implication;
teachers remain responsible for quiz correctness. Ordinary answer saving, submission,
and publication of an already reviewed draft work during AI outages.
