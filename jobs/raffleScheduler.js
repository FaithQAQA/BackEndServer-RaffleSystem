const cron = require('node-cron');
const Raffle = require('../Models/Raffle');
const mongoose = require('mongoose');
const sgMail = require('@sendgrid/mail');
const User = require('../Models/User');

require('dotenv').config({ path: '../.env' });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const FROM_EMAIL = process.env.EMAIL_FROM || 'voicenotify2@gmail.com';

// ======================= ✅ SENDGRID EMAIL FUNCTION =======================
const sendEmail = async (to, subject, html) => {
  const msg = {
    to: to,
    from: FROM_EMAIL,
    subject: subject,
    html: html,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent successfully via SendGrid API');
    return true;
  } catch (error) {
    console.error('❌ SendGrid API error:', error);
    throw error;
  }
};

// ========== RAFFLE STARTING REMINDER EMAIL ==========
async function sendRaffleStartingReminderEmail(user, raffle, frontendUrl) {
  try {
    const joinLink = `${frontendUrl}/raffles/${raffle._id}/live`;
    const startTime = new Date(raffle.startDate).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">🎟️ Raffle Starting Soon!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Get ready to join the live raffle</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hello, ${user.username}!</h2>
          <p style="font-size: 16px;">The raffle you purchased tickets for is starting <strong>in 5 minutes!</strong></p>
          
          <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">${raffle.title}</h3>
            <p style="color: #666; margin: 5px 0;">${raffle.description || 'Join us for an exciting raffle event!'}</p>
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
              <div>
                <strong>🕒 Start Time:</strong><br>
                ${startTime}
              </div>
              <div>
                <strong>🎫 Your Tickets:</strong><br>
                ${raffle.participants.find(p => p.userId.equals(user._id))?.ticketsBought || 0} tickets
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${joinLink}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 5px; 
                      font-size: 16px; 
                      font-weight: bold;
                      display: inline-block;">
              🚀 Join Live Raffle
            </a>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>💡 Pro Tip:</strong>
            <p style="margin: 5px 0; font-size: 14px;">Join a few minutes early to ensure you don't miss the start of the raffle!</p>
          </div>

          <p style="font-size: 14px; color: #666; text-align: center;">
            Can't click the button? Copy and paste this link:<br>
            <span style="color: #667eea; word-break: break-all;">${joinLink}</span>
          </p>
        </div>

        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">This is an automated reminder from TicketStack Raffle System.</p>
          <p style="margin: 5px 0;">If you have any questions, please contact our support team.</p>
        </div>
      </div>
    `;

    await sendEmail(
      user.email,
      `🚀 Reminder: ${raffle.title} Starts in 5 Minutes!`,
      emailHtml
    );

    console.log(`✅ Raffle starting reminder sent to ${user.email} for "${raffle.title}"`);
    return true;
  } catch (err) {
    console.error(`❌ Error sending raffle starting reminder to ${user.email}:`, err);
    return false;
  }
}

// ========== RAFFLE STARTING REMINDER SCHEDULER ==========
async function checkAndSendStartingReminders() {
  console.log('⏰ Checking for raffle starting reminders...');

  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Find raffles STARTING in exactly 5 minutes
    const startingRaffles = await Raffle.find({
      startDate: {
        $gte: new Date(fiveMinutesFromNow.getTime() - 30000), // 30-second window
        $lte: new Date(fiveMinutesFromNow.getTime() + 30000)
      },
      status: 'upcoming',
      reminderSent: { $ne: true } // Only send if reminder hasn't been sent
    }).populate('participants.userId', 'email username');

    console.log(`📧 Found ${startingRaffles.length} raffles starting soon needing reminders`);

    for (let raffle of startingRaffles) {
      console.log(`🔄 Processing starting reminders for raffle: ${raffle.title}`);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      let allEmailsSent = true;

      // Send reminders to all participants
      for (let participant of raffle.participants) {
        if (participant.userId && participant.userId.email) {
          const emailSent = await sendRaffleStartingReminderEmail(
            participant.userId, 
            raffle, 
            frontendUrl
          );
          
          if (!emailSent) {
            allEmailsSent = false;
          }
        }
      }

      // Mark reminder as sent if all emails were successful
      if (allEmailsSent) {
        raffle.reminderSent = true;
        raffle.reminderSentAt = new Date();
        await raffle.save();
        console.log(`✅ All starting reminders sent for raffle: ${raffle.title}`);
      } else {
        console.log(`⚠️ Some starting reminders failed for raffle: ${raffle.title}`);
      }
    }

  } catch (err) {
    console.error('❌ Error in raffle starting reminder scheduler:', err);
  }
}

// ========== RAFFLE ENDING REMINDER EMAIL ==========
async function sendRaffleEndingReminderEmail(user, raffle, frontendUrl) {
  try {
    const joinLink = `${frontendUrl}/raffles/${raffle._id}/live`;
    const endTime = new Date(raffle.endDate).toLocaleString('en-CA', {
      timeZone: 'America/Toronto',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">⏰ Raffle Ending Soon!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Last chance to join the live drawing</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Hello, ${user.username}!</h2>
          <p style="font-size: 16px;">The raffle you're participating in is ending <strong>in 5 minutes!</strong></p>
          
          <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #ff6b6b;">
            <h3 style="color: #333; margin-top: 0;">${raffle.title}</h3>
            <p style="color: #666; margin: 5px 0;">${raffle.description || 'Final moments to join the raffle!'}</p>
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
              <div>
                <strong>⏰ End Time:</strong><br>
                ${endTime}
              </div>
              <div>
                <strong>🎫 Your Tickets:</strong><br>
                ${raffle.participants.find(p => p.userId.equals(user._id))?.ticketsBought || 0} tickets
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${joinLink}" 
               style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 5px; 
                      font-size: 16px; 
                      font-weight: bold;
                      display: inline-block;">
              🚀 Join Live Finale
            </a>
          </div>

          <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>💡 Last Chance:</strong>
            <p style="margin: 5px 0; font-size: 14px;">Join now to watch the winner selection live! The raffle will close automatically at the end time.</p>
          </div>

          <p style="font-size: 14px; color: #666; text-align: center;">
            Can't click the button? Copy and paste this link:<br>
            <span style="color: #ff6b6b; word-break: break-all;">${joinLink}</span>
          </p>
        </div>

        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">This is an automated reminder from TicketStack Raffle System.</p>
          <p style="margin: 5px 0;">If you have any questions, please contact our support team.</p>
        </div>
      </div>
    `;

    await sendEmail(
      user.email,
      `⏰ Final Chance: ${raffle.title} Ending in 5 Minutes!`,
      emailHtml
    );

    console.log(`✅ Raffle ending reminder sent to ${user.email} for "${raffle.title}"`);
    return true;
  } catch (err) {
    console.error(`❌ Error sending raffle ending reminder to ${user.email}:`, err);
    return false;
  }
}

// ========== RAFFLE ENDING REMINDER SCHEDULER ==========
async function checkAndSendEndingReminders() {
  console.log('⏰ Checking for raffle ending reminders...');

  try {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Find raffles ENDING in exactly 5 minutes
    const endingRaffles = await Raffle.find({
      endDate: {
        $gte: new Date(fiveMinutesFromNow.getTime() - 30000), // 30-second window
        $lte: new Date(fiveMinutesFromNow.getTime() + 30000)
      },
      status: 'active', // Must be active (currently running)
      reminderSent: { $ne: true } // Only send if reminder hasn't been sent
    }).populate('participants.userId', 'email username');

    console.log(`📧 Found ${endingRaffles.length} raffles ending soon needing reminders`);

    for (let raffle of endingRaffles) {
      console.log(`🔄 Processing ending reminders for raffle: ${raffle.title}`);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      let allEmailsSent = true;

      // Send reminders to all participants
      for (let participant of raffle.participants) {
        if (participant.userId && participant.userId.email) {
          const emailSent = await sendRaffleEndingReminderEmail(
            participant.userId, 
            raffle, 
            frontendUrl
          );
          
          if (!emailSent) {
            allEmailsSent = false;
          }
        }
      }

      // Mark reminder as sent if all emails were successful
      if (allEmailsSent) {
        raffle.reminderSent = true;
        raffle.reminderSentAt = new Date();
        await raffle.save();
        console.log(`✅ All ending reminders sent for raffle: ${raffle.title}`);
      } else {
        console.log(`⚠️ Some ending reminders failed for raffle: ${raffle.title}`);
      }
    }

  } catch (err) {
    console.error('❌ Error in raffle ending reminder scheduler:', err);
  }
}

// ========== SEND WINNER EMAIL ==========
async function sendWinnerEmail(user, raffle) {
  try {
    const emailHtml = `
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
            <p style="margin: 10px 0;"><strong>🎫 Your Winning Tickets:</strong> ${raffle.participants.find(p => p.userId.equals(user._id))?.ticketsBought || 0}</p>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <strong>📞 Next Steps:</strong>
            <p style="margin: 5px 0;">Our team will contact you shortly with prize details and delivery information.</p>
          </div>

          <p style="text-align: center; color: #666;">
            Thank you for participating in our raffle!
          </p>
        </div>

        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p style="margin: 0;">TicketStack Raffle System</p>
        </div>
      </div>
    `;

    await sendEmail(
      user.email,
      `🎉 Congratulations! You won the raffle: ${raffle.title}`,
      emailHtml
    );

    console.log(`✅ Winner email sent to ${user.email} for "${raffle.title}"`);
  } catch (err) {
    console.error('❌ Error sending winner email:', err);
  }
}

// ========== PICK WINNER ==========
const pickWinner = async (raffle) => {
  if (!raffle.participants || raffle.participants.length === 0) return;

  // Weighted random selection
  let ticketPool = [];
  raffle.participants.forEach((p) => {
    for (let i = 0; i < p.ticketsBought; i++) {
      ticketPool.push(p.userId);
    }
  });

  const winnerId = ticketPool[Math.floor(Math.random() * ticketPool.length)];
  const winnerUser = await User.findById(winnerId);

  if (!winnerUser) {
    console.error('⚠️ Winner user not found for raffle:', raffle.title);
    return;
  }

  raffle.winner = winnerUser._id;
  raffle.status = 'completed';
  await raffle.save();

  console.log(`🏆 Winner selected for "${raffle.title}": ${winnerUser.email}`);
  await sendWinnerEmail(winnerUser, raffle);
};

// ========== CRON SCHEDULES ==========

// Raffle STARTING reminder check - runs every minute
cron.schedule('* * * * *', async () => {
  console.log('⏰ Running raffle STARTING reminder check...');
  await checkAndSendStartingReminders();
});

// Raffle ENDING reminder check - runs every minute
cron.schedule('* * * * *', async () => {
  console.log('⏰ Running raffle ENDING reminder check...');
  await checkAndSendEndingReminders();
});

// Raffle closer - runs every minute
cron.schedule('* * * * *', async () => {
  console.log('🔍 Checking raffles for winners...');
  try {
    const rafflesToClose = await Raffle.find({
      endDate: { $lte: new Date() },
      status: 'active',
    });

    for (let raffle of rafflesToClose) {
      await pickWinner(raffle);
    }
  } catch (err) {
    console.error('❌ Error in raffle winner scheduler:', err);
  }
});

// Status updater - runs every minute
cron.schedule('* * * * *', async () => {
  console.log('🕒 Running raffle status update check...');
  await updateRaffleStatuses();
});

// ========== STATUS UPDATER ==========
// ========== STATUS UPDATER ==========
async function updateRaffleStatuses() {
  const now = new Date();

  try {
    const raffles = await Raffle.find();

    for (let raffle of raffles) {
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
        raffle.status = newStatus;
        
        // Fix raffleItems if it's a string
        if (typeof raffle.raffleItems === 'string') {
          try {
            raffle.raffleItems = JSON.parse(raffle.raffleItems);
          } catch (e) {
            console.log(`⚠️ Fixing invalid raffleItems for raffle: ${raffle.title}`);
            raffle.raffleItems = [];
          }
        }
        
        // Ensure category exists
        if (!raffle.category) {
          raffle.category = 'General';
        }
        
        await raffle.save();
        console.log(`🔄 Updated raffle "${raffle.title}" → ${newStatus}`);
      }
    }

    console.log('✅ Raffle statuses updated successfully.');
  } catch (err) {
    console.error('❌ Error updating raffle statuses:', err);
    
    // More detailed error logging
    if (err.errors) {
      Object.keys(err.errors).forEach(field => {
        console.error(`   Field error: ${field} - ${err.errors[field].message}`);
      });
    }
  }
}

module.exports = { 
  sendWinnerEmail, 
  updateRaffleStatuses, 
  checkAndSendStartingReminders,
  checkAndSendEndingReminders,
  sendRaffleStartingReminderEmail,
  sendRaffleEndingReminderEmail
};