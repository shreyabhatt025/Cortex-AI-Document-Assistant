// middleware/authMiddleware.js
// this function runs BEFORE /ask and /upload route handlers
// it checks if the request has a valid JWT token
// if yes → allows the request through
// if no  → blocks it with 401 unauthorized

const jwt = require('jsonwebtoken')

function authMiddleware(req, res, next) {

  // every protected request must include this header:
  // Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  const authHeader = req.headers['authorization']

  // if header is missing entirely → block
  if (!authHeader) {
    return res.status(401).json({
      error: 'Access denied. Please log in to use Cortex.'
    })
  }

  // header must start with "Bearer " followed by the token
  // "Bearer " is 7 characters — everything after is the token
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Invalid token format. Expected: Bearer <token>'
    })
  }

  const token = authHeader.slice(7)

  try {
    // jwt.verify checks:
    // 1. token was signed with our JWT_SECRET (not fake)
    // 2. token has not expired
    // if both pass → decoded contains { userId, email, name }
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // attach user info to req so route handlers can use it
    // eg: req.user.userId → who is asking the question
    req.user = decoded

    // pass control to the actual route handler
    next()

  } catch (err) {

    // TokenExpiredError → user needs to log in again
    // JsonWebTokenError  → token was tampered with or invalid
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Session expired. Please log in again.'
      })
    }

    return res.status(401).json({
      error: 'Invalid token. Please log in again.'
    })
  }
}

module.exports = authMiddleware