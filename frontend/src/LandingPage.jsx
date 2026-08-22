import { useState, useEffect } from 'react'

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
function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  )
}

// ── Animated chat preview ─────────────────────────────────────────────────────
function ChatPreview() {
  const [visibleChars, setVisibleChars] = useState(0)
  const answer = "To process a refund, navigate to the Billing Module and click 'Initiate Refund'. Enter the order ID and reason code, then submit for approval."

  useEffect(() => {
    const t = setInterval(() => {
      setVisibleChars(p => {
        if (p >= answer.length) { clearInterval(t); return p }
        return p + 2
      })
    }, 18)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="chat-preview">
      <div className="preview-bar">
        <div className="preview-dots">
          <span className="pdot red" />
          <span className="pdot yellow" />
          <span className="pdot green" />
        </div>
        <span className="preview-title">cortex · chat</span>
      </div>

      <div className="preview-body">
        <div className="preview-msg user-msg">
          How do I process a refund?
        </div>
        <div className="preview-msg ai-msg">
          <div className="ai-label">
            <span className="ai-dot" />Cortex
          </div>
          <p>
            {answer.slice(0, visibleChars)}
            {visibleChars < answer.length && <span className="preview-cursor" />}
          </p>
        </div>
        <div className="preview-source">
          <span className="src-tag">📄 OPSMIND_SOP.pdf · chunk 2 · 74%</span>
        </div>
      </div>

      <div className="preview-input">
        <span className="preview-placeholder">Ask anything about your document…</span>
      </div>
    </div>
  )
}

// ── Landing Page ──────────────────────────────────────────────────────────────
// onGetStarted → called when "Get Started" or "Sign in" is clicked
// navigates to AuthPage (handled in App.jsx)
export default function LandingPage({ onGetStarted, darkMode, toggleDarkMode }) {

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="landing">

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
            <button className="lnav-signin" onClick={onGetStarted}>Sign in</button>
            <button className="lnav-cta"    onClick={onGetStarted}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-left">
          <div className="hero-kicker">
          
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
            <button className="btn-primary" onClick={onGetStarted}>
              Get Started <ArrowRight />
            </button>
            <button className="btn-ghost" onClick={() => scrollTo('how')}>
              See how it works
            </button>
          </div>

        
        </div>

        <div className="hero-right">
          <ChatPreview />
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how" className="how-section">
        <div className="how-inner">
          <div className="how-header">
            <h2 className="how-title">How it works</h2>
            <p className="how-sub">Four steps.</p>
          </div>

          <div className="steps-list">
            {[
              {
                n: '01',
                title: 'Upload your PDF',
                desc:  'Drop any PDF — research paper, SOP, report, notes. Any document works.',
                tag:   '/upload endpoint'
              },
              {
                n: '02',
                title: 'Cortex processes it',
                desc:  'The document gets split into chunks, converted into vectors, and stored in MongoDB Atlas.',
                tag:   'embedder.js + chunker.js'
              },
              {
                n: '03',
                title: 'You ask a question',
                desc:  'Type your question naturally. No special syntax, no keywords — just ask.',
                tag:   'retriever.js'
              },
              {
                n: '04',
                title: 'Get the answer instantly',
                desc:  'Cortex streams the answer back word by word, with the exact source chunk attached.',
                tag:   'Groq + SSE'
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

     

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bottom-cta">
        <div className="bottom-cta-inner">
          <h2 className="bottom-cta-title">Ready to stop reading PDFs manually?</h2>
          <button className="btn-primary" onClick={onGetStarted}>
            Try Cortex <ArrowRight />
          </button>
        </div>
      </section>
    </div>
  )
}