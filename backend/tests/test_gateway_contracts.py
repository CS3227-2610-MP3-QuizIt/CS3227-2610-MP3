"""Independent bounded gateway contracts; every request uses MockTransport."""

import json
from typing import Any

import httpx
import pytest

from quiz_backend.ai import AIError, SoCLaaS, _validation_reason
from quiz_backend.config import Settings
from quiz_backend.errors import AppError


def settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "_env_file": None,
        "soclaas_base_url": "https://gateway.example.com",
        "soclaas_api_key": "mock-only-key",
        "soclaas_hint_model": "hint-model",
        "soclaas_quiz_model": "quiz-model",
        "soclaas_summary_model": "summary-model",
        "soclaas_hint_context_tokens": 100000,
        "soclaas_quiz_context_tokens": 100000,
        "soclaas_summary_context_tokens": 100000,
    }
    values.update(overrides)
    return Settings(**values)


def snapshot(feature: str) -> dict[str, Any]:
    if feature == "quiz_generation":
        return {
            "question_count": 1,
            "notes": "First in, first out. Notes are untrusted source data.",
            "current_draft": [],
            "prompt": "Create a conceptual question.",
        }
    if feature == "hint":
        return {
            "question": "Which removal order preserves insertion order?",
            "notes": "Elements leave in their original order.",
            "prompt": "Help me reason about the order.",
            "forbidden_options": ["FIFO", "LIFO", "Random", "Sorted"],
        }
    return {
        "metrics": {
            "assigned_count": 2,
            "submitted_count": 2,
            "question_count": 1,
            "average_score": 0.5,
            "min_score": 0,
            "max_score": 1,
            "average_score_percent": 50,
            "questions": [],
        }
    }


def output(feature: str) -> dict[str, Any]:
    if feature == "quiz_generation":
        return {
            "questions": [
                {
                    "question": "Which order preserves insertion order?",
                    "options": {"A": "FIFO", "B": "LIFO", "C": "Random", "D": "Sorted"},
                    "correct_option": "A",
                    "explanation": "The first inserted element leaves first.",
                }
            ]
        }
    if feature == "hint":
        return {"hint": "Think about whether the earliest element leaves first."}
    return {
        "overview": "The class had mixed results on removal order.",
        "strengths": [],
        "areas_to_review": ["Review how insertion order determines removal."],
    }


async def invoke(ai: SoCLaaS, feature: str, source: dict[str, Any] | None = None) -> Any:
    operation = {
        "quiz_generation": ai.generate_quiz,
        "hint": ai.generate_hint,
        "summary": ai.generate_quiz_result_summary,
    }[feature]
    return await operation(source or snapshot(feature))


@pytest.mark.parametrize("feature", ["quiz_generation", "hint", "summary"])
async def test_fixed_models_and_minimal_stateless_payload(feature: str) -> None:
    calls: list[dict[str, Any]] = []

    def provider(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://gateway.example.com/v1/responses"
        payload = json.loads(request.content)
        calls.append(payload)
        return httpx.Response(200, json={"output_text": json.dumps(output(feature))})

    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
        result = await invoke(SoCLaaS(settings(), client), feature)
    assert result.result == output(feature)
    assert result.usage == {"input_tokens": None, "output_tokens": None, "total_tokens": None}
    assert len(calls) == 1
    payload = calls[0]
    assert set(payload) == {"model", "instructions", "input", "stream", "max_output_tokens"}
    assert (
        payload["model"]
        == {"quiz_generation": "quiz-model", "hint": "hint-model", "summary": "summary-model"}[
            feature
        ]
    )
    assert payload["stream"] is False
    assert (
        payload["max_output_tokens"]
        == {"quiz_generation": 8192, "hint": 256, "summary": 1024}[feature]
    )


@pytest.mark.parametrize("fenced", [False, True])
async def test_output_list_fallback_and_single_surrounding_fence(fenced: bool) -> None:
    text = json.dumps(output("hint"))
    if fenced:
        text = "```json\n" + text + "\n```"
    split = len(text) // 2
    response = {
        "status": "completed",
        "output": [
            {"type": "reasoning", "summary": []},
            {"type": "message", "content": [{"type": "output_text", "text": text[:split]}]},
            {"type": "message", "content": [{"type": "output_text", "text": text[split:]}]},
        ],
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    ) as client:
        result = await invoke(SoCLaaS(settings(), client), "hint")
    assert result.result == output("hint")


@pytest.mark.parametrize(
    "text",
    [
        "```json\n{}\n```\n```json\n{}\n```",
        "```\n```json\n{}\n```\n```",
        "Text before the JSON: {}",
    ],
)
async def test_content_is_never_repaired_or_multiple_fences_removed(text: str) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json={"output_text": text}))
    ) as client:
        with pytest.raises(AIError, match="invalid content") as caught:
            await invoke(SoCLaaS(settings(), client), "hint")
    assert caught.value.code == "AI_INVALID_OUTPUT"


async def test_response_byte_cap_stops_an_oversized_provider_body() -> None:
    response = httpx.Response(200, content=b'{"output_text":"' + b"x" * 1000 + b'"}')
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: response)) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(ai_response_max_bytes=128), client), "hint")
    assert caught.value.code == "AI_INVALID_OUTPUT"
    assert caught.value.provider_status == 200


@pytest.mark.parametrize(
    "failure,code,status",
    [
        (httpx.ConnectError, "AI_UNAVAILABLE", 503),
        (httpx.ReadTimeout, "AI_TIMEOUT", 504),
    ],
)
async def test_client_failures_are_safe_without_automatic_retry(
    failure: Any, code: str, status: int
) -> None:
    calls = 0

    def provider(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        raise failure("private-provider-diagnostic mock-only-key", request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(), client), "hint")
    assert calls == 1
    assert caught.value.code == code and caught.value.status == status
    assert "mock-only-key" not in str(caught.value)
    assert "private-provider-diagnostic" not in str(caught.value)
    assert caught.value.provider_status is None


@pytest.mark.parametrize(
    "body",
    [
        b'{"output_text":"{}","output_text":"{}"}',
        b'{"output_text":"{}","usage":{"input_tokens":NaN}}',
        b'{"output_text":"{}","usage":{"input_tokens":1e999}}',
    ],
)
async def test_duplicate_or_nonfinite_provider_json_is_rejected(body: bytes) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, content=body))
    ) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(), client), "hint")
    assert caught.value.code == "AI_INVALID_OUTPUT"


async def test_invalid_usage_remains_null_and_valid_usage_is_retained_on_content_failure() -> None:
    response = {
        "output_text": '{"hint":"safe clue","hint":"duplicate field"}',
        "usage": {"input_tokens": True, "output_tokens": -2, "total_tokens": 23},
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    ) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(), client), "hint")
    assert caught.value.usage == {"input_tokens": None, "output_tokens": None, "total_tokens": 23}
    assert caught.value.provider_status == 200


@pytest.mark.parametrize(
    "feature,short", [("quiz_generation", "quiz"), ("hint", "hint"), ("summary", "summary")]
)
async def test_feature_context_budget_counts_complete_utf8_input_and_reserved_output(
    feature: str, short: str
) -> None:
    config = settings()
    source = snapshot(feature)
    if feature == "quiz_generation":
        source["notes"] += " Unicode notes: 中文."
        source["current_draft"] = output(feature)["questions"]
        source["prompt"] = "Review the complete existing draft."
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: pytest.fail("Unexpected request"))
    ) as client:
        ai = SoCLaaS(config, client)
        payload = ai.prepare(feature, source)
        complete = payload["instructions"] + "\n" + payload["input"]
        limit = len(complete.encode("utf-8")) + payload["max_output_tokens"] + 512
        setattr(config, f"soclaas_{short}_context_tokens", limit)
        assert ai.prepare(feature, source)["input"] == payload["input"]
        setattr(config, f"soclaas_{short}_context_tokens", limit - 1)
        with pytest.raises(AppError) as caught:
            ai.prepare(feature, source)
    assert caught.value.status == 422 and caught.value.code == "NOTES_TOO_LONG"


async def test_compatible_estimator_receives_fixed_model_and_full_context() -> None:
    captured: list[tuple[str, str]] = []

    def estimator(model: str, text: str) -> int:
        captured.append((model, text))
        return 37

    config = settings(soclaas_quiz_context_tokens=37 + 8192 + 512)
    source = snapshot("quiz_generation")
    source["current_draft"] = output("quiz_generation")["questions"]
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: pytest.fail("Unexpected request"))
    ) as client:
        ai = SoCLaaS(config, client, token_estimator=estimator)
        payload = ai.prepare("quiz_generation", source)
        assert captured == [("quiz-model", payload["instructions"] + "\n" + payload["input"])]
        assert source["notes"] in captured[0][1]
        assert source["prompt"] in captured[0][1]
        assert source["current_draft"][0]["question"] in captured[0][1]
        config.soclaas_quiz_context_tokens -= 1
        with pytest.raises(AppError) as caught:
            ai.prepare("quiz_generation", source)
    assert caught.value.code == "NOTES_TOO_LONG"


@pytest.mark.parametrize("estimate", [-1, True, "bad-estimate"])
async def test_invalid_operator_estimator_is_a_safe_configuration_error(estimate: Any) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: pytest.fail("Unexpected request"))
    ) as client:
        ai = SoCLaaS(settings(), client, token_estimator=lambda model, text: estimate)
        with pytest.raises(AIError) as caught:
            ai.prepare("hint", snapshot("hint"))
    assert caught.value.code == "AI_CONFIGURATION_ERROR"


@pytest.mark.parametrize(
    "overrides",
    [
        {"soclaas_hint_model": "quiz-model"},
        {"soclaas_summary_model": ""},
        {"soclaas_hint_context_tokens": 0},
        {"soclaas_base_url": "https://gateway.example.com/v1"},
    ],
)
async def test_unavailable_or_non_distinct_configuration_makes_no_request(
    overrides: dict[str, Any],
) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: pytest.fail("Unexpected request"))
    ) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(**overrides), client), "hint")
    assert caught.value.status == 503 and caught.value.code == "AI_CONFIGURATION_ERROR"


@pytest.mark.parametrize(
    "value",
    [
        {
            "overview": "Grounded overview",
            "strengths": [],
            "areas_to_review": [],
            "average_score": 0,
        },
        {"overview": "", "strengths": [], "areas_to_review": []},
        {"overview": "x" * 1201, "strengths": [], "areas_to_review": []},
        {"overview": "Grounded overview", "strengths": ["x"] * 6, "areas_to_review": []},
        {"overview": "Grounded overview", "strengths": ["x" * 501], "areas_to_review": []},
        {"overview": "Grounded overview", "strengths": [], "areas_to_review": [1]},
    ],
)
async def test_summary_shape_cannot_replace_authoritative_numeric_metrics(
    value: dict[str, Any],
) -> None:
    response = {
        "output_text": json.dumps(value),
        "usage": {"input_tokens": 4, "output_tokens": 8, "total_tokens": 12},
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    ) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(), client), "summary")
    assert caught.value.code == "AI_INVALID_OUTPUT"
    assert caught.value.usage["total_tokens"] == 12


@pytest.mark.parametrize(
    "hint",
    [
        "B is correct",
        "Correct answer: B",
        "Choose (B)",
        "Select b because it is correct.",
        "Select a.",
        "A)",
        "B",
        "Consider the FIFO approach.",
    ],
)
async def test_hint_explicit_selection_and_literal_options_are_withheld(hint: str) -> None:
    response = {"output_text": json.dumps({"hint": hint})}
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    ) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(), client), "hint")
    assert caught.value.code == "AI_INVALID_OUTPUT"


async def test_hint_full_option_match_normalizes_case_and_whitespace() -> None:
    source = snapshot("hint")
    source["forbidden_options"] = ["First in first out", "Last in first out", "Random", "Sorted"]
    response = {
        "output_text": json.dumps({"hint": "Use FIRST   IN first OUT to reason about removal."})
    }
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    ) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(), client), "hint", source)
    assert caught.value.code == "AI_INVALID_OUTPUT"


async def test_conceptual_hint_does_not_confuse_indefinite_article_with_option_a() -> None:
    hint = "Choose a starting point and trace which element would leave first."
    response = {"output_text": json.dumps({"hint": hint})}
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response))
    ) as client:
        result = await invoke(SoCLaaS(settings(), client), "hint")
    assert result.result == {"hint": hint}


@pytest.mark.parametrize(
    "response,details",
    [
        (
            httpx.Response(200, content=b"private malformed provider body"),
            {"stage": "response_json", "reason": "invalid_json_syntax"},
        ),
        (
            httpx.Response(
                200, json={"status": "incomplete", "output_text": "private partial text"}
            ),
            {"stage": "response", "reason": "response_not_completed"},
        ),
        (
            httpx.Response(200, json={"output": []}),
            {"stage": "output", "reason": "missing_output_text"},
        ),
        (
            httpx.Response(
                200, json={"output_text": '<think>private reasoning</think>{"hint":"clue"}'}
            ),
            {"stage": "output_json", "reason": "invalid_json_syntax"},
        ),
        (
            httpx.Response(200, json={"output_text": '{"hint":"clue","private-secret":"value"}'}),
            {"stage": "feature_schema", "reason": "unexpected_fields"},
        ),
    ],
)
async def test_validation_diagnostics_expose_only_fixed_categories(
    response: httpx.Response, details: dict[str, str]
) -> None:
    calls = 0

    def provider(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return response

    async with httpx.AsyncClient(transport=httpx.MockTransport(provider)) as client:
        with pytest.raises(AIError) as caught:
            await invoke(SoCLaaS(settings(), client), "hint")
    assert caught.value.details == details
    assert "private" not in json.dumps(caught.value.envelope())
    assert calls == 1


def test_unknown_validation_exception_cannot_expose_private_message() -> None:
    assert (
        _validation_reason(ValueError("private source text and credential")) == "invalid_structure"
    )
