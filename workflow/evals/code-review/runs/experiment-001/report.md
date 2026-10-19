# Evaluation report: code-review (`experiment-001`)

**Setup:** Model `gpt-5.6-luna` · Reasoning effort `low` · Trials per cell `3` · Semantic judges `3` · Status `completed` · Started `2026-10-17T16:17:37.305293+00:00`

> **Scoring note:** Deterministic scores use the rubric's 100-point maximum.
> No worker or judge was rerun. Raw trial artifacts and `experiment.json`
> retain the original harness output.

## Result

| Outcome | Mean score | Passed | Needs review | Completed | Est. total cost |
|:---:|---:|---:|---:|---:|---:|
| **FAIL** | 80.83/100 | 5/6 | 0/6 | 6/6 | $0.3572 |

## Trials

| Test case | Config | Trial | Score | Det | Sem | Band | Pass | Evidence |
|---|---|---:|---:|---:|---:|:--:|:--:|---|
| delegated-child-boundary | with-skill | 1 | 75 | 100 | 75 | pass | No | [result.json](trials/delegated-child-boundary/with-skill/trial-01/result.json) |
| delegated-child-boundary | with-skill | 2 | 85 | 85 | 100 | pass | Yes | [result.json](trials/delegated-child-boundary/with-skill/trial-02/result.json) |
| delegated-child-boundary | with-skill | 3 | 100 | 100 | 100 | pass | Yes | [result.json](trials/delegated-child-boundary/with-skill/trial-03/result.json) |
| single-agent-route | with-skill | 1 | 75 | 75 | 75 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-01/result.json) |
| single-agent-route | with-skill | 2 | 75 | 75 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-02/result.json) |
| single-agent-route | with-skill | 3 | 75 | 75 | 100 | pass | Yes | [result.json](trials/single-agent-route/with-skill/trial-03/result.json) |

## Findings

- **Scoring note:** delegated trials 1 and 3 use the rubric's 100-point maximum in the table above. No evaluation was rerun.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 75`): semantic/main-does-not-read-child-skills: The main agent directly read all four child review SKILL.md files in its command execution (`for f in .agents/skills/{code-quality-review,spec-contract-review,security-boundary-review,verification-review}/SKILL.md; ... sed ...`). This violates an explicit essential pass condition, so the overall score is capped below 70.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 75`): semantic/main-does-not-read-child-skills: The main agent's own command explicitly includes a `CHILD SKILLS` section and reads all four child review SKILL.md files with `sed`. This directly violates the criterion, even though the specialist children also read their assigned skills.
- **delegated-child-boundary / with-skill / trial-02** (`PASS, score 85`): deterministic/four-specialists: specialist_ids={'CQ': ['01a14aab-cbee-75b1-bfbe-117101d11aa8', '01a14aad-9ff4-7ca1-ae6a-2a250f917a9a', '01a14aad-d113-7652-999f-88b8861d32ec'], 'SC': ['01a14aab-cc38-7212-9e0e-46778852d20b', '01a14aad-a077-7640-8627-3cd2b4c285ab', '01a14aad-d186-72a3-968b-bb0b8eda341c'], 'SB': ['01a14aab-cc6b-7853-b8c1-7ac5f43da0be', '01a14aad-d1dd-76e3-a6aa-1183c4799417'], 'VR': ['01a14aab-ccaa-7131-863a-623402f94409', '01a14aad-d235-7a31-824f-ae5536bf897b']}
- **single-agent-route / with-skill / trial-01** (`PASS, score 75`): deterministic/does-not-read-delegated-files: Delegated workflow files must not be read.
- **single-agent-route / with-skill / trial-01** (`PASS, score 75`): semantic/does-not-read-delegated-files: The captured worker trace shows the repository file inventory included and read both .agents/skills/code-review/SUBAGENTS.md and .agents/skills/code-review/AGGREGATOR.md. This violates the requirement not to read either delegated workflow file, so all 25 points are deducted.
- **single-agent-route / with-skill / trial-01** (`PASS, score 75`): semantic/does-not-read-delegated-files: The deterministic grading evidence marks this criterion as failed: delegated workflow files were read. The trace visibly shows the skill directory containing SUBAGENTS.md and AGGREGATOR.md, but the available deterministic result is the authoritative evidence for this criterion. Deduction: all 25 points.
- **single-agent-route / with-skill / trial-02** (`PASS, score 75`): deterministic/does-not-read-delegated-files: Delegated workflow files must not be read.
- **single-agent-route / with-skill / trial-03** (`PASS, score 75`): deterministic/does-not-read-delegated-files: Delegated workflow files must not be read.

## Token usage

| Test case | Config | Uncached input | Cached input | Output | Reasoning | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|
| delegated-child-boundary | with-skill | 78521.33 | 1133696 | 14804.67 | 2129.67 | 16934.33 | $0.1072 |
| single-agent-route | with-skill | 21461.33 | 114858.67 | 4035.67 | 342.67 | 4378.33 | $0.0118 |
| **Total (6 trials)** | — | **299948** | **3745664** | **56521** | **7417** | **63938** | **$0.3572** |

_Per-case rows are trial means (comparable only on the same model and reasoning effort); `Billed output` = output + reasoning. `Est. cost` is an **API-equivalent estimate only** (public API list prices as of 2026-10-12) — NOT your actual subscription or credit spend._
