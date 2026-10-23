# Hint and summary model reliability

Generated: 2026-10-23T04:06:28+00:00

Live probe: each model ran the backend's real `generate_hint` (two gateway calls: candidate + private verification) or `generate_quiz_result_summary` (single call over anonymous aggregate metrics), requested up to 5 times. PASS = the pipeline returned a usable result (for hints, the verifier approved the candidate).

A hint FAIL may be a legitimate verification rejection (`AI_INVALID_OUTPUT (hint_verification/...)`) rather than a reliability problem; the breakdown distinguishes those from parse/schema/infra failures.

## hint

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `qwen3.6:35b` | 100% | 5/5 | 1.1 | - |
| `gemma4:26b` | 80% | 4/5 | 27.7 | AI_INVALID_OUTPUT [HTTP 200] (hint_verification/hint_reveals_answer) x1 |
| `ornith1.5:35b` | 60% | 3/5 | 8.7 | AI_INVALID_OUTPUT [HTTP 200] (hint_verification/hint_reveals_answer) x2 |
| `llama3.1:8b` | 40% | 2/5 | 8.3 | AI_INVALID_OUTPUT [HTTP 200] (output_json/invalid_json_syntax) x2; AI_INVALID_OUTPUT [HTTP 200] (feature_schema/unexpected_fields) x1 |
| `x-test-1` | 40% | 2/5 | 23.2 | AI_INVALID_OUTPUT [HTTP 200] (hint_verification/hint_reveals_answer) x3 |

## summary

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `qwen3.6:35b` | 100% | 5/5 | 2.6 | - |
| `x-test-1` | 100% | 5/5 | 18.5 | - |
| `gemma4:26b` | 100% | 5/5 | 23.3 | - |
| `ornith1.5:35b` | 80% | 4/5 | 7.8 | AI_INVALID_OUTPUT [HTTP 200] (feature_schema/invalid_summary_array) x1 |
| `llama3.1:8b` | 20% | 1/5 | 7.3 | AI_INVALID_OUTPUT [HTTP 200] (output_json/invalid_json_syntax) x2; AI_INVALID_OUTPUT [HTTP 200] (feature_schema/unexpected_fields) x1; AI_INVALID_OUTPUT [HTTP 200] (feature_schema/expected_text) x1 |


Counts show attempted trials only. A BATCH BLOCKED entry stops new work; skipped models/features are not model failures. An infrastructure-blocked run is not a valid model-quality comparison.