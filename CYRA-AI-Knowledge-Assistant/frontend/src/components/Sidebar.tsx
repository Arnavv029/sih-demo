import { Plus, Settings, X } from 'lucide-react'
import Bunny from './Bunny'
import type { Chat } from '../useChats'
interface P { chats: Chat[]; activeId: string | null; open: boolean; onClose(): void; onNew(): void; onSelect(id: string): void; onSettings(): void }
export default function Sidebar({ chats, activeId, open, onClose, onNew, onSelect, onSettings }: P) {
  return (<>
    {open && <div className="scrim" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Sidebar">
      <div className="brand"><Bunny size={44} /><div><strong>CYRA</strong><small>Your AI Knowledge and Document Assistant</small></div>
        <button className="icon mobile-only" aria-label="Close sidebar" onClick={onClose}><X size={18} /></button></div>
      <button className="new" onClick={() => { onNew(); onClose() }}><Plus size={18} /> New Chat</button>
      <h2>Recent Conversations</h2>
      <nav className="history" aria-label="Recent conversations">
        {chats.length === 0 && <p className="muted-s">No conversations yet.</p>}
        {chats.map(c => <button key={c.id} className={c.id === activeId ? 'active' : ''} aria-current={c.id === activeId} onClick={() => { onSelect(c.id); onClose() }}>{c.title}</button>)}
      </nav>
      <button className="settings" onClick={onSettings}><Settings size={18} /> Settings</button>
    </aside></>)
}
