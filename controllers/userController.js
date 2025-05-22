/**
 * @desc    Get protected user data
 * @route   GET /api/users/protected
 * @access  Private
 */
const getProtectedData = async (req, res) => {
  try {
    // The user is already available in req.user from the auth middleware
    res.status(200).json({
      success: true,
      message: 'You have access to protected data',
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          isVerified: req.user.isVerified,
          createdAt: req.user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get protected data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getProtectedData
};
