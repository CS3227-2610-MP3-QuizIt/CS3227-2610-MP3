# AI model selection — live gateway findings

Status: quiz model chosen from live evidence; hint and summary selection
**blocked** by a gateway account limit (see "Blocker" below). This document is
the canonical record of results, because the machine-written result files
(`model-comparison.md`, `hint-summary-comparison.md`) are overwritten by
each run and one was clobbered by a re-run made while the gateway was blocked.

## Motivation

In the running app, quiz generation repeatedly failed with `AI_INVALID_OUTPUT`.
Backend debugging showed the gateway returned HTTP 200 but the configured model
(`qwen3.8:27b`, a coder-tuned model) emitted conversational meta-text instead of
the required JSON — e.g. claiming "the deliverable was fully produced in my
previous response" and discussing "tool calls". The backend correctly refuses to
repair non-JSON output (`stage=output_json`, `reason=invalid_json_syntax`), so
the failure is model behaviour, not a backend defect, and the fix is model
choice. To choose on evidence rather than guesswork we built live probes that run
each catalog model through the backend's real generation pipeline N times and
report a pass rate.

The mocked test suite already covers the *structural* and *enforcement* security
boundaries (instruction/data separation, answer-leakage withholding, invalid
output rejection). It cannot establish whether a *live* model returns usable
output or resists adversarial input; these probes target that gap.

## Method

- Input: the application's real quiz-generation instruction plus ~500 words of
  notes extracted from `sample-notes.docx` through the backend's real
  `extract_docx` (so input matches a real teacher upload). Identical for every
  model and trial.
- Pipeline: the backend's own `generate_quiz` (fence stripping, strict JSON
  parse, `validate_quiz`). PASS = output parsed as strict JSON and satisfied the
  quiz feature schema.
- Models: distinct chat models auto-discovered from `GET /v1/models` (embeddings,
  audio, and aliases excluded), 11 in total.
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

### Observations

- Three distinct failure modes appear, which matters for understanding the risk:
  1. **Non-JSON prose** (`output_json/invalid_json_syntax`) — coder-tuned and
     smaller models (qwen3.8:27b in the app, qwen3-coder-next, llama3.1:8b,
     qwen3.5:9b) wrap or replace the JSON with commentary.
  2. **Valid JSON, wrong shape** (`feature_schema/unexpected_fields`) —
     gemma4:26b returns parseable JSON with fields the strict schema rejects.
  3. **Infrastructure** (`AI_UPSTREAM_ERROR`, `AI_TIMEOUT`) — x-test-3 always
     failed; qwen3-vl:32b timed out.
- Non-determinism is real and significant: `qwen3.8:27b` scored 5/5 here yet
  failed repeatedly in the live application. A single call per model would have
  given the opposite (wrong) conclusion for several models. This is the core
  methodological lesson.

## Decision

- **Quiz model: `qwen3.6:35b`** — the only model that was both successful in all five trials and
  fastest (3.3s). Recorded at the time in `backend/.env` (`SOCLAAS_QUIZ_MODEL`).
- At the time of the investigation, `backend/.env` also set `SOCLAAS_HINT_MODEL=qwen3.6:35b` and
  `SOCLAAS_SUMMARY_MODEL=qwen3.5:9b`. Quiz and hint sharing one model is allowed
  (AGENTS.md: any two or all three features may share a model ID). Hint and
  summary choices are **provisional** pending their own probe (blocked below).

### Hint/summary candidate shortlist (planned, not yet measured)

Chosen from the quiz evidence and catalog pricing for a cheaper focused probe
(hint/summary schemas are simpler than quiz, so models that only struggled on the
strict quiz schema still deserve a fair test):

- Keep: `qwen3.6:35b` (quiz winner), `gemma4:26b` (cheap general instruct),
  `llama3.1:8b` (cheapest/fast), `ornith1.5:35b` (capable), `x-test-1` (reliable).
- Drop: `qwen3.8:27b` and `qwen3-coder-next` (coder drift), `qwen3-vl:32b`
  (slow/timeouts), `qwen3.5:9b` (weak), `x-test-2`/`x-test-3` (unstable).

This shortlist is encoded as `CANDIDATE_MODELS` in `hint_summary_probe.py`.

## Blocker: gateway retained-conversation cap

Hint/summary probing could not complete. All calls now fail instantly (~0.1s)
with HTTP 400:

```
continuation_limit_exceeded: API-key retained conversation count limit exceeded
(retained conversations: 50; maximum conversations: 50). Wait for retained
conversations to expire or ask an administrator to reset continuation history
or raise the limit.
```

The backend maps this non-success gateway status to `AI_UPSTREAM_ERROR`, which is
why every probe cell showed that error. Findings:

- The key's retained-conversation count is pinned at **50/50** and did **not**
  drain across several hours of observation. An earlier assumption that it clears
  on the documented 15-minute response-state cache TTL (soclaas-docs.md line 257)
  was **not confirmed** — the count stayed at 50. The "15-minute TTL" is
  documented for the `previous_response_id` cache, which may be a different
  mechanism from this per-key retained-conversation counter.
- The cap was observed after probe traffic and app debugging. The exact
  retention/accounting mechanism was not independently established.

### Open question with app-level implications

The application issues stateless `POST /v1/responses` calls with no
`previous_response_id`, yet these calls still accumulated retained conversations
against the key until it locked out **all** AI requests — including the real
application, not just the probes. If normal classroom use can reach 50 retained
conversations within the (unconfirmed) expiry window, the production app could
lock itself out the same way. This warrants investigation:

- whether the gateway retains every response by default,
- whether there is a documented way to send non-retained requests,
- what the real expiry behaviour of the retained-conversation counter is.

This is an evidence-backed observation, not speculation, and is a candidate
finding for the reflections and backend validation notes.

### Resolution options

1. Ask the SoCLaaS administrator to reset continuation history or raise the cap
   (the error's own prescribed remedy; most likely fix).
2. Use a different API key if available.
3. Wait and test **once**; repeated retries are not evidence that the limit has cleared.

Once the key is usable, run the shortlist probe (kept small to stay under the
cap), one feature at a time with a gap between:

```bash
cd backend
uv run python ../workflow/live-api-testing/hint_summary_probe.py --allow-live-requests --features summary --trials 5 --concurrency 1
# wait, then:
uv run python ../workflow/live-api-testing/hint_summary_probe.py --allow-live-requests --features hint --trials 3 --concurrency 1
```

## Reproducing

```bash
cd backend
uv run python ../workflow/live-api-testing/make_sample_docx.py            # regenerate the notes fixture
uv run python ../workflow/live-api-testing/model_comparison_probe.py --allow-live-requests
uv run python ../workflow/live-api-testing/hint_summary_probe.py --allow-live-requests
```

Costs are small (catalog pricing puts even the priciest models near
~$0.005/call); the practical limits are wall-clock time and the gateway's
retained-conversation cap, not spend.
