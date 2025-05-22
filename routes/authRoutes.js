const express = require('express');
const router = express.Router();
const { 
  register, 
  verifyRegistration, 
  login,
  forgotPassword,
  resetPassword,
  logout
} = require('../controllers/authController');
const { 
  registrationLimiter, 
  advancedLoginLimiter,
  authLimiter 
} = require('../middlewares/rateLimiter');
const { protect } = require('../middlewares/auth');

// Register new user - sends verification email
router.post('/register', registrationLimiter, register);

// Verify registration with token from email
router.post('/verify-registration', verifyRegistration);

// Login - apply advanced rate limiter for this route
router.post('/login', advancedLoginLimiter, login);

// Forgot password - request password reset
router.post('/forgot-password', authLimiter, forgotPassword);

// Reset password with token
router.post('/reset-password', resetPassword);

// Logout - protected route
router.post('/logout', protect, logout);

module.exports = router;