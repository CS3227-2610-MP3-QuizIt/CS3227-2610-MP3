"""Private live-probe diagnostics; never imported by the product backend.

Only fixed provider error codes are retained. Raw gateway messages, credentials
and generated output never enter the diagnostic summary.
"""

import json
from contextvars import ContextVar

import httpx

_provider_code: ContextVar[str | None] = ContextVar("probe_provider_code", default=None)
_SAFE_CODES = {
    "continuation_limit_exceeded",
    "insufficient_quota",
    "rate_limit_exceeded",
    "invalid_api_key",
    "model_not_found",
    "invalid_request_error",
}


class DiagnosticTransport(httpx.AsyncBaseTransport):
    def __init__(self) -> None:
        self.inner = httpx.AsyncHTTPTransport(trust_env=False)

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        response = await self.inner.handle_async_request(request)
        if not response.is_error:
            return response
        # Error responses are bounded before parsing. Preserve the status and
        # headers for the real backend's existing error normalization.
        body = bytearray()
        try:
            async for chunk in response.aiter_bytes():
                remaining = 16384 - len(body)
                body.extend(chunk[:remaining])
                if len(body) >= 16384:
                    break
        finally:
            await response.aclose()
        try:
            data = json.loads(body)
            error = data.get("error") if isinstance(data, dict) else None
            code = error.get("code") if isinstance(error, dict) else None
            if isinstance(code, str) and code in _SAFE_CODES:
                _provider_code.set(code)
        except ValueError, UnicodeDecodeError, RecursionError:
            pass
        return httpx.Response(response.status_code, headers=response.headers, content=bytes(body))

    async def aclose(self) -> None:
        await self.inner.aclose()


class ProbeClient(httpx.AsyncClient):
    """Share the stop flag; keep each concurrent trial's diagnostics local."""

    def __init__(self, *, timeout: httpx.Timeout, trust_env: bool = False) -> None:
        super().__init__(transport=DiagnosticTransport(), timeout=timeout, trust_env=trust_env)
        self.blocked = False

    def begin_trial(self) -> None:
        _provider_code.set(None)

    def describe_error(self, error: object) -> str:
        code = getattr(error, "code", "AI_ERROR")
        status = getattr(error, "provider_status", None)
        provider_code = _provider_code.get()
        detail = str(code)
        if status is not None:
            detail += f" [HTTP {status}]"
        if provider_code:
            detail += f" [gateway:{provider_code}]"
        if status in {401, 403, 429} or provider_code in {
            "continuation_limit_exceeded",
            "insufficient_quota",
            "invalid_api_key",
        }:
            self.blocked = True
            detail += " [BATCH BLOCKED: quota/configuration; not a model-quality result]"
        return detail
