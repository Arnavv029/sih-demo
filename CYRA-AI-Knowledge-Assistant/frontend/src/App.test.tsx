// UI behaviour tests. `fetch` is stubbed here so these exercise the React
// components and client logic in isolation; they do NOT prove the real backend
// works (see SETUP_GUIDE.md, Part 5, for the manual end-to-end check).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { toSources } from './api/client'
import type { QueryResponse } from './api/types'

const CID = 'c'.repeat(32)
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

const REPLY: QueryResponse = {
  answer: 'Chloroplasts host photosynthesis [bio.pdf, page 3].',
  citations: [{ filename: 'bio.pdf', pages: [3] }],
  chunks: [{ text: 'Chloroplasts perform photosynthesis.', score: 0.9, filename: 'bio.pdf', page_number: 3, chunk_position: 0, language: 'en' }],
}

let calls: { url: string; method: string; body?: string }[]
function mockBackend(handler?: (url: string, init?: RequestInit) => Promise<Response> | undefined) {
  calls = []
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined })
    const custom = handler?.(url, init); if (custom) return custom
    if (url.endsWith('/conversations') && init?.method === 'POST') return json({ conversation_id: CID })
    if (url.includes('/query')) return json(REPLY)
    if (url.endsWith('/healthz')) return json({ status: 'ok', qdrant: true, corpus_count: 1 })
    if (init?.method === 'DELETE') return json({ conversation_id: CID, cleared: true })
    return json({}, 404)
  }))
}
const ask = async (text: string) => {
  const box = screen.getByLabelText('Your question')
  await userEvent.type(box, text); await userEvent.keyboard('{Enter}')
}

beforeEach(() => { localStorage.clear(); mockBackend() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('chat UI', () => {
  it('shows the welcome screen and no upload / document / project controls', () => {
    render(<App />)
    expect(screen.getByText(/Hello! I'm CYRA/)).toBeTruthy()
    expect(document.querySelector('input[type="file"]')).toBeNull()
    for (const re of [/upload/i, /attach/i, /project/i, /library/i]) expect(screen.queryByRole('button', { name: re })).toBeNull()
  })

  it('sends the question to the real endpoints and renders answer + genuine sources', async () => {
    render(<App />)
    await ask('Where does photosynthesis happen?')
    await screen.findByText(/Chloroplasts host photosynthesis/)
    expect(calls.map(c => `${c.method} ${new URL(c.url).pathname}`)).toEqual([
      'POST /conversations', `POST /conversations/${CID}/query`,
    ])
    expect(JSON.parse(calls[1].body!)).toEqual({ q: 'Where does photosynthesis happen?', stream: false })
    const sources = screen.getByLabelText('Sources')
    expect(sources.textContent).toContain('bio.pdf')
    expect(sources.textContent).toContain('p. 3')
    expect(sources.textContent).toContain('Chloroplasts perform photosynthesis.')
  })

  it('does not send a project identifier from the client', async () => {
    render(<App />)
    await ask('hello')
    await screen.findByText(/Chloroplasts host/)
    expect(calls.every(c => !/project/i.test(c.url + (c.body ?? '')))).toBe(true)
  })

  it('prevents duplicate submissions while a request is in flight', async () => {
    let release!: () => void
    mockBackend(url => url.includes('/query')
      ? new Promise<Response>(r => { release = () => r(new Response(JSON.stringify(REPLY), { status: 200 })) })
      : undefined)
    render(<App />)
    await ask('first')
    await waitFor(() => expect(calls.some(c => c.url.includes('/query'))).toBe(true))
    // Type a SECOND question while the first is still in flight and try to submit it.
    await userEvent.type(screen.getByLabelText('Your question'), 'second question')
    await userEvent.keyboard('{Enter}{Enter}')
    expect(calls.filter(c => c.url.includes('/query')).length).toBe(1)
    expect(calls.filter(c => c.url.endsWith('/conversations')).length).toBe(1)
    release(); await screen.findByText(/Chloroplasts host/)
  })

  it('shows a friendly error and a working Retry when the backend is unreachable', async () => {
    mockBackend(() => Promise.reject(new TypeError('Failed to fetch')))
    render(<App />)
    await ask('anything')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Can't reach the server/)
    mockBackend() // backend comes back
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(/Chloroplasts host/)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('surfaces FastAPI error details (e.g. 503 when PROJECT_ID is unset)', async () => {
    mockBackend(url => url.includes('/query') ? json({ detail: 'PROJECT_ID is not configured.' }, 503) : undefined)
    render(<App />)
    await ask('anything')
    expect((await screen.findByRole('alert')).textContent).toMatch(/PROJECT_ID is not configured/)
  })

  it('treats an empty answer as an error instead of showing a blank message', async () => {
    mockBackend(url => url.includes('/query') ? json({ answer: '  ', citations: [], chunks: [] }) : undefined)
    render(<App />)
    await ask('anything')
    expect((await screen.findByRole('alert')).textContent).toMatch(/empty answer/)
  })

  it('New Chat starts a fresh conversation id; conversations can be switched', async () => {
    render(<App />)
    await ask('first question')
    await screen.findByText(/Chloroplasts host/)
    await userEvent.click(screen.getByRole('button', { name: /New Chat/ }))
    expect(screen.getByText(/Hello! I'm CYRA/)).toBeTruthy()
    await ask('second question')
    await waitFor(() => expect(calls.filter(c => c.url.endsWith('/conversations') && c.method === 'POST').length).toBe(2))
    const history = screen.getByRole('navigation', { name: 'Recent conversations' })
    expect(history.querySelectorAll('button').length).toBe(2)
    await userEvent.click(screen.getByRole('button', { name: 'first question' }))
    expect(screen.getAllByText('first question').length).toBeGreaterThan(0)
  })

  it('does not invent conversations: history starts empty', () => {
    render(<App />)
    expect(screen.getByText('No conversations yet.')).toBeTruthy()
  })
})

describe('toSources', () => {
  it('builds one card per cited page using only returned data', () => {
    const s = toSources({
      answer: 'x',
      citations: [{ filename: 'a.pdf', pages: [1, 4] }],
      chunks: [
        { text: 'low', score: 0.1, filename: 'a.pdf', page_number: 1, chunk_position: 0, language: 'en' },
        { text: 'high', score: 0.9, filename: 'a.pdf', page_number: 1, chunk_position: 1, language: 'en' },
        { text: 'other file', score: 0.99, filename: 'b.pdf', page_number: 4, chunk_position: 0, language: 'en' },
      ],
    })
    expect(s.map(x => [x.document, x.page, x.snippet])).toEqual([['a.pdf', 1, 'high'], ['a.pdf', 4, undefined]])
    expect(s[0].url).toMatch(/\/documents\/a\.pdf#page=1$/)
  })
  it('returns nothing when the backend cites nothing', () => {
    expect(toSources({ answer: 'x', citations: [], chunks: [] })).toEqual([])
  })
})

describe('Settings: documents', () => {
  const open = async () => { render(<App />); await userEvent.click(screen.getByRole('button', { name: /Settings/ })) }

  it('lists indexed documents from the backend', async () => {
    mockBackend(url => url.endsWith('/documents') ? json({ documents: [{ filename: 'APH_Final.pdf', chunks: 329, pages: 231 }] }) : undefined)
    await open()
    expect(await screen.findByText(/APH_Final\.pdf/)).toBeTruthy()
    expect(screen.getByText(/231 pages/)).toBeTruthy()
  })

  it('uploads a PDF to /upload and shows the result', async () => {
    mockBackend((url, init) => {
      if (url.endsWith('/upload')) return json({ filename: 'new.pdf', num_chunks: 12, success: true })
      if (url.endsWith('/documents') && !init?.method) return json({ documents: [] })
    })
    await open()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['%PDF-1.4'], 'new.pdf', { type: 'application/pdf' }))
    expect((await screen.findByText(/Indexed new\.pdf \(12 passages\)/))).toBeTruthy()
    expect(calls.some(c => c.url.endsWith('/upload') && c.method === 'POST')).toBe(true)
  })

  it('shows the backend error when an upload is rejected', async () => {
    mockBackend(url => url.endsWith('/upload') ? json({ detail: 'Could not index this PDF: no readable text found' }, 400) : undefined)
    await open()
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    await userEvent.upload(input, new File(['x'], 'bad.pdf', { type: 'application/pdf' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/no readable text/)
  })

  it('shows server problems reported by /healthz (e.g. missing Gemini key)', async () => {
    mockBackend(url => url.endsWith('/healthz') ? json({ status: 'degraded', qdrant: true, corpus_count: 1, problems: ['GOOGLE_API_KEY is not set.'] }) : undefined)
    await open()
    expect(await screen.findByText(/GOOGLE_API_KEY is not set/)).toBeTruthy()
  })
})
