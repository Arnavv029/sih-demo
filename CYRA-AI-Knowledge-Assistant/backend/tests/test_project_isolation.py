"""Project isolation tests (CYRA).

Proves that a query scoped to one project can never retrieve another
project's chunks, on both the dense and the sparse retrieval branch, through
the retrieval service, the ingestion pipeline and the HTTP API.

All tests use a real in-memory Qdrant (embedded mode) — no mocked search.
"""
from __future__ import annotations

import os
import dataclasses
from unittest.mock import MagicMock, patch

import pytest

os.environ.setdefault("GOOGLE_API_KEY", "test-key")

from backend.data_models import (  # noqa: E402
    Chunk,
    ChunkMetadata,
    EmbeddingResult,
    SparseVector,
)
from backend.project_scope import (  # noqa: E402
    ProjectScopeError,
    resolve_project_id,
    validate_project_id,
)
from backend.retrieval import RetrievalService, ScopeRequiredError  # noqa: E402
from backend.vector_store import Scope, VectorStore  # noqa: E402

DIM = 1024


def _dense(axis: int) -> list[float]:
    v = [0.0] * DIM
    v[axis] = 1.0
    return v


def _emb(dense_axis: int, sparse_idx: int) -> EmbeddingResult:
    return EmbeddingResult(
        dense=_dense(dense_axis),
        sparse=SparseVector(indices=[sparse_idx], values=[1.0]),
    )


def _chunk(text, project, filename, page=1, pos=0, pdf_id=None) -> Chunk:
    return Chunk(
        text=text,
        metadata=ChunkMetadata(
            pdf_id=pdf_id or f"pdf-{project}-{filename}",
            filename=filename,
            page_number=page,
            chunk_position=pos,
            language="en",
            project_id=project,
        ),
    )


@pytest.fixture
def store(monkeypatch):
    monkeypatch.delenv("QDRANT_PATH", raising=False)
    monkeypatch.delenv("QDRANT_URL", raising=False)
    return VectorStore(url="", collection_name="iso_test", auto_ensure=True)


class FakeEmbedding:
    """Every query embeds to the same dense axis / sparse term (axis 0)."""

    def __init__(self):
        self.calls = 0

    def embed(self, texts):
        self.calls += 1
        return [_emb(0, 0) for _ in texts]


def _seed_two_projects(store):
    # Identical vectors for both projects: without a filter BOTH would match.
    store.upsert_chunk(_chunk("alpha text", "proj-a", "a.pdf"), _emb(0, 0))
    store.upsert_chunk(_chunk("beta text", "proj-b", "b.pdf"), _emb(0, 0))


# ---------------------------------------------------------------------------
# project_scope module
# ---------------------------------------------------------------------------

class TestProjectScopeConfig:
    def test_missing_project_id_is_an_error(self):
        with pytest.raises(ProjectScopeError):
            resolve_project_id({})

    @pytest.mark.parametrize("bad", ["", "   ", "../x", "a b", "-lead", "x" * 65, "a/b", "a;b"])
    def test_invalid_project_id_rejected(self, bad):
        with pytest.raises(ProjectScopeError):
            validate_project_id(bad)

    def test_valid_project_id_accepted(self):
        assert resolve_project_id({"PROJECT_ID": " college-1 "}) == "college-1"


# ---------------------------------------------------------------------------
# Scope object
# ---------------------------------------------------------------------------

class TestScope:
    def test_empty_scope_rejected(self):
        with pytest.raises(ValueError):
            Scope()

    @pytest.mark.parametrize("bad", ["", "  "])
    def test_blank_project_rejected(self, bad):
        with pytest.raises(ValueError):
            Scope(project_id=bad)

    def test_legacy_positional_pdf_scope_still_works(self):
        s = Scope("some-pdf")
        assert s.pdf_id == "some-pdf" and s.project_id is None


# ---------------------------------------------------------------------------
# Vector store: dense AND sparse branches are filtered
# ---------------------------------------------------------------------------

class TestVectorStoreScoping:
    def test_scoped_search_returns_only_that_project(self, store):
        _seed_two_projects(store)
        res_a = store.hybrid_search(_dense(0), SparseVector([0], [1.0]), 10, Scope(project_id="proj-a"))
        res_b = store.hybrid_search(_dense(0), SparseVector([0], [1.0]), 10, Scope(project_id="proj-b"))
        assert {c.metadata.filename for c in res_a} == {"a.pdf"}
        assert {c.metadata.filename for c in res_b} == {"b.pdf"}

    def test_unscoped_search_would_see_both(self, store):
        """Control: proves the seed data really overlaps, so the filter is what isolates."""
        _seed_two_projects(store)
        res = store.hybrid_search(_dense(0), SparseVector([0], [1.0]), 10)
        assert {c.metadata.filename for c in res} == {"a.pdf", "b.pdf"}

    def test_dense_branch_is_filtered(self, store):
        # B matches the query ONLY densely (sparse term differs).
        store.upsert_chunk(_chunk("a dense", "proj-a", "a.pdf"), _emb(5, 100))
        store.upsert_chunk(_chunk("b dense", "proj-b", "b.pdf"), _emb(0, 200))
        unscoped = store.hybrid_search(_dense(0), SparseVector([999], [1.0]), 10)
        assert "b.pdf" in {c.metadata.filename for c in unscoped}  # control
        scoped = store.hybrid_search(_dense(0), SparseVector([999], [1.0]), 10, Scope(project_id="proj-a"))
        assert "b.pdf" not in {c.metadata.filename for c in scoped}

    def test_sparse_branch_is_filtered(self, store):
        # B matches the query ONLY lexically (dense axis differs).
        store.upsert_chunk(_chunk("a sparse", "proj-a", "a.pdf"), _emb(7, 300))
        store.upsert_chunk(_chunk("b sparse", "proj-b", "b.pdf"), _emb(9, 400))
        unscoped = store.hybrid_search(_dense(3), SparseVector([400], [1.0]), 10)
        assert "b.pdf" in {c.metadata.filename for c in unscoped}  # control
        scoped = store.hybrid_search(_dense(3), SparseVector([400], [1.0]), 10, Scope(project_id="proj-a"))
        assert "b.pdf" not in {c.metadata.filename for c in scoped}

    def test_untagged_legacy_chunks_are_not_visible_to_a_project(self, store):
        store.upsert_chunk(_chunk("legacy", None, "legacy.pdf"), _emb(0, 0))
        store.upsert_chunk(_chunk("alpha", "proj-a", "a.pdf"), _emb(0, 0))
        res = store.hybrid_search(_dense(0), SparseVector([0], [1.0]), 10, Scope(project_id="proj-a"))
        assert {c.metadata.filename for c in res} == {"a.pdf"}

    def test_same_text_in_two_projects_is_not_deduplicated(self, store):
        store.upsert_chunk(_chunk("same", "proj-a", "x.pdf", pdf_id="p"), _emb(0, 0))
        store.upsert_chunk(_chunk("same", "proj-b", "x.pdf", pdf_id="p"), _emb(0, 0))
        assert store.count() == 2

    def test_project_id_round_trips_in_candidate_metadata(self, store):
        _seed_two_projects(store)
        res = store.hybrid_search(_dense(0), SparseVector([0], [1.0]), 5, Scope(project_id="proj-a"))
        assert res[0].metadata.project_id == "proj-a"


# ---------------------------------------------------------------------------
# Retrieval service: fail closed without a scope
# ---------------------------------------------------------------------------

class TestRetrievalServiceScope:
    def test_require_scope_refuses_unscoped_query_before_embedding(self, store):
        emb = FakeEmbedding()
        svc = RetrievalService(emb, store, require_scope=True)
        with pytest.raises(ScopeRequiredError):
            svc.retrieve("hello", 5)
        assert emb.calls == 0

    def test_scoped_retrieval_is_isolated(self, store):
        _seed_two_projects(store)
        svc = RetrievalService(FakeEmbedding(), store, require_scope=True)
        res = svc.retrieve("anything", 10, Scope(project_id="proj-b"))
        assert {c.metadata.filename for c in res.candidates} == {"b.pdf"}

    def test_default_service_is_backward_compatible(self, store):
        _seed_two_projects(store)
        svc = RetrievalService(FakeEmbedding(), store)  # legacy construction
        res = svc.retrieve("anything", 10)
        assert len(res.candidates) == 2


# ---------------------------------------------------------------------------
# Ingestion: project id is stamped on every chunk and stored in the payload
# ---------------------------------------------------------------------------

class TestIngestionTagging:
    def _pipeline(self, store, project_id, tmp_path, text="doc text"):
        from backend.ingestion.error_log import IngestionErrorLog
        from backend.ingestion.pipeline import IngestionPipeline

        page = MagicMock(); page.page_number = 1; page.text = text
        extractor = MagicMock(); extractor.extract.return_value = [page]
        cleaner = MagicMock(); cleaner.clean_document.side_effect = lambda p: p
        chunker = MagicMock(); chunker.config = MagicMock(max_tokens=800)
        chunker.chunk.side_effect = lambda pages: [
            _chunk(text, None, "doc.pdf", pdf_id="fixed-pdf")
        ]
        emb_model = MagicMock(); emb_model.embed.return_value = [_emb(0, 0)]
        pdf = tmp_path / "doc.pdf"; pdf.write_bytes(b"%PDF-1.4")
        pipe = IngestionPipeline(
            extractor=extractor, cleaner=cleaner, chunker=chunker,
            embedding_model=emb_model, vector_store=store,
            error_log=IngestionErrorLog(), project_id=project_id,
        )
        return pipe, str(pdf)

    def test_chunks_are_tagged_and_isolated(self, store, tmp_path):
        pa, pdf = self._pipeline(store, "proj-a", tmp_path, "shared text")
        pb, _ = self._pipeline(store, "proj-b", tmp_path, "shared text")
        assert pa.ingest_pdf(pdf).success and pb.ingest_pdf(pdf).success
        assert store.count() == 2
        for proj in ("proj-a", "proj-b"):
            res = store.hybrid_search(_dense(0), SparseVector([0], [1.0]), 10, Scope(project_id=proj))
            assert len(res) == 1 and res[0].metadata.project_id == proj

    def test_reingest_is_idempotent_per_project(self, store, tmp_path):
        pa, pdf = self._pipeline(store, "proj-a", tmp_path)
        pa.ingest_pdf(pdf); pa.ingest_pdf(pdf)
        assert store.count() == 1


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------

from backend.app import app  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

CONV = "a" * 32


class FakeProvider:
    name = "fake"

    def __init__(self, text="Grounded answer.", fail=None):
        self.text, self.fail, self.prompts = text, fail, []

    async def generate(self, prompt, *, timeout_s, stream):
        self.prompts.append(prompt)
        if self.fail:
            raise RuntimeError(self.fail)

        async def _gen():
            yield self.text
        return _gen()


@pytest.fixture
def api(store, monkeypatch, tmp_path):
    from backend.conversation import ConversationStore
    from backend.evaluation import EvaluationService
    from backend.generation import AnswerGenerator
    from backend.reranker import Reranker

    provider = FakeProvider()
    monkeypatch.setenv("PDF_UPLOAD_DIR", str(tmp_path / "pdfs"))
    monkeypatch.setenv("CORPUS_DIR", str(tmp_path / "corpus"))
    (tmp_path / "pdfs").mkdir(); (tmp_path / "corpus").mkdir()
    monkeypatch.setenv("PROJECT_ID", "proj-a")
    with TestClient(app) as client:  # lifespan runs; the real model is unavailable here
        app.state.rag_vector_store = store
        app.state.rag_retrieval = RetrievalService(FakeEmbedding(), store, require_scope=True)
        app.state.rag_generator = AnswerGenerator(provider)
        app.state.rag_conversations = ConversationStore()
        app.state.rag_evaluation = EvaluationService()
        app.state.rag_reranker = Reranker(enabled=False)
        app.state.rag_project_id = "proj-a"
        app.state.rag_project_error = None
        app.state.init_error = None
        app.state.llm_error = None
        client.provider = provider
        client.tmp = tmp_path
        yield client


class TestQueryEndpoint:
    def test_greeting_bypasses_retrieval_and_gemini_even_if_unavailable(self, api):
        app.state.rag_retrieval = None
        app.state.rag_generator = None
        app.state.llm_error = "Gemini unavailable"

        r = api.post(f"/conversations/{CONV}/query", json={"q": "  HELLO!!! "})

        assert r.status_code == 200
        body = r.json()
        assert "Hello!" in body["answer"]
        assert body["citations"] == []
        assert body["chunks"] == []
        assert api.provider.prompts == []

    def test_greeting_sse_uses_existing_response_protocol(self, api):
        app.state.rag_retrieval = None
        app.state.rag_generator = None
        r = api.post(f"/conversations/{CONV}/query", json={"q": "hi", "stream": True})
        assert r.status_code == 200
        assert '"type": "token"' in r.text
        assert '"type": "end"' in r.text

    def test_retrieval_failure_has_clear_safe_error(self, api):
        class BrokenRetrieval:
            def retrieve(self, *args, **kwargs):
                raise RuntimeError("private retrieval detail")

        app.state.rag_retrieval = BrokenRetrieval()
        r = api.post(f"/conversations/{CONV}/query", json={"q": "What is Extension of Approval?"})
        assert r.status_code == 503
        assert "Document retrieval failed" in r.json()["detail"]
        assert "private retrieval detail" not in r.text
        assert api.provider.prompts == []

    def test_answer_only_uses_configured_project(self, api, store):
        _seed_two_projects(store)
        r = api.post(f"/conversations/{CONV}/query", json={"q": "what?"})
        assert r.status_code == 200
        body = r.json()
        assert body["answer"] == "Grounded answer."
        assert [c["filename"] for c in body["citations"]] == ["a.pdf"]
        assert {c["filename"] for c in body["chunks"]} == {"a.pdf"}
        assert "beta text" not in api.provider.prompts[0]
        assert "alpha text" in api.provider.prompts[0]

    def test_response_contract(self, api, store):
        _seed_two_projects(store)
        body = api.post(f"/conversations/{CONV}/query", json={"q": "x"}).json()
        assert set(body) == {"answer", "citations", "chunks"}
        assert set(body["citations"][0]) == {"filename", "pages"}
        assert set(body["chunks"][0]) == {
            "text", "score", "filename", "page_number", "chunk_position", "language"
        }

    @pytest.mark.parametrize("extra", [
        {"project_id": "proj-b"}, {"scope": {"project_id": "proj-b"}}, {"projectId": "proj-b"},
    ])
    def test_client_cannot_override_project(self, api, store, extra):
        _seed_two_projects(store)
        r = api.post(f"/conversations/{CONV}/query", json={"q": "x", **extra})
        assert {c["filename"] for c in r.json()["chunks"]} == {"a.pdf"}

    def test_project_header_and_query_param_are_ignored(self, api, store):
        _seed_two_projects(store)
        r = api.post(
            f"/conversations/{CONV}/query?project_id=proj-b",
            json={"q": "x"}, headers={"X-Project-Id": "proj-b"},
        )
        assert {c["filename"] for c in r.json()["chunks"]} == {"a.pdf"}

    def test_missing_project_config_fails_closed(self, api, store):
        _seed_two_projects(store)
        app.state.rag_project_id = None
        app.state.rag_project_error = "PROJECT_ID is not configured."
        r = api.post(f"/conversations/{CONV}/query", json={"q": "x"})
        assert r.status_code == 503
        assert "PROJECT_ID" in r.json()["detail"]
        assert api.provider.prompts == []

    def test_streaming_is_scoped_too(self, api, store):
        _seed_two_projects(store)
        r = api.post(f"/conversations/{CONV}/query", json={"q": "x", "stream": True})
        assert r.status_code == 200
        assert "b.pdf" not in r.text and "a.pdf" in r.text

    def test_empty_corpus_for_project_yields_no_info_not_other_project(self, api, store):
        store.upsert_chunk(_chunk("beta text", "proj-b", "b.pdf"), _emb(0, 0))
        body = api.post(f"/conversations/{CONV}/query", json={"q": "x"}).json()
        assert body["citations"] == [] and body["chunks"] == []
        assert api.provider.prompts == []  # nothing was sent to the LLM

    @pytest.mark.parametrize("bad", ["short", "has space1234", "../../etc/passwd", "x" * 65])
    def test_invalid_conversation_id_rejected(self, api, bad):
        r = api.post(f"/conversations/{bad}/query", json={"q": "x"})
        assert r.status_code in (404, 422)

    def test_empty_question_rejected(self, api):
        assert api.post(f"/conversations/{CONV}/query", json={"q": ""}).status_code == 422

    def test_overlong_question_rejected(self, api):
        assert api.post(f"/conversations/{CONV}/query", json={"q": "x" * 4001}).status_code == 422

    def test_provider_error_does_not_leak_details(self, api, store):
        _seed_two_projects(store)
        api.provider.fail = "boom key=SECRET-123 at http://internal:6333"
        r = api.post(f"/conversations/{CONV}/query", json={"q": "x"})
        assert r.status_code == 500
        assert "SECRET" not in r.text and "internal" not in r.text

    def test_conversations_are_isolated_by_id(self, api, store):
        _seed_two_projects(store)
        api.post(f"/conversations/{CONV}/query", json={"q": "first question"})
        api.post(f"/conversations/{'b' * 32}/query", json={"q": "second question"})
        assert "first question" not in api.provider.prompts[1]


class TestDocumentEndpoints:
    def test_list_is_scoped(self, api, store):
        _seed_two_projects(store)
        docs = api.get("/documents").json()["documents"]
        assert [d["filename"] for d in docs] == ["a.pdf"]

    def test_delete_only_affects_own_project(self, api, store):
        _seed_two_projects(store)
        assert api.delete("/documents/b.pdf").status_code == 200  # not ours: no-op
        assert store.count() == 2
        assert api.delete("/documents/a.pdf").status_code == 200
        assert store.count() == 1

    def test_get_other_projects_file_is_404(self, api, store):
        _seed_two_projects(store)
        (api.tmp / "corpus" / "b.pdf").write_bytes(b"%PDF-1.4 B")
        assert api.get("/documents/b.pdf").status_code == 404

    def test_get_own_file_is_served(self, api, store):
        _seed_two_projects(store)
        (api.tmp / "corpus" / "a.pdf").write_bytes(b"%PDF-1.4 A")
        r = api.get("/documents/a.pdf")
        assert r.status_code == 200 and r.content == b"%PDF-1.4 A"

    @pytest.mark.parametrize("path", ["../secret.pdf", "..%2Fsecret.pdf", "sub/../../x.pdf", "a/b.pdf"])
    def test_path_traversal_blocked(self, api, store, path):
        _seed_two_projects(store)
        (api.tmp / "secret.pdf").write_bytes(b"top secret")
        r = api.get(f"/documents/{path}")
        assert r.status_code in (400, 404)
        assert b"top secret" not in r.content

    def test_upload_rejects_traversal_filename(self, api):
        r = api.post("/upload", files={"file": ("../../evil.pdf", b"%PDF-1.4", "application/pdf")})
        assert r.status_code == 400
        assert not (api.tmp / "evil.pdf").exists()


class TestAdminScopeFailsClosed:
    def test_list_and_get_refuse_without_scope(self, api):
        app.state.rag_project_id = None
        app.state.rag_project_error = "PROJECT_ID is not configured."
        assert api.get("/documents").status_code == 503
        assert api.get("/documents/a.pdf").status_code == 503
        assert api.delete("/documents/a.pdf").status_code == 503


# ---------------------------------------------------------------------------
# Corpus ingestion CLI: project id is mandatory
# ---------------------------------------------------------------------------

class TestIngestionCliRequiresProject:
    def _isolate(self, monkeypatch, tmp_path):
        from backend import settings

        monkeypatch.setattr(settings, "load_env", lambda: None)
        monkeypatch.setenv("CORPUS_DIR", str(tmp_path))

    def test_cli_exits_nonzero_without_project_id(self, monkeypatch, tmp_path):
        from backend.ingestion import run as run_mod

        monkeypatch.delenv("PROJECT_ID", raising=False)
        self._isolate(monkeypatch, tmp_path)
        called = MagicMock()
        monkeypatch.setattr(run_mod, "run_corpus_ingestion", called)
        with pytest.raises(SystemExit) as exc:
            run_mod.main([])
        assert exc.value.code == 1
        called.assert_not_called()

    def test_cli_passes_project_id_to_runner(self, monkeypatch, tmp_path):
        from backend.ingestion import run as run_mod

        monkeypatch.setenv("PROJECT_ID", "proj-a")
        self._isolate(monkeypatch, tmp_path)
        runner = MagicMock(return_value=run_mod.CorpusIngestionRun(1, 1, [], None))
        monkeypatch.setattr(run_mod, "run_corpus_ingestion", runner)
        with pytest.raises(SystemExit) as exc:
            run_mod.main([])
        assert exc.value.code == 0
        assert runner.call_args.kwargs["project_id"] == "proj-a"
        assert runner.call_args.kwargs["reset"] is False

    def test_cli_reset_flag_and_failure_exit_code(self, monkeypatch, tmp_path):
        from backend.ingestion import run as run_mod

        monkeypatch.setenv("PROJECT_ID", "proj-a")
        self._isolate(monkeypatch, tmp_path)
        runner = MagicMock(return_value=run_mod.CorpusIngestionRun(1, 0, ["x.pdf"], None))
        monkeypatch.setattr(run_mod, "run_corpus_ingestion", runner)
        with pytest.raises(SystemExit) as exc:
            run_mod.main(["--reset"])
        assert exc.value.code == 1 and runner.call_args.kwargs["reset"] is True

    def test_run_corpus_ingestion_missing_dir_still_raises(self, tmp_path):
        from backend.ingestion.run import run_corpus_ingestion

        with pytest.raises(FileNotFoundError):
            run_corpus_ingestion(str(tmp_path / "nope"), "log", "", "c", project_id="p")
