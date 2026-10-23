# Quiz-generation model comparison

> Historical blocked run: these upstream-error results do not measure model quality.
> See [model-selection.md](model-selection.md) for the recorded earlier successful
> quiz run and subsequent gateway-limit investigation.

Generated: 2026-10-23T08:28:50

Live probe: each model received the application's real quiz-generation instruction and identical notes (506 words from sample-notes.docx), repeated 5 times, validated through the backend's own `generate_quiz` pipeline (fence stripping, strict JSON parsing, and `validate_quiz`) with question_count=3. PASS = output parsed as strict JSON and satisfied the quiz feature schema.

Notes are extracted from a sample DOCX through the backend's real `extract_docx()`, so the input matches what a teacher upload produces.

Repetition is deliberate: the failure mode is non-deterministic, so the pass rate over several trials is the signal, not any single call.

| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |
| --- | ---: | ---: | ---: | --- |
| `x-test-2` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `x-test-3` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `qwen3-vl:32b` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `x-test-1` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `qwen3.8:27b` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `qwen3-coder-next` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `qwen3.6:35b` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `qwen3.5:9b` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `ornith1.5:35b` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `llama3.1:8b` | 0% | 0/5 | 0.0 | AI_UPSTREAM_ERROR x5 |
| `gemma4:26b` | 0% | 0/5 | 0.1 | AI_UPSTREAM_ERROR x5 |

Failure breakdown shows the backend error code and failing stage/reason (e.g. `AI_INVALID_OUTPUT (output_json/invalid_json_syntax)` means the model returned text that was not strict JSON) with its occurrence count.
