
import { ExchangeManager, WalletManager } from './exchange';
import { Logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

interface BackupConfig {
  dir: string;
  remoteUrl?: string;
  remoteApiKey?: string;
  interval: number;
  compress: boolean;
  keepLocal: number;
  keepRemote: number;
}

export class BackupService {
  private logger: Logger;
  private config: BackupConfig;
  private exchangeManager: ExchangeManager;
  private walletManager: WalletManager;
  private intervalId: NodeJS.Timeout | null = null;
  
  constructor(
    config: Partial<BackupConfig> = {},
    exchangeManager?: ExchangeManager,
    walletManager?: WalletManager
  ) {
    this.logger = new Logger('BackupService');
    this.config = {
      dir: './backups',
      interval: 86400000, // 24 hours in ms
      compress: true,
      keepLocal: 7,
      keepRemote: 30,
      ...config
    };
    
    this.exchangeManager = exchangeManager || new ExchangeManager();
    this.walletManager = walletManager || new WalletManager();
  }
  
  async start(): Promise<void> {
    if (this.intervalId) {
      this.logger.warn('Backup service already running');
      return;
    }
    
    this.logger.info('Starting backup service');
    
    try {
      await this.createBackup();
    } catch (error) {
      this.logger.error('Initial backup failed', error);
    }
    
    this.intervalId = setInterval(async () => {
      try {
        await this.createBackup();
      } catch (error) {
        this.logger.error('Scheduled backup failed', error);
      }
    }, this.config.interval);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('Backup service stopped');
    }
  }
  
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(this.config.dir, filename);
    
    this.logger.info(`Creating backup: ${filename}`);
    
    try {
      // Ensure directory exists
      if (typeof fs.promises !== 'undefined' && fs.promises.mkdir) {
        await fs.promises.mkdir(this.config.dir, { recursive: true });
      }
      
      // Collect data to backup
      const data = await this.collectBackupData();
      
      // Write to file - using mock implementation for browser environment
      this.mockWriteFile(filepath, JSON.stringify(data, null, 2));
      
      this.logger.info(`Backup created: ${filepath}`);
      
      // Upload to remote if configured
      if (this.config.remoteUrl) {
        try {
          await this.uploadToRemote(filepath, data);
          this.logger.info(`Backup uploaded to remote: ${filename}`);
        } catch (error) {
          this.logger.error('Failed to upload backup to remote', error);
        }
      }
      
      // Cleanup old backups
      await this.cleanupOldBackups();
      
      return filepath;
    } catch (error) {
      this.logger.error('Failed to create backup', error);
      throw error;
    }
  }
  
  private mockWriteFile(filepath: string, data: string): void {
    // This is a mock implementation since fs operations won't work in browser
    console.log(`[MOCK] Writing file ${filepath}`);
    // In a real Node.js environment, this would be:
    // fs.writeFileSync(filepath, data, 'utf8');
    
    // Store in localStorage as a fallback in browser environment
    try {
      localStorage.setItem(`backup_${Date.now()}`, data);
    } catch (e) {
      console.warn('Failed to store backup in localStorage', e);
    }
  }
  
  private async collectBackupData(): Promise<any> {
    this.logger.info('Collecting data for backup');
    
    // Get connected networks
    const networks = await this.walletManager.getConnectedNetworks();
    
    // Get wallet data
    const walletAddress = await this.walletManager.getAddress();
    const walletBalance = await this.walletManager.getBalance();
    const tokenBalances = {};
    
    // Get token balances for each network
    for (const network of networks) {
      tokenBalances[network] = await this.walletManager.getTokenBalances(walletAddress, network);
    }
    
    // Get exchange data (mock implementation for browser)
    const exchanges = [];
    const pendingTrades = [];
    const completedTrades = [];
    
    try {
      // Return collected data
      return {
        timestamp: new Date().toISOString(),
        wallet: {
          address: walletAddress,
          balance: walletBalance,
          tokens: tokenBalances
        },
        exchanges: exchanges,
        trades: {
          pending: pendingTrades,
          completed: completedTrades
        },
        config: {
          // Include non-sensitive configuration
          backupInterval: this.config.interval,
          backupCompression: this.config.compress
        }
      };
    } catch (error) {
      this.logger.error('Error collecting backup data', error);
      throw error;
    }
  }
  
  private async uploadToRemote(filepath: string, data: any): Promise<void> {
    if (!this.config.remoteUrl) {
      throw new Error('Remote URL not configured');
    }
    
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (this.config.remoteApiKey) {
        headers['X-API-Key'] = this.config.remoteApiKey;
      }
      
      await axios.post(this.config.remoteUrl, data, { headers });
    } catch (error) {
      this.logger.error('Failed to upload backup to remote', error);
      throw error;
    }
  }
  
  private async cleanupOldBackups(): Promise<void> {
    // In a browser environment, this is a no-op
    // In Node.js, this would list files in the backup directory,
    // sort by date, and delete the oldest ones
    this.logger.info('Cleaning up old backups (mock)');
    
    // Clean local storage backups
    const localStorageKeys = Object.keys(localStorage);
    const backupKeys = localStorageKeys.filter(key => key.startsWith('backup_'));
    
    if (backupKeys.length > this.config.keepLocal) {
      // Sort by timestamp (which is part of the key)
      backupKeys.sort();
      
      // Remove oldest backups
      const keysToRemove = backupKeys.slice(0, backupKeys.length - this.config.keepLocal);
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
    }
  }
  
  async restoreFromBackup(backupPath: string): Promise<void> {
    this.logger.info(`Restoring from backup: ${backupPath}`);
    
    try {
      // In a browser environment, this would load from localStorage
      // In Node.js, this would read from the file system
      const backupData = this.mockReadBackup(backupPath);
      
      if (!backupData) {
        throw new Error('Backup not found or invalid');
      }
      
      // Restore wallet connections
      if (backupData.wallet) {
        await this.walletManager.connect();
      }
      
      // Restore exchange connections and cancel any pending orders
      if (backupData.exchanges && Array.isArray(backupData.exchanges)) {
        for (const exchData of backupData.exchanges) {
          try {
            const exchange = await this.exchangeManager.getExchange(exchData.id);
            await exchange.cancelAllOrders();
            
            // Restore API keys (would need secure storage in a real app)
            // exchange.setCredentials(exchData.apiKey, exchData.secret);
            
            this.logger.info(`Restored exchange: ${exchData.id}`);
          } catch (error) {
            this.logger.error(`Failed to restore exchange ${exchData.id}`, error);
          }
        }
      }
      
      this.logger.info('Restore completed successfully');
    } catch (error) {
      this.logger.error('Failed to restore from backup', error);
      throw error;
    }
  }
  
  private mockReadBackup(backupPath: string): any {
    // In a browser environment, this would read from localStorage
    // The backupPath would be a key or identifier
    
    // For simplicity, assume backupPath is a timestamp
    const backupData = localStorage.getItem(`backup_${backupPath}`);
    
    if (!backupData) {
      return null;
    }
    
    try {
      return JSON.parse(backupData);
    } catch (error) {
      this.logger.error('Failed to parse backup data', error);
      return null;
    }
  }
}
