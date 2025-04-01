
// Exchange utilities using CCXT for real-time data
import { ethers } from 'ethers';
import { PriceData, LiquidityInfo } from './types';
import axios from 'axios';
import * as ccxt from 'ccxt';

// Defining the type of window with ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

export interface TradeResult {
  side: string;
  exchange: string;
  symbol: string;
  amount: number;
  price: number;
  fee: number;
}

// Helper function to safely access environment variables in browser context
const getEnvVar = (name: string, defaultValue: string = ''): string => {
  // In browser context, import.meta.env is available instead of process.env
  return (import.meta.env && import.meta.env[name]) || defaultValue;
};

export class ExchangeManager {
  private exchanges: Record<string, ccxt.Exchange>;
  private apiKeys: Record<string, { apiKey: string, secret: string, passphrase?: string }>;
  
  constructor() {
    // Initialize exchange connections
    this.exchanges = {};
    this.apiKeys = {
      binance: {
        apiKey: getEnvVar('VITE_BINANCE_API_KEY', ''),
        secret: getEnvVar('VITE_BINANCE_SECRET', '')
      },
      kucoin: {
        apiKey: getEnvVar('VITE_KUCOIN_API_KEY', ''),
        secret: getEnvVar('VITE_KUCOIN_SECRET', ''),
        passphrase: getEnvVar('VITE_KUCOIN_PASSPHRASE', '')
      },
      bybit: {
        apiKey: getEnvVar('VITE_BYBIT_API_KEY', ''),
        secret: getEnvVar('VITE_BYBIT_SECRET', '')
      }
    };
    
    // Initialize exchange connections using CCXT
    this.initializeExchanges();
  }
  
  private initializeExchanges() {
    try {
      // Initialize supported exchanges with CCXT
      const supportedExchanges = ['binance', 'coinbase', 'kraken', 'kucoin', 'huobi', 'okx'];
      
      for (const exchangeId of supportedExchanges) {
        if (ccxt[exchangeId as keyof typeof ccxt]) {
          const exchangeClass = ccxt[exchangeId as keyof typeof ccxt];
          
          // Configure with API keys if available
          const config: any = { 
            enableRateLimit: true,
            timeout: 30000
          };
          
          if (this.apiKeys[exchangeId]) {
            config.apiKey = this.apiKeys[exchangeId].apiKey;
            config.secret = this.apiKeys[exchangeId].secret;
            
            if (this.apiKeys[exchangeId].passphrase) {
              config.password = this.apiKeys[exchangeId].passphrase;
            }
          }
          
          this.exchanges[exchangeId] = new exchangeClass(config);
          console.log(`Inicializada exchange ${exchangeId} com CCXT`);
        }
      }
      
      console.log("Exchanges inicializadas com sucesso:", Object.keys(this.exchanges));
    } catch (error) {
      console.error("Falha ao inicializar exchanges:", error);
    }
  }
  
  // Verify actual arbitrage result
  async verifyArbitrageResult(trades: TradeResult[]) {
    if (!trades || trades.length === 0) return false;
    
    try {
      // Check all trades were executed successfully
      const allSuccessful = trades.every(trade => trade.price > 0 && trade.amount > 0);
      
      // Calculate total profit from the trades
      let profit = 0;
      let cost = 0;
      
      for (const trade of trades) {
        if (trade.side === 'buy') {
          cost += trade.amount * trade.price * (1 + trade.fee / 100);
        } else {
          profit += trade.amount * trade.price * (1 - trade.fee / 100);
        }
      }
      
      const netProfit = profit - cost;
      console.log(`Resultado da arbitragem verificado: ${netProfit > 0 ? 'Lucrativa' : 'Não lucrativa'}, Lucro: ${netProfit.toFixed(2)}`);
      
      return netProfit > 0 && allSuccessful;
    } catch (error) {
      console.error("Erro ao verificar resultado da arbitragem:", error);
      return false;
    }
  }
  
  async fetchBalance(exchange: string, symbol: string) {
    try {
      const exchangeApi = this.exchanges[exchange];
      
      if (!exchangeApi) {
        throw new Error(`Sem acesso à API para ${exchange}`);
      }
      
      // Use CCXT to fetch balance
      const balances = await exchangeApi.fetchBalance();
      
      if (balances && balances.total) {
        return balances.total[symbol] || 0;
      }
      
      return 0;
    } catch (error) {
      console.error(`Erro ao buscar saldo de ${symbol} em ${exchange}:`, error);
      return 0;
    }
  }
  
  async checkLiquidity(exchange: string, symbol: string, amount: number): Promise<LiquidityInfo> {
    try {
      console.log(`Verificando liquidez para ${symbol} na ${exchange}...`);
      
      const exchangeApi = this.exchanges[exchange];
      
      if (!exchangeApi) {
        throw new Error(`Sem acesso à API para ${exchange}`);
      }
      
      // Fetch order book using CCXT
      const orderBook = await exchangeApi.fetchOrderBook(symbol, 10);
      
      // Calculate available liquidity
      const bidVolume = orderBook.bids.reduce((total, [price, volume]) => total + volume, 0);
      const askVolume = orderBook.asks.reduce((total, [price, volume]) => total + volume, 0);
      
      // Calculate spread
      const bestBid = orderBook.bids[0]?.[0] || 0;
      const bestAsk = orderBook.asks[0]?.[0] || 0;
      const spread = bestBid > 0 ? (bestAsk - bestBid) / bestBid : 0;
      
      console.log(`Liquidez para ${symbol} em ${exchange}: Bid Vol=${bidVolume.toFixed(2)}, Ask Vol=${askVolume.toFixed(2)}, Spread=${(spread * 100).toFixed(4)}%`);
      
      return {
        exchange,
        symbol,
        bidVolume,
        askVolume,
        spread
      };
    } catch (error) {
      console.error(`Erro ao verificar liquidez para ${symbol} em ${exchange}:`, error);
      throw error;
    }
  }
  
  async fetchTicker(exchange: string, symbol: string): Promise<PriceData> {
    try {
      const exchangeApi = this.exchanges[exchange];
      
      if (!exchangeApi) {
        throw new Error(`Sem acesso à API para ${exchange}`);
      }
      
      // Fetch ticker using CCXT
      const ticker = await exchangeApi.fetchTicker(symbol);
      
      return {
        symbol,
        exchange,
        price: ticker.last || 0,
        timestamp: ticker.timestamp || Date.now(),
        volume: ticker.volume || ticker.quoteVolume || 0
      };
    } catch (error) {
      console.error(`Erro ao buscar ticker para ${symbol} em ${exchange}:`, error);
      throw error;
    }
  }
  
  async createOrder(exchange: string, symbol: string, type: string, side: string, amount: number, price?: number): Promise<TradeResult> {
    console.log(`EXECUTANDO ORDEM REAL: ${side} ${amount} ${symbol} em ${exchange} a ${price || 'preço de mercado'}`);
    
    try {
      const exchangeApi = this.exchanges[exchange];
      
      if (!exchangeApi) {
        throw new Error(`Sem acesso à API para ${exchange}`);
      }
      
      // Create order using CCXT
      const order = await exchangeApi.createOrder(symbol, type, side, amount, price);
      
      // Get fee information
      let fee = 0;
      if (order.fee) {
        if (order.fee.rate) {
          fee = order.fee.rate * 100; // Convert to percentage
        } else if (order.fee.cost && order.cost) {
          fee = (order.fee.cost / order.cost) * 100;
        }
      } else {
        fee = this.calculateFee(exchange, amount * (price || order.price || 0));
      }
      
      console.log(`✅ Ordem executada: ${side} ${amount} ${symbol} em ${exchange} ao preço de ${order.price} (taxa: ${fee}%)`);
      
      return {
        side,
        exchange,
        symbol,
        amount: order.amount,
        price: order.price || 0,
        fee
      };
    } catch (error) {
      console.error(`❌ Erro ao criar ordem em ${exchange}:`, error);
      throw error;
    }
  }
  
  private calculateFee(exchange: string, amount: number): number {
    // Use typical fee rates for different exchanges
    const feeRates: Record<string, number> = {
      binance: 0.1, // 0.1%
      coinbase: 0.5, // 0.5%
      kraken: 0.26, // 0.26%
      kucoin: 0.1, // 0.1%
      huobi: 0.2, // 0.2%
      okx: 0.1, // 0.1%
      default: 0.2 // Default fee rate
    };
    
    return feeRates[exchange] || feeRates.default;
  }
  
  async getExchange(id: string) {
    if (!this.exchanges[id]) {
      throw new Error(`Exchange ${id} não encontrada`);
    }
    
    return { 
      id, 
      name: id.charAt(0).toUpperCase() + id.slice(1),
      cancelAllOrders: async (symbol: string) => {
        try {
          return await this.exchanges[id].cancelAllOrders(symbol);
        } catch (error) {
          console.error(`Erro ao cancelar ordens em ${id}:`, error);
          throw error;
        }
      },
      createOrder: async (symbol: string, type: string, side: string, amount: number, price?: number) => 
        this.createOrder(id, symbol, type, side, amount, price)
    };
  }
  
  async fetchOrderBook(exchange: string, symbol: string) {
    try {
      console.log(`Buscando livro de ordens para ${symbol} em ${exchange}...`);
      
      const exchangeApi = this.exchanges[exchange];
      
      if (!exchangeApi) {
        throw new Error(`Sem acesso à API para ${exchange}`);
      }
      
      // Fetch order book using CCXT
      return await exchangeApi.fetchOrderBook(symbol, 10);
    } catch (error) {
      console.error(`Erro ao buscar livro de ordens para ${symbol} em ${exchange}:`, error);
      throw error;
    }
  }
  
  async getExchanges() {
    return Object.keys(this.exchanges).map(id => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      hasPrivateAPI: Boolean(this.apiKeys[id]?.apiKey)
    }));
  }
  
  async getPendingTrades(exchange?: string) {
    try {
      if (exchange) {
        const exchangeApi = this.exchanges[exchange];
        if (!exchangeApi) {
          throw new Error(`Exchange ${exchange} não encontrada`);
        }
        return await exchangeApi.fetchOpenOrders();
      }
      
      // Fetch from all exchanges
      const allOrders: any[] = [];
      for (const [id, api] of Object.entries(this.exchanges)) {
        try {
          if (api.has['fetchOpenOrders']) {
            const orders = await api.fetchOpenOrders();
            allOrders.push(...orders.map(order => ({ ...order, exchange: id })));
          }
        } catch (error) {
          console.error(`Erro ao buscar ordens abertas em ${id}:`, error);
        }
      }
      
      return allOrders;
    } catch (error) {
      console.error("Erro ao buscar trades pendentes:", error);
      return [];
    }
  }
  
  async getCompletedTrades(exchange?: string, symbol?: string, limit: number = 10) {
    try {
      if (exchange) {
        const exchangeApi = this.exchanges[exchange];
        if (!exchangeApi) {
          throw new Error(`Exchange ${exchange} não encontrada`);
        }
        return await exchangeApi.fetchMyTrades(symbol, undefined, limit);
      }
      
      // Fetch from all exchanges
      const allTrades: any[] = [];
      for (const [id, api] of Object.entries(this.exchanges)) {
        try {
          if (api.has['fetchMyTrades']) {
            const trades = await api.fetchMyTrades(symbol, undefined, limit);
            allTrades.push(...trades.map(trade => ({ ...trade, exchange: id })));
          }
        } catch (error) {
          console.error(`Erro ao buscar trades completos em ${id}:`, error);
        }
      }
      
      return allTrades.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    } catch (error) {
      console.error("Erro ao buscar trades completos:", error);
      return [];
    }
  }
}

export class WalletManager {
  private provider: ethers.providers.Provider;
  private signer: ethers.Signer | null = null;
  
  constructor() {
    // Use a provider that matches the current chain
    this.provider = new ethers.providers.JsonRpcProvider(import.meta.env.VITE_POLYGON_RPC_URL || "https://polygon-rpc.com");
  }
  
  async connectWallet(address: string, chain: string) {
    try {
      // Connect to the wallet using ethers.js
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        this.signer = provider.getSigner();
        
        // Ensure we're on the correct network
        const network = await provider.getNetwork();
        const chainIds: Record<string, number> = {
          ethereum: 1,
          polygon: 137,
          binance: 56,
          arbitrum: 42161
        };
        
        // Switch network if needed
        if (chainIds[chain] && network.chainId !== chainIds[chain]) {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: `0x${chainIds[chain].toString(16)}` }],
            });
          } catch (switchError: any) {
            console.error("Error switching chains:", switchError);
          }
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error("Falha ao conectar carteira:", error);
      return false;
    }
  }
  
  // Required by backup.ts and monitoring.ts
  async getConnectedNetworks() {
    return ['polygon'];
  }
  
  async getAddress() {
    if (!this.signer) return null;
    try {
      return await this.signer.getAddress();
    } catch (error) {
      console.error("Falha ao obter endereço:", error);
      return null;
    }
  }
  
  async getBalance(address?: string) {
    try {
      const addr = address || await this.getAddress();
      if (!addr) return { native: 0, usdt: 0 };
      
      // Get native token balance
      const balance = await this.provider.getBalance(addr);
      const nativeBalance = parseFloat(ethers.utils.formatEther(balance));
      
      // Get USDT balance using token contract
      const usdtBalance = await this.getTokenBalance(addr, 'polygon', 'USDT');
      
      return { native: nativeBalance, usdt: usdtBalance };
    } catch (error) {
      console.error("Falha ao obter saldo:", error);
      return { native: 0, usdt: 0 };
    }
  }
  
  private async getTokenBalance(address: string, network: string, symbol: string) {
    try {
      // Token contract addresses on different networks
      const tokenAddresses: Record<string, Record<string, string>> = {
        polygon: {
          USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
          USDC: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174'
        },
        ethereum: {
          USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          USDC: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
        },
        binance: {
          USDT: '0x55d398326f99059ff775485246999027b3197955',
          USDC: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
        }
      };
      
      const tokenAddress = tokenAddresses[network]?.[symbol];
      if (!tokenAddress) {
        console.warn(`Endereço do token ${symbol} não encontrado para rede ${network}`);
        return 0;
      }
      
      // Standard ERC20 ABI for balanceOf and decimals
      const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];
      
      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await tokenContract.balanceOf(address);
      const decimals = await tokenContract.decimals();
      
      return parseFloat(ethers.utils.formatUnits(balance, decimals));
    } catch (error) {
      console.error(`Falha ao obter saldo de ${symbol}:`, error);
      return 0;
    }
  }
  
  async getAllBalances() {
    const address = await this.getAddress();
    if (!address) return { native: 0, usdt: 0 };
    return this.getBalance(address);
  }
  
  async getTokenBalances(address: string, network: string) {
    try {
      const nativeBalance = await this.provider.getBalance(address);
      const nativeAmount = parseFloat(ethers.utils.formatEther(nativeBalance));
      
      // Get USDT balance
      const usdtAmount = await this.getTokenBalance(address, network, 'USDT');
      
      return { 
        native: nativeAmount, 
        usdt: usdtAmount 
      };
    } catch (error) {
      console.error(`Erro ao obter saldos de tokens para ${address} na rede ${network}:`, error);
      return { native: 0, usdt: 0 };
    }
  }
  
  async connect() {
    return this.connectWallet("", "polygon");
  }
}

export class ArbitrageExecutor {
  private exchangeManager: ExchangeManager;
  
  constructor() {
    this.exchangeManager = new ExchangeManager();
  }
  
  async executeArbitrage(opportunity: any) {
    try {
      console.log("Executando arbitragem:", opportunity);
      
      // Execute trades on the exchanges
      const trades = [];
      const exchanges = opportunity.exchanges;
      const symbol = opportunity.path[0];
      
      // For simple arbitrage between two exchanges
      if (exchanges.length === 2) {
        // Buy on the first exchange (lower price)
        const buyExchange = exchanges[0];
        const buyAmount = opportunity.minimumRequired / opportunity.profitPercentage;
        
        const buy = await this.exchangeManager.createOrder(
          buyExchange, 
          symbol, 
          'limit', 
          'buy', 
          buyAmount
        );
        
        // Sell on the second exchange (higher price)
        const sellExchange = exchanges[1];
        const sell = await this.exchangeManager.createOrder(
          sellExchange,
          symbol,
          'limit',
          'sell',
          buyAmount
        );
        
        trades.push(buy, sell);
      }
      
      // Verify the result
      const success = await this.verifyArbitrageResult(trades);
      return success;
    } catch (error) {
      console.error("Erro ao executar arbitragem:", error);
      return false;
    }
  }
  
  async verifyArbitrageResult(result: any) {
    return this.exchangeManager.verifyArbitrageResult(result);
  }
}
