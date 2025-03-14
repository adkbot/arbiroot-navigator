import { Logger } from './lib/logger';
import { ExchangeManager } from './lib/exchange';
import { WalletManager } from './lib/wallet';
import { MonitoringSystem } from './lib/monitoring';
import { BackupManager } from './lib/backup';
import { AlertManager } from './lib/alert';
import { ArbitrageExecutor } from './lib/arbitrage';

class ArbirootNavigator {
  private logger: Logger;
  private exchangeManager: ExchangeManager;
  private walletManager: WalletManager;
  private alertManager: AlertManager;
  private backupManager: BackupManager;
  private monitoringSystem: MonitoringSystem;
  private arbitrageExecutor: ArbitrageExecutor;

  constructor() {
    this.logger = new Logger();
    this.exchangeManager = new ExchangeManager(this.logger);
    this.walletManager = new WalletManager(this.logger);
    this.alertManager = new AlertManager(this.logger);
    this.backupManager = new BackupManager(
      this.logger,
      this.exchangeManager,
      this.walletManager
    );
    this.monitoringSystem = new MonitoringSystem(
      this.logger,
      this.exchangeManager,
      this.walletManager,
      this.alertManager,
      this.backupManager
    );
    this.arbitrageExecutor = new ArbitrageExecutor(
      this.logger,
      this.exchangeManager,
      this.walletManager,
      this.alertManager
    );
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('Iniciando Arbiroot Navigator...');
      
      // Iniciar sistemas de suporte
      await this.backupManager.start();
      await this.monitoringSystem.start();
      await this.alertManager.testAlertChannels();
      
      // Iniciar execução das arbitragens
      await this.arbitrageExecutor.start();
      
      this.logger.info('Sistema iniciado com sucesso');
      
      // Manter o processo rodando
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      this.logger.error(`Erro ao iniciar o sistema: ${error.message}`);
      await this.stop();
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      this.logger.info('Parando Arbiroot Navigator...');
      
      // Parar execução das arbitragens
      await this.arbitrageExecutor.stop();
      
      // Parar sistemas de suporte
      this.monitoringSystem.stop();
      this.backupManager.stop();
      
      // Criar backup final
      await this.backupManager.createBackup();
      
      this.logger.info('Sistema parado com sucesso');
      process.exit(0);
    } catch (error) {
      this.logger.error(`Erro ao parar o sistema: ${error.message}`);
      process.exit(1);
    }
  }
}

// Iniciar o sistema
const arbiroot = new ArbirootNavigator();
arbiroot.start().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});