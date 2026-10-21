# Sign-in security checks

Scope: [sign-in errors and session recovery](../tasks/ui-02-fix-sign-in-feedback-and-recovery.md). Requirements are approved; all implementation checks remain planned. Use the local [threat-modeling method](../../.agents/skills/owasp-threat-modeling/SKILL.md).

Protect passwords, account-existence privacy, current identity and role-owned state. The backend remains authoritative for credentials, cookies, rate limits and `/auth/me`. Preserve existing Origin policy. The [security matrix](security-matrix.md) APP-05 covers Origin concerns; AUTH-01–AUTH-05 cover resource permissions, not complete session handling. Do not claim a passing security result from source inspection.

| Risk | Required control and planned check |
| --- | --- |
| Credential exposure or account enumeration | Preserve password bytes/masking/failure clearing; no storage/logging/automatic POST; unknown-user and wrong-password messages identical. Exercise valid, malformed and denied input. |
| Lost login response creates misleading retry or role | Distinguish POST from identity GET; explicit Check session before fresh credentials when uncertain; route only by current `/auth/me`. Test lost responses, empty cleared password, repeated checks and all roles. |
| Old responses restore/sign out another user | Preserve current lifecycle across identity, global 401 (including body parsing), logout and stream disposal. Defer A's success/error until B is active and verify no change/leak. |
| Unknown initial sign-out or network error mislabeled expiry | Use known expiry or previously confirmed-session loss only; deliberate logout wins; no diagnosis from bare SSE/network failure. Test the cause table and single-message precedence. |
| Bad timing locks users out or bypasses rate limits | Validate existing positive integer JSON timing; absent/header-only timing is unknown; guard every submit path during known wait; expiry merely permits an explicit attempt. Test replacement, elapsed time, bad data and renewed server rejection. |
| Waiting or recovery destroys accessibility/work | Quiet countdown, usable focus and fresh typing, one pending operation, explicit retry. Preserve role-store/SSE cleanup, saved answers and immutable result recovery. |

Frontend implementer owns these mocked API/form/session cases and source inspection. Review must distinguish planned cases from observed results. No backend policy, schema, permission, model or shared matrix change is authorized by this note.
