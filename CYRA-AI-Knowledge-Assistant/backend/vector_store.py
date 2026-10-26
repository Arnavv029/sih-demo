"""
backend/vector_store.py

Qdrant vector store adapter.

Responsibilities
----------------
- ``ensure_collection``: create the Qdrant collection with a named ``dense``
  vector (HNSW, Cosine, 1024-dim) and a named ``sparse`` vector if it does not
  already exist.  Idempotent — safe to call on every startup.
- ``upsert_chunk``: deterministic, idempotent upsert.  The point id is the
  SHA-256 of the normalised text concatenated with the metadata fields, so
  re-ingesting the same chunk never creates a duplicate.
- ``exists``: fast point-existence check by id.
- ``hybrid_search``: single Query API call — dense prefetch + sparse prefetch
  fused server-side via Reciprocal Rank Fusion (RRF).
- ``count``: total number of points in the collection.

Qdrant collection schema
------------------------
collection  : "corpus"  (configurable via constructor / env)
vectors     :
  dense     : { size: 1024, distance: Cosine,
                hnsw_config: { m: 16, ef_construct: 128 } }
sparse_vectors:
  sparse    : {}                 # bge-m3 lexical weights
payload     :
  text          : str
  pdf_id        : str
  filename      : str
  page_number   : int            # 1-based
  chunk_position: int            # 0-based
  language      : str            # ISO 639-1 or "und"

Point id formula (Requirements 4.4, 5.4):
  sha256(text + "\\0" + pdf_id + "\\0" + str(page_number) + "\\0" + str(chunk_position))

Requirements: 4.3, 4.4, 4.5, 6.1
"""

from __future__ import annotations

import hashlib
import os
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from backend.data_models import (
    Candidate,
    Chunk,
    ChunkMetadata,
    EmbeddingResult,
    SparseVector,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_DENSE_VECTOR_NAME = "dense"
_SPARSE_VECTOR_NAME = "sparse"
_DENSE_VECTOR_SIZE = 1024          # BAAI/bge-m3 dense output dimension
_HNSW_M = 16
_HNSW_EF_CONSTRUCT = 128
_RRF_LIMIT_MULTIPLIER = 3          # internal prefetch limit = top_k * multiplier


# ---------------------------------------------------------------------------
# Scope helper (optional filter on pdf_id)
# ---------------------------------------------------------------------------

class VectorStoreLockedError(RuntimeError):
    """Embedded Qdrant storage is held open by another process."""


class Scope:
    """Search scope restricting results by project and/or PDF.

    At least one of ``project_id`` / ``pdf_id`` must be a non-empty string.
    An empty scope is rejected so that a missing identifier can never be
    mistaken for "search everything".

    Attributes:
        pdf_id:     Restrict results to chunks from this PDF identifier.
        project_id: Restrict results to chunks ingested under this project.
    """

    def __init__(
        self,
        pdf_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> None:
        if pdf_id is not None and not (isinstance(pdf_id, str) and pdf_id.strip()):
            raise ValueError("Scope.pdf_id must be a non-empty string when given.")
        if project_id is not None and not (
            isinstance(project_id, str) and project_id.strip()
        ):
            raise ValueError("Scope.project_id must be a non-empty string when given.")
        if pdf_id is None and project_id is None:
            raise ValueError("Scope requires a project_id and/or a pdf_id.")
        self.pdf_id = pdf_id
        self.project_id = project_id

    def to_filter(self) -> qmodels.Filter:
        """Build the Qdrant payload filter enforcing this scope."""
        conditions = []
        if self.project_id is not None:
            conditions.append(
                qmodels.FieldCondition(
                    key="project_id",
                    match=qmodels.MatchValue(value=self.project_id),
                )
            )
        if self.pdf_id is not None:
            conditions.append(
                qmodels.FieldCondition(
                    key="pdf_id",
                    match=qmodels.MatchValue(value=self.pdf_id),
                )
            )
        return qmodels.Filter(must=conditions)


# ---------------------------------------------------------------------------
# VectorStore
# ---------------------------------------------------------------------------

class VectorStore:
    """Qdrant adapter providing idempotent upsert and hybrid RRF search.

    Parameters
    ----------
    url:
        Qdrant server URL (default: ``QDRANT_URL`` env var or
        ``"http://localhost:6333"``).
    collection_name:
        Qdrant collection name (default: ``QDRANT_COLLECTION`` env var or
        ``"corpus"``).
    auto_ensure:
        When ``True`` (default), call :meth:`ensure_collection` during
        construction so the collection is always ready.

    Requirements: 4.3, 4.4, 4.5, 6.1
    """

    def __init__(
        self,
        url: Optional[str] = None,
        collection_name: Optional[str] = None,
        api_key: Optional[str] = None,
        *,
        auto_ensure: bool = True,
        path: Optional[str] = None,
    ) -> None:
        from backend import settings

        self._collection: str = collection_name or settings.collection_name()

        # Three connection modes, resolved in priority order:
        #   1. Server mode  — QDRANT_URL points at a running Qdrant (Docker or
        #      Qdrant Cloud). QDRANT_API_KEY is used for Cloud.
        #   2. Embedded on-disk mode — QDRANT_PATH set (no server needed); the
        #      qdrant-client runs Qdrant in-process and persists to that path.
        #   3. Embedded in-memory mode — neither set; ephemeral, for tests.
        # The application passes url=None and always ends up in server or
        # embedded-DISK mode: a missing QDRANT_PATH uses the default project
        # location instead of silently creating an empty in-memory database.
        # In-memory mode is only reachable by passing url="" explicitly (tests).
        resolved_api_key = api_key or os.environ.get("QDRANT_API_KEY") or None
        if url is None:
            explicit_url = os.environ.get("QDRANT_URL", "").strip()
            qdrant_path = str(settings.resolve_path(path or os.environ.get("QDRANT_PATH"), settings.DEFAULT_QDRANT_PATH))
        else:
            explicit_url = url
            raw_path = path or os.environ.get("QDRANT_PATH", "")
            qdrant_path = str(settings.resolve_path(raw_path, "")) if raw_path else ""

        if explicit_url:
            # Server mode (local Docker Qdrant or Qdrant Cloud)
            self._url = explicit_url
            self._mode = "server"
            self._client = QdrantClient(url=explicit_url, api_key=resolved_api_key)
        elif qdrant_path:
            # Embedded persistent mode — no separate Qdrant container required
            self._url = f"local:{qdrant_path}"
            self._mode = "embedded-disk"
            os.makedirs(qdrant_path, exist_ok=True)
            try:
                self._client = QdrantClient(path=qdrant_path)
            except RuntimeError as exc:
                if "already accessed" in str(exc) or "lock" in str(exc).lower():
                    raise VectorStoreLockedError(
                        f"The Qdrant database at {qdrant_path} is in use by another "
                        "process (for example the running backend). Stop the backend "
                        "(Ctrl+C), run the ingestion command, then start the backend again."
                    ) from exc
                raise
        else:
            # Embedded in-memory mode — ephemeral (primarily for tests)
            self._url = "local::memory:"
            self._mode = "embedded-memory"
            self._client = QdrantClient(location=":memory:")

        if auto_ensure:
            self.ensure_collection()

    # ------------------------------------------------------------------
    # Public properties
    # ------------------------------------------------------------------

    @property
    def mode(self) -> str:
        """``server``, ``embedded-disk`` or ``embedded-memory``."""
        return self._mode

    @property
    def location(self) -> str:
        """Human-readable storage location (URL or folder; no secrets)."""
        return self._url

    @property
    def collection_name(self) -> str:
        """The Qdrant collection name used by this adapter."""
        return self._collection

    # ------------------------------------------------------------------
    # Collection management
    # ------------------------------------------------------------------

    def ensure_collection(self) -> None:
        """Create the collection with HNSW dense + sparse vectors if absent.

        Idempotent: does nothing when the collection already exists.  This
        satisfies Requirements 4.5 (data survives restarts) and 6.1 (HNSW
        ANN index over dense vectors).
        """
        existing = {c.name for c in self._client.get_collections().collections}
        if self._collection in existing:
            self._ensure_payload_indexes()
            return  # already present — nothing to do

        self._client.create_collection(
            collection_name=self._collection,
            vectors_config={
                _DENSE_VECTOR_NAME: qmodels.VectorParams(
                    size=_DENSE_VECTOR_SIZE,
                    distance=qmodels.Distance.COSINE,
                    hnsw_config=qmodels.HnswConfigDiff(
                        m=_HNSW_M,
                        ef_construct=_HNSW_EF_CONSTRUCT,
                    ),
                )
            },
            sparse_vectors_config={
                _SPARSE_VECTOR_NAME: qmodels.SparseVectorParams()
            },
            # Persist all writes to disk before acknowledging (Req 4.5)
            optimizers_config=qmodels.OptimizersConfigDiff(
                indexing_threshold=0,  # index immediately; durability first
            ),
        )
        self._ensure_payload_indexes()

    def _ensure_payload_indexes(self) -> None:
        """Create keyword payload indexes used by scope filters (idempotent)."""
        for field in ("project_id", "pdf_id"):
            try:
                self._client.create_payload_index(
                    collection_name=self._collection,
                    field_name=field,
                    field_schema=qmodels.PayloadSchemaType.KEYWORD,
                )
            except Exception:  # noqa: BLE001 — index may already exist / unsupported locally
                pass

    # ------------------------------------------------------------------
    # Point id computation
    # ------------------------------------------------------------------

    @staticmethod
    def compute_point_id(text: str, metadata: ChunkMetadata) -> str:
        """Compute a deterministic, project-aware point ID."""
        parts = [
            text,
            metadata.pdf_id,
            str(metadata.page_number),
            str(metadata.chunk_position),
        ]

        if metadata.project_id is not None:
            parts.append(metadata.project_id)

        raw = "\x00".join(parts)
        sha256_hex = hashlib.sha256(raw.encode("utf-8")).hexdigest()

        import uuid
        return str(uuid.UUID(hex=sha256_hex[:32]))

    # ------------------------------------------------------------------
    # Write path
    # ------------------------------------------------------------------

    def upsert_chunk(self, chunk: Chunk, emb: EmbeddingResult) -> None:
        """Idempotent upsert: insert or overwrite the point with this chunk's id.

        The point id is derived deterministically from the chunk text and its
        metadata, so calling this method a second time with the same chunk
        simply overwrites the existing point with identical data — no
        duplicate is created (Requirements 4.4, 5.4).

        The dense vector, sparse vector, chunk text, and all metadata fields
        are persisted to durable Qdrant storage (Requirement 4.3).

        Parameters
        ----------
        chunk:
            The text passage and its provenance metadata.
        emb:
            Pre-computed dense + sparse embedding for ``chunk.text``.
        """
        point_id = self.compute_point_id(chunk.text, chunk.metadata)

        payload = {
    "text": chunk.text,
    "pdf_id": chunk.metadata.pdf_id,
    "project_id": chunk.metadata.project_id,
    "filename": chunk.metadata.filename,
    "page_number": chunk.metadata.page_number,
    "page_end": chunk.metadata.page_end,
    "chunk_position": chunk.metadata.chunk_position,
    "language": chunk.metadata.language,
}

        sparse_vec = qmodels.SparseVector(
            indices=emb.sparse.indices,
            values=emb.sparse.values,
        )

        point = qmodels.PointStruct(
            id=point_id,
            vector={
                _DENSE_VECTOR_NAME: emb.dense,
                _SPARSE_VECTOR_NAME: sparse_vec,
            },
            payload=payload,
        )

        self._client.upsert(
            collection_name=self._collection,
            points=[point],
            wait=True,  # block until the write is durable (Req 4.5)
        )

    # ------------------------------------------------------------------
    # Read path — existence check
    # ------------------------------------------------------------------

    def exists(self, point_id: str) -> bool:
        """Return ``True`` when a point with *point_id* exists in the collection.

        Uses a ``retrieve`` call with ``with_payload=False`` and
        ``with_vectors=False`` to avoid transferring unnecessary data.

        Parameters
        ----------
        point_id:
            A deterministic UUID derived from the SHA-256 digest, as returned
            by :meth:`compute_point_id`.
        """
        results = self._client.retrieve(
            collection_name=self._collection,
            ids=[point_id],
            with_payload=False,
            with_vectors=False,
        )
        return len(results) > 0

    # ------------------------------------------------------------------
    # Read path — hybrid search
    # ------------------------------------------------------------------

    def hybrid_search(
        self,
        dense: list[float],
        sparse: SparseVector,
        top_k: int,
        scope: Optional[Scope] = None,
    ) -> list[Candidate]:
        """Single Query API call combining dense ANN and sparse lexical results.

        Issues one :meth:`QdrantClient.query_points` call with two ``prefetch``
        branches (dense ANN + sparse lexical) merged server-side via
        Reciprocal Rank Fusion (RRF).  This satisfies Requirement 6.3 (single
        Hybrid_Search call) and Requirement 6.1 (HNSW ANN index).

        Parameters
        ----------
        dense:
            Query dense vector (length must match the collection's dense size).
        sparse:
            Query sparse vector (indices + values from bge-m3).
        top_k:
            Maximum number of candidates to return (1..100).
        scope:
            Optional :class:`Scope` restricting results to a project and/or
            a single PDF.

        Returns
        -------
        list[Candidate]
            Up to *top_k* candidates ordered by descending fused RRF score.
            Each candidate contains the chunk text, the fused score, and the
            full :class:`ChunkMetadata` (Requirement 6.4).
        """
        # Build the payload filter for project/PDF-scoped searches.  The same
        # filter is applied to BOTH prefetch branches (dense + sparse) and to
        # the fused query, so scope is enforced inside Qdrant, never after.
        query_filter: Optional[qmodels.Filter] = (
            scope.to_filter() if scope is not None else None
        )

        # Internal prefetch limit — fetch more than top_k per branch so RRF
        # fusion has enough candidates to work with.
        prefetch_limit = max(top_k * _RRF_LIMIT_MULTIPLIER, top_k + 10)

        prefetch = [
            # Dense ANN prefetch (HNSW index, Req 6.1)
            qmodels.Prefetch(
                query=dense,
                using=_DENSE_VECTOR_NAME,
                limit=prefetch_limit,
                filter=query_filter,
            ),
            # Sparse lexical prefetch
            qmodels.Prefetch(
                query=qmodels.SparseVector(
                    indices=sparse.indices,
                    values=sparse.values,
                ),
                using=_SPARSE_VECTOR_NAME,
                limit=prefetch_limit,
                filter=query_filter,
            ),
        ]

        results = self._client.query_points(
            collection_name=self._collection,
            prefetch=prefetch,
            query=qmodels.FusionQuery(fusion=qmodels.Fusion.RRF),
            query_filter=query_filter,
            limit=top_k,
            with_payload=True,
            with_vectors=False,
        )

        candidates: list[Candidate] = []
        for point in results.points:
            payload = point.payload or {}
            metadata = ChunkMetadata(
                pdf_id=payload.get("pdf_id", ""),
                filename=payload.get("filename", ""),
                page_number=int(payload.get("page_number", 0)),
                page_end=(int(payload["page_end"]) if payload.get("page_end") else None),
                chunk_position=int(payload.get("chunk_position", 0)),
                language=payload.get("language", "und"),
                project_id=payload.get("project_id"),
            )
            candidates.append(
                Candidate(
                    text=payload.get("text", ""),
                    score=float(point.score),
                    metadata=metadata,
                )
            )

        return candidates

    # ------------------------------------------------------------------
    # Aggregate queries
    # ------------------------------------------------------------------

    def count(self, scope: Optional[Scope] = None) -> int:
        """Return the number of points (chunks); restricted to *scope* if given."""
        result = self._client.count(
            collection_name=self._collection,
            count_filter=scope.to_filter() if scope is not None else None,
            exact=True,
        )
        return result.count

    # ------------------------------------------------------------------
    # Document-level operations (always project-scoped)
    # ------------------------------------------------------------------

    def _filename_filter(self, filename: str, scope: Optional[Scope]) -> qmodels.Filter:
        must = list(scope.to_filter().must) if scope is not None else []
        must.append(
            qmodels.FieldCondition(key="filename", match=qmodels.MatchValue(value=filename))
        )
        return qmodels.Filter(must=must)

    def list_documents(self, scope: Scope) -> list[dict]:
        """Return ``[{filename, chunks, pages}]`` for the documents in *scope*."""
        docs: dict[str, dict] = {}
        offset = None
        while True:
            records, offset = self._client.scroll(
                collection_name=self._collection,
                scroll_filter=scope.to_filter(),
                limit=500,
                with_payload=["filename", "page_number", "page_end"],
                with_vectors=False,
                offset=offset,
            )
            for r in records:
                payload = r.payload or {}
                name = payload.get("filename")
                if not name:
                    continue
                d = docs.setdefault(name, {"filename": name, "chunks": 0, "_pages": set()})
                d["chunks"] += 1
                first = int(payload.get("page_number", 0))
                last = int(payload.get("page_end") or first)
                d["_pages"].update(range(first, last + 1))
            if offset is None:
                break
        out = []
        for name in sorted(docs):
            d = docs[name]
            pages = sorted(d.pop("_pages"))
            d["pages"] = len(pages)
            out.append(d)
        return out

    def has_document(self, scope: Scope, filename: str) -> bool:
        """True if *filename* has at least one chunk inside *scope*."""
        records, _ = self._client.scroll(
            collection_name=self._collection,
            scroll_filter=self._filename_filter(filename, scope),
            limit=1, with_payload=False, with_vectors=False,
        )
        return bool(records)

    def delete_document(self, scope: Scope, filename: str) -> bool:
        """Delete this scope's chunks of *filename*.

        Returns True when no chunk of that file remains in ANY project (so the
        caller may delete the physical file).
        """
        self._client.delete(
            collection_name=self._collection,
            points_selector=self._filename_filter(filename, scope),
        )
        remaining, _ = self._client.scroll(
            collection_name=self._collection,
            scroll_filter=self._filename_filter(filename, None),
            limit=1, with_payload=False, with_vectors=False,
        )
        return not remaining

    def close(self) -> None:
        """Release the storage (important for embedded on-disk Qdrant)."""
        try:
            self._client.close()
        except Exception:  # noqa: BLE001
            pass
