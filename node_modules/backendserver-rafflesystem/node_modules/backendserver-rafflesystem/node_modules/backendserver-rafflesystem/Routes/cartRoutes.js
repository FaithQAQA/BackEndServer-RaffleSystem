const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartController');
const { verifyToken } = require('../middleware/authMiddleware'); // Ensure user is authenticated

router.get('/', verifyToken, CartController.getCart);
router.post('/add', verifyToken, CartController.addToCart);
router.post('/remove', verifyToken, CartController.removeFromCart);
router.post('/clear', verifyToken, CartController.clearCart);

module.exports = router;
