"""Retrieval against the bundled AICTE handbook (real PDF text, real chunker, real Qdrant).

Only the embedding model is replaced by a small lexical stand-in so the test runs
offline and fast; it checks that page numbers, text and filtering are correct end to
end.  Semantic quality with BAAI/bge-m3 is verified separately by
``python -m backend.ingestion.run`` (which runs retrieval probes) and
``python -m backend.diagnose "<question>"``.

Expected evidence was read from the PDF itself:
  * PDF page 27 (printed page 11): Chapter II, 2.1 "Existing institutions shall be eligible
    for getting 3 years' Extension of Approval (EoA) from the AY-2024-25 ..."
  * PDF page 40 (printed page 24): 2.15 Conversion of Women's Institution into Co-ed Institution.
"""
import math
import re
import zlib
from pathlib import Path

import pymupdf
import pytest

from backend.data_models import EmbeddingResult, SparseVector
from backend.ingestion.chunker import Chunker, ChunkerConfig, PageText
from backend.ingestion.clean import Cleaner
from backend.retrieval import RetrievalService
from backend.vector_store import Scope, VectorStore

PDF = Path(__file__).resolve().parents[2] / "corpus" / "APH_Final.pdf"
FIRST, LAST = 20, 60  # PDF pages indexed in this test (keeps it fast)
STOP = set("the a an of to in and or for is are be by on with as at that this it from which shall may any all".split())


class LexicalEmbedding:
    def embed(self, texts):
        out = []
        for t in texts:
            ws = [w for w in re.findall(r"[a-z0-9]+", t.lower()) if w not in STOP]
            tf = {}
            for w in ws:
                tf[w] = tf.get(w, 0) + 1
            for a, b in zip(ws, ws[1:]):
                tf[a + "_" + b] = tf.get(a + "_" + b, 0) + 0.5
            dense, sp = [0.0] * 1024, {}
            for w, c in tf.items():
                h = zlib.crc32(w.encode())
                wgt = 1 + math.log(c) if c >= 1 else c
                dense[h % 1024] += wgt * (1 if (h >> 10) & 1 else -1)
                sp[h % 250002] = sp.get(h % 250002, 0) + wgt
            n = math.sqrt(sum(x * x for x in dense)) or 1.0
            idx = sorted(sp)
            out.append(EmbeddingResult([x / n for x in dense], SparseVector(idx, [sp[i] for i in idx])))
        return out


@pytest.fixture(scope="module")
def indexed(tmp_path_factory):
    if not PDF.exists():
        pytest.skip("bundled handbook not present")
    with pymupdf.open(str(PDF)) as doc:
        raw = [(i + 1, doc[i].get_text()) for i in range(FIRST - 1, LAST)]
    cleaned = Cleaner().clean_document([t for _, t in raw])
    pages = [PageText(n, t, PDF.name, "pdf-aph", "en") for (n, _), t in zip(raw, cleaned) if t.strip()]
    chunks = Chunker(ChunkerConfig()).chunk(pages)
    emb = LexicalEmbedding()
    store = VectorStore(
        url="",
        collection_name="handbook_test",
        path=str(tmp_path_factory.mktemp("handbook_qdrant")),
        auto_ensure=True,
    )
    import dataclasses
    for c in chunks:
        c = dataclasses.replace(c, metadata=dataclasses.replace(c.metadata, project_id="cyra"))
        store.upsert_chunk(c, emb.embed([c.text])[0])
    try:
        yield store, RetrievalService(emb, store, require_scope=True), chunks
    finally:
        store.close()


def _retrieve(svc, q, k=8):
    return svc.retrieve(q, k, Scope(project_id="cyra")).candidates


def test_every_indexed_page_is_covered_and_pages_are_spread(indexed):
    _, _, chunks = indexed
    covered = set()
    for c in chunks:
        covered.update(c.metadata.pages)
    assert covered >= set(range(FIRST, LAST + 1))
    assert len({c.metadata.page_number for c in chunks}) > 15  # regression: pages used to collapse


def test_chunk_text_for_page_27_is_stored_with_correct_page(indexed):
    _, _, chunks = indexed
    hit = [c for c in chunks if "eligible for getting 3 years" in " ".join(c.text.split())]
    assert hit, "page 27 evidence missing from the chunks"
    assert 27 in hit[0].metadata.pages


def test_eoa_question_retrieves_page_27_evidence(indexed):
    _, svc, _ = indexed
    cands = _retrieve(svc, "How many years of Extension of Approval can existing institutions get from AY 2024-25?")
    evid = [c for c in cands if "eligible for getting 3 years" in " ".join(c.text.split())]
    assert evid, [c.metadata.pages for c in cands]
    # the same sentence also appears in other chapters (e.g. p.53); page 27 must be among them
    assert any(27 in c.metadata.pages for c in evid), [c.metadata.pages for c in evid]


def test_verbose_eoa_summary_question_retrieves_eoa_passages(indexed):
    _, svc, _ = indexed
    q = ("Summarize the key requirements for Extension of Approval (EoA) mentioned in the "
         "uploaded handbook. Include page references if available.")
    cands = _retrieve(svc, q)
    assert cands and all("extension of approval" in " ".join(c.text.lower().split()) or "eoa" in c.text.lower() for c in cands[:4])


def test_coed_conversion_question_retrieves_section_2_15(indexed):
    _, svc, _ = indexed
    cands = _retrieve(svc, "Can a women's institution be converted into a co-ed institution?")
    ev = [c for c in cands if "Conversion of Women" in c.text and "Co-ed" in c.text]
    assert ev and any(40 in c.metadata.pages for c in ev)


def test_results_never_leak_other_projects(indexed):
    store, svc, _ = indexed
    assert svc.retrieve("Extension of Approval", 8, Scope(project_id="someone-else")).candidates == []


def test_repeated_affidavit_text_does_not_lose_pdf_page_213_provenance():
    with pymupdf.open(str(PDF)) as doc:
        raw = [page.get_text() for page in doc]
    cleaned = Cleaner().clean_document(raw)
    pages = [
        PageText(i + 1, text, PDF.name, "pdf-aph", "en")
        for i, text in enumerate(cleaned)
        if text.strip()
    ]
    chunks = Chunker(ChunkerConfig()).chunk(pages)

    represented_pages = {page for chunk in chunks for page in chunk.metadata.pages}
    text_pages = {i + 1 for i, text in enumerate(cleaned) if text.strip()}
    assert 213 in represented_pages
    assert not text_pages - represented_pages
