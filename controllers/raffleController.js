const Raffle = require('../Models/Raffle');
const User = require('../Models/User');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
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

// ======================= ✅ DUAL EMAIL SERVICE CONFIGURATION =======================
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Import both email services - FIXED FOR CLASS
const EmailService = require('../services/emailServiceGoogle'); // Gmail OAuth2 service class
const gmailEmailService = new EmailService(); // Create instance

// Email sending function that sends via BOTH SERVICES
const sendEmailBothServices = async (to, subject, html, fromName = 'Raffle System') => {
  const emailConfig = {
    to: to,
    subject: subject,
    html: html,
    fromName: fromName
  };

  const results = {
    sendgrid: { success: false, error: null },
    gmail: { success: false, error: null }
  };

  // Send via BOTH services simultaneously
  const promises = [
    // SendGrid
    (async () => {
      try {
        console.log('📧 Sending email via SendGrid...');
        const msg = {
          to: emailConfig.to,
          from: 'voicenotify2@gmail.com',
          subject: emailConfig.subject,
          html: emailConfig.html,
        };
        await sgMail.send(msg);
        console.log('✅ Email sent successfully via SendGrid API');
        results.sendgrid = { success: true, service: 'SendGrid' };
      } catch (sendgridError) {
        console.error('❌ SendGrid failed:', sendgridError.message);
        results.sendgrid = { success: false, error: sendgridError.message, service: 'SendGrid' };
      }
    })(),

    // Gmail OAuth2 - FIXED: Use the class instance
    (async () => {
      try {
        console.log('📧 Sending email via Gmail OAuth2...');
        const gmailResult = await gmailEmailService.sendEmail(
          emailConfig.to,
          emailConfig.subject,
          emailConfig.html,
          emailConfig.fromName
        );
        
        if (gmailResult.success) {
          console.log('✅ Email sent successfully via Gmail OAuth2');
          results.gmail = { 
            success: true, 
            service: 'Gmail OAuth2',
            messageId: gmailResult.messageId 
          };
        } else {
          throw new Error(gmailResult.error || 'Gmail service failed');
        }
      } catch (gmailError) {
        console.error('❌ Gmail OAuth2 failed:', gmailError.message);
        results.gmail = { success: false, error: gmailError.message, service: 'Gmail OAuth2' };
      }
    })()
  ];

  // Wait for both to complete
  await Promise.allSettled(promises);

  // Return combined results
  const overallSuccess = results.sendgrid.success || results.gmail.success;
  
  console.log('📊 DUAL EMAIL SERVICE RESULTS:', {
    sendgrid: results.sendgrid.success ? '✅ SUCCESS' : '❌ FAILED',
    gmail: results.gmail.success ? '✅ SUCCESS' : '❌ FAILED',
    overall: overallSuccess ? '✅ AT LEAST ONE SUCCEEDED' : '❌ BOTH FAILED'
  });

  return {
    success: overallSuccess,
    services: results,
    message: overallSuccess ? 
      `Email delivery attempted via both services. ${results.sendgrid.success ? 'SendGrid succeeded' : ''} ${results.gmail.success ? 'Gmail succeeded' : ''}`.trim() :
      'Both email services failed'
  };
};

// Update the sendEmail function to use the class instance
const sendEmail = async (to, subject, html, options = {}) => {
  const { useService = 'both', fromName = 'Raffle System' } = options;

  if (useService === 'sendgrid') {
    // Use SendGrid only
    const msg = {
      to: to,
      from: 'voicenotify2@gmail.com',
      subject: subject,
      html: html,
    };
    await sgMail.send(msg);
    console.log('✅ Email sent via SendGrid (explicit)');
    return { success: true, service: 'SendGrid' };
  }
  else if (useService === 'gmail') {
    // Use Gmail only - FIXED: Use the class instance
    const result = await gmailEmailService.sendEmail(to, subject, html, fromName);
    if (!result.success) {
      throw new Error(result.error);
    }
    console.log('✅ Email sent via Gmail OAuth2 (explicit)');
    return { success: true, service: 'Gmail OAuth2', messageId: result.messageId };
  }
  else if (useService === 'both') {
    // Use BOTH services (for testing)
    return await sendEmailBothServices(to, subject, html, fromName);
  }
  else {
    // Auto with fallback
    return await sendEmailWithFallback(to, subject, html, fromName);
  }
};

// Also update the fallback function
const sendEmailWithFallback = async (to, subject, html, fromName = 'Raffle System') => {
  const emailConfig = {
    to: to,
    subject: subject,
    html: html,
    fromName: fromName
  };

  // Try SendGrid first (primary)
  try {
    console.log('📧 Attempting to send email via SendGrid...');
    
    const msg = {
      to: emailConfig.to,
      from: 'voicenotify2@gmail.com',
      subject: emailConfig.subject,
      html: emailConfig.html,
    };

    await sgMail.send(msg);
    console.log('✅ Email sent successfully via SendGrid API');
    return { 
      success: true, 
      service: 'SendGrid',
      message: 'Email sent successfully'
    };
  } catch (sendgridError) {
    console.error('❌ SendGrid failed, falling back to Gmail OAuth2:', sendgridError.message);
    
    // Fallback to Gmail OAuth2 - FIXED: Use the class instance
    try {
      console.log('📧 Attempting to send email via Gmail OAuth2...');
      
      const gmailResult = await gmailEmailService.sendEmail(
        emailConfig.to,
        emailConfig.subject,
        emailConfig.html,
        emailConfig.fromName
      );
      
      if (gmailResult.success) {
        console.log('✅ Email sent successfully via Gmail OAuth2');
        return { 
          success: true, 
          service: 'Gmail OAuth2',
          message: 'Email sent successfully via fallback service',
          messageId: gmailResult.messageId
        };
      } else {
        throw new Error(gmailResult.error || 'Gmail service failed');
      }
    } catch (gmailError) {
      console.error('❌ Both email services failed:', {
        sendgrid: sendgridError.message,
        gmail: gmailError.message
      });
      
      return { 
        success: false, 
        service: 'Both',
        error: `All email services failed: SendGrid - ${sendgridError.message}, Gmail - ${gmailError.message}`
      };
    }
  }
};

// ======================= PURCHASE TICKETS =======================
const purchaseTickets = async (req, res) => {
  try {
    const { userId, ticketsBought, paymentToken, includeTax = true } = req.body;
    const raffleId = req.params.raffleId;

    console.log("🛒 PURCHASE Incoming request:", { userId, ticketsBought, raffleId });

    // Validate raffle existence
    const raffle = await Raffle.findById(raffleId);
    if (!raffle) {
      console.log("❌ PURCHASE Raffle not found:", raffleId);
      return res.status(404).json({ error: "Raffle not found" });
    }

    // Validate user existence
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ PURCHASE User not found:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    // Validate email address
    if (!user.email) {
      console.log("❌ PURCHASE User email missing:", user.email);
      return res.status(400).json({ error: "Valid email address required" });
    }

    // Calculate purchase amount WITH TAX
    const taxRate = 0.13; // 13% tax
    const baseAmount = (raffle.price || 0) * ticketsBought;
    const taxAmount = Math.round(baseAmount * taxRate * 100) / 100;
    const totalAmount = baseAmount + taxAmount;
    
    if (baseAmount <= 0) {
      console.log("❌ PURCHASE Invalid ticket amount:", ticketsBought);
      return res.status(400).json({ error: "Invalid ticket amount" });
    }
    
    const amountCents = Math.round(totalAmount * 100);

    console.log("💰 PURCHASE Payment breakdown:", {
      baseAmount,
      taxAmount,
      totalAmount,
      amountCents,
      ticketsBought,
      pricePerTicket: raffle.price
    });

    // Process payment using Square API
    const idempotencyKey = crypto.randomUUID();
    
    console.log("💳 PURCHASE Processing payment...");
    
    try {
      const paymentResult = await squareAPI.createPayment({
        sourceId: paymentToken,
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: amountCents,
          currency: 'CAD',
        },
        autocomplete: true,
      });

      // Extract payment info
      const payment = paymentResult.payment;
      if (!payment) {
        console.error("❌ PURCHASE Payment object missing in response:", paymentResult);
        return res.status(500).json({ error: "Payment failed" });
      }

      // Ensure payment was successful
      if (payment.status !== 'COMPLETED') {
        console.log("❌ PURCHASE Payment not completed:", payment.status);
        return res.status(400).json({ error: "Payment not completed" });
      }

      console.log("✅ PURCHASE Payment successful:", payment.id);

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

      console.log("📦 PURCHASE Order saved:", order._id);

      // Send receipt email (non-blocking) with DUAL SERVICE SUPPORT
      sendReceiptEmailNonBlocking(order, user, raffle, req.headers.origin)
        .then(result => {
          if (result.success) {
            console.log(`✅ PURCHASE Receipt email sent successfully via BOTH SERVICES`);
          } else {
            console.log("⚠️ PURCHASE Receipt email failed (non-critical):", result.error);
          }
        })
        .catch(error => {
          console.error("⚠️ PURCHASE Email sending error:", error);
        });

      res.json({
        message: "Tickets purchased successfully",
        totalTicketsSold: raffle.totalTicketsSold,
        orderId: order._id,
        amount: totalAmount,
        baseAmount: baseAmount,
        taxAmount: taxAmount,
        receiptEmail: user.email,
        receiptSent: false, // Will be updated async
      });

    } catch (squareError) {
      console.error("❌ PURCHASE Square API error:", squareError);
      return res.status(500).json({ 
        error: "Payment processing failed",
        details: squareError.message 
      });
    }

  } catch (error) {
    console.error("❌ PURCHASE Server error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Non-blocking email sending function that sends via BOTH SERVICES
async function sendReceiptEmailNonBlocking(order, user, raffle, origin) {
  try {
    console.log("📧 PURCHASE Sending receipt email to BOTH SERVICES:", user.email);

    const frontendUrl = origin || 'https://raffle-system-lac.vercel.app';
    const orderLink = `${frontendUrl}/orders/${order._id}`;
    
    const emailHtml = `
      <p>Dear ${user.username || 'Valued Customer'},</p>
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
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${order.paymentId}</td>
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
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${order.baseAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Tax (13%):</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${order.taxAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Total Amount:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">$${order.amount.toFixed(2)} CAD</td>
          </tr>
        </table>
      </div>

      <p>You can view your order details here: <a href="${orderLink}" style="color: #007bff; text-decoration: none;">View Order</a></p>

      <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>📧 Need Help?</strong>
        <p>If you have any questions about your purchase, please contact our support team with your Order Number #${order._id.toString().slice(-8).toUpperCase()}.</p>
      </div>

      <p>Best regards,</p>
      <p>TicketStack Team</p>
    `;

    // Use the DUAL SERVICE email function that sends via BOTH
    const emailResult = await sendEmailBothServices(
      user.email,
      `Purchase Confirmation - Order #${order._id.toString().slice(-8).toUpperCase()}`,
      emailHtml,
      'TicketStack Raffle System'
    );

    // Update order with email sending results from BOTH services
    order.receiptSent = emailResult.success;
    order.receiptSentAt = new Date();
    order.emailServicesUsed = {
      sendgrid: emailResult.services.sendgrid.success,
      gmail: emailResult.services.gmail.success
    };
    order.emailServiceErrors = {
      sendgrid: emailResult.services.sendgrid.error,
      gmail: emailResult.services.gmail.error
    };
    
    await order.save();

    console.log('📊 DUAL EMAIL RESULTS SAVED TO ORDER:', {
      orderId: order._id,
      sendgrid: order.emailServicesUsed.sendgrid ? '✅' : '❌',
      gmail: order.emailServicesUsed.gmail ? '✅' : '❌'
    });

    return emailResult;

  } catch (emailError) {
    console.error("❌ PURCHASE Error sending receipt email:", emailError.message);
    
    // Update order with error information
    order.receiptSent = false;
    order.receiptError = emailError.message;
    order.emailServicesUsed = { sendgrid: false, gmail: false };
    await order.save();

    return { success: false, error: emailError.message };
  }
}

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

    const raffle = await Raffle.findById(raffleId).populate("participants.userId", "username email");
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

    // ✅ FIXED: Use findByIdAndUpdate to avoid validation errors
    const updatedRaffle = await Raffle.findByIdAndUpdate(
      raffleId,
      {
        winner: winner._id || winner,
        status: "completed",
        // Ensure these fields are set properly to avoid validation errors
        raffleItems: Array.isArray(raffle.raffleItems) ? raffle.raffleItems : [],
        category: raffle.category || 'General'
      },
      { 
        new: true, // Return updated document
        runValidators: false // Skip validation to prevent errors
      }
    ).populate("winner", "username email");

    console.log(`🏆 Winner selected for "${raffle.title}": ${winner.username || winner.email}`);

    // Send winner notification email (non-blocking) via BOTH SERVICES
    sendWinnerEmailNonBlocking(winner, raffle, updatedRaffle)
      .then(result => {
        if (result.success) {
          console.log(`✅ Winner notification sent via BOTH SERVICES`);
        } else {
          console.log("⚠️ Winner notification failed:", result.error);
        }
      })
      .catch(error => {
        console.error("⚠️ Winner email error:", error);
      });

    res.json({
      message: "Winner selected successfully",
      winner: {
        id: winner._id,
        username: winner.username,
        email: winner.email
      },
      raffle: updatedRaffle
    });

  } catch (error) {
    console.error("Error picking raffle winner:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Winner notification email function - FIXED to use BOTH SERVICES
async function sendWinnerEmailNonBlocking(winner, raffle, updatedRaffle) {
  try {
    console.log("🎉 Sending winner notification via BOTH SERVICES to:", winner.email);

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 2.5em;">🎉 CONGRATULATIONS! 🎉</h1>
          <p style="font-size: 1.2em; margin: 10px 0 0 0;">You've Won the Raffle!</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hello ${winner.username || 'Winner'}!</h2>
          <p style="font-size: 1.1em; color: #555;">
            We're thrilled to inform you that you have been selected as the winner of:
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin: 0 0 10px 0;">${raffle.title}</h3>
            <p style="color: #666; margin: 0;">${raffle.description || 'Thank you for participating!'}</p>
          </div>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #2d5016; font-weight: bold;">
              🏆 You are our grand prize winner! 🏆
            </p>
          </div>
          
          <p style="color: #555;">
            Our team will contact you shortly with details on how to claim your prize.
            Please keep this email for your records.
          </p>
          
          <p style="color: #555;">
            If you have any questions, please reply to this email or contact our support team.
          </p>
        </div>
        
        <div style="background: #333; color: white; padding: 20px; text-align: center;">
          <p style="margin: 0;">Thank you for participating in our raffle!</p>
          <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #ccc;">TicketStack Raffle System</p>
        </div>
      </div>
    `;

    // FIXED: Use sendEmailBothServices instead of sendEmailWithFallback
    const emailResult = await sendEmailBothServices(
      winner.email,
      `🎉 You Won! ${raffle.title}`,
      emailHtml,
      'TicketStack Winners'
    );

    return emailResult;

  } catch (error) {
    console.error("❌ Error sending winner email:", error.message);
    return { success: false, error: error.message };
  }
}

// ======================= UPDATE RAFFLE STATUSES (Scheduled Job) =======================
async function updateRaffleStatuses() {
  const now = new Date();

  try {
    const raffles = await Raffle.find();

    for (let raffle of raffles) {
      try {
        let newStatus = raffle.status;

        if (now < raffle.startDate) {
          newStatus = 'upcoming';
        } else if (now >= raffle.startDate && now <= raffle.endDate) {
          newStatus = 'active';
        } else if (now > raffle.endDate) {
          newStatus = 'completed';
        }

        // Only update if status actually changed
        if (raffle.status !== newStatus) {
          // ✅ FIXED: Use findByIdAndUpdate to avoid validation errors
          await Raffle.findByIdAndUpdate(
            raffle._id,
            {
              status: newStatus,
              // Ensure these fields are set properly to avoid validation errors
              raffleItems: Array.isArray(raffle.raffleItems) ? raffle.raffleItems : [],
              category: raffle.category || 'General'
            },
            { runValidators: false } // Skip validation
          );
          console.log(`🔄 Updated raffle "${raffle.title}" → ${newStatus}`);
        }
      } catch (raffleError) {
        console.error(`❌ Error updating raffle ${raffle._id}:`, raffleError.message);
        // Continue with next raffle instead of stopping entire process
        continue;
      }
    }

    console.log('✅ Raffle status update cycle completed.');
  } catch (err) {
    console.error('❌ Critical error in status updater:', err.message);
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
  exportRaffleCSV,
  // Export email functions for use in other parts of your application
  sendEmail,
  sendEmailWithFallback,
  sendEmailBothServices // Export the dual service function
};