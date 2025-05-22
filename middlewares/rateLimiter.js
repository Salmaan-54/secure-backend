const rateLimit = require('express-rate-limit');
const LoginAttempt = require('../models/LoginAttempt');
const ActiveSession = require('../models/ActiveSession');

/**
 * Rate limiter middleware to prevent brute force attacks on auth routes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth routes
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Registration rate limiter - more restrictive
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registration attempts per hour
  message: {
    success: false,
    message: 'Too many registration attempts, please try again after 1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Advanced login rate limiter with user-specific tracking
 */
const advancedLoginLimiter = async (req, res, next) => {
  try {
    const { email } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Check failed attempts for this email in the last 15 minutes
    const failedAttempts = await LoginAttempt.countDocuments({
      email: email.toLowerCase(),
      successful: false,
      timestamp: { $gte: fifteenMinutesAgo }
    });

    // Check failed attempts for this IP in the last 15 minutes
    const ipFailedAttempts = await LoginAttempt.countDocuments({
      ip: clientIP,
      successful: false,
      timestamp: { $gte: fifteenMinutesAgo }
    });

    // Block if too many failed attempts
    if (failedAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed login attempts for this email. Please try again in 15 minutes.'
      });
    }

    if (ipFailedAttempts >= 10) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed login attempts from this IP. Please try again in 15 minutes.'
      });
    }

    // Check if user is already logged in (has active session)
    const user = await require('../models/User').findOne({ email: email.toLowerCase() });
    if (user) {
      const activeSession = await ActiveSession.findOne({ userId: user._id });
      if (activeSession) {
        return res.status(409).json({
          success: false,
          message: 'User is already logged in. Please logout first or wait for session to expire.'
        });
      }
    }

    // Store client IP and email for later use in login controller
    req.clientIP = clientIP;
    req.userEmail = email.toLowerCase();
    
    next();
  } catch (error) {
    console.error('Advanced login limiter error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Record login attempt
 */
const recordLoginAttempt = async (email, ip, successful) => {
  try {
    await LoginAttempt.create({
      email: email.toLowerCase(),
      ip,
      successful
    });
  } catch (error) {
    console.error('Error recording login attempt:', error);
  }
};

/**
 * Create active session
 */
const createActiveSession = async (userId, token) => {
  try {
    // Remove any existing session for this user
    await ActiveSession.deleteOne({ userId });
    
    // Create new session
    await ActiveSession.create({
      userId,
      token
    });
  } catch (error) {
    console.error('Error creating active session:', error);
    throw error;
  }
};

/**
 * Remove active session (logout)
 */
const removeActiveSession = async (userId) => {
  try {
    await ActiveSession.deleteOne({ userId });
  } catch (error) {
    console.error('Error removing active session:', error);
    throw error;
  }
};

module.exports = {
  authLimiter,
  registrationLimiter,
  apiLimiter,
  advancedLoginLimiter,
  recordLoginAttempt,
  createActiveSession,
  removeActiveSession
};