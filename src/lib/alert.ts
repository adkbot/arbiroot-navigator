import { Logger } from './logger';
import { alertConfig } from '../config';
import axios from 'axios';

type AlertLevel = 'info' | 'warning' | 'error' | 'critical' | 'opportunity';

interface AlertOptions {
  level: AlertLevel;
  message: string;
  data?: any;
}

export class AlertManager {
  private logger: Logger;
  private telegramEnabled: boolean;
  private discordEnabled: boolean;
  private telegramBotToken?: string;
  private telegramChatId?: string;
  private discordWebhookUrl?: string;

  constructor(logger: Logger) {
    this.logger = logger;
    
    // Configurar Telegram
    this.telegramEnabled = alertConfig.telegram.enabled;
    if (this.telegramEnabled) {
      this.telegramBotToken = alertConfig.telegram.botToken;
      this.telegramChatId = alertConfig.telegram.chatId;
    }
    
    // Configurar Discord
    this.discordEnabled = alertConfig.discord.enabled;
    if (this.discordEnabled) {
      this.discordWebhookUrl = alertConfig.discord.webhookUrl;
    }
  }

  public async sendAlert(level: AlertLevel, message: string, data?: any): Promise<void> {
    const alert: AlertOptions = { level, message, data };
    
    // Log local
    this.logAlert(alert);
    
    // Enviar para canais configurados
    await Promise.all([
      this.sendTelegramAlert(alert),
      this.sendDiscordAlert(alert)
    ]);
  }

  private logAlert(alert: AlertOptions): void {
    const { level, message } = alert;
    
    switch (level) {
      case 'info':
        this.logger.info(`[ALERTA] ${message}`);
        break;
      case 'warning':
        this.logger.warn(`[ALERTA] ${message}`);
        break;
      case 'error':
      case 'critical':
        this.logger.error(`[ALERTA] ${message}`);
        break;
      case 'opportunity':
        this.logger.info(`[OPORTUNIDADE] ${message}`);
        break;
    }
  }

  private async sendTelegramAlert(alert: AlertOptions): Promise<void> {
    if (!this.telegramEnabled) return;

    try {
      const { level, message, data } = alert;
      const emoji = this.getAlertEmoji(level);
      
      let formattedMessage = `${emoji} *${level.toUpperCase()}*\n${message}`;
      
      if (data) {
        formattedMessage += '\n\n```\n' + JSON.stringify(data, null, 2) + '\n```';
      }

      const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;
      await axios.post(url, {
        chat_id: this.telegramChatId,
        text: formattedMessage,
        parse_mode: 'Markdown'
      });

    } catch (error) {
      this.logger.error(`Erro ao enviar alerta para Telegram: ${error.message}`);
    }
  }

  private async sendDiscordAlert(alert: AlertOptions): Promise<void> {
    if (!this.discordEnabled) return;

    try {
      const { level, message, data } = alert;
      const color = this.getDiscordColor(level);
      
      const embed = {
        title: level.toUpperCase(),
        description: message,
        color: color,
        timestamp: new Date().toISOString()
      };

      if (data) {
        embed['fields'] = [{
          name: 'Dados Adicionais',
          value: '```json\n' + JSON.stringify(data, null, 2) + '\n```'
        }];
      }

      await axios.post(this.discordWebhookUrl!, {
        embeds: [embed]
      });

    } catch (error) {
      this.logger.error(`Erro ao enviar alerta para Discord: ${error.message}`);
    }
  }

  private getAlertEmoji(level: AlertLevel): string {
    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'critical':
        return '🚨';
      case 'opportunity':
        return '💰';
      default:
        return '📢';
    }
  }

  private getDiscordColor(level: AlertLevel): number {
    switch (level) {
      case 'info':
        return 0x3498db;      // Azul
      case 'warning':
        return 0xf1c40f;      // Amarelo
      case 'error':
        return 0xe74c3c;      // Vermelho
      case 'critical':
        return 0x992d22;      // Vermelho escuro
      case 'opportunity':
        return 0x2ecc71;      // Verde
      default:
        return 0x95a5a6;      // Cinza
    }
  }

  public async testAlertChannels(): Promise<void> {
    try {
      await this.sendAlert(
        'info',
        'Teste de sistema de alertas',
        { timestamp: Date.now() }
      );
      this.logger.info('Teste de alertas enviado com sucesso');
    } catch (error) {
      this.logger.error(`Erro no teste de alertas: ${error.message}`);
      throw error;
    }
  }
}