// routes/authRoutes.js
// POST /auth/register          → create account + send verification email
// POST /auth/login             → login + get JWT token
// GET  /auth/verify/:token     → verify email address
// POST /auth/resend            → resend verification email
// POST /auth/forgot-password   → send password reset email  ← NEW
// POST /auth/reset-password    → set new password with token ← NEW

const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const User     = require('../models/User')
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService')

const router = express.Router()


// ── ROUTE 1: POST /auth/register ─────────────────────────────────────────────
router.post('/register', async (req, res) => {

  const { name, email, password } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are all required.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() })

    if (existing) {
      if (!existing.isVerified) {
        return res.status(400).json({
          error: 'This email is already registered but not verified.',
          canResend: true,
          email: email.toLowerCase()
        })
      }
      return res.status(400).json({
        error: 'An account with this email already exists. Please log in.'
      })
    }

    const hashedPassword    = await bcrypt.hash(password, 10)
    const verificationToken = crypto.randomBytes(32).toString('hex')
    const tokenExpiry       = new Date(Date.now() + 24 * 60 * 60 * 1000)

    const newUser = new User({
      name:                    name.trim(),
      email:                   email.toLowerCase(),
      password:                hashedPassword,
      isVerified:              false,
      verificationToken,
      verificationTokenExpiry: tokenExpiry,
    })

    await newUser.save()
    console.log('new user registered:', email)

    await sendVerificationEmail(email.toLowerCase(), name.trim(), verificationToken)

    res.status(201).json({
      message: 'Account created! Please check your email to verify your account.',
      email:   email.toLowerCase()
    })

  } catch (error) {
    console.log('register error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


// ── ROUTE 2: POST /auth/login ─────────────────────────────────────────────────
router.post('/login', async (req, res) => {

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    if (!user.isVerified) {
      return res.status(400).json({
        error: 'Please verify your email before logging in.',
        canResend: true,
        email: user.email
      })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    console.log('user logged in:', user.email)

    res.json({
      message: 'Logged in successfully!',
      token,
      user: { name: user.name, email: user.email }
    })

  } catch (error) {
    console.log('login error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


// ── ROUTE 3: GET /auth/verify/:token ─────────────────────────────────────────
router.get('/verify/:token', async (req, res) => {

  const { token } = req.params

  if (!token) {
    return res.status(400).json({ error: 'Verification token is missing.' })
  }

  try {
    const user = await User.findOne({ verificationToken: token })

    if (!user) {
      return res.status(400).json({
        error: 'Invalid verification link. It may have already been used.'
      })
    }

    if (user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({
        error: 'Verification link has expired. Please request a new one.',
        canResend: true,
        email: user.email
      })
    }

    user.isVerified              = true
    user.verificationToken       = null
    user.verificationTokenExpiry = null
    await user.save()

    console.log('email verified for:', user.email)
    res.json({ message: 'Email verified successfully! You can now log in.' })

  } catch (error) {
    console.log('verify error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


// ── ROUTE 4: POST /auth/resend ────────────────────────────────────────────────
router.post('/resend', async (req, res) => {

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      return res.json({ message: 'If that email is registered, a verification link has been sent.' })
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'This account is already verified. Please log in.' })
    }

    const newToken  = crypto.randomBytes(32).toString('hex')
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    user.verificationToken       = newToken
    user.verificationTokenExpiry = newExpiry
    await user.save()

    await sendVerificationEmail(user.email, user.name, newToken)

    console.log('verification email resent to:', user.email)
    res.json({ message: 'Verification email sent! Check your inbox.' })

  } catch (error) {
    console.log('resend error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


// ── ROUTE 5: POST /auth/forgot-password ──────────────────────────────────────
// user submits their email → we generate a reset token → send reset email
// token expires in 1 hour
// always returns success message (don't reveal if email exists)

router.post('/forgot-password', async (req, res) => {

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Please enter your email address.' })
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() })

    // always return the same message — don't reveal if account exists
    if (!user || !user.isVerified) {
      return res.json({
        message: 'If that email is registered, a password reset link has been sent.'
      })
    }

    // generate reset token — expires in 1 hour
    const resetToken  = crypto.randomBytes(32).toString('hex')
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    user.resetPasswordToken  = resetToken
    user.resetPasswordExpiry = resetExpiry
    await user.save()

    await sendPasswordResetEmail(user.email, user.name, resetToken)

    console.log('password reset email sent to:', user.email)

    res.json({
      message: 'If that email is registered, a password reset link has been sent.'
    })

  } catch (error) {
    console.log('forgot-password error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


// ── ROUTE 6: POST /auth/reset-password ───────────────────────────────────────
// user submits token + new password
// verify token → check expiry → hash new password → save → clear token

router.post('/reset-password', async (req, res) => {

  const { token, password } = req.body

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' })
  }

  try {
    const user = await User.findOne({ resetPasswordToken: token })

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired reset link. Please request a new one.'
      })
    }

    // check expiry
    if (user.resetPasswordExpiry < new Date()) {
      // clear expired token
      user.resetPasswordToken  = null
      user.resetPasswordExpiry = null
      await user.save()

      return res.status(400).json({
        error:       'Reset link has expired. Please request a new one.',
        canRetry:    true,
      })
    }

    // hash new password
    const hashedPassword = await bcrypt.hash(password, 10)

    // save new password + clear reset token
    user.password            = hashedPassword
    user.resetPasswordToken  = null
    user.resetPasswordExpiry = null
    await user.save()

    console.log('password reset successfully for:', user.email)

    res.json({ message: 'Password reset successfully! You can now log in.' })

  } catch (error) {
    console.log('reset-password error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


module.exports = router