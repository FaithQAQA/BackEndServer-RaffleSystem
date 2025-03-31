// controllers/raffleController.js
const Raffle = require('../Models/Raffle');
const mongoose = require('mongoose');

// Create a new raffle
const createRaffle = async (req, res) => {
  const { title, description, startDate, endDate, price, category } = req.body;

  try {
    const raffle = new Raffle({ title, description, startDate, endDate, price, category });
    await raffle.save();
    res.status(201).json(raffle);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};


const getRaffleWinningChance = async (raffleId, userId) => {
  try {
    const raffle = await Raffle.findById(raffleId);

    if (!raffle) {
      throw new Error('Raffle not found');
    }

    // Calculate total tickets bought for the raffle
    const totalTickets = raffle.participants.reduce((sum, participant) => sum + participant.ticketsBought, 0);

    // Get the user's tickets for this raffle
    const user = raffle.participants.find(p => p.userId.toString() === userId.toString());
    const userTickets = user ? user.ticketsBought : 0;

    // Calculate winning chance
    const winningChance = totalTickets > 0 ? (userTickets / totalTickets) * 100 : 0;

    return {
      totalTickets,
      userTickets,
      winningChance: winningChance.toFixed(2) // Round to 2 decimal places
    };
  } catch (error) {
    console.error('Error calculating winning chance:', error.message);
    return null;
  }
};


// Fetch all raffles
const getAllRaffles = async (req, res) => {
  try {
    const raffles = await Raffle.find().sort({ createdAt: -1 });
    res.json(raffles);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch recent activity (last 3 raffles)
const getRecentRaffles = async (req, res) => {
  try {
    const raffles = await Raffle.find().sort({ createdAt: -1 }).limit(3);
    res.json(raffles);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Fetch a single raffle by ID
const getRaffleById = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }
    res.json(raffle);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Update a raffle
const updateRaffle = async (req, res) => {
  try {
    const { title, description, startDate, endDate, price, category, status } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid raffle ID' });
    }

    console.log('Updating raffle with data:', req.body); // Debugging

    // Find and update raffle
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) return res.status(404).json({ message: 'Raffle not found' });

    raffle.title = title || raffle.title;
    raffle.description = description || raffle.description;
    raffle.startDate = startDate ? new Date(startDate) : raffle.startDate;
    raffle.endDate = endDate ? new Date(endDate) : raffle.endDate;
    raffle.price = price ?? raffle.price;
    raffle.category = category || raffle.category;
    raffle.status = status || raffle.status;

    await raffle.save();
    res.json(raffle);
  } catch (err) {
    console.error('Error updating raffle:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};



const deleteRaffle = async (req, res) => {
  try {
    // Check if the provided ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid raffle ID' });
    }

    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }

    await Raffle.findByIdAndDelete(req.params.id); // Use this instead of `.remove()`
    
    res.json({ message: 'Raffle deleted successfully' });
  } catch (err) {
    console.error(err); // Log the error for debugging
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
  createRaffle,
  getAllRaffles,
  getRecentRaffles,
  getRaffleById,
  updateRaffle,
  deleteRaffle,
  getRaffleWinningChance
};