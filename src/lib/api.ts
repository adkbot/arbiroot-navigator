
// Import interfaces and type definitions
import { ethers } from 'ethers';
import { PriceData, ExchangeInfo } from './types';
import axios from 'axios';

// Apenas as exchanges que têm APIs configuradas
export const exchanges: ExchangeInfo[] = [
  { id: 'binance', name: 'Binance', logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png', active: true },
  { id: 'coinbase', name: 'Coinbase', logo: 'https://cryptologos.cc/logos/coinbase-coin-logo.png', active: true },
  { id: 'kraken', name: 'Kraken', logo: 'https://cryptologos.cc/logos/kraken-logo.png', active: true },
  { id: 'kucoin', name: 'KuCoin', logo: 'https://cryptologos.cc/logos/kucoin-token-kcs-logo.png', active: true },
  { id: 'huobi', name: 'Huobi', logo: 'https://cryptologos.cc/logos/huobi-token-ht-logo.png', active: true },
  { id: 'bitfinex', name: 'Bitfinex', logo: 'https://cryptologos.cc/logos/bitfinex-logo.png', active: true },
  { id: 'bitstamp', name: 'Bitstamp', logo: 'https://cryptologos.cc/logos/bitstamp-logo.png', active: true },
  { id: 'okx', name: 'OKX', logo: 'https://cryptologos.cc/logos/okb-okb-logo.png', active: true },
  { id: 'gate', name: 'Gate.io', logo: 'https://cryptologos.cc/logos/gate-logo.png', active: true },
  { id: 'bittrex', name: 'Bittrex', logo: 'https://cryptologos.cc/logos/bittrex-logo.png', active: true },
];

// APIs endpoints fornecidas pelo usuário
const exchangeApis = {
  binance: {
    url: 'https://api.binance.com/api/v3/ticker/price?symbol={}',
    private: true
  },
  coinbase: {
    url: 'https://api.pro.coinbase.com/products/{}/ticker',
    private: false
  },
  kraken: {
    url: 'https://api.kraken.com/0/public/Ticker?pair={}',
    private: false
  },
  bitfinex: {
    url: 'https://api-pub.bitfinex.com/v2/ticker/t{}',
    private: false
  },
  huobi: {
    url: 'https://api.huobi.pro/market/detail/merged?symbol={}',
    private: false
  },
  bitstamp: {
    url: 'https://www.bitstamp.net/api/v2/ticker/{}',
    private: false
  },
  kucoin: {
    url: 'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol={}',
    private: false
  },
  okx: {
    url: 'https://www.okx.com/api/v5/market/ticker?instId={}',
    private: false
  },
  gate: {
    url: 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair={}',
    private: false
  },
  bittrex: {
    url: 'https://api.bittrex.com/v3/markets/{}/ticker',
    private: false
  }
};

// Pares de negociação populares (dados reais)
export const tradingPairs = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT',
];

// Função auxiliar para adaptar o formato do par conforme cada exchange
function convertSymbolForExchange(exchangeId: string, pair: string): string {
  const normalizedPair = pair.replace('/', '');
  
  switch (exchangeId) {
    case 'kraken':
      return pair.replace('BTC', 'XBT').replace('/', '');
    case 'coinbase':
      return pair.replace('/', '-');
    case 'bitfinex':
      return normalizedPair;
    case 'huobi':
      return normalizedPair.toLowerCase();
    case 'kucoin':
      return pair.replace('/', '-');
    case 'gate':
      return pair;  // Gate.io uses original format with "/"
    default:
      return normalizedPair;
  }
}

// Fetch price data from real public APIs
export async function fetchPrices(): Promise<PriceData[]> {
  console.log("Fetching real price data using public APIs...");
  const prices: PriceData[] = [];
  const now = Date.now();
  
  // Array of promises to fetch data from multiple exchanges in parallel
  const fetchPromises = exchanges
    .filter(ex => ex.active)
    .map(async (exchange) => {
      try {
        const exchangeId = exchange.id;
        console.log(`Fetching prices from ${exchange.name}...`);
        
        // Get appropriate API config
        const apiConfig = exchangeApis[exchangeId as keyof typeof exchangeApis];
        if (!apiConfig) {
          console.warn(`No API configuration for ${exchangeId}`);
          return [];
        }
        
        const exchangePrices: PriceData[] = [];
        
        // For each trading pair, fetch the price
        for (const pair of tradingPairs) {
          try {
            const symbol = convertSymbolForExchange(exchangeId, pair);
            const apiUrl = apiConfig.url.replace('{}', symbol);
            
            const response = await axios.get(apiUrl);
            let price = 0;
            let volume = 0;
            
            // Extract price based on exchange-specific response format
            switch (exchangeId) {
              case 'binance':
                price = parseFloat(response.data.price);
                break;
              case 'coinbase':
                price = parseFloat(response.data.price);
                volume = parseFloat(response.data.volume);
                break;
              case 'kraken':
                // Extract first result pair
                const firstPair = Object.keys(response.data.result)[0];
                price = parseFloat(response.data.result[firstPair].c[0]);
                volume = parseFloat(response.data.result[firstPair].v[1]);
                break;
              case 'bitfinex':
                price = parseFloat(response.data[6]); // Last price
                volume = parseFloat(response.data[7]); // Volume
                break;
              case 'huobi':
                price = parseFloat(response.data.tick.close);
                volume = parseFloat(response.data.tick.amount);
                break;
              case 'bitstamp':
                price = parseFloat(response.data.last);
                volume = parseFloat(response.data.volume);
                break;
              case 'kucoin':
                price = parseFloat(response.data.data.price);
                break;
              case 'okx':
                price = parseFloat(response.data.data[0].last);
                volume = parseFloat(response.data.data[0].vol24h);
                break;
              case 'gate':
                const ticker = response.data.find((t: any) => t.currency_pair === symbol);
                price = ticker ? parseFloat(ticker.last) : 0;
                volume = ticker ? parseFloat(ticker.base_volume) : 0;
                break;
              case 'bittrex':
                price = parseFloat(response.data.lastTradeRate);
                volume = parseFloat(response.data.volume);
                break;
            }
            
            if (price > 0) {
              exchangePrices.push({
                symbol: pair,
                exchange: exchangeId,
                price,
                timestamp: now,
                volume: volume || 0
              });
            }
          } catch (pairError) {
            console.log(`Error fetching ${pair} from ${exchangeId}: ${pairError}`);
            // Continue to next pair
          }
        }
        
        return exchangePrices;
      } catch (exchangeError) {
        console.error(`Error fetching data from ${exchange.name}:`, exchangeError);
        return [];
      }
    });
  
  try {
    // Wait for all exchange data fetches to complete
    const results = await Promise.all(fetchPromises);
    
    // Flatten array of arrays
    const allPrices = results.flat();
    
    console.log(`Fetched ${allPrices.length} price points from ${exchanges.length} exchanges`);
    return allPrices;
  } catch (error) {
    console.error("Error fetching price data:", error);
    return [];
  }
}

// --- Wallet balance functions using real APIs ---

export async function fetchWalletBalances(address: string) {
  if (!address || !address.startsWith('0x')) {
    console.error("Invalid wallet address format");
    return { native: 0, usdt: 0 };
  }
  
  try {
    // For Polygon mainnet
    const polygonRpcUrl = "https://polygon-rpc.com";
    const provider = new ethers.providers.JsonRpcProvider(polygonRpcUrl);
    
    // USDT contract on Polygon
    const usdtContractAddress = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
    const erc20Abi = [
      "function balanceOf(address) view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    
    // Fetch native MATIC balance
    const maticBalance = await provider.getBalance(address);
    const maticAmount = parseFloat(ethers.utils.formatEther(maticBalance));
    
    // Fetch USDT balance
    const usdtContract = new ethers.Contract(usdtContractAddress, erc20Abi, provider);
    const usdtBalance = await usdtContract.balanceOf(address);
    const usdtDecimals = await usdtContract.decimals();
    const usdtAmount = parseFloat(ethers.utils.formatUnits(usdtBalance, usdtDecimals));
    
    return {
      native: maticAmount,
      usdt: usdtAmount
    };
  } catch (error) {
    console.error("Error fetching wallet balances:", error);
    // Return zeros in case of error
    return { native: 0, usdt: 0 };
  }
}

// --- Example of using 0x API for swap quote (real data) ---
export async function fetchSwapQuote(sellToken: string, buyToken: string, sellAmount: string) {
  try {
    const url = `https://api.0x.org/swap/v1/quote?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching 0x quote:", error);
    return null;
  }
}
