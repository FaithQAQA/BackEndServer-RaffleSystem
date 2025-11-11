const Cart = require('../Models/Cart');
const Raffle = require('../Models/Raffle');

const getCart = async (req, res) => {
  try {
    const cart = await findCartByUserId(req.user.id);
    const responseCart = cart || createEmptyCart(req.user.id);
    res.json(responseCart);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching cart' });
  }
};

const addToCart = async (req, res) => {
  const { raffleId, quantity } = req.body;

  try {
    let cart = await findOrCreateCartForUser(req.user.id);
    const raffle = await findRaffleById(raffleId);
    
    validateRaffleExists(raffle);
    
    const ticketPrice = raffle.price;
    const itemTotalCost = calculateItemTotalCost(ticketPrice, quantity);

    await updateCartWithItem(cart, raffleId, quantity, itemTotalCost, ticketPrice);
    
    res.json(cart);
  } catch (error) {
    handleCartError(res, error, 'Error adding to cart');
  }
};

const removeFromCart = async (req, res) => {
  const { raffleId } = req.body;

  try {
    const cart = await findCartByUserId(req.user.id);
    
    if (cart) {
      await removeItemFromCart(cart, raffleId);
    }

    res.json(cart);
  } catch (error) {
    res.status(500).json({ message: 'Error removing item' });
  }
};

const clearCart = async (req, res) => {
  try {
    await deleteCartByUserId(req.user.id);
    res.json({ message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Error clearing cart' });
  }
};

// Helper functions with single responsibilities

const findCartByUserId = async (userId) => {
  return await Cart.findOne({ userId }).populate('items.raffleId');
};

const createEmptyCart = (userId) => {
  return { userId, items: [] };
};

const findOrCreateCartForUser = async (userId) => {
  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [] });
  }
  return cart;
};

const findRaffleById = async (raffleId) => {
  return await Raffle.findById(raffleId);
};

const validateRaffleExists = (raffle) => {
  if (!raffle) {
    throw new Error('Raffle not found');
  }
};

const calculateItemTotalCost = (ticketPrice, quantity) => {
  return ticketPrice * quantity;
};

const updateCartWithItem = async (cart, raffleId, quantity, itemTotalCost, ticketPrice) => {
  const existingItem = findExistingCartItem(cart, raffleId);
  
  if (existingItem) {
    updateExistingCartItem(existingItem, quantity, itemTotalCost);
  } else {
    addNewCartItem(cart, raffleId, quantity, itemTotalCost);
  }

  ensureAllItemsHaveTotalCost(cart, ticketPrice);
  await saveCart(cart);
};

const findExistingCartItem = (cart, raffleId) => {
  return cart.items.find(item => item.raffleId.toString() === raffleId);
};

const updateExistingCartItem = (existingItem, quantity, itemTotalCost) => {
  existingItem.quantity += quantity;
  existingItem.totalCost += itemTotalCost;
};

const addNewCartItem = (cart, raffleId, quantity, totalCost) => {
  cart.items.push({
    raffleId,
    quantity,
    totalCost
  });
};

const ensureAllItemsHaveTotalCost = (cart, ticketPrice) => {
  cart.items.forEach(item => {
    if (item.totalCost === undefined) {
      item.totalCost = item.quantity * ticketPrice;
    }
  });
};

const saveCart = async (cart) => {
  await cart.save();
};

const removeItemFromCart = async (cart, raffleId) => {
  cart.items = cart.items.filter(item => item.raffleId.toString() !== raffleId);
  await saveCart(cart);
};

const deleteCartByUserId = async (userId) => {
  await Cart.findOneAndDelete({ userId });
};

const handleCartError = (res, error, defaultMessage) => {
  console.error('Cart operation error:', error);
  res.status(500).json({ 
    message: defaultMessage, 
    error: error.message 
  });
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart
};