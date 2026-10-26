from backend.retrieval import search_query_from


def test_strips_output_format_instructions():
    q = ("Summarize the key requirements for Extension of Approval (EoA) mentioned in the "
         "uploaded handbook. Include page references if available.")
    assert search_query_from(q) == "key requirements for Extension of Approval (EoA)"


def test_plain_questions_are_unchanged():
    for q in ["Can a women's institution be converted into a co-ed institution?",
              "What is the fee for a new institution?",
              "hello"]:
        assert search_query_from(q) == q


def test_never_returns_empty():
    assert search_query_from("Include page references") != ""
    assert search_query_from("Summarize") == "Summarize"


def test_keeps_topic_words_after_with_citations():
    assert "intake" in search_query_from("Explain increase in intake with page references").lower()
