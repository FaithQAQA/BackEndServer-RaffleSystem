const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const authMiddleware = require('../middleware/authMiddleware');

// Get all users (Admin only)
router.get('/users', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (req.query.search) {
      filter.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    if (req.query.isAdmin !== undefined) {
      filter.isAdmin = req.query.isAdmin === 'true';
    }
    if (req.query.emailVerified !== undefined) {
      filter.emailVerified = req.query.emailVerified === 'true';
    }

    // Get users with pagination
    const users = await User.find(filter)
      .select('-password -verificationToken -resetToken -resetTokenExpiry') // Exclude sensitive fields
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    res.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID (Admin or own profile)
router.get('/users/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -verificationToken -resetToken -resetTokenExpiry');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Users can only view their own profile unless they're admin
    if (req.user.id !== req.params.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(user);

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/users/profile/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -verificationToken -resetToken -resetTokenExpiry');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (Admin or own profile)
router.put('/users/:id', authMiddleware, async (req, res) => {
  try {
    const { username, email, isAdmin } = req.body;
    
    // Find user
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Users can only update their own profile unless they're admin
    if (req.user.id !== req.params.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only admin can change admin status
    if (isAdmin !== undefined && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Only admin can change admin status' });
    }

    // Update fields
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (isAdmin !== undefined && req.user.isAdmin) updateData.isAdmin = isAdmin;

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -verificationToken -resetToken -resetTokenExpiry');

    res.json(updatedUser);

  } catch (error) {
    console.error('Error updating user:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (Admin only)
router.delete('/users/:id', authMiddleware, async (req, res) => {
  try {
    // Only admin can delete users
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user statistics (Admin only)
router.get('/users/stats/overview', authMiddleware, async (req, res) => {
  try {
    // Only admin can view statistics
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ isAdmin: true });
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    const lockedUsers = await User.countDocuments({ isLocked: true });

    // Get users created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    res.json({
      totalUsers,
      adminUsers,
      verifiedUsers,
      lockedUsers,
      newUsers,
      regularUsers: totalUsers - adminUsers
    });

  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users by registration date (for charts)
router.get('/users/stats/registration', authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const registrationStats = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    res.json(registrationStats);

  } catch (error) {
    console.error('Error fetching registration stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;