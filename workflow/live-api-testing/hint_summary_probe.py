"""Live reliability probe for the hint and summary AI surfaces.

Companion to model_comparison_probe.py (which covers quiz generation). This
measures how reliably each chat model produces usable output for the other two
application AI features, using the backend's real pipelines:

  * hint    -> SoCLaaS.generate_hint  (TWO gateway calls: candidate + private
               verification). A result is only "usable" when verification
               approves it.
  * summary -> SoCLaaS.generate_quiz_result_summary  (single call over
               anonymous aggregate metrics, no notes).

NOT part of the automated test suite: pytest/npm test mock SoCLaaS and never
make live calls. This script makes real, metered calls, so run it explicitly.

IMPORTANT call-budget note: one hint trial = TWO gateway calls (candidate +
verification). So the hint budget is len(models) x trials x 2 calls; summary is
len(models) x trials x 1 call.

A hint "failure" is not necessarily a model-reliability problem: the verifier
may legitimately reject a leaking or irrelevant candidate. The breakdown
separates verification rejections from parse/schema/infra failures so you can
tell them apart.

Run from backend/ so quiz_backend and backend/.env resolve:

    cd backend
    uv run python ../workflow/live-api-testing/hint_summary_probe.py --allow-live-requests

Optional:
    --features hint summary          # default: both
    --models qwen3.6:35b llama3.1:8b # default: auto-discover distinct chat models
    --trials 5                       # runs per (feature, model); default 5
    --out ../workflow/live-api-testing/hint-summary-comparison.md
"""

from __future__ import annotations

import argparse
import asyncio
import datetime
import os
import statistics
import sys
import time
from collections import Counter
from dataclasses import dataclass, field

import httpx

# Make sibling probe modules importable regardless of the current directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Reuse the exact discovery logic from the quiz probe so the model set matches.
from model_comparison_probe import discover_models
from probe_diagnostics import ProbeClient
from quiz_backend.ai import AIError, SoCLaaS
from quiz_backend.config import Settings

# Curated candidate shortlist for hint/summary, chosen from the quiz-probe
# evidence (workflow/live-api-testing/model-comparison.md) and catalog pricing. We keep capable
# general-instruct models and drop coder/vision/weak/unstable ones. Hint and
# summary schemas are simpler than quiz, so a model that struggled only on the
# strict quiz schema (e.g. llama3.1:8b, gemma4:26b) still earns a fair test here.
#   qwen3.6:35b  - 100% quiz, fastest; strongest general model
#   gemma4:26b   - cheap general instruct; quiz fails were quiz-schema specific
#   llama3.1:8b  - cheapest/fast; fair chance on the simpler hint/summary schema
#   ornith1.5:35b- 80% quiz, capable general model
#   x-test-1     - 100% quiz, reasonable latency
# Dropped: qwen3.8:27b & qwen3-coder-next (coder drift), qwen3-vl:32b (slow,
# timeouts), qwen3.5:9b (weak), x-test-2/x-test-3 (unstable upstream errors).
CANDIDATE_MODELS = [
    "qwen3.6:35b",
    "gemma4:26b",
    "llama3.1:8b",
    "ornith1.5:35b",
    "x-test-1",
]

# Fixed, identical inputs for every model and trial.
HINT_SNAPSHOT = {
    "question": "Which organelle is primarily responsible for photosynthesis in plant cells?",
    "notes": (
        "Photosynthesis occurs in the chloroplast, an organelle containing stacked "
        "thylakoid membranes surrounded by a fluid stroma. Pigments such as chlorophyll "
        "absorb light. Mitochondria, by contrast, are the site of cellular respiration."
    ),
    "prompt": "Give a conceptual clue without stating the answer.",
    # Private answer context (used only by the verification call, never the candidate call):
    "options": {
        "A": "Mitochondrion",
        "B": "Chloroplast",
        "C": "Ribosome",
        "D": "Golgi apparatus",
    },
    "correct_option": "B",
    "explanation": "Chloroplasts contain chlorophyll and are the site of photosynthesis.",
}

SUMMARY_SNAPSHOT = {
    "metrics": {
        "assigned_count": 10,
        "submitted_count": 10,
        "question_count": 3,
        "average_score": 2.1,
        "min_score": 1,
        "max_score": 3,
        "average_score_percent": 70,
        "questions": [
            {
                "position": 1,
                "correct_count": 9,
                "option_counts": {"A": 1, "B": 9, "C": 0, "D": 0},
            },
            {
                "position": 2,
                "correct_count": 6,
                "option_counts": {"A": 2, "B": 1, "C": 6, "D": 1},
            },
            {
                "position": 3,
                "correct_count": 6,
                "option_counts": {"A": 6, "B": 1, "C": 2, "D": 1},
            },
        ],
    }
}


@dataclass
class Trial:
    ok: bool
    detail: str
    elapsed_s: float


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

    def breakdown(self) -> str:
        reasons = Counter(t.detail for t in self.trials if not t.ok)
        if not reasons:
            return "-"
        return "; ".join(f"{detail} x{n}" for detail, n in reasons.most_common())


def settings_for(base: Settings, feature: str, model: str) -> Settings:
    """A Settings copy whose model for `feature` is the candidate (context clamped to fit all)."""
    data = base.model_dump()
    field = {"hint": "soclaas_hint_model", "summary": "soclaas_summary_model"}[feature]
    ctx = {
        "hint": "soclaas_hint_context_tokens",
        "summary": "soclaas_summary_context_tokens",
    }[feature]
    data[field] = model
    data[ctx] = min(getattr(base, ctx) or 65536, 65536)
    return Settings(**data)


async def one_trial(client: httpx.AsyncClient, base: Settings, feature: str, model: str) -> Trial:
    ai = SoCLaaS(settings_for(base, feature, model), client)
    started = time.monotonic()
    if isinstance(client, ProbeClient):
        client.begin_trial()
    try:
        if feature == "hint":
            await ai.generate_hint(dict(HINT_SNAPSHOT))
        else:
            await ai.generate_quiz_result_summary(dict(SUMMARY_SNAPSHOT))
    except AIError as error:
        elapsed = time.monotonic() - started
        detail = client.describe_error(error) if isinstance(client, ProbeClient) else error.code
        if isinstance(error.details, dict):
            stage = error.details.get("stage", "")
            reason = error.details.get("reason", "")
            if stage or reason:
                detail += f" ({stage}/{reason})"
        return Trial(False, detail, elapsed)
    except Exception as error:  # noqa: BLE001 - a probe should never abort the run
        return Trial(False, f"UNEXPECTED:{type(error).__name__}", time.monotonic() - started)
    return Trial(True, "usable", time.monotonic() - started)


async def probe_model(
    client: httpx.AsyncClient,
    base: Settings,
    feature: str,
    model: str,
    trials: int,
    gate: asyncio.Semaphore,
) -> ModelResult:
    """Run all trials for one model (sequentially within the model), gated for concurrency."""
    async with gate:
        mr = ModelResult(model)
        for _ in range(trials):
            if isinstance(client, ProbeClient) and client.blocked:
                break
            mr.trials.append(await one_trial(client, base, feature, model))
        if not mr.total:
            print(f"   [{feature}] {model}: SKIPPED (shared gateway failure)", flush=True)
            return mr
        print(
            f"   [{feature}] {model:<20} {mr.passes}/{mr.total} "
            f"({mr.rate_label})  {mr.avg_elapsed:.1f}s avg  {mr.breakdown()}",
            flush=True,
        )
        return mr


async def run(
    features: list[str], models: list[str], trials: int, concurrency: int
) -> dict[str, list[ModelResult]]:
    base = Settings()
    out: dict[str, list[ModelResult]] = {}
    gate = asyncio.Semaphore(concurrency)
    async with ProbeClient(timeout=httpx.Timeout(300, connect=5), trust_env=False) as client:
        for feature in features:
            print(
                f"\n==== feature: {feature} (up to {concurrency} models in parallel) ====",
                flush=True,
            )
            tasks = [probe_model(client, base, feature, model, trials, gate) for model in models]
            # Preserve input model order in results regardless of completion order.
            out[feature] = [result for result in await asyncio.gather(*tasks) if result.total]
            if client.blocked:
                print(
                    "Stopping remaining trials/features: shared gateway failure. Already in-flight trials may finish.",
                    flush=True,
                )
                break
    return out


def render_markdown(data: dict[str, list[ModelResult]], trials: int) -> str:
    stamp = datetime.datetime.now(datetime.UTC).isoformat(timespec="seconds")
    lines = [
        "# Hint and summary model reliability",
        "",
        f"Generated: {stamp}",
        "",
        f"Live probe: each model ran the backend's real `generate_hint` (two gateway "
        f"calls: candidate + private verification) or `generate_quiz_result_summary` "
        f"(single call over anonymous aggregate metrics), requested up to {trials} times. "
        f"PASS = the pipeline returned a usable result (for hints, the verifier "
        f"approved the candidate).",
        "",
        "A hint FAIL may be a legitimate verification rejection "
        "(`AI_INVALID_OUTPUT (hint_verification/...)`) rather than a reliability "
        "problem; the breakdown distinguishes those from parse/schema/infra failures.",
    ]
    for feature, results in data.items():
        ordered = sorted(results, key=lambda r: (-r.pass_rate, r.avg_elapsed))
        lines += [
            "",
            f"## {feature}",
            "",
            "| Model | Pass rate | Passes | Avg time (s) | Failure breakdown |",
            "| --- | ---: | ---: | ---: | --- |",
        ]
        for r in ordered:
            lines.append(
                f"| `{r.model}` | {r.rate_label} | {r.passes}/{r.total} | "
                f"{r.avg_elapsed:.1f} | {r.breakdown()} |"
            )
    lines.append("")
    lines += [
        "",
        "Counts show attempted trials only. A BATCH BLOCKED entry stops new work; skipped models/features are not model failures. An infrastructure-blocked run is not a valid model-quality comparison.",
    ]
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Live hint/summary reliability probe.")
    parser.add_argument(
        "--allow-live-requests",
        action="store_true",
        required=True,
        help="Explicitly allow metered SoCLaaS calls. Hint = 2 calls/trial, summary = 1.",
    )
    parser.add_argument(
        "--features",
        nargs="*",
        default=["hint", "summary"],
        choices=["hint", "summary"],
    )
    parser.add_argument(
        "--models",
        nargs="*",
        default=None,
        help="Override models. Default: a curated candidate shortlist (see CANDIDATE_MODELS).",
    )
    parser.add_argument(
        "--all-models",
        action="store_true",
        help="Probe every distinct chat model instead of the curated shortlist.",
    )
    parser.add_argument("--trials", type=int, default=5)
    parser.add_argument(
        "--concurrency",
        type=int,
        default=2,
        help="Max models probed in parallel (default 2; keep low to respect the "
        "gateway capacity; retained-conversation expiry is operator-managed).",
    )
    parser.add_argument("--out", default="../workflow/live-api-testing/hint-summary-comparison.md")
    args = parser.parse_args()
    if args.trials < 1 or args.concurrency < 1:
        parser.error("--trials and --concurrency must be positive")

    base = Settings()
    if not base.soclaas_api_key.get_secret_value().strip():
        raise SystemExit("SOCLAAS_API_KEY is empty. Configure backend/.env before probing.")
    if args.models:
        models = args.models
        print(f"Using {len(models)} model(s) from --models.")
    elif args.all_models:
        models = discover_models(base)
        print(f"Auto-discovered {len(models)} distinct chat models: {', '.join(models)}")
    else:
        models = CANDIDATE_MODELS
        print(f"Using curated shortlist of {len(models)} candidate models: {', '.join(models)}")

    # Budget: hint costs 2 gateway calls per trial, summary 1.
    per_feature = {"hint": 2, "summary": 1}
    budget = sum(len(models) * args.trials * per_feature[f] for f in args.features)
    print(f"Features: {args.features}")
    print(f"Concurrency: up to {args.concurrency} models in parallel")
    print(f"Budget: ~{budget} metered gateway calls (hint trials cost 2 calls each, summary 1)\n")

    data = asyncio.run(run(args.features, models, args.trials, args.concurrency))
    markdown = render_markdown(data, args.trials)
    with open(args.out, "w", encoding="utf-8") as handle:
        handle.write(markdown)

    print(f"\nWrote {args.out}\n")
    for feature, results in data.items():
        print(f"Summary — {feature} (best first):")
        for r in sorted(results, key=lambda r: (-r.pass_rate, r.avg_elapsed)):
            print(
                f"  {r.model:<20} {r.rate_label}  ({r.passes}/{r.total})  {r.avg_elapsed:.1f}s avg"
            )

    if any(r.blocked for results in data.values() for r in results):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
