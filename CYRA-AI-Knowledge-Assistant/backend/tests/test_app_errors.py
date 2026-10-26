"""Tests for safe API error messages exposed to chat clients."""

from backend.app import _public_generation_error


def test_model_not_found_is_not_reported_as_capacity_error():
    message = (
        "GeminiProvider: all model attempts failed. "
        "Last API error (model=gemini-custom, code=404): model not found"
    )

    assert _public_generation_error(message) == (
        "Gemini could not find one of the configured models. Check GEMINI_MODEL "
        "and GEMINI_FALLBACK_MODELS in .env against the models available to your "
        "Gemini API key, then restart the backend."
    )


def test_capacity_error_keeps_existing_user_message():
    assert _public_generation_error(
        "GeminiProvider: all model attempts failed. "
        "Last API error (model=gemini-custom, code=429): quota exceeded"
    ) == (
        "Gemini is temporarily unavailable or over quota. "
        "Please wait a moment and try again."
    )


def test_service_unavailable_is_distinguished_from_quota():
    assert _public_generation_error(
        "GeminiProvider: all model attempts failed. "
        "Last API error (model=gemini-custom, code=503): high demand"
    ) == (
        "Gemini is temporarily experiencing high demand. "
        "Please wait a moment and try again."
    )


def test_authentication_error_keeps_safe_key_guidance():
    assert _public_generation_error(
        "GeminiProvider API error (model=gemini-custom, code=403): permission denied"
    ) == (
        "Gemini rejected the request. Check that GOOGLE_API_KEY in .env is a valid "
        "key, then restart the backend."
    )


def test_timeout_error_gives_action_without_claiming_http_status():
    message = _public_generation_error("Answer generation timed out after 60.0 seconds.")
    assert "did not respond" in message
    assert "try again" in message
    assert "timing logs" in message
