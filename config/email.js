const nodemailer = require('nodemailer');

/**
 * Configure nodemailer transporter with Gmail
 */
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send verification email
 * @param {string} to - Recipient email
 * @param {string} token - Verification token
 * @returns {Promise} - Email send result
 */
const sendVerificationEmail = async (to, token) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-registration?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Verify Your Registration',
    html: `
      <h1>Welcome to Our Service!</h1>
      <p>Please click the link below to verify your registration:</p>
      <a href="${verificationLink}">Verify Your Account</a>
      <p>This link will expire in ${process.env.REGISTRATION_TOKEN_EXPIRY} minutes.</p>
      <p>If you did not request this registration, please ignore this email.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} token - Password reset token
 * @returns {Promise} - Email send result
 */
const sendPasswordResetEmail = async (to, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'Password Reset Request',
    html: `
      <h1>Password Reset</h1>
      <p>You requested a password reset. Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Your Password</a>
      <p>This link will expire in 15 minutes.</p>
      <p>If you did not request this password reset, please ignore this email.</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent: ' + info.response);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};