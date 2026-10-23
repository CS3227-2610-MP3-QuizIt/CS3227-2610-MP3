# Live API testing

Investigative, explicitly-gated probes of the real SoCLaaS gateway, used to
choose per-feature models and to surface gateway behaviour the mocked test
suite cannot observe. These are **not** part of `pytest`/`npm test` (which mock
SoCLaaS and never make live calls); every script here requires an explicit
`--allow-live-requests` flag and makes real, metered calls.

## Contents

- `model-selection.md` — findings and model-selection decisions (the report).
- `model_comparison_probe.py` — quiz-generation reliability probe.
- `hint_summary_probe.py` — hint and summary reliability probe.
- `probe_diagnostics.py` — diagnostic HTTP transport/client that surfaces the
  gateway's fixed error code (e.g. `continuation_limit_exceeded`) and flags
  quota/configuration-blocked batches so they are not misread as model-quality
  failures. Retains only safe fixed codes; never raw messages, credentials, or
  generated output.
- `make_sample_docx.py` — generates the `sample-notes.docx` fixture.
- `sample-notes.docx` — ~500-word lecture notes fixture (fed through the
  backend's real `extract_docx`).
- `model-comparison.md` / `hint-summary-comparison.md` — machine-written result
  tables from the most recent run (overwritten by each run; the canonical
  recorded results live in `model-selection.md`).

## How the probes work

Each probe reuses the backend's real pipeline (`quiz_backend.ai.SoCLaaS`,
`_INSTRUCTIONS`, `validate_quiz`, `generate_hint`, `generate_quiz_result_summary`)
so a PASS means the gateway output actually survives production validation. Each
model is run N times because the failure mode is non-deterministic; the pass
rate over several trials is the signal, not any single call.

## Running

Run from `backend/` so `quiz_backend` and `backend/.env` resolve. The probe
scripts add their own directory to `sys.path`, so sibling imports work from any
working directory.

```bash
cd backend
uv run python ../workflow/live-api-testing/make_sample_docx.py
uv run python ../workflow/live-api-testing/model_comparison_probe.py --allow-live-requests
uv run python ../workflow/live-api-testing/hint_summary_probe.py --allow-live-requests
```
