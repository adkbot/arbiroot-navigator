import dotenv from 'dotenv';
import { z } from 'zod';

// Carrega variáveis de ambiente
dotenv.config();

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // Exchanges
  BINANCE_API_KEY: z.string(),
  BINANCE_SECRET: z.string(),
  KUCOIN_API_KEY: z.string(),
  KUCOIN_SECRET: z.string(),
  KUCOIN_PASSPHRASE: z.string(),
  BYBIT_API_KEY: z.string(),
  BYBIT_SECRET: z.string(),
  
  // RPCs
  ETH_RPC_URL: z.string().url(),
  POLYGON_RPC_URL: z.string().url(),
  BSC_RPC_URL: z.string().url(),
  ARBITRUM_RPC_URL: z.string().url(),
  
  // Configurações do Bot
  MIN_PROFIT_PERCENTAGE: z.string().transform(Number).default("0.5"),
  MAX_TRADE_AMOUNT: z.string().transform(Number).default("1000"),
  SLIPPAGE_TOLERANCE: z.string().transform(Number).default("0.1"),
  
  // Alertas
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),
  
  // Database
  MONGODB_URI: z.string().url(),
  
  // Modo de operação
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// Valida e exporta as variáveis de ambiente tipadas
export const env = envSchema.parse(process.env);

// Configurações das exchanges
export const exchangeConfig = {
  binance: {
    apiKey: env.BINANCE_API_KEY,
    secret: env.BINANCE_SECRET,
    rateLimit: {
      requests: 10,
      interval: '1s'
    }
  },
  kucoin: {
    apiKey: env.KUCOIN_API_KEY,
    secret: env.KUCOIN_SECRET,
    password: env.KUCOIN_PASSPHRASE,
    rateLimit: {
      requests: 9,
      interval: '1s'
    }
  },
  bybit: {
    apiKey: env.BYBIT_API_KEY,
    secret: env.BYBIT_SECRET,
    rateLimit: {
      requests: 5,
      interval: '1s'
    }
  }
};

// Configurações das redes blockchain
export const networkConfig = {
  ethereum: {
    rpc: env.ETH_RPC_URL,
    chainId: 1,
    nativeCurrency: 'ETH',
    blockTime: 12
  },
  polygon: {
    rpc: env.POLYGON_RPC_URL,
    chainId: 137,
    nativeCurrency: 'MATIC',
    blockTime: 2
  },
  binance: {
    rpc: env.BSC_RPC_URL,
    chainId: 56,
    nativeCurrency: 'BNB',
    blockTime: 3
  },
  arbitrum: {
    rpc: env.ARBITRUM_RPC_URL,
    chainId: 42161,
    nativeCurrency: 'ETH',
    blockTime: 1
  }
};

// Configurações do bot
export const botConfig = {
  minProfitPercentage: env.MIN_PROFIT_PERCENTAGE,
  maxTradeAmount: env.MAX_TRADE_AMOUNT,
  slippageTolerance: env.SLIPPAGE_TOLERANCE,
  retryAttempts: 3,
  retryDelay: 1000,
  healthCheckInterval: 30000,
  orderTimeout: 60000
};

// Configurações de monitoramento
export const monitoringConfig = {
  profitThresholds: {
    low: 0.1,    // 0.1%
    medium: 0.5,  // 0.5%
    high: 1.0     // 1.0%
  },
  balanceThresholds: {
    critical: 100,   // USDT
    warning: 500,    // USDT
    healthy: 1000    // USDT
  },
  slippageThresholds: {
    max: 1.0,        // 1%
    warning: 0.5     // 0.5%
  },
  errorThresholds: {
    maxConsecutive: 3,
    timeWindow: 300000 // 5 minutos
  }
};

// Configurações de backup
export const backupConfig = {
  interval: 300000,  // 5 minutos
  maxBackups: 24,    // Manter últimas 24 horas
  path: './backups'
};

// Configurações de alertas
export const alertConfig = {
  telegram: env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID ? {
    enabled: true,
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID
  } : { enabled: false },
  discord: env.DISCORD_WEBHOOK_URL ? {
    enabled: true,
    webhookUrl: env.DISCORD_WEBHOOK_URL
  } : { enabled: false },
  email: false // Implementar se necessário
};