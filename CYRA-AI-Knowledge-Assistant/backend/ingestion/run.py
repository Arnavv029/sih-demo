"""
Corpus ingestion:  python -m backend.ingestion.run  [--reset] [--no-verify]

Indexes every PDF in the corpus folder (default ``<project root>/corpus``) into
the Qdrant database configured in ``.env``, tagging each chunk with PROJECT_ID.

* Safe to repeat: chunk ids are deterministic, so re-running does not duplicate.
* ``--reset`` first removes this project's existing chunks (a clean rebuild).
* After indexing, the result is VERIFIED against the store (page coverage and
  real retrieval probes); the exit code is non-zero if verification fails.

Stop the backend first when using embedded Qdrant: the database folder can only
be opened by one process at a time.
"""
from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class CorpusIngestionRun:
    """Summary produced by :func:`run_corpus_ingestion`."""

    total_pdfs: int
    ingested_count: int
    failed_filenames: list[str]
    error_log_path: Optional[str]
    partial_filenames: list[str] = field(default_factory=list)
    verifications: list = field(default_factory=list)


def run_corpus_ingestion(
    corpus_dir: str,
    error_log_path: str,
    qdrant_url: Optional[str],
    collection_name: str,
    project_id: Optional[str] = None,
    reset: bool = False,
    verify: bool = True,
) -> CorpusIngestionRun:
    """Walk *corpus_dir*, ingest every PDF, verify, flush errors, return a summary.

    ``qdrant_url=None`` means "use the environment" (embedded disk database at
    the project-root-anchored QDRANT_PATH unless QDRANT_URL is set).
    """
    corpus_path = Path(corpus_dir)
    if not corpus_path.exists():
        raise FileNotFoundError(f"CORPUS_DIR '{corpus_dir}' does not exist.")
    if not corpus_path.is_dir():
        raise FileNotFoundError(f"CORPUS_DIR '{corpus_dir}' is not a directory.")

    pdf_files = sorted(corpus_path.rglob("*.pdf"))
    total_pdfs = len(pdf_files)
    if total_pdfs == 0:
        logger.warning("corpus_ingestion.no_pdfs corpus_dir=%s", corpus_dir)
        return CorpusIngestionRun(0, 0, [], None)

    from backend.embedding import EmbeddingModel
    from backend.ingestion.build import build_pipeline
    from backend.vector_store import Scope, VectorStore

    logger.info("corpus_ingestion.loading_embedding_model")
    embedding_model = EmbeddingModel()
    vector_store = VectorStore(url=qdrant_url, collection_name=collection_name, auto_ensure=True)
    logger.info("corpus_ingestion.store mode=%s location=%s collection=%s",
                vector_store.mode, vector_store.location, vector_store.collection_name)
    pipeline, error_log = build_pipeline(embedding_model, vector_store, project_id)

    scope = Scope(project_id=project_id) if project_id else None
    if reset and scope is not None:
        for d in vector_store.list_documents(scope):
            vector_store.delete_document(scope, d["filename"])
        logger.info("corpus_ingestion.reset project=%s", project_id)

    ingested, failed, partial = 0, [], []
    verifications = []
    try:
        for idx, pdf_path in enumerate(pdf_files, start=1):
            name = pdf_path.name
            logger.info("corpus_ingestion.ingesting [%d/%d] %s", idx, total_pdfs, name)
            try:
                result = pipeline.ingest_pdf(str(pdf_path))
            except Exception as exc:  # noqa: BLE001
                logger.error("corpus_ingestion.unexpected_error filename=%s reason=%s", name, exc)
                failed.append(name)
                continue
            if not result.success or result.num_chunks == 0:
                failed.append(name)
                logger.warning("corpus_ingestion.failed filename=%s errors=%d", name, len(result.errors))
                continue
            if any(e.stage in ("embedding", "persistence") for e in result.errors):
                partial.append(name)  # some chunks were NOT stored
            ingested += 1
            logger.info("corpus_ingestion.success filename=%s chunks=%d", name, result.num_chunks)
            if verify and scope is not None:
                v = _verify(vector_store, embedding_model, scope, str(pdf_path))
                verifications.append(v)
                if not v.ok and name not in partial:
                    partial.append(name)
    finally:
        flushed = None
        if len(error_log) > 0:
            error_log.flush(error_log_path)
            flushed = error_log_path
        vector_store.close()

    return CorpusIngestionRun(total_pdfs, ingested, failed, flushed, partial, verifications)


def _verify(store, model, scope, pdf_path):
    from backend.ingestion.verify import verify_document

    return verify_document(store, model, scope, pdf_path)


def main(argv: Optional[list[str]] = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m backend.ingestion.run", description=__doc__.split("\n\n")[0])
    parser.add_argument("--reset", action="store_true", help="remove this project's chunks first (clean rebuild)")
    parser.add_argument("--no-verify", action="store_true", help="skip the post-ingestion verification")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    from backend import settings

    settings.load_env()
    corpus_dir = str(settings.corpus_dir())
    error_log_path = str(settings.resolve_path(None, "data/ingestion_errors.jsonl")) \
        if not __import__("os").environ.get("INGESTION_ERROR_LOG") \
        else str(settings.resolve_path(__import__("os").environ["INGESTION_ERROR_LOG"], ""))

    try:
        from backend.project_scope import resolve_project_id

        project_id = resolve_project_id()
    except ValueError as exc:
        print(f"\nERROR: {exc}\nAdd PROJECT_ID=cyra to the .env file in the project folder.\n")
        sys.exit(1)

    report = settings.validate()
    print(f"\nProject      : {project_id}")
    print(f"Qdrant       : {report.qdrant_mode} -> {report.qdrant_location}")
    print(f"Collection   : {report.collection}")
    print(f"Corpus folder: {corpus_dir}\n")

    try:
        run = run_corpus_ingestion(
            corpus_dir, error_log_path, None, settings.collection_name(),
            project_id=project_id, reset=args.reset, verify=not args.no_verify,
        )
    except FileNotFoundError as exc:
        print(f"\nERROR: {exc}\n")
        sys.exit(1)
    except RuntimeError as exc:
        print(f"\nERROR: {exc}\n")
        sys.exit(1)

    print(f"\n{'=' * 64}\nIngestion summary\n{'=' * 64}")
    print(f"  PDFs found          : {run.total_pdfs}")
    print(f"  PDFs indexed        : {run.ingested_count}")
    print(f"  PDFs failed         : {len(run.failed_filenames)}")
    print(f"  PDFs with problems  : {len(run.partial_filenames)}")
    for v in run.verifications:
        print(f"\n  {v.filename}")
        print(f"    PDF pages: {v.pdf_pages}  | with text: {v.pages_with_text}  | indexed pages: {v.indexed_pages}  | chunks: {v.chunks}")
        if v.pages_without_text:
            print(f"    pages with no extractable text (images/blank): {v.pages_without_text}")
        print(f"    retrieval probes: {v.probe_hits}/{v.probes} found their own page  | embedding size: {v.dense_dim}")
        for p in v.problems:
            print(f"    PROBLEM: {p}")
    for name in run.failed_filenames:
        print(f"  FAILED: {name}")
    if run.error_log_path:
        print(f"\n  Error log: {run.error_log_path}")
    bad = bool(run.failed_filenames or run.partial_filenames or run.total_pdfs == 0)
    print("\n  RESULT:", "FAILED - see messages above" if bad else "OK - index verified")
    print("=" * 64 + "\n")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
