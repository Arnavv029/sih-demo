import pytest

from backend.smalltalk import small_talk_reply


@pytest.mark.parametrize("message", [
    "hello", " HELLO! ", "Hi?", "hey...", "Hello, CYRA!",
    "how are you?", "How are you doing?!", "good morning", "Thanks!",
])
def test_standalone_smalltalk_has_deterministic_reply(message):
    first = small_talk_reply(message)
    assert first
    assert first == small_talk_reply(message)


@pytest.mark.parametrize("message", [
    "hello, how many years of Extension of Approval?",
    "hi, what does the handbook say about intake?",
    "Tell me how are you doing in the approval process",
    "",
])
def test_document_questions_are_not_treated_as_smalltalk(message):
    assert small_talk_reply(message) is None
