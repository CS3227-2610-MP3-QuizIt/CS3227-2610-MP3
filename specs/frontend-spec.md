# Core quiz application frontend specification

This specification defines a class quiz app for students, teachers, and administrators. Teachers turn DOCX notes into an AI generated quiz, review and reprompt the draft, and publish it. Students answer the published quiz and can request hints. Administrators manage accounts and classes and request an AI summary after every assigned student submits.

The frontend uses TypeScript, React 19, Tailwind CSS, and Vite. The backend uses Python 3.14, FastAPI, and SQLite. **Every AI request must go through SoCLaaS.** This document specifies frontend behavior; the implementation lives in `frontend/`.

The supplied [SoCLaaS reference](../backend/soclaas-docs.md) is the authority for the gateway contract. The [assignment brief](../assignment-brief.md) supplies the requirements for AI security, separate development and production environments, and a spec driven development process. Product behavior and numeric limits below are proposed application defaults, not claims about the gateway's configured quotas.

## Scope and product rules

| Role | Core capabilities |
| --- | --- |
| Student | Log in, see published quizzes assigned to them, start or resume an attempt, save answers, request question hints, submit, and view their score and explanations. |
| Teacher | Log in, see assigned classes, upload DOCX notes, create a quiz draft, generate or reprompt its questions, review the answer key and explanations, and publish. |
| Admin | Log in, create student and teacher accounts, create classes, assign or unassign students and teachers, view quiz completion, and request or view a class performance summary. |

The following decisions make the requested features precise:

- An account has exactly one role. Administrators cannot create more admin accounts through the app; demo accounts are seeded automatically on a fresh database at startup.
- A class may have multiple students and teachers. Membership is managed only by admins.
- A quiz belongs to one class, one teacher, and one uploaded DOCX. Only that teacher can manage the draft, and they must still be assigned to the class.
- A quiz contains 1 to 10 questions, with 5 as the default. Every question has exactly four nonempty, distinct options labeled A, B, C, and D, exactly one correct option, and a nonempty explanation. The teacher chooses the title and count when creating the draft; reprompting changes question content while keeping that count.
- Publication freezes both the questions and the student roster. It creates one attempt for each student currently assigned to the class. Publishing with no students is rejected.
- Each student gets one attempt. They can resume it until submission. Every question must be answered before submitting. Each correct answer earns one point; incorrect answers earn zero. The backend grades without AI.
- Answers and explanations become available to a student only after their own submission. Published quiz content and submitted attempts are immutable.
- A class performance summary is for one published quiz. It is eligible only when the nonempty publication roster has entirely submitted. Later class membership changes do not alter that roster or its completion denominator.
- Removing a class membership affects future quizzes. An existing student attempt stays accessible. Removing a teacher's membership prevents further draft management and publication but does not interrupt published student attempts.

Excluded from this version: self registration, password recovery, account deletion, multiple attempts, quiz timers, quiz deadlines, other question formats, manual question editing, chat history, general user notifications (AI state-change SSE is included), gradebooks, exports, OCR, PDF uploads, vector search, alternate AI providers, and AI initiated account or publication actions.

### Notification-only SSE and reconciliation

SSE is an invalidation signal, not the result transport. A change event contains only the feature/target identity, task ID, and target version. It must contain no generated content, success/failure status, error code/message, or provider details. Emit it only after the state/version transaction commits. State GETs return the authoritative latest task and any normalized result/error. Authenticate the stream and scope every notification/read to current role and resource access; a task UUID grants no access. Filter access when sending events, revalidate long-lived streams, and close on session expiry/revocation.

Events on a single SSE connection are delivered in stream order, but delayed server publication, reconnection/replay, missed events, and overlapping API requests can yield stale application information. Versions establish freshness; timestamps are optional diagnostic metadata only. Key frontend state by feature and scoped resource IDs, including before a target row exists. For each target, track `applied_version` (last successfully applied API state) and `highest_notified_version` separately:

- Ignore events with `version <= applied_version`. A newer event triggers a read of the target's latest-state endpoint, not an old task fetched from the event ID.
- Coalesce reads per target. If a newer notification arrives during a fetch, keep its version and fetch again if the response does not cover it. A failed fetch retries with backoff; receiving an event does not advance `applied_version`.
- Discard API responses older than the applied version, regardless of arrival order. All initial reads, POST responses/replays, polling, and SSE-triggered reads use this same guard. During a new-generation submission, suppress earlier outstanding responses until the accepted task/version is reconciled. If admission is rejected, clear submission loading, retain the prior target state, and reconcile that target without waiting for a new task/version.
- Read current state on page entry, window focus, after SSE establishment/reconnection, and after reconnecting to the network. If SSE cannot be established, use state reads rather than waiting indefinitely for subscription. While an observed task is unfinished, reconcile every 5 seconds even if SSE appears healthy; retry failed reads with backoff. Open the subscription before the reconciliation read to close the initial read/subscription gap. Stop periodic task reads after terminal state, but continue listening for later generations.

A dropped terminal event must never leave the UI loading forever. A crash after commit but before publication is covered by reconciliation. This version requires no durable SSE replay log/outbox; a future transactional outbox can strengthen delivery, but cannot replace freshness checks or recovery reads. EventSource reconnection and `Last-Event-ID` alone do not replay events unless the server implements retained history. If replay is later added, the stream event cursor is distinct from each target's version.

## Feature flows

### Login and logout

1. A user enters the admin assigned username and password.
2. The backend applies the configured Origin policy (an exact allowlist or unrestricted wildcard mode), checks the login limit and password hash, and creates a session.
3. The frontend fetches the current identity and opens the student, teacher, or admin screens, establishes its scoped SSE connection, and reconciles visible task targets.
4. Protected requests carry the session cookie and undergo backend role and resource checks.
5. Logout revokes that session, clears the cookie, closes the SSE connection, and clears frontend task state. A known expired session or a protected `AUTH_REQUIRED` after a confirmed identity shows an informational session-ended notice; an unknown initial signed-out session and deliberate logout do not. Saved quiz answers and task history remain in SQLite. Session loss does not cancel accepted AI work; task completion still checks resource ownership and feature eligibility.
6. The login screen uses the QuizIt name and approved account-help copy. While it is displayed, the browser title is `Sign in · QuizIt`; leaving login restores the prior non-login title. The greeting is the page's primary heading.
7. Login trims and validates the username (3–50 ASCII letters, digits, `_`, `.`, `-`) and accepts passwords of 1–128 characters without trimming. Inline validation prevents requests and focuses the first invalid field. Only `401 INVALID_CREDENTIALS` uses the shared credential rejection message. A timeout, unknown POST outcome, or failed post-login identity read requires an explicit session check before credentials can be submitted again; session checks never replay a password. On `429 LOGIN_RATE_LIMIT`, a valid positive integer `retry_after_seconds` blocks submission until elapsed time expires, without automatic retry; absent or invalid timing leaves explicit retry available.

### Create accounts and assign classes

1. Startup seeding supplies the demo admin account; the admin logs in.
2. The admin creates student and teacher accounts with initial passwords.
3. The admin creates a class.
4. The admin assigns existing student and teacher accounts to that class. Repeated assignment does not duplicate membership.
5. Those users see the class after refreshing their class list. Unassignment changes future access according to the frozen roster rules.

### Generate review and publish a quiz

1. The teacher selects one of their assigned classes and uploads a DOCX.
2. The backend verifies membership, validates the upload, extracts text, and stores the note privately. Invalid or oversized input is rejected before AI is called.
3. The teacher enters a title and question count and creates a draft using the returned note ID.
4. The teacher selects Generate. The frontend sends the draft revision, optional instructions, and a fresh idempotency key; the initial action defaults to ensure.
5. The backend checks the shared rolling rate, persists a `running` task in the same transaction, starts a managed async coroutine, and returns `202` immediately. If 1024 fresh operations were already admitted in the preceding 60 seconds, it returns `429 AI_APP_RATE_LIMIT` with retry timing without creating a task. The frontend shows the prior draft with generation/publication controls disabled while an admitted task is unfinished. The coroutine makes one stateless async SoCLaaS call with `SOCLAAS_QUIZ_MODEL` independently of the browser.
6. The same coroutine validates the whole response and atomically replaces questions, increments the quiz revision, and commits task success/version. Completion does not refund its rolling allowance. The frontend follows notification-only SSE with latest-state reads and periodic reconciliation. On failure the existing draft remains available.
7. The teacher reviews each question, its four options, correct answer, and explanation.
8. If changes are needed, the teacher enters a reprompt, such as "Focus more on the first two sections and make the wording simpler." Steps 4 through 7 repeat using `action: "new"` and a fresh operation key, with notes and current draft snapshotted for the task.
9. When satisfied, the teacher selects Publish. The frontend submits the reviewed `expected_revision`; AI does not perform this action.
10. The backend revalidates the draft and class membership and confirms no generation is pending. In one transaction it freezes content, snapshots currently assigned students into attempt rows, and records publication.
11. Students in that roster see the quiz. No further regeneration or editing is allowed for that published quiz.

The draft review screen also offers Delete draft with explicit confirmation: deletion permanently removes the draft/questions and its uploaded notes only if no other quiz uses them. Hide this action for published quizzes; disable it during generation, publication, deletion, or unresolved state reads. On `204`, discard cached quiz/task state, ignore late responses/events, return to the quiz list, and refresh it. Show errors and reconcile after conflicts; the backend enforces eligibility atomically.

### Take a quiz and request hints

1. A student opens their assigned published quiz. The response contains questions and options only.
2. Starting the quiz changes their precreated attempt to `in_progress`; reopening resumes saved answers and hints.
3. Selecting an option saves it to the backend. The UI distinguishes saving, saved, and save failed states and permits changing a choice before submission.
4. For a question, the student opens the compact hint disclosure (`Need a hint?`), may enter a short prompt (at most 500 characters), and selects Ask for a hint. Unused hints stay collapsed until opened, while the disclosure label reflects current running (`Preparing your hint…`), current success (`Your hint`), or failure/attention state even when collapsed. Preserved prompt text, current hint or error, and active work survive collapse/reopen and question jumps without generating a hint. The backend verifies ownership and question association; fresh admission additionally checks attempt state and hint allowance.
5. An ensure request returns the latest hint task if one exists without consuming the rolling allowance; otherwise admission checks the shared rate, persists a `running` task atomically, and starts a managed async coroutine. Exceeding the 1024-per-minute rolling limit returns `429 AI_APP_RATE_LIMIT` immediately with retry timing and no task created. The coroutine generates a bounded candidate using `SOCLAAS_HINT_MODEL`, without answer key or option text, then makes a separate private verification call with the candidate and answer context using the same model. One API task remains `in_progress` during both calls; no candidate is returned before approval. A disconnect does not cancel it. Another hint or Try again after a confirmed failure uses `action: "new"` with a fresh key and an editable prompt, obeying both the successful-hint allowance and shared rolling rate. An uncertain POST keeps the prompt locked and offers Repeat previous request with the exact original input and idempotency key.
6. Only a verifier-approved relevant hint that does not reveal the answer and task success/version commit together. SSE only signals a version change; the frontend reads the latest hint endpoint and periodically reconciles while unfinished. Reopening restores latest task state. Irrelevant, answer-revealing, or unverifiable output is withheld and a latest failure displayed in the existing thin red notice using safe supported diagnostic mappings (exact answer-leakage wording for `AI_INVALID_OUTPUT` with `details.stage = "hint_verification"` and `reason = "hint_reveals_answer"`, concise relevance wording for `hint_irrelevant`, general unusable-hint copy for unknown/malformed output diagnostics, and service/timeout/interruption/configuration fallbacks without exposing raw error codes, raw backend messages, rejected candidates, or verifier rationales) without losing selections or substituting an older hint.
7. The attempt remains a scrolling page with framed questions, light numbered headers and independent Mark for review toggles. Keep the original separate bordered A–D native radios, full clickable labels, bold letters, gaps and selected green border/tint; retain the question stem in the accessible legend. A compact vertical list of question rows in a sticky bordered panel on desktop and a compact sticky horizontal strip on narrow screens distinguish current question, unanswered/saving/saved/failed selection state and review flags. Number activation scrolls and focuses an unobscured question header, respects reduced motion and preserves selections, prompt text and hint state. Manual scrolling updates the current number, including the final question at the document bottom when its heading cannot reach the top tracking offset. Number jumps are immediate, with no intermediate active-question flicker. Preserve the original desktop row design with number badge, question title, save-state text and review flags, using tighter panel padding, row padding and gaps. Next unanswered wraps through questions with no selection; selected saving/failed answers count as answered. Review marked wraps through marked questions. Both actions have an understandable unavailable state when no matching question exists. Navigation does not save answers or generate hints.
   Review marks are local to the mounted attempt page. They survive jumps, save retry and hint updates, and clear on leaving/remount/reload, attempt/user change, sign-out or session loss. They never persist in browser storage or the backend and never block submission.
   The original bottom submit panel and desktop navigator share readiness: every required answer must be selected and confirmed saved. Missing choices, saving and failed saves block opening/final confirmation with current-state explanations; successful save retry updates readiness. Hint activity/failure does not block submission. Mobile uses bottom readiness without a floating submit bar. Opening confirmation sends no request. The shared modal states that all answers are saved and submission is final, optionally lists marked questions, offers Keep reviewing and Confirm submission, and restores focus to the invoking control on cancel/Escape. Final activation rechecks readiness and posts once despite repeated activation or either entry point. The backend independently verifies all required answers exist.
   A failed or unknown submission outcome locks editing, fresh hints and further submission until an authoritative attempt read confirms submitted or in-progress. Failed reconciliation retains Check submission; closing a modal or a failed POST never unlocks the attempt.
8. The backend grades against the immutable answer key, persists score and submission time in one transaction, and locks the attempt.
9. The student sees their score and can read correct answers and explanations. The quiz completion count now includes that submission.

### Request a class performance summary

1. An admin opens a class and chooses a published quiz.
2. The backend returns completion counts against the publication roster. The UI enables Generate summary only when every assigned student has submitted.
3. The admin requests the summary. The backend enforces eligibility again; a disabled UI is not the authorization boundary.
4. An ensure request returns the latest task without another provider call. Explicit Regenerate or Retry uses `action: "new"` and a fresh key; an unfinished target always returns its existing task.
5. For fresh admission, snapshot exact aggregate metrics and question context, check the shared rolling rate, persist a `running` task atomically, and start a managed async coroutine before returning `202`. Exceeding the 1024-per-minute rolling limit returns `429 AI_APP_RATE_LIMIT` immediately with retry timing and no task created. The coroutine makes one bounded async SoCLaaS request using `SOCLAAS_SUMMARY_MODEL` with anonymous aggregates.
6. Validate the output and atomically store/replace the summary and metric snapshot with task success/version. A failed call applies no partial summary.
7. SSE carries only change metadata. Read the latest target endpoint for exact metrics, AI observations, or failure; reconcile periodically while unfinished. Later visits show the latest task, including a pending or failed regeneration, rather than silently falling back to an older success.

## Frontend screens

| Screen | Minimum content and actions |
| --- | --- |
| Login | Username and password, sign in, generic authentication error. |
| Student quiz list | Assigned quiz title, class, state, and Start, Resume, or View results. |
| Student attempt | Scrolling framed questions with four radio options and save states, review marks, responsive question navigator, per question hint control, shared saved-answer readiness and confirmed Submit. |
| Student results | Score and per question answer and explanation. |
| Teacher classes and quizzes | Assigned classes, own drafts and published quizzes, and Create quiz. |
| Teacher upload and draft | DOCX upload, title and count, generation prompt, all generated questions with keys and explanations, reprompt, Publish, and confirmed deletion of idle drafts. |
| Admin accounts | Student and teacher list and account creation form. |
| Admin classes | Class creation and member assignment or unassignment. |
| Admin quiz performance | Completion counts, eligibility state, exact metrics, and Generate, View, Retry, or Regenerate summary with latest task state. |

Use shared not-requested, loading, success, and failure task states. Disable new-generation buttons while their target is unfinished; repeated HTTP requests are safe and return current state. Display admission and task failures near the relevant action with retry timing when known. On `429 AI_APP_RATE_LIMIT`, show "AI request limit reached. Please try again in N seconds." using `retry_after_seconds` and keep the prior target state and work visible; do not leave an unaccepted request loading or automatically resubmit it. Retry timing describes when allowance may next be available, not a reserved future admission. Restore latest state by reading the backend after refresh/reconnect. Apply the per-target version guard to every API response and SSE-triggered reconciliation; never render content or failure details from SSE. Successful AI calls must not be required to log in, read a quiz, save an answer, submit, or read existing results.


## Docker backend URL configuration

The compiled frontend uses same-origin `/api/v1` paths for both HTTP requests and
SSE. The Docker Nginx proxy reads `BACKEND_SERVER_URL` from the container environment
at startup, defaulting to `http://backend:7000`. Operators can supply the value with
Docker `--env-file` or Compose `--env-file frontend/.env`. The value is a backend
HTTP(S) origin reachable from the container, without trailing slash or API path.
Changing it requires container recreation, with no frontend image rebuild.
The proxy preserves API paths, browser Origin, and SSE behavior, and uses the
upstream Host, HTTPS SNI, and certificate verification for hosted backends.
At startup, use the container's nameservers from `/etc/resolv.conf` for dynamic
upstream resolution, supporting both Docker Compose and hosted Docker services.

Acceptance checks:

- Without an override, the generated Nginx configuration targets `http://backend:7000`.
- An environment-file override changes the proxy target in the same image after recreation.
- Nginx variables remain intact during template substitution; `nginx -t` succeeds.
- HTTPS proxy configuration enables SNI and verifies certificates using the CA bundle.
- The generated resolver uses the container's nameservers rather than a hardcoded Docker DNS address.
