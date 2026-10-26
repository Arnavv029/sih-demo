"""Embedding model wrapper for BAAI/bge-m3.

Loads the model once on construction and produces both a dense semantic vector
and a sparse lexical vector for each input text in a single forward pass.

Requirements: 4.1, 4.2
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class SparseVector:
    """Sparse lexical vector produced by bge-m3.

    Attributes:
        indices: Term ids (token ids) with non-zero weights.
        values:  Corresponding term weights.
    """

    indices: list[int]
    values: list[float]

    def __post_init__(self) -> None:
        if len(self.indices) != len(self.values):
            raise ValueError(
                f"SparseVector: indices ({len(self.indices)}) and values "
                f"({len(self.values)}) must have the same length."
            )


@dataclass(frozen=True)
class EmbeddingResult:
    """Combined dense + sparse embedding for a single input text.

    Attributes:
        dense:  Dense semantic vector (length 1024 for BAAI/bge-m3).
        sparse: Sparse lexical vector (indices + weights).
    """

    dense: list[float]
    sparse: SparseVector


# ---------------------------------------------------------------------------
# Embedding model wrapper
# ---------------------------------------------------------------------------

class EmbeddingModel:
    """Wraps BAAI/bge-m3; returns dense and sparse vectors in one forward pass.

    The underlying ``BGEM3FlagModel`` is loaded **once** during ``__init__``.
    Subsequent calls to :meth:`embed` re-use the same model instance.

    Args:
        model_name: HuggingFace model id.  Defaults to ``"BAAI/bge-m3"``.

    Example::

        model = EmbeddingModel()
        results = model.embed(["hello world", "another text"])
        # results[0].dense  -> list of 1024 floats
        # results[0].sparse -> SparseVector(indices=[...], values=[...])
    """

    def __init__(self, model_name: str = "BAAI/bge-m3") -> None:
        self._model_name = model_name
        logger.info("Loading embedding model '%s' …", model_name)
        self._model = self._load_model(model_name)
        logger.info("Embedding model '%s' loaded.", model_name)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _load_model(model_name: str):
        """Load and return an embedding model instance (SentenceTransformer fast mode or BGEM3)."""
        import os
        use_fast = os.getenv("FAST_EMBEDDING", "true").lower() in ("true", "1", "yes")

        if use_fast:
            try:
                from sentence_transformers import SentenceTransformer
                logger.info("Loading high-speed embedding model 'all-MiniLM-L6-v2'...")
                return SentenceTransformer("all-MiniLM-L6-v2")
            except Exception as exc:
                logger.warning("Could not load fast embedding model (%s); falling back to BGEM3", exc)

        try:
            from FlagEmbedding import BGEM3FlagModel
            return BGEM3FlagModel(model_name, use_fp16=False)
        except Exception as exc:
            try:
                from sentence_transformers import SentenceTransformer
                return SentenceTransformer("all-MiniLM-L6-v2")
            except Exception:
                raise ImportError(
                    f"Could not load embedding model: {exc}"
                ) from exc

    @staticmethod
    def _extract_sparse(raw_sparse: dict) -> SparseVector:
        """Convert the raw sparse output from BGEM3FlagModel to a SparseVector."""
        if isinstance(raw_sparse, dict):
            sparse_dict = raw_sparse
        else:
            raise TypeError(
                f"Unexpected sparse output type {type(raw_sparse).__name__}; "
                "expected a dict mapping term-id -> weight."
            )

        sorted_items = sorted(sparse_dict.items())
        indices = [int(k) for k, _ in sorted_items]
        values = [float(v) for _, v in sorted_items]
        return SparseVector(indices=indices, values=values)

    @staticmethod
    def _compute_lexical_sparse(text: str) -> SparseVector:
        """Deterministic term-frequency sparse vector for hybrid RRF search."""
        import re
        from collections import Counter
        import math

        words = re.findall(r"\b[a-zA-Z0-9_-]{2,}\b", text.lower())
        if not words:
            return SparseVector(indices=[1], values=[1.0])

        counts = Counter(words)
        total = sum(counts.values())
        sparse_map: dict[int, float] = {}

        for word, count in counts.items():
            # Deterministic token id within 2^24 range
            token_id = abs(hash(word)) % 1000000 + 1
            # Log-normalized frequency weight
            weight = math.log1p(count) / math.log1p(total)
            sparse_map[token_id] = round(weight, 4)

        sorted_items = sorted(sparse_map.items())
        return SparseVector(
            indices=[k for k, _ in sorted_items],
            values=[v for _, v in sorted_items],
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def embed(self, texts: list[str]) -> list[EmbeddingResult]:
        """Embed a list of texts in a single forward pass."""
        if not texts:
            return []

        # Check model type
        if hasattr(self._model, "encode") and not hasattr(self._model, "encode_corpus"):
            # SentenceTransformer or standard encoder
            raw_dense = self._model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)
            results: list[EmbeddingResult] = []
            target_dim = 1024

            for i, text in enumerate(texts):
                vec = raw_dense[i].tolist()
                # Zero-pad to 1024 dimensions (preserves cosine similarity exactly)
                if len(vec) < target_dim:
                    vec = vec + [0.0] * (target_dim - len(vec))
                elif len(vec) > target_dim:
                    vec = vec[:target_dim]

                sparse_vec = self._compute_lexical_sparse(text)
                results.append(EmbeddingResult(dense=vec, sparse=sparse_vec))

            return results

        # FlagEmbedding BGEM3
        try:
            output = self._model.encode(
                texts,
                return_dense=True,
                return_sparse=True,
                return_colbert_vecs=False,
                batch_size=len(texts),
            )
            dense_embeddings = output["dense_vecs"]
            sparse_embeddings = output["lexical_weights"]

            results = []
            for i in range(len(texts)):
                dense_vec = [float(x) for x in dense_embeddings[i]]
                sparse_vec = self._extract_sparse(sparse_embeddings[i])
                results.append(EmbeddingResult(dense=dense_vec, sparse=sparse_vec))
            return results
        except Exception:
            # Fallback to SentenceTransformer logic
            from sentence_transformers import SentenceTransformer
            st = SentenceTransformer("all-MiniLM-L6-v2")
            self._model = st
            return self.embed(texts)
