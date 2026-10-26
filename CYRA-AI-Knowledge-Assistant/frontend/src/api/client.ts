import type {
  ChunkOut, ConversationResponse, HealthResponse, IndexedDocument, QueryResponse, Source, UploadResponse,
} from './types'

// Same convention as the rest of the project (docker-compose / .env.example).
const env = import.meta.env
export const API_BASE: string = (env.VITE_API_URL || 'http://localhost:7861').replace(/\/$/, '')
// Optional thumbs up/down endpoint. The backend has none, so it stays disabled.
export const FEEDBACK_PATH: string = env.VITE_FEEDBACK_PATH ?? ''

/** Error carrying a message that is safe to show to the user. */
export class ApiError extends Error {
  status: number | null
  constructor(message: string, status: number | null = null) { super(message); this.name = 'ApiError'; this.status = status }
}

/** Turn a FastAPI error body (string or validation-error array) into text. */
function detailOf(body: unknown): string {
  const d = (body as { detail?: unknown } | null)?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d.length) {
    const first = d[0] as { msg?: string }
    return first?.msg ?? 'The request was not valid.'
  }
  return ''
}

async function request<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      ...init, signal,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(`Can't reach the server at ${API_BASE}. Make sure the backend is running.`)
  }
  if (!res.ok) {
    let msg = ''
    try { msg = detailOf(await res.json()) } catch { /* non-JSON error body */ }
    throw new ApiError(msg || `The server returned an error (${res.status}).`, res.status)
  }
  try { return (await res.json()) as T } catch { throw new ApiError('The server sent an unreadable response.', res.status) }
}

export const createConversation = (signal?: AbortSignal) =>
  request<ConversationResponse>('/conversations', { method: 'POST' }, signal)

export const queryConversation = (conversationId: string, q: string, signal?: AbortSignal) =>
  request<QueryResponse>(`/conversations/${encodeURIComponent(conversationId)}/query`,
    { method: 'POST', body: JSON.stringify({ q, stream: false }) }, signal)

export const deleteConversation = (conversationId: string) =>
  request<{ conversation_id: string; cleared: boolean }>(`/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' })

export const getHealth = (signal?: AbortSignal) => request<HealthResponse>('/healthz', {}, signal)

export const listDocuments = (signal?: AbortSignal) =>
  request<{ documents: IndexedDocument[] }>('/documents', {}, signal).then(r => r.documents)

export const removeDocument = (filename: string) =>
  request<{ filename: string; deleted: boolean }>(`/documents/${encodeURIComponent(filename)}`, { method: 'DELETE' })

/** Upload a PDF; the backend extracts, chunks, embeds and indexes it before replying. */
export async function uploadDocument(file: File): Promise<UploadResponse> {
  const body = new FormData()
  body.append('file', file)
  let res: Response
  try { res = await fetch(API_BASE + '/upload', { method: 'POST', body }) }
  catch { throw new ApiError(`Can't reach the server at ${API_BASE}. Make sure the backend is running.`) }
  if (!res.ok) {
    let msg = ''
    try { msg = detailOf(await res.json()) } catch { /* non-JSON error body */ }
    throw new ApiError(msg || `The server returned an error (${res.status}).`, res.status)
  }
  return (await res.json()) as UploadResponse
}

export const sendFeedback = async (messageId: string, value: 'up' | 'down') => {
  if (!FEEDBACK_PATH) return
  await request(FEEDBACK_PATH, { method: 'POST', body: JSON.stringify({ message_id: messageId, value }) })
}

const SNIPPET_CHARS = 220
const snippetOf = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > SNIPPET_CHARS ? t.slice(0, SNIPPET_CHARS).trimEnd() + '…' : t
}

/**
 * Build source cards ONLY from what the backend returned: one card per cited
 * (file, page). The snippet is the text of the highest-scoring retrieved chunk
 * for that exact file and page; the link points at the backend's own document
 * endpoint (scoped to the configured project server-side).
 */
export function toSources(r: QueryResponse): Source[] {
  const out: Source[] = []
  let n = 1
  for (const c of r.citations ?? []) {
    for (const page of c.pages ?? []) {
      const best = (r.chunks ?? [])
        .filter((k: ChunkOut) => k.filename === c.filename && k.page_number === page)
        .sort((a, b) => b.score - a.score)[0]
      out.push({
        id: n++, document: c.filename, page,
        snippet: best ? snippetOf(best.text) : undefined,
        url: `${API_BASE}/documents/${encodeURIComponent(c.filename)}#page=${page}`,
      })
    }
  }
  return out
}
