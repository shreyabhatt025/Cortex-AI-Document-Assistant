import { useState, useRef, useEffect, useCallback } from 'react'
import LandingPage from './LandingPage'
import AuthPage    from './AuthPage'

// ── Constants ─────────────────────────────────────────────────────────────────
// NOTE: chat messages now live in MongoDB (see /chats routes), not
// localStorage — each saved conversation is its own document there.
const USER_STORAGE_KEY = 'cortex_user'
const TOKEN_KEY        = 'cortex_token'
const THEME_KEY        = 'cortex_theme'

const WELCOME = {
  id:      'welcome',
  role:    'assistant',
  text:    "Hello. I'm **Cortex** — your AI-powered document assistant.\n\nUpload a PDF and ask me anything about it. I'll find the exact answer from your document, complete with source citations.",
  sources: [],
  done:    true,
}

const SUGGESTIONS = [
  'How do I process a refund?',
  'What is the escalation procedure?',
  'How to onboard a new employee?',
  'What are the leave policies?',
]

// ── localStorage helpers ──────────────────────────────────────────────────────
function loadUser()  {
  try { return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) } catch { return null }
}
function loadToken() {
  return localStorage.getItem(TOKEN_KEY) || null
}
function loadDarkMode() {
  return localStorage.getItem(THEME_KEY) === 'dark'
}

// ── Rich text renderer ────────────────────────────────────────────────────────
function RichText({ text }) {
  return text.split('\n').map((line, i, arr) => {
    const segs = line.split(/\*\*(.*?)\*\*/g)
    return (
      <span key={i}>
        {segs.map((seg, j) => j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg)}
        {i < arr.length - 1 && <br />}
      </span>
    )
  })
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function LogoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  )
}
function ChatIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function UploadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
function UploadBigIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
function SignOutIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
function PinIcon({ filled }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14l-1.4-1.4a2 2 0 0 1-.6-1.4V7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7.2a2 2 0 0 1-.6 1.4L5 17z" />
    </svg>
  )
}
function EditIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  )
}
function ShareIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" /><line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
    </svg>
  )
}

// ── Source Drawer ─────────────────────────────────────────────────────────────
function SourceDrawer({ source, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  if (!source) return null

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <div className="drawer-header-left">
            <div className="drawer-icon"><DocIcon /></div>
            <div className="drawer-title-group">
              <span className="drawer-title">{source.file}</span>
              <span className="drawer-subtitle">Chunk {source.chunkIndex + 1}</span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}><CloseIcon /></button>
        </div>
        {source.score && (
          <div className="drawer-meta">
            <span className="drawer-meta-label">Relevance score</span>
            <span className="drawer-score">{(source.score * 100).toFixed(1)}%</span>
          </div>
        )}
        <div className="drawer-divider" />
        <div className="drawer-body">
          <p className="drawer-eyebrow">Retrieved chunk</p>
          <div className="drawer-text">{source.preview}</div>
        </div>
        <div className="drawer-footer">
          <span className="drawer-footer-note">
            This chunk was used as context when generating the answer above.
          </span>
        </div>
      </div>
    </>
  )
}

// ── User Avatar ───────────────────────────────────────────────────────────────
function UserAvatar({ user, size = 28 }) {
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'
  return (
    <div className="user-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  )
}

// ── Shared (public, read-only) chat view ────────────────────────────────────
// Rendered instead of the whole app when the URL has ?shared=SOME_ID.
// No login required — this is the entire point of a share link.
function SharedChatView({ shareId, darkMode, toggleDarkMode }) {
  const [status, setStatus] = useState('loading') // loading | ok | error
  const [chat,   setChat]   = useState(null)

  useEffect(() => {
    fetch(`/shared/${shareId}`)
      .then(res => {
        if (!res.ok) throw new Error('not found')
        return res.json()
      })
      .then(data => { setChat(data); setStatus('ok') })
      .catch(() => setStatus('error'))
  }, [shareId])

  return (
    <div className="shared-shell">
      <div className="shared-topbar">
        <div className="brand">
          <div className="brand-mark"><LogoIcon /></div>
          <div className="brand-copy">
            <span className="brand-name">Cortex</span>
            <span className="brand-tagline">AI Assistant</span>
          </div>
        </div>
        <div className="shared-topbar-right">
          <span className="shared-badge">Shared conversation · Read-only</span>
          <button className="theme-toggle-sm" onClick={toggleDarkMode} title="Toggle theme">
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {status === 'loading' && <div className="shared-state">Loading conversation…</div>}

      {status === 'error' && (
        <div className="shared-state shared-state-error">
          This link is invalid or has been revoked by its owner.
        </div>
      )}

      {status === 'ok' && (
        <div className="shared-body">
          <h1 className="shared-title">{chat.title}</h1>
          <div className="msg-list">
            {chat.messages.map(msg => (
              <div key={msg.id} className={`msg-row msg-${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="avatar avatar-ai"><LogoIcon /></div>
                )}
                <div className="msg-content">
                  <div className={`bubble bubble-${msg.role}`}>
                    <RichText text={msg.text} />
                  </div>
                  {msg.sources?.length > 0 && (
                    <div className="source-row">
                      <span className="source-label">Sources</span>
                      {msg.sources.map((src, i) => (
                        <span key={i} className="source-chip source-chip-static">
                          <DocIcon />{src.file}
                          {src.score && <span className="source-score">{(src.score * 100).toFixed(0)}%</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="avatar avatar-user">
                    <div className="user-initials" style={{ width: 28, height: 28, fontSize: 11 }}>?</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(loadUser)
  const [token,       setToken]       = useState(loadToken)
  const [page,        setPage]        = useState(() => loadUser() && loadToken() ? 'app' : 'landing')
  const [verifyToken, setVerifyToken] = useState(null)
  const [resetToken,  setResetToken]  = useState(null)   // ← CHANGE 1: new state for ?reset= token
  const [darkMode,    setDarkMode]    = useState(loadDarkMode)
  const [messages,    setMessages]    = useState([WELCOME])
  const [input,       setInput]       = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [view,        setView]        = useState('chat')
  const [uploadState, setUploadState] = useState('idle')
  const [uploadData,  setUploadData]  = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [drawer,      setDrawer]      = useState(null)

  // ── Chat history (sidebar list) ────────────────────────────────────────
  const [chats,        setChats]        = useState([])
  const [chatsLoading,  setChatsLoading] = useState(true)
  const [activeChatId, setActiveChatId] = useState(null)   // null = new, unsaved chat
  const [renamingId,   setRenamingId]   = useState(null)
  const [renameValue,  setRenameValue]  = useState('')
  const [shareToast,   setShareToast]   = useState(null)

  // ── Public "view a shared chat" mode ───────────────────────────────────
  // If the URL has ?shared=SOME_ID, we skip the normal app entirely and
  // render a read-only view — no login required, same as any share link.
  const [sharedId] = useState(() => new URLSearchParams(window.location.search).get('shared'))

  const bottomRef       = useRef(null)
  const textareaRef     = useRef(null)
  const fileRef          = useRef(null)
  const activeChatIdRef  = useRef(null) // mirrors activeChatId, read inside sendMessage to avoid stale closures

  // ── CHANGE 2: Detect ?verify=TOKEN and ?reset=TOKEN in URL on first load ──
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search)
    const emailToken = params.get('verify')
    const resetTok   = params.get('reset')

    if (emailToken) {
      setVerifyToken(emailToken)
      setPage('auth')
    } else if (resetTok) {
      setResetToken(resetTok)
      setPage('auth')
    }
  }, [])

  // Apply dark/light class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode)
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Keep the ref in sync so sendMessage() (a useCallback that isn't
  // re-created on every render) always reads the *current* chat id,
  // not a stale one captured when the callback was first created.
  useEffect(() => {
    activeChatIdRef.current = activeChatId
  }, [activeChatId])

  // Fetch the sidebar chat list once we're in the main app.
  const fetchChats = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch('/chats', { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.status === 401) { handleSignOut(); return }
      const data = await res.json()
      if (res.ok) setChats(data.chats || [])
    } catch (err) {
      console.log('error fetching chats:', err.message)
    } finally {
      setChatsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (page === 'app') fetchChats()
  }, [page, fetchChats])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [input])

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleAuth = (userData, jwtToken) => {
    setUser(userData)
    setToken(jwtToken)
    setVerifyToken(null)
    setResetToken(null)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
    localStorage.setItem(TOKEN_KEY, jwtToken)
    setPage('app')
  }

  const handleSignOut = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(TOKEN_KEY)
    setMessages([WELCOME])
    setChats([])
    setActiveChatId(null)
    setPage('landing')
  }

  const toggleDarkMode = () => setDarkMode(d => !d)

  // Start a brand-new, unsaved chat. The backend only actually creates
  // a chat document once the first question is sent (see sendMessage) —
  // this just resets the local view.
  const startNewChat = () => {
    setActiveChatId(null)
    activeChatIdRef.current = null
    setMessages([WELCOME])
    setInput('')
  }

  // Load an existing chat's full message history and make it active.
  const openChat = async (id) => {
    if (id === activeChatId) return
    try {
      const res = await fetch(`/chats/${id}`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.status === 401) { handleSignOut(); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'could not load chat')
      const loaded = (data.chat.messages || []).map(m => ({ ...m, done: true }))
      setMessages(loaded.length ? loaded : [WELCOME])
      setActiveChatId(id)
      activeChatIdRef.current = id
    } catch (err) {
      console.log('error loading chat:', err.message)
    }
  }

  // Pin / unpin a chat. Optimistic-ish: just refetches the list after
  // the PUT succeeds, since pin also changes sort order.
  const togglePin = async (chat, e) => {
    e.stopPropagation()
    try {
      const res = await fetch(`/chats/${chat._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ pinned: !chat.pinned }),
      })
      if (res.ok) fetchChats()
    } catch (err) {
      console.log('error toggling pin:', err.message)
    }
  }

  const startRename = (chat, e) => {
    e.stopPropagation()
    setRenamingId(chat._id)
    setRenameValue(chat.title)
  }

  const submitRename = async (id) => {
    const title = renameValue.trim()
    setRenamingId(null)
    if (!title) return
    try {
      const res = await fetch(`/chats/${id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ title }),
      })
      if (res.ok) fetchChats()
    } catch (err) {
      console.log('error renaming chat:', err.message)
    }
  }

  const deleteChatItem = async (id, e) => {
    e.stopPropagation()
    if (!window.confirm('Delete this chat? This cannot be undone.')) return
    try {
      const res = await fetch(`/chats/${id}`, {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      if (res.ok) {
        if (id === activeChatId) startNewChat()
        fetchChats()
      }
    } catch (err) {
      console.log('error deleting chat:', err.message)
    }
  }

  // Turns on sharing for this chat and copies the public link to the
  // clipboard. Calling it again on an already-shared chat is fine —
  // the backend just issues a fresh link.
  const shareChat = async (id, e) => {
    e.stopPropagation()
    try {
      const res  = await fetch(`/chats/${id}/share`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'could not create share link')

      const link = `${window.location.origin}${window.location.pathname}?shared=${data.shareId}`
      await navigator.clipboard.writeText(link)
      setShareToast('Link copied to clipboard!')
    } catch (err) {
      setShareToast(err.message || 'Could not create share link')
    } finally {
      setTimeout(() => setShareToast(null), 2500)
    }
  }

  // ── SSE streaming ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (override) => {
    const q = (override ?? input).trim()
    if (!q || isStreaming) return

    setInput('')
    setIsStreaming(true)

    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: q, done: true },
    ])

    const aiId = `a-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { id: aiId, role: 'assistant', text: '', sources: [], done: false },
    ])

    try {
      const res = await fetch('/ask', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question: q, chatId: activeChatIdRef.current }),
      })

      if (res.status === 401) { handleSignOut(); return }
      if (!res.ok) throw new Error(`Server returned ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const tok = line.slice(6)

          if (tok === '[DONE]') break outer

          // Sent once, right at the start of the stream. Tells us which
          // chat this exchange belongs to — matters most when this was
          // a brand-new chat, since we didn't have an id until the
          // backend created one just now.
          if (tok.startsWith('[CHAT_ID]')) {
            const id = tok.slice(9)
            if (!activeChatIdRef.current) {
              activeChatIdRef.current = id
              setActiveChatId(id)
            }
            continue
          }

          if (tok.startsWith('[SOURCES]')) {
            try {
              const payload = JSON.parse(tok.slice(9))
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, sources: payload.sources || [] } : m
              ))
            } catch {}
            continue
          }

          if (tok.startsWith('ERROR:')) {
            setMessages(prev => prev.map(m =>
              m.id === aiId
                ? { ...m, text: tok.replace('ERROR:', '').trim(), done: true, error: true }
                : m
            ))
            break outer
          }

          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, text: m.text + tok } : m
          ))
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiId
          ? { ...m, text: `Connection error: ${err.message}`, done: true, error: true }
          : m
      ))
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, done: true } : m
      ))
      setIsStreaming(false)
      textareaRef.current?.focus()
      fetchChats() // pick up the new/updated title and refreshed sort order
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isStreaming, token, fetchChats])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setUploadState('error')
      setUploadData({ message: 'Only PDF files are accepted.' })
      return
    }
    setUploadState('loading')
    setUploadData(null)
    const fd = new FormData()
    fd.append('pdf', file)
    try {
      const res = await fetch('/upload', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body:    fd,
      })
      if (res.status === 401) { handleSignOut(); return }
      const data = await res.json()
      if (res.ok) { setUploadState('success'); setUploadData(data) }
      else throw new Error(data.error || 'Upload failed')
    } catch (err) {
      setUploadState('error')
      setUploadData({ message: err.message })
    }
  }

  // ── Page routing ──────────────────────────────────────────────────────────

  // SHARED CHAT VIEW — bypasses login entirely. Checked first, before
  // landing/auth/app, since a share link should work for someone who
  // has never signed in at all.
  if (sharedId) {
    return <SharedChatView shareId={sharedId} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
  }

  // LANDING PAGE
  if (page === 'landing') {
    return (
      <LandingPage
        onGetStarted={() => setPage('auth')}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
      />
    )
  }

  // AUTH PAGE — CHANGE 3: pass initialResetToken prop
  if (page === 'auth') {
    return (
      <AuthPage
        onAuth={handleAuth}
        onBack={() => setPage('landing')}
        initialVerifyToken={verifyToken}
        initialResetToken={resetToken}
      />
    )
  }

  // ── Main App ──────────────────────────────────────────────────────────────
  return (
    <div className="shell">
      <SourceDrawer source={drawer} onClose={() => setDrawer(null)} />

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><LogoIcon /></div>
          <div className="brand-copy">
            <span className="brand-name">Cortex</span>
            <span className="brand-tagline">AI Assistant</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <nav className="nav">
          <button className={`nav-item${view === 'chat' ? ' nav-active' : ''}`} onClick={() => setView('chat')}>
            <ChatIcon /><span>Chat</span>
          </button>
          <button className={`nav-item${view === 'upload' ? ' nav-active' : ''}`} onClick={() => setView('upload')}>
            <UploadIcon /><span>Upload SOP</span>
          </button>
        </nav>

        <button className="new-chat-btn" onClick={() => { setView('chat'); startNewChat() }}>
          <PlusIcon /><span>New chat</span>
        </button>

        <div className="chat-list">
          {chatsLoading && <p className="chat-list-empty">Loading…</p>}
          {!chatsLoading && chats.length === 0 && (
            <p className="chat-list-empty">No chats yet — ask something to start one.</p>
          )}
          {chats.map(chat => (
            <div
              key={chat._id}
              className={`chat-item-row${chat._id === activeChatId ? ' chat-item-row-active' : ''}`}
            >
              {renamingId === chat._id ? (
                <input
                  className="chat-rename-input"
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={() => submitRename(chat._id)}
                  onClick={e => e.stopPropagation()}
                  onKeyDown={e => {
                    if (e.key === 'Enter')  submitRename(chat._id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                />
              ) : (
                <button
                  className="chat-item"
                  onClick={() => { setView('chat'); openChat(chat._id) }}
                  title={chat.title}
                >
                  {chat.pinned && <PinIcon filled />}
                  <span className="chat-item-title">{chat.title}</span>
                </button>
              )}

              <div className="chat-item-actions">
                <button className="chat-action-btn" title={chat.pinned ? 'Unpin' : 'Pin'} onClick={e => togglePin(chat, e)}>
                  <PinIcon filled={chat.pinned} />
                </button>
                <button className="chat-action-btn" title="Rename" onClick={e => startRename(chat, e)}>
                  <EditIcon />
                </button>
                <button className="chat-action-btn" title="Share" onClick={e => shareChat(chat._id, e)}>
                  <ShareIcon />
                </button>
                <button className="chat-action-btn chat-action-danger" title="Delete" onClick={e => deleteChatItem(chat._id, e)}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
        </div>

        {shareToast && <div className="share-toast">{shareToast}</div>}

        <div className="sidebar-footer">
          {user && (
            <div className="sidebar-user">
              <UserAvatar user={user} size={28} />
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name}</span>
                {user.email && <span className="sidebar-user-email">{user.email}</span>}
              </div>
            </div>
          )}

          <div className="sidebar-controls">
            <button className="theme-toggle-sm" onClick={toggleDarkMode} title="Toggle theme">
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="signout-btn" onClick={handleSignOut}>
              <SignOutIcon /><span>Sign out</span>
            </button>
          </div>

        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────── */}
      <div className="main">

        {/* CHAT VIEW */}
        {view === 'chat' && (
          <div className="chat-shell">
            <div className="chat-topbar">
              <div className="chat-topbar-left">
                <h1 className="chat-title">SOP Assistant</h1>
                <span className="chat-subtitle">Answers grounded in your uploaded documents</span>
              </div>
              <div className="chat-topbar-right" />

            </div>

            <div className="msg-scroll">
              <div className="msg-list">
                {messages.map(msg => (
                  <div key={msg.id} className={`msg-row msg-${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="avatar avatar-ai"><LogoIcon /></div>
                    )}
                    <div className="msg-content">
                      <div className={`bubble bubble-${msg.role}${msg.error ? ' bubble-error' : ''}`}>
                        {msg.text ? <RichText text={msg.text} /> : !msg.done && <span className="cursor" />}
                        {!msg.done && msg.text && <span className="cursor" />}
                      </div>
                      {msg.sources?.length > 0 && (
                        <div className="source-row">
                          <span className="source-label">Sources</span>
                          {msg.sources.map((src, i) => (
                            <button key={i} className="source-chip" onClick={() => setDrawer(src)}>
                              <DocIcon />{src.file}
                              {src.score && <span className="source-score">{(src.score * 100).toFixed(0)}%</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="avatar avatar-user">
                        <UserAvatar user={user} size={28} />
                      </div>
                    )}
                  </div>
                ))}
                {isStreaming && messages.at(-1)?.text === '' && (
                  <div className="thinking"><span /><span /><span /></div>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            {messages.length === 1 && (
              <div className="suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="sugg-chip" onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            )}

            <div className="input-area">
              <div className={`input-ring${isStreaming ? ' input-ring-busy' : ''}`}>
                <textarea
                  ref={textareaRef}
                  className="input-ta"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about any policy, procedure, or SOP…"
                  rows={1}
                  disabled={isStreaming}
                />
                <button
                  className={`send-btn${(!input.trim() || isStreaming) ? ' send-btn-off' : ''}`}
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isStreaming}
                >
                  {isStreaming ? <span className="btn-spin" /> : <SendIcon />}
                </button>
              </div>
              <p className="input-hint">↵ Enter to send &nbsp;·&nbsp; ⇧ Shift+Enter for new line</p>
            </div>
          </div>
        )}

        {/* UPLOAD VIEW */}
        {view === 'upload' && (
          <div className="upload-shell">
            <div className="upload-topbar">
              <h1 className="upload-title">Upload SOP Document</h1>
              <p className="upload-sub">Add PDFs to the knowledge base. Each file is parsed, chunked, embedded, and indexed automatically.</p>
            </div>
            <div className="pipeline">
              {[
                { n: 1, label: 'Parse PDF',      desc: 'Extract raw text from document' },
                { n: 2, label: 'Chunk Text',     desc: '1000 chars · 100 char overlap'  },
                { n: 3, label: 'Embed Vectors',  desc: '384-dim local embedding model'  },
                { n: 4, label: 'Store in Atlas', desc: 'MongoDB vector search index'    },
              ].map((step, i, arr) => (
                <div key={step.n} className="pipe-item">
                  <div className="pipe-step">
                    <div className="pipe-num">{step.n}</div>
                    <div className="pipe-text">
                      <span className="pipe-label">{step.label}</span>
                      <span className="pipe-desc">{step.desc}</span>
                    </div>
                  </div>
                  {i < arr.length - 1 && <div className="pipe-connector" />}
                </div>
              ))}
            </div>
            <div
              className={`dropzone${dragOver ? ' dz-active' : ''} dz-${uploadState}`}
              onClick={() => uploadState !== 'loading' && fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}
            >
              <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => handleUpload(e.target.files[0])} />
              {uploadState === 'idle' && (
                <div className="dz-content">
                  <div className="dz-icon"><UploadBigIcon /></div>
                  <p className="dz-primary">Drop PDF here or click to browse</p>
                  <p className="dz-secondary">PDF files only · Max 50MB</p>
                </div>
              )}
              {uploadState === 'loading' && (
                <div className="dz-content">
                  <div className="dz-spinner" />
                  <p className="dz-primary">Processing document…</p>
                  <p className="dz-secondary">Parse → Chunk → Embed → Save</p>
                </div>
              )}
              {uploadState === 'success' && (
                <div className="dz-content">
                  <div className="dz-checkmark">✓</div>
                  <p className="dz-primary dz-ok">{uploadData?.fileName} indexed</p>
                  <p className="dz-secondary">{uploadData?.totalChunks} chunks · {uploadData?.totalCharacters?.toLocaleString()} characters stored</p>
                  <button className="dz-reset" onClick={e => { e.stopPropagation(); setUploadState('idle'); setUploadData(null) }}>Upload another</button>
                </div>
              )}
              {uploadState === 'error' && (
                <div className="dz-content">
                  <div className="dz-warnsign">⚠</div>
                  <p className="dz-primary dz-bad">{uploadData?.message || 'Upload failed'}</p>
                  <button className="dz-reset" onClick={e => { e.stopPropagation(); setUploadState('idle'); setUploadData(null) }}>Try again</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}