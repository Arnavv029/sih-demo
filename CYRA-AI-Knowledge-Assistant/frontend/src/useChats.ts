import { useEffect, useState } from 'react'
import type { Source } from './api/types'
export interface Msg { id: string; role: 'user' | 'assistant'; content: string; sources?: Source[]; error?: boolean; at: number }
// `cid` is the backend conversation id (issued by POST /conversations on first send).
export interface Chat { id: string; title: string; messages: Msg[]; cid?: string }
const KEY = 'cyra.chats.v1'
export const uid = () => crypto.randomUUID()
export function useChats() {
  const [chats, setChats] = useState<Chat[]>(() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] } })
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(chats)) }, [chats])
  return [chats, setChats] as const
}
