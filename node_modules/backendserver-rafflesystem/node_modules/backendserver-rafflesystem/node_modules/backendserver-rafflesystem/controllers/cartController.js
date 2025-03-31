const Cart = require('../Models/Cart');
const Raffle = require('../Models/Raffle'); // Import Raffle model
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
      // Find the user's cart
      let cart = await Cart.findOne({ userId: req.user.id });
  
      if (!cart) {
        cart = new Cart({ userId: req.user.id, items: [] });
      }
  
      // Find the raffle ticket using the raffleId
      const raffle = await Raffle.findById(raffleId);
      if (!raffle) {
        return res.status(404).json({ message: 'Raffle not found' });
      }
  
      const ticketPrice = raffle.price;
      const totalCost = ticketPrice * quantity;  // Calculate total cost for the quantity of tickets
  
      console.log('Ticket Price:', ticketPrice);
      console.log('Total Cost:', totalCost);
  
      // Check if the item already exists in the cart
      const existingItem = cart.items.find(item => item.raffleId.toString() === raffleId);
      if (existingItem) {
        existingItem.quantity += quantity;  // Increment the quantity
        existingItem.totalCost += totalCost;  // Add to the total cost
      } else {
        // Add the new item to the cart with totalCost
        cart.items.push({
          raffleId,
          quantity,
          totalCost  // Include the total cost for the new item
        });
      }
  
      console.log('Updated Cart:', cart);
  
      // Ensure all items in the cart have totalCost
      cart.items.forEach(item => {
        if (item.totalCost === undefined) {
          item.totalCost = item.quantity * ticketPrice;  // Ensure totalCost is assigned
        }
      });
  
      // Save the cart to the database
      await cart.save();
      res.json(cart);
    } catch (error) {
      console.error('Error in addToCart:', error);  // Log the error for debugging
      res.status(500).json({ message: 'Error adding to cart', error: error.message });
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


module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart
};
