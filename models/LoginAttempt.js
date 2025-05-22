const mongoose = require('mongoose');

const LoginAttemptSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  ip: {
    type: String,
    required: true
  },
  successful: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 900 // Document expires after 15 minutes
  }
});

// Index for efficient queries
LoginAttemptSchema.index({ email: 1, timestamp: -1 });
LoginAttemptSchema.index({ ip: 1, timestamp: -1 });

module.exports = mongoose.model('LoginAttempt', LoginAttemptSchema);