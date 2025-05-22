const request = require('supertest');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authRoutes = require('../routes/authRoutes');
const userRoutes = require('../routes/userRoutes');

// Create test app
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Mock JWT secret for testing
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.JWT_EXPIRY = '24h';

describe('Protected Routes', () => {
  let testUser;
  let authToken;

  beforeEach(async () => {
    // Create a verified user
    testUser = new User({
      email: 'protected@example.com',
      password: 'testpassword123',
      isVerified: true
    });
    await testUser.save();

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );
  });

  describe('GET /api/users/protected', () => {
    it('should return protected data for authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/protected')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('You have access to protected data');
      expect(response.body.data.user.email).toBe('protected@example.com');
      expect(response.body.data.user.id).toBe(testUser._id.toString());
    });

    it('should return error for missing token', async () => {
      const response = await request(app)
        .get('/api/users/protected')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized, no token provided');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/users/protected')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized, token failed');
    });

    it('should return error for expired token', async () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { id: testUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/users/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized, token failed');
    });

    it('should return error for unverified user', async () => {
      // Create unverified user
      const unverifiedUser = new User({
        email: 'unverified@example.com',
        password: 'testpassword123',
        isVerified: false
      });
      await unverifiedUser.save();

      // Generate token for unverified user
      const unverifiedToken = jwt.sign(
        { id: unverifiedUser._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRY }
      );

      const response = await request(app)
        .get('/api/users/protected')
        .set('Authorization', `Bearer ${unverifiedToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Please verify your email first');
    });

    it('should return error when user no longer exists', async () => {
      // Delete the user after creating the token
      await User.findByIdAndDelete(testUser._id);

      const response = await request(app)
        .get('/api/users/protected')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized, user not found');
    });

    it('should handle malformed Authorization header', async () => {
      const response = await request(app)
        .get('/api/users/protected')
        .set('Authorization', 'InvalidFormat')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized, no token provided');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should return error for missing token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Not authorized, no token provided');
    });
  });
});