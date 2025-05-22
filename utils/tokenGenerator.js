const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate JWT token for authenticated users
 * @param {string} userId - User ID to include in token
 * @returns {string} - JWT token
 */
const generateAuthToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY }
  );
};

/**
 * Generate temporary registration token
 * @returns {string} - Random token
 */
const generateRegistrationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Get token expiration date
 * @returns {Date} - Date when token expires
 */
const getTokenExpiryDate = () => {
  const expiryMinutes = parseInt(process.env.REGISTRATION_TOKEN_EXPIRY) || 60;
  return new Date(Date.now() + expiryMinutes * 60 * 1000);
};

/**
 * Generate temporary password reset token
 * @returns {string} - Random token
 */
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Get password reset token expiration date (15 minutes)
 * @returns {Date} - Date when token expires
 */
const getPasswordResetExpiryDate = () => {
  return new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
};

module.exports = {
  generateAuthToken,
  generateRegistrationToken,
  generatePasswordResetToken,
  getTokenExpiryDate,
  getPasswordResetExpiryDate
};
