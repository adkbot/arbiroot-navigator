// Import axios that was just installed
import axios from 'axios';
import { alertConfig } from '../config';

type AlertType = 'info' | 'warning' | 'error' | 'success';

interface AlertMessage {
  type: AlertType;
  message: string;
  details?: any;
}

// Telegram alert
async function sendTelegramAlert(message: string) {
  if (!alertConfig.telegram?.enabled || !alertConfig.telegram.botToken || !alertConfig.telegram.chatId) {
    console.warn("Telegram alerts are not configured. Check your .env file.");
    return;
  }

  const telegramApi = `https://api.telegram.org/bot${alertConfig.telegram.botToken}/sendMessage`;
  try {
    await axios.post(telegramApi, {
      chat_id: alertConfig.telegram.chatId,
      text: message,
      parse_mode: 'Markdown'
    });
    console.log("Telegram alert sent successfully.");
  } catch (error: any) {
    console.error("Failed to send Telegram alert:", error.message);
    if (error.response) {
      console.error("Telegram API response:", error.response.data);
    }
  }
}

// Discord alert
async function sendDiscordAlert(message: string) {
  if (!alertConfig.discord?.enabled || !alertConfig.discord.webhookUrl) {
    console.warn("Discord alerts are not configured. Check your .env file.");
    return;
  }

  try {
    await axios.post(alertConfig.discord.webhookUrl, {
      content: message
    });
    console.log("Discord alert sent successfully.");
  } catch (error: any) {
    console.error("Failed to send Discord alert:", error.message);
    if (error.response) {
      console.error("Discord API response:", error.response.data);
    }
  }
}

// Unified alert function
export async function sendAlert(alert: AlertMessage) {
  const message = `[${alert.type.toUpperCase()}] ${alert.message}\n${alert.details ? 'Details: ' + JSON.stringify(alert.details, null, 2) : ''}`;

  if (alertConfig.telegram?.enabled) {
    await sendTelegramAlert(message);
  }

  if (alertConfig.discord?.enabled) {
    await sendDiscordAlert(message);
  }

  console.log(`Alert sent: ${message}`);
}
