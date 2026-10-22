# Specification and Contract Review — UI-02

## Status

- Target: `HEAD 0a86132` plus combined index and worktree diff, including untracked UI-02 evidence.
- Scope: UI-02 sign-in behavior, frontend/backend contract updates, affected User Guide claims, and pass-two evidence. UI-01 is context only.
- Overall: PASS
- Prior finding `SC-ui-02-01`: Fixed
- New findings: None
- Implementation follow-up: NO
- Edit documentation: NO
- Rerun code review: NO
- Independent human review: READY, with acceptance/manual verification limitations listed below.

## Requirement and contract mapping

| Requirement | Assessment |
| --- | --- |
| AC-01/02: normalized validation, exact feedback, focus, password handling and duplicate prevention | Verified by source inspection: `LoginPage.tsx` trims the username, enforces the ASCII character set and lengths, preserves password whitespace, associates inline errors with inputs, focuses the first invalid field, and focuses Password only for identified `401 INVALID_CREDENTIALS`. The correction-2 handoff reports representative boundary and interaction coverage; it explicitly lists untested partitions, so full acceptance coverage is not claimed. |
| AC-03/04: distinguish credential rejection from uncertain sign-in; require explicit session recovery | Verified by source inspection: `AuthProvider` distinguishes login POST from `/auth/me`; `LoginFlowError.stage` lets the page distinguish failed identity confirmation from credential rejection. A timed-out or unknown POST result and identity-read failure show recovery guidance; the recovery action reads session state and does not replay credentials. Failed checks retain an actionable path, and current signed-out checks restore credential entry. Pass-two handoff reports tests for representative identity failures, failed/repeated checks, and no automatic login replay. |
| AC-05: login rate-limit timing | Verified by source and contract inspection: the frontend reads `retry_after_seconds` from the JSON error, accepts positive integer timing, uses an elapsed-time deadline, blocks explicit submission while active, and does not submit at expiry. The backend spec documents optional positive-integer JSON timing and prohibits inferring a wait from headers. Malformed timing, deadline replacement, background-tab behavior, and other timing partitions are only partially tested per handoff. |
| AC-06/07: known session loss and stale work | Verified by source/spec alignment: the client dispatches protected 401 loss only after body parsing and only for the current session generation; the provider differentiates `SESSION_EXPIRED` and active-identity `AUTH_REQUIRED`, guards stale identity work, and keeps deliberate logout quiet. The frontend spec records the same known-loss distinction. Correction-2 reports representative race and role regressions, while documenting remaining race partitions as unverified. |
| AC-08: compact login and accessibility | Partially verified. The handoff records desktop rendering, error association in the accessibility tree, and keyboard order. Phone layout, the 640/641px boundary, dependable 200% zoom, and screen-reader announcements remain unverified. |
| Backend/API and schema contract impact | No backend implementation or schema change is in scope. `backend-spec.md` now specifies `401 INVALID_CREDENTIALS` as the same generic rejection for unknown users and wrong passwords and describes optional `429 LOGIN_RATE_LIMIT` JSON retry timing. This matches the task and frontend parsing; no route or schema contradiction was found. |
| User Guide recovery advice | The updated guide separates rejected credentials from uncertain outcomes and tells users to use **Check session** before re-entering credentials. It explains confirmed signed-out and failed-check outcomes and retry-time advice. No obsolete **Reconnect** instruction remains. |

## Findings

- `SC-ui-02-01` — **Low** — User Guide retained obsolete sign-in recovery instructions — Status: Fixed
  - Category: Documentation consistency
  - Location: `docs/UserGuide.md`, sign-in instructions in sections 1 and 3.
  - Requirement: An uncertain sign-in must be checked before credentials are submitted again, and user guidance must name the actual recovery action.
  - Evidence: The guide directs users to **Check session** after a timeout or unconfirmed result and says to follow the displayed message before entering credentials again. It explains signed-out restoration and that failed checks leave the action available. The obsolete **Reconnect** instruction is removed.
  - Expected / actual: Expected recovery instructions consistent with the current sign-in flow; actual guide now matches it.
  - Reproduction or inspection path: Compare the updated guide paragraphs with the UI-02 task's uncertain-sign-in requirements and `LoginPage.tsx` recovery control.
  - Impact: Users are no longer directed to a removed control or encouraged to repeat credentials while the prior request outcome is uncertain.
  - Likely cause / confidence: Earlier guide wording was not updated with the recovery flow; correction verified in the final target. High confidence.
  - Fix direction and affected responsibility: No further action; documentation change is present and aligned.
  - Tests to add/update: None for this documentation correction.
  - Documentation impact: Finding resolved in `docs/UserGuide.md`.
  - Verification after fixing: Source inspection of the changed guide text and final LoginPage recovery labels.

No new specification, API contract, acceptance-criteria, or documentation finding was identified.

## Gaps and limitations

- Review relied on source inspection and the supplied correction-2 evidence; no additional test command was run by this reviewer.
- The handoff reports focused five-file tests (48 tests), full frontend tests (148 tests), format check, lint (exit 0 with warnings), build, and `git diff --check` as passing. These are reported evidence, not independently rerun checks.
- The handoff lists incomplete acceptance partitions for validation ordering, error/focus combinations, timing malformed/replacement/background-tab behavior, broader session races and account switching.
- Phone layout, exact breakpoint behavior, reliable 200% zoom and actual screen-reader behavior remain unverified. The handoff states these were unavailable in its browser setup.
- No live backend authentication, cookie/origin path, deployed behavior, or persistence test is evidenced in this pass.
- No Developer Guide change was required by this UI-02 scope.

## Conclusion

The final combined target aligns the reviewed UI-02 requirements, frontend/backend contracts and User Guide guidance. `SC-ui-02-01` remains fixed in the final target. No new spec-contract finding requires follow-up. The pass-two evidence adds representative coverage for the previously deficient signed-out recovery flow while correctly retaining the verification review's open evidence limitations; those limitations are not a demonstrated contract defect.

## logging_summary

- **Outcome:** Re-reviewed final `HEAD 0a86132` plus staged, unstaged and relevant untracked UI-02 changes against the approved task, frontend/backend specs, User Guide and pass-two handoff. Verdict: PASS. Prior finding `SC-ui-02-01` is Fixed. No new findings.
- **Evidence checked:** UI-02 task and AC table; final relevant source/spec/guide diff; `workflow/implementations/ui-02-fix-sign-in-feedback-and-recovery-2026-10-22-correction-2.md`; current review evidence. The correction handoff reports passing focused/full tests, format check, build, lint with warnings, and diff check; not rerun by this reviewer.
- **Remaining limits:** Several AC partitions and manual responsive/accessibility checks remain unverified per handoff; no live backend or deployed behavior was established. No documentation or implementation follow-up is indicated by this axis.
