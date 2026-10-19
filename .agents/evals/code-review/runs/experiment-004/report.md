# Evaluation report: code-review (`experiment-004`)

**Setup:** Model `gpt-5.6-luna` · Reasoning effort `low` · Trials per cell `3` · Semantic judges `3` · Status `completed` · Started `2026-10-19T02:15:29.739610+00:00`

## Result

| Outcome | Mean score | Passed | Needs review | Completed | Est. total cost |
|:---:|---:|---:|---:|---:|---:|
| **FAIL** | 93.33/100 | 5/6 | 0/6 | 6/6 | $0.3683 |

## Worker runtime

| Test case | Config | Timed trials | Mean worker time | Min–max |
|---|---|---:|---:|---|
| delegated-child-boundary | with-skill | 3/3 | 3m 48.440s | 3m 10.140s–4m 7.792s |
| single-agent-route | with-skill | 3/3 | 1m 56.725s | 1m 50.242s–2m 8.311s |

_Worker time is wall-clock execution across all turns, including tool calls and subagent waits; excludes setup, subsequent evidence capture and grading. Means and ranges include all timed trials, regardless of outcome; missing timings are N/A._

## Trials

| Test case | Config | Trial | Score | Det | Sem | Band | Pass | Worker time | Evidence |
|---|---|---:|---:|---:|---:|:--:|:--:|---:|---|
| delegated-child-boundary | with-skill | 1 | 65 | 69 | 65 | partial | No | 4m 7.388s | [result.json](trials/delegated-child-boundary/with-skill/trial-01/result.json) |
| delegated-child-boundary | with-skill | 2 | 100 | 100 | 100 | pass | Yes | 3m 10.140s | [result.json](trials/delegated-child-boundary/with-skill/trial-02/result.json) |
| delegated-child-boundary | with-skill | 3 | 100 | 100 | 100 | pass | Yes | 4m 7.792s | [result.json](trials/delegated-child-boundary/with-skill/trial-03/result.json) |
| single-agent-route | with-skill | 1 | 95 | 100 | 95 | pass | Yes | 1m 51.623s | [result.json](trials/single-agent-route/with-skill/trial-01/result.json) |
| single-agent-route | with-skill | 2 | 100 | 100 | 100 | pass | Yes | 1m 50.242s | [result.json](trials/single-agent-route/with-skill/trial-02/result.json) |
| single-agent-route | with-skill | 3 | 100 | 100 | 100 | pass | Yes | 2m 8.311s | [result.json](trials/single-agent-route/with-skill/trial-03/result.json) |

## Findings

- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 65`): deterministic/four-specialists-read-skills: specialist_ids={'CQ': ['01a151f2-2b24-7aa2-bb99-5ea0ddce6e16'], 'SC': ['01a151f2-2b83-7b01-bc79-74cd86578b4c'], 'SB': ['01a151f2-2bc7-7e53-a003-c5bf3b5d1412'], 'VR': ['01a151f2-2c0e-7801-9381-84f60d29b2a2']}; assigned skill reads=False
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 65`): semantic/semantic-jury: consensus score 65 (median of [65, 69, 60]) -> band 'partial', pass=False at threshold 70; 0/3 deciding judges individually cleared the bar (0 abstained of 3 requested).
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 65`): semantic/four-specialists-read-skills-and-complete: Four specialist threads were spawned and waited for, but the specification/contract specialist did not complete its assigned artifact workflow. Its trace shows it read the shared review instructions, then read AGGREGATOR.md and child artifacts and wrote/modified the canonical report instead of producing reviews/specialist-spec-contract.md. The required specialist skill-read evidence is absent, and the required fourth specialist artifact is missing. This violates the essential condition that all four assigned skills be read by their assigned children and that each specialist write a separate artifact.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 65`): semantic/canonical-report-completeness: A canonical report was produced and includes review checks, findings, limitations, and the missing specification/contract axis. However, it does not preserve a completed finding/artifact for all four axes: reviews/specialist-spec-contract.md is absent, and the report explicitly marks specification validation and documentation consistency blocked. The report therefore correctly records the failure but does not satisfy the required substantive all-four-axis canonical review.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 65`): semantic/canonical-report-completeness: The canonical report is substantive and lists all four review areas, but the required specification/contract specialist artifact is absent from the final workspace and the report explicitly records that axis as missing/blocked. The report therefore does not preserve a complete four-specialist review. This also fails the expected hard gate that missing or blocked axes must not be passed; the overall score is capped below 70.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 65`): semantic/four-specialists-read-skills-and-write-artifacts: Four distinct specialist subagents were spawned and completed, and all received the same fixed target and distinct assigned skill paths. However, the required specification/contract artifact was not produced: workspace/reviews/specialist-spec-contract.md is absent. The aggregator explicitly recorded that only three specialist artifacts were available. This fails the essential condition requiring all four specialists to read their assigned skills, write separate artifacts, and complete before aggregation; the captured evidence does not establish successful completion of the required artifact-writing work for the specification specialist.
- **delegated-child-boundary / with-skill / trial-01** (`FAIL, score 65`): semantic/canonical-report-completeness: A substantive canonical report was produced and preserves the available findings and limitations, but it does not cover all four axes because the required specification/contract artifact is missing. The report itself marks specification validation and documentation consistency as BLOCKED and identifies the missing artifact, so the missing/blocked axis is not incorrectly passed. The essential canonical-report condition therefore fails.
- **delegated-child-boundary / with-skill / trial-02** (`PASS, score 100`): semantic/main-reading-boundary: The main agent did not read DEFAULT.md, AGGREGATOR.md, child skills, or child artifacts before aggregation, which is positive. However, its own trace also shows it directly read the fixed assignment brief, source, and tests (`git show fixture-target:assignment-brief.md`, `src/quiz.ts`, and `tests/quiz.test.ts`) and inspected the product diff. This is direct review-axis work in the main context, contrary to the requirement that the main agent not perform the axes itself. Essential boundary condition therefore fails and the final score is capped below 70.
- **single-agent-route / with-skill / trial-01** (`PASS, score 95`): semantic/canonical-report-completeness: Exactly one substantive report was produced at reviews/quiz-answer-01.md, and it contains the required status, checks, findings, handoff, limitations, and conclusion. It covers code quality, specification, and verification well, but it does not clearly identify a distinct security-boundary assessment or an explicit justified security non-applicability limitation, so the every-axis requirement is only partially evidenced.
- **single-agent-route / with-skill / trial-01** (`PASS, score 95`): semantic/main-reads-and-applies-all-four-skills-sequentially: The trace shows the main agent read all four roster skill files: code-quality-review, spec-contract-review, security-boundary-review, and verification-review. However, they were read through one shell loop rather than with observable sequential application evidence, and the final report does not attribute findings or explicit check decisions to each child skill. The report does contain corresponding quality, specification, security, and verification-related coverage, but the required sequential application is not fully demonstrated.

## Token usage

| Test case | Config | Uncached input | Cached input | Output | Reasoning | Billed output | Est. cost |
|---|---|---:|---:|---:|---:|---:|---:|
| delegated-child-boundary | with-skill | 94420.67 | 1141973.33 | 12584.33 | 1835.33 | 14419.67 | $0.1094 |
| single-agent-route | with-skill | 26008 | 158805.33 | 3799.67 | 344.33 | 4144 | $0.0134 |
| **Total (6 trials)** | — | **361286** | **3902336** | **49152** | **6539** | **55691** | **$0.3683** |

_Per-case rows are trial means (comparable only on the same model and reasoning effort); `Billed output` = output + reasoning. `Est. cost` is an **API-equivalent estimate only** (public API list prices as of 2026-10-12) — NOT your actual subscription or credit spend._
