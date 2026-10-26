import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, FileText } from 'lucide-react'
import Bunny from './Bunny'
import type { Msg } from '../useChats'
import { FEEDBACK_PATH, sendFeedback } from '../api/client'
const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
interface P { m: Msg; canRegenerate: boolean; onRegenerate(): void; onRetry(): void }
export default function Message({ m, canRegenerate, onRegenerate, onRetry }: P) {
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  if (m.role === 'user') return <div className="row user"><div className="bubble"><p>{m.content}</p><time>{time(m.at)}</time></div></div>
  const copy = async () => { await navigator.clipboard.writeText(m.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const rate = (v: 'up' | 'down') => { setVote(v); sendFeedback(m.id, v).catch(() => setVote(null)) }
  return (<div className="row bot"><Bunny size={36} className="avatar" />
    <div className="card">
      {m.error ? <div role="alert" className="err"><p>{m.content}</p><button onClick={onRetry}>Retry</button></div>
        : <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: p => <a {...p} target="_blank" rel="noreferrer noopener" /> }}>{m.content}</ReactMarkdown></div>}
      {!!m.sources?.length && <section className="sources" aria-label="Sources"><h3>Sources</h3>
        <ul>{m.sources.map((s, i) => { const inner = <><FileText size={15} /><div><b>[{s.id ?? i + 1}] {s.document}{s.page != null && ` · p. ${s.page}`}</b>{s.snippet && <p>{s.snippet}</p>}</div></>
          return <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{inner}</a> : <div>{inner}</div>}</li> })}</ul></section>}
      {!m.error && <div className="actions">
        <button className="icon" aria-label="Copy answer" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        {canRegenerate && <button className="icon" aria-label="Regenerate response" onClick={onRegenerate}><RefreshCw size={16} /></button>}
        {FEEDBACK_PATH && <><button className={`icon ${vote === 'up' ? 'on' : ''}`} aria-label="Good answer" aria-pressed={vote === 'up'} onClick={() => rate('up')}><ThumbsUp size={16} /></button>
          <button className={`icon ${vote === 'down' ? 'on' : ''}`} aria-label="Bad answer" aria-pressed={vote === 'down'} onClick={() => rate('down')}><ThumbsDown size={16} /></button></>}
        <time>{time(m.at)}</time></div>}
    </div></div>)
}
