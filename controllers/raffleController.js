const Raffle = require('../Models/Raffle');
const User = require('../Models/User');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const { Parser } = require('json2csv');
const crypto = require('crypto');

// ======================= ✅ DIRECT REST API SETUP (NO SDK) =======================
dotenv.config();

class SquareDirectAPI {
  constructor(accessToken, environment = 'sandbox') {
    this.accessToken = accessToken;
    this.baseUrl = environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com' 
      : 'https://connect.squareup.com';
  }

  async createPayment(paymentData) {
    const response = await fetch(`${this.baseUrl}/v2/payments`, {
      method: 'POST',
      headers: {
        'Square-Version': '2024-09-19',
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_id: paymentData.sourceId,
        idempotency_key: paymentData.idempotencyKey,
        amount_money: {
          amount: paymentData.amountMoney.amount,
          currency: paymentData.amountMoney.currency,
        },
        app_fee_money: paymentData.appFeeMoney ? {
          amount: paymentData.appFeeMoney.amount,
          currency: paymentData.appFeeMoney.currency,
        } : undefined,
        autocomplete: paymentData.autocomplete,
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.errors?.[0]?.detail || 'Payment failed');
    }
    
    return result;
  }

  async listLocations() {
    const response = await fetch(`${this.baseUrl}/v2/locations`, {
      method: 'GET',
      headers: {
        'Square-Version': '2024-09-19',
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.errors?.[0]?.detail || 'Failed to fetch locations');
    }
    
    return result;
  }
}

// Initialize Square API
const squareAPI = new SquareDirectAPI(process.env.SQUARE_ACCESS_TOKEN, 'sandbox');

// ======================= EMAIL TRANSPORTER =======================
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
  tls: {
    rejectUnauthorized: false,
  },
});

// ======================= PURCHASE TICKETS =======================
const purchaseTickets = async (req, res) => {
  try {
    const { userId, ticketsBought, paymentToken, includeTax = true } = req.body;
    const raffleId = req.params.raffleId;

    console.log(" PURCHASE Incoming request:", { userId, ticketsBought, raffleId });

    // Validate raffle existence
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      console.log(" PURCHASE Raffle not found:", raffleId);
      return res.status(404).json({ error: "Raffle not found" });
    }

    // Validate user existence
    const user = await User.findById(userId);
    if (!user) {
      console.log(" PURCHASE User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    // Validate email address
    if (!user.email || !user.emailVerified) {
      console.log(" PURCHASE Email not verified:", user.email);
      return res.status(400).json({ error: "Email verification required" });
    }

    // Calculate purchase amount WITH TAX
    const taxRate = 0.13; // 13% tax
    const baseAmount = (raffle.price || 0) * ticketsBought;
    const taxAmount = Math.round(baseAmount * taxRate * 100) / 100;
    const totalAmount = baseAmount + taxAmount;
    
    if (baseAmount <= 0) {
      console.log(" PURCHASE Invalid ticket amount:", ticketsBought);
      return res.status(400).json({ error: "Invalid ticket amount" });
    }
    
    const amountCents = Math.round(totalAmount * 100);

    console.log(" PURCHASE Payment breakdown:", {
      baseAmount,
      taxAmount,
      totalAmount,
      amountCents,
      ticketsBought,
      pricePerTicket: raffle.price
    });

    // ✅ CORRECT: Process payment using direct REST API
    const idempotencyKey = crypto.randomUUID();
    
    console.log(" PURCHASE Processing payment...");
    
    try {
      const paymentResult = await squareAPI.createPayment({
        sourceId: paymentToken,
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: amountCents, // Note: No BigInt needed for direct API
          currency: 'CAD',
        },
        autocomplete: true,
      });

      // Extract payment info
      const payment = paymentResult.payment;
      if (!payment) {
        console.error(" PURCHASE Payment object missing in response:", paymentResult);
        return res.status(500).json({ error: "Payment failed" });
      }

      // Ensure payment was successful
      if (payment.status !== 'COMPLETED') {
        console.log(" PURCHASE Payment not completed:", payment.status);
        return res.status(400).json({ error: "Payment not completed" });
      }

      console.log(" PURCHASE Payment successful:", payment.id);

      // Update raffle with new tickets bought
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

      // Save order record
      const order = new Order({
        userId,
        raffleId,
        ticketsBought,
        amount: totalAmount,
        baseAmount: baseAmount,
        taxAmount: taxAmount,
        status: "completed",
        paymentId: payment.id,
        receiptSent: false,
      });
      await order.save();

      console.log(" PURCHASE Order saved:", order._id);

      // Send receipt email
      try {
        console.log(" PURCHASE Sending receipt email to:", user.email);

        const frontendUrl = req.headers.origin || 'https://raffle-system-lac.vercel.app';
        const orderLink = `${frontendUrl}/orders/${order._id}`;
        
        await transporter.verify();
        console.log(" PURCHASE SMTP connection verified");

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: user.email,
          subject: `Purchase Confirmation - Order #${order._id.toString().slice(-8).toUpperCase()}`,
          html: `
            <p>Dear ${user.username},</p>
            <p>Thank you for your raffle ticket purchase! Your order has been confirmed.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 15px 0;">
              <h3 style="color: #333; margin-top: 0;">Order Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Order Number:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">#${order._id.toString().slice(-8).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${payment.id}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Purchase Date:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Raffle:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${raffle.title}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Tickets Purchased:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${order.ticketsBought}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Price per Ticket:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${raffle.price.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Subtotal:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${baseAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Tax (13%):</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${taxAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Total Amount:</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">$${totalAmount.toFixed(2)} CAD</td>
                </tr>
              </table>
            </div>

            <p>You can view your order details here: <a href="${orderLink}" style="color: #007bff; text-decoration: none;">View Order</a></p>

            <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <strong>📧 Need Help?</strong>
              <p>If you have any questions about your purchase, please contact our support team with your Order Number #${order._id.toString().slice(-8).toUpperCase()}.</p>
            </div>

            <p>Best regards,</p>
            <p>Raffle System Team</p>
          `,
        });

        console.log(" PURCHASE Receipt email sent successfully");
        
        order.receiptSent = true;
        order.receiptSentAt = new Date();
        await order.save();

      } catch (emailError) {
        console.error(" PURCHASE Error sending receipt email:", emailError);
        order.receiptSent = false;
        order.receiptError = emailError.message;
        await order.save();
      }

      res.json({
        message: "Tickets purchased successfully",
        totalTicketsSold: raffle.totalTicketsSold,
        orderId: order._id,
        amount: totalAmount,
        baseAmount: baseAmount,
        taxAmount: taxAmount,
        receiptEmail: user.email,
        receiptSent: order.receiptSent,
      });

    } catch (squareError) {
      console.error(" PURCHASE Square API error:", squareError);
      return res.status(500).json({ 
        error: "Payment processing failed",
        details: squareError.message 
      });
    }

  } catch (error) {
    console.error(" PURCHASE Server error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ... rest of your controller functions remain exactly the same ...
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
    const raffles = await Raffle.find().sort({ createdAt: -1 });
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

// ======================= EXPORT RAFFLE DATA TO CSV =======================
const exportRaffleCSV = async (req, res) => {
  try {
    const { id } = req.params; // raffle ID
 
    // Validate raffle existence
    const raffle = await Raffle.findById(id).populate('participants.userId', 'name email');
    if (!raffle) {
      return res.status(404).json({ message: 'Raffle not found' });
    }
 
    if (!raffle.participants || raffle.participants.length === 0) {
      return res.status(400).json({ message: 'No participants available to export' });
    }
 
    // Prepare CSV data
    const exportData = raffle.participants.map(p => ({
      participantName: p.userId?.username || 'N/A',
      email: p.userId?.email || 'N/A',
      ticketsBought: p.ticketsBought || 0,
      raffleTitle: raffle.title || 'N/A',
      startDate: raffle.startDate ? raffle.startDate.toISOString().split('T')[0] : 'N/A',
      endDate: raffle.endDate ? raffle.endDate.toISOString().split('T')[0] : 'N/A',
      pricePerTicket: raffle.price || 0,
      totalSpent: (p.ticketsBought * (raffle.price || 0)).toFixed(2),
    }));
 
    // Convert JSON → CSV
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(exportData);
 
    // Configure response for download
    res.header('Content-Type', 'text/csv');
    res.attachment(`${raffle.title.replace(/\s+/g, '_')}_Export.csv`);
    return res.send(csv);
  } catch (error) {
    console.error('Error exporting raffle data:', error);
    res.status(500).json({ message: 'Failed to export raffle data' });
  }
};

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
  updateRaffleStatuses,
  exportRaffleCSV
};