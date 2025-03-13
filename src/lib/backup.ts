import fs from 'fs/promises';
import path from 'path';
import { Logger } from './logger';
import { backupConfig } from '../config';
import { ExchangeManager } from './exchange';
import { WalletManager } from './wallet';

interface SystemState {
  timestamp: number;
  exchanges: {
    [key: string]: {
      balances: any;
      openOrders: any[];
      lastTrades: any[];
    };
  };
  wallets: {
    [network: string]: {
      address: string;
      balance: number;
      tokens: {
        [symbol: string]: number;
      };
    };
  };
  trades: {
    pending: any[];
    completed: any[];
    failed: any[];
  };
  metrics: {
    profitLoss: number;
    totalTrades: number;
    successRate: number;
    averageProfit: number;
  };
}

export class BackupManager {
  private logger: Logger;
  private exchangeManager: ExchangeManager;
  private walletManager: WalletManager;
  private backupPath: string;
  private backupInterval: NodeJS.Timeout | null = null;

  constructor(
    logger: Logger,
    exchangeManager: ExchangeManager,
    walletManager: WalletManager
  ) {
    this.logger = logger;
    this.exchangeManager = exchangeManager;
    this.walletManager = walletManager;
    this.backupPath = backupConfig.path;
    this.ensureBackupDirectory();
  }

  public async start(): Promise<void> {
    this.logger.info('Iniciando sistema de backup');
    await this.createBackup();
    this.startBackupInterval();
  }

  public stop(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
    this.logger.info('Sistema de backup parado');
  }

  private startBackupInterval(): void {
    this.backupInterval = setInterval(
      () => this.createBackup(),
      backupConfig.interval
    );
  }

  public async createBackup(): Promise<void> {
    try {
      const state = await this.captureSystemState();
      await this.saveBackup(state);
      await this.cleanOldBackups();
      this.logger.info('Backup criado com sucesso');
    } catch (error) {
      this.logger.error(`Erro ao criar backup: ${error.message}`);
      throw error;
    }
  }

  public async createEmergencyBackup(): Promise<void> {
    try {
      const state = await this.captureSystemState();
      await this.saveBackup(state, true);
      this.logger.info('Backup de emergência criado com sucesso');
    } catch (error) {
      this.logger.error(`Erro ao criar backup de emergência: ${error.message}`);
      throw error;
    }
  }

  public async restoreFromBackup(timestamp?: number): Promise<void> {
    try {
      const backup = await this.loadLatestBackup(timestamp);
      await this.restoreSystemState(backup);
      this.logger.info('Sistema restaurado do backup com sucesso');
    } catch (error) {
      this.logger.error(`Erro ao restaurar do backup: ${error.message}`);
      throw error;
    }
  }

  private async captureSystemState(): Promise<SystemState> {
    const exchanges = this.exchangeManager.getExchanges();
    const exchangeStates: SystemState['exchanges'] = {};

    for (const exchange of exchanges) {
      exchangeStates[exchange.name] = {
        balances: await exchange.fetchBalance(),
        openOrders: await exchange.fetchOpenOrders(),
        lastTrades: await exchange.fetchMyTrades()
      };
    }

    const walletStates: SystemState['wallets'] = {};
    const networks = await this.walletManager.getConnectedNetworks();

    for (const network of networks) {
      const address = await this.walletManager.getAddress(network);
      const balance = await this.walletManager.getBalance(network);
      const tokens = await this.walletManager.getTokenBalances(network);

      walletStates[network] = {
        address,
        balance,
        tokens
      };
    }

    const metrics = await this.calculateMetrics();

    return {
      timestamp: Date.now(),
      exchanges: exchangeStates,
      wallets: walletStates,
      trades: {
        pending: await this.exchangeManager.getPendingTrades(),
        completed: await this.exchangeManager.getCompletedTrades(),
        failed: await this.exchangeManager.getFailedTrades()
      },
      metrics
    };
  }

  private async calculateMetrics(): Promise<SystemState['metrics']> {
    const completedTrades = await this.exchangeManager.getCompletedTrades();
    const totalTrades = completedTrades.length;
    
    if (totalTrades === 0) {
      return {
        profitLoss: 0,
        totalTrades: 0,
        successRate: 0,
        averageProfit: 0
      };
    }

    const profits = completedTrades.map(trade => trade.profit);
    const totalProfit = profits.reduce((sum, profit) => sum + profit, 0);
    const successfulTrades = completedTrades.filter(trade => trade.profit > 0).length;

    return {
      profitLoss: totalProfit,
      totalTrades,
      successRate: (successfulTrades / totalTrades) * 100,
      averageProfit: totalProfit / totalTrades
    };
  }

  private async saveBackup(state: SystemState, isEmergency = false): Promise<void> {
    const timestamp = state.timestamp;
    const fileName = isEmergency
      ? `emergency_backup_${timestamp}.json`
      : `backup_${timestamp}.json`;
    
    const filePath = path.join(this.backupPath, fileName);
    await fs.writeFile(filePath, JSON.stringify(state, null, 2));
  }

  private async loadLatestBackup(timestamp?: number): Promise<SystemState> {
    const files = await fs.readdir(this.backupPath);
    const backupFiles = files.filter(file => file.startsWith('backup_'));
    
    if (backupFiles.length === 0) {
      throw new Error('Nenhum backup encontrado');
    }

    let targetFile;
    if (timestamp) {
      targetFile = backupFiles.find(file => file.includes(timestamp.toString()));
      if (!targetFile) {
        throw new Error(`Backup não encontrado para o timestamp ${timestamp}`);
      }
    } else {
      targetFile = backupFiles.sort().reverse()[0];
    }

    const filePath = path.join(this.backupPath, targetFile);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  }

  private async restoreSystemState(state: SystemState): Promise<void> {
    // Restaurar estado das exchanges
    for (const [exchangeName, exchangeState] of Object.entries(state.exchanges)) {
      const exchange = this.exchangeManager.getExchange(exchangeName);
      if (exchange) {
        await exchange.cancelAllOrders();
        // Recriar ordens pendentes se necessário
        for (const order of exchangeState.openOrders) {
          await exchange.createOrder(order);
        }
      }
    }

    // Restaurar estado das carteiras
    for (const [network, walletState] of Object.entries(state.wallets)) {
      await this.walletManager.connect(network);
    }

    this.logger.info('Estado do sistema restaurado com sucesso');
  }

  private async cleanOldBackups(): Promise<void> {
    const files = await fs.readdir(this.backupPath);
    const backupFiles = files
      .filter(file => file.startsWith('backup_'))
      .sort()
      .reverse();

    if (backupFiles.length > backupConfig.maxBackups) {
      const filesToDelete = backupFiles.slice(backupConfig.maxBackups);
      for (const file of filesToDelete) {
        await fs.unlink(path.join(this.backupPath, file));
      }
    }
  }

  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.backupPath);
    } catch {
      await fs.mkdir(this.backupPath, { recursive: true });
    }
  }
}