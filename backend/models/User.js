// models/User.js
const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({

  name: {
    type:     String,
    required: true,
    trim:     true,
  },

  email: {
    type:      String,
    required:  true,
    unique:    true,
    lowercase: true,
    trim:      true,
  },

  password: {
    type:      String,
    required:  true,
    minlength: 6,
  },

  isVerified: {
    type:    Boolean,
    default: false,
  },

  verificationToken: {
    type:    String,
    default: null,
  },

  verificationTokenExpiry: {
    type:    Date,
    default: null,
  },

  // ── FORGOT PASSWORD fields ────────────────────────────────────────────────
  // random token emailed to user when they request a password reset
  // null when no reset is pending
  resetPasswordToken: {
    type:    String,
    default: null,
  },

  // token expires after 1 hour — shorter than verify (security best practice)
  resetPasswordExpiry: {
    type:    Date,
    default: null,
  },

  createdAt: {
    type:    Date,
    default: Date.now,
  },

})

module.exports = mongoose.model('User', userSchema)