const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const cartController = require('../controllers/cartController');

const router = express.Router();

// ======================= RESTFUL CART ROUTES =======================
router.get('/', authMiddleware, cartController.getCart);                    // GET /api/cart - Retrieve user's cart
router.delete('/', authMiddleware, cartController.clearCart);              // DELETE /api/cart - Clear entire cart
router.post('/items', authMiddleware, cartController.addToCart);           // POST /api/cart/items - Add item to cart
router.delete('/items/:raffleId', authMiddleware, cartController.removeFromCart); // DELETE /api/cart/items/:raffleId - Remove specific item

// ======================= BACKWARD COMPATIBILITY ROUTES =======================
// Keep existing routes for backward compatibility during transition
router.post('/add', authMiddleware, cartController.addToCart);             // Legacy add route
router.post('/remove', authMiddleware, cartController.removeFromCart);     // Legacy remove route
router.post('/clear', authMiddleware, cartController.clearCart);           // Legacy clear route

module.exports = router;