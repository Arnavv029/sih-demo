"""Deterministic replies for standalone greetings and brief small talk."""
from __future__ import annotations

import re
import unicodedata


_REPLIES = {
    "hello": "Hello! I'm CYRA, your document assistant. Ask me a question about your documents and I'll look for relevant passages.",
    "hi": "Hello! I'm CYRA, your document assistant. Ask me a question about your documents and I'll look for relevant passages.",
    "hey": "Hello! I'm CYRA, your document assistant. Ask me a question about your documents and I'll look for relevant passages.",
    "hello cyra": "Hello! I'm CYRA, your document assistant. Ask me a question about your documents and I'll look for relevant passages.",
    "hi cyra": "Hello! I'm CYRA, your document assistant. Ask me a question about your documents and I'll look for relevant passages.",
    "how are you": "I'm ready to help with your documents. What would you like to know?",
    "how are you doing": "I'm ready to help with your documents. What would you like to know?",
    "good morning": "Good morning! What would you like to know about your documents?",
    "good afternoon": "Good afternoon! What would you like to know about your documents?",
    "good evening": "Good evening! What would you like to know about your documents?",
    "thanks": "You're welcome! Ask me whenever you have a question about your documents.",
    "thank you": "You're welcome! Ask me whenever you have a question about your documents.",
}


def small_talk_reply(message: str) -> str | None:
    """Return a fixed reply for a standalone greeting, otherwise ``None``.

    Matching is intentionally exact after Unicode normalization, case folding,
    and punctuation/whitespace cleanup. A document question containing a
    greeting therefore continues through normal retrieval and generation.
    """
    normalized = unicodedata.normalize("NFKC", message).casefold().strip()
    normalized = re.sub(r"[^\w]+", " ", normalized, flags=re.UNICODE).strip()
    normalized = re.sub(r"\s+", " ", normalized)
    return _REPLIES.get(normalized)
