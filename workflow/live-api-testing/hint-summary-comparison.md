# Hint and summary model reliability

> Historical blocked run: these upstream-error results do not measure model quality.
> See [model-selection.md](model-selection.md) for the recorded earlier successful
> quiz run and subsequent gateway-limit investigation.

Generated: 2026-10-23T00:41:11

Live probe: each model ran the backend's real `generate_hint` (two gateway calls: candidate + private verification) or `generate_quiz_result_summary` (single call over anonymous aggregate metrics), repeated 5 times. PASS = the pipeline returned a usable result (for hints, the verifier approved the candidate).

A hint FAIL may be a legitimate verification rejection (`AI_INVALID_OUTPUT (hint_verification/...)`) rather than a reliability problem; the breakdown distinguishes those from parse/schema/infra failures.

## summary

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `ornith1.5:35b` | 0% | 0/5 | 0.1 | AI_UPSTREAM_ERROR x5 |
| `llama3.1:8b` | 0% | 0/5 | 0.1 | AI_UPSTREAM_ERROR x5 |
| `gemma4:26b` | 0% | 0/5 | 0.1 | AI_UPSTREAM_ERROR x5 |
| `x-test-1` | 0% | 0/5 | 0.1 | AI_UPSTREAM_ERROR x5 |
| `qwen3.6:35b` | 0% | 0/5 | 0.1 | AI_UPSTREAM_ERROR x5 |
