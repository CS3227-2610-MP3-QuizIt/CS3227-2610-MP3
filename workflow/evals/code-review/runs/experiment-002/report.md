# Evaluation report: code-review (`experiment-002`)

**Setup:** Model `gpt-5.6-luna` · Reasoning effort `low` · Trials per cell `3` · Semantic judges `3` · Status `completed` · Started `2026-10-18T10:37:24.244287+00:00`

## Result

| Outcome | Mean score | Passed | Needs review | Completed | Est. total cost |
|:---:|---:|---:|---:|---:|---:|
| **FAIL** | 94.83/100 | 5/6 | 0/6 | 6/6 | $0.3353 |

## Trials

| Test case | Config | Trial | Score | Det | Sem | Band | Pass | Evidence |
|---|---|---:|---:|---:|---:|:--:|:--:|---|
| delegated-child-boundary | with-skill | 1 | 69 | 69 | 80 | partial | No | [result.json](trials/delegated-child-boundary/with-skill/trial-01/result.json) |
| delegated-child-boundary | with-skill | 2 | 100 | 100 | 100 | pass | Yes | [result.json](trials/delegated-child-boundary/with-skill/trial-02/result.json) |
| delegated-child-boundary | with-skill | 3 | 100 | 100 | 100 | pass | Yes | [result.json](trials/delegated-child-boundary/with-skill/trial-03/result.json) |
| single-agent-route | with-skill | 1 | 100 | 100 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-01/result.json) |
| single-agent-route | with-skill | 2 | 100 | 100 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-02/result.json) |
| single-agent-route | with-skill | 3 | 100 | 100 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-03/result.json) |

## Findings

- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 69`): deterministic/main-routes-to-subagents: Main trace must select SUBAGENTS.md without reading DEFAULT.md.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 69`): semantic/routes-to-subagents: The main trace shows a single command that reads `SUBAGENTS.md` and then explicitly reads `DEFAULT.md` as well (worker/trace.jsonl ordinal 15). Although the worker proceeded with the delegated workflow, the expected routing was to `SUBAGENTS.md`, not `DEFAULT.md`; this criterion therefore loses all 20 points.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 69`): semantic/main-routes-to-subagents: The main agent did read and follow SUBAGENTS.md, but its trace also shows a single command reading DEFAULT.md. The expected condition specifically requires routing to SUBAGENTS.md, not DEFAULT.md, so the full 20 points are deducted.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 69`): semantic/main-routes-to-subagents: The deterministic evidence marks this condition as failed: the main agent did not route to SUBAGENTS.md as required, so no points are awarded for the 20-point routing criterion.

## Token usage

| Test case | Config | Uncached input | Cached input | Output | Reasoning | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|
| delegated-child-boundary | with-skill | 79420.67 | 1040426.67 | 13383.67 | 1669.67 | 15053.33 | $0.1005 |
| single-agent-route | with-skill | 21095.67 | 116480 | 3626.33 | 330 | 3956.33 | $0.0113 |
| **Total (6 trials)** | — | **301549** | **3470720** | **51030** | **5999** | **57029** | **$0.3353** |

_Per-case rows are trial means (comparable only on the same model and reasoning effort); `Billed output` = output + reasoning. `Est. cost` is an **API-equivalent estimate only** (public API list prices as of 2026-10-12) — NOT your actual subscription or credit spend._
