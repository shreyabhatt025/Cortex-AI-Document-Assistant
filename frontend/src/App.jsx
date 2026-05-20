import { useState, useRef, useEffect, useCallback } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'opsmind_chat_history'

const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  text: "Hello. I'm **OpsMind AI** — your company's SOP assistant.\n\nAsk me anything about internal procedures, refund policies, escalation protocols, or onboarding steps. Every answer is grounded in your uploaded documents.",
  sources: [],
  done: true,
}

const SUGGESTIONS = [
  'How do I process a refund?',
  'What is the escalation procedure?',
  'How to onboard a new employee?',
  'What are the leave policies?',
]

// ── Load saved history from localStorage ──────────────────────────────────────
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return [WELCOME]
    const parsed = JSON.parse(raw)
    // Ensure all saved messages are marked done (no stuck cursors)
    return parsed.map(m => ({ ...m, done: true }))
  } catch {
    return [WELCOME]
  }
}

// ── Renders **bold** and line breaks ──────────────────────────────────────────
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
function UploadBigIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

// ── Source Drawer ─────────────────────────────────────────────────────────────
// Slides in from the right when a source chip is clicked
function SourceDrawer({ source, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!source) return null

  return (
    <>
      {/* Backdrop */}
      <div className="drawer-backdrop" onClick={onClose} />

      {/* Drawer panel */}
      <div className="drawer">
        {/* Drawer header */}
        <div className="drawer-header">
          <div className="drawer-header-left">
            <div className="drawer-icon"><DocIcon /></div>
            <div className="drawer-title-group">
              <span className="drawer-title">{source.file}</span>
              <span className="drawer-subtitle">Chunk {source.chunkIndex + 1}</span>
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Score badge */}
        {source.score && (
          <div className="drawer-meta">
            <span className="drawer-meta-label">Relevance score</span>
            <span className="drawer-score">{(source.score * 100).toFixed(1)}%</span>
          </div>
        )}

        {/* Divider */}
        <div className="drawer-divider" />

        {/* Chunk text */}
        <div className="drawer-body">
          <p className="drawer-eyebrow">Retrieved chunk</p>
          <div className="drawer-text">{source.preview}</div>
        </div>

        {/* Footer */}
        <div className="drawer-footer">
          <span className="drawer-footer-note">
            This chunk was used as context when generating the answer above.
          </span>
        </div>
      </div>
    </>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [messages,    setMessages]    = useState(loadHistory)
  const [input,       setInput]       = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [view,        setView]        = useState('chat')
  const [uploadState, setUploadState] = useState('idle')
  const [uploadData,  setUploadData]  = useState(null)
  const [dragOver,    setDragOver]    = useState(false)
  const [drawer,      setDrawer]      = useState(null)   // source object | null

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)
  const fileRef     = useRef(null)

  // ── Persist chat to localStorage on every change ────────────────────────────
  useEffect(() => {
    try {
      // Only save messages that are fully done (don't save mid-stream state)
      const toSave = messages.filter(m => m.done)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    } catch {
      // localStorage quota exceeded or unavailable — fail silently
    }
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

  // Clear chat history
  const clearHistory = () => {
    setMessages([WELCOME])
    localStorage.removeItem(STORAGE_KEY)
  }

  // ── SSE streaming + sources parsing ─────────────────────────────────────────
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
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

          // Preserve leading spaces — slice exactly 6 chars
          const token = line.slice(6)

          if (token === '[DONE]') break outer

          // ── WEEK 4: sources event ───────────────────────────────────────
          // Backend sends: data: [SOURCES]{"sources":[...]}
          if (token.startsWith('[SOURCES]')) {
            try {
              const payload = JSON.parse(token.slice(9))  // slice '[SOURCES]'
              setMessages(prev => prev.map(m =>
                m.id === aiId
                  ? { ...m, sources: payload.sources || [] }
                  : m
              ))
            } catch {
              // Malformed sources JSON — skip silently
            }
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

          // Plain text token — append directly
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

  // ── Upload ───────────────────────────────────────────────────────────────────
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
      const res  = await fetch('/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) { setUploadState('success'); setUploadData(data) }
      else throw new Error(data.error || 'Upload failed')
    } catch (err) {
      setUploadState('error')
      setUploadData({ message: err.message })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="shell">

      {/* Source drawer — rendered at root level so it overlays everything */}
      <SourceDrawer source={drawer} onClose={() => setDrawer(null)} />

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OM</div>
          <div className="brand-copy">
            <span className="brand-name">OpsMind</span>
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

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <div className="main">

        {/* ════ CHAT VIEW ════════════════════════════════════════════════════ */}
        {view === 'chat' && (
          <div className="chat-shell">

            {/* Top bar */}
            <div className="chat-topbar">
              <div className="chat-topbar-left">
                <h1 className="chat-title">SOP Assistant</h1>
                <span className="chat-subtitle">Answers grounded in your uploaded documents</span>
              </div>
              <div className="chat-topbar-right">
                {/* Clear history button */}
                {messages.length > 1 && (
                  <button className="clear-btn" onClick={clearHistory} title="Clear chat history">
                    <TrashIcon />
                    <span>Clear</span>
                  </button>
                )}
                <div className="model-pill">
                  <span className="model-dot" />
                  Groq · Streaming
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="msg-scroll">
              <div className="msg-list">
                {messages.map(msg => (
                  <div key={msg.id} className={`msg-row msg-${msg.role}`}>

                    {msg.role === 'assistant' && (
                      <div className="avatar avatar-ai">OM</div>
                    )}

                    <div className="msg-content">
                      <div className={`bubble bubble-${msg.role}${msg.error ? ' bubble-error' : ''}`}>
                        {msg.text
                          ? <RichText text={msg.text} />
                          : !msg.done && <span className="cursor" />
                        }
                        {!msg.done && msg.text && <span className="cursor" />}
                      </div>

                      {/* Source chips — clickable, open drawer */}
                      {msg.sources?.length > 0 && (
                        <div className="source-row">
                          <span className="source-label">Sources</span>
                          {msg.sources.map((src, i) => (
                            <button
                              key={i}
                              className="source-chip"
                              onClick={() => setDrawer(src)}
                              title="Click to view chunk"
                            >
                              <DocIcon />
                              {src.file}
                              {src.score && (
                                <span className="source-score">
                                  {(src.score * 100).toFixed(0)}%
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="avatar avatar-user">You</div>
                    )}
                  </div>
                ))}

                {/* Thinking dots */}
                {isStreaming && messages.at(-1)?.text === '' && (
                  <div className="thinking">
                    <span /><span /><span />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Suggestions — only on welcome screen */}
            {messages.length === 1 && (
              <div className="suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="sugg-chip" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
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

        {/* ════ UPLOAD VIEW ══════════════════════════════════════════════════ */}
        {view === 'upload' && (
          <div className="upload-shell">
            <div className="upload-topbar">
              <h1 className="upload-title">Upload SOP Document</h1>
              <p className="upload-sub">
                Add PDFs to the knowledge base. Each file is parsed, chunked, embedded, and indexed in MongoDB automatically.
              </p>
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
                  <button className="dz-reset" onClick={e => { e.stopPropagation(); setUploadState('idle'); setUploadData(null) }}>
                    Upload another document
                  </button>
                </div>
              )}
              {uploadState === 'error' && (
                <div className="dz-content">
                  <div className="dz-warnsign">⚠</div>
                  <p className="dz-primary dz-bad">{uploadData?.message || 'Upload failed'}</p>
                  <button className="dz-reset" onClick={e => { e.stopPropagation(); setUploadState('idle'); setUploadData(null) }}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}