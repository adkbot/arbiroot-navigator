export interface ExchangeInfo {
  id: string;
  name: string;
  logo: string;
  active: boolean;
}

export interface ExchangeConfig {
  apiKey: string;
  secret: string;
  password?: string;
  rateLimit: {
    requests: number;
    interval: string;
  };
}

export interface PriceData {
  symbol: string;
  price: number;
  exchange: string;
  timestamp: number;
  bid?: number;
  ask?: number;
  volume?: number;
}

export interface TradeResult {
  id: string;
  status: string;
  filled: number;
  remaining: number;
  price: number;
  cost: number;
  timestamp: number;
  fee?: {
    currency: string;
    cost: number;
  };
}

export interface ArbitrageSession {
  id: string;
  startTime: number;
  trades: TradeResult[];
  status: 'pending' | 'executing' | 'completed' | 'failed';
  profitTarget: number;
  currentProfit: number;
  errors?: string[];
}

export type ArbitrageType = 'triangular' | 'simple';

export interface ArbitrageOpportunity {
  id: string;
  type: ArbitrageType;
  profit: number;
  profitPercentage: number;
  path: string[];
  details: string;
  timestamp: number;
  exchanges: string[];
  estimatedFees?: number;
  minimumRequired?: number;
  riskLevel?: 'low' | 'medium' | 'high';
}

export interface ArbitrageParams {
  minProfitPercentage: number;
  maxPathLength: number;
  includeExchanges: string[];
  maxSlippage?: number;
  minLiquidity?: number;
  maxExposure?: number;
}

export interface WalletInfo {
  address: string;
  chain: ChainType;
  balance: {
    usdt: number;
    native: number;
    [key: string]: number;
  };
  isConnected: boolean;
  isAuthorized: boolean;
  nonce?: number;
  lastActivity?: number;
}

export type ChainType = 'ethereum' | 'polygon' | 'binance' | 'arbitrum';

export type OrderType = 'limit' | 'market';

export interface LiquidityInfo {
  symbol: string;
  exchange: string;
  bidVolume: number;
  askVolume: number;
  spread: number;
  depth: number;
  isLiquid: boolean;
}

export interface RiskMetrics {
  volatility: number;
  slippageEstimate: number;
  liquidityScore: number;
  executionRisk: 'low' | 'medium' | 'high';
  maxLoss: number;
}