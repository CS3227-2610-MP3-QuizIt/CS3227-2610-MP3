# Hint presentation security checks

Scope: [collapsible hints and safe failure messages](../tasks/ui-05-improve-quiz-hints.md). Apply the local [threat-modeling method](../../.agents/skills/owasp-threat-modeling/SKILL.md). The [security matrix](security-matrix.md) AUTH-03/AUTH-05 protects answer privacy and hint eligibility; APP-02/APP-04 covers leakage, invalid work and late tasks. These are planned preservation checks.

| Risk | Required control and planned check |
| --- | --- |
| Error wording reveals rejected content or trusts hostile details | Use only supported code/stage/reason combinations. Backend withholds candidate/rationale; frontend uses fixed safe copy. Test missing/wrong/injected diagnostics and candidate sentinels; never expose them. |
| Hidden or stale failure presents old success as current | Preserve latest-target/version guards. Test success → new failure, out-of-order reads/events/replay and collapse/reopen while state changes. |
| Retry creates automatic work or changes an uncertain operation | Only explicit eligible Try again starts `new` with fresh key. Uncertainty repeats exact original key/input. Count requests during rendering/editing/navigation/polling/reconnect; no verifier/model weakening. |
| UI bypasses ownership/submitted rules or blocks quiz work | Preserve backend eligibility and completion rechecks. Test unavailable/running/failed hints alongside answer/save/ready submit, and no fresh generation after submission. |
| Hint text executes | Keep approved content as escaped React text; test literal markup-like strings and benign long text. |

Preserve current store subscriptions and prompt state. No new retention, provider access, permissions, task payload or gateway behavior is introduced. Implementer records mocked checks; reviewer verifies actual evidence. Shared matrix remains unchanged by this note.
