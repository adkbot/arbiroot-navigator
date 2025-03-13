
// Import interfaces and type definitions
import { ethers } from 'ethers';
import { PriceData, ExchangeInfo } from './types';
import axios from 'axios';

// Dados reais das exchanges
export const exchanges: ExchangeInfo[] = [
  { id: 'binance', name: 'Binance', logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png', active: true },
  { id: 'coinbase', name: 'Coinbase', logo: 'https://cryptologos.cc/logos/coinbase-coin-logo.png', active: true },
  { id: 'kraken', name: 'Kraken', logo: 'https://cryptologos.cc/logos/kraken-logo.png', active: true },
  { id: 'kucoin', name: 'KuCoin', logo: 'https://cryptologos.cc/logos/kucoin-token-kcs-logo.png', active: true },
  // Removed ftx as it doesn't exist anymore
  { id: 'huobi', name: 'Huobi', logo: 'https://cryptologos.cc/logos/huobi-token-ht-logo.png', active: true },
  { id: 'bitfinex', name: 'Bitfinex', logo: 'https://cryptologos.cc/logos/bitfinex-logo.png', active: true },
  { id: 'bybit', name: 'Bybit', logo: 'https://cryptologos.cc/logos/bybit-logo.png', active: true },
  { id: 'okx', name: 'OKX', logo: 'https://cryptologos.cc/logos/okb-okb-logo.png', active: true },
  { id: 'gate', name: 'Gate.io', logo: 'https://cryptologos.cc/logos/gate-logo.png', active: true },
];

// Pares de negociação populares (dados reais)
export const tradingPairs = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT',
  'ETH/BTC', 'BNB/BTC', 'SOL/BTC', 'ADA/BTC', 'XRP/BTC',
];

// Função auxiliar para adaptar o formato do par conforme cada exchange
function convertSymbolForExchange(exchangeId: string, pair: string): string {
  switch (exchangeId) {
    case 'kraken':
      return pair.replace('BTC', 'XBT').replace('/', '');
    case 'coinbase':
      return pair.replace('/', '-');
    default:
      return pair.replace('/', '');
  }
}

// Fetch price data from real public APIs
export async function fetchPrices(): Promise<PriceData[]> {
  console.log("Fetching real price data...");
  const prices: PriceData[] = [];
  const now = Date.now();
  
  try {
    // Use public APIs that don't require authentication
    const binancePrices = await fetchBinancePrices();
    prices.push(...binancePrices);
    
    // Add more exchanges as needed
    const coinbasePrices = await fetchCoinbasePrices();
    prices.push(...coinbasePrices);
    
    return prices;
  } catch (error) {
    console.error("Error fetching price data:", error);
    return [];
  }
}

async function fetchBinancePrices(): Promise<PriceData[]> {
  try {
    const response = await axios.get('https://api.binance.com/api/v3/ticker/price');
    const prices: PriceData[] = [];
    const now = Date.now();
    
    if (response.data && Array.isArray(response.data)) {
      for (const item of response.data) {
        // Convert Binance symbol format to our format
        const symbol = item.symbol.replace('USDT', '/USDT').replace('BTC', '/BTC');
        
        if (tradingPairs.includes(symbol)) {
          prices.push({
            symbol,
            price: parseFloat(item.price),
            exchange: 'binance',
            timestamp: now,
            volume: 0 // Binance ticker endpoint doesn't provide volume
          });
        }
      }
    }
    
    // Get 24hr statistics for volume
    const statsResponse = await axios.get('https://api.binance.com/api/v3/ticker/24hr');
    if (statsResponse.data && Array.isArray(statsResponse.data)) {
      for (const stat of statsResponse.data) {
        const symbol = stat.symbol.replace('USDT', '/USDT').replace('BTC', '/BTC');
        const existingPriceIndex = prices.findIndex(p => p.symbol === symbol && p.exchange === 'binance');
        
        if (existingPriceIndex !== -1) {
          prices[existingPriceIndex].volume = parseFloat(stat.volume);
        }
      }
    }
    
    return prices;
  } catch (error) {
    console.error("Error fetching Binance prices:", error);
    return [];
  }
}

async function fetchCoinbasePrices(): Promise<PriceData[]> {
  const prices: PriceData[] = [];
  const now = Date.now();
  
  try {
    // Get product list
    const productsResponse = await axios.get('https://api.exchange.coinbase.com/products');
    const products = productsResponse.data;
    
    if (products && Array.isArray(products)) {
      const relevantProducts = products.filter(p => {
        const symbol = `${p.base_currency}/${p.quote_currency}`;
        return tradingPairs.includes(symbol);
      });
      
      // Fetch prices for each product
      for (const product of relevantProducts) {
        try {
          const tickerResponse = await axios.get(`https://api.exchange.coinbase.com/products/${product.id}/ticker`);
          const ticker = tickerResponse.data;
          
          if (ticker && ticker.price) {
            const symbol = `${product.base_currency}/${product.quote_currency}`;
            prices.push({
              symbol,
              price: parseFloat(ticker.price),
              exchange: 'coinbase',
              timestamp: now,
              volume: parseFloat(ticker.volume)
            });
          }
        } catch (productError) {
          console.error(`Error fetching Coinbase price for ${product.id}:`, productError);
        }
      }
    }
    
    return prices;
  } catch (error) {
    console.error("Error fetching Coinbase prices:", error);
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

// --- Exemplo de uso da API 0x para obter cotação de swap (dados reais) ---
export async function fetchSwapQuote(sellToken: string, buyToken: string, sellAmount: string) {
  try {
    const url = `https://api.0x.org/swap/v1/quote?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Erro ao buscar cotação 0x:", error);
    return null;
  }
}
