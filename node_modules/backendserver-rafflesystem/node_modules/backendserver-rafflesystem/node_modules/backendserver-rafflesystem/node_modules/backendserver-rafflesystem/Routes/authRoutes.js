// routes/authRoutes.js
const express = require('express');
const { registerUser, loginUser, verifyEmail } = require('../controllers/authController');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/verify-email', verifyEmail); // New route

module.exports = router;
