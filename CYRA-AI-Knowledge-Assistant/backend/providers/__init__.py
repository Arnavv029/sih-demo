"""LLM provider abstraction for the RAG PDF Chatbot.

Public surface
--------------
- ``LLMProvider`` — structural ``Protocol`` that every provider must satisfy.
- ``GeminiProvider`` — default hosted provider (Google Gemini via google-genai).
- ``get_provider(name)`` — factory that returns the configured provider instance.

Usage
-----
    from backend.providers import get_provider

    provider = get_provider("gemini")           # uses GOOGLE_API_KEY env var
    async for token in await provider.generate(prompt, timeout_s=30, stream=True):
        print(token, end="", flush=True)
"""
from __future__ import annotations

import os
from typing import AsyncIterator, Protocol, runtime_checkable

from .gemini import GeminiProvider
from .extractive import ExtractiveRegulatoryProvider


@runtime_checkable
class LLMProvider(Protocol):
    """Structural protocol for all LLM provider implementations."""

    name: str

    async def generate(
        self,
        prompt: str,
        *,
        timeout_s: float,
        stream: bool,
    ) -> AsyncIterator[str]:
        ...  # pragma: no cover


_REGISTRY: dict[str, type[LLMProvider]] = {
    "gemini": GeminiProvider,
    "extractive": ExtractiveRegulatoryProvider,
}


def get_provider(name: str | None = None) -> LLMProvider:
    resolved = (name or os.getenv("LLM_PROVIDER", "")).lower().strip()
    if not resolved:
        has_key = bool(os.getenv("GOOGLE_API_KEY") and os.getenv("GOOGLE_API_KEY") not in {"your_gemini_api_key_here", "changeme", ""})
        resolved = "gemini" if has_key else "extractive"

    provider_cls = _REGISTRY.get(resolved)
    if provider_cls is None:
        resolved = "extractive"
        provider_cls = ExtractiveRegulatoryProvider

    try:
        return provider_cls()
    except Exception:
        return ExtractiveRegulatoryProvider()


__all__ = [
    "LLMProvider",
    "GeminiProvider",
    "ExtractiveRegulatoryProvider",
    "get_provider",
]

