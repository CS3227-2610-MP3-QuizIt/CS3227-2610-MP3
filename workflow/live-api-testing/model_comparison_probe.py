"""Live model-comparison probe for quiz generation.

Investigative tooling for the quiz-model selection decision (see
workflow/live-api-testing/model-comparison.md). This is NOT part of the automated test suite:
pytest and npm test mock SoCLaaS and never make live calls. This script makes
real, metered POST /v1/responses calls, so it must be run explicitly and
sparingly.

It sends the SAME quiz-generation instruction and a fixed sample notes payload
the application uses (reusing quiz_backend's real _INSTRUCTIONS and the
generate_quiz pipeline, so fence-stripping, strict JSON parsing, and
validate_quiz are identical to production) to each chat model, repeated N times,
then reports a pass rate per model. Repetition matters: the observed failure is
non-deterministic (a model may return prose on one call and valid JSON on the
next), so a single call per model is not reliable signal.

By default the model set is auto-discovered from GET /v1/models (distinct chat
models only; embeddings/audio and aliases are dropped), so it never goes stale.
Call budget = len(models) x --trials. Restrict with --models and lower --trials
to spend less.

Run from backend/ so quiz_backend and backend/.env resolve:

    cd backend
    uv run python ../workflow/live-api-testing/model_comparison_probe.py --allow-live-requests

Optional:
    --models qwen3.6:35b gemma4:26b llama3.1:8b   # restrict the model set
    --trials 5                                    # runs per model (default 5)
    --question-count 3                            # default 3
    --out ../workflow/live-api-testing/model-comparison.md         # results markdown
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import os
import statistics
import time
from collections import Counter
from dataclasses import dataclass, field

import httpx
from probe_diagnostics import ProbeClient
from quiz_backend.ai import AIError, SoCLaaS
from quiz_backend.config import Settings
from quiz_backend.notes import extract_docx

# Default sample notes: a ~500-word lecture DOCX, extracted through the backend's
# real extract_docx() so snapshot["notes"] is exactly what an upload produces.
DEFAULT_NOTES_DOCX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample-notes.docx")


def load_notes(docx_path: str) -> str:
    """Extract notes text from a DOCX using the backend's real parser."""
    with open(docx_path, "rb") as handle:
        data = handle.read()
    return extract_docx(data, os.path.basename(docx_path))


def discover_models(base: Settings) -> list[str]:
    """Live-discover distinct chat models from GET /v1/models.

    Filters to entries whose soclaas.capabilities include "chat" (dropping
    embeddings and audio models), then collapses aliases: catalog aliases share
    their target's display name, context length, and pricing, so we keep only
    the first id seen per such signature. This keeps the probe exhaustive and
    stops the model list going stale against backend/soclaas-docs.md.
    """
    url = base.soclaas_base_url.rstrip("/") + "/v1/models"
    key = base.soclaas_api_key.get_secret_value()
    response = httpx.get(
        url, headers={"Authorization": "Bearer " + key}, timeout=20, trust_env=False
    )
    response.raise_for_status()
    items = response.json().get("data", [])
    seen: set[tuple] = set()
    models: list[str] = []
    for entry in items:
        meta = entry.get("soclaas") or {}
        if "chat" not in (meta.get("capabilities") or []):
            continue
        signature = (
            meta.get("display_name"),
            entry.get("max_model_len"),
            meta.get("input_microdollars_per_million_tokens"),
            meta.get("output_microdollars_per_million_tokens"),
        )
        if signature in seen:
            continue  # alias of a model already selected
        seen.add(signature)
        models.append(entry["id"])
    return models


# Fixed sample notes are loaded from a DOCX at runtime (see load_notes); every
# model and every trial receives the identical extracted text.


@dataclass
class Trial:
    ok: bool
    detail: str
    elapsed_s: float
    output_tokens: int | None = None


@dataclass
class ModelResult:
    model: str
    trials: list[Trial] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return any("BATCH BLOCKED" in trial.detail for trial in self.trials)

    @property
    def rate_label(self) -> str:
        return "BLOCKED" if self.blocked else f"{self.pass_rate:.0%}"

    @property
    def passes(self) -> int:
        return sum(1 for t in self.trials if t.ok)

    @property
    def total(self) -> int:
        return len(self.trials)

    @property
    def pass_rate(self) -> float:
        return self.passes / self.total if self.total else 0.0

    @property
    def avg_elapsed(self) -> float:
        times = [t.elapsed_s for t in self.trials]
        return statistics.mean(times) if times else 0.0

    def failure_breakdown(self) -> str:
        reasons = Counter(t.detail for t in self.trials if not t.ok)
        if not reasons:
            return "-"
        return "; ".join(f"{detail} x{n}" for detail, n in reasons.most_common())


def settings_for(base: Settings, model: str) -> Settings:
    """A Settings copy whose quiz model is the candidate; context fits the catalog."""
    data = base.model_dump()
    data["soclaas_quiz_model"] = model
    # Smallest chat-model context in the snapshot is 65536; clamp to fit all.
    data["soclaas_quiz_context_tokens"] = min(base.soclaas_quiz_context_tokens or 65536, 65536)
    return Settings(**data)


async def one_trial(
    client: httpx.AsyncClient, base: Settings, model: str, count: int, notes: str
) -> Trial:
    ai = SoCLaaS(settings_for(base, model), client)
    snapshot = {
        "question_count": count,
        "notes": notes,
        "current_draft": [],
        "prompt": "",
    }
    started = time.monotonic()
    if isinstance(client, ProbeClient):
        client.begin_trial()
    try:
        result = await ai.generate_quiz(snapshot)
    except AIError as error:
        elapsed = time.monotonic() - started
        detail = client.describe_error(error) if isinstance(client, ProbeClient) else error.code
        if isinstance(error.details, dict):
            stage = error.details.get("stage", "")
            reason = error.details.get("reason", "")
            if stage or reason:
                detail += f" ({stage}/{reason})"
        usage = getattr(error, "usage", {}) or {}
        return Trial(False, detail, elapsed, usage.get("output_tokens"))
    except Exception as error:  # noqa: BLE001 - a probe should never abort the run
        return Trial(False, f"UNEXPECTED:{type(error).__name__}", time.monotonic() - started)
    elapsed = time.monotonic() - started
    questions = result.result.get("questions", [])
    return Trial(True, f"valid ({len(questions)}q)", elapsed, result.usage.get("output_tokens"))


async def run(models: list[str], trials: int, count: int, notes: str) -> list[ModelResult]:
    base = Settings()
    results: list[ModelResult] = []
    async with ProbeClient(timeout=httpx.Timeout(120, connect=5), trust_env=False) as client:
        for model in models:
            mr = ModelResult(model)
            print(f"-> {model}", flush=True)
            for i in range(1, trials + 1):
                trial = await one_trial(client, base, model, count, notes)
                mr.trials.append(trial)
                flag = "PASS" if trial.ok else "FAIL"
                print(
                    f"   trial {i}/{trials}: [{flag}] {trial.detail} ({trial.elapsed_s:.1f}s)",
                    flush=True,
                )
                if client.blocked:
                    print(
                        "Stopping remaining trials/models: shared gateway failure.",
                        flush=True,
                    )
                    break
            print(f"   => {mr.passes}/{mr.total} passed ({mr.rate_label})", flush=True)
            results.append(mr)
            if client.blocked:
                break
    return results


def render_markdown(results: list[ModelResult], trials: int, count: int, notes_info: str) -> str:
    stamp = datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    ordered = sorted(results, key=lambda r: (-r.pass_rate, r.avg_elapsed))
    lines = [
        "# Quiz-generation model comparison",
        "",
        f"Generated: {stamp}",
        "",
        f"Live probe: each model received the application's real quiz-generation "
        f"instruction and identical notes ({notes_info}), requested up to {trials} times, "
        f"validated through the backend's own `generate_quiz` pipeline (fence "
        f"stripping, strict JSON parsing, and `validate_quiz`) with "
        f"question_count={count}. PASS = output parsed as strict JSON and "
        f"satisfied the quiz feature schema.",
        "",
        "Notes are extracted from a sample DOCX through the backend's real "
        "`extract_docx()`, so the input matches what a teacher upload produces.",
        "",
        "Repetition is deliberate: the failure mode is non-deterministic, so the "
        "pass rate over several trials is the signal, not any single call.",
        "",
        "| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |",
        "| --- | ---: | ---: | ---: | --- |",
    ]
    for r in ordered:
        lines.append(
            f"| `{r.model}` | {r.rate_label} | {r.passes}/{r.total} | "
            f"{r.avg_elapsed:.1f} | {r.failure_breakdown()} |"
        )
    lines += [
        "",
        "Failure breakdown shows the backend error code and failing stage/reason "
        "(e.g. `AI_INVALID_OUTPUT (output_json/invalid_json_syntax)` means the model "
        "returned text that was not strict JSON) with its occurrence count.",
        "",
    ]
    lines += [
        "",
        "Counts show attempted trials only. A BATCH BLOCKED entry stops new work; skipped models/features are not model failures. An infrastructure-blocked run is not a valid model-quality comparison.",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Live quiz-model comparison probe.")
    parser.add_argument(
        "--allow-live-requests",
        action="store_true",
        required=True,
        help="Explicitly allow metered SoCLaaS calls (len(models) x trials).",
    )
    parser.add_argument(
        "--models",
        nargs="*",
        default=None,
        help="Override the model set. Default: auto-discover distinct chat models.",
    )
    parser.add_argument("--trials", type=int, default=5, help="Runs per model (default 5).")
    parser.add_argument("--question-count", type=int, default=3)
    parser.add_argument(
        "--notes-file",
        default=DEFAULT_NOTES_DOCX,
        help="DOCX to extract as notes (default: workflow/live-api-testing/sample-notes.docx).",
    )
    parser.add_argument("--out", default="../workflow/live-api-testing/model-comparison.md")
    args = parser.parse_args()
    if args.trials < 1:
        parser.error("--trials must be positive")

    base = Settings()
    if not base.soclaas_api_key.get_secret_value().strip():
        raise SystemExit("SOCLAAS_API_KEY is empty. Configure backend/.env before probing.")

    if not os.path.exists(args.notes_file):
        raise SystemExit(
            f"Notes DOCX not found: {args.notes_file}. "
            "Generate it with: uv run python workflow/live-api-testing/make_sample_docx.py"
        )
    notes = load_notes(args.notes_file)
    notes_info = f"{len(notes.split())} words from {os.path.basename(args.notes_file)}"
    print(f"Notes: {notes_info} ({len(notes)} chars)")

    if args.models:
        models = args.models
        print(f"Using {len(models)} model(s) from --models.")
    else:
        models = discover_models(base)
        print(f"Auto-discovered {len(models)} distinct chat models: {', '.join(models)}")

    budget = len(models) * args.trials
    print(f"Budget: {len(models)} models x {args.trials} trials = {budget} metered calls\n")

    results = asyncio.run(run(models, args.trials, args.question_count, notes))
    markdown = render_markdown(results, args.trials, args.question_count, notes_info)
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(markdown)

    print(f"\nWrote {args.out}\n")
    print("Summary (best first):")
    for r in sorted(results, key=lambda r: (-r.pass_rate, r.avg_elapsed)):
        print(f"  {r.model:<20} {r.rate_label}  ({r.passes}/{r.total})  {r.avg_elapsed:.1f}s avg")

    if any(r.blocked for r in results):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
