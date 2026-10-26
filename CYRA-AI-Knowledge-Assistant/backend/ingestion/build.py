"""Shared construction of the ingestion pipeline (used by the CLI and /upload)."""
from __future__ import annotations

from typing import Optional

from backend.ingestion.chunker import Chunker, ChunkerConfig
from backend.ingestion.clean import Cleaner
from backend.ingestion.error_log import IngestionErrorLog
from backend.ingestion.extract import Text_Extractor, tesseract_available
from backend.ingestion.pipeline import IngestionPipeline


def _embedded_image_ocr_enabled() -> bool:
    """OCR of images on pages that already have text (default off)."""
    import os

    return os.environ.get("OCR_EMBEDDED_IMAGES", "false").strip().lower() in ("1", "true", "yes")


def build_pipeline(embedding_model, vector_store, project_id: Optional[str]):
    """Return ``(pipeline, error_log)`` wired to the given model and store."""
    error_log = IngestionErrorLog()
    pipeline = IngestionPipeline(
        extractor=Text_Extractor(
            ocr_available=tesseract_available(),
            ocr_embedded_images=_embedded_image_ocr_enabled(),
        ),
        cleaner=Cleaner(),
        chunker=Chunker(config=ChunkerConfig()),
        embedding_model=embedding_model,
        vector_store=vector_store,
        error_log=error_log,
        project_id=project_id,
    )
    return pipeline, error_log
