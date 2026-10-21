# ui-02-fix-sign-in-feedback-and-recovery — Fix sign-in errors, waiting and session recovery

Status: READY — requirements approved on 2026-10-21; consolidation and simpler wording requested on 2026-10-22.
Depends on: none. Steps within this task are delivered together.
Baseline: `bd30398` on `plan/student-ui`; inspect the current scoped files before editing.

## What this task does

Make the existing sign-in form clearly explain invalid input, a rejected sign-in, a server wait and an uncertain session. Keep recovery safe: if a request may already have succeeded, check the session before asking the user to submit credentials again.

## Work to do

### Validate input and explain ordinary failures

- Validate the username after trimming: 3–50 ASCII letters, digits, underscores, dots or hyphens. Login passwords are 1–128 characters; preserve their bytes, including spaces. Do not apply the account-creation minimum at login.
- Show small associated inline errors and focus the first invalid field. Invalid input makes no login request.
- During submission, announce `Signing in…`, keep the existing disabled controls and prevent duplicate click/Enter submissions. Preserve masking, Show/Hide, autocomplete and username input; clear the submitted password on failure.
- Only `401 INVALID_CREDENTIALS` means rejected credentials. Use the same message for unknown user and wrong password; after rendering it and restoring controls, focus Password. Other failure categories must not automatically focus Password.

| Condition | Exact message |
| --- | --- |
| Empty trimmed username | Enter your username. |
| Username too short | Enter at least 3 characters for your username. |
| Invalid username characters | Use only letters, numbers, underscores, dots, or hyphens in your username. |
| Username too long | Enter no more than 50 characters for your username. |
| Empty password | Enter your password. |
| Password too long | Enter no more than 128 characters for your password. |
| Identified invalid credentials | Unable to sign in. Check your username and password. |
| Ordinary connection failure, when session recovery below does not apply | Unable to reach QuizIt. Check your connection and try again. |
| Identified HTTP 5xx service failure, when recovery does not apply | QuizIt is unavailable right now. Please try again shortly. |
| Other definitive rejection | Unable to sign in. Please try again. |

### Recover an uncertain sign-in

The current `signIn` does POST login followed by GET `/auth/me`; those are distinct stages. A lost POST response can follow a created session. A failed identity confirmation must never be called a wrong password.

| Situation | Message and action |
| --- | --- |
| Initial or explicit session check pending | `Checking your session…`; prevent duplicate checks; explicit action reads `Please wait.` while pending. |
| Evidenced login POST timeout | `The sign-in request timed out. Check your session before trying to sign in again.` / Check session |
| Unknown POST outcome, or failed post-login identity confirmation | `We couldn’t confirm your sign-in. Check your session before entering your details again.` / Check session |
| Failed initial or explicit session check | `Unable to check your session. Check your connection and try again.` / Check session remains available. |
| Explicit check confirms signed out | Restore credential entry and Sign in immediately; show `You’re signed out. Sign in to continue.` unless a known session-end reason below applies. |
| Check confirms identity | Open the actual role from `/auth/me`, without a success popup. |

While uncertain, both the main action and Enter perform only the session GET, even with the cleared password empty. Keep one current message. Never replay passwords automatically. The current `NETWORK_ERROR` groups timeout and transport; use timeout wording only if actual timeout evidence is retained. Do not diagnose offline/CORS/server failure from that code. Stronger wording `Unable to confirm your session while the connection is unavailable. Check your connection, then try checking your session again.` is allowed only with independent evidence; the existing classifier does not establish it.

### Respect the server's sign-in wait

On `429 LOGIN_RATE_LIMIT`, show `Too many sign-in attempts. Please wait before trying again.` Use only a valid positive integer JSON `error.retry_after_seconds` for a known wait; no header fallback is required.

- During a known wait, show `Try again in Ns.` and block button/Enter/form submission. Inputs remain editable; changing username does not clear the mounted form's wait.
- At expiry return to Sign in; never submit automatically. Use elapsed time so background tabs do not prolong the wait.
- Missing/malformed/nonfinite/zero/negative timing: show the static message and permit an explicit attempt, without inventing seconds. Preserve an existing unexpired known deadline.
- A later response replaces rather than adds to the deadline. Countdown ticks stay quiet, preserve fresh typing and do not move focus. Backend limits remain authoritative.

### Explain a known session end and ignore old responses

Show informational `Your session has ended. Sign in again to continue.` for current `SESSION_EXPIRED`, or current `AUTH_REQUIRED` after a previously confirmed identity. A fresh unknown `AUTH_REQUIRED` stays ordinary login. Deliberate sign-out takes precedence and stays quiet; preserve existing logout-failure handling without claiming server revocation.

Keep the notice only in memory, including a failed credential retry; clear on successful sign-in or deliberate sign-out. During uncertain sign-in, its Check session message takes precedence. After an explicit signed-out check, use the known-loss notice if established, otherwise generic signed-out text.

Preserve existing refresh guards and add missing lifecycle checks around sign-in identity commits, protected 401 events (including late body parsing), logout completion and disposed stream callbacks. Old work must not sign out or restore another session. Preserve role-store/SSE cleanup, same-user saved-answer recovery and immutable submitted results. A network/SSE disconnect alone does not prove session loss.

## Files and specification

Inspect [LoginPage.tsx](../../frontend/src/auth/LoginPage.tsx), [AuthProvider.tsx](../../frontend/src/auth/AuthProvider.tsx), [App.tsx](../../frontend/src/App.tsx), [client.ts](../../frontend/src/api/client.ts) and `useAIEvents.ts`; use only needed local styling. Update [frontend-spec.md](../../specs/frontend-spec.md), clarify the existing timing contract in [backend-spec.md](../../specs/backend-spec.md), and update UserGuide sign-in help where needed. Preserve backend auth/cookie/Origin/session/limit policy and unrelated API consumers. See [sign-in security checks](../security/ui-02-sign-in-security.md).

## Done when

| ID | Expected result | Planned verification |
| --- | --- | --- |
| AC-01 | Normalized validation/messages/focus work, and valid short login passwords remain accepted. | Username 0/2/3/50/51, whitespace/non-ASCII/invalid characters; password 0/1/128/129 and preserved spaces; click/Enter. |
| AC-02 | Wrong-user/wrong-password feedback matches, controls recover, and only deliberate valid actions submit. | Mocked rejection, pending double activation, password clearing/visibility and focus. |
| AC-03 | POST uncertainty and failed identity confirmation enter Check session; success follows `/auth/me`. | Lost/unusable POST response, real client timeout distinction, GET 401/5xx/transport; all three roles; empty password during recovery. |
| AC-04 | Failed checks remain actionable; signed-out checks restore credentials without an endless loop. | Repeated failures, current-message replacement, known-loss precedence and no automatic POST/polling. |
| AC-05 | Real server timing blocks every submission path until expiry and handles bad/new timing safely. | API-wrapper fixtures, controlled clock, background gap, fresh typing, shorter/longer replacement, malformed/header-only response and cleanup. |
| AC-06 | Known loss gets the notice; fresh signed-out visits and deliberate sign-out do not. | Initial/active AUTH_REQUIRED vs SESSION_EXPIRED, duplicate/racing loss events, failed credential retry and logout failure. |
| AC-07 | Stale success/error/logout/stream work cannot affect a later identity or leak its predecessor's data. | Deferred fetch and body parsing through the real dispatcher, overlapping identity reads, sign-out, account change and existing student/teacher session regressions. |
| AC-08 | The compact login remains usable and countdowns do not overannounce. | Desktop/phone, 640/641px, long messages, 200% zoom, keyboard/focus and screen-reader checks; preserve save/submission/results recovery. |

## Implementation handoff

Use this brief and the linked files inside MP3 as the complete input. Follow the local [implement workflow](../../.agents/skills/implement/SKILL.md) and [coding stage](../../.agents/skills/implement-task/SKILL.md). Keep source, the affected specification and focused acceptance tests together. Preserve other completed changes. Do not edit the Developer Guide. Start implementation only when requested.

The verification described above is planned, not completed. Use mocked APIs for automated checks; no private database or live AI is needed. From `frontend/`, run the relevant focused tests and documented lint, formatting and build checks during implementation. Record actual results and any manual checks that could not be performed.
