// Types mirroring the REAL FastAPI backend (backend/app.py).
//
//   POST   /conversations                 -> ConversationResponse
//   POST   /conversations/{id}/query      -> QueryResponse   (stream=false)
//   DELETE /conversations/{id}            -> { conversation_id, cleared }
//   GET    /healthz                       -> HealthResponse
//
// The project scope is decided by the server (PROJECT_ID); the client never
// sends or chooses one.

export interface ConversationResponse { conversation_id: string }

export interface QueryRequest { q: string; top_k?: number; stream?: false }

/** One structured citation: a source file and the pages that contributed. */
export interface CitationOut { filename: string; pages: number[] }

/** One retrieved passage with its provenance metadata. */
export interface ChunkOut {
  text: string
  score: number
  filename: string
  page_number: number
  chunk_position: number
  language: string
}

export interface QueryResponse { answer: string; citations: CitationOut[]; chunks: ChunkOut[] }

export interface HealthResponse {
  status: 'ok' | 'degraded'; qdrant: boolean; corpus_count: number
  project_chunks?: number; llm_configured?: boolean; problems?: string[]
}

export interface IndexedDocument { filename: string; chunks: number; pages: number }
export interface UploadResponse { filename: string; num_chunks: number; success: boolean }

/** UI-level source card, derived only from `citations` + `chunks` above. */
export interface Source { id?: number; document: string; page?: number; snippet?: string; url?: string }
