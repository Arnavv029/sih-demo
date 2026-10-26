"""
CYRA — Your AI Knowledge and Document Assistant (FastAPI backend).

Run from the project root:

    python -m uvicorn backend.app:app --host 127.0.0.1 --port 7861

Pipeline: question -> BGE-M3 query embedding -> Qdrant hybrid (dense + sparse)
search, scoped to the configured project -> context -> Gemini -> grounded answer
with [file, page] citations.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import (
    Body, FastAPI, File, HTTPException, Path as PathParam, Request, UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, StreamingResponse
from pydantic import BaseModel, Field

from backend import settings
from backend.smalltalk import small_talk_reply

settings.load_env()  # reads <project root>/.env (never the working directory)

logger = logging.getLogger("cyra")
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

APP_NAME = "CYRA"
APP_TAGLINE = "Your AI Knowledge and Document Assistant"

# Conversation ids are opaque tokens issued by POST /conversations.
_CONVERSATION_ID_PATTERN = r"^[A-Za-z0-9_-]{8,64}$"


# ---------------------------------------------------------------------------
# Lifespan: build every service once; record (never hide) startup problems
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    state = app.state
    state.rag_project_id = None
    state.rag_project_error = None
    state.init_error = None
    state.llm_error = None
    for name in ("rag_embedding_model", "rag_vector_store", "rag_retrieval",
                 "rag_generator", "rag_conversations", "rag_evaluation", "rag_reranker"):
        setattr(state, name, None)

    report = settings.validate()
    state.rag_project_id = report.project_id
    state.rag_project_error = next((p for p in report.problems if "PROJECT_ID" in p), None)
    logger.info("Project scope: %s", report.project_id or "NOT SET")
    logger.info("Qdrant: %s %s (collection=%s)", report.qdrant_mode, report.qdrant_location, report.collection)
    for problem in report.problems:
        logger.warning("CONFIG: %s", problem)

    try:
        from backend.conversation import ConversationStore
        from backend.embedding import EmbeddingModel
        from backend.evaluation import EvaluationService
        from backend.generation import AnswerGenerator
        from backend.providers import get_provider
        from backend.reranker import Reranker
        from backend.retrieval import RetrievalService
        from backend.vector_store import VectorStore

        logger.info("Loading embedding model BAAI/bge-m3 (first run downloads ~2 GB)...")
        state.rag_embedding_model = EmbeddingModel("BAAI/bge-m3")
        state.rag_vector_store = VectorStore()
        state.rag_retrieval = RetrievalService(
            state.rag_embedding_model, state.rag_vector_store, require_scope=True
        )
        state.rag_conversations = ConversationStore()
        state.rag_evaluation = EvaluationService()
        state.rag_reranker = Reranker(enabled=os.getenv("RERANK_ENABLED", "false").lower() == "true")

        provider = get_provider()
        state.rag_generator = AnswerGenerator(
            provider, generation_timeout_s=settings.generation_timeout_s()
        )
        if not report.llm_configured and provider.name == "extractive":
            logger.info("Operating in extractive regulatory synthesis mode (set GOOGLE_API_KEY in .env for full Gemini integration)")
        logger.info("CYRA ready. Indexed chunks (all projects): %s", state.rag_vector_store.count())
    except Exception as exc:  # noqa: BLE001 — recorded and shown by /healthz
        logger.exception("Search engine failed to start")
        state.init_error = f"{type(exc).__name__}: {exc}"

    yield

    if state.rag_vector_store is not None:
        state.rag_vector_store.close()


app = FastAPI(
    title=f"{APP_NAME} API — {APP_TAGLINE}",
    description="Ask questions about your documents and get answers with page citations.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_search(request: Request) -> None:
    """503 with the real reason when the search engine is not usable."""
    st = request.app.state
    if st.rag_retrieval is None:
        detail = (
            f"The search engine did not start: {st.init_error}"
            if st.init_error else "The search engine is not initialised."
        )
        raise HTTPException(status_code=503, detail=detail)


def _require_llm(request: Request) -> None:
    st = request.app.state
    if st.rag_generator is None:
        raise HTTPException(
            status_code=503,
            detail=st.llm_error or "The language model is not configured (GOOGLE_API_KEY).",
        )


def _get_scope(request: Request):
    """Trusted project Scope from server config; 503 if missing (fail closed)."""
    from backend.vector_store import Scope

    pid = request.app.state.rag_project_id
    if not pid:
        raise HTTPException(
            status_code=503,
            detail=request.app.state.rag_project_error or "PROJECT_ID is not configured.",
        )
    return Scope(project_id=pid)


def _public_generation_error(message: str) -> str:
    """Hide provider internals (which could echo request details); keep useful hints."""
    m = message or ""
    if m.startswith("Answer generation timed out"):
        return (
            "Gemini did not respond before the configured deadline. Please try again. "
            "If this keeps happening, check the backend's Gemini timing logs and network connection."
        )
    low = m.lower()
    if "api key" in low or "api_key" in low or "permission" in low or "401" in low or "403" in low:
        return "Gemini rejected the request. Check that GOOGLE_API_KEY in .env is a valid key, then restart the backend."
    if "code=404" in low:
        return "Gemini could not find one of the configured models. Check GEMINI_MODEL and GEMINI_FALLBACK_MODELS in .env against the models available to your Gemini API key, then restart the backend."
    if "429" in low or "quota" in low or "rate limit" in low or "capacity" in low:
        return "Gemini is temporarily unavailable or over quota. Please wait a moment and try again."
    if "503" in low:
        return "Gemini is temporarily experiencing high demand. Please wait a moment and try again."
    if "empty response" in low:
        return "The language model returned no text (possibly blocked by a safety filter). Try rephrasing the question."
    return "Answer generation failed. See the backend terminal for details."


def _safe_document_name(filename: str) -> str:
    if (
        not filename
        or "\x00" in filename
        or filename != os.path.basename(filename.replace("\\", "/"))
        or filename in (".", "..")
    ):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return filename


def _upload_dir() -> str:
    # Uploads live in the corpus folder so ONE folder is the source of truth
    # from which the whole index can be rebuilt.
    return str(settings.resolve_path(os.getenv("PDF_UPLOAD_DIR") or os.getenv("CORPUS_DIR"), settings.DEFAULT_CORPUS_DIR))


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ConversationResponse(BaseModel):
    conversation_id: str


class ConversationQueryPayload(BaseModel):
    q: str = Field(..., description="The question (1-4000 characters).")
    top_k: Optional[int] = Field(None, ge=1, le=50)
    stream: bool = False


class CitationOut(BaseModel):
    filename: str
    pages: list[int]


class ChunkOut(BaseModel):
    text: str
    score: float
    filename: str
    page_number: int
    chunk_position: int
    language: str


class ConversationQueryResponse(BaseModel):
    answer: str
    citations: list[CitationOut]
    chunks: list[ChunkOut]


def _sse_answer(answer: str, citations: list[CitationOut], chunks: list[ChunkOut]) -> StreamingResponse:
    async def sse():
        yield f"data: {json.dumps({'type': 'token', 'text': answer})}\n\n"
        yield f"data: {json.dumps({'type': 'sources', 'data': [c.model_dump() for c in citations]})}\n\n"
        yield f"data: {json.dumps({'type': 'chunks', 'data': [c.model_dump() for c in chunks]})}\n\n"
        yield f"data: {json.dumps({'type': 'end'})}\n\n"

    return StreamingResponse(
        sse(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Basic routes
# ---------------------------------------------------------------------------

@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/docs")


@app.get("/healthz", summary="Health check (canonical route)", tags=["System"])
@app.get("/health", include_in_schema=False)  # alias
async def healthz(request: Request):
    st = request.app.state
    store = st.rag_vector_store
    qdrant_ok, total, scoped, problems = False, 0, 0, []
    if store is not None:
        try:
            total = await asyncio.to_thread(store.count)
            if st.rag_project_id:
                from backend.vector_store import Scope

                scoped = await asyncio.to_thread(store.count, Scope(project_id=st.rag_project_id))
            qdrant_ok = True
        except Exception as exc:  # noqa: BLE001
            problems.append(f"Qdrant error: {type(exc).__name__}")
    if st.init_error:
        problems.append(f"Search engine failed to start: {st.init_error}")
    if st.rag_project_error:
        problems.append(st.rag_project_error)
    if st.llm_error:
        problems.append(st.llm_error)
    if qdrant_ok and st.rag_project_id and scoped == 0:
        problems.append(
            "No documents are indexed for this project yet. Run: python -m backend.ingestion.run"
        )
    ready = qdrant_ok and st.rag_retrieval is not None and st.rag_project_id and st.rag_generator is not None and scoped > 0
    return JSONResponse(
        status_code=200 if qdrant_ok else 503,
        content={
            "status": "ok" if ready else "degraded",
            "app": APP_NAME,
            "qdrant": qdrant_ok,
            "qdrant_mode": getattr(store, "mode", None),
            "qdrant_location": getattr(store, "location", None),
            "collection": store.collection_name if store else None,
            "project_id": st.rag_project_id,
            "corpus_count": total,
            "project_chunks": scoped,
            "llm_configured": st.rag_generator is not None,
            "model": settings.gemini_model(),
            "problems": problems,
        },
    )


# ---------------------------------------------------------------------------
# Conversations
# ---------------------------------------------------------------------------

@app.post("/conversations", response_model=ConversationResponse, tags=["Conversations"],
          summary="Start a new conversation")
async def create_conversation(request: Request):
    _require_search(request)
    return ConversationResponse(conversation_id=uuid.uuid4().hex)


@app.post("/conversations/{conversation_id}/query", tags=["Conversations"],
          summary="Ask a question within a conversation")
async def conversation_query(
    payload: ConversationQueryPayload,
    request: Request,
    conversation_id: str = PathParam(..., pattern=_CONVERSATION_ID_PATTERN),
):
    t0 = time.monotonic()
    query = payload.q
    greeting = small_talk_reply(query)
    if greeting is not None:
        from backend.conversation import Turn

        st = request.app.state
        conversations = getattr(st, "rag_conversations", None)
        if conversations is not None:
            conversations.append(conversation_id, Turn(question=query, answer=greeting))
        elapsed_ms = round((time.monotonic() - t0) * 1000)
        evaluation = getattr(st, "rag_evaluation", None)
        if evaluation is not None:
            evaluation.record_latency_ms(float(elapsed_ms))
        logger.info("query stage=smalltalk status=ok duration_ms=%d", elapsed_ms)
        if payload.stream:
            return _sse_answer(greeting, [], [])
        return ConversationQueryResponse(answer=greeting, citations=[], chunks=[])

    _require_search(request)
    _require_llm(request)
    scope = _get_scope(request)  # server-side only; client input cannot change it

    from backend.conversation import Turn
    from backend.retrieval import InvalidQueryError

    st = request.app.state
    top_k = payload.top_k if payload.top_k is not None else settings.top_k()
    history = st.rag_conversations.history(conversation_id)
    query_stage = {"name": "retrieval"}
    stage_timings: dict[str, int] = {}

    async def run():
        stage_started = time.monotonic()
        retrieval = await asyncio.to_thread(st.rag_retrieval.retrieve, query, top_k, scope)
        stage_timings["retrieval"] = round((time.monotonic() - stage_started) * 1000)
        logger.info(
            "query stage=retrieval status=ok duration_ms=%d candidates=%d",
            stage_timings["retrieval"], len(retrieval.candidates),
        )
        candidates = retrieval.candidates
        if st.rag_reranker.enabled and candidates:
            query_stage["name"] = "reranking"
            stage_started = time.monotonic()
            candidates = await asyncio.to_thread(st.rag_reranker.rerank, query, candidates)
            stage_timings["reranking"] = round((time.monotonic() - stage_started) * 1000)
            logger.info(
                "query stage=reranking status=ok duration_ms=%d candidates=%d",
                stage_timings["reranking"], len(candidates),
            )
        logger.info(
            "query retrieved=%d top_score=%s pages=%s",
            len(candidates),
            f"{candidates[0].score:.4f}" if candidates else "n/a",
            [c.metadata.page_number for c in candidates][:10],
        )
        query_stage["name"] = "generation"
        stage_started = time.monotonic()
        gen = await st.rag_generator.generate(query, candidates, history)
        stage_timings["generation"] = round((time.monotonic() - stage_started) * 1000)
        logger.info(
            "query stage=generation status=%s duration_ms=%d",
            "error" if gen.error else "ok", stage_timings["generation"],
        )
        return gen, candidates

    try:
        gen, candidates = await run()
    except InvalidQueryError as exc:
        st.rag_evaluation.record_latency_ms((time.monotonic() - t0) * 1000.0)
        if payload.stream:
            return _sse_error(str(exc))
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        elapsed_ms = round((time.monotonic() - t0) * 1000)
        failed_stage = query_stage["name"]
        logger.error(
            "query stage=%s status=error duration_ms=%d error_type=%s",
            failed_stage, elapsed_ms, type(exc).__name__,
        )
        st.rag_evaluation.record_latency_ms((time.monotonic() - t0) * 1000.0)
        detail = (
            "Document retrieval failed. Check the backend retrieval logs and verify that the index is available."
            if failed_stage in ("retrieval", "reranking")
            else "Answer generation failed unexpectedly. Check the backend Gemini timing logs, then try again."
        )
        if payload.stream:
            return _sse_error(detail)
        raise HTTPException(status_code=503 if failed_stage in ("retrieval", "reranking") else 500, detail=detail)
    st.rag_evaluation.record_latency_ms((time.monotonic() - t0) * 1000.0)

    if gen.error:
        safe = _public_generation_error(gen.error)
        logger.error(
            "query stage=generation status=error total_duration_ms=%d public_error=%s",
            round((time.monotonic() - t0) * 1000), safe,
        )
        if payload.stream:
            return _sse_error(safe)
        raise HTTPException(status_code=500, detail=safe)

    st.rag_conversations.append(conversation_id, Turn(question=query, answer=gen.answer))
    citations = [CitationOut(filename=c.filename, pages=c.pages) for c in gen.citations]
    chunks = [
        ChunkOut(
            text=c.text, score=c.score, filename=c.metadata.filename,
            page_number=c.metadata.page_number, chunk_position=c.metadata.chunk_position,
            language=c.metadata.language,
        )
        for c in candidates
    ]

    if payload.stream:
        return _sse_answer(gen.answer, citations, chunks)
    return ConversationQueryResponse(answer=gen.answer, citations=citations, chunks=chunks)


def _sse_error(message: str) -> StreamingResponse:
    async def sse():
        yield f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"
    return StreamingResponse(sse(), media_type="text/event-stream")


@app.delete("/conversations/{conversation_id}", tags=["Conversations"],
            summary="Clear a conversation's history")
async def delete_conversation(
    request: Request,
    conversation_id: str = PathParam(..., pattern=_CONVERSATION_ID_PATTERN),
):
    _require_search(request)
    request.app.state.rag_conversations.clear(conversation_id)
    return {"conversation_id": conversation_id, "cleared": True}


@app.get("/metrics", tags=["System"], summary="Latency / evaluation metrics")
async def get_metrics(request: Request):
    _require_search(request)
    report = request.app.state.rag_evaluation.report()

    def d(m):
        return None if m is None else {
            "value": m.value, "sample_size": m.sample_size,
            "error": m.error, "is_insufficient": m.is_insufficient,
        }

    return {
        "p95_latency": d(report.p95_latency), "recall_at_k": d(report.recall_at_k),
        "mrr": d(report.mrr), "citation_accuracy": d(report.citation_accuracy),
        "hallucination_rate": d(report.hallucination_rate),
    }


# ---------------------------------------------------------------------------
# Documents (always scoped to the configured project)
# ---------------------------------------------------------------------------

@app.get("/documents", tags=["Documents"], summary="List indexed documents")
async def list_documents(request: Request):
    _require_search(request)
    scope = _get_scope(request)
    try:
        docs = await asyncio.to_thread(request.app.state.rag_vector_store.list_documents, scope)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to list documents")
        raise HTTPException(status_code=500, detail="Failed to list documents.")
    return {"documents": docs}


@app.delete("/documents/{filename}", tags=["Documents"], summary="Remove a document from the index")
async def delete_document(filename: str, request: Request):
    _require_search(request)
    scope = _get_scope(request)
    filename = _safe_document_name(filename)
    store = request.app.state.rag_vector_store
    try:
        unreferenced = await asyncio.to_thread(store.delete_document, scope, filename)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to delete document")
        raise HTTPException(status_code=500, detail="Failed to delete document.")
    if unreferenced:
        path = os.path.join(_upload_dir(), filename)
        if os.path.isfile(path):
            try:
                os.remove(path)
            except OSError:
                pass
    return {"filename": filename, "deleted": True}


@app.get("/documents/{filename}", tags=["Documents"], summary="Download a document's PDF")
async def get_document_file(filename: str, request: Request):
    import pathlib

    _require_search(request)
    scope = _get_scope(request)
    filename = _safe_document_name(filename)
    store = request.app.state.rag_vector_store
    try:
        allowed = await asyncio.to_thread(store.has_document, scope, filename)
    except Exception:  # noqa: BLE001
        logger.exception("Document lookup failed")
        raise HTTPException(status_code=500, detail="Failed to look up document.")
    if not allowed:
        raise HTTPException(status_code=404, detail="File not found.")

    for base in (_upload_dir(), str(settings.corpus_dir())):
        base_path = pathlib.Path(base)
        if not base_path.is_dir():
            continue
        candidate = base_path / filename
        if not candidate.is_file():
            candidate = next((p for p in base_path.rglob(filename) if p.is_file()), None)
        if candidate is not None:
            resolved = candidate.resolve()
            try:
                resolved.relative_to(base_path.resolve())
            except ValueError:
                continue
            return FileResponse(str(resolved), media_type="application/pdf", filename=filename)
    raise HTTPException(status_code=404, detail="File not found.")


@app.post("/upload", tags=["Documents"], summary="Upload and index a PDF")
async def upload_document(request: Request, file: UploadFile = File(...)):
    _require_search(request)
    scope = _get_scope(request)
    filename = _safe_document_name(file.filename or "")
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    pdf_dir = _upload_dir()
    os.makedirs(pdf_dir, exist_ok=True)
    file_path = os.path.join(pdf_dir, filename)
    existed = os.path.exists(file_path)
    tmp_path = file_path + ".uploading"
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        os.replace(tmp_path, file_path)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to save uploaded file")
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail="Failed to save the uploaded file.")

    from backend.ingestion.build import build_pipeline

    try:
        st = request.app.state
        pipeline, error_log = build_pipeline(st.rag_embedding_model, st.rag_vector_store, scope.project_id)
        result = await asyncio.to_thread(pipeline.ingest_pdf, file_path)
    except Exception:  # noqa: BLE001
        logger.exception("Ingestion failed")
        if not existed and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail="Indexing failed. See the backend terminal for details.")

    if not result.success:
        if not existed and os.path.exists(file_path):
            os.remove(file_path)
        why = "; ".join(e.message for e in result.errors) if result.errors else "no readable text found"
        raise HTTPException(status_code=400, detail=f"Could not index this PDF: {why}")
    return {"filename": filename, "num_chunks": result.num_chunks, "success": True}


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run("backend.app:app", host="127.0.0.1", port=7861)
