// controllers/raffleController.js
const Raffle = require('../Models/Raffle');
const mongoose = require('mongoose');
const User = require('../Models/User'); // Ensure correct path

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


const getRaffleWinningChance = async (req, res) => {
  try {
    const { raffleId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(raffleId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid raffleId or userId format" });
    }

    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    const participant = raffle.participants.find(p => p.userId.equals(userId));
    const userTicketCount = participant ? participant.ticketsBought : 0;
    const totalTickets = raffle.totalTicketsSold;

    const winningChance = totalTickets > 0 ? (userTicketCount / totalTickets) * 100 : 0;

    res.json({ totalTickets, userTickets: userTicketCount, winningChance });
  } catch (error) {
    console.error("Error calculating winning chance:", error);
    res.status(500).json({ error: "Internal Server Error" });
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


const purchaseTickets = async (req, res) => {
  try {
    const { raffleId, userId, ticketsBought } = req.body;
     const raffleIds = req.params.raffleId
    const raffle = await Raffle.findById(raffleIds);
    if (!raffle) return res.status(404).json({ error: "Raffle not found" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Update total ticket count in Raffle model
    raffle.totalTicketsSold += ticketsBought;
    await raffle.save();

    // Update user's ticket entry in participants
    const participantIndex = raffle.participants.findIndex(p => p.userId.equals(userId));
    if (participantIndex !== -1) {
      raffle.participants[participantIndex].ticketsBought += ticketsBought;
    } else {
      raffle.participants.push({ userId, ticketsBought });
    }
    
    await raffle.save();

    res.json({ message: "Tickets purchased successfully", totalTicketsSold: raffle.totalTicketsSold });
  } catch (error) {
    console.error("Error purchasing tickets:", error);
    res.status(500).json({ error: "Internal Server Error" });
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


// Pick winner for a raffle
const pickWinner = async (req, res) => {
  try {
    const { raffleId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(raffleId)) {
      return res.status(400).json({ message: "Invalid raffle ID" });
    }

    const raffle = await Raffle.findById(raffleId).populate("participants.userId", "name email");
    if (!raffle) {
      return res.status(404).json({ message: "Raffle not found" });
    }

    // Check if raffle has ended
    const now = new Date();
    if (now < raffle.endDate) {
      return res.status(400).json({ message: "Raffle has not ended yet" });
    }

    if (!raffle.participants || raffle.participants.length === 0) {
      return res.status(400).json({ message: "No participants in this raffle" });
    }

    // Weighted random selection based on ticketsBought
    let ticketPool = [];
    raffle.participants.forEach(p => {
      for (let i = 0; i < p.ticketsBought; i++) {
        ticketPool.push(p.userId);
      }
    });

    const winnerIndex = Math.floor(Math.random() * ticketPool.length);
    const winner = ticketPool[winnerIndex];

    // Save winner in raffle document
    raffle.winner = winner._id || winner;
    raffle.status = "completed";
    await raffle.save();

    res.json({
      message: "Winner selected successfully",
      winner: {
        id: winner._id,
        name: winner.name,
        email: winner.email
      }
    });

  } catch (error) {
    console.error("Error picking raffle winner:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};



module.exports = {
  createRaffle,
  getAllRaffles,
  getRecentRaffles,
  getRaffleById,
  updateRaffle,
  deleteRaffle,
  getRaffleWinningChance,
  purchaseTickets,
  pickWinner
};