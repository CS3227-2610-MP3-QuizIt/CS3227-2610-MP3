# Evaluation report: code-review (`experiment-005`)

**Setup:** Model `gpt-5.6-luna` · Reasoning effort `low` · Trials per cell `1` · Semantic judges `3` · Status `completed` · Started `2026-10-19T04:39:45.071510+00:00`

## Result

| Outcome | Mean score | Passed | Needs review | Completed | Est. total cost |
|:---:|---:|---:|---:|---:|---:|
| **PASS** | 100.0/100 | 1/1 | 0/1 | 1/1 | $0.0964 |

## Worker runtime

| Test case | Config | Timed trials | Mean worker time | Min–max |
|---|---|---:|---:|---|
| delegated-child-boundary | with-skill | 1/1 | 3m 14.211s | 3m 14.211s–3m 14.211s |

_Worker time is wall-clock execution across all turns, including tool calls and subagent waits; excludes setup, subsequent evidence capture and grading. Means and ranges include all timed trials, regardless of outcome; missing timings are N/A._

## Trials

| Test case | Config | Trial | Score | Det | Sem | Band | Pass | Worker time | Evidence |
|---|---|---:|---:|---:|---:|:--:|:--:|---:|---|
| delegated-child-boundary | with-skill | 1 | 100 | 100 | 100 | pass | Yes | 3m 14.211s | [result.json](trials/delegated-child-boundary/with-skill/trial-01/result.json) |

## Findings

- **delegated-child-boundary / with-skill / trial-01** (`PASS, score 100`): semantic: judge 1: grader did not produce a JSON object; judge exited with code 1

## Token usage

| Test case | Config | Uncached input | Cached input | Output | Reasoning | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|
| delegated-child-boundary | with-skill | 89969 | 957696 | 10798 | 1488 | 12286 | $0.0964 |

_Per-case rows are trial means (comparable only on the same model and reasoning effort); `Billed output` = output + reasoning. `Est. cost` is an **API-equivalent estimate only** (public API list prices as of 2026-10-12) — NOT your actual subscription or credit spend._
