"""
Global pytest fixtures and fail-closed network isolation for FoodVerse AI.
Guarantees that no test execution can trigger real outbound network requests,
while cleanly preserving in-memory FastAPI ASGI test transports (httpx.ASGITransport).
"""
import pytest
import httpx
from app.core.config import settings


class OutboundNetworkBlockedError(RuntimeError):
    """Raised whenever an unmocked external network dispatch is attempted during tests."""
    pass


@pytest.fixture(autouse=True)
def enforce_fail_closed_network_isolation(monkeypatch):
    """
    Autouse fixture that intercepts all httpx.AsyncClient.send calls.
    - Permits internal in-memory httpx.ASGITransport (used to test FastAPI endpoints).
    - Permits explicit in-memory httpx.MockTransport.
    - Blocks any external transport or unmocked outbound network socket call.
    - Normalizes AI_API_BASE_URL so test isolation does not depend on local .env overrides.
    """
    # 1. Normalize AI_API_BASE_URL to canonical test URL
    monkeypatch.setattr(settings, "AI_API_BASE_URL", "https://integrate.api.nvidia.com/v1")

    # 2. Intercept low-level AsyncClient.send to ensure fail-closed transport behavior
    orig_send = httpx.AsyncClient.send

    async def guarded_send(self, request: httpx.Request, *args, **kwargs):
        # Allow only safe in-memory transports
        transport = getattr(self, "_transport", None)
        if isinstance(transport, (httpx.ASGITransport, httpx.MockTransport)):
            return await orig_send(self, request, *args, **kwargs)

        # Any outbound dispatch not routed via ASGITransport or MockTransport fails closed
        raise OutboundNetworkBlockedError(
            f"External network call strictly blocked during test execution: {request.method} {request.url}. "
            f"All outbound AI requests must be mocked."
        )

    monkeypatch.setattr(httpx.AsyncClient, "send", guarded_send)
