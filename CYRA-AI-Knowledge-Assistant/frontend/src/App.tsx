import { useEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Message from './components/Message'
import Composer from './components/Composer'
import Settings from './components/Settings'
import Bunny from './components/Bunny'
import { ApiError, createConversation, deleteConversation, queryConversation, toSources } from './api/client'
import { useChats, uid, type Msg } from './useChats'

const Backdrop = () => (<svg className="backdrop" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden>
  <circle cx="1020" cy="140" r="260" fill="none" stroke="#DCE6F3" strokeWidth="1.5" opacity=".7" />
  <circle cx="1020" cy="140" r="190" fill="#DCE6F3" opacity=".25" />
  <circle cx="120" cy="720" r="220" fill="none" stroke="#E7C98A" strokeWidth="1.2" opacity=".35" />
  <path d="M0 560C220 480 380 640 620 580S1000 470 1200 540" fill="none" stroke="#C9D8EC" strokeWidth="1.5" opacity=".8" />
  <path d="M0 620C240 540 400 700 640 640S1000 530 1200 600V800H0Z" fill="#DCE6F3" opacity=".22" /></svg>)

export default function App() {
  const [chats, setChats] = useChats()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const inFlight = useRef(false) // synchronous guard against duplicate submissions
  const [nav, setNav] = useState(false)
  const [settings, setSettings] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const chat = chats.find(c => c.id === activeId)
  useEffect(() => { end.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }, [chat?.messages.length, busy])

  const patch = (id: string, fn: (m: Msg[]) => Msg[]) => setChats(cs => cs.map(c => c.id === id ? { ...c, messages: fn(c.messages) } : c))

  const fail = (id: string, e: unknown) => {
    if ((e as Error).name === 'AbortError') return
    const msg = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'
    patch(id, ms => [...ms, { id: uid(), role: 'assistant', error: true, at: Date.now(), content: `Couldn't get an answer. ${msg}` }])
  }

  const chatsRef = useRef(chats); chatsRef.current = chats

  // The server keeps the conversation history (keyed by conversation id), so only
  // the new question is sent. Sources come exclusively from the backend response.
  async function ask(chatId: string, question: string) {
    abort.current = new AbortController()
    const { signal } = abort.current
    try {
      let cid = chatsRef.current.find(c => c.id === chatId)?.cid
      if (!cid) { // first message of this chat: obtain a real conversation id
        cid = (await createConversation(signal)).conversation_id
        const issued = cid
        setChats(cs => cs.map(c => c.id === chatId ? { ...c, cid: issued } : c))
      }
      const r = await queryConversation(cid, question, signal)
      const answer = (r.answer ?? '').trim()
      if (!answer) throw new ApiError('The server returned an empty answer.')
      patch(chatId, ms => [...ms, { id: uid(), role: 'assistant', content: answer, sources: toSources(r), at: Date.now() }])
    } catch (e) { fail(chatId, e) }
  }

  async function run(chatId: string, question: string) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setBusyId(chatId)
    try { await ask(chatId, question) } finally { inFlight.current = false; setBusy(false); setBusyId(null) }
  }

  function send(text: string) {
    if (inFlight.current) return
    const m: Msg = { id: uid(), role: 'user', content: text, at: Date.now() }
    let id = chat?.id
    if (!id) { id = uid(); const nid = id; setChats(cs => [{ id: nid, title: text.slice(0, 48), messages: [m] }, ...cs]); setActiveId(nid) }
    else patch(id, ms => [...ms, m])
    void run(id, text)
  }
  function redo() { // drop trailing assistant message, re-ask last question
    if (!chat || inFlight.current) return
    const ms = [...chat.messages]; while (ms.length && ms[ms.length - 1].role === 'assistant') ms.pop()
    const q = ms.pop(); if (!q) return
    patch(chat.id, () => [...ms, q]); void run(chat.id, q.content)
  }
  async function clearAll() {
    abort.current?.abort()
    // Best effort: also clear the server-side history of each known conversation.
    await Promise.allSettled(chats.filter(c => c.cid).map(c => deleteConversation(c.cid!)))
    setChats([]); setActiveId(null)
  }
  const last = chat?.messages[chat.messages.length - 1]

  return (<div className="app">
    <Sidebar chats={chats} activeId={activeId} open={nav} onClose={() => setNav(false)} onNew={() => setActiveId(null)} onSelect={setActiveId} onSettings={() => { setSettings(true); setNav(false) }} />
    <main className="main"><Backdrop />
      <header className="topbar"><button className="icon" aria-label="Open sidebar" onClick={() => setNav(true)}><Menu size={20} /></button><span>CYRA</span></header>
      <div className="scroll">{!chat ? (
        <section className="welcome"><Bunny size={120} /><h1>Hello! I'm CYRA</h1><p className="lead">Your AI Knowledge and Document Assistant.</p>
          <p className="sub">Ask a question about your documents. I'll find the relevant passages and answer with page citations, or tell you when the documents don't say.</p></section>
      ) : (<div className="thread" aria-live="polite">
        {chat.messages.map(m => <Message key={m.id} m={m} canRegenerate={!busy && m === last && m.role === 'assistant'} onRegenerate={redo} onRetry={redo} />)}
        {busy && (busyId === chat.id) && <div className="row bot"><Bunny size={36} className="avatar" /><div className="card typing" role="status" aria-label="Searching documents"><i /><i /><i /></div></div>}
        <div ref={end} /></div>)}</div>
      <div className="dock"><Composer busy={busy} onSend={send} onStop={() => abort.current?.abort()} /></div>
    </main>
    {settings && <Settings onClose={() => setSettings(false)} onClear={clearAll} />}
  </div>)
}
