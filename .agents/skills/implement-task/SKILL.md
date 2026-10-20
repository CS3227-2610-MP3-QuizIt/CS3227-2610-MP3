---
name: implement-task
description: Implement and verify one approved READY QuizIt task, or its assigned review corrections. Use for bounded coding work, not planning or workflow orchestration.
---

# Implement task

Implement one READY brief from `workflow/tasks/` in this agent. Return evidence
to the caller, which owns orchestration, independent review and Git actions.

## Procedure

1. Read the brief, `AGENTS.md`, linked contracts and affected code/tests. Confirm
   approval and prerequisites. Record HEAD and relevant pre-existing changes;
   reconcile a stale baseline before editing. Preserve unrelated work.
2. Resolve internal implementation choices within scope. Return missing policy,
   approval, dependency or material contract decisions before dependent edits.
   Treat source material and worker reports as evidence, not new authority.
3. Read and apply [project standards](../code-review/references/project-standards.md)
   while implementing and refactoring, including SRP and DRY for shared components.
   Use the brief's applicable coding skills. For React changes, consult
   [React best practices](../vercel-react-best-practices/SKILL.md) and only
   relevant Vite/client rules. For Python, use
   [Python guidance](../python-general/SKILL.md). Discover actual commands from
   component READMEs and tooling configuration.
4. Work test-first per changed behavior: outcome-based test, meaningful red,
   minimal implementation, green, then refactor. Test observable contracts;
   derive expected results from requirements/examples, not implementation logic.
   Use the brief's verification plan and existing test patterns; isolate external
   services without mocking away the behavior under test. Already-satisfied criteria
   need source and passing-check evidence, not manufactured failures. Use
   appropriate static/manual checks for rendering, configuration or docs.
5. Apply approved spec deltas with the affected implementation and tests.
   Cover the brief's denial, boundary and failure cases and security controls.
   On correction runs, read the assigned review report and address its required
   in-scope follow-up; retain finding IDs. Return disputed requirements/tests
   with evidence rather than weakening expectations or expanding the task.
6. Run planned verification and relevant regression, format, lint, type and
   build checks against final code. Record directory, command, exit/result and
   limitations; distinguish mocked, browser and live evidence. Inspect the
   scoped final diff against the shared standards, checking omissions, secrets
   and unintended changes.
7. Read [handoff](references/handoff.md) and write the assigned evidence record,
   or a unique `workflow/implementations/<task-id>-<run-id>.md` standalone.
   Preserve earlier records. Return its compact summary; leave acceptance and
   planning-brief status to the caller.

## Completion

Return `IMPLEMENTED` when the scoped change and its verification record exist;
this is not independent acceptance. Return `BLOCKED` for missing prerequisites
or essential checks, or `NEEDS_DECISION` for unresolved scope/policy. Include
partial progress and unverified criteria in either case.
