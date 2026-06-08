// AuthPage.jsx
// full authentication page for Cortex
// handles: login, signup, verify-pending screen, auto email verification

import { useState, useEffect } from 'react'

// ── Icons ─────────────────────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
function ArrowLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
  )
}
function MailIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  )
}
function CheckCircle() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

// ── Input Field Component ─────────────────────────────────────────────────────
function Field({ label, type, value, onChange, placeholder, rightElement }) {
  return (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      <div className="auth-input-wrap">
        <input
          className="auth-input"
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={type === 'password' ? 'current-password' : type === 'email' ? 'email' : 'off'}
        />
        {rightElement && (
          <div className="auth-input-right">{rightElement}</div>
        )}
      </div>
    </div>
  )
}

// ── Main AuthPage ─────────────────────────────────────────────────────────────
export default function AuthPage({ onAuth, onBack, initialVerifyToken }) {

  // which tab is active
  const [tab, setTab] = useState('login')

  // which screen to show
  // 'form'           → login / signup form
  // 'verify-pending' → after signup, waiting for user to click email link
  // 'verifying'      → auto-verifying token from URL
  // 'verify-success' → email verified successfully
  // 'verify-failed'  → token expired or invalid
  const [screen, setScreen] = useState(
    initialVerifyToken ? 'verifying' : 'form'
  )

  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [pendingEmail, setPendingEmail] = useState('')

  // show/hide password toggles
  const [showPass,    setShowPass]    = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // login form state
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // signup form state
  const [signupName,     setSignupName]     = useState('')
  const [signupEmail,    setSignupEmail]    = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirm,  setSignupConfirm]  = useState('')

  // clear error when switching tabs
  useEffect(() => { setError(''); setSuccess('') }, [tab])

  // ── auto-verify token from URL on mount ─────────────────────────────────
  useEffect(() => {
    if (initialVerifyToken) {
      handleVerifyToken(initialVerifyToken)
    }
  }, [initialVerifyToken])

  // ── verify email token ───────────────────────────────────────────────────
  const handleVerifyToken = async (token) => {
    setScreen('verifying')
    setLoading(true)
    try {
      const res  = await fetch(`/auth/verify/${token}`)
      const data = await res.json()

      // clear the ?verify= from the URL so refresh doesn't re-trigger
      window.history.replaceState({}, '', window.location.pathname)

      if (res.ok) {
        setScreen('verify-success')
      } else {
        setError(data.error || 'Verification failed.')
        if (data.email) setPendingEmail(data.email)
        setScreen('verify-failed')
      }
    } catch {
      setError('Connection error. Make sure the backend is running.')
      setScreen('verify-failed')
    } finally {
      setLoading(false)
    }
  }

  // ── login ────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: loginEmail, password: loginPassword }),
      })
      const data = await res.json()

      if (res.ok) {
        // pass user info + token up to App.jsx
        onAuth(data.user, data.token)
      } else {
        setError(data.error || 'Login failed. Please try again.')
        // if unverified, show resend option
        if (data.canResend && data.email) {
          setPendingEmail(data.email)
        }
      }
    } catch {
      setError('Cannot reach server. Is the backend running on port 3000?')
    } finally {
      setLoading(false)
    }
  }

  // ── signup ───────────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault()

    // client-side validation
    if (!signupName.trim() || !signupEmail.trim() || !signupPassword || !signupConfirm) {
      setError('Please fill in all fields.')
      return
    }
    if (signupPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (signupPassword !== signupConfirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res  = await fetch('/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:     signupName.trim(),
          email:    signupEmail.trim(),
          password: signupPassword,
        }),
      })
      const data = await res.json()

      if (res.ok) {
        setPendingEmail(signupEmail.trim())
        setScreen('verify-pending')
      } else {
        setError(data.error || 'Registration failed. Please try again.')
        if (data.canResend && data.email) {
          setPendingEmail(data.email)
        }
      }
    } catch {
      setError('Cannot reach server. Is the backend running on port 3000?')
    } finally {
      setLoading(false)
    }
  }

  // ── resend verification email ─────────────────────────────────────────────
  const handleResend = async () => {
    if (!pendingEmail) return
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res  = await fetch('/auth/resend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: pendingEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess('Verification email sent! Check your inbox.')
      } else {
        setError(data.error || 'Could not resend email.')
      }
    } catch {
      setError('Connection error.')
    } finally {
      setLoading(false)
    }
  }

  // ── SCREEN: verifying (auto-checking token from URL) ─────────────────────
  if (screen === 'verifying') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-logo">C</div>
          <div className="auth-verifying">
            <div className="auth-verifying-spin" />
            <p className="auth-verifying-text">Verifying your email…</p>
          </div>
        </div>
      </div>
    )
  }

  // ── SCREEN: verify-success ────────────────────────────────────────────────
  if (screen === 'verify-success') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-logo">C</div>
          <div className="auth-status-screen">
            <div className="auth-status-icon success"><CheckCircle /></div>
            <h2 className="auth-status-title">Email verified!</h2>
            <p className="auth-status-desc">
              Your account is now active. You can sign in.
            </p>
            <button
              className="auth-submit-btn"
              onClick={() => { setScreen('form'); setTab('login') }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── SCREEN: verify-failed ─────────────────────────────────────────────────
  if (screen === 'verify-failed') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-logo">C</div>
          <div className="auth-status-screen">
            <div className="auth-status-icon fail"><AlertIcon /></div>
            <h2 className="auth-status-title">Verification failed</h2>
            <p className="auth-status-desc">{error}</p>
            {pendingEmail && (
              <button
                className="auth-resend-btn"
                onClick={handleResend}
                disabled={loading}
              >
                {loading ? 'Sending…' : 'Send a new verification link'}
              </button>
            )}
            {success && <p className="auth-success-msg">{success}</p>}
            <button
              className="auth-back-link"
              onClick={() => { setScreen('form'); setTab('login'); setError('') }}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── SCREEN: verify-pending (after signup) ─────────────────────────────────
  if (screen === 'verify-pending') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card-logo">C</div>
          <div className="auth-status-screen">
            <div className="auth-status-icon pending"><MailIcon /></div>
            <h2 className="auth-status-title">Check your inbox</h2>
            <p className="auth-status-desc">
              We sent a verification link to:
            </p>
            <div className="auth-email-badge">{pendingEmail}</div>
            <p className="auth-status-desc" style={{ marginTop: 0 }}>
              Click the link in the email to activate your account.
              The link expires in 24 hours.
            </p>

            <div className="auth-divider-line" />

            <p className="auth-resend-note">Didn't get the email?</p>

            {success
              ? <p className="auth-success-msg">{success}</p>
              : (
                <button
                  className="auth-resend-btn"
                  onClick={handleResend}
                  disabled={loading}
                >
                  {loading ? 'Sending…' : 'Resend verification email'}
                </button>
              )
            }

            {error && <p className="auth-error-msg">{error}</p>}

            <button
              className="auth-back-link"
              onClick={() => { setScreen('form'); setTab('login') }}
            >
              <ArrowLeft /> Back to login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── SCREEN: form (login / signup) ─────────────────────────────────────────
  return (
    <div className="auth-page">
      <div className="auth-card">

        {/* Logo + back button */}
        <div className="auth-card-top">
          <button className="auth-back-btn" onClick={onBack}>
            <ArrowLeft /> Back
          </button>
          <div className="auth-card-logo">C</div>
        </div>

        <h1 className="auth-card-title">
          {tab === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="auth-card-sub">
          {tab === 'login'
            ? 'Sign in to continue to Cortex'
            : 'Start querying your documents in minutes'
          }
        </p>

        {/* Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab${tab === 'login' ? ' auth-tab-active' : ''}`}
            onClick={() => setTab('login')}
          >
            Login
          </button>
          <button
            className={`auth-tab${tab === 'signup' ? ' auth-tab-active' : ''}`}
            onClick={() => setTab('signup')}
          >
            Sign Up
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="auth-error-box">
            <span>{error}</span>
            {pendingEmail && (
              <button
                className="auth-error-resend"
                onClick={() => { setScreen('verify-pending') }}
              >
                Resend link →
              </button>
            )}
          </div>
        )}

        {/* ── LOGIN FORM ─────────────────────────────────────────────────── */}
        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin} noValidate>
            <Field
              label="Email"
              type="email"
              value={loginEmail}
              onChange={e => setLoginEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={loginPassword}
              onChange={e => setLoginPassword(e.target.value)}
              placeholder="Enter your password"
              rightElement={
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPass(p => !p)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? <span className="auth-btn-spin" /> : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── SIGNUP FORM ────────────────────────────────────────────────── */}
        {tab === 'signup' && (
          <form className="auth-form" onSubmit={handleSignup} noValidate>
            <Field
              label="Full Name"
              type="text"
              value={signupName}
              onChange={e => setSignupName(e.target.value)}
              placeholder="John Doe"
            />
            <Field
              label="Email"
              type="email"
              value={signupEmail}
              onChange={e => setSignupEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <Field
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={signupPassword}
              onChange={e => setSignupPassword(e.target.value)}
              placeholder="Min. 6 characters"
              rightElement={
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPass(p => !p)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
            <Field
              label="Confirm Password"
              type={showConfirm ? 'text' : 'password'}
              value={signupConfirm}
              onChange={e => setSignupConfirm(e.target.value)}
              placeholder="Repeat your password"
              rightElement={
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowConfirm(p => !p)}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading}
            >
              {loading ? <span className="auth-btn-spin" /> : 'Create Account'}
            </button>
          </form>
        )}

        {/* Switch tab hint */}
        <p className="auth-switch">
          {tab === 'login'
            ? <>Don't have an account?{' '}
                <button className="auth-switch-btn" onClick={() => setTab('signup')}>Sign up</button>
              </>
            : <>Already have an account?{' '}
                <button className="auth-switch-btn" onClick={() => setTab('login')}>Log in</button>
              </>
          }
        </p>
      </div>
    </div>
  )
}