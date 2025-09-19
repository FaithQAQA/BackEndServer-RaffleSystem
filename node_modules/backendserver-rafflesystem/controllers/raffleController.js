const Raffle = require('../Models/Raffle');
const User = require('../Models/User');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { Client, Environment } = require('square');

// Initialize Square client
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
    environment: Environment.Sandbox,             // Force sandbox ? Environment.Production : Environment.Sandbox,
});

// Purchase tickets
const purchaseTickets = async (req, res) => {
  try {
    const { userId, ticketsBought, paymentToken } = req.body;
    const raffleId = req.params.raffleId;

    // Validate raffle
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) return res.status(404).json({ error: "Raffle not found" });

    // Validate user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Calculate total cost in cents
    const amount = (raffle.price || 0) * ticketsBought;
    if (amount <= 0) return res.status(400).json({ error: "Invalid ticket amount" });
    const amountCents = Math.round(amount * 100);

    // Use paymentsApi in v39
    const paymentsApi = client.paymentsApi;
    const paymentResponse = await paymentsApi.createPayment({
      sourceId: paymentToken,
      idempotencyKey: require('crypto').randomUUID(),
      amountMoney: {
        amount: amountCents,
        currency: "CAD",
      },
    });

    // Safely access payment object
    const payment = paymentResponse?.result?.payment;
    if (!payment) {
      console.error("Payment object missing in response:", paymentResponse);
      return res.status(500).json({ error: "Payment failed" });
    }

    if (payment.status !== "COMPLETED") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    // Update raffle participants
    raffle.totalTicketsSold += ticketsBought;
    const participantIndex = raffle.participants.findIndex((p) =>
      p.userId.equals(userId)
    );
    if (participantIndex !== -1) {
      raffle.participants[participantIndex].ticketsBought += ticketsBought;
    } else {
      raffle.participants.push({ userId, ticketsBought });
    }
    await raffle.save();

    // Save order
    const order = new Order({
      userId,
      raffleId,
      ticketsBought,
      amount,
      status: "completed",
      paymentId: payment.id,
    });
    await order.save();

    res.json({
      message: "Tickets purchased successfully",
      totalTicketsSold: raffle.totalTicketsSold,
      orderId: order._id,
      amount,
    });

  } catch (error) {
    console.error("Error purchasing tickets:", error);

    // Detailed error message for Square API errors
    if (error?.response) {
      console.error("Square API response:", error.response.body);
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};


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


// Fetch all raffles a user has entered
const getUserRaffles = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Find raffles where userId exists in participants array
    const raffles = await Raffle.find({ "participants.userId": userId })
      .sort({ createdAt: -1 })
      .populate("winner", "name email") // get winner info
      .populate("participants.userId", "name email"); // get participants info

    // Add a field showing if the current user won
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

async function updateRaffleStatuses() {
  const now = new Date();

  try {
    const raffles = await Raffle.find();

    for (let raffle of raffles) {
      let newStatus = raffle.status;

      if (now < raffle.startDate) {
        newStatus = 'upcoming'; // not started yet
      } else if (now >= raffle.startDate && now <= raffle.endDate) {
        newStatus = 'active'; // currently running
      } else if (now > raffle.endDate) {
        newStatus = 'completed'; // already ended
      }

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