import ccxt from 'ccxt';
import { Logger } from '../lib/logger';
import { exchangeConfig } from '../config';

export class ExchangeAPI {
  private exchanges: Map<string, ccxt.Exchange> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeExchanges();
  }

  private initializeExchanges(): void {
    // Binance
    const binance = new ccxt.binance({
      apiKey: exchangeConfig.binance.apiKey,
      secret: exchangeConfig.binance.secret,
      enableRateLimit: true
    });

    // KuCoin
    const kucoin = new ccxt.kucoin({
      apiKey: exchangeConfig.kucoin.apiKey,
      secret: exchangeConfig.kucoin.secret,
      password: exchangeConfig.kucoin.password,
      enableRateLimit: true
    });

    // Bybit
    const bybit = new ccxt.bybit({
      apiKey: exchangeConfig.bybit.apiKey,
      secret: exchangeConfig.bybit.secret,
      enableRateLimit: true
    });

    this.exchanges.set('binance', binance);
    this.exchanges.set('kucoin', kucoin);
    this.exchanges.set('bybit', bybit);
  }

  public getExchange(name: string): ccxt.Exchange {
    const exchange = this.exchanges.get(name.toLowerCase());
    if (!exchange) {
      throw new Error(`Exchange ${name} não encontrado`);
    }
    return exchange;
  }

  public async fetchBalance(exchangeName: string): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.fetchBalance();
  }

  public async fetchOrderBook(exchangeName: string, symbol: string): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.fetchOrderBook(symbol);
  }

  public async createOrder(
    exchangeName: string,
    symbol: string,
    type: string,
    side: string,
    amount: number,
    price?: number
  ): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.createOrder(symbol, type, side, amount, price);
  }

  public async cancelOrder(exchangeName: string, orderId: string, symbol: string): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.cancelOrder(orderId, symbol);
  }

  public async cancelAllOrders(exchangeName: string, symbol?: string): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.cancelAllOrders(symbol);
  }

  public async fetchTrades(exchangeName: string, symbol: string): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.fetchTrades(symbol);
  }

  public async fetchMyTrades(exchangeName: string, symbol?: string): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.fetchMyTrades(symbol);
  }

  public async fetchOpenOrders(exchangeName: string, symbol?: string): Promise<any> {
    const exchange = this.getExchange(exchangeName);
    return await exchange.fetchOpenOrders(symbol);
  }

  public getTradingFee(exchangeName: string, symbol: string): number {
    const exchange = this.getExchange(exchangeName);
    return exchange.markets[symbol]?.taker || 0.001; // Default fee 0.1%
  }
}