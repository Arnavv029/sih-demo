"""Regression tests: a chunk's page_number must be the page where it really starts.

Earlier, the page was looked up by the first occurrence of the chunk's first token id
anywhere in the document, so almost every chunk was assigned an early page.
"""
import re

from backend.ingestion.chunker import Chunker, ChunkerConfig, PageText


class WordTokenizer:
    """Reversible word/whitespace tokenizer (no network, unlike tiktoken)."""

    def __init__(self):
        self._ids, self._inv = {}, []

    def encode(self, text):
        out = []
        for m in re.finditer(r"\s+|\S+", text):
            p = m.group(0)
            if p not in self._ids:
                self._ids[p] = len(self._inv)
                self._inv.append(p)
            out.append(self._ids[p])
        return out

    def decode(self, toks):
        return "".join(self._inv[t] for t in toks)


def _pages(n_pages=40, words_per_page=300):
    pages = []
    for p in range(1, n_pages + 1):
        # every page repeats common words but has a unique marker word
        body = " ".join(f"the of and clause{p}x{i}" if i % 5 == 0 else "the of and" for i in range(words_per_page))
        pages.append(PageText(page_number=p, text=f"Page header\n\nMARK{p} " + body, filename="t.pdf", pdf_id="pdf", language="en"))
    return pages


def _chunker():
    return Chunker(config=ChunkerConfig(max_tokens=400, overlap_tokens=60, min_final_tokens=50), tokenizer=WordTokenizer())


def test_chunk_pages_spread_over_the_whole_document():
    chunks = _chunker().chunk(_pages())
    distinct = {c.metadata.page_number for c in chunks}
    assert len(distinct) > 30, f"only {len(distinct)} distinct pages - page mapping is collapsing"
    assert max(distinct) >= 39


def test_page_number_matches_where_the_text_starts():
    pages = _pages()
    for c in _chunker().chunk(pages):
        m = re.search(r"MARK(\d+)", c.text)
        if not m:
            continue
        marker_page = int(m.group(1))
        first, last = c.metadata.page_number, c.metadata.page_end or c.metadata.page_number
        # the first marker found in the text lies inside the chunk's page span
        assert first <= marker_page <= last, (first, last, marker_page)


def test_page_numbers_are_non_decreasing_and_span_is_valid():
    chunks = _chunker().chunk(_pages())
    pages = [c.metadata.page_number for c in chunks]
    assert pages == sorted(pages)
    for c in chunks:
        assert (c.metadata.page_end or c.metadata.page_number) >= c.metadata.page_number
        assert c.metadata.pages[0] == c.metadata.page_number
