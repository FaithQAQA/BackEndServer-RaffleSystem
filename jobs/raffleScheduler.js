const cron = require('node-cron');
const Raffle = require('../Models/Raffle');
const User = require('../Models/User');
const EmailService = require('../services/emailService');
// ======================= SERVICE LAYERS =======================
class EmailTemplateService {
  static generateRaffleStartingReminder(user, raffle, joinLink) {
    const startTime = this.formatDateTime(raffle.startDate);
    const ticketCount = this.getUserTicketCount(raffle, user._id);

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎟️ Raffle Starting Soon!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Get ready to join the live raffle</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hello, ${user.username}!</h2>
          <p style="font-size: 16px;">The raffle you purchased tickets for is starting <strong>in 5 minutes!</strong></p>
          
          ${this.generateRaffleDetails(raffle, startTime, ticketCount)}
          ${this.generateActionButton(joinLink, '🚀 Join Live Raffle', '#667eea')}
          ${this.generateProTip('Join a few minutes early to ensure you don\'t miss the start!')}
          ${this.generateFallbackLink(joinLink)}
        </div>
        ${this.generateFooter()}
      </div>
    `;
  }

  static generateRaffleEndingReminder(user, raffle, joinLink) {
    const endTime = this.formatDateTime(raffle.endDate);
    const ticketCount = this.getUserTicketCount(raffle, user._id);

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">⏰ Raffle Ending Soon!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Last chance to join the live drawing</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hello, ${user.username}!</h2>
          <p style="font-size: 16px;">The raffle you're participating in is ending <strong>in 5 minutes!</strong></p>
          
          ${this.generateRaffleDetails(raffle, endTime, ticketCount, 'End Time')}
          ${this.generateActionButton(joinLink, '🚀 Join Live Finale', '#ff6b6b')}
          ${this.generateLastChanceTip()}
          ${this.generateFallbackLink(joinLink)}
        </div>
        ${this.generateFooter()}
      </div>
    `;
  }

  static generateWinnerNotification(user, raffle) {
    const ticketCount = this.getUserTicketCount(raffle, user._id);

    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">You won the raffle!</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hello, ${user.username}!</h2>
          <p style="font-size: 16px;">You are the lucky winner of:</p>
          
          <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #4CAF50;">
            <h3 style="color: #333; margin-top: 0;">${raffle.title}</h3>
            <p style="color: #666; margin: 5px 0;">${raffle.description || ''}</p>
            <p style="margin: 10px 0;"><strong>🎫 Your Winning Tickets:</strong> ${ticketCount}</p>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>📞 Next Steps:</strong>
            <p style="margin: 5px 0;">Our team will contact you shortly with prize details and delivery information.</p>
          </div>

          <p style="text-align: center; color: #666;">Thank you for participating in our raffle!</p>
        </div>
        ${this.generateFooter('TicketStack Raffle System')}
      </div>
    `;
  }

  static generateRaffleDetails(raffle, time, ticketCount, timeLabel = 'Start Time') {
    return `
      <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
        <h3 style="color: #333; margin-top: 0;">${raffle.title}</h3>
        <p style="color: #666; margin: 5px 0;">${raffle.description || 'Join us for an exciting raffle event!'}</p>
        <div style="display: flex; justify-content: space-between; margin-top: 15px;">
          <div><strong>🕒 ${timeLabel}:</strong><br>${time}</div>
          <div><strong>🎫 Your Tickets:</strong><br>${ticketCount} tickets</div>
        </div>
      </div>
    `;
  }

  static generateActionButton(link, text, color) {
    return `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" 
           style="background: linear-gradient(135deg, ${color} 0%, ${this.darkenColor(color)} 100%); 
                  color: white; 
                  padding: 15px 30px; 
                  text-decoration: none; 
                  border-radius: 5px; 
                  font-size: 16px; 
                  font-weight: bold;
                  display: inline-block;">
          ${text}
        </a>
      </div>
    `;
  }

  static generateProTip(tip) {
    return `
      <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>💡 Pro Tip:</strong>
        <p style="margin: 5px 0; font-size: 14px;">${tip}</p>
      </div>
    `;
  }

  static generateLastChanceTip() {
    return `
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <strong>💡 Last Chance:</strong>
        <p style="margin: 5px 0; font-size: 14px;">Join now to watch the winner selection live! The raffle will close automatically at the end time.</p>
      </div>
    `;
  }

  static generateFallbackLink(link) {
    return `
      <p style="font-size: 14px; color: #666; text-align: center;">
        Can't click the button? Copy and paste this link:<br>
        <span style="color: #667eea; word-break: break-all;">${link}</span>
      </p>
    `;
  }

  static generateFooter(text = 'TicketStack Raffle System') {
    return `
      <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
        <p style="margin: 0;">This is an automated reminder from ${text}.</p>
        <p style="margin: 5px 0;">If you have any questions, please contact our support team.</p>
      </div>
    `;
  }

  static formatDateTime(date) {
    return new Date(date).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      dateStyle: 'full',
      timeStyle: 'short'
    });
  }

  static getUserTicketCount(raffle, userId) {
    return raffle.participants.find(p => p.userId.equals(userId))?.ticketsBought || 0;
  }

  static darkenColor(color) {
    const colorMap = {
      '#667eea': '#764ba2',
      '#ff6b6b': '#ee5a24',
      '#4CAF50': '#45a049'
    };
    return colorMap[color] || color;
  }
}

class RaffleNotificationService {
  constructor(emailService) {
    this.emailService = emailService;
  }

  async sendRaffleStartingReminder(user, raffle, frontendUrl) {
    const joinLink = `${frontendUrl}/raffles/${raffle._id}/live`;
    const emailHtml = EmailTemplateService.generateRaffleStartingReminder(user, raffle, joinLink);
    
    return await this.sendNotificationEmail(
      user.email,
      `🚀 Reminder: ${raffle.title} Starts in 5 Minutes! - TicketStack`,
      emailHtml,
      `raffle starting reminder for "${raffle.title}"`
    );
  }

  async sendRaffleEndingReminder(user, raffle, frontendUrl) {
    const joinLink = `${frontendUrl}/raffles/${raffle._id}/live`;
    const emailHtml = EmailTemplateService.generateRaffleEndingReminder(user, raffle, joinLink);
    
    return await this.sendNotificationEmail(
      user.email,
      `⏰ Final Chance: ${raffle.title} Ending in 5 Minutes! - TicketStack`,
      emailHtml,
      `raffle ending reminder for "${raffle.title}"`
    );
  }

  async sendWinnerNotification(user, raffle) {
    const emailHtml = EmailTemplateService.generateWinnerNotification(user, raffle);
    
    return await this.sendNotificationEmail(
      user.email,
      `🎉 Congratulations! You won the raffle: ${raffle.title} - TicketStack`,
      emailHtml,
      `winner notification for "${raffle.title}"`
    );
  }

  async sendNotificationEmail(to, subject, html, emailType) {
    try {
      await this.emailService.sendEmail(to, subject, html);
      console.log(`✅ ${emailType} sent to ${to}`);
      return true;
    } catch (error) {
      console.error(`❌ Error sending ${emailType} to ${to}:`, error);
      return false;
    }
  }
}

class RaffleSchedulingService {
  static calculateFiveMinutesFromNow() {
    const now = new Date();
    return new Date(now.getTime() + 5 * 60 * 1000);
  }

  static createTimeWindow(targetTime, windowSeconds = 30) {
    return {
      $gte: new Date(targetTime.getTime() - windowSeconds * 1000),
      $lte: new Date(targetTime.getTime() + windowSeconds * 1000)
    };
  }

  static async findRafflesStartingSoon() {
    const fiveMinutesFromNow = this.calculateFiveMinutesFromNow();
    
    return await Raffle.find({
      startDate: this.createTimeWindow(fiveMinutesFromNow),
      status: 'upcoming',
      reminderSent: { $ne: true }
    }).populate('participants.userId', 'email username');
  }

  static async findRafflesEndingSoon() {
    const fiveMinutesFromNow = this.calculateFiveMinutesFromNow();
    
    return await Raffle.find({
      endDate: this.createTimeWindow(fiveMinutesFromNow),
      status: 'active',
      reminderSent: { $ne: true }
    }).populate('participants.userId', 'email username');
  }

  static async findCompletedRafflesNeedingWinners() {
    return await Raffle.find({
      endDate: { $lte: new Date() },
      status: 'active',
    });
  }
}

class RaffleStatusService {
  static determineRaffleStatus(raffle, currentTime) {
    if (currentTime < raffle.startDate) return 'upcoming';
    if (currentTime >= raffle.startDate && currentTime <= raffle.endDate) return 'active';
    if (currentTime > raffle.endDate) return 'completed';
    return raffle.status;
  }

  static sanitizeRaffleData(raffle) {
    const sanitizedRaffle = raffle.toObject ? raffle.toObject() : { ...raffle };
    
    // Ensure raffleItems is an array
    if (typeof sanitizedRaffle.raffleItems === 'string') {
      try {
        sanitizedRaffle.raffleItems = JSON.parse(sanitizedRaffle.raffleItems);
      } catch {
        sanitizedRaffle.raffleItems = [];
      }
    } else if (!Array.isArray(sanitizedRaffle.raffleItems)) {
      sanitizedRaffle.raffleItems = [];
    }
    
    // Ensure category exists
    if (!sanitizedRaffle.category) {
      sanitizedRaffle.category = 'General';
    }
    
    return sanitizedRaffle;
  }

  static async updateRaffleStatus(raffle, newStatus) {
    const sanitizedData = this.sanitizeRaffleData(raffle);
    
    await Raffle.findByIdAndUpdate(
      raffle._id,
      { ...sanitizedData, status: newStatus },
      { runValidators: false }
    );
  }
}

class WinnerSelectionService {
  static selectWinner(participants) {
    if (!participants || participants.length === 0) return null;

    const ticketPool = this.createTicketPool(participants);
    const winnerIndex = Math.floor(Math.random() * ticketPool.length);
    
    return ticketPool[winnerIndex];
  }

  static createTicketPool(participants) {
    const ticketPool = [];
    
    participants.forEach(participant => {
      for (let i = 0; i < participant.ticketsBought; i++) {
        ticketPool.push(participant.userId);
      }
    });
    
    return ticketPool;
  }

  static async processWinnerSelection(raffle, notificationService) {
    const winnerId = this.selectWinner(raffle.participants);
    
    if (!winnerId) {
      console.log(`⚠️ No participants found for raffle: ${raffle.title}`);
      return null;
    }

    const winner = await User.findById(winnerId);
    
    if (!winner) {
      console.error(`⚠️ Winner user not found for raffle: ${raffle.title}`);
      return null;
    }

    await this.updateRaffleWithWinner(raffle, winner._id);
    await notificationService.sendWinnerNotification(winner, raffle);

    console.log(`🏆 Winner selected for "${raffle.title}": ${winner.email}`);
    return winner;
  }

  static async updateRaffleWithWinner(raffle, winnerId) {
    const sanitizedData = RaffleStatusService.sanitizeRaffleData(raffle);
    
    await Raffle.findByIdAndUpdate(
      raffle._id,
      { ...sanitizedData, winner: winnerId, status: 'completed' },
      { new: true, runValidators: false }
    );
  }
}

// ======================= NOTIFICATION COORDINATORS =======================
class RaffleReminderCoordinator {
  constructor(notificationService) {
    this.notificationService = notificationService;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
  }

  async sendRaffleStartingReminders() {
    console.log('⏰ Checking for raffle starting reminders...');
    
    try {
      const startingRaffles = await RaffleSchedulingService.findRafflesStartingSoon();
      console.log(`📧 Found ${startingRaffles.length} raffles starting soon needing reminders`);

      for (const raffle of startingRaffles) {
        await this.processRemindersForRaffle(raffle, 'starting');
      }
    } catch (error) {
      console.error('❌ Error in raffle starting reminder scheduler:', error);
    }
  }

  async sendRaffleEndingReminders() {
    console.log('⏰ Checking for raffle ending reminders...');
    
    try {
      const endingRaffles = await RaffleSchedulingService.findRafflesEndingSoon();
      console.log(`📧 Found ${endingRaffles.length} raffles ending soon needing reminders`);

      for (const raffle of endingRaffles) {
        await this.processRemindersForRaffle(raffle, 'ending');
      }
    } catch (error) {
      console.error('❌ Error in raffle ending reminder scheduler:', error);
    }
  }

  async processRemindersForRaffle(raffle, reminderType) {
    console.log(`🔄 Processing ${reminderType} reminders for raffle: ${raffle.title}`);
    
    const allEmailsSent = await this.sendRemindersToParticipants(raffle, reminderType);
    
    if (allEmailsSent) {
      await this.markReminderAsSent(raffle);
      console.log(`✅ All ${reminderType} reminders sent for raffle: ${raffle.title}`);
    } else {
      console.log(`⚠️ Some ${reminderType} reminders failed for raffle: ${raffle.title}`);
    }
  }

  async sendRemindersToParticipants(raffle, reminderType) {
    let allEmailsSent = true;

    for (const participant of raffle.participants) {
      if (participant.userId && participant.userId.email) {
        const emailSent = reminderType === 'starting' 
          ? await this.notificationService.sendRaffleStartingReminder(participant.userId, raffle, this.frontendUrl)
          : await this.notificationService.sendRaffleEndingReminder(participant.userId, raffle, this.frontendUrl);
        
        if (!emailSent) {
          allEmailsSent = false;
        }
      }
    }

    return allEmailsSent;
  }

  async markReminderAsSent(raffle) {
    raffle.reminderSent = true;
    raffle.reminderSentAt = new Date();
    await raffle.save();
  }
}

class RaffleStatusCoordinator {
  constructor(notificationService) {
    this.notificationService = notificationService;
  }

  async updateAllRaffleStatuses() {
    console.log('🕒 Running raffle status update check...');
    
    try {
      const raffles = await Raffle.find();
      let updatedCount = 0;

      for (const raffle of raffles) {
        const wasUpdated = await this.updateSingleRaffleStatus(raffle);
        if (wasUpdated) updatedCount++;
      }

      console.log(`✅ Raffle status update completed. ${updatedCount} raffles updated.`);
    } catch (error) {
      console.error('❌ Error updating raffle statuses:', error);
      this.logValidationErrors(error);
    }
  }

  async updateSingleRaffleStatus(raffle) {
    const currentTime = new Date();
    const newStatus = RaffleStatusService.determineRaffleStatus(raffle, currentTime);

    if (raffle.status !== newStatus) {
      await RaffleStatusService.updateRaffleStatus(raffle, newStatus);
      console.log(`🔄 Updated raffle "${raffle.title}" → ${newStatus}`);
      return true;
    }

    return false;
  }

  async processCompletedRaffles() {
    console.log('🔍 Checking raffles for winners...');
    
    try {
      const completedRaffles = await RaffleSchedulingService.findCompletedRafflesNeedingWinners();

      for (const raffle of completedRaffles) {
        await WinnerSelectionService.processWinnerSelection(raffle, this.notificationService);
      }
    } catch (error) {
      console.error('❌ Error in raffle winner scheduler:', error);
    }
  }

  logValidationErrors(error) {
    if (error.errors) {
      Object.keys(error.errors).forEach(field => {
        console.error(`   Field error: ${field} - ${error.errors[field].message}`);
      });
    }
  }
}

// ======================= INITIALIZATION & CRON SCHEDULES =======================
// Use the imported EmailService instance directly (it's already an instance)
const raffleNotificationService = new RaffleNotificationService(EmailService);
const raffleReminderCoordinator = new RaffleReminderCoordinator(raffleNotificationService);
const raffleStatusCoordinator = new RaffleStatusCoordinator(raffleNotificationService);

// Raffle STARTING reminder check - runs every minute
cron.schedule('* * * * *', async () => {
  await raffleReminderCoordinator.sendRaffleStartingReminders();
});

// Raffle ENDING reminder check - runs every minute
cron.schedule('* * * * *', async () => {
  await raffleReminderCoordinator.sendRaffleEndingReminders();
});

// Raffle status and winner processing - runs every minute
cron.schedule('* * * * *', async () => {
  await raffleStatusCoordinator.updateAllRaffleStatuses();
  await raffleStatusCoordinator.processCompletedRaffles();
});
// ======================= EXPORTS =======================
module.exports = {
  // Services
  EmailTemplateService,
  RaffleNotificationService,
  RaffleSchedulingService,
  RaffleStatusService,
  WinnerSelectionService,
  
  // Coordinators
  RaffleReminderCoordinator,
  RaffleStatusCoordinator,
  
  // Public functions
  sendWinnerEmail: (user, raffle) => raffleNotificationService.sendWinnerNotification(user, raffle),
  updateRaffleStatuses: () => raffleStatusCoordinator.updateAllRaffleStatuses(),
  checkAndSendStartingReminders: () => raffleReminderCoordinator.sendRaffleStartingReminders(),
  checkAndSendEndingReminders: () => raffleReminderCoordinator.sendRaffleEndingReminders(),
  sendRaffleStartingReminderEmail: (user, raffle, frontendUrl) => 
    raffleNotificationService.sendRaffleStartingReminder(user, raffle, frontendUrl),
  sendRaffleEndingReminderEmail: (user, raffle, frontendUrl) => 
    raffleNotificationService.sendRaffleEndingReminder(user, raffle, frontendUrl)
};