const express = require('express');
const router = express.Router();
const Cart = require('../Models/Cart');
const { verifyToken } = require('../middleware/authMiddleware'); // Ensure user is authenticated

// Get user's cart
router.get('/', verifyToken, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.raffleId');
    res.json(cart || { userId: req.user.id, items: [] });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart' });
  }
});

// Add item to cart
router.post('/add', verifyToken, async (req, res) => {
  const { raffleId, quantity } = req.body;

  try {
    let cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
    }

    const existingItem = cart.items.find(item => item.raffleId.toString() === raffleId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ raffleId, quantity });
    }

    await cart.save();
    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error adding to cart' });
  }
});

// Remove item from cart
router.post('/remove', verifyToken, async (req, res) => {
  const { raffleId } = req.body;

  try {
    let cart = await Cart.findOne({ userId: req.user.id });

    if (cart) {
      cart.items = cart.items.filter(item => item.raffleId.toString() !== raffleId);
      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error removing item' });
  }
});

// Clear cart
router.post('/clear', verifyToken, async (req, res) => {
  try {
    await Cart.findOneAndDelete({ userId: req.user.id });
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cart' });
  }
});

module.exports = router;
