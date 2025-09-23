// Import required models and dependencies
const Raffle = require('../Models/Raffle');
const User = require('../Models/User');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { Client, Environment } = require('square');

// Initialize Square client (using Sandbox for testing)
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN, // Securely stored in environment variable
  environment: Environment.Sandbox,             
});

// ======================= PURCHASE TICKETS =======================
const purchaseTickets = async (req, res) => {
  try {
    const { userId, ticketsBought, paymentToken } = req.body;
    const raffleId = req.params.raffleId;

    // Validate raffle existence
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) return res.status(404).json({ error: "Raffle not found" });

    // Validate user existence
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Calculate purchase amount
    const amount = (raffle.price || 0) * ticketsBought;
    if (amount <= 0) return res.status(400).json({ error: "Invalid ticket amount" });
    const amountCents = Math.round(amount * 100); // Square requires amount in cents

    // Process payment via Square API
    const paymentsApi = client.paymentsApi;
    const paymentResponse = await paymentsApi.createPayment({
      sourceId: paymentToken, // Tokenized payment source (e.g., card nonce)
      idempotencyKey: require('crypto').randomUUID(), // Prevents duplicate charges
      amountMoney: {
        amount: amountCents,
        currency: "CAD",
      },
    });

    // Extract payment info
    const payment = paymentResponse?.result?.payment;
    if (!payment) {
      console.error("Payment object missing in response:", paymentResponse);
      return res.status(500).json({ error: "Payment failed" });
    }

    // Ensure payment was successful
    if (payment.status !== "COMPLETED") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    // Update raffle with new tickets bought
    raffle.totalTicketsSold += ticketsBought;
    const participantIndex = raffle.participants.findIndex((p) =>
      p.userId.equals(userId)
    );
    if (participantIndex !== -1) {
      // User already exists in participants -> increment their tickets
      raffle.participants[participantIndex].ticketsBought += ticketsBought;
    } else {
      // New participant -> add them
      raffle.participants.push({ userId, ticketsBought });
    }
    await raffle.save();

    // Save order record for tracking
    const order = new Order({
      userId,
      raffleId,
      ticketsBought,
      amount,
      status: "completed",
      paymentId: payment.id,
    });
    await order.save();

    // Respond with success message
    res.json({
      message: "Tickets purchased successfully",
      totalTicketsSold: raffle.totalTicketsSold,
      orderId: order._id,
      amount,
    });

  } catch (error) {
    console.error("Error purchasing tickets:", error);

    // If Square API returned an error, log details
    if (error?.response) {
      console.error("Square API response:", error.response.body);
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};


// ======================= CREATE RAFFLE =======================
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


// ======================= WINNING CHANCE =======================
const getRaffleWinningChance = async (req, res) => {
  try {
    const { raffleId, userId } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(raffleId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid raffleId or userId format" });
    }

    // Find raffle
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      return res.status(404).json({ error: "Raffle not found" });
    }

    // Get user's ticket count
    const participant = raffle.participants.find(p => p.userId.equals(userId));
    const userTicketCount = participant ? participant.ticketsBought : 0;
    const totalTickets = raffle.totalTicketsSold;

    // Calculate probability of winning
    const winningChance = totalTickets > 0 ? (userTicketCount / totalTickets) * 100 : 0;

    res.json({ totalTickets, userTickets: userTicketCount, winningChance });
  } catch (error) {
    console.error("Error calculating winning chance:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


// ======================= GET ALL RAFFLES =======================
const getAllRaffles = async (req, res) => {
  try {
    const raffles = await Raffle.find().sort({ createdAt: -1 }); // Sort by newest first
    res.json(raffles);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};


// ======================= GET USER'S RAFFLES =======================
const getUserRaffles = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Find raffles where user participated
    const raffles = await Raffle.find({ "participants.userId": userId })
      .sort({ createdAt: -1 })
      .populate("winner", "name email") 
      .populate("participants.userId", "name email");

    // Format raffles with user-specific info
    const userRaffles = raffles.map(r => {
      const didUserWin = r.winner && r.winner._id.toString() === userId;
      return {
        _id: r._id,
        title: r.title,
        description: r.description,
        status: r.status,
        endDate: r.endDate,
        totalTicketsSold: r.totalTicketsSold,
        ticketsBought: r.participants.find(p => p.userId._id.toString() === userId)?.ticketsBought || 0,
        winner: r.winner ? { id: r.winner._id, name: r.winner.name, email: r.winner.email } : null,
        didUserWin
      };
    });

    res.json(userRaffles);
  } catch (err) {
    console.error("Error fetching user raffles:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// ======================= GET RECENT RAFFLES =======================
const getRecentRaffles = async (req, res) => {
  try {
    const raffles = await Raffle.find().sort({ createdAt: -1 }).limit(3);
    res.json(raffles);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};


// ======================= GET RAFFLE BY ID =======================
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


// ======================= UPDATE RAFFLE =======================
const updateRaffle = async (req, res) => {
  try {
    const { title, description, startDate, endDate, price, category, status } = req.body;

    // Validate raffle ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid raffle ID' });
    }

    // Find raffle to update
    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) return res.status(404).json({ message: 'Raffle not found' });

    // Update fields (fallback to existing if not provided)
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


// ======================= DELETE RAFFLE =======================
const deleteRaffle = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid raffle ID' });
    }

    const raffle = await Raffle.findById(req.params.id);
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }

    await Raffle.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Raffle deleted successfully' });
  } catch (err) {
    console.error(err); 
    res.status(500).json({ message: 'Server error' });
  }
};


// ======================= PICK WINNER =======================
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

    // Ensure raffle has ended
    const now = new Date();
    if (now < raffle.endDate) {
      return res.status(400).json({ message: "Raffle has not ended yet" });
    }

    if (!raffle.participants || raffle.participants.length === 0) {
      return res.status(400).json({ message: "No participants in this raffle" });
    }

    // Weighted random selection based on tickets bought
    let ticketPool = [];
    raffle.participants.forEach(p => {
      for (let i = 0; i < p.ticketsBought; i++) {
        ticketPool.push(p.userId);
      }
    });

    const winnerIndex = Math.floor(Math.random() * ticketPool.length);
    const winner = ticketPool[winnerIndex];

    // Save winner and update raffle status
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


// ======================= UPDATE RAFFLE STATUSES (Scheduled Job) =======================
async function updateRaffleStatuses() {
  const now = new Date();

  try {
    const raffles = await Raffle.find();

    for (let raffle of raffles) {
      let newStatus = raffle.status;

      // Determine status based on current date
      if (now < raffle.startDate) {
        newStatus = 'upcoming';
      } else if (now >= raffle.startDate && now <= raffle.endDate) {
        newStatus = 'active';
      } else if (now > raffle.endDate) {
        newStatus = 'completed';
      }

      // Only update if status actually changed
      if (raffle.status !== newStatus) {
        raffle.status = newStatus;
        await raffle.save();
        console.log(`Updated raffle "${raffle.title}" to status: ${newStatus}`);
      }
    }

    console.log('Raffle statuses updated successfully.');
  } catch (err) {
    console.error('Error updating raffle statuses:', err);
  }
}


// ======================= EXPORT CONTROLLERS =======================
module.exports = {
  createRaffle,
  getAllRaffles,
  getRecentRaffles,
  getRaffleById,
  updateRaffle,
  deleteRaffle,
  getRaffleWinningChance,
  purchaseTickets,
  pickWinner,
  getUserRaffles,
  updateRaffleStatuses
};
