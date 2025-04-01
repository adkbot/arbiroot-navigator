// Import interfaces and type definitions
import { ethers } from 'ethers';
import { PriceData, ExchangeInfo } from './types';
import axios from 'axios';

// Import specific exchanges instead of the whole module
import { binance, coinbase, kraken, kucoin, huobi, okx } from 'ccxt';

// Exchanges with APIs configured and supported by CCXT
export const exchanges: ExchangeInfo[] = [
  { id: 'binance', name: 'Binance', logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png', active: true },
  { id: 'coinbase', name: 'Coinbase', logo: 'https://cryptologos.cc/logos/coinbase-coin-logo.png', active: true },
  { id: 'kraken', name: 'Kraken', logo: 'https://cryptologos.cc/logos/kraken-logo.png', active: true },
  { id: 'kucoin', name: 'KuCoin', logo: 'https://cryptologos.cc/logos/kucoin-token-kcs-logo.png', active: true },
  { id: 'huobi', name: 'Huobi', logo: 'https://cryptologos.cc/logos/huobi-token-ht-logo.png', active: true },
  { id: 'okx', name: 'OKX', logo: 'https://cryptologos.cc/logos/okb-okb-logo.png', active: true },
];

// Popular trading pairs (real data)
export const tradingPairs = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT',
];

// CCXT exchange instances
const exchangeInstances: Record<string, any> = {};

// Map of exchange constructors
const exchangeClasses: Record<string, any> = {
  binance,
  coinbase,
  kraken,
  kucoin,
  huobi,
  okx
};

// Initialize CCXT exchanges
function initializeCCXTExchanges() {
  try {
    exchanges.forEach(exchange => {
      if (exchangeClasses[exchange.id]) {
        exchangeInstances[exchange.id] = new exchangeClasses[exchange.id]({
          enableRateLimit: true,
          timeout: 30000,
        });
        console.log(`Inicializada instância CCXT para ${exchange.name}`);
      } else {
        console.warn(`Exchange ${exchange.id} não suportada pelo CCXT`);
      }
    });
  } catch (error) {
    console.error("Erro ao inicializar exchanges CCXT:", error);
  }
}

// Initialize instances on load
initializeCCXTExchanges();

// Fetch price data using CCXT for real-time data
export async function fetchPrices(): Promise<PriceData[]> {
  console.log("Obtendo dados de preço em tempo real usando CCXT...");
  const prices: PriceData[] = [];
  const now = Date.now();
  
  // Array of promises to fetch data from multiple exchanges in parallel
  const fetchPromises = exchanges
    .filter(ex => ex.active && exchangeInstances[ex.id])
    .map(async (exchange) => {
      try {
        const exchangeId = exchange.id;
        const exchangeInstance = exchangeInstances[exchangeId];
        console.log(`Obtendo preços da ${exchange.name} usando CCXT...`);
        
        // Usar fetchTickers para obter vários pares de uma vez
        let tickers;
        
        try {
          // Para exchanges que suportam fetchTickers
          if (exchangeInstance.has['fetchTickers']) {
            const symbols = tradingPairs.map(pair => pair.replace('/', ''));
            tickers = await exchangeInstance.fetchTickers(symbols);
          } 
          // Para exchanges que só suportam fetchTicker individual
          else if (exchangeInstance.has['fetchTicker']) {
            tickers = {};
            for (const pair of tradingPairs) {
              try {
                const ticker = await exchangeInstance.fetchTicker(pair);
                tickers[pair] = ticker;
              } catch (pairError) {
                console.log(`Erro ao buscar ${pair} da ${exchangeId}:`, pairError.message);
              }
            }
          }
          else {
            // Fallback para API REST se CCXT não suportar fetchTickers/fetchTicker
            throw new Error('Exchange não suporta fetchTickers ou fetchTicker');
          }
        } catch (ccxtError) {
          console.warn(`Erro no CCXT para ${exchangeId}, usando API REST como fallback:`, ccxtError.message);
          
          // Fallback usando Axios para APIs REST
          const exchangePrices: PriceData[] = [];
          for (const pair of tradingPairs) {
            try {
              // Tentar obter o ticker específico via API REST
              let symbol = pair.replace('/', '');
              if (exchangeId === 'kraken') symbol = pair.replace('BTC', 'XBT').replace('/', '');
              if (exchangeId === 'coinbase') symbol = pair.replace('/', '-');
              if (exchangeId === 'huobi') symbol = pair.toLowerCase().replace('/', '');
              if (exchangeId === 'kucoin') symbol = pair.replace('/', '-');
              
              const apiUrl = `https://api.${exchangeId}.com/api/v3/ticker/price?symbol=${symbol}`;
              const response = await axios.get(apiUrl, { timeout: 5000 });
              
              if (response.data && response.data.price) {
                exchangePrices.push({
                  symbol: pair,
                  exchange: exchangeId,
                  price: parseFloat(response.data.price),
                  timestamp: now,
                  volume: response.data.volume || 0
                });
              }
            } catch (restError) {
              console.log(`Erro no fallback REST para ${pair} na ${exchangeId}:`, restError.message);
            }
          }
          
          return exchangePrices;
        }
        
        // Processar tickers CCXT e converter para nosso formato
        const exchangePrices: PriceData[] = [];
        for (const pair of tradingPairs) {
          const ticker = tickers[pair];
          if (ticker && ticker.last) {
            exchangePrices.push({
              symbol: pair,
              exchange: exchangeId,
              price: ticker.last,
              timestamp: ticker.timestamp || now,
              volume: ticker.volume || ticker.quoteVolume || 0
            });
          }
        }
        
        return exchangePrices;
      } catch (exchangeError) {
        console.error(`Erro ao buscar dados da ${exchange.name}:`, exchangeError.message);
        return [];
      }
    });
  
  try {
    // Wait for all exchange data fetches to complete
    const results = await Promise.all(fetchPromises);
    
    // Flatten array of arrays
    const allPrices = results.flat();
    
    console.log(`Obtidos ${allPrices.length} pontos de preço de ${exchanges.length} exchanges`);
    return allPrices;
  } catch (error) {
    console.error("Erro ao buscar dados de preço:", error);
    return [];
  }
}

// Classe para gerenciar WebSockets de preços
export class PriceWebSocketManager {
  private sockets: Record<string, WebSocket> = {};
  private callbacks: ((price: PriceData) => void)[] = [];
  
  constructor() {
    this.initializeWebSockets();
  }
  
  initializeWebSockets() {
    // Binance WebSocket
    try {
      const binanceWs = new WebSocket('wss://stream.binance.com:9443/ws');
      
      binanceWs.onopen = () => {
        console.log('Conexão WebSocket com Binance estabelecida');
        const subscribePairs = tradingPairs.map(pair => 
          pair.toLowerCase().replace('/', '').concat('@ticker')
        );
        
        const subscribeMsg = {
          method: "SUBSCRIBE",
          params: subscribePairs,
          id: 1
        };
        
        binanceWs.send(JSON.stringify(subscribeMsg));
      };
      
      binanceWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.s) {
            const symbol = data.s;
            // Converter formato binance para nosso formato padrão
            const normalizedSymbol = symbol.replace(/(.+)(USDT)$/, '$1/$2');
            
            const priceData: PriceData = {
              symbol: normalizedSymbol,
              exchange: 'binance',
              price: parseFloat(data.c),
              timestamp: Date.now(),
              volume: parseFloat(data.v) || 0
            };
            
            // Notificar callbacks
            this.notifyPriceUpdate(priceData);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket Binance:', error);
        }
      };
      
      binanceWs.onerror = (error) => {
        console.error('Erro WebSocket Binance:', error);
      };
      
      this.sockets['binance'] = binanceWs;
    } catch (error) {
      console.error('Erro ao inicializar WebSocket Binance:', error);
    }
  }
  
  subscribe(callback: (price: PriceData) => void): () => void {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }
  
  private notifyPriceUpdate(price: PriceData) {
    this.callbacks.forEach(callback => callback(price));
  }
  
  close() {
    Object.values(this.sockets).forEach(socket => {
      try {
        socket.close();
      } catch (error) {
        console.error('Erro ao fechar WebSocket:', error);
      }
    });
    this.sockets = {};
    this.callbacks = [];
  }
}

// Singleton instance
let webSocketManager: PriceWebSocketManager | null = null;

export function getPriceWebSocketManager(): PriceWebSocketManager {
  if (!webSocketManager) {
    webSocketManager = new PriceWebSocketManager();
  }
  return webSocketManager;
}

// --- Wallet balance functions using real APIs ---

export async function fetchWalletBalances(address: string) {
  if (!address || !address.startsWith('0x')) {
    console.error("Formato de endereço de carteira inválido");
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
    console.error("Erro ao buscar saldos da carteira:", error);
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
    console.error("Erro ao buscar cotação 0x:", error);
    return null;
  }
}
