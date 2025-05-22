const express = require('express');
const router = express.Router();
const { getProtectedData } = require('../controllers/userController');
const { protect } = require('../middlewares/auth');

// Protected route - requires authentication
router.get('/protected', protect, getProtectedData);

module.exports = router;
