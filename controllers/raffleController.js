const Raffle = require('../Models/Raffle');
const User = require('../Models/User');
const Order = require('../Models/Order');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Parser } = require('json2csv');
const crypto = require('crypto');

// ======================= SERVICE LAYER =======================
class SquarePaymentService {
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
        amount_money: paymentData.amountMoney,
        autocomplete: paymentData.autocomplete,
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.errors?.[0]?.detail || 'Payment failed');
    }
    
    return result;
  }
}

class EmailDeliveryService {
  constructor() {
    this.sgMail = require('@sendgrid/mail');
    this.sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const EmailService = require('../services/emailServiceGoogle');
    this.gmailService = new EmailService();
  }

  async sendEmail(to, subject, html, options = {}) {
    const { useService = 'both', fromName = 'Raffle System' } = options;

    if (useService === 'sendgrid') {
      return await this.sendViaSendGrid(to, subject, html);
    } else if (useService === 'gmail') {
      return await this.sendViaGmail(to, subject, html, fromName);
    } else if (useService === 'both') {
      return await this.sendViaBothServices(to, subject, html, fromName);
    } else {
      return await this.sendWithFallback(to, subject, html, fromName);
    }
  }

  async sendViaSendGrid(to, subject, html) {
    try {
      const message = {
        to,
        from: 'voicenotify2@gmail.com',
        subject,
        html,
        text: this.stripHtmlTags(html),
      };

      await this.sgMail.send(message);
      return { success: true, service: 'SendGrid' };
    } catch (error) {
      return { success: false, service: 'SendGrid', error: error.message };
    }
  }

  async sendViaGmail(to, subject, html, fromName) {
    try {
      const result = await this.gmailService.sendEmail(to, subject, html, fromName);
      if (!result.success) throw new Error(result.error);
      return { success: true, service: 'Gmail OAuth2', messageId: result.messageId };
    } catch (error) {
      return { success: false, service: 'Gmail OAuth2', error: error.message };
    }
  }

  async sendViaBothServices(to, subject, html, fromName) {
    const results = {
      sendgrid: { success: false, error: null },
      gmail: { success: false, error: null }
    };

    const promises = [
      this.sendViaSendGrid(to, subject, html).then(result => results.sendgrid = result),
      this.sendViaGmail(to, subject, html, fromName).then(result => results.gmail = result)
    ];

    await Promise.allSettled(promises);

    const overallSuccess = results.sendgrid.success || results.gmail.success;
    
    return {
      success: overallSuccess,
      services: results,
      message: overallSuccess ? 
        `Email delivery attempted via both services. ${results.sendgrid.success ? 'SendGrid succeeded' : ''} ${results.gmail.success ? 'Gmail succeeded' : ''}`.trim() :
        'Both email services failed'
    };
  }

  async sendWithFallback(to, subject, html, fromName) {
    const sendGridResult = await this.sendViaSendGrid(to, subject, html);
    
    if (sendGridResult.success) {
      return sendGridResult;
    }

    const gmailResult = await this.sendViaGmail(to, subject, html, fromName);
    
    if (gmailResult.success) {
      return gmailResult;
    }

    return { 
      success: false, 
      service: 'Both',
      error: `All email services failed: SendGrid - ${sendGridResult.error}, Gmail - ${gmailResult.error}`
    };
  }

  stripHtmlTags(html) {
    return html.replace(/<[^>]*>/g, '');
  }
}

class RaffleValidationService {
  static validateRaffleForPurchase(raffle, ticketsBought) {
    if (!raffle) {
      throw new Error('Raffle not found');
    }

    if (raffle.status !== 'active') {
      throw new Error('Raffle is not active for purchases');
    }

    if (raffle.endDate && new Date() > raffle.endDate) {
      throw new Error('Raffle has ended');
    }

    if (raffle.maxTickets && (raffle.totalTicketsSold + ticketsBought) > raffle.maxTickets) {
      throw new Error('Not enough tickets available');
    }
  }

  static validateUserPurchaseLimit(raffle, userId, ticketsBought) {
    if (!raffle.maxTicketsPerUser) return;

    const existingTickets = raffle.participants.find(p => p.userId.equals(userId))?.ticketsBought || 0;
    if (existingTickets + ticketsBought > raffle.maxTicketsPerUser) {
      throw new Error('Purchase limit exceeded');
    }
  }

  static validateUserForPurchase(user) {
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.email || !this.isValidEmail(user.email)) {
      throw new Error('Valid email address required');
    }
  }

  static isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}

class PaymentCalculationService {
  static calculatePurchaseAmount(price, ticketsBought, includeTax = true) {
    const taxRate = includeTax ? 0.13 : 0;
    const baseAmount = price * ticketsBought;
    const taxAmount = Math.round(baseAmount * taxRate * 100) / 100;
    const totalAmount = baseAmount + taxAmount;
    const amountCents = Math.round(totalAmount * 100);

    if (amountCents < 100) {
      throw new Error('Minimum purchase amount is $1.00');
    }

    return { baseAmount, taxAmount, totalAmount, amountCents, taxRate };
  }
}

class EmailTemplateService {
  static generateReceiptEmail(order, user, raffle, orderLink) {
    return `
      <p>Dear ${user.username || 'Valued Customer'},</p>
      <p>Thank you for your raffle ticket purchase! Your order has been confirmed.</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 15px 0;">
        <h3 style="color: #333; margin-top: 0;">Order Details</h3>
        ${this.generateOrderDetailsTable(order, raffle)}
      </div>

      <p>You can view your order details here: <a href="${orderLink}" style="color: #007bff; text-decoration: none;">View Order</a></p>
      ${this.generateHelpSection(order)}
      <p>Best regards,<br/>TicketStack Team</p>
    `;
  }

  static generateConsolidatedReceiptEmail(orders, user, frontendUrl) {
    const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
    const totalTickets = orders.reduce((sum, order) => sum + order.ticketsBought, 0);
    
    return `
      <p>Dear ${user.username || 'Valued Customer'},</p>
      <p>Thank you for your raffle ticket purchases! Your orders have been confirmed.</p>
      
      ${this.generateConsolidatedSummary(orders.length, totalTickets, totalAmount)}
      ${this.generateOrderList(orders, frontendUrl)}
      ${this.generateConsolidatedHelpSection()}
      <p>Best regards,<br/>TicketStack Team</p>
    `;
  }

  static generateWinnerNotificationEmail(winner, raffle) {
    return `
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
        </div>
      </div>
    `;
  }

  static generateOrderDetailsTable(order, raffle) {
    return `
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Order Number:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">#${order._id.toString().slice(-8).toUpperCase()}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${order.paymentId}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Purchase Date:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Raffle:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${raffle.title}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Tickets Purchased:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">${order.ticketsBought}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Price per Ticket:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${raffle.price.toFixed(2)}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Subtotal:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${order.baseAmount.toFixed(2)}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Tax (13%):</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right;">$${order.taxAmount.toFixed(2)}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #ddd;"><strong>Total Amount:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">$${order.amount.toFixed(2)} CAD</td></tr>
      </table>
    `;
  }

  static generateConsolidatedSummary(orderCount, totalTickets, totalAmount) {
    return `
      <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="color: #2d5016; margin-top: 0;">Purchase Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Total Orders:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9; text-align: right;">${orderCount}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Total Tickets:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9; text-align: right;">${totalTickets}</td></tr>
          <tr><td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9;"><strong>Total Amount:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #c8e6c9; text-align: right; font-weight: bold;">$${totalAmount.toFixed(2)} CAD</td></tr>
        </table>
      </div>
    `;
  }

  static generateOrderList(orders, frontendUrl) {
    const ordersHtml = orders.map(order => `
      <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #667eea;">
        <h4 style="margin: 0 0 10px 0; color: #333;">${order.metadata?.raffleTitle || 'Raffle'}</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 4px 0;"><strong>Order #:</strong></td><td style="padding: 4px 0; text-align: right;">${order._id.toString().slice(-8).toUpperCase()}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Tickets:</strong></td><td style="padding: 4px 0; text-align: right;">${order.ticketsBought}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Price per Ticket:</strong></td><td style="padding: 4px 0; text-align: right;">$${order.metadata?.rafflePrice?.toFixed(2) || '0.00'}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Amount:</strong></td><td style="padding: 4px 0; text-align: right;">$${order.amount.toFixed(2)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>View Order:</strong></td><td style="padding: 4px 0; text-align: right;"><a href="${frontendUrl}/orders/${order._id}" style="color: #007bff; text-decoration: none;">Details</a></td></tr>
        </table>
      </div>
    `).join('');

    return `<h3 style="color: #333; margin: 20px 0 10px 0;">Order Details</h3>${ordersHtml}`;
  }

  static generateHelpSection(order) {
    return `
      <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>📧 Need Help?</strong>
        <p>If you have any questions about your purchase, please contact our support team with your Order Number #${order._id.toString().slice(-8).toUpperCase()}.</p>
      </div>
    `;
  }

  static generateConsolidatedHelpSection() {
    return `
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>📧 Need Help?</strong>
        <p>If you have any questions about your purchases, please contact our support team with your Order Numbers.</p>
      </div>
      <p>You can view all your orders here: <a href="${frontendUrl}/orders" style="color: #007bff; text-decoration: none;">View All Orders</a></p>
    `;
  }
}

class OrderProcessingService {
  static async updateRaffleWithPurchase(raffle, userId, ticketsBought, session) {
    raffle.totalTicketsSold += ticketsBought;
    
    const participantIndex = raffle.participants.findIndex(p => p.userId.equals(userId));
    
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
  }

  static async createOrderRecord(orderData, session) {
    const order = new Order(orderData);
    await order.save({ session });
    return order;
  }

  static async findPendingOrders(userId) {
    return await Order.find({
      userId: userId,
      receiptSent: false,
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    }).populate('raffleId').sort({ createdAt: 1 });
  }
}

class EmailNotificationService {
  constructor(emailDeliveryService) {
    this.emailDelivery = emailDeliveryService;
  }

  async sendReceiptEmail(order, user, raffle, origin) {
    return await this.sendEmailWithRetry(async () => {
      const frontendUrl = origin || 'https://raffle-system-lac.vercel.app';
      const orderLink = `${frontendUrl}/orders/${order._id}`;
      const emailHtml = EmailTemplateService.generateReceiptEmail(order, user, raffle, orderLink);

      const emailResult = await this.emailDelivery.sendEmail(
        user.email,
        `Purchase Confirmation - Order #${order._id.toString().slice(-8).toUpperCase()}`,
        emailHtml,
        { fromName: 'TicketStack Raffle System' }
      );

      await this.updateOrderEmailStatus(order._id, emailResult);
      return emailResult;
    }, 'receipt email');
  }

  async sendConsolidatedReceiptEmail(orders, user, origin) {
    return await this.sendEmailWithRetry(async () => {
      const frontendUrl = origin || 'https://raffle-system-lac.vercel.app';
      const emailHtml = EmailTemplateService.generateConsolidatedReceiptEmail(orders, user, frontendUrl);

      const emailResult = await this.emailDelivery.sendEmail(
        user.email,
        `Purchase Confirmation - ${orders.length} Order${orders.length > 1 ? 's' : ''}`,
        emailHtml,
        { fromName: 'TicketStack Raffle System' }
      );

      if (emailResult.success) {
        await this.markOrdersAsSent(orders.map(o => o._id));
      }

      return emailResult;
    }, 'consolidated receipt email');
  }

  async sendWinnerNotification(winner, raffle) {
    return await this.sendEmailWithRetry(async () => {
      const emailHtml = EmailTemplateService.generateWinnerNotificationEmail(winner, raffle);

      return await this.emailDelivery.sendEmail(
        winner.email,
        `🎉 You Won! ${raffle.title}`,
        emailHtml,
        { fromName: 'TicketStack Winners' }
      );
    }, 'winner notification');
  }

  async sendEmailWithRetry(emailFunction, emailType, maxRetries = 2) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          emailFunction(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email sending timeout')), 30000)
          )
        ]);

        if (result.success) {
          return result;
        }

        lastError = result.error;
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return { success: false, error: lastError?.message || `${emailType} sending failed` };
  }

  async updateOrderEmailStatus(orderId, emailResult) {
    await Order.findByIdAndUpdate(orderId, {
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
  }

  async markOrdersAsSent(orderIds) {
    await Order.updateMany(
      { _id: { $in: orderIds } },
      { 
        receiptSent: true,
        receiptSentAt: new Date()
      }
    );
  }
}

// ======================= INITIALIZE SERVICES =======================
dotenv.config();

const squarePaymentService = new SquarePaymentService(process.env.SQUARE_ACCESS_TOKEN, 'sandbox');
const emailDeliveryService = new EmailDeliveryService();
const emailNotificationService = new EmailNotificationService(emailDeliveryService);

// ======================= CONTROLLERS =======================
const purchaseTickets = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { userId, ticketsBought, paymentToken, includeTax = true, idempotencyKey: clientKey } = req.body;
    const raffleId = req.params.raffleId;

    validatePurchaseRequest(userId, ticketsBought, paymentToken);

    const raffle = await Raffle.findById(raffleId).session(session);
    const user = await User.findById(userId).session(session);

    RaffleValidationService.validateRaffleForPurchase(raffle, ticketsBought);
    RaffleValidationService.validateUserForPurchase(user);
    RaffleValidationService.validateUserPurchaseLimit(raffle, userId, ticketsBought);

    const { baseAmount, taxAmount, totalAmount, amountCents } = 
      PaymentCalculationService.calculatePurchaseAmount(raffle.price, ticketsBought, includeTax);

    const paymentResult = await processSquarePayment(
      squarePaymentService, 
      paymentToken, 
      clientKey, 
      amountCents, 
      user.email, 
      raffle, 
      ticketsBought
    );

    await OrderProcessingService.updateRaffleWithPurchase(raffle, userId, ticketsBought, session);

    const order = await OrderProcessingService.createOrderRecord({
      userId,
      raffleId,
      ticketsBought,
      amount: totalAmount,
      baseAmount,
      taxAmount,
      taxRate: includeTax ? 0.13 : 0,
      status: "completed",
      paymentId: paymentResult.payment.id,
      paymentStatus: paymentResult.payment.status,
      squareReceiptUrl: paymentResult.payment.receiptUrl,
      idempotencyKey: clientKey || crypto.randomUUID(),
      receiptSent: false,
      metadata: {
        raffleTitle: raffle.title,
        rafflePrice: raffle.price,
        userEmail: user.email,
        userName: user.username
      }
    }, session);

    await session.commitTransaction();

    await handlePostPurchaseEmail(order, user, raffle, req.headers.origin);

    sendSuccessResponse(res, order, raffle, user);

  } catch (error) {
    await session.abortTransaction().catch(() => {});
    handlePurchaseError(res, error);
  } finally {
    session.endSession();
  }
};

// Helper functions for purchaseTickets
function validatePurchaseRequest(userId, ticketsBought, paymentToken) {
  if (!paymentToken || paymentToken === 'undefined' || paymentToken === 'null' || paymentToken === '') {
    throw new Error("Invalid payment token. Please refresh the page and try again.");
  }

  if (!userId || !ticketsBought) {
    throw new Error("Missing required fields: userId, ticketsBought");
  }

  if (!Number.isInteger(ticketsBought) || ticketsBought <= 0) {
    throw new Error("Ticket quantity must be a positive integer");
  }
}

async function processSquarePayment(paymentService, paymentToken, clientKey, amountCents, userEmail, raffle, ticketsBought) {
  const idempotencyKey = clientKey || crypto.randomUUID();

  try {
    const paymentResult = await paymentService.createPayment({
      sourceId: paymentToken,
      idempotencyKey,
      amountMoney: {
        amount: amountCents,
        currency: 'CAD',
      },
      autocomplete: true,
      note: `Raffle: ${raffle.title}, Tickets: ${ticketsBought}`,
      buyerEmailAddress: userEmail,
    });

    if (!paymentResult.payment) {
      throw new Error("Payment failed - no payment object received");
    }

    if (paymentResult.payment.status !== 'COMPLETED') {
      throw new Error(`Payment not completed: ${paymentResult.payment.status}`);
    }

    return paymentResult;
  } catch (error) {
    throw enhanceSquareError(error);
  }
}

function enhanceSquareError(error) {
  const enhancedError = new Error(error.message);
  enhancedError.originalError = error;
  
  if (error.errors && error.errors.length > 0) {
    const squareError = error.errors[0];
    enhancedError.code = squareError.code;
    enhancedError.detail = squareError.detail;
    
    // Map Square error codes to user-friendly messages
    const errorMessages = {
      'CARD_DECLINED': "Your card was declined. Please try a different payment method.",
      'INVALID_EXPIRATION': "Card expiration date is invalid.",
      'VERIFY_CVV_FAILURE': "Invalid CVV code. Please check your card details.",
      'INSUFFICIENT_FUNDS': "Insufficient funds. Please try a different payment method.",
      'CARD_TOKEN_USED': "Payment session expired. Please refresh the page and try again.",
      'IDEMPOTENCY_KEY_REUSED': "Payment session expired. Please refresh the page and try again.",
      'INVALID_CARD': "Invalid card details. Please check your card information.",
      'GENERIC_DECLINE': "Card was declined. Please try a different payment method.",
      'EXPIRATION_FAILURE': "Card expiration date is invalid or has passed."
    };

    if (errorMessages[squareError.code]) {
      enhancedError.userMessage = errorMessages[squareError.code];
      enhancedError.shouldRetry = squareError.code === 'CARD_TOKEN_USED' || squareError.code === 'IDEMPOTENCY_KEY_REUSED';
    }
  }

  return enhancedError;
}

async function handlePostPurchaseEmail(order, user, raffle, origin) {
  const pendingOrders = await OrderProcessingService.findPendingOrders(user._id);

  if (pendingOrders.length > 1) {
    emailNotificationService.sendConsolidatedReceiptEmail(pendingOrders, user, origin)
      .then(result => {
        if (result.success) {
          console.log(`✅ Consolidated receipt email sent for ${pendingOrders.length} orders`);
        }
      })
      .catch(console.error);
  } else {
    emailNotificationService.sendReceiptEmail(order, user, raffle, origin)
      .then(result => {
        if (result.success) {
          console.log('✅ Individual receipt email sent');
        }
      })
      .catch(console.error);
  }
}

function sendSuccessResponse(res, order, raffle, user) {
  res.json({
    success: true,
    message: "Tickets purchased successfully",
    orderId: order._id,
    paymentId: order.paymentId,
    totalTicketsSold: raffle.totalTicketsSold,
    amount: order.amount,
    baseAmount: order.baseAmount,
    taxAmount: order.taxAmount,
    ticketsBought: order.ticketsBought,
    receiptEmail: user.email,
    squareReceiptUrl: order.squareReceiptUrl
  });
}

function handlePurchaseError(res, error) {
  console.error("Purchase error:", error);

  const statusCode = error.userMessage ? 400 : 500;
  const response = { error: error.userMessage || error.message };

  if (error.shouldRetry) {
    response.shouldRetry = true;
  }

  if (error.code) {
    response.paymentStatus = error.code;
  }

  res.status(statusCode).json(response);
}

// Other controllers remain similar but can be refactored following the same pattern
const createRaffle = async (req, res) => {
  try {
    const { title, description, startDate, endDate, price, category } = req.body;
    const raffle = new Raffle({ title, description, startDate, endDate, price, category });
    await raffle.save();
    res.status(201).json(raffle);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getRaffleWinningChance = async (req, res) => {
  try {
    const { raffleId, userId } = req.params;

    validateObjectIds(raffleId, userId);

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

// Utility functions
function validateObjectIds(...ids) {
  for (const id of ids) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
  }
}

// Export all controllers and services
module.exports = {
  createRaffle,
  getAllRaffles: async (req, res) => {
    try {
      const raffles = await Raffle.find().sort({ createdAt: -1 });
      res.json(raffles);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
  getRecentRaffles: async (req, res) => {
    try {
      const raffles = await Raffle.find().sort({ createdAt: -1 }).limit(3);
      res.json(raffles);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
  getRaffleById: async (req, res) => {
    try {
      const raffle = await Raffle.findById(req.params.id);
      if (!raffle) return res.status(404).json({ message: 'Raffle not found' });
      res.json(raffle);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
  updateRaffle: async (req, res) => {
    try {
      const { title, description, startDate, endDate, price, category, status } = req.body;
      validateObjectIds(req.params.id);

      const raffle = await Raffle.findById(req.params.id);
      if (!raffle) return res.status(404).json({ message: 'Raffle not found' });

      Object.assign(raffle, {
        title: title || raffle.title,
        description: description || raffle.description,
        startDate: startDate ? new Date(startDate) : raffle.startDate,
        endDate: endDate ? new Date(endDate) : raffle.endDate,
        price: price ?? raffle.price,
        category: category || raffle.category,
        status: status || raffle.status
      });

      await raffle.save();
      res.json(raffle);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
  deleteRaffle: async (req, res) => {
    try {
      validateObjectIds(req.params.id);
      const raffle = await Raffle.findById(req.params.id);
      if (!raffle) return res.status(404).json({ message: 'Raffle not found' });
      await Raffle.findByIdAndDelete(req.params.id);
      res.json({ message: 'Raffle deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  },
  getRaffleWinningChance,
  purchaseTickets,
  pickWinner: async (req, res) => {
    try {
      const { raffleId } = req.params;
      validateObjectIds(raffleId);

      const raffle = await Raffle.findById(raffleId).populate("participants.userId", "username email");
      if (!raffle) return res.status(404).json({ message: "Raffle not found" });

      if (new Date() < raffle.endDate) {
        return res.status(400).json({ message: "Raffle has not ended yet" });
      }

      if (!raffle.participants?.length) {
        return res.status(400).json({ message: "No participants in this raffle" });
      }

      const winner = selectWinner(raffle.participants);
      const updatedRaffle = await updateRaffleWithWinner(raffleId, winner, raffle);

      emailNotificationService.sendWinnerNotification(winner, raffle)
        .then(result => {
          if (result.success) console.log('✅ Winner notification sent');
        })
        .catch(console.error);

      res.json({
        message: "Winner selected successfully",
        winner: { id: winner._id, username: winner.username, email: winner.email },
        raffle: updatedRaffle
      });
    } catch (error) {
      console.error("Error picking raffle winner:", error);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
  getUserRaffles: async (req, res) => {
    try {
      const { userId } = req.params;
      validateObjectIds(userId);

      const raffles = await Raffle.find({ "participants.userId": userId })
        .sort({ createdAt: -1 })
        .populate("winner", "name email")
        .populate("participants.userId", "name email");

      const userRaffles = raffles.map(r => {
        const userParticipant = r.participants.find(p => p.userId?._id?.toString() === userId);
        const didUserWin = r.winner?._id?.toString() === userId;
        
        return {
          _id: r._id,
          title: r.title,
          description: r.description,
          status: r.status,
          endDate: r.endDate,
          totalTicketsSold: r.totalTicketsSold,
          ticketsBought: userParticipant ? userParticipant.ticketsBought : 0,
          winner: r.winner ? { id: r.winner._id, name: r.winner.name, email: r.winner.email } : null,
          didUserWin
        };
      });

      res.json(userRaffles);
    } catch (error) {
      console.error("Error fetching user raffles:", error);
      res.status(500).json({ message: "Server error" });
    }
  },
  updateRaffleStatuses: async () => {
    const now = new Date();
    try {
      const raffles = await Raffle.find();
      for (let raffle of raffles) {
        const newStatus = calculateRaffleStatus(raffle, now);
        if (raffle.status !== newStatus) {
          await Raffle.findByIdAndUpdate(raffle._id, { status: newStatus }, { runValidators: false });
        }
      }
    } catch (error) {
      console.error('Error updating raffle statuses:', error);
    }
  },
  exportRaffleCSV: async (req, res) => {
    try {
      const { id } = req.params;
      validateObjectIds(id);

      const raffle = await Raffle.findById(id).populate('participants.userId', 'name email');
      if (!raffle) return res.status(404).json({ message: 'Raffle not found' });
      if (!raffle.participants?.length) return res.status(400).json({ message: 'No participants available to export' });

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

      const json2csvParser = new Parser();
      const csv = json2csvParser.parse(exportData);

      res.header('Content-Type', 'text/csv');
      res.attachment(`${raffle.title.replace(/\s+/g, '_')}_Export.csv`);
      return res.send(csv);
    } catch (error) {
      console.error('Error exporting raffle data:', error);
      res.status(500).json({ message: 'Failed to export raffle data' });
    }
  },
  // Export services for testing and other uses
  SquarePaymentService,
  EmailDeliveryService,
  RaffleValidationService,
  PaymentCalculationService,
  EmailTemplateService,
  OrderProcessingService,
  EmailNotificationService
};

// Helper functions for raffle operations
function selectWinner(participants) {
  let ticketPool = [];
  participants.forEach(p => {
    for (let i = 0; i < p.ticketsBought; i++) {
      ticketPool.push(p.userId);
    }
  });
  const winnerIndex = Math.floor(Math.random() * ticketPool.length);
  return ticketPool[winnerIndex];
}

async function updateRaffleWithWinner(raffleId, winner, originalRaffle) {
  return await Raffle.findByIdAndUpdate(
    raffleId,
    {
      winner: winner._id || winner,
      status: "completed",
      raffleItems: Array.isArray(originalRaffle.raffleItems) ? originalRaffle.raffleItems : [],
      category: originalRaffle.category || 'General'
    },
    { new: true, runValidators: false }
  ).populate("winner", "username email");
}

function calculateRaffleStatus(raffle, now) {
  if (now < raffle.startDate) return 'upcoming';
  if (now >= raffle.startDate && now <= raffle.endDate) return 'active';
  if (now > raffle.endDate) return 'completed';
  return raffle.status;
}