"""
backend/project_scope.py

Trusted, server-side project scope resolution.

The chatbot UI has no project selector.  The project a deployment serves is
fixed by the backend's own configuration (the ``PROJECT_ID`` environment
variable) and is never read from a request, so a client cannot widen or change
it.  A missing or malformed value is an explicit error: it is never treated as
"search every project".
"""

from __future__ import annotations

import os
import re
from typing import Mapping, Optional

PROJECT_ID_ENV = "PROJECT_ID"

# Letters, digits, dot, underscore, hyphen; must start alphanumeric; <= 64 chars.
_PROJECT_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$")


class ProjectScopeError(ValueError):
    """Raised when the project scope is missing or invalid."""


def validate_project_id(value: Optional[str]) -> str:
    """Return *value* stripped, or raise :class:`ProjectScopeError`."""
    if value is None or not str(value).strip():
        raise ProjectScopeError(
            f"{PROJECT_ID_ENV} is not configured. Set it to the identifier of "
            "the project whose documents this deployment may search."
        )
    cleaned = str(value).strip()
    if not _PROJECT_ID_RE.match(cleaned):
        raise ProjectScopeError(
            f"{PROJECT_ID_ENV} is invalid: use 1-64 characters from "
            "A-Z a-z 0-9 . _ - and start with a letter or digit."
        )
    return cleaned


def resolve_project_id(env: Optional[Mapping[str, str]] = None) -> str:
    """Read and validate the configured project id (fail closed)."""
    source = os.environ if env is None else env
    return validate_project_id(source.get(PROJECT_ID_ENV))
