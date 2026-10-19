# Evaluation report: code-review (`experiment-006`)

**Setup:** Model `gpt-5.6-luna` · Reasoning effort `low` · Trials per cell `3` · Semantic judges `3` · Status `completed` · Started `2026-10-19T05:37:36.125636+00:00`

## Result

| Outcome | Mean score | Passed | Needs review | Completed | Est. total cost |
|:---:|---:|---:|---:|---:|---:|
| **PASS** | 100.0/100 | 6/6 | 0/6 | 6/6 | $0.2887 |

## Worker runtime

| Test case | Config | Timed trials | Mean worker time | Min–max |
|---|---|---:|---:|---|
| delegated-child-boundary | with-skill | 3/3 | 3m 9.510s | 3m 8.304s–3m 10.122s |
| single-agent-route | with-skill | 3/3 | 1m 56.018s | 1m 52.304s–2m 1.181s |

_Worker time is wall-clock execution across all turns, including tool calls and subagent waits; excludes setup, subsequent evidence capture and grading. Means and ranges include all timed trials, regardless of outcome; missing timings are N/A._

## Trials

| Test case | Config | Trial | Score | Det | Sem | Band | Pass | Worker time | Evidence |
|---|---|---:|---:|---:|---:|:--:|:--:|---:|---|
| delegated-child-boundary | with-skill | 1 | 100 | 100 | 100 | pass | Yes | 3m 10.122s | [result.json](trials/delegated-child-boundary/with-skill/trial-01/result.json) |
| delegated-child-boundary | with-skill | 2 | 100 | 100 | 100 | pass | Yes | 3m 8.304s | [result.json](trials/delegated-child-boundary/with-skill/trial-02/result.json) |
| delegated-child-boundary | with-skill | 3 | 100 | 100 | 100 | pass | Yes | 3m 10.105s | [result.json](trials/delegated-child-boundary/with-skill/trial-03/result.json) |
| single-agent-route | with-skill | 1 | 100 | 100 | 100 | pass | Yes | 1m 52.304s | [result.json](trials/single-agent-route/with-skill/trial-01/result.json) |
| single-agent-route | with-skill | 2 | 100 | 100 | 100 | pass | Yes | 1m 54.568s | [result.json](trials/single-agent-route/with-skill/trial-02/result.json) |
| single-agent-route | with-skill | 3 | 100 | 100 | 100 | pass | Yes | 2m 1.181s | [result.json](trials/single-agent-route/with-skill/trial-03/result.json) |

## Findings

- **single-agent-route / with-skill / trial-02** (`PASS, score 100`): semantic/main-reads-and-applies-all-four-skills-sequentially: The trace shows the main agent read all four child skill files in the roster order, but the resulting report does not provide observable evidence that all four were applied. Verification and specification concerns are substantively discussed, and code quality receives only a brief positive observation. Security-boundary review is not explicitly assessed and has no finding, limitation, or security-specific conclusion. Because applying all four skills is an essential pass condition, this criterion fails and the overall score is capped below 70.
- **single-agent-route / with-skill / trial-02** (`PASS, score 100`): semantic/one-canonical-report-covers-every-axis: Exactly one nonempty Markdown review artifact was produced: reviews/quiz-answer-behavior-01.md. It is canonical, includes findings/limitations and the required handoff sections, and addresses verification, specification, and some code-quality considerations. However, it does not explicitly cover the security-boundary axis, so the report does not fully satisfy the requirement that every axis have findings or a justified limitation. No per-axis artifacts were written.

## Token usage

| Test case | Config | Uncached input | Cached input | Output | Reasoning | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|
| delegated-child-boundary | with-skill | 73575.67 | 782762.67 | 9601.33 | 1353.33 | 10954.67 | $0.0805 |
| single-agent-route | with-skill | 41450 | 137557.33 | 3633.67 | 298.33 | 3932 | $0.0158 |
| **Total (6 trials)** | — | **345077** | **2760960** | **39705** | **4955** | **44660** | **$0.2887** |

_Per-case rows are trial means (comparable only on the same model and reasoning effort); `Billed output` = output + reasoning. `Est. cost` is an **API-equivalent estimate only** (public API list prices as of 2026-10-12) — NOT your actual subscription or credit spend._
