# Results privacy and integrity checks

Scope: [results and answer review](../tasks/ui-06-improve-quiz-results.md), using the local [threat-modeling method](../../.agents/skills/owasp-threat-modeling/SKILL.md). The [security matrix](security-matrix.md) AUTH-01/AUTH-03 remains authoritative. No checks below have been executed for this change.

| Risk | Required control and planned check |
| --- | --- |
| Route tampering exposes another student's result | Preserve `Core.check_attempt`, `Core.results`, scoped API reads and session clearing. Mock owner success, other student denial, teacher/admin denial and missing/expired session; no cached old-user result appears. |
| Unsubmitted view gets answer keys early | Preserve backend ATTEMPT_NOT_SUBMITTED and frontend submitted gating. Test direct not-started/in-progress routes; do not fetch keys early and merely hide them with CSS/disclosures. |
| Filters/disclosures change or invent results | Use saved backend score/percentage/time/options/selections/correctness/explanation. Test zero/partial/perfect, picked-correct dual labels, date formatting and no save/submit/generation calls. |
| Saved text becomes executable | Preserve React text rendering. Test markup/instruction-like stems/options/explanations and benign long multiline content; opening an explanation does not fetch or generate content. |
| Failed/stale reads erase review or cross attempt/session | Keep loaded data on refresh failure and existing abort/identity guards. Test initial failure/retry, failed refresh/recovery, out-of-order routes and session loss. |

No permission, grading, schema, endpoint, AI or shared matrix change is introduced. Frontend implementer owns focused component/session checks; reviewer checks rendered layout and evidence limits.
