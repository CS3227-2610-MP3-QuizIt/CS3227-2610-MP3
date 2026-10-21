# Student UI task queue

Updated: 2026-10-22. Branch: `plan/student-ui`. Source baseline: `bd30398`.

## Six tasks to implement

Each row is one complete implementation/review run. All six are READY: existing approved requirements were combined and rewritten in plain language at the user's request. No product behavior was added by this regrouping.

| Order | Task | What the work actually is |
| --- | --- | --- |
| 1 | [Update login text and the QuizIt name](tasks/ui-01-update-login-page.md) | Replace login wording, rename existing shared branding, and conditionally repair help contrast/heading semantics while keeping the design. |
| 2 | [Fix sign-in errors, waiting and session recovery](tasks/ui-02-fix-sign-in-feedback-and-recovery.md) | Validate the form, explain failures, respect server wait time, check uncertain sessions and safely handle known session loss. |
| 3 | [Organize My quizzes and show submitted scores](tasks/ui-03-organize-my-quizzes.md) | Add tabs/search/class filter/scores and include status labels, button emphasis, click targets, count grammar and card alignment. |
| 4 | [Add question navigation and safer submission](tasks/ui-04-improve-quiz-attempt-page.md) | Update question frames, add right/mobile navigation and review marks, and require saved answers plus final confirmation. |
| 5 | [Make hints collapsible and fix AI error messages](tasks/ui-05-improve-quiz-hints.md) | Collapse unused controls, keep prompt/current state, and replace technical errors with friendly red notices and safe explicit retry. |
| 6 | [Update the results page and answer review](tasks/ui-06-improve-quiz-results.md) | Add compact score/details layout, All/Mistakes review, clear answer labels and saved explanation disclosures. |

The old 24 task briefs are replaced by these six. Navigation, marks and readiness are delivered together, so no separate navigator prerequisite blocks the queue. These tasks have no functional dependencies on one another; the suggested order coordinates shared files. Preserve completed sibling work.

## How to use

For example:

```text
/implement workflow/tasks/ui-01-update-login-page.md
```

Choose one task per run. Its plain-language requirements, local specification/source references and planned checks are all in the brief. Four linked security notes provide the relevant boundary checks. No context outside MP3 is required. Tests and rendered checks are future implementation work, not completed planning evidence.

## Still deferred

- Explanation chat remains last, after other work. No chat task is created here.
- Show/Hide target enlargement has no approved repair; measure first if investigating it.
- The stale global failed-save warning is triage only, described in the attempt task. Do not silently add a separate fix.
- `tasks/student-quiz-discovery-refresh.md` is not part of this queue and is unchanged.

Keep the original green/cream design, compact typography and accepted answer controls. Do not edit the Developer Guide. Application source/specifications were not changed during this reorganization. Implementation has not started.
