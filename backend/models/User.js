// models/User.js
// defines the structure of every user stored in mongodb
// week 5 → proper email + password authentication

const mongoose = require('mongoose')

const userSchema = new mongoose.Schema({

  // display name — shown in sidebar after login
  name: {
    type:     String,
    required: true,
    trim:     true,
  },

  // email is the unique identifier for every user
  email: {
    type:      String,
    required:  true,
    unique:    true,      // no two users can have same email
    lowercase: true,      // always store as lowercase
    trim:      true,
  },

  // password is NEVER stored as plain text
  // bcrypt hashes it before saving → one way, cannot be reversed
  password: {
    type:      String,
    required:  true,
    minlength: 6,
  },

  // false until user clicks the link in their email
  // unverified users cannot login
  isVerified: {
    type:    Boolean,
    default: false,
  },

  // random token sent in verification email
  // stored here so we can match it when user clicks the link
  // set to null after verification is complete
  verificationToken: {
    type:    String,
    default: null,
  },

  // token expires after 24 hours
  // prevents old links from working
  verificationTokenExpiry: {
    type:    Date,
    default: null,
  },

  createdAt: {
    type:    Date,
    default: Date.now,
  },

})

module.exports = mongoose.model('User', userSchema)