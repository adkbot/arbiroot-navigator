export interface PriceData {
  symbol: string;
  price: number;
  exchange: string;
  timestamp: number;
}

export interface ExchangeInfo {
  id: string;
  name: string;
  logo: string;
  active: boolean;
}

export interface ArbitrageOpportunity {
  type: 'triangular' | 'simple';
  profit: number;
  profitPercentage: number;
  path: string[];
  details: string;
  timestamp: number;
  exchanges: string[];
}

export interface WalletBalance {
  [currency: string]: number;
}

export type ChainType = 'ethereum' | 'polygon' | 'binance' | 'arbitrum';
