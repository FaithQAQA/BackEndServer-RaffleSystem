const Cart = require('../Models/Cart');

// Get user's cart
const getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.raffleId');
    res.json(cart || { userId: req.user.id, items: [] });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart' });
  }
};

// Add item to cart
const addToCart = async (req, res) => {
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
};

// Remove item from cart
const removeFromCart = async (req, res) => {
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
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    await Cart.findOneAndDelete({ userId: req.user.id });
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cart' });
  }
};

// ✅ Export functions correctly
module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart
};
