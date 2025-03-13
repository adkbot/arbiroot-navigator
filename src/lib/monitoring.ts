import { Logger } from './logger';
import { ExchangeManager } from './exchange';
import { WalletManager } from './wallet';
import { monitoringConfig } from '../config';
import { AlertManager } from './alert';
import { BackupManager } from './backup';

export class MonitoringSystem {
  private logger: Logger;
  private exchangeManager: ExchangeManager;
  private walletManager: WalletManager;
  private alertManager: AlertManager;
  private backupManager: BackupManager;
  
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;
  private lastErrorTime = 0;
  
  constructor(
    logger: Logger,
    exchangeManager: ExchangeManager,
    walletManager: WalletManager,
    alertManager: AlertManager,
    backupManager: BackupManager
  ) {
    this.logger = logger;
    this.exchangeManager = exchangeManager;
    this.walletManager = walletManager;
    this.alertManager = alertManager;
    this.backupManager = backupManager;
  }

  public async start(): Promise<void> {
    this.logger.info('Iniciando sistema de monitoramento');
    await this.performHealthCheck();
    this.startHealthCheckInterval();
  }

  public stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.logger.info('Sistema de monitoramento parado');
  }

  private startHealthCheckInterval(): void {
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      monitoringConfig.healthCheckInterval
    );
  }

  private async performHealthCheck(): Promise<void> {
    try {
      await this.checkExchangeConnectivity();
      await this.checkWalletBalances();
      await this.checkProfitOpportunities();
      await this.checkSystemResources();
      
      // Reset error counter on successful health check
      this.consecutiveErrors = 0;
      this.lastErrorTime = 0;
      
      await this.backupManager.createBackup();
      
    } catch (error) {
      this.handleHealthCheckError(error);
    }
  }

  private async checkExchangeConnectivity(): Promise<void> {
    const exchanges = this.exchangeManager.getExchanges();
    
    for (const exchange of exchanges) {
      try {
        await exchange.fetchBalance();
        this.logger.info(`Conectividade OK com ${exchange.name}`);
      } catch (error) {
        const message = `Erro de conectividade com ${exchange.name}: ${error.message}`;
        this.logger.error(message);
        await this.alertManager.sendAlert('error', message);
        throw error;
      }
    }
  }

  private async checkWalletBalances(): Promise<void> {
    try {
      const balances = await this.walletManager.getAllBalances();
      
      for (const [network, balance] of Object.entries(balances)) {
        if (balance < monitoringConfig.balanceThresholds.critical) {
          const message = `CRÍTICO: Saldo muito baixo em ${network}: ${balance} USDT`;
          this.logger.error(message);
          await this.alertManager.sendAlert('critical', message);
        } else if (balance < monitoringConfig.balanceThresholds.warning) {
          const message = `AVISO: Saldo baixo em ${network}: ${balance} USDT`;
          this.logger.warn(message);
          await this.alertManager.sendAlert('warning', message);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao verificar saldos: ${error.message}`);
      throw error;
    }
  }

  private async checkProfitOpportunities(): Promise<void> {
    try {
      const opportunities = await this.exchangeManager.scanProfitOpportunities();
      
      for (const opp of opportunities) {
        if (opp.expectedProfit > monitoringConfig.profitThresholds.high) {
          const message = `Oportunidade de lucro alto detectada: ${opp.expectedProfit}%`;
          this.logger.info(message);
          await this.alertManager.sendAlert('opportunity', message);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao verificar oportunidades: ${error.message}`);
      throw error;
    }
  }

  private async checkSystemResources(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    if (heapUsed / heapTotal > 0.9) {
      const message = `AVISO: Alto uso de memória - ${heapUsed}MB/${heapTotal}MB`;
      this.logger.warn(message);
      await this.alertManager.sendAlert('warning', message);
    }
  }

  private async handleHealthCheckError(error: Error): Promise<void> {
    this.consecutiveErrors++;
    const now = Date.now();
    
    if (this.lastErrorTime === 0) {
      this.lastErrorTime = now;
    }
    
    const timeWindow = now - this.lastErrorTime;
    
    if (
      this.consecutiveErrors >= monitoringConfig.errorThresholds.maxConsecutive ||
      timeWindow <= monitoringConfig.errorThresholds.timeWindow
    ) {
      const message = `CRÍTICO: Múltiplos erros detectados - ${this.consecutiveErrors} erros em ${timeWindow/1000}s`;
      this.logger.error(message);
      await this.alertManager.sendAlert('critical', message);
      
      // Criar backup de emergência
      await this.backupManager.createEmergencyBackup();
      
      // Parar o sistema em caso de erros críticos
      this.stop();
    }
  }
}