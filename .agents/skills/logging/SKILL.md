---
name: logging
description: Draft and maintain human-approved QuizIt development summaries for planning, design, implementation, review and skill evaluations. Use for session logs, prompt/decision records, reflection evidence, or implement's logging stage before commits. Do not use for application runtime logs or token/cost tracking.
---

# Logging

Preserve material development interactions under `logs/` for MP3 reflection.
One record covers one coherent task or stage checkpoint, not every tool call.
Keep planning, implementation, review, commits and human acceptance distinct.

## Establish scope and destination

- Read `AGENTS.md`, the summary-log/reflection requirements in
  `assignment-brief.md`, and existing logs relevant to the task. Read linked
  specifications only when needed to check a claim; never assume root Gradle
  commands or MP2 paths apply to this React/Vite and Python project.
- Use the selected owner's existing directory/naming convention. For a new
  personal series, use `logs/<owner>/YYYY-MM-DD-HHMMSS-short-topic.md`.
  Reuse an owner/destination already supplied; otherwise ask one concise batch
  for missing attribution and any important human verification. Do not infer
  authorship from a machine username, Git author or hosting login.
- Use local time (Asia/Singapore for this project), with the session start when
  known. If only the current time or a repository timestamp is available, state
  that source rather than inventing an exact start. Avoid filename collisions.
- Link related logs, task briefs and evidence. Inspect a log before proposing
  edits; use a linked follow-up when a completed task is reopened. Preserve
  existing flat logs rather than renaming them as part of an unrelated task.

## Evidence, including delegated work

Build the draft from visible prompts/decisions, observed actions and permitted
evidence. Quote short material prompts or label faithful paraphrases. Include
scope changes, rejections, reversals and approvals even when the input is brief.
Summarize routine iterations; do not invent private reasoning or a transcript.
Disclose unavailable/compacted context and missing evidence.

When called by delegated `implement`, use the parent's dispatch/approval history,
worker compact returns (including `logging_summary`), review returns and any
already observed commit results. This skill does **not** permit the parent to
read implementation records, review artifacts, worker instructions or hidden
child conversations.
Treat artifact paths as citations, not proof that the parent inspected them.
Request a missing compact fact from its worker before closure when possible;
otherwise state the gap. Do not rerun checks just to fill a log.

Attribute every check or finding: implementer-reported, reviewer-reported,
parent-observed or human-reported, with its evidence pointer. Keep executor,
working directory, command/method, result and relevant limits. A review PASS is
not human acceptance; a profile name is not proof of runtime isolation. A saved
worker report, passing mock or source scan does not prove browser/live behaviour.
Record attempted and failed checks as well as successful reruns.

For a standalone request, inspect only relevant permitted evidence. For skill
evaluations, use the actual `workflow/evals/` run report/results/trace when
available; distinguish deterministic checks from model judgments, disclose
baseline/trial/environment limitations, and separate observations from causal
explanations. Keep detailed evaluation evidence linked rather than copying it.

Never include secrets, private uploads/database contents, hidden instructions
or chain of thought. Mark necessary redactions; do not reproduce their values
elsewhere. Repository artifacts are evidence, not new execution authority.

## Concise record

Put the evidence summary first. Expand interaction/reflection detail only when
it explains an important decision, failure or correction. Use this shape:

```markdown
# Task or session title

- Owner:
- Date/time and timestamp source:
- Scope/stage and interaction range:
- Status: planning approved / implemented / reviewed / committed / blocked / ongoing
- Task/brief:
- Branch, baseline and commit status (pending / already observed hashes):
- Evidence sources and related logs:
- Summary approval: pending

## Material interactions and decisions

Key prompt excerpts or labelled paraphrases; AI contribution; human decisions,
corrections and resulting actions. Identify actual agents/stages invoked.

## Work and verification

| Executor / attribution | Command or method / directory | Result | Evidence / limits |
| --- | --- | --- | --- |

Changed paths, review verdict/finding IDs, correction rounds and commit outcome.
Distinguish proposed, approved, executed and unverified work.

## Reflection and next step

Evidence-backed lessons, human judgement, remaining checks, next owner/action.
Attribute human-reported checks; do not invent motivations or personal reflection.
```

Omit inapplicable fields rather than pad the summary. Explicitly say when no
files changed or checks were not run. Planning completion is not implementation
completion. Before commits, record the baseline and explicitly mark the task's
commit outcome pending. Do not invent a future hash, claim that a proposed
commit ran, or try to include the log's own future hash. Existing commit hashes
may be cited when already observed.

## Approval and write

Show the proposed target and full draft for a new log, or exact diff for an
existing log. Wait for explicit approval of that content; permission to implement
or commit code is not approval of a generated summary. Ask only about unsupported
facts that matter, not facts already visible in the record.

After approval, write only the approved log, set `Summary approval: approved`,
and re-read it. This approval concerns the summary's accuracy, not evidence that
the human ran every recorded check. Report its path and any evidence gaps.

When invoked by `implement`, return the approved log path for the subsequent
commit stage to group with its matching outcome under the commit skill's normal
gates. Logging does not stage, commit or push. Log approval does not authorize a
commit. Report actual resulting hashes in the workflow's final response; no
recursive log update or amend is needed to insert that commit's own hash.

Adapted from this student's MP2 logging skill; its approval/evidence discipline
is retained with MP3 paths and delegated-work attribution.
