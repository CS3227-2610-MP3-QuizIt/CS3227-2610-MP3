# My quizzes security checks

Scope: [collection organization and scores](../tasks/ui-03-organize-my-quizzes.md). Use the local [threat-modeling method](../../.agents/skills/owasp-threat-modeling/SKILL.md); implementation checks are planned, not executed.

The existing backend collection is scoped to the authenticated student's frozen published assignments. It includes class metadata and submitted scores. The [security matrix](security-matrix.md) AUTH-01/AUTH-03 remains the resource boundary; local tabs and filters grant no authority.

| Risk | Required control and planned check |
| --- | --- |
| Other-user/unfinished score exposure | Use only returned assignments and display score only for submitted state. Test actual zero, unavailable, former classes and inconsistent unfinished-score fixtures. Preserve backend ownership and grading. |
| Search or scores survive account changes | Keep only tab/class/search in the current student workspace's memory. No browser storage/URL/backend persistence. Test route return, reload, logout/session loss, account change and stale responses. |
| Controls start work or multiply requests | Filter locally over the complete collection. Assert no membership, per-card result/detail, start/save/submit/AI calls; explicit collection refresh and action navigation keep their existing meaning. |
| Untrusted titles/class text execute | Preserve React text escaping in card, options and empty/match summaries; test literal markup-like strings. Never render answer keys/explanations on cards. |
| Missing score becomes a false zero or ranking | Label absence explicitly, keep actual zero, use stable in-progress partition only, and never write or infer a grade. |

Frontend implementer owns tests and state lifetime; reviewer checks evidence and rendered layout. Existing tests/source are not a current passing run. No backend/schema/security-matrix change is planned.
