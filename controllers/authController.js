const User = require('../models/User');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../config/email');
const { 
  generateAuthToken, 
  generateRegistrationToken, 
  generatePasswordResetToken,
  getTokenExpiryDate,
  getPasswordResetExpiryDate
} = require('../utils/tokenGenerator');
const { 
  recordLoginAttempt, 
  createActiveSession, 
  removeActiveSession 
} = require('../middlewares/rateLimiter');

/**
 * @desc    Register a new user - send verification email
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Check if user already exists
    const userExists = await User.findOne({ email });
    
    if (userExists) {
      // If user exists but is not verified, send new verification email
      if (!userExists.isVerified) {
        const token = generateRegistrationToken();
        const tokenExpiry = getTokenExpiryDate();
        
        userExists.registrationToken = token;
        userExists.registrationTokenExpires = tokenExpiry;
        await userExists.save();
        
        await sendVerificationEmail(email, token);
        
        return res.status(200).json({
          success: true,
          message: 'Verification email sent again'
        });
      }
      
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }
    
    // Generate registration token and expiry
    const token = generateRegistrationToken();
    const tokenExpiry = getTokenExpiryDate();
    
    // Create user with registration token
    const user = await User.create({
      email,
      password: 'temporary_password', // Will be set during verification
      registrationToken: token,
      registrationTokenExpires: tokenExpiry
    });
    
    // Send verification email
    await sendVerificationEmail(email, token);
    
    res.status(201).json({
      success: true,
      message: 'Registration initiated, please check your email to complete the process'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Verify user registration
 * @route   POST /api/auth/verify-registration
 * @access  Public
 */
const verifyRegistration = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }
    
    // Find user with the provided token
    const user = await User.findOne({
      registrationToken: token,
      registrationTokenExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password should be at least 8 characters long'
      });
    }
    
    // Update user
    user.password = password;
    user.isVerified = true;
    user.registrationToken = null;
    user.registrationTokenExpires = null;
    
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Registration successful, you can now login'
    });
  } catch (error) {
    console.error('Verify registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIP = req.clientIP;
    const userEmail = req.userEmail;
    
    if (!email || !password) {
      await recordLoginAttempt(userEmail, clientIP, false);
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Find user and include password for validation
    const user = await User.findOne({ email: userEmail }).select('+password');
    
    if (!user) {
      await recordLoginAttempt(userEmail, clientIP, false);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      await recordLoginAttempt(userEmail, clientIP, false);
      return res.status(401).json({
        success: false,
        message: 'Please verify your email first'
      });
    }
    
    // Validate password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      await recordLoginAttempt(userEmail, clientIP, false);
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate JWT token
    const token = generateAuthToken(user._id);
    
    // Create active session
    await createActiveSession(user._id, token);
    
    // Record successful login attempt
    await recordLoginAttempt(userEmail, clientIP, true);
    
    res.status(200).json({
      success: true,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Request password reset
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }
    
    // Check if user is verified
    if (!user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email first'
      });
    }
    
    // Generate password reset token
    const resetToken = generatePasswordResetToken();
    const resetExpires = getPasswordResetExpiryDate();
    
    // Save reset token to user
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save();
    
    // Send password reset email
    await sendPasswordResetEmail(email, resetToken);
    
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }
    
    // Validate password
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password should be at least 8 characters long'
      });
    }
    
    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }
    
    // Update password and clear reset token
    user.password = password;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();
    
    // Remove any active sessions for this user
    await removeActiveSession(user._id);
    
    res.status(200).json({
      success: true,
      message: 'Password reset successful, please login with your new password'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    // Remove active session
    await removeActiveSession(req.user._id);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  register,
  verifyRegistration,
  login,
  forgotPassword,
  resetPassword,
  logout
};