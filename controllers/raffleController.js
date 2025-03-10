// controllers/raffleController.js
const Raffle = require('../Models/Raffle');

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
  const { title, description, startDate, endDate, price, category, status } = req.body;

  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }

    raffle.title = title || raffle.title;
    raffle.description = description || raffle.description;
    raffle.startDate = startDate || raffle.startDate;
    raffle.endDate = endDate || raffle.endDate;
    raffle.price = price || raffle.price;
    raffle.category = category || raffle.category;
    raffle.status = status || raffle.status;

    await raffle.save();
    res.json(raffle);
  } catch (err) {
    console.error('Error updating raffle:', err); // Log the actual error
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

// Delete a raffle
const deleteRaffle = async (req, res) => {
  try {
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }

    await raffle.remove();
    res.json({ message: 'Raffle deleted' });
  } catch (err) {
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
};