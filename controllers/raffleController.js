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



// ======================= PURCHASE TICKETS (CONSOLIDATED EMAIL) =======================
const purchaseTickets = async (req, res) => {
  let session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { userId, ticketsBought, paymentToken, includeTax = true, idempotencyKey: clientKey } = req.body;
    const raffleId = req.params.raffleId;

    console.log("🛒 PURCHASE Incoming request:", { userId, ticketsBought, raffleId });

    // Validate payment token
    if (!paymentToken || paymentToken === 'undefined' || paymentToken === 'null' || paymentToken === '') {
      console.log("❌ PURCHASE Invalid or missing payment token");
      await session.abortTransaction();
      return res.status(400).json({ 
        error: "Invalid payment token. Please refresh the page and try again.",
        shouldRetry: true
      });
    }

    // Validate input parameters
    if (!userId || !ticketsBought) {
      console.log("❌ PURCHASE Missing required fields");
      await session.abortTransaction();
      return res.status(400).json({ error: "Missing required fields: userId, ticketsBought" });
    }

    if (!Number.isInteger(ticketsBought) || ticketsBought <= 0) {
      console.log("❌ PURCHASE Invalid ticket quantity:", ticketsBought);
      await session.abortTransaction();
      return res.status(400).json({ error: "Ticket quantity must be a positive integer" });
    }

    // Validate raffle existence and status
    const raffle = await Raffle.findById(raffleId).session(session);
    if (!raffle) {
      console.log("❌ PURCHASE Raffle not found:", raffleId);
      await session.abortTransaction();
      return res.status(404).json({ error: "Raffle not found" });
    }

    // Check raffle status
    if (raffle.status !== 'active') {
      console.log("❌ PURCHASE Raffle not active:", raffle.status);
      await session.abortTransaction();
      return res.status(400).json({ error: "Raffle is not active for purchases" });
    }

    // Check if raffle has ended
    if (raffle.endDate && new Date() > raffle.endDate) {
      console.log("❌ PURCHASE Raffle has ended:", raffle.endDate);
      await session.abortTransaction();
      return res.status(400).json({ error: "Raffle has ended" });
    }

    // Check ticket availability
    if (raffle.maxTickets && (raffle.totalTicketsSold + ticketsBought) > raffle.maxTickets) {
      console.log("❌ PURCHASE Not enough tickets available:", {
        requested: ticketsBought,
        available: raffle.maxTickets - raffle.totalTicketsSold
      });
      await session.abortTransaction();
      return res.status(400).json({ 
        error: "Not enough tickets available",
        available: raffle.maxTickets - raffle.totalTicketsSold
      });
    }

    // Validate user existence
    const user = await User.findById(userId).session(session);
    if (!user) {
      console.log("❌ PURCHASE User not found:", userId);
      await session.abortTransaction();
      return res.status(404).json({ error: "User not found" });
    }

    // Validate email address
    if (!user.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      console.log("❌ PURCHASE User email invalid:", user.email);
      await session.abortTransaction();
      return res.status(400).json({ error: "Valid email address required" });
    }

    // Check purchase limits
    if (raffle.maxTicketsPerUser) {
      const existingTickets = raffle.participants.find(p => p.userId.equals(userId))?.ticketsBought || 0;
      if (existingTickets + ticketsBought > raffle.maxTicketsPerUser) {
        console.log("❌ PURCHASE Purchase limit exceeded:", {
          existing: existingTickets,
          requested: ticketsBought,
          limit: raffle.maxTicketsPerUser
        });
        await session.abortTransaction();
        return res.status(400).json({
          error: "Purchase limit exceeded",
          currentTickets: existingTickets,
          limit: raffle.maxTicketsPerUser,
          canPurchase: raffle.maxTicketsPerUser - existingTickets
        });
      }
    }

    // Calculate purchase amount
    const taxRate = includeTax ? 0.13 : 0; // 13% tax if included
    const baseAmount = (raffle.price || 0) * ticketsBought;
    
    if (baseAmount <= 0) {
      console.log("❌ PURCHASE Invalid ticket amount:", ticketsBought);
      await session.abortTransaction();
      return res.status(400).json({ error: "Invalid ticket amount" });
    }
    
    const taxAmount = Math.round(baseAmount * taxRate * 100) / 100;
    const totalAmount = baseAmount + taxAmount;
    const amountCents = Math.round(totalAmount * 100);

    // Validate minimum amount for Square (must be at least $1.00 CAD)
    if (amountCents < 100) {
      console.log("❌ PURCHASE Amount too small for Square:", amountCents);
      await session.abortTransaction();
      return res.status(400).json({ error: "Minimum purchase amount is $1.00" });
    }

    console.log("💰 PURCHASE Payment breakdown:", {
      baseAmount,
      taxAmount,
      totalAmount,
      amountCents,
      ticketsBought,
      pricePerTicket: raffle.price
    });

    // Process payment using Square API
    const idempotencyKey = clientKey || crypto.randomUUID();

    console.log("💳 PURCHASE Processing payment with idempotency key:", idempotencyKey);
    console.log("💳 PURCHASE Payment token (first 10 chars):", paymentToken.substring(0, 10) + '...');
    
    try {
      const paymentResult = await squareAPI.createPayment({
        sourceId: paymentToken,
        idempotencyKey: idempotencyKey,
        amountMoney: {
          amount: amountCents,
          currency: 'CAD',
        },
        autocomplete: true,
        note: `Raffle: ${raffle.title}, Tickets: ${ticketsBought}`,
        buyerEmailAddress: user.email,
      });

      // Extract payment info
      const payment = paymentResult.payment;
      if (!payment) {
        console.error("❌ PURCHASE Payment object missing in response:", paymentResult);
        await session.abortTransaction();
        return res.status(500).json({ error: "Payment failed - no payment object received" });
      }

      // Check payment status
      if (payment.status !== 'COMPLETED') {
        console.log("❌ PURCHASE Payment not completed:", payment.status, payment.detail);
        await session.abortTransaction();
        
        let errorMessage = "Payment failed";
        if (payment.detail) {
          errorMessage += `: ${payment.detail}`;
        }
        
        return res.status(400).json({ 
          error: errorMessage,
          paymentStatus: payment.status
        });
      }

      console.log("✅ PURCHASE Payment successful:", payment.id);

      // Update raffle with new tickets bought
      raffle.totalTicketsSold += ticketsBought;
      
      const participantIndex = raffle.participants.findIndex((p) =>
        p.userId.equals(userId)
      );
      
      if (participantIndex !== -1) {
        raffle.participants[participantIndex].ticketsBought += ticketsBought;
        raffle.participants[participantIndex].lastPurchaseDate = new Date();
      } else {
        raffle.participants.push({ 
          userId, 
          ticketsBought,
          firstPurchaseDate: new Date(),
          lastPurchaseDate: new Date()
        });
      }
      
      await raffle.save({ session });

      // Save order record
      const order = new Order({
        userId,
        raffleId,
        ticketsBought,
        amount: totalAmount,
        baseAmount: baseAmount,
        taxAmount: taxAmount,
        taxRate: taxRate,
        status: "completed",
        paymentId: payment.id,
        paymentStatus: payment.status,
        squareReceiptUrl: payment.receiptUrl,
        idempotencyKey: idempotencyKey,
        receiptSent: false,
        metadata: {
          raffleTitle: raffle.title,
          rafflePrice: raffle.price,
          userEmail: user.email,
          userName: user.username
        }
      });
      await order.save({ session });

      // Commit transaction
      await session.commitTransaction();
      console.log("📦 PURCHASE Order saved and transaction committed:", order._id);

      // Check if this is part of a multi-purchase by looking for pending orders
      const pendingOrders = await Order.find({
        userId: userId,
        receiptSent: false,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      }).populate('raffleId').sort({ createdAt: 1 });

      console.log(`📊 Found ${pendingOrders.length} pending orders for user ${userId}`);

      // If multiple pending orders, send consolidated email
      if (pendingOrders.length > 1) {
        console.log("📧 Sending consolidated email for multiple orders");
        sendConsolidatedReceiptEmailNonBlocking(pendingOrders, user, req.headers.origin)
          .then(result => {
            if (result.success) {
              console.log(`✅ Consolidated receipt email sent successfully for ${pendingOrders.length} orders`);
              // Mark all orders as receipt sent
              markOrdersAsSent(pendingOrders.map(o => o._id));
            } else {
              console.log("⚠️ Consolidated receipt email failed:", result.error);
            }
          })
          .catch(error => {
            console.error("⚠️ Consolidated email sending error:", error);
          });
      } else {
        // Single order - send individual email
        console.log("📧 Sending individual receipt email");
        sendReceiptEmailNonBlocking(order, user, raffle, req.headers.origin)
          .then(result => {
            if (result.success) {
              console.log(`✅ Individual receipt email sent successfully`);
            } else {
              console.log("⚠️ Individual receipt email failed:", result.error);
            }
          })
          .catch(error => {
            console.error("⚠️ Individual email sending error:", error);
          });
      }

      // Return success response
      res.json({
        success: true,
        message: "Tickets purchased successfully",
        orderId: order._id,
        paymentId: payment.id,
        totalTicketsSold: raffle.totalTicketsSold,
        amount: totalAmount,
        baseAmount: baseAmount,
        taxAmount: taxAmount,
        ticketsBought: ticketsBought,
        receiptEmail: user.email,
        receiptSent: false, // Will be updated async
        squareReceiptUrl: payment.receiptUrl,
        isMultiPurchase: pendingOrders.length > 1,
        totalOrders: pendingOrders.length
      });

    } catch (squareError) {
      await session.abortTransaction();
      console.error("❌ PURCHASE Square API error:", squareError);
      
      let errorMessage = "Payment processing failed";
      let statusCode = 500;
      let shouldRetry = false;
      
      if (squareError.errors && squareError.errors.length > 0) {
        const squareErrorDetail = squareError.errors[0];
        errorMessage = squareErrorDetail.detail || squareErrorDetail.code;
        
        // Handle specific Square error codes
        if (squareErrorDetail.code === 'CARD_DECLINED') {
          statusCode = 400;
          errorMessage = "Your card was declined. Please try a different payment method.";
        } else if (squareErrorDetail.code === 'INVALID_EXPIRATION') {
          statusCode = 400;
          errorMessage = "Card expiration date is invalid.";
        } else if (squareErrorDetail.code === 'VERIFY_CVV_FAILURE') {
          statusCode = 400;
          errorMessage = "Invalid CVV code. Please check your card details.";
        } else if (squareErrorDetail.code === 'INSUFFICIENT_FUNDS') {
          statusCode = 400;
          errorMessage = "Insufficient funds. Please try a different payment method.";
        } else if (squareErrorDetail.code === 'CARD_TOKEN_USED' || squareErrorDetail.code === 'IDEMPOTENCY_KEY_REUSED') {
          statusCode = 400;
          errorMessage = "Payment session expired. Please refresh the page and try again.";
          shouldRetry = true;
        } else if (squareErrorDetail.code === 'INVALID_CARD') {
          statusCode = 400;
          errorMessage = "Invalid card details. Please check your card information.";
        } else if (squareErrorDetail.code === 'GENERIC_DECLINE') {
          statusCode = 400;
          errorMessage = "Card was declined. Please try a different payment method.";
        } else if (squareErrorDetail.code === 'EXPIRATION_FAILURE') {
          statusCode = 400;
          errorMessage = "Card expiration date is invalid or has passed.";
        }
      } else if (squareError.message && squareError.message.includes('already used')) {
        statusCode = 400;
        errorMessage = "Payment session expired. Please refresh the page and try again.";
        shouldRetry = true;
      }
      
      return res.status(statusCode).json({ 
        error: errorMessage,
        details: squareError.message,
        shouldRetry: shouldRetry
      });
    }

  } catch (error) {
    await session.abortTransaction().catch(() => {}); // Ignore abort errors
    console.error("❌ PURCHASE Server error:", error);
    res.status(500).json({ 
      error: "Internal Server Error",
      ...(process.env.NODE_ENV === 'development' && { debug: error.message })
    });
  } finally {
    session.endSession();
  }
};

// Consolidated email function for multiple orders
async function sendConsolidatedReceiptEmailNonBlocking(orders, user, origin) {
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 PURCHASE Attempt ${attempt}/${maxRetries}: Sending consolidated receipt email for ${orders.length} orders to:`, user.email);

      const frontendUrl = origin || 'https://raffle-system-lac.vercel.app';
      
      const emailHtml = generateConsolidatedReceiptEmailHtml(orders, user, frontendUrl);

      // Use the DUAL SERVICE email function with timeout
      const emailResult = await Promise.race([
        sendEmailBothServices(
          user.email,
          `Purchase Confirmation - ${orders.length} Order${orders.length > 1 ? 's' : ''}`,
          emailHtml,
          'TicketStack Raffle System'
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email sending timeout')), 30000)
        )
      ]);

      if (emailResult.success) {
        console.log(`✅ Consolidated email sent successfully for ${orders.length} orders`);
        return emailResult;
      }

      lastError = emailResult.error;
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (emailError) {
      lastError = emailError;
      console.error(`❌ PURCHASE Consolidated email attempt ${attempt} failed:`, emailError.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error("❌ PURCHASE All consolidated email attempts failed:", lastError?.message);
  return { success: false, error: lastError?.message || 'Consolidated email sending failed' };
}

// Helper function to mark orders as receipt sent
async function markOrdersAsSent(orderIds) {
  try {
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { 
        receiptSent: true,
        receiptSentAt: new Date()
      }
    );
    console.log(`✅ Marked ${orderIds.length} orders as receipt sent`);
  } catch (error) {
    console.error("❌ Error marking orders as receipt sent:", error);
  }
}

// Generate consolidated email HTML for multiple orders
function generateConsolidatedReceiptEmailHtml(orders, user, frontendUrl) {
  const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
  const totalTickets = orders.reduce((sum, order) => sum + order.ticketsBought, 0);
  
  const ordersHtml = orders.map(order => `
    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #667eea;">
      <h4 style="margin: 0 0 10px 0; color: #333;">${order.metadata?.raffleTitle || 'Raffle'}</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 4px 0;"><strong>Order #:</strong></td>
          <td style="padding: 4px 0; text-align: right;">${order._id.toString().slice(-8).toUpperCase()}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Tickets:</strong></td>
          <td style="padding: 4px 0; text-align: right;">${order.ticketsBought}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Price per Ticket:</strong></td>
          <td style="padding: 4px 0; text-align: right;">$${order.metadata?.rafflePrice?.toFixed(2) || '0.00'}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>Amount:</strong></td>
          <td style="padding: 4px 0; text-align: right;">$${order.amount.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>View Order:</strong></td>
          <td style="padding: 4px 0; text-align: right;">
            <a href="${frontendUrl}/orders/${order._id}" style="color: #007bff; text-decoration: none;">Details</a>
          </td>
        </tr>
      </table>
    </div>
  `).join('');

  return `
    <p>Dear ${user.username || 'Valued Customer'},</p>
    <p>Thank you for your raffle ticket purchases! Your orders have been confirmed.</p>
    
    <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
      <h3 style="color: #2d5016; margin-top: 0;">Purchase Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Total Orders:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9; text-align: right;">${orders.length}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Total Tickets:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9; text-align: right;">${totalTickets}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Total Amount:</strong></td>
          <td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9; text-align: right; font-weight: bold;">$${totalAmount.toFixed(2)} CAD</td>
        </tr>
      </table>
    </div>

    <h3 style="color: #333; margin: 20px 0 10px 0;">Order Details</h3>
    ${ordersHtml}

    <p>You can view all your orders here: <a href="${frontendUrl}/orders" style="color: #007bff; text-decoration: none;">View All Orders</a></p>

    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <strong>📧 Need Help?</strong>
      <p>If you have any questions about your purchases, please contact our support team with your Order Numbers.</p>
    </div>

    <p>Best regards,</p>
    <p>TicketStack Team</p>
  `;
}

// Keep the individual email function for single purchases
async function sendReceiptEmailNonBlocking(order, user, raffle, origin) {
  const maxRetries = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📧 PURCHASE Attempt ${attempt}/${maxRetries}: Sending receipt email to:`, user.email);

      const frontendUrl = origin || 'https://raffle-system-lac.vercel.app';
      const orderLink = `${frontendUrl}/orders/${order._id}`;
      
      const emailHtml = generateReceiptEmailHtml(order, user, raffle, orderLink);

      // Use the DUAL SERVICE email function with timeout
      const emailResult = await Promise.race([
        sendEmailBothServices(
          user.email,
          `Purchase Confirmation - Order #${order._id.toString().slice(-8).toUpperCase()}`,
          emailHtml,
          'TicketStack Raffle System'
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Email sending timeout')), 30000)
        )
      ]);

      // Update order with email sending results
      await Order.findByIdAndUpdate(order._id, {
        receiptSent: emailResult.success,
        receiptSentAt: new Date(),
        emailServicesUsed: {
          sendgrid: emailResult.services?.sendgrid?.success || false,
          gmail: emailResult.services?.gmail?.success || false
        },
        emailServiceErrors: {
          sendgrid: emailResult.services?.sendgrid?.error || null,
          gmail: emailResult.services?.gmail?.error || null
        }
      });

      if (emailResult.success) {
        console.log('📊 DUAL EMAIL RESULTS SAVED TO ORDER:', {
          orderId: order._id,
          sendgrid: emailResult.services.sendgrid ? '✅' : '❌',
          gmail: emailResult.services.gmail ? '✅' : '❌'
        });
        return emailResult;
      }

      lastError = emailResult.error;
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
        await new Promise(resolve => setTimeout(resolve, delay));
      }

    } catch (emailError) {
      lastError = emailError;
      console.error(`❌ PURCHASE Email attempt ${attempt} failed:`, emailError.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  console.error("❌ PURCHASE All email attempts failed:", lastError?.message);
  
  // Update order with final error
  await Order.findByIdAndUpdate(order._id, {
    receiptSent: false,
    receiptError: lastError?.message || 'All email attempts failed',
    emailServicesUsed: { sendgrid: false, gmail: false }
  });

  return { success: false, error: lastError?.message || 'Email sending failed' };
}

// Keep the individual email template function
function generateReceiptEmailHtml(order, user, raffle, orderLink) {
  return `
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

    // Format raffles with user-specific info - FIXED: Add null checks
    const userRaffles = raffles.map(r => {
      // FIX: Check if userId exists and has _id before comparing
      const userParticipant = r.participants.find(p => 
        p.userId && p.userId._id && p.userId._id.toString() === userId
      );
      
      // FIX: Check if winner exists before accessing properties
      const didUserWin = r.winner && r.winner._id && r.winner._id.toString() === userId;
      
      return {
        _id: r._id,
        title: r.title,
        description: r.description,
        status: r.status,
        endDate: r.endDate,
        totalTicketsSold: r.totalTicketsSold,
        ticketsBought: userParticipant ? userParticipant.ticketsBought : 0,
        winner: r.winner ? { 
          id: r.winner._id, 
          name: r.winner.name, 
          email: r.winner.email 
        } : null,
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