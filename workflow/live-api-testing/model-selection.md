# AI model selection — live gateway findings

Status: **complete.** All three AI surfaces (quiz, hint, summary) were probed
against live models. `qwen3.6:35b` is the strongest and fastest on every surface
and is selected for all three. The gateway lockout that briefly blocked
hint/summary probing was root-caused and resolved (see "Resolved blocker").

This document is the canonical record of results, because the machine-written
result files (`model-comparison.md`, `hint-summary-comparison.md`,
`qwen38-baseline.md`) are overwritten by each run and one was clobbered by a
re-run made while the gateway was blocked.

## Motivation

In the running app, quiz generation repeatedly failed with `AI_INVALID_OUTPUT`.
Backend debugging showed the gateway returned HTTP 200 but the originally
configured model (`qwen3.8:27b`, a coder-tuned model) emitted conversational
meta-text instead of the required JSON — e.g. claiming "the deliverable was fully
produced in my previous response" and discussing "tool calls". The backend
correctly refuses to repair non-JSON output (`stage=output_json`,
`reason=invalid_json_syntax`), so the failure is model behaviour, not a backend
defect, and the fix is model choice. To choose on evidence rather than guesswork
we built live probes that run each catalog model through the backend's real
generation pipeline N times and report a pass rate.

The mocked test suite already covers the *structural* and *enforcement* security
boundaries (instruction/data separation, answer-leakage withholding, invalid
output rejection). It cannot establish whether a *live* model returns usable
output or resists adversarial input; these probes target that gap.

## Method

- Input: the application's real feature instructions with identical fixed inputs
  per surface. Quiz uses ~500 words of notes extracted from `sample-notes.docx`
  through the backend's real `extract_docx` (so input matches a real teacher
  upload). Hint uses a fixed question + notes + private answer context. Summary
  uses fixed anonymous aggregate metrics.
- Pipeline: the backend's own `generate_quiz`, `generate_hint` (two gateway
  calls: candidate + private verification), and `generate_quiz_result_summary`.
  PASS = output parsed as strict JSON and satisfied the feature schema (for
  hints, the verifier also approved the candidate).
- Models: distinct chat models auto-discovered from `GET /v1/models` (embeddings,
  audio, and aliases excluded), 11 in total, narrowed to a 5-model shortlist for
  the hint/summary comparison.
- Trials: 5 per model. Repetition is essential — the failure is
  non-deterministic.

## Quiz-generation results (2026-10-22, 11 models x 5 trials = 55 live calls)

Sorted best first (pass rate, then average latency).

| Model | Pass rate | Passes | Avg time (s) | Notes |
| --- | ---: | ---: | ---: | --- |
| `qwen3.6:35b` | 100% | 5/5 | 3.3 | 5/5 in this run and fastest — selected |
| `x-test-1` | 100% | 5/5 | 13.0 | 5/5 in this run; test model ("GLM 5.3 Flash") |
| `qwen3.8:27b` | 100% | 5/5 | 25.4 | 5/5 this run but slow, and failed repeatedly in the live app earlier — evidence that single runs mislead |
| `ornith1.5:35b` | 80% | 4/5 | 5.9 | 1x `output_json/invalid_json_syntax` |
| `x-test-2` | 60% | 3/5 | 6.0 | 2x `AI_UPSTREAM_ERROR` (infra) |
| `gemma4:26b` | 60% | 3/5 | 38.9 | 2x `feature_schema/unexpected_fields` — valid JSON, extra fields |
| `qwen3-vl:32b` | 60% | 3/5 | 96.8 | 2x `AI_TIMEOUT`; vision model, very slow |
| `qwen3-coder-next` | 40% | 2/5 | 3.6 | 3x `output_json/invalid_json_syntax`; coder model |
| `llama3.1:8b` | 20% | 1/5 | 19.3 | 3x non-JSON, 1x extra-fields |
| `qwen3.5:9b` | 20% | 1/5 | 26.9 | 3x non-JSON, 1x upstream error |
| `x-test-3` | 0% | 0/5 | 0.1 | 5x `AI_UPSTREAM_ERROR`; unavailable |

## Hint and summary results (2026-10-23, 5-model shortlist x 5 trials)

Hint runs two gateway calls per trial (candidate + private verification);
summary runs one. A hint FAIL tagged `hint_verification/...` is the verifier
**correctly rejecting** a leaking or irrelevant candidate, not a reliability
failure — see the security note below.

### Hint

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `qwen3.6:35b` | 100% | 5/5 | 1.1 | - |
| `gemma4:26b` | 80% | 4/5 | 27.7 | 1x `hint_verification/hint_reveals_answer` |
| `ornith1.5:35b` | 60% | 3/5 | 8.7 | 2x `hint_verification/hint_reveals_answer` |
| `llama3.1:8b` | 40% | 2/5 | 8.3 | 2x `output_json/invalid_json_syntax`, 1x `feature_schema/unexpected_fields` |
| `x-test-1` | 40% | 2/5 | 23.2 | 3x `hint_verification/hint_reveals_answer` |

### Summary

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `qwen3.6:35b` | 100% | 5/5 | 2.6 | - |
| `x-test-1` | 100% | 5/5 | 18.5 | - |
| `gemma4:26b` | 100% | 5/5 | 23.3 | - |
| `ornith1.5:35b` | 80% | 4/5 | 7.8 | 1x `feature_schema/invalid_summary_array` |
| `llama3.1:8b` | 20% | 1/5 | 7.3 | 2x `output_json/invalid_json_syntax`, 1x `unexpected_fields`, 1x `expected_text` |

## Baseline comparison: previous default `qwen3.8:27b` (2026-10-23, 5 trials)

`qwen3.8:27b` was the original committed default this investigation moved away
from. Probed directly on hint and summary for a like-for-like baseline:

| Surface | `qwen3.8:27b` (old default) | `qwen3.6:35b` (selected) |
| --- | --- | --- |
| Quiz | flaky in live app; 25.4s; coder-drift non-JSON | 100%, 3.3s |
| Hint | 80% (4/5), 20.8s (1x verification rejection) | 100% (5/5), 1.1s |
| Summary | 100% (5/5), 22.6s | 100% (5/5), 2.6s |

`qwen3.6:35b` matches or beats `qwen3.8:27b` on every surface and is far faster
(~19x on hint, ~9x on summary, ~8x on quiz), without the coder-drift quiz
failure mode. The move off `qwen3.8:27b` is justified by evidence on all three
surfaces.

## Observations

- Three distinct quiz failure modes appear, which matters for understanding risk:
  1. **Non-JSON prose** (`output_json/invalid_json_syntax`) — coder-tuned and
     smaller models (qwen3.8:27b in the app, qwen3-coder-next, llama3.1:8b,
     qwen3.5:9b) wrap or replace the JSON with commentary.
  2. **Valid JSON, wrong shape** (`feature_schema/...`) — e.g. gemma4:26b returns
     parseable JSON with fields the strict schema rejects.
  3. **Infrastructure** (`AI_UPSTREAM_ERROR`, `AI_TIMEOUT`).
- Non-determinism is real and significant: `qwen3.8:27b` scored 5/5 on quiz in
  the probe yet failed repeatedly in the live application. A single call per
  model would have given the opposite (wrong) conclusion. This is the core
  methodological lesson, and the reason every model is run multiple times.

### Security finding: live verifier rejects answer-leaking hints

Several hint FAILs across models (`x-test-1` 3x, `ornith1.5:35b` 2x, `gemma4:26b`
1x, `qwen3.8:27b` 1x) were `hint_verification/hint_reveals_answer`: the model
produced a hint that leaked the answer, and the backend's private verification
call **caught and withheld it**. This is the answer-leakage defence working on
**live** model output — evidence the mocked test suite could not provide (mocks
establish enforcement given a leaking output, not that the verifier catches real
leaks). `qwen3.6:35b` produced no leaking hints in 5 trials, but the verifier
remains the authoritative gate regardless of model.

## Decision

Selected model per surface, from the evidence above:

- **Quiz: `qwen3.6:35b`** — 100%, fastest (3.3s); avoids the coder-drift failure.
- **Hint: `qwen3.6:35b`** — 100% (5/5), fastest (1.1s).
- **Summary: `qwen3.6:35b`** — 100% (5/5), fastest (2.6s).

Using one model for all three features is explicitly allowed (AGENTS.md: any two
or all three features may share a model ID), and the evidence makes it the best
choice on every surface.

Configuration note: at the time of writing `backend/.env` set quiz and hint to
`qwen3.6:35b` and summary still to `qwen3.5:9b` (which scored only 20% on
summary). Summary should be moved to `qwen3.6:35b` to match this decision.

## Resolved blocker: gateway retained-conversation lockout

During hint/summary probing the key locked out with HTTP 400:

```
continuation_limit_exceeded: API-key retained conversation count limit exceeded
(retained conversations: 50; maximum conversations: 50).
```

All calls then failed instantly, mapped by the backend to `AI_UPSTREAM_ERROR`.

**Root cause (confirmed):** the application must send `store: false` on
`POST /v1/responses` so responses are not retained. The fix is committed in the
source (commit `43f43f1`, "make soclaas api call store = false so that we do not
hit the 50 stored conversations limit"), but the **running Docker container was
built from older code** and was still omitting `store: false` — so every app and
probe call kept accruing retained conversations until the key's 50-cap was
exhausted and locked all AI requests. The installed module in the container
(`/app/.venv/.../quiz_backend/ai.py`) was verified to lack `"store": False` while
the source had it.

**Resolution:** rebuilt the backend container (so the installed package includes
`store: false`, verified present), and rotated the API key (a fresh key starts at
0 retained conversations; the old one could not be self-reset). A single
post-rotation call succeeded, confirming recovery, and the full hint/summary +
baseline runs then completed normally.

**Lessons:**
- A committed fix is not a deployed fix. The image bakes in the source at build
  time; `.env`-only recreation does not pick up code changes, and a stale image
  silently kept the bug live.
- An earlier assumption that the cap self-clears on the documented 15-minute
  response-state cache TTL was **not** confirmed; the count stayed pinned at
  50/50. Rotation, not waiting, resolved it.

## Reproducing

```bash
cd backend
uv run python ../workflow/live-api-testing/make_sample_docx.py            # regenerate the notes fixture
uv run python ../workflow/live-api-testing/model_comparison_probe.py --allow-live-requests
uv run python ../workflow/live-api-testing/hint_summary_probe.py --allow-live-requests
```

Costs are small (catalog pricing puts even the priciest models near
~$0.005/call); the practical limit is the gateway's retained-conversation cap
when `store: false` is not in effect, not spend.
