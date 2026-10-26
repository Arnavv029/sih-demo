"""GeminiProvider — default hosted LLM provider using google-genai."""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import AsyncIterator

from google import genai
from google.genai import errors

logger = logging.getLogger(__name__)


class GeminiProvider:
    """LLMProvider implementation backed by Google Gemini via google-genai.

    Uses the same ``genai.Client`` pattern as ``app.py``.  The model name
    is resolved from the ``GEMINI_MODEL`` env var, falling back to the
    production default.  The client is initialised lazily so that unit tests
    that never call ``generate`` do not require a live API key.
    """

    name: str = "gemini"

    #: Primary model to try first, then fallbacks in order.
    _DEFAULT_MODEL = "gemini-3.8-flash"
    #: Tried in order when the primary model is unavailable (404/429/503).
    #: Override with GEMINI_FALLBACK_MODELS=model1,model2
    _FALLBACK_MODELS: list[str] = ["gemini-3.6-flash"]

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
    ) -> None:
        resolved_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not resolved_key:
            raise RuntimeError(
                "GeminiProvider requires GOOGLE_API_KEY to be set "
                "(or passed as api_key)."
            )
        self._client = genai.Client(api_key=resolved_key)
        self._model = model_name or os.getenv("GEMINI_MODEL") or self._DEFAULT_MODEL
        extra = os.getenv("GEMINI_FALLBACK_MODELS")
        if extra is not None:
            self._FALLBACK_MODELS = [m.strip() for m in extra.split(",") if m.strip()]

    async def generate(
        self,
        prompt: str,
        *,
        timeout_s: float = 30.0,
        stream: bool = False,
    ) -> AsyncIterator[str]:
        """Yield text tokens from Gemini.

        Parameters
        ----------
        prompt:
            The fully assembled prompt string to send to the model.
        timeout_s:
            Maximum seconds for the complete response, including streamed
            chunks and fallback attempts. Raises ``asyncio.TimeoutError`` on
            breach.
        stream:
            When *True*, reads the streaming API and yields its text chunks
            once the response completes. When *False*, yields the complete
            response text as a single chunk.

        Yields
        ------
        str
        One or more text fragments. Streaming fragments are buffered until
        completion so failed attempts cannot leak partial text into a retry.

        Raises
        ------
        asyncio.TimeoutError
            If the provider does not respond within *timeout_s* seconds.
        RuntimeError
            If the provider returns a non-retryable API error.
        """
        return self._generate_impl(prompt, timeout_s=timeout_s, stream=stream)

    async def _generate_impl(
        self,
        prompt: str,
        *,
        timeout_s: float,
        stream: bool,
    ) -> AsyncIterator[str]:
        """Internal async generator that drives the Gemini API call."""
        models_to_try = [self._model] + [m for m in self._FALLBACK_MODELS if m != self._model]
        loop = asyncio.get_running_loop()
        deadline = loop.time() + timeout_s
        last_error: errors.APIError | None = None
        last_error_model: str | None = None

        for model_index, model in enumerate(models_to_try):
            remaining_s = deadline - loop.time()
            if remaining_s <= 0:
                raise asyncio.TimeoutError(
                    f"GeminiProvider timed out after {timeout_s}s "
                    f"(model={model})."
                )
            # Reserve a fair share of the original deadline for each configured
            # model so a stalled primary does not starve the fallback.
            remaining_attempts = len(models_to_try) - model_index
            attempt_timeout_s = remaining_s / remaining_attempts
            fallback_available = model_index < len(models_to_try) - 1
            attempt_started = time.perf_counter()
            try:
                if stream:
                    tokens = [
                        token async for token in self._stream(prompt, model, attempt_timeout_s)
                    ]
                else:
                    tokens = [await self._complete(prompt, model, attempt_timeout_s)]
                logger.info(
                    "gemini.request status=ok model=%s duration_ms=%d",
                    model,
                    round((time.perf_counter() - attempt_started) * 1000),
                )
                for token in tokens:
                    yield token
                return  # success — stop trying fallbacks

            except errors.APIError as exc:
                logger.warning(
                    "gemini.request status=api_error model=%s http_status=%s duration_ms=%d fallback_available=%s",
                    model,
                    exc.code,
                    round((time.perf_counter() - attempt_started) * 1000),
                    exc.code in (404, 429, 503) and fallback_available,
                )
                if exc.code in (404, 429, 503):
                    # Model not found / service unavailable — try next fallback.
                    last_error = exc
                    last_error_model = model
                    continue
                # Non-retryable API error
                raise RuntimeError(
                    f"GeminiProvider API error (model={model}, "
                    f"code={exc.code}): {exc.message}"
                ) from exc
            except asyncio.TimeoutError:
                logger.log(
                    logging.WARNING if fallback_available else logging.ERROR,
                    "gemini.request status=timeout model=%s attempt_timeout_s=%.3f duration_ms=%d fallback_available=%s",
                    model,
                    attempt_timeout_s,
                    round((time.perf_counter() - attempt_started) * 1000),
                    fallback_available,
                )
                if fallback_available:
                    continue
                raise asyncio.TimeoutError(
                    f"GeminiProvider timed out after {timeout_s}s "
                    f"(model={model})."
                )
            except Exception as exc:
                logger.error(
                    "gemini.request status=transport_error model=%s duration_ms=%d error_type=%s",
                    model,
                    round((time.perf_counter() - attempt_started) * 1000),
                    type(exc).__name__,
                )
                raise RuntimeError(
                    f"GeminiProvider unexpected error (model={model}): {exc}"
                ) from exc

        # Preserve the final response code; 404 is not a capacity error.
        raise RuntimeError(
            "GeminiProvider: all model attempts failed. "
            f"Last API error (model={last_error_model}, "
            f"code={last_error.code}): {last_error.message}"
        )

    async def _complete(self, prompt: str, model: str, timeout_s: float) -> str:
        """Non-streaming completion; returns the full response text."""
        response = await asyncio.wait_for(
            self._client.aio.models.generate_content(
                model=model,
                contents=prompt,
            ),
            timeout=timeout_s,
        )
        text = (response.text or "").strip()
        if not text:
            raise RuntimeError(
                f"Gemini returned an empty response (model={model}); the answer "
                "may have been blocked by a safety filter."
            )
        return text

    async def _stream(
        self, prompt: str, model: str, timeout_s: float
    ) -> AsyncIterator[str]:
        """Stream a full response under one deadline, yielding only on completion."""
        async with asyncio.timeout(timeout_s):
            response = await self._client.aio.models.generate_content_stream(
                model=model,
                contents=prompt,
            )
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
