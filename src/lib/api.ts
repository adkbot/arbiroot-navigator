
import { PriceData, ExchangeInfo } from './types';

// Mock exchanges data
export const exchanges: ExchangeInfo[] = [
  { id: 'binance', name: 'Binance', logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png', active: true },
  { id: 'coinbase', name: 'Coinbase', logo: 'https://cryptologos.cc/logos/coinbase-coin-logo.png', active: true },
  { id: 'kraken', name: 'Kraken', logo: 'https://cryptologos.cc/logos/kraken-logo.png', active: true },
  { id: 'kucoin', name: 'KuCoin', logo: 'https://cryptologos.cc/logos/kucoin-token-kcs-logo.png', active: true },
  { id: 'ftx', name: 'FTX', logo: 'https://cryptologos.cc/logos/ftx-token-ftt-logo.png', active: true },
  { id: 'huobi', name: 'Huobi', logo: 'https://cryptologos.cc/logos/huobi-token-ht-logo.png', active: true },
  { id: 'bitfinex', name: 'Bitfinex', logo: 'https://cryptologos.cc/logos/bitfinex-logo.png', active: true },
  { id: 'bybit', name: 'Bybit', logo: 'https://cryptologos.cc/logos/bybit-logo.png', active: true },
  { id: 'okx', name: 'OKX', logo: 'https://cryptologos.cc/logos/okb-okb-logo.png', active: true },
  { id: 'gate', name: 'Gate.io', logo: 'https://cryptologos.cc/logos/gate-logo.png', active: true },
];

// Popular trading pairs
export const tradingPairs = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT',
  'ETH/BTC', 'BNB/BTC', 'SOL/BTC', 'ADA/BTC', 'XRP/BTC',
];

// Mock price data generator
export function generateMockPrices(): PriceData[] {
  const prices: PriceData[] = [];
  const now = Date.now();
  
  tradingPairs.forEach(pair => {
    exchanges.forEach(exchange => {
      if (exchange.active) {
        // Generate base price with some randomness
        const basePrice = getBasePriceForPair(pair);
        // Add slight variation per exchange (up to 1.5%)
        const variation = (Math.random() * 3 - 1.5) / 100;
        const price = basePrice * (1 + variation);
        
        prices.push({
          symbol: pair,
          price,
          exchange: exchange.id,
          timestamp: now,
        });
      }
    });
  });
  
  return prices;
}

// Helper function to get a realistic base price for each pair
function getBasePriceForPair(pair: string): number {
  const basePrices: Record<string, number> = {
    'BTC/USDT': 27500,
    'ETH/USDT': 1650,
    'BNB/USDT': 210,
    'ADA/USDT': 0.25,
    'SOL/USDT': 20,
    'XRP/USDT': 0.53,
    'DOT/USDT': 4.1,
    'DOGE/USDT': 0.062,
    'AVAX/USDT': 9.8,
    'MATIC/USDT': 0.55,
    'LINK/USDT': 7.2,
    'UNI/USDT': 4.3,
    'ATOM/USDT': 7.5,
    'LTC/USDT': 63.5,
    'BCH/USDT': 227,
    'ETH/BTC': 0.06,
    'BNB/BTC': 0.0076,
    'SOL/BTC': 0.00073,
    'ADA/BTC': 0.000009,
    'XRP/BTC': 0.000019,
  };
  
  return basePrices[pair] || 1.0;
}

// Simulate fetching prices from API
export async function fetchPrices(): Promise<PriceData[]> {
  // In a real application, this would make actual API calls to exchanges
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(generateMockPrices());
    }, 500);
  });
}
