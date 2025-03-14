import axios from 'axios';
import { Logger } from '../lib/logger';
import { alertConfig } from '../config';

export class NotificationAPI {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public async sendTelegramMessage(message: string): Promise<void> {
    if (!alertConfig.telegram.enabled) {
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${alertConfig.telegram.botToken}/sendMessage`;
      await axios.post(url, {
        chat_id: alertConfig.telegram.chatId,
        text: message,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para Telegram: ${error.message}`);
    }
  }

  public async sendDiscordMessage(
    message: string,
    color: number = 0x00ff00
  ): Promise<void> {
    if (!alertConfig.discord.enabled) {
      return;
    }

    try {
      const embed = {
        description: message,
        color: color,
        timestamp: new Date().toISOString()
      };

      await axios.post(alertConfig.discord.webhookUrl, {
        embeds: [embed]
      });
    } catch (error) {
      this.logger.error(`Erro ao enviar mensagem para Discord: ${error.message}`);
    }
  }

  public async sendNotification(
    title: string,
    message: string,
    type: 'info' | 'warning' | 'error' | 'success' = 'info'
  ): Promise<void> {
    // Determinar cor para Discord baseado no tipo
    const colors = {
      info: 0x3498db,    // Azul
      warning: 0xf1c40f,  // Amarelo
      error: 0xe74c3c,    // Vermelho
      success: 0x2ecc71   // Verde
    };

    // Formatar mensagem para Telegram
    const telegramMessage = `*${title}*\n${message}`;

    // Enviar para todos os canais configurados
    await Promise.all([
      this.sendTelegramMessage(telegramMessage),
      this.sendDiscordMessage(message, colors[type])
    ]);
  }

  public async sendTradeNotification(tradeData: any): Promise<void> {
    const message = `
🔄 Nova Trade Executada

Exchange: ${tradeData.exchange}
Par: ${tradeData.pair}
Tipo: ${tradeData.type}
Lado: ${tradeData.side}
Quantidade: ${tradeData.amount}
Preço: ${tradeData.price}
Status: ${tradeData.status}
${tradeData.profit ? `Lucro: ${tradeData.profit}%` : ''}
    `.trim();

    await this.sendNotification(
      'Trade Executada',
      message,
      tradeData.status === 'completed' ? 'success' : 'error'
    );
  }

  public async sendOpportunityNotification(opportunityData: any): Promise<void> {
    const message = `
💰 Oportunidade de Arbitragem

Exchanges: ${opportunityData.exchanges.join(' → ')}
Caminho: ${opportunityData.path.join(' → ')}
Lucro Esperado: ${opportunityData.expectedProfit}%
Saldo Necessário: ${opportunityData.requiredBalance} USDT
    `.trim();

    await this.sendNotification(
      'Oportunidade Detectada',
      message,
      'info'
    );
  }

  public async sendErrorNotification(error: Error): Promise<void> {
    const message = `
❌ Erro no Sistema

Tipo: ${error.name}
Mensagem: ${error.message}
Stack: ${error.stack}
    `.trim();

    await this.sendNotification(
      'Erro no Sistema',
      message,
      'error'
    );
  }

  public async sendBalanceAlert(balanceData: any): Promise<void> {
    const message = `
💵 Alerta de Saldo

Exchange: ${balanceData.exchange}
Moeda: ${balanceData.currency}
Saldo: ${balanceData.balance} ${balanceData.currency}
Limite: ${balanceData.threshold} ${balanceData.currency}
    `.trim();

    await this.sendNotification(
      'Alerta de Saldo',
      message,
      'warning'
    );
  }

  public async sendSystemStatusUpdate(status: any): Promise<void> {
    const message = `
📊 Status do Sistema

Uptime: ${status.uptime}
Trades Hoje: ${status.todayTrades}
Lucro Total: ${status.totalProfit}%
Taxa de Sucesso: ${status.successRate}%
Memória: ${status.memoryUsage}MB
CPU: ${status.cpuUsage}%
    `.trim();

    await this.sendNotification(
      'Status do Sistema',
      message,
      'info'
    );
  }
}