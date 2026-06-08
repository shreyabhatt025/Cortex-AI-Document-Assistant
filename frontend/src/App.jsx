import { useState, useRef, useEffect, useCallback } from 'react'
import LandingPage from './LandingPage'

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY      = 'cortex_chat_history'
const USER_STORAGE_KEY = 'cortex_user'
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

// ── Persist helpers ───────────────────────────────────────────────────────────
function loadUser() {
  try { return JSON.parse(localStorage.getItem(USER_STORAGE_KEY)) } catch { return null }
}
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [WELCOME]
    return JSON.parse(raw).map(m => ({ ...m, done: true }))
  } catch { return [WELCOME] }
}
function loadDarkMode() {
  return localStorage.getItem(THEME_KEY) !== 'light'
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
  if (user?.picture) {
    return (
      <img
        src={user.picture}
        alt={user.name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
      />
    )
  }
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'G'
  return (
    <div className="user-initials" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials}
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(loadUser)
  const [page,        setPage]        = useState(() => loadUser() ? 'app' : 'landing')
  const [darkMode,    setDarkMode]    = useState(loadDarkMode)
  const [messages,    setMessages]    = useState(loadHistory)
  const [input,       setInput]       = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [view,        setView]        = useState('chat')
  const [uploadState, setUploadState] = useState('idle')
  const [uploadData,  setUploadData]  = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [drawer,      setDrawer]      = useState(null)

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)
  const fileRef     = useRef(null)

  // Apply dark/light class to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('light', !darkMode)
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  // Persist chat history
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.filter(m => m.done)))
    } catch {}
  }, [messages])

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
  const handleAuth = (userData) => {
    setUser(userData)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
    setPage('app')
  }

  const handleSignOut = () => {
    setUser(null)
    localStorage.removeItem(USER_STORAGE_KEY)
    setPage('landing')
  }

  const toggleDarkMode = () => setDarkMode(d => !d)

  const clearHistory = () => {
    setMessages([WELCOME])
    localStorage.removeItem(STORAGE_KEY)
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
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: q }),
      })

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
          const token = line.slice(6)

          if (token === '[DONE]') break outer

          if (token.startsWith('[SOURCES]')) {
            try {
              const payload = JSON.parse(token.slice(9))
              setMessages(prev => prev.map(m =>
                m.id === aiId ? { ...m, sources: payload.sources || [] } : m
              ))
            } catch {}
            continue
          }

          if (token.startsWith('ERROR:')) {
            setMessages(prev => prev.map(m =>
              m.id === aiId
                ? { ...m, text: token.replace('ERROR:', '').trim(), done: true, error: true }
                : m
            ))
            break outer
          }

          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, text: m.text + token } : m
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
    }
  }, [input, isStreaming])

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
      setUploadState('error'); setUploadData({ message: 'Only PDF files are accepted.' }); return
    }
    setUploadState('loading'); setUploadData(null)
    const fd = new FormData(); fd.append('pdf', file)
    try {
      const res  = await fetch('/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) { setUploadState('success'); setUploadData(data) }
      else throw new Error(data.error || 'Upload failed')
    } catch (err) { setUploadState('error'); setUploadData({ message: err.message }) }
  }

  // ── Landing page ──────────────────────────────────────────────────────────
  if (page === 'landing') {
    return (
      <LandingPage
        onAuth={handleAuth}
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
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

        <div className="sidebar-footer">
          {/* User profile */}
          {user && (
            <div className="sidebar-user">
              <UserAvatar user={user} size={28} />
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name}</span>
                {user.email && <span className="sidebar-user-email">{user.email}</span>}
              </div>
            </div>
          )}

          {/* Controls row */}
          <div className="sidebar-controls">
            <button className="theme-toggle-sm" onClick={toggleDarkMode} title="Toggle theme">
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="signout-btn" onClick={handleSignOut} title="Sign out">
              <SignOutIcon />
              <span>Sign out</span>
            </button>
          </div>

          <div className="status">
            <span className="status-dot" />
            <span>Backend · Port 3000</span>
          </div>
          <div className="tech-row">
            <span className="tech-badge">Groq</span>
            <span className="tech-badge">MongoDB</span>
            <span className="tech-badge">RAG</span>
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
              <div className="chat-topbar-right">
                {messages.length > 1 && (
                  <button className="clear-btn" onClick={clearHistory}>
                    <TrashIcon /><span>Clear</span>
                  </button>
                )}
                <div className="model-pill">
                  <span className="model-dot" />Groq · Streaming
                </div>
              </div>
            </div>

            <div className="msg-scroll">
              <div className="msg-list">
                {messages.map(msg => (
                  <div key={msg.id} className={`msg-row msg-${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="avatar avatar-ai">
                        <LogoIcon />
                      </div>
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
                              {src.score && (
                                <span className="source-score">{(src.score * 100).toFixed(0)}%</span>
                              )}
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