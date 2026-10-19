# Comparison: code-review — experiment-002 (v1) vs experiment-003 (v2)

| Setup | v1 (experiment-002) | v2 (experiment-003) |
|---|---|---|
| Model | gpt-5.6-luna | gpt-5.6-luna |
| Reasoning effort | low | low |
| Trials per cell | 3 | 3 |

| Summary | Value |
|---|---|
| Shared cases | 2 |
| Improved (score) | 1 |
| Regressed (score) | 0 |
| Unchanged (score) | 1 |

## Case overview

| Test case | Score (v1 -> v2) | Pass rate | Billed out (v1 -> v2) | Est. cost (v1 -> v2) | Score verdict |
|---|---|---|---|---|---|
| delegated-child-boundary | 89.67 -> 100 (+10.33) | 2/3 -> 3/3 | 15053.33 -> 15832.67 (+5.2%) | $0.1005 -> $0.1148 (+14.2%) | improved |
| single-agent-route | 100 -> 100 | 3/3 -> 3/3 | 3956.33 -> 3919.67 (-0.9%) | $0.0113 -> $0.0099 (-12.0%) | unchanged |

## delegated-child-boundary  (mean of n=3 v1 trial(s) -> n=3 v2 trial(s))

| Axis | v1 | v2 | Change | Verdict |
|---|---|---|---|---|
| score | 89.67 | 100 | +10.33 (+11.5%) | improved |
| det score | 89.67 | 100 | +10.33 (+11.5%) | improved |
| sem score | 93.33 | 100 | +6.67 (+7.1%) | improved |
| pass rate | 0.67 | 1 | +0.33 (+50.0%) | improved |
| uncached input | 79420.67 | 90005.33 | +10584.66 (+13.3%) | regressed |
| output | 13383.67 | 13913 | +529.33 (+4.0%) | regressed |
| reasoning | 1669.67 | 1919.67 | +250 (+15.0%) | regressed |
| billed output | 15053.33 | 15832.67 | +779.34 (+5.2%) | regressed |
| est. API-equiv. cost | $0.1005 | $0.1148 | +$0.0143 (+14.2%) | regressed |

## single-agent-route  (mean of n=3 v1 trial(s) -> n=3 v2 trial(s))

| Axis | v1 | v2 | Change | Verdict |
|---|---|---|---|---|
| score | 100 | 100 | +0 (+0.0%) | unchanged |
| det score | 100 | 100 | +0 (+0.0%) | unchanged |
| sem score | 100 | 100 | +0 (+0.0%) | unchanged |
| pass rate | 1 | 1 | +0 (+0.0%) | unchanged |
| uncached input | 21095.67 | 13324.67 | -7771.00 (-36.8%) | improved |
| output | 3626.33 | 3584.67 | -41.66 (-1.1%) | improved |
| reasoning | 330 | 335 | +5 (+1.5%) | regressed |
| billed output | 3956.33 | 3919.67 | -36.66 (-0.9%) | improved |
| est. API-equiv. cost | $0.0113 | $0.0099 | -$0.0014 (-12.0%) | improved |

## Skill language change (v1 -> v2)

```diff
--- v1/SKILL.md
+++ v2/SKILL.md
@@ -14,10 +14,11 @@
 Use the requested scope and fixed point if supplied.
 
 ## Workflow
+Do NOT explore and read unnecessary files.
 
 1. Determine whether review subagents are available.
-2. If they are available, read and follow [SUBAGENTS.md](SUBAGENTS.md).
-3. Otherwise, read and follow [DEFAULT.md](DEFAULT.md).
+2. If they are available, read and follow [SUBAGENTS.md](SUBAGENTS.md) ONLY.
+3. Otherwise, read and follow [DEFAULT.md](DEFAULT.md) ONLY.
 
 If the user explicitly requests one-agent review, use `DEFAULT.md`.
 If subagents were requested but are unavailable, state that once and use
```

_Every per-case number is a MEAN over that cell's trials; `billed output` = output + reasoning (lower is better on token/cost axes); `est. API-equiv. cost` is an estimate at public API list prices (2026-10-12, platform.openai.com/pricing (API list prices, Standard tier, short+long context)) — NOT actual subscription or credit spend._
