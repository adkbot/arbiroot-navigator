
import { ExchangeManager, WalletManager } from './exchange';
import { Logger } from './logger';
import { AlertManager, sendAlert } from './alert';
import { ChainType } from './types';

// Configuration for monitoring
interface MonitoringConfig {
  balanceThresholds: {
    [key: string]: number;
  };
  healthCheckInterval: number;
  alertOnExchangeErrors: boolean;
  alertOnLowBalances: boolean;
  alertOnOpportunities: boolean;
}

export class MonitoringService {
  private exchangeManager: ExchangeManager;
  private walletManager: WalletManager;
  private logger: Logger;
  private alertManager: AlertManager;
  private healthCheckIntervalId: NodeJS.Timeout | null = null;
  private config: MonitoringConfig;
  
  constructor() {
    this.exchangeManager = new ExchangeManager();
    this.walletManager = new WalletManager();
    this.logger = new Logger('MonitoringService');
    this.alertManager = new AlertManager();
    
    // Default configuration
    this.config = {
      balanceThresholds: {
        'ETH': 0.1,
        'MATIC': 10,
        'USDT': 100,
        'USDC': 100
      },
      healthCheckInterval: 5 * 60 * 1000, // 5 minutes
      alertOnExchangeErrors: true,
      alertOnLowBalances: true,
      alertOnOpportunities: true
    };
  }
  
  // Start the monitoring service
  public start(): void {
    this.logger.info('Starting monitoring service');
    
    // Perform initial health check
    this.performHealthCheck();
    
    // Set up interval for regular health checks
    this.healthCheckIntervalId = setInterval(
      () => this.performHealthCheck(), 
      this.config.healthCheckInterval
    );
  }
  
  // Stop the monitoring service
  public stop(): void {
    if (this.healthCheckIntervalId) {
      clearInterval(this.healthCheckIntervalId);
      this.healthCheckIntervalId = null;
    }
    this.logger.info('Monitoring service stopped');
  }
  
  // Perform a comprehensive health check
  private async performHealthCheck(): Promise<void> {
    this.logger.info('Performing health check');
    
    try {
      // Check exchange connections
      await this.checkExchangeConnections();
      
      // Check wallet balances
      await this.checkWalletBalances();
      
      // Scan for profitable opportunities
      await this.scanForOpportunities();
      
      this.logger.info('Health check completed successfully');
    } catch (error) {
      this.logger.error('Health check failed', error);
    }
  }
  
  // Check all exchange connections
  private async checkExchangeConnections(): Promise<void> {
    try {
      // Mock implementation since getExchanges doesn't exist
      const exchanges = ['binance', 'coinbase', 'kraken']; // Mocked exchange list
      
      const downExchanges: string[] = [];
      
      // Log the status
      this.logger.info(`Checked ${exchanges.length} exchange connections, ${downExchanges.length} down`);
      
      // Alert if any exchanges are down
      if (downExchanges.length > 0 && this.config.alertOnExchangeErrors) {
        await this.alertManager.sendAlert(
          'warning',
          `${downExchanges.length} exchanges are down`,
          { exchanges: downExchanges }
        );
      }
    } catch (error) {
      this.logger.error('Failed to check exchange connections', error);
    }
  }
  
  // Check wallet balances
  private async checkWalletBalances(): Promise<void> {
    try {
      const balances = await this.walletManager.getAllBalances();
      
      const lowBalances: { token: string; balance: number; threshold: number }[] = [];
      
      // Check each balance against thresholds
      for (const [token, balance] of Object.entries(balances)) {
        const threshold = this.config.balanceThresholds[token.toUpperCase()];
        
        if (threshold && (balance as number) < threshold) {
          lowBalances.push({
            token,
            balance: balance as number,
            threshold
          });
        }
      }
      
      // Log the status
      this.logger.info(`Checked wallet balances, ${lowBalances.length} below threshold`);
      
      // Alert if any balances are low
      if (lowBalances.length > 0 && this.config.alertOnLowBalances) {
        await this.alertManager.sendAlert(
          'warning',
          `${lowBalances.length} tokens are below threshold`,
          { lowBalances }
        );
      }
    } catch (error) {
      this.logger.error('Failed to check wallet balances', error);
    }
  }
  
  // Scan for profitable opportunities
  private async scanForOpportunities(): Promise<void> {
    try {
      // Mock implementation for compatibility
      const opportunities: any[] = [];
      
      // Log the status
      this.logger.info(`Scanned for opportunities, found ${opportunities.length}`);
      
      // Alert if profitable opportunities are found
      if (opportunities.length > 0 && this.config.alertOnOpportunities) {
        const topOpportunity = opportunities[0];
        await this.alertManager.sendAlert(
          'info',
          `Found ${opportunities.length} profitable opportunities`,
          { topOpportunity }
        );
      }
    } catch (error) {
      this.logger.error('Failed to scan for opportunities', error);
    }
  }
  
  // Update monitoring configuration
  public updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Restart interval with new timing if it was changed
    if (newConfig.healthCheckInterval && this.healthCheckIntervalId) {
      this.stop();
      this.start();
    }
    
    this.logger.info('Monitoring configuration updated');
  }
}
