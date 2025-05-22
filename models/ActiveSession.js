const mongoose = require('mongoose');

const ActiveSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  token: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Document expires after 24 hours (same as JWT)
  }
});

module.exports = mongoose.model('ActiveSession', ActiveSessionSchema);