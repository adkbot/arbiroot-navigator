import { Logger } from './logger';
import { ExchangeManager } from './exchange';
import { WalletManager } from './wallet';
import { AlertManager } from './alert';
import { botConfig } from '../config';

interface ArbitrageOpportunity {
  type: 'simple' | 'triangular';
  exchanges: string[];
  path: string[];
  expectedProfit: number;
  requiredBalance: number;
  timestamp: number;
}

export class ArbitrageExecutor {
  private logger: Logger;
  private exchangeManager: ExchangeManager;
  private walletManager: WalletManager;
  private alertManager: AlertManager;
  private isRunning: boolean = false;
  private executionInterval: NodeJS.Timeout | null = null;

  // Pares mais líquidos e confiáveis
  private readonly STABLE_PAIRS = [
    'BTC/USDT',
    'ETH/USDT',
    'BNB/USDT',
    'ETH/BTC',
    'BNB/BTC'
  ];

  // Configurações de arbitragem triangular
  private readonly TRIANGULAR_ROUTES = [
    ['BTC/USDT', 'ETH/BTC', 'ETH/USDT'],
    ['BTC/USDT', 'BNB/BTC', 'BNB/USDT']
  ];

  constructor(
    logger: Logger,
    exchangeManager: ExchangeManager,
    walletManager: WalletManager,
    alertManager: AlertManager
  ) {
    this.logger = logger;
    this.exchangeManager = exchangeManager;
    this.walletManager = walletManager;
    this.alertManager = alertManager;
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Sistema de arbitragem já está em execução');
      return;
    }

    this.isRunning = true;
    this.logger.info('Iniciando sistema de arbitragem');
    
    // Iniciar loop de execução
    this.executeArbitrageLoop();
    this.executionInterval = setInterval(
      () => this.executeArbitrageLoop(),
      2000 // Verificar a cada 2 segundos para evitar rate limits
    );
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
    
    this.logger.info('Sistema de arbitragem parado');
  }

  private async executeArbitrageLoop(): Promise<void> {
    try {
      // Verificar arbitragem simples primeiro (geralmente mais segura)
      const simpleOpportunities = await this.findSimpleArbitrageOpportunities();
      if (simpleOpportunities.length > 0) {
        const bestSimple = simpleOpportunities[0];
        if (bestSimple.expectedProfit >= botConfig.minProfitPercentage) {
          await this.executeArbitrage(bestSimple);
          return;
        }
      }

      // Se não encontrar arbitragem simples, tentar triangular
      const triangularOpportunities = await this.findTriangularArbitrageOpportunities();
      if (triangularOpportunities.length > 0) {
        const bestTriangular = triangularOpportunities[0];
        if (bestTriangular.expectedProfit >= botConfig.minProfitPercentage) {
          await this.executeArbitrage(bestTriangular);
        }
      }

    } catch (error) {
      this.logger.error(`Erro no loop de arbitragem: ${error.message}`);
    }
  }

  private async findSimpleArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    
    for (const pair of this.STABLE_PAIRS) {
      try {
        // Obter preços apenas das exchanges ativas
        const exchanges = this.exchangeManager.getActiveExchanges();
        const prices = await Promise.all(
          exchanges.map(async exchange => {
            try {
              const ticker = await exchange.fetchTicker(pair);
              return {
                exchange: exchange.name,
                ask: ticker.ask,
                bid: ticker.bid,
                timestamp: ticker.timestamp
              };
            } catch {
              return null;
            }
          })
        );

        // Filtrar preços válidos
        const validPrices = prices.filter(p => p !== null && p.ask && p.bid);
        
        if (validPrices.length < 2) continue;

        // Encontrar melhor oportunidade
        const bestBuy = validPrices.reduce((a, b) => a.ask < b.ask ? a : b);
        const bestSell = validPrices.reduce((a, b) => a.bid > b.bid ? a : b);

        if (bestBuy.exchange === bestSell.exchange) continue;

        const profit = ((bestSell.bid - bestBuy.ask) / bestBuy.ask) * 100;
        
        if (profit > botConfig.minProfitPercentage) {
          opportunities.push({
            type: 'simple',
            exchanges: [bestBuy.exchange, bestSell.exchange],
            path: [pair],
            expectedProfit: profit,
            requiredBalance: botConfig.maxTradeAmount,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        this.logger.error(`Erro ao buscar preços para ${pair}: ${error.message}`);
      }
    }

    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }

  private async findTriangularArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const exchanges = this.exchangeManager.getActiveExchanges();

    for (const exchange of exchanges) {
      for (const route of this.TRIANGULAR_ROUTES) {
        try {
          // Verificar se todos os pares estão disponíveis
          const hasAllPairs = route.every(pair => exchange.hasPair(pair));
          if (!hasAllPairs) continue;

          // Obter order books
          const orderBooks = await Promise.all(
            route.map(pair => exchange.fetchOrderBook(pair, 1))
          );

          // Verificar se todos os order books são válidos
          if (orderBooks.some(book => !book || !book.asks || !book.bids)) {
            continue;
          }

          const opportunity = this.calculateTriangularArbitrage(
            exchange.name,
            route,
            orderBooks
          );

          if (opportunity) {
            opportunities.push(opportunity);
          }

        } catch (error) {
          this.logger.error(`Erro na rota triangular ${exchange.name}: ${error.message}`);
        }
      }
    }

    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }

  private calculateTriangularArbitrage(
    exchangeName: string,
    pairs: string[],
    orderBooks: any[]
  ): ArbitrageOpportunity | null {
    try {
      let initialAmount = botConfig.maxTradeAmount;
      let currentAmount = initialAmount;

      // Primeira trade (USDT -> BTC)
      const firstAsk = orderBooks[0].asks[0][0];
      if (!firstAsk) return null;
      currentAmount = currentAmount / firstAsk;

      // Segunda trade (BTC -> ETH/BNB)
      const secondAsk = orderBooks[1].asks[0][0];
      if (!secondAsk) return null;
      currentAmount = currentAmount / secondAsk;

      // Terceira trade (ETH/BNB -> USDT)
      const thirdBid = orderBooks[2].bids[0][0];
      if (!thirdBid) return null;
      currentAmount = currentAmount * thirdBid;

      const profit = ((currentAmount - initialAmount) / initialAmount) * 100;
      const fees = this.calculateFees(exchangeName, 3); // 3 trades
      const netProfit = profit - fees;

      if (netProfit > botConfig.minProfitPercentage) {
        return {
          type: 'triangular',
          exchanges: [exchangeName],
          path: pairs,
          expectedProfit: netProfit,
          requiredBalance: initialAmount,
          timestamp: Date.now()
        };
      }

      return null;

    } catch (error) {
      this.logger.error(`Erro ao calcular arbitragem triangular: ${error.message}`);
      return null;
    }
  }

  private calculateFees(exchangeName: string, numTrades: number): number {
    const exchange = this.exchangeManager.getExchange(exchangeName);
    const feePerTrade = exchange.getTradingFee();
    return feePerTrade * numTrades;
  }

  private async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const sessionId = Date.now().toString();
    this.logger.info(`Iniciando ${opportunity.type} (${sessionId}) - Lucro esperado: ${opportunity.expectedProfit.toFixed(2)}%`);

    try {
      if (opportunity.type === 'simple') {
        await this.executeSimpleArbitrage(opportunity);
      } else {
        await this.executeTriangularArbitrage(opportunity);
      }

    } catch (error) {
      this.logger.error(`Erro na execução: ${error.message}`);
      await this.rollbackTrades(opportunity.exchanges[0], sessionId);
    }
  }

  private async executeSimpleArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const [buyExchange, sellExchange] = opportunity.exchanges;
    const pair = opportunity.path[0];
    const amount = opportunity.requiredBalance;

    try {
      // Comprar no exchange mais barato
      const buyOrder = await this.exchangeManager
        .getExchange(buyExchange)
        .createMarketBuyOrder(pair, amount);
      
      await this.waitForTradeConfirmation(buyExchange, buyOrder.id);
      
      // Transferir se necessário (implementar depois)
      
      // Vender no exchange mais caro
      const sellOrder = await this.exchangeManager
        .getExchange(sellExchange)
        .createMarketSellOrder(pair, amount);
      
      await this.waitForTradeConfirmation(sellExchange, sellOrder.id);

      const profit = this.calculateActualProfit([buyOrder, sellOrder]);
      this.logger.info(`Arbitragem simples concluída: ${profit.toFixed(2)}% de lucro`);

    } catch (error) {
      throw new Error(`Falha na arbitragem simples: ${error.message}`);
    }
  }

  private async executeTriangularArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const exchange = this.exchangeManager.getExchange(opportunity.exchanges[0]);
    const trades = [];

    try {
      for (let i = 0; i < opportunity.path.length; i++) {
        const pair = opportunity.path[i];
        const side = i < 2 ? 'buy' : 'sell';
        const amount = opportunity.requiredBalance;

        const order = await exchange.createMarketOrder(pair, side, amount);
        trades.push(order);

        await this.waitForTradeConfirmation(exchange.name, order.id);
      }

      const profit = this.calculateActualProfit(trades);
      this.logger.info(`Arbitragem triangular concluída: ${profit.toFixed(2)}% de lucro`);

    } catch (error) {
      throw new Error(`Falha na arbitragem triangular: ${error.message}`);
    }
  }

  private async waitForTradeConfirmation(exchangeName: string, orderId: string): Promise<void> {
    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const order = await this.exchangeManager
          .getExchange(exchangeName)
          .fetchOrder(orderId);

        if (order.status === 'closed') {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

      } catch (error) {
        this.logger.error(`Erro ao verificar ordem ${orderId}: ${error.message}`);
        attempts++;
      }
    }

    throw new Error(`Ordem ${orderId} não confirmada após ${maxAttempts} tentativas`);
  }

  private calculateActualProfit(trades: any[]): number {
    const initial = trades[0].cost;
    const final = trades[trades.length - 1].cost;
    return ((final - initial) / initial) * 100;
  }

  private async rollbackTrades(exchangeName: string, sessionId: string): Promise<void> {
    try {
      const exchange = this.exchangeManager.getExchange(exchangeName);
      await exchange.cancelAllOrders();
      this.logger.info(`Trades revertidos para sessão ${sessionId}`);
    } catch (error) {
      this.logger.error(`Erro ao reverter trades: ${error.message}`);
    }
  }
}