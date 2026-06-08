// routes/authRoutes.js
// all authentication endpoints live here
// POST /auth/register  → create account + send verification email
// POST /auth/login     → login + get JWT token
// GET  /auth/verify/:token → verify email address
// POST /auth/resend    → resend verification email

const express  = require('express')
const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const crypto   = require('crypto')
const User     = require('../models/User')
const { sendVerificationEmail } = require('../services/emailService')

const router = express.Router()


// ── ROUTE 1: POST /auth/register ─────────────────────────────────────────────
// new user signs up with name + email + password
// password gets hashed → user saved → verification email sent
// user CANNOT login until they verify their email

router.post('/register', async (req, res) => {

  const { name, email, password } = req.body

  // ── input validation ────────────────────────────────────────────────────
  if (!name || !email || !password) {
    return res.status(400).json({
      error: 'Name, email and password are all required.'
    })
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'Password must be at least 6 characters.'
    })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' })
  }

  try {

    // ── check if email already exists ───────────────────────────────────
    const existing = await User.findOne({ email: email.toLowerCase() })

    if (existing) {
      // if account exists but not verified → let them resend
      if (!existing.isVerified) {
        return res.status(400).json({
          error:      'This email is already registered but not verified.',
          canResend:  true,
          email:      email.toLowerCase()
        })
      }
      return res.status(400).json({
        error: 'An account with this email already exists. Please log in.'
      })
    }

    // ── hash password ───────────────────────────────────────────────────
    // saltRounds = 10 → bcrypt runs 2^10 = 1024 iterations
    // higher = more secure but slower. 10 is the industry standard
    const saltRounds   = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // ── generate verification token ─────────────────────────────────────
    // crypto.randomBytes(32) → 32 random bytes → 64 char hex string
    // this is what gets sent in the email link
    const verificationToken  = crypto.randomBytes(32).toString('hex')
    const tokenExpiry        = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // ── save user to mongodb ────────────────────────────────────────────
    const newUser = new User({
      name:                    name.trim(),
      email:                   email.toLowerCase(),
      password:                hashedPassword,
      isVerified:              false,
      verificationToken:       verificationToken,
      verificationTokenExpiry: tokenExpiry,
    })

    await newUser.save()
    console.log('new user registered:', email)

    // ── send verification email ─────────────────────────────────────────
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
// user logs in with email + password
// returns JWT token if credentials are correct and email is verified

router.post('/login', async (req, res) => {

  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' })
  }

  try {

    // ── find user ───────────────────────────────────────────────────────
    const user = await User.findOne({ email: email.toLowerCase() })

    if (!user) {
      // dont reveal whether email exists or not — security best practice
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    // ── check if email is verified ──────────────────────────────────────
    if (!user.isVerified) {
      return res.status(400).json({
        error:     'Please verify your email before logging in.',
        canResend: true,
        email:     user.email
      })
    }

    // ── compare password ────────────────────────────────────────────────
    // bcrypt.compare hashes the input and compares with stored hash
    // returns true if they match, false if not
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' })
    }

    // ── generate JWT token ──────────────────────────────────────────────
    // payload contains just enough info for the frontend to use
    // DO NOT include password in the payload
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email:  user.email,
        name:   user.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }   // token valid for 7 days
    )

    console.log('user logged in:', user.email)

    res.json({
      message: 'Logged in successfully!',
      token,
      user: {
        name:  user.name,
        email: user.email,
      }
    })

  } catch (error) {
    console.log('login error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


// ── ROUTE 3: GET /auth/verify/:token ─────────────────────────────────────────
// called when user clicks the link in their email
// finds user by token → checks expiry → marks isVerified = true

router.get('/verify/:token', async (req, res) => {

  const { token } = req.params

  if (!token) {
    return res.status(400).json({ error: 'Verification token is missing.' })
  }

  try {

    // find user who has this token
    const user = await User.findOne({ verificationToken: token })

    if (!user) {
      return res.status(400).json({
        error: 'Invalid verification link. It may have already been used.'
      })
    }

    // check if token has expired
    if (user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({
        error:     'Verification link has expired. Please request a new one.',
        canResend: true,
        email:     user.email
      })
    }

    // ── activate the account ────────────────────────────────────────────
    user.isVerified              = true
    user.verificationToken       = null   // clear token so link cant be reused
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
// user didn't get the email or it expired
// generates a fresh token and sends a new verification email

router.post('/resend', async (req, res) => {

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' })
  }

  try {

    const user = await User.findOne({ email: email.toLowerCase() })

    // dont reveal if account exists — just say "if it exists we sent it"
    if (!user) {
      return res.json({
        message: 'If that email is registered, a verification link has been sent.'
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        error: 'This account is already verified. Please log in.'
      })
    }

    // generate fresh token + new 24 hour window
    const newToken  = crypto.randomBytes(32).toString('hex')
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    user.verificationToken       = newToken
    user.verificationTokenExpiry = newExpiry
    await user.save()

    await sendVerificationEmail(user.email, user.name, newToken)

    console.log('verification email resent to:', user.email)

    res.json({
      message: 'Verification email sent! Check your inbox.'
    })

  } catch (error) {
    console.log('resend error:', error.message)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  }
})


module.exports = router