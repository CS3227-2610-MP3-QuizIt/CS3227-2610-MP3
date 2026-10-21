# ui-05-improve-quiz-hints — Make hints collapsible and fix AI error messages

Status: READY — requirements approved on 2026-10-21; consolidation and simpler wording requested on 2026-10-22.
Depends on: none. Steps within this task are delivered together.
Baseline: `bd30398` on `plan/student-ui`; inspect the current scoped files before editing.

## What this task does

Keep unused hint controls out of the way, and replace raw technical AI errors with useful messages. Keep the existing small red error notice and let students edit their prompt and deliberately try again.

## Work to do

- Turn each unused hint area into a compact keyboard-operable disclosure. Announce expanded/collapsed state. When collapsed, current running/success/failure must still be discoverable.
- Preserve typed prompt, latest hint/error and active work through collapse/reopen and question jumps. Keep state owners/subscriptions alive. Opening or moving may reconcile reads, never generate a hint.
- Use the existing thin red `Notice` for failures. No large replacement box, extra heading, raw error code, arbitrary backend diagnostic, rejected candidate or private verifier rationale.
- For `AI_INVALID_OUTPUT` with `details.stage = hint_verification` and `reason = hint_reveals_answer`, use exactly: `This hint could reveal the answer, so we couldn’t show it. Try again, or change your prompt first.`
- Map the supported `hint_irrelevant` reason to concise relevance wording. Unknown/malformed/mismatched diagnostics use a general unusable-hint message; service/timeout/interruption/configuration failures get concise supported fallbacks. Do not infer reasons by searching message strings. Preserve known rate-limit retry timing without inventing quotas or waits.
- A confirmed failed task offers ONE Try again action and a directly editable prompt, bounded to 500 characters. Explicit activation uses edited input with a fresh operation key (`action: new`); editing itself sends nothing. Prevent extra activation while running.
- An uncertain POST keeps Repeat previous request with its exact original input/key, existing locks and authoritative reconciliation. It must not become a fresh retry or silently use edited input.
- Preserve latest-task/version guards: a latest failure never displays an older success as current. Render approved text safely. Hints remain independent of answer saving and submission.

## Layout in words

Place the hint section below the answer choices/save feedback inside each question. Its collapsed view is one full-width, left-aligned text control with a small expand/collapse indicator at the right. Use a prompt such as `Need a hint?` when unused, `Your hint` for a current success, and clear running/attention wording for current work or failure. Opening reveals the short AI guidance, current hint or thin red error notice, optional prompt field and one eligible generation/retry action. Preserve the existing green hint treatment and compact spacing. The failure message stays a short message in the existing red notice, without a separate title or larger container.

## Files and specification

[QuestionHint.tsx](../../frontend/src/student/QuestionHint.tsx), [HintStore.ts](../../frontend/src/student/HintStore.ts), [TargetStore.ts](../../frontend/src/shared/TargetStore.ts), [types.ts](../../frontend/src/api/types.ts), student styles/tests and [frontend-spec.md](../../specs/frontend-spec.md). Prefer local presentation changes and preserve existing store contracts. Backend `generate_hint` already supplies the safe semantic reasons in task envelopes; no new diagnostics/API field or admission-error detail extraction is needed. See [hint security checks](../security/ui-05-hint-security.md).

No verifier/model/backend change, automatic retry, new AI feature, saved-hint results disclosure or chat. Preserve the compact green/cream design and any completed question-navigation work.

## Done when

| ID | Expected result | Planned verification |
| --- | --- | --- |
| AC-01 | Unused hints are compact; collapsed state stays accurate as running work succeeds or fails. | Keyboard disclosure, store update while hidden, independent question states and accessible summaries. |
| AC-02 | Correct supported diagnostics get friendly copy; untrusted details never appear. | Leakage/relevance/both reasons, wrong stage/code, missing/nonstring/unknown values and injected candidate/message sentinel; inspect actual red styling. |
| AC-03 | Confirmed failure has one editable-prompt retry; uncertainty retains original-key replay. | Fresh/edited prompts, 500-character boundary, deferred request, repeated activation, lost response and failed reconciliation. |
| AC-04 | No rendering/editing/collapse/navigation/reconnect/failure automatically generates; old success stays hidden after latest failure. | Spies plus existing store version/replay cases and late event/GET/POST responses. |
| AC-05 | Prompt/result/error survive movement, and hint unavailability does not block quiz work. | Collapse/reopen, question jumps, running/offline/failure, save and ready-submit regression cases. |
| AC-06 | Long prompt/error/content remains usable in the small layout. | Desktop/320–390px, keyboard, long text, 200%/400% zoom; safe literal text rendering and no shared Notice redesign. |

## Implementation handoff

Use this brief and the linked files inside MP3 as the complete input. Follow the local [implement workflow](../../.agents/skills/implement/SKILL.md) and [coding stage](../../.agents/skills/implement-task/SKILL.md). Keep source, the affected specification and focused acceptance tests together. Preserve other completed changes. Do not edit the Developer Guide. Start implementation only when requested.

The verification described above is planned, not completed. Use mocked APIs for automated checks; no private database or live AI is needed. From `frontend/`, run the relevant focused tests and documented lint, formatting and build checks during implementation. Record actual results and any manual checks that could not be performed.
