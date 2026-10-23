# Hint and summary model reliability

Generated: 2026-10-23T04:28:40+00:00

Live probe: each model ran the backend's real `generate_hint` (two gateway calls: candidate + private verification) or `generate_quiz_result_summary` (single call over anonymous aggregate metrics), requested up to 5 times. PASS = the pipeline returned a usable result (for hints, the verifier approved the candidate).

A hint FAIL may be a legitimate verification rejection (`AI_INVALID_OUTPUT (hint_verification/...)`) rather than a reliability problem; the breakdown distinguishes those from parse/schema/infra failures.

## hint

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `qwen3.8:27b` | 80% | 4/5 | 20.8 | AI_INVALID_OUTPUT [HTTP 200] (hint_verification/hint_reveals_answer) x1 |

## summary

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `qwen3.8:27b` | 100% | 5/5 | 22.6 | - |


Counts show attempted trials only. A BATCH BLOCKED entry stops new work; skipped models/features are not model failures. An infrastructure-blocked run is not a valid model-quality comparison.