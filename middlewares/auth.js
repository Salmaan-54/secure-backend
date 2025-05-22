const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware to protect routes
 */
const protect = async (req, res, next) => {
  let token;
  
  // Check if token exists in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user by id and exclude password
      req.user = await User.findById(decoded.id).select('-password');
      
      // Check if user exists
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, user not found'
        });
      }
      
      // Check if user is verified
      if (!req.user.isVerified) {
        return res.status(401).json({
          success: false,
          message: 'Please verify your email first'
        });
      }
      
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided'
    });
  }
};

module.exports = { protect };
