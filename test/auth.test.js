const request = require('supertest');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const User = require('../models/User');
const authRoutes = require('../routes/authRoutes');
const userRoutes = require('../routes/userRoutes');
const { apiLimiter } = require('../middlewares/rateLimiter');

// Create test app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Disable rate limiting for tests
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

describe('Authentication Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Registration initiated');

      // Check if user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
      expect(user.isVerified).toBe(false);
      expect(user.registrationToken).toBeTruthy();
    });

    it('should return error for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email is required');
    });

    it('should handle existing user registration', async () => {
      // Create user first
      const userData = { email: 'existing@example.com' };
      await request(app)
        .post('/api/auth/register')
        .send(userData);

      // Try to register again
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification email sent again');
    });
  });

  describe('POST /api/auth/verify-registration', () => {
    it('should verify user registration successfully', async () => {
      // Create user with registration token
      const user = new User({
        email: 'verify@example.com',
        password: 'temporary_password',
        registrationToken: 'valid_token_123',
        registrationTokenExpires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
      });
      await user.save();

      const verificationData = {
        token: 'valid_token_123',
        password: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/auth/verify-registration')
        .send(verificationData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Registration successful, you can now login');

      // Check if user is verified in database
      const verifiedUser = await User.findOne({ email: 'verify@example.com' });
      expect(verifiedUser.isVerified).toBe(true);
      expect(verifiedUser.registrationToken).toBeNull();
    });

    it('should return error for invalid token', async () => {
      const verificationData = {
        token: 'invalid_token',
        password: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/auth/verify-registration')
        .send(verificationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('should return error for short password', async () => {
      const user = new User({
        email: 'shortpass@example.com',
        password: 'temporary_password',
        registrationToken: 'valid_token_456',
        registrationTokenExpires: new Date(Date.now() + 60 * 60 * 1000)
      });
      await user.save();

      const verificationData = {
        token: 'valid_token_456',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/auth/verify-registration')
        .send(verificationData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password should be at least 8 characters long');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a verified user for login tests
      const user = new User({
        email: 'login@example.com',
        password: 'testpassword123',
        isVerified: true
      });
      await user.save();
    });

    it('should login verified user successfully', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeTruthy();
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'login@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid credentials');
    });

    it('should return error for unverified user', async () => {
      // Create unverified user
      const unverifiedUser = new User({
        email: 'unverified@example.com',
        password: 'testpassword123',
        isVerified: false
      });
      await unverifiedUser.save();

      const loginData = {
        email: 'unverified@example.com',
        password: 'testpassword123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Please verify your email first');
    });

    it('should return error for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email and password are required');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      // Create a verified user
      const user = new User({
        email: 'forgot@example.com',
        password: 'testpassword123',
        isVerified: true
      });
      await user.save();
    });

    it('should send password reset email for existing user', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link has been sent');

      // Check if reset token was set
      const user = await User.findOne({ email: 'forgot@example.com' });
      expect(user.passwordResetToken).toBeTruthy();
      expect(user.passwordResetExpires).toBeTruthy();
    });

    it('should return same message for non-existing user (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link has been sent');
    });

    it('should return error for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email is required');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    beforeEach(async () => {
      // Create user with password reset token
      const user = new User({
        email: 'reset@example.com',
        password: 'oldpassword123',
        isVerified: true,
        passwordResetToken: 'valid_reset_token',
        passwordResetExpires: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now
      });
      await user.save();
    });

    it('should reset password successfully', async () => {
      const resetData = {
        token: 'valid_reset_token',
        password: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset successful, please login with your new password');

      // Verify password was changed and token was cleared
      const user = await User.findOne({ email: 'reset@example.com' }).select('+password');
      expect(user.passwordResetToken).toBeNull();
      expect(user.passwordResetExpires).toBeNull();
      
      // Verify new password works
      const isMatch = await user.comparePassword('newpassword123');
      expect(isMatch).toBe(true);
    });

    it('should return error for invalid token', async () => {
      const resetData = {
        token: 'invalid_token',
        password: 'newpassword123'
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or expired reset token');
    });

    it('should return error for short password', async () => {
      const resetData = {
        token: 'valid_reset_token',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(resetData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password should be at least 8 characters long');
    });
  });
});