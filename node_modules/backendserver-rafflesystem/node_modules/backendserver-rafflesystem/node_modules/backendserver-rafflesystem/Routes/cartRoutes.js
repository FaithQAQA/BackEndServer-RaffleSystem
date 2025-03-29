const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { 
    getCart, 
    addToCart, 
    removeFromCart, 
    clearCart 
} = require('../controllers/cartController');  

const router = express.Router();

// Existing routes
router.get('/', authMiddleware, getCart);
router.post('/add', authMiddleware, addToCart);
router.post('/remove', authMiddleware, removeFromCart);
router.post('/clear', authMiddleware, clearCart);

module.exports = router;
