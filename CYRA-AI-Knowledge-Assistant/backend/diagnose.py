"""
CYRA retrieval diagnostics (no LLM needed unless --llm is given).

    python -m backend.diagnose "What are the requirements for Extension of Approval?"
    python -m backend.diagnose --llm          # also test the Gemini key / model

Shows, step by step, what the chatbot would see: configuration, what is in the
database, the passages retrieved for a question, and why retrieval may be empty.
Stop the backend first (embedded Qdrant allows one process at a time).
Secrets are never printed.
"""
from __future__ import annotations

import argparse
import asyncio
import sys


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(prog="python -m backend.diagnose")
    ap.add_argument("question", nargs="?", help="a question to run retrieval for")
    ap.add_argument("--top-k", type=int, default=None)
    ap.add_argument("--llm", action="store_true", help="make one tiny Gemini call to test the key and model")
    args = ap.parse_args(argv)

    from backend import settings

    settings.load_env()
    rep = settings.validate()
    print("\n== Configuration ==")
    print(f"  project id      : {rep.project_id or 'NOT SET'}")
    print(f"  qdrant          : {rep.qdrant_mode} -> {rep.qdrant_location}")
    print(f"  collection      : {rep.collection}")
    print(f"  corpus folder   : {rep.corpus}")
    print(f"  gemini key set  : {'yes' if rep.llm_configured else 'NO'}   model: {settings.gemini_model()}")
    for p in rep.problems:
        print(f"  PROBLEM: {p}")

    from backend.vector_store import Scope, VectorStoreLockedError, VectorStore

    try:
        store = VectorStore()
    except VectorStoreLockedError as exc:
        print(f"\nERROR: {exc}\n")
        sys.exit(2)

    print("\n== Database ==")
    total = store.count()
    print(f"  chunks in collection (all projects): {total}")
    by_project: dict = {}
    offset = None
    while True:
        recs, offset = store._client.scroll(store.collection_name, limit=500, with_payload=["project_id"],
                                            with_vectors=False, offset=offset)
        for r in recs:
            k = (r.payload or {}).get("project_id")
            by_project[k] = by_project.get(k, 0) + 1
        if offset is None:
            break
    for k, n in sorted(by_project.items(), key=lambda kv: str(kv[0])):
        mark = "  <- this project" if k == rep.project_id else ""
        print(f"  project_id={k!r}: {n} chunks{mark}")
    if rep.project_id and by_project.get(rep.project_id, 0) == 0 and total:
        print("  PROBLEM: chunks exist but NONE carry the configured PROJECT_ID. The chatbot filters by it, so it would find nothing.")
        print("           Fix: re-run  python -m backend.ingestion.run --reset  (or correct PROJECT_ID in .env).")
    if not rep.project_id:
        store.close()
        sys.exit(1)
    scope = Scope(project_id=rep.project_id)
    for d in store.list_documents(scope):
        print(f"  document: {d['filename']}  ({d['chunks']} chunks, {d['pages']} pages)")

    if args.question:
        from backend.embedding import EmbeddingModel

        print("\n== Retrieval ==")
        model = EmbeddingModel()
        emb = model.embed([args.question])[0]
        print(f"  query embedding: dense={len(emb.dense)} dims, sparse terms={len(emb.sparse.indices)}")
        k = args.top_k or settings.top_k()
        hits = store.hybrid_search(emb.dense, emb.sparse, k, scope)
        print(f"  retrieved {len(hits)} passage(s) (top_k={k})")
        for i, h in enumerate(hits, 1):
            snippet = " ".join(h.text.split())[:150]
            print(f"  {i:>2}. score={h.score:.4f}  {h.metadata.filename} p.{h.metadata.page_number}  {snippet}...")
        if not hits:
            print("  PROBLEM: zero passages retrieved. See the Database section above for the likely cause.")
    store.close()

    if args.llm:
        print("\n== Gemini ==")
        if not rep.llm_configured:
            print("  skipped: GOOGLE_API_KEY is not set")
        else:
            from backend.providers import get_provider

            async def ping():
                gen = await get_provider().generate("Reply with the single word: OK", timeout_s=30, stream=False)
                return "".join([t async for t in gen])

            try:
                out = asyncio.run(ping())
                print(f"  OK - model {settings.gemini_model()} replied ({len(out)} characters)")
            except Exception as exc:  # noqa: BLE001
                msg = str(exc)
                key = (__import__("os").environ.get("GOOGLE_API_KEY") or "")
                if key:
                    msg = msg.replace(key, "***")
                print(f"  FAILED: {msg[:300]}")
    print()


if __name__ == "__main__":
    main()
