# Security Boundary Review

## Status
- Target: `HEAD 0a86132f87a4e4caa32825611671e2c46cacf85d` plus the combined index and worktree diff; relevant untracked UI-02 tests/evidence included by inspection. UI-01 remains pre-existing context.
- Scope: UI-02 sign-in and identity recovery, credential handling, session-loss dispatch, stale asynchronous work and SSE cleanup.
- Overall: PASS
- Independent human review: READY, with the execution and scan limitations recorded below.

## Checks
| Area | Status | Command/evidence |
| --- | --- | --- |
| Explicit uncertain-sign-in recovery | Complete; prior finding fixed | `AuthProvider.tsx:81-101`: current `/auth/me` 401 clears `uncertainSignIn`; stale results return without state mutation; non-401 retains uncertainty. `LoginPage.test.tsx:340-390` checks restored editable credentials, no automatic login replay, subsequent deliberate login, and non-401 retention. |
| Credential and identity boundary | Source reviewed | `LoginPage.tsx` passes trimmed username but unmodified password to `signIn`, clears password after failure, and does not persist credentials. `AuthProvider.tsx:126-151` determines role only from `/auth/me`. Same generic copy applies to invalid credentials. |
| Session/stale response handling | Source plus mocked cases | `api/client.ts:60-111` generation-checks protected 401 after body parsing; sign-in and logout advance generation. `AuthProvider.tsx` guards current identity with epochs and deliberate logout. `authApi.test.ts` covers a late parsed 401; `LoginPage.test.tsx` covers late identity suppression. This is representative, not an exhaustive interleaving proof. |
| SSE lifecycle | Source reviewed | `useAIEvents.ts:8-48` guards notifications/recovery with an effect-local active flag, aborts the session check on cleanup, closes the stream, and disposes/removes listeners. AI SSE remains metadata-only; authoritative state is fetched separately. |
| Backend auth, cookies, Origin and authorization | Unchanged | Frontend requests retain `credentials: "include"`; no backend auth/session/Origin policy or permission enforcement was changed. Browser route state is not backend authority. |
| Semgrep | Completed with partial parsing | `sh workflow/security/semgrep.sh` from repository root; Semgrep 1.170.0 OSS, 225 community rules (151 Python, 74 TypeScript). 48 tracked files considered, 42 targets scanned, 0 findings, exit 0. One `PartialParsing` warning remains at `backend/src/quiz_backend/ai.py:301`; approx. 99.9% parsed-line coverage. The scanner is advisory and excludes untracked files/tests by its tracked-file scope. |
| Automated/manual verification | Supplied pass-two evidence; not rerun | Correction-2 handoff reports focused 5-file/48-test suite, full 14-file/148-test suite, format, build and diff checks passed; lint exited 0 with listed warnings. Desktop-only browser/accessibility inspection and parent-reported signed-out recovery check are described there. Phone/breakpoint/zoom/screen-reader and live/deployed auth remain unverified. |

## Next actions
- Implementation follow-up required: NO
- Edit documentation: NO
- Rerun code-review skill: NO
- Reason: `SB-ui02-1` is fixed and covered by a focused regression test; no additional security defect was found. Semgrep completed with one documented parser limitation.

## Agent handoff
- Follow-up required: NO
- Current implementation/review state: Prior finding fixed; no new security-boundary findings.
- Next responsible skill or human: Parent review aggregator.
- Priority and finding addressed: `SB-ui02-1`, Medium, Fixed.
- Exact files and line locations: `frontend/src/auth/AuthProvider.tsx:92-99`; recovery rendering in `frontend/src/auth/LoginPage.tsx`; regression at `frontend/tests/LoginPage.test.tsx:340-390`.
- Required change or investigation: None for this axis.
- Constraints and out-of-scope work: Review only; only this assigned artifact was written. No code, tests, docs, Git state, or unrelated UI-01 work was changed.
- Verification commands: `sh workflow/security/semgrep.sh` ran successfully as recorded above. Automated tests/build/lint/manual checks were not rerun by this reviewer; use the implementation handoff as reported evidence.
- Manual checks: Phone layout, 640/641px breakpoint, reliable 200% zoom, screen-reader announcements, and live/backend/deployed recovery remain unverified. No extra security-specific manual check was identified.
- Success criteria: A current explicit session-check 401 exits recovery without replaying credentials; non-401 failure retains recovery; identity/role is taken from `/auth/me`. Source and supplied regression evidence satisfy these criteria.
- Documentation impact: None identified; task, security matrix and User Guide describe explicit recovery.
- Required next rerun: None unless implementation changes.
- Blocker or decision needed: None.

## Findings
- `SB-ui02-1` — [Medium] Explicit signed-out session check leaves login locked in recovery — Status: Fixed
- Category: Session recovery / authentication availability
- Location: `frontend/src/auth/AuthProvider.tsx:92-99`; `frontend/src/auth/LoginPage.tsx` recovery state/rendering.
- Requirement: UI-02 requires a confirmed signed-out check to restore credential entry immediately without replay; other check failures must retain recovery.
- Evidence: Current `ApiError` 401 clears `uncertainSignIn` and returns `signed-out`. The focused test causes an uncertain login, confirms signed-out, verifies editable fields and one login call, then confirms a later deliberate submit succeeds. A paired test verifies a 503 keeps recovery available. The correction handoff reports focused/full suites passed.
- Expected / actual: The signed-out result should unlock explicit credential entry with no automatic POST. The current code and test show that transition.
- Reproduction or inspection path: Inspect `checkSession()`'s 401 branch and test “restores credentials after a confirmed signed-out check without replaying login.”
- Impact: The previous login-availability defect is resolved; no remaining bypass or exposure was identified.
- Likely cause / confidence: The previous 401 branch omitted the state reset. Fix directly confirmed in source and test, high confidence for this transition.
- Fix direction and affected responsibility: No further fix required; AuthProvider owns the state change and LoginPage renders it.
- Tests to add/update: None required for this finding.
- Documentation impact: None.
- Verification after fixing: Focused assertion inspected; pass-two handoff reports targeted/full tests, format, lint and build. Not independently rerun here.

## Positive observations
- Credentials stay in transient UI/request state; login uses included cookies and does not rely on routing hints or browser storage for role.
- Unknown-user and wrong-password feedback remains generic.
- Timeout wording is used only for observed `TimeoutError`; rate-limit countdown uses JSON retry timing and expiry does not auto-submit.
- A protected 401 is dispatched only after body parsing if the request generation is still current; stream cleanup disables late callbacks.
- No backend authorization, session, cookie or Origin protection was moved into frontend authority.

## Gaps and limitations
- Semgrep had one Python partial-parsing warning; no claim is made for the unparsed syntax. The configured scan only includes tracked files and excludes tests and untracked artifacts.
- Tests, build, lint and browser checks are supplied implementer/parent evidence, not independently reproduced in this review.
- The handoff records remaining race partitions, mobile/breakpoint/zoom/screen-reader checks and lack of live backend/deployed/cross-origin verification. These do not establish a security defect in the reviewed source.

## Manual checks for user
- Implementer evidence covers desktop rendering, accessibility tree and keyboard order. Phone layout, exact 640/641px breakpoint, reliable 200% zoom, screen-reader announcements and live authenticated recovery remain unverified.

## Conclusion
The prior `SB-ui02-1` defect is fixed: a current explicit `/auth/me` 401 releases uncertain-sign-in mode and restores the form without replaying credentials; a non-401 check failure retains recovery. No new security-boundary defect was found. PASS applies to this axis with the scan and verification limitations above.

## logging_summary
- Outcome: completed the requested security re-review at `HEAD 0a86132` plus combined index/worktree diff, preserving UI-01 context.
- Finding status: `SB-ui02-1` is Fixed based on `AuthProvider.tsx:92-99` and the focused recovery regression test. No new findings.
- Scan: `sh workflow/security/semgrep.sh`, Semgrep 1.170.0, 225 rules; 42 tracked targets scanned, 0 findings, exit 0, with a partial-parsing warning at `backend/src/quiz_backend/ai.py:301`.
- Verification evidence: Pass-two handoff reports 5 focused files/48 tests and 14 full-suite files/148 tests passed, plus format/build/diff checks; lint exited 0 with warnings. These were not rerun by this reviewer. Manual and live-service limitations are listed above.
- Scope discipline: only the assigned security artifact was written; no code, tests, docs outside this artifact, Git state or unrelated UI-01 content was changed.
