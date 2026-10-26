"""
backend/settings.py

Single source of truth for CYRA's configuration and file locations.

Why this exists
---------------
Earlier versions resolved ``QDRANT_PATH=./data/qdrant`` against whatever folder
the process happened to be started from, and silently fell back to an empty
in-memory database when the variable was missing.  Ingestion and the API could
therefore talk to *different* databases while both looked healthy.

Rules enforced here:
* Every relative path is resolved against the PROJECT ROOT (the folder that
  contains ``backend/``), never against the current working directory.
* ``.env`` is always read from the project root.
* Ingestion, diagnostics and the API all call the same helpers.
* Secrets are never returned in messages or summaries.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent

DEFAULT_QDRANT_PATH = "data/qdrant"
DEFAULT_CORPUS_DIR = "corpus"
DEFAULT_COLLECTION = "corpus"
DEFAULT_TOP_K = 8
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"
DEFAULT_GENERATION_TIMEOUT_S = 60.0

_env_loaded = False


def load_env() -> None:
    """Load ``<project root>/.env`` once. Real environment variables win."""
    global _env_loaded
    if _env_loaded:
        return
    try:
        from dotenv import load_dotenv

        load_dotenv(PROJECT_ROOT / ".env", override=False)
    except ImportError:  # pragma: no cover
        pass
    _env_loaded = True


def resolve_path(value: Optional[str], default: str) -> Path:
    """Return an absolute path; relative values are anchored at PROJECT_ROOT."""
    raw = (value or "").strip() or default
    p = Path(raw).expanduser()
    return p if p.is_absolute() else (PROJECT_ROOT / p).resolve()


def corpus_dir() -> Path:
    return resolve_path(os.environ.get("CORPUS_DIR"), DEFAULT_CORPUS_DIR)


def qdrant_path() -> Path:
    return resolve_path(os.environ.get("QDRANT_PATH"), DEFAULT_QDRANT_PATH)


def collection_name() -> str:
    return (os.environ.get("QDRANT_COLLECTION") or DEFAULT_COLLECTION).strip()


def top_k() -> int:
    try:
        v = int(os.environ.get("RETRIEVAL_TOP_K", DEFAULT_TOP_K))
    except ValueError:
        return DEFAULT_TOP_K
    return min(max(v, 1), 50)


def generation_timeout_s() -> float:
    try:
        v = float(os.environ.get("GENERATION_TIMEOUT_S", DEFAULT_GENERATION_TIMEOUT_S))
    except ValueError:
        return DEFAULT_GENERATION_TIMEOUT_S
    return min(max(v, 1.0), 120.0)


def gemini_model() -> str:
    return (os.environ.get("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL).strip()


def llm_key_configured() -> bool:
    """True when a non-placeholder Gemini key is present (value never exposed)."""
    key = (os.environ.get("GOOGLE_API_KEY") or "").strip()
    return bool(key) and key not in {"your_gemini_api_key_here", "changeme"}


def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass
class ConfigReport:
    """Result of validating the configuration (contains no secret values)."""

    problems: list[str] = field(default_factory=list)
    project_id: Optional[str] = None
    qdrant_mode: str = ""
    qdrant_location: str = ""
    collection: str = ""
    corpus: str = ""
    llm_configured: bool = False

    @property
    def ok(self) -> bool:
        return not self.problems


def validate() -> ConfigReport:
    """Check the configuration and describe it without revealing secrets."""
    from backend.project_scope import ProjectScopeError, resolve_project_id

    r = ConfigReport()
    try:
        r.project_id = resolve_project_id()
    except ProjectScopeError as exc:
        r.problems.append(str(exc))

    url = (os.environ.get("QDRANT_URL") or "").strip()
    if url:
        r.qdrant_mode, r.qdrant_location = "server", url
    else:
        r.qdrant_mode, r.qdrant_location = "embedded-disk", str(qdrant_path())
    r.collection = collection_name()
    r.corpus = str(corpus_dir())

    r.llm_configured = llm_key_configured()
    if not r.llm_configured:
        r.problems.append(
            "GOOGLE_API_KEY is not set. Create the file .env in the project folder "
            "and add: GOOGLE_API_KEY=<your key> (get one at "
            "https://aistudio.google.com/apikey), then restart the backend."
        )
    return r
