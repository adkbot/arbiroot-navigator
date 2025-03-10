
export interface ExchangeInfo {
  id: string;
  name: string;
  logo: string;
  active: boolean;
}

export interface PriceData {
  symbol: string;
  price: number;
  exchange: string;
  timestamp: number;
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
}

export interface ArbitrageParams {
  minProfitPercentage: number;
  maxPathLength: number;
  includeExchanges: string[];
}
