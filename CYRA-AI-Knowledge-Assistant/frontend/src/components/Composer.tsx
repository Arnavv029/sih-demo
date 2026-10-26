import { useRef, useState } from 'react'
import { Send, Square } from 'lucide-react'
export default function Composer({ busy, onSend, onStop }: { busy: boolean; onSend(t: string): void; onStop(): void }) {
  const [v, setV] = useState(''); const ref = useRef<HTMLTextAreaElement>(null)
  const submit = () => { const t = v.trim(); if (!t || busy) return; onSend(t); setV(''); if (ref.current) ref.current.style.height = 'auto' }
  return (<div className="composer">
    <textarea ref={ref} rows={1} maxLength={4000} value={v} aria-label="Your question" placeholder="Ask a question about your documents..."
      onChange={e => { setV(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px' }}
      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} />
    {busy ? <button className="send" aria-label="Stop generating" onClick={onStop}><Square size={16} /></button>
      : <button className="send" aria-label="Send question" disabled={!v.trim()} onClick={submit}><Send size={18} /></button>}
  </div>)
}
