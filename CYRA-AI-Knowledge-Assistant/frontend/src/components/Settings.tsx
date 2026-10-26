import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { API_BASE, ApiError, getHealth, listDocuments, removeDocument, uploadDocument } from '../api/client'
import type { HealthResponse, IndexedDocument } from '../api/types'

type Status = { kind: 'checking' } | { kind: 'ok' } | { kind: 'degraded' } | { kind: 'down' }
const label: Record<Status['kind'], string> = {
  checking: 'Checking…', ok: 'Connected', degraded: 'Reachable, but not fully ready (see below)', down: 'Not reachable',
}

export default function Settings({ onClose, onClear }: { onClose(): void; onClear(): void | Promise<void> }) {
  const [status, setStatus] = useState<Status>({ kind: 'checking' })
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [docs, setDocs] = useState<IndexedDocument[] | null>(null)
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null)
  const [uploading, setUploading] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const refresh = useCallback((signal?: AbortSignal) => {
    getHealth(signal)
      .then(h => { setHealth(h); setStatus({ kind: h.status === 'ok' && h.qdrant ? 'ok' : 'degraded' }) })
      .catch(e => { if ((e as Error).name !== 'AbortError') setStatus({ kind: 'down' }) })
    listDocuments(signal).then(setDocs).catch(() => { if (!signal?.aborted) setDocs(null) })
  }, [])
  useEffect(() => { const ac = new AbortController(); refresh(ac.signal); return () => ac.abort() }, [refresh])

  async function onPick(f: File | undefined) {
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setNote({ text: 'Please choose a PDF file.', error: true }); return }
    setUploading(true); setNote({ text: `Reading and indexing ${f.name}… this can take a few minutes for large files.` })
    try {
      const r = await uploadDocument(f)
      setNote({ text: `Indexed ${r.filename} (${r.num_chunks} passages).` }); refresh()
    } catch (e) {
      setNote({ text: e instanceof ApiError ? e.message : 'Upload failed.', error: true })
    } finally { setUploading(false); if (file.current) file.current.value = '' }
  }
  async function onRemove(name: string) {
    if (!confirm(`Remove "${name}" from the index?`)) return
    try { await removeDocument(name); setNote({ text: `Removed ${name}.` }); refresh() }
    catch (e) { setNote({ text: e instanceof ApiError ? e.message : 'Could not remove the document.', error: true }) }
  }

  return (<div className="modal-bg" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-label="Settings" onClick={e => e.stopPropagation()}>
    <div className="mh"><h2>Settings</h2><button className="icon" aria-label="Close settings" onClick={onClose}><X size={18} /></button></div>
    <h3>Server</h3><p className="muted-s" role="status">{label[status.kind]} · {API_BASE}</p>
    {health?.problems?.map(p => <p key={p} className="muted-s err">{p}</p>)}
    <h3>Documents</h3>
    {docs === null ? <p className="muted-s">Document list unavailable.</p>
      : docs.length === 0 ? <p className="muted-s">No documents indexed yet.</p>
      : <ul className="doclist">{docs.map(d => <li key={d.filename}><span>{d.filename}<small> · {d.pages} pages</small></span>
          <button className="icon" aria-label={`Remove ${d.filename}`} onClick={() => onRemove(d.filename)}><X size={14} /></button></li>)}</ul>}
    <input ref={file} type="file" accept="application/pdf,.pdf" hidden onChange={e => onPick(e.target.files?.[0])} />
    <button className="new-doc" disabled={uploading} onClick={() => file.current?.click()}>{uploading ? 'Indexing…' : 'Add a PDF'}</button>
    {note && <p className={`muted-s ${note.error ? 'err' : ''}`} role={note.error ? 'alert' : 'status'}>{note.text}</p>}
    <h3>Conversations</h3><p className="muted-s">The conversation list is stored in this browser only. Clearing it also clears the server's memory of those conversations.</p>
    <button className="danger" onClick={async () => { if (confirm('Delete all conversations from this browser?')) { await onClear(); onClose() } }}>Clear history</button>
    <h3>About</h3><p className="muted-s">CYRA · Your AI Knowledge and Document Assistant.</p></div></div>)
}
