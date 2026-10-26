/**
 * AICTE Regulatory RAG Assistant API Client
 * Connects the AICTE Frontend directly to the CYRA RAG Backend (FastAPI + Qdrant + Gemini/Extractive).
 */

// Try local Vite proxy first (/api/rag), fallback directly to http://127.0.0.1:7861
const API_PROXY = '/api/rag';
const DIRECT_BACKEND = 'http://127.0.0.1:7861';

async function fetchWithFallback(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Try proxy first
  try {
    const res = await fetch(`${API_PROXY}${cleanEndpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });
    if (res.ok || res.status === 400 || res.status === 422 || res.status === 503) {
      return res;
    }
  } catch (err) {
    // Proxy may not be responding or direct access preferred
  }

  // Fallback to direct backend URL
  try {
    const directRes = await fetch(`${DIRECT_BACKEND}${cleanEndpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    });
    return directRes;
  } catch (directErr) {
    throw new Error(`Unable to connect to AICTE RAG Backend at ${DIRECT_BACKEND}. Please verify the service is running.`);
  }
}

/**
 * Health check for Qdrant vector store and backend services
 */
export async function getRagHealth() {
  try {
    const res = await fetchWithFallback('/healthz');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        online: false,
        status: data.status || 'degraded',
        problems: data.problems || ['Backend not ready'],
        corpus_count: data.corpus_count || 0,
        project_chunks: data.project_chunks || 0,
      };
    }
    const data = await res.json();
    return {
      online: true,
      status: data.status || 'ok',
      qdrant: Boolean(data.qdrant),
      corpus_count: data.corpus_count || 0,
      project_chunks: data.project_chunks || 0,
      model: data.model || 'gemini-3.8-flash',
      problems: data.problems || [],
    };
  } catch (err) {
    return {
      online: false,
      status: 'offline',
      problems: [err.message],
      corpus_count: 0,
      project_chunks: 0,
    };
  }
}

/**
 * Create a new conversation session
 */
export async function createConversation() {
  const res = await fetchWithFallback('/conversations', {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to create conversation' }));
    throw new Error(err.detail || 'Could not start conversation session');
  }
  return await res.json(); // { conversation_id }
}

/**
 * Query the AICTE Knowledge RAG Assistant
 */
export async function queryConversation(conversationId, question, topK = 6) {
  const res = await fetchWithFallback(`/conversations/${encodeURIComponent(conversationId)}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: question,
      top_k: topK,
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `Query failed with status ${res.status}` }));
    throw new Error(err.detail || 'Failed to retrieve response from AICTE RAG Assistant');
  }

  const data = await res.json();
  // Formats data to include citation details
  return {
    answer: data.answer || '',
    citations: data.citations || [],
    chunks: data.chunks || [],
  };
}

/**
 * List all indexed documents in AICTE Project scope
 */
export async function listRagDocuments() {
  const res = await fetchWithFallback('/documents');
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.documents || [];
}

/**
 * Upload and index a regulatory or institutional PDF into Qdrant in real-time
 */
export async function uploadRagDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchWithFallback('/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Upload and indexing failed' }));
    throw new Error(err.detail || 'Failed to index document in AICTE RAG vector store');
  }

  return await res.json(); // { filename, num_chunks, success }
}

/**
 * Delete a document from vector index
 */
export async function deleteRagDocument(filename) {
  const res = await fetchWithFallback(`/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to remove document ${filename}`);
  }
  return await res.json();
}
