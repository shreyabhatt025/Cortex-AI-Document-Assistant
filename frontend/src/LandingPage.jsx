import { useState, useEffect, useRef } from 'react'

// ── Icons ─────────────────────────────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}
function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

// ── Fake chat preview ─────────────────────────────────────────────────────────
function ChatPreview() {
  const [visibleLines, setVisibleLines] = useState(0)
  const answer = "To process a refund, navigate to the Billing Module and click 'Initiate Refund'. Enter the order ID and reason code, then submit for approval."

  useEffect(() => {
    const t = setInterval(() => {
      setVisibleLines(p => {
        if (p >= answer.length) { clearInterval(t); return p }
        return p + 2
      })
    }, 18)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="chat-preview">
      {/* Window bar */}
      <div className="preview-bar">
        <div className="preview-dots">
          <span className="pdot red" />
          <span className="pdot yellow" />
          <span className="pdot green" />
        </div>
        <span className="preview-title">cortex · chat</span>
      </div>

      {/* Messages */}
      <div className="preview-body">
        <div className="preview-msg user-msg">
          How do I process a refund?
        </div>

        <div className="preview-msg ai-msg">
          <div className="ai-label">
            <span className="ai-dot" />
            Cortex
          </div>
          <p>{answer.slice(0, visibleLines)}
            {visibleLines < answer.length && <span className="preview-cursor" />}
          </p>
        </div>

        <div className="preview-source">
          <span className="src-tag">📄 OPSMIND_SOP.pdf · chunk 2 · 74%</span>
        </div>
      </div>

      {/* Input bar */}
      <div className="preview-input">
        <span className="preview-placeholder">Ask anything about your document…</span>
      </div>
    </div>
  )
}

// ── Auth Modal ────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onAuth, darkMode }) {
  const googleBtnRef = useRef(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId || !window.google?.accounts || !googleBtnRef.current) return
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (res) => {
        try {
          const p = JSON.parse(atob(res.credential.split('.')[1]))
          onAuth({ name: p.name, email: p.email, picture: p.picture })
        } catch { onAuth({ name: 'User', email: '', picture: null }) }
      },
      ux_mode: 'popup',
    })
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: 'standard', theme: darkMode ? 'filled_black' : 'outline',
      size: 'large', text: 'continue_with', width: 320,
    })
  }, [darkMode, onAuth])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const hasGSI      = !!window.google?.accounts
  const hasClientId = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="auth-modal">
        <button className="modal-close" onClick={onClose}><CloseIcon /></button>

        <div className="auth-top">
          <div className="auth-logo-sm">C</div>
          <h2 className="auth-title">Sign in to Cortex</h2>
          <p className="auth-sub">Your AI-powered document assistant</p>
        </div>

        <div className="auth-body">
          {hasGSI && hasClientId ? (
            <div ref={googleBtnRef} className="google-btn-wrap" />
          ) : (
            <button
              className="google-btn-styled"
              onClick={() => {
                setLoading(true)
                setTimeout(() => onAuth({ name: 'Demo User', email: 'demo@cortex.ai', picture: null }), 700)
              }}
              disabled={loading}
            >
              {loading
                ? <span className="google-btn-spin" />
                : <><GoogleIcon /><span>Continue with Google</span></>
              }
            </button>
          )}

          <div className="auth-or">
            <div className="auth-or-line" /><span>or</span><div className="auth-or-line" />
          </div>

          <button
            className="guest-btn"
            onClick={() => onAuth({ name: 'Guest', email: '', picture: null, isGuest: true })}
          >
            Continue as Guest
          </button>
        </div>

        <p className="auth-terms">
          By continuing you agree to our{' '}
          <a href="#" className="auth-link">Terms</a> and{' '}
          <a href="#" className="auth-link">Privacy Policy</a>
        </p>
      </div>
    </>
  )
}

// ── Main Landing Page ─────────────────────────────────────────────────────────
export default function LandingPage({ onAuth, darkMode, toggleDarkMode }) {
  const [showAuth, setShowAuth] = useState(false)

  return (
    <div className="landing">
      {showAuth && (
        <AuthModal
          onClose={() => setShowAuth(false)}
          onAuth={(u) => { setShowAuth(false); onAuth(u) }}
          darkMode={darkMode}
        />
      )}

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav className="lnav">
        <div className="lnav-inner">
          <div className="lnav-logo">
            <div className="lnav-mark">C</div>
            <span className="lnav-name">Cortex</span>
          </div>
          <div className="lnav-right">
            <button className="ltheme-btn" onClick={toggleDarkMode}>
              {darkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button className="lnav-signin" onClick={() => setShowAuth(true)}>Sign in</button>
            <button className="lnav-cta" onClick={() => setShowAuth(true)}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-left">

          <div className="hero-kicker">
            <span className="kicker-dot" />
            RAG · MongoDB · Groq · React
          </div>

          <h1 className="hero-h1">
            Tired of reading<br />
            long PDFs just to<br />
            find one answer?
          </h1>

          <p className="hero-desc">
            Upload your document. Ask anything.<br />
            Cortex finds the exact answer — with the source.
          </p>

          <div className="hero-btns">
            <button className="btn-primary" onClick={() => setShowAuth(true)}>
              Get Started <ArrowRight />
            </button>
            <button className="btn-ghost" onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })}>
              See how it works
            </button>
          </div>

          {/* Honest note */}
          <p className="hero-note">
            No credit card. No setup. Just upload a PDF and start asking.
          </p>
        </div>

        <div className="hero-right">
          <ChatPreview />
        </div>
      </section>

      {/* ── Stack strip ──────────────────────────────────────────────────── */}
      <div className="stack-strip">
        <span className="stack-label">Built with</span>
        {['MongoDB Atlas', 'Groq LLM', 'React + Vite', 'Node.js', 'Local Embeddings', 'SSE Streaming'].map(t => (
          <span key={t} className="stack-tag">{t}</span>
        ))}
      </div>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="how-section">
        <div className="how-inner">
          <div className="how-header">
            <h2 className="how-title">How it works</h2>
            <p className="how-sub">Four steps. No nonsense.</p>
          </div>

          <div className="steps-list">
            {[
              {
                n: '01',
                title: 'Upload your PDF',
                desc: 'Drop any PDF — research paper, SOP, report, notes. Any document works.',
                tag: '/upload endpoint'
              },
              {
                n: '02',
                title: 'Cortex processes it',
                desc: 'The document gets split into chunks, converted into vectors, and stored in MongoDB Atlas.',
                tag: 'embedder.js + chunker.js'
              },
              {
                n: '03',
                title: 'You ask a question',
                desc: 'Type your question naturally. No special syntax, no keywords — just ask.',
                tag: 'retriever.js'
              },
              {
                n: '04',
                title: 'Get the answer instantly',
                desc: 'Cortex streams the answer back word by word, with the exact source chunk attached.',
                tag: 'Groq + SSE'
              },
            ].map((step, i) => (
              <div key={step.n} className="step-row">
                <div className="step-num-col">
                  <span className="step-number">{step.n}</span>
                  {i < 3 && <div className="step-line" />}
                </div>
                <div className="step-content">
                  <div className="step-head">
                    <h3 className="step-title">{step.title}</h3>
                    <span className="step-tag">{step.tag}</span>
                  </div>
                  <p className="step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="feat-section">
        <div className="feat-inner">
          <h2 className="feat-title">What Cortex does</h2>

          <div className="feat-grid">
            {[
              { icon: '📄', title: 'PDF Upload & Parsing',      desc: 'Handles any PDF — text-based. Extracts clean text, chunks it, embeds it.' },
              { icon: '🔍', title: 'Semantic Search',           desc: 'Not keyword matching. Finds chunks that mean the same thing as your question.' },
              { icon: '⚡', title: 'Streaming Answers',         desc: 'Words appear as Groq generates them. No waiting for the full response.' },
              { icon: '📎', title: 'Source Citations',          desc: 'Every answer shows which chunk it came from and the relevance score.' },
              { icon: '💾', title: 'Chat History',              desc: 'Your conversation is saved in localStorage. Refresh and it\'s still there.' },
              { icon: '🌙', title: 'Dark / Light Mode',         desc: 'Toggle between dark and light. Preference is saved automatically.' },
            ].map(f => (
              <div key={f.title} className="feat-card">
                <span className="feat-icon">{f.icon}</span>
                <h3 className="feat-name">{f.title}</h3>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bottom-cta">
        <div className="bottom-cta-inner">
          <h2 className="bottom-cta-title">Ready to stop reading PDFs manually?</h2>
          <button className="btn-primary" onClick={() => setShowAuth(true)}>
            Try Cortex <ArrowRight />
          </button>
        </div>
      </section>
    </div>
  )
}