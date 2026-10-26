"""
Post-ingestion verification.

A "successfully ingested" message only says the pipeline did not crash.  These
checks look at what is actually in the vector store and prove that the whole
retrieval path (embedding -> Qdrant -> project filter) can find the indexed text.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

from backend.vector_store import Scope


@dataclass
class DocumentVerification:
    filename: str
    pdf_pages: int = 0
    pages_with_text: int = 0
    indexed_pages: int = 0
    chunks: int = 0
    pages_without_text: list[int] = field(default_factory=list)
    text_pages_not_indexed: list[int] = field(default_factory=list)
    probes: int = 0
    probe_hits: int = 0
    dense_dim: int = 0
    problems: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


def _indexed_chunks(store, scope: Scope, filename: str) -> list[dict]:
    out, offset = [], None
    flt = store._filename_filter(filename, scope)
    while True:
        recs, offset = store._client.scroll(
            collection_name=store.collection_name, scroll_filter=flt, limit=500,
            with_payload=True, with_vectors=False, offset=offset,
        )
        out.extend(r.payload or {} for r in recs)
        if offset is None:
            return out


def _probe_query(text: str, words: int = 22) -> str:
    """A mid-chunk phrase used as a retrieval probe."""
    toks = re.findall(r"\S+", text)
    if len(toks) <= words:
        return " ".join(toks)
    start = max(0, len(toks) // 2 - words // 2)
    return " ".join(toks[start:start + words])


def verify_document(store, embedding_model, scope: Scope, pdf_path: str,
                    probes: int = 6, top_k: int = 8) -> DocumentVerification:
    import pymupdf

    path = Path(pdf_path)
    v = DocumentVerification(filename=path.name)

    with pymupdf.open(str(path)) as doc:
        v.pdf_pages = len(doc)
        for i, page in enumerate(doc, start=1):
            if page.get_text().strip():
                v.pages_with_text += 1
            else:
                v.pages_without_text.append(i)

    payloads = _indexed_chunks(store, scope, path.name)
    v.chunks = len(payloads)
    if not payloads:
        v.problems.append("No chunks for this file are stored under the configured project.")
        return v
    if any(not (p.get("text") or "").strip() for p in payloads):
        v.problems.append("Some stored chunks have empty text.")
    indexed = set()
    for p in payloads:
        first = int(p.get("page_number", 0))
        indexed.update(range(first, int(p.get("page_end") or first) + 1))
    v.indexed_pages = len(indexed)
    no_text = set(v.pages_without_text)
    v.text_pages_not_indexed = sorted(set(range(1, v.pdf_pages + 1)) - indexed - no_text)
    if v.text_pages_not_indexed:
        v.problems.append(f"{len(v.text_pages_not_indexed)} page(s) with text were not indexed: "
                          f"{v.text_pages_not_indexed[:15]}")

    # Retrieval probes: query with a phrase taken from a stored chunk; the chunk's
    # own page must come back.  Uses the SAME embedding model, store and filter
    # as the chatbot, so it exercises the real query path end to end.
    ordered = sorted(payloads, key=lambda p: (int(p.get("page_number", 0)), int(p.get("chunk_position", 0))))
    step = max(1, len(ordered) // probes)
    for p in ordered[::step][:probes]:
        text = p.get("text") or ""
        if len(text.split()) < 15:
            continue
        emb = embedding_model.embed([_probe_query(text)])[0]
        v.dense_dim = len(emb.dense)
        hits = store.hybrid_search(emb.dense, emb.sparse, top_k, scope)
        v.probes += 1
        if any(h.metadata.filename == path.name and h.metadata.page_number == int(p.get("page_number", 0)) and h.metadata.chunk_position == int(p.get("chunk_position", 0)) for h in hits):
            v.probe_hits += 1
    if v.probes == 0:
        v.problems.append("No chunk was long enough to run a retrieval probe.")
    elif v.probe_hits < v.probes:
        v.problems.append(f"Retrieval probes failed: only {v.probe_hits}/{v.probes} sample passages "
                          "were found by searching for their own text.")
    return v
