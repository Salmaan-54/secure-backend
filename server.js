const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middlewares/rateLimiter');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

// Initialize Express
const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from public directory
app.use(express.static('public'));

// Apply rate limiting to all requests
app.use(apiLimiter);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'API is running...' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error'
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
