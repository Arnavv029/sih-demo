from unittest.mock import patch

import pymupdf

from backend.ingestion.extract import Text_Extractor


def _pdf(tmp_path, texts):
    doc = pymupdf.open()
    for t in texts:
        page = doc.new_page()
        if t:
            page.insert_text((72, 72), t)
    path = tmp_path / "t.pdf"
    doc.save(str(path))
    doc.close()
    return str(path)


def test_text_pdf_extracts_without_any_ocr(tmp_path):
    pdf = _pdf(tmp_path, ["Extension of Approval rules", "Second page text"])
    with patch("backend.ingestion.extract._ocr_page_full") as full, \
         patch("backend.ingestion.extract._ocr_embedded_images") as imgs:
        pages = Text_Extractor(ocr_available=False).extract(pdf)
    assert [p.page_number for p in pages] == [1, 2]
    assert "Extension of Approval" in pages[0].text
    full.assert_not_called()
    imgs.assert_not_called()


def test_blank_page_is_skipped_quietly_when_ocr_unavailable(tmp_path):
    pdf = _pdf(tmp_path, ["Real text", ""])
    with patch("backend.ingestion.extract._ocr_page_full") as full:
        pages = Text_Extractor(ocr_available=False).extract(pdf)
    assert pages[1].text == ""
    full.assert_not_called()


def test_page_without_text_is_ocrd_when_available(tmp_path):
    pdf = _pdf(tmp_path, ["Real text", ""])
    with patch("backend.ingestion.extract._ocr_page_full", return_value="scanned words") as full:
        pages = Text_Extractor(ocr_available=True).extract(pdf)
    assert pages[1].text == "scanned words"
    full.assert_called_once()


def test_embedded_image_ocr_can_be_switched_off(tmp_path):
    pdf = _pdf(tmp_path, ["Real text"])
    with patch("backend.ingestion.extract._ocr_embedded_images", return_value=["junk"]) as imgs:
        off = Text_Extractor(ocr_available=True, ocr_embedded_images=False).extract(pdf)
        on = Text_Extractor(ocr_available=True, ocr_embedded_images=True).extract(pdf)
    assert "junk" not in off[0].text and "junk" in on[0].text
    assert imgs.call_count == 1
