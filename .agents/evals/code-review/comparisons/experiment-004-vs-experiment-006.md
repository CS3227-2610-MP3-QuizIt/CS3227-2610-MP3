# Comparison: code-review — experiment-004 (v1) vs experiment-006 (v2)

| Setup | v1 (experiment-004) | v2 (experiment-006) |
|---|---|---|
| Model | gpt-5.6-luna | gpt-5.6-luna |
| Reasoning effort | low | low |
| Trials per cell | 3 | 3 |

| Summary | Value |
|---|---|
| Shared cases | 2 |
| Improved (score) | 2 |
| Regressed (score) | 0 |
| Unchanged (score) | 0 |

## Case overview

| Test case | Score (v1 -> v2) | Pass rate | Mean worker time (v1 -> v2) | Time change | Billed out (v1 -> v2) | Est. cost (v1 -> v2) | Score verdict |
|---|---|---|---|---|---|---|---|
| delegated-child-boundary | 88.33 -> 100 (+11.67) | 2/3 -> 3/3 | 3m 48.440s -> 3m 9.510s | -38.930s (-17.0%) | 14419.67 -> 10954.67 (-24.0%) | $0.1094 -> $0.0805 (-26.5%) | improved |
| single-agent-route | 98.33 -> 100 (+1.67) | 3/3 -> 3/3 | 1m 56.725s -> 1m 56.018s | -0.707s (-0.6%) | 4144 -> 3932 (-5.1%) | $0.0134 -> $0.0158 (+18.0%) | improved |

## delegated-child-boundary  (mean of n=3 v1 trial(s) -> n=3 v2 trial(s))

| Axis | v1 | v2 | Change | Verdict |
|---|---|---|---|---|
| mean worker time | 3m 48.440s | 3m 9.510s | -38.930s (-17.0%) | improved |
| timed trials / total | 3/3 | 3/3 | — | — |
| score | 88.33 | 100 | +11.67 (+13.2%) | improved |
| det score | 89.67 | 100 | +10.33 (+11.5%) | improved |
| sem score | 88.33 | 100 | +11.67 (+13.2%) | improved |
| pass rate | 0.67 | 1 | +0.33 (+50.0%) | improved |
| uncached input | 94420.67 | 73575.67 | -20845 (-22.1%) | improved |
| output | 12584.33 | 9601.33 | -2983 (-23.7%) | improved |
| reasoning | 1835.33 | 1353.33 | -482 (-26.3%) | improved |
| billed output | 14419.67 | 10954.67 | -3465 (-24.0%) | improved |
| est. API-equiv. cost | $0.1094 | $0.0805 | -$0.0289 (-26.5%) | improved |

> CONFOUNDED: agent profiles changed (hold everything but the skill constant).

## single-agent-route  (mean of n=3 v1 trial(s) -> n=3 v2 trial(s))

| Axis | v1 | v2 | Change | Verdict |
|---|---|---|---|---|
| mean worker time | 1m 56.725s | 1m 56.018s | -0.707s (-0.6%) | improved |
| timed trials / total | 3/3 | 3/3 | — | — |
| score | 98.33 | 100 | +1.67 (+1.7%) | improved |
| det score | 100 | 100 | +0 (+0.0%) | unchanged |
| sem score | 98.33 | 100 | +1.67 (+1.7%) | improved |
| pass rate | 1 | 1 | +0 (+0.0%) | unchanged |
| uncached input | 26008 | 41450 | +15442 (+59.4%) | regressed |
| output | 3799.67 | 3633.67 | -166 (-4.4%) | improved |
| reasoning | 344.33 | 298.33 | -46 (-13.4%) | improved |
| billed output | 4144 | 3932 | -212 (-5.1%) | improved |
| est. API-equiv. cost | $0.0134 | $0.0158 | +$0.0024 (+18.0%) | regressed |

> CONFOUNDED: agent profiles changed (hold everything but the skill constant).

## Skill language change (v1 -> v2)

_No skill-language diff available (snapshots missing or identical)._

_Worker time is wall-clock execution, including tool calls and subagent waits; excludes setup, subsequent evidence capture and grading. Time change = v2 − v1; negative means faster. Means include all timed trials, regardless of outcome; missing timings are N/A._

_Every per-case number is a MEAN over that cell's trials; `billed output` = output + reasoning (lower is better on token/cost axes); `est. API-equiv. cost` is an estimate at public API list prices (2026-10-12, platform.openai.com/pricing (API list prices, Standard tier, short+long context)) — NOT actual subscription or credit spend._
