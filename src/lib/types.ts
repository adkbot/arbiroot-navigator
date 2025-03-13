
export interface PriceData {
  symbol: string;
  price: number;
  exchange: string;
  timestamp: number;
  volume?: number; // Added to fix TS errors in arbitrage.ts
}

export interface ExchangeInfo {
  id: string;
  name: string;
  logo: string;
  active: boolean;
}

export interface ArbitrageOpportunity {
  id?: string; // Added to fix TS errors in Index.tsx
  type: 'triangular' | 'simple';
  profit: number;
  profitPercentage: number;
  path: string[];
  details: string;
  timestamp: number;
  exchanges: string[];
  minimumRequired?: number; // Added to fix TS errors in arbitrage.ts
}

export interface WalletBalance {
  [currency: string]: number;
}

export type ChainType = 'ethereum' | 'polygon' | 'binance' | 'arbitrum';

// Add WalletInfo interface for WalletBalances.tsx and AuthStatus.tsx
export interface WalletInfo {
  address: string;
  chain: ChainType;
  balance: {
    native: number;
    usdt: number;
    [key: string]: number;
  };
  isConnected: boolean;
  isAuthorized: boolean;
  lastActivity?: number;
}

// Add missing types for arbitrage.ts
export interface ArbitrageSession {
  id: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed';
  profit: number;
  trades: TradeResult[];
}

export interface TradeResult {
  side: string;
  exchange: string;
  symbol: string;
  amount: number;
  price: number;
  fee: number;
}

export interface RiskMetrics {
  slippage: number;
  executionTime: number;
  failureRate: number;
}

export interface LiquidityInfo {
  exchange: string;
  symbol: string;
  bidVolume: number;
  askVolume: number;
  spread: number;
}
