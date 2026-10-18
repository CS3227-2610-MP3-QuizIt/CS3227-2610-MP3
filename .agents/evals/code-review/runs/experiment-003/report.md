# Evaluation report: code-review (`experiment-003`)

**Setup:** Model `gpt-5.6-luna` · Reasoning effort `low` · Trials per cell `3` · Semantic judges `3` · Status `completed` · Started `2026-10-18T11:05:44.977128+00:00`

## Result

| Outcome | Mean score | Passed | Needs review | Completed | Est. total cost |
|:---:|---:|---:|---:|---:|---:|
| **PASS** | 100.0/100 | 6/6 | 0/6 | 6/6 | $0.3741 |

## Trials

| Test case | Config | Trial | Score | Det | Sem | Band | Pass | Evidence |
|---|---|---:|---:|---:|---:|:--:|:--:|---|
| delegated-child-boundary | with-skill | 1 | 100 | 100 | 100 | pass | Yes | [result.json](trials/delegated-child-boundary/with-skill/trial-01/result.json) |
| delegated-child-boundary | with-skill | 2 | 100 | 100 | 100 | pass | Yes | [result.json](trials/delegated-child-boundary/with-skill/trial-02/result.json) |
| delegated-child-boundary | with-skill | 3 | 100 | 100 | 100 | pass | Yes | [result.json](trials/delegated-child-boundary/with-skill/trial-03/result.json) |
| single-agent-route | with-skill | 1 | 100 | 100 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-01/result.json) |
| single-agent-route | with-skill | 2 | 100 | 100 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-02/result.json) |
| single-agent-route | with-skill | 3 | 100 | 100 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-03/result.json) |

## Token usage

| Test case | Config | Uncached input | Cached input | Output | Reasoning | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|
| delegated-child-boundary | with-skill | 90005.33 | 1256448 | 13913 | 1919.67 | 15832.67 | $0.1148 |
| single-agent-route | with-skill | 13324.67 | 128298.67 | 3584.67 | 335 | 3919.67 | $0.0099 |
| **Total (6 trials)** | — | **309990** | **4154240** | **52493** | **6764** | **59257** | **$0.3741** |

_Per-case rows are trial means (comparable only on the same model and reasoning effort); `Billed output` = output + reasoning. `Est. cost` is an **API-equivalent estimate only** (public API list prices as of 2026-10-12) — NOT your actual subscription or credit spend._
