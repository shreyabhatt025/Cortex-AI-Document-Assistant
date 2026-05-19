import { useState, useRef, useEffect, useCallback } from 'react'

// ── Welcome message shown on first load ──────────────────────────────────────
const WELCOME = {
  id: 'welcome',
  role: 'assistant',
  text: "Hello. I'm **OpsMind AI** — your company's SOP assistant.\n\nAsk me anything about internal procedures, refund policies, escalation protocols, or onboarding steps. Every answer is grounded in your uploaded documents.",
  sources: [],
  done: true,
}

// ── Clickable suggestion chips shown on empty chat ───────────────────────────
const SUGGESTIONS = [
  'How do I process a refund?',
  'What is the escalation procedure?',
  'How to onboard a new employee?',
  'What are the leave policies?',
]

// ── Renders **bold** markdown and newlines ────────────────────────────────────
function RichText({ text }) {
  return text.split('\n').map((line, i, arr) => {
    const segments = line.split(/\*\*(.*?)\*\*/g)
    return (
      <span key={i}>
        {segments.map((seg, j) =>
          j % 2 === 1 ? <strong key={j}>{seg}</strong> : seg
        )}
        {i < arr.length - 1 && <br />}
      </span>
    )
  })
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────
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

// ── Root Component ────────────────────────────────────────────────────────────
export default function App() {
  const [messages,     setMessages]     = useState([WELCOME])
  const [input,        setInput]        = useState('')
  const [isStreaming,  setIsStreaming]   = useState(false)
  const [view,         setView]         = useState('chat')   // 'chat' | 'upload'
  const [uploadState,  setUploadState]  = useState('idle')   // idle | loading | success | error
  const [uploadData,   setUploadData]   = useState(null)
  const [dragOver,     setDragOver]     = useState(false)

  const bottomRef   = useRef(null)
  const textareaRef = useRef(null)
  const fileRef     = useRef(null)

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea as user types
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [input])

  // ── Core: send question and read SSE stream ─────────────────────────────────
  const sendMessage = useCallback(async (override) => {
    const q = (override ?? input).trim()
    if (!q || isStreaming) return

    setInput('')
    setIsStreaming(true)

    // Add user message immediately
    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: q, done: true },
    ])

    // Add empty AI placeholder that will fill up as tokens arrive
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

      // Read the SSE stream chunk by chunk
      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Split on newlines to get individual SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''   // keep incomplete last line for next iteration

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          // Slice exactly 6 chars to preserve leading spaces in tokens like " process"
          // Your backend sends: res.write(`data: ${newText}\n\n`)
          const token = line.slice(6)

          if (token === '[DONE]') break outer

          if (token.startsWith('ERROR:')) {
            setMessages(prev => prev.map(m =>
              m.id === aiId
                ? { ...m, text: token.replace('ERROR:', '').trim(), done: true, error: true }
                : m
            ))
            break outer
          }

          // Plain text token — append directly, no JSON.parse needed
          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, text: m.text + token } : m
          ))
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === aiId
          ? { ...m, text: `Connection error: ${err.message}. Make sure backend is running on port 3000.`, done: true, error: true }
          : m
      ))
    } finally {
      // Always mark AI message as done to stop the cursor blinking
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

  // ── Upload PDF to /upload ───────────────────────────────────────────────────
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
      if (res.ok) {
        setUploadState('success')
        setUploadData(data)
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (err) {
      setUploadState('error')
      setUploadData({ message: err.message })
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="shell">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
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
          <button
            className={`nav-item${view === 'chat' ? ' nav-active' : ''}`}
            onClick={() => setView('chat')}
          >
            <ChatIcon />
            <span>Chat</span>
          </button>
          <button
            className={`nav-item${view === 'upload' ? ' nav-active' : ''}`}
            onClick={() => setView('upload')}
          >
            <UploadIcon />
            <span>Upload SOP</span>
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

      {/* ── Main panel ───────────────────────────────────────────────────────── */}
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
              <div className="model-pill">
                <span className="model-dot" />
                Groq · Streaming
              </div>
            </div>

            {/* Message list */}
            <div className="msg-scroll">
              <div className="msg-list">

                {messages.map(msg => (
                  <div key={msg.id} className={`msg-row msg-${msg.role}`}>

                    {/* AI avatar */}
                    {msg.role === 'assistant' && (
                      <div className="avatar avatar-ai">OM</div>
                    )}

                    <div className="msg-content">
                      {/* Bubble */}
                      <div className={`bubble bubble-${msg.role}${msg.error ? ' bubble-error' : ''}`}>
                        {msg.text
                          ? <RichText text={msg.text} />
                          : !msg.done && <span className="cursor" />
                        }
                        {!msg.done && msg.text && <span className="cursor" />}
                      </div>

                      {/* Source citations */}
                      {msg.sources?.length > 0 && (
                        <div className="source-row">
                          <span className="source-label">Sources</span>
                          {msg.sources.map((s, i) => (
                            <span key={i} className="source-chip">
                              <DocIcon />{s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* User avatar */}
                    {msg.role === 'user' && (
                      <div className="avatar avatar-user">You</div>
                    )}
                  </div>
                ))}

                {/* Thinking indicator: 3 dots before first token arrives */}
                {isStreaming && messages.at(-1)?.text === '' && (
                  <div className="thinking">
                    <span /><span /><span />
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Suggestion pills — only visible on empty chat */}
            {messages.length === 1 && (
              <div className="suggestions">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="sugg-chip" onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input bar */}
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

            {/* Pipeline visualization */}
            <div className="pipeline">
              {[
                { n: 1, label: 'Parse PDF',       desc: 'Extract raw text from document' },
                { n: 2, label: 'Chunk Text',      desc: '1000 chars · 100 char overlap'  },
                { n: 3, label: 'Embed Vectors',   desc: '384-dim local embedding model'  },
                { n: 4, label: 'Store in Atlas',  desc: 'MongoDB vector search index'    },
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

            {/* Drop zone */}
            <div
              className={`dropzone${dragOver ? ' dz-active' : ''} dz-${uploadState}`}
              onClick={() => uploadState !== 'loading' && fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setDragOver(false)
                handleUpload(e.dataTransfer.files[0])
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => handleUpload(e.target.files[0])}
              />

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
                  <p className="dz-primary dz-success">{uploadData?.fileName} indexed</p>
                  <p className="dz-secondary">
                    {uploadData?.totalChunks} chunks &nbsp;·&nbsp; {uploadData?.totalCharacters?.toLocaleString()} characters stored in MongoDB
                  </p>
                  <button
                    className="dz-reset"
                    onClick={e => { e.stopPropagation(); setUploadState('idle'); setUploadData(null) }}
                  >
                    Upload another document
                  </button>
                </div>
              )}

              {uploadState === 'error' && (
                <div className="dz-content">
                  <div className="dz-warnsign">⚠</div>
                  <p className="dz-primary dz-fail">{uploadData?.message || 'Upload failed'}</p>
                  <button
                    className="dz-reset"
                    onClick={e => { e.stopPropagation(); setUploadState('idle'); setUploadData(null) }}
                  >
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
