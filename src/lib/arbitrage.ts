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
    ['BTC/USDT', 'BNB/BTC', 'BNB/USDT'],
    ['ETH/USDT', 'BNB/ETH', 'BNB/USDT']
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
    
    // Executa imediatamente a primeira vez
    await this.executeArbitrageLoop();
    
    // Configura o intervalo de execução
    this.executionInterval = setInterval(
      () => this.executeArbitrageLoop(),
      1000 // 1 segundo
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
      // Buscar oportunidades de arbitragem simples e triangular
      const simpleOpportunities = await this.findSimpleArbitrageOpportunities();
      const triangularOpportunities = await this.findTriangularArbitrageOpportunities();
      
      // Combinar e ordenar todas as oportunidades
      const allOpportunities = [...simpleOpportunities, ...triangularOpportunities]
        .filter(opp => this.validateOpportunity(opp))
        .sort((a, b) => b.expectedProfit - a.expectedProfit);

      if (allOpportunities.length > 0) {
        const bestOpportunity = allOpportunities[0];
        this.logger.info(`Oportunidade encontrada: ${bestOpportunity.type} - ${bestOpportunity.expectedProfit}%`);
        await this.executeArbitrage(bestOpportunity);
      }

    } catch (error) {
      this.logger.error(`Erro no loop de arbitragem: ${error.message}`);
    }
  }

  private async findSimpleArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const exchanges = this.exchangeManager.getExchanges();

    for (const pair of this.STABLE_PAIRS) {
      try {
        // Obter preços de todos os exchanges
        const prices = await Promise.all(
          exchanges.map(async exchange => {
            try {
              const ticker = await exchange.fetchTicker(pair);
              return {
                exchange: exchange.name,
                ask: ticker.ask,
                bid: ticker.bid
              };
            } catch (error) {
              this.logger.warn(`Erro ao buscar preço de ${pair} em ${exchange.name}`);
              return null;
            }
          })
        );

        // Filtrar exchanges com erro
        const validPrices = prices.filter(p => p !== null);

        if (validPrices.length < 2) continue;

        // Encontrar melhor compra e venda
        const bestBuy = validPrices.reduce((best, current) => 
          current.ask < best.ask ? current : best
        , validPrices[0]);

        const bestSell = validPrices.reduce((best, current) =>
          current.bid > best.bid ? current : best
        , validPrices[0]);

        // Calcular lucro potencial
        if (bestBuy && bestSell && bestBuy.exchange !== bestSell.exchange) {
          const profit = ((bestSell.bid - bestBuy.ask) / bestBuy.ask) * 100;
          
          if (profit > botConfig.minProfitPercentage) {
            opportunities.push({
              type: 'simple',
              exchanges: [bestBuy.exchange, bestSell.exchange],
              path: [pair, pair],
              expectedProfit: profit,
              requiredBalance: botConfig.maxTradeAmount,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        this.logger.error(`Erro ao processar par ${pair}: ${error.message}`);
      }
    }

    return opportunities;
  }

  private async findTriangularArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const exchanges = this.exchangeManager.getExchanges();
    
    for (const exchange of exchanges) {
      for (const pairs of this.TRIANGULAR_ROUTES) {
        try {
          // Verificar se o exchange suporta todos os pares
          const supported = pairs.every(pair => {
            try {
              return exchange.hasPair(pair);
            } catch {
              return false;
            }
          });

          if (!supported) continue;

          // Buscar order books
          const orderBooks = await Promise.all(
            pairs.map(pair => exchange.fetchOrderBook(pair))
          );

          // Verificar se todos os order books têm profundidade suficiente
          if (!orderBooks.every(book => 
            book && book.asks && book.asks.length > 0 && 
            book.bids && book.bids.length > 0
          )) {
            continue;
          }

          const opportunity = this.calculateTriangularArbitrage(
            exchange.name,
            pairs,
            orderBooks
          );

          if (opportunity) {
            opportunities.push(opportunity);
          }

        } catch (error) {
          this.logger.warn(`Erro ao buscar oportunidades em ${exchange.name}: ${error.message}`);
        }
      }
    }

    return opportunities;
  }

  private calculateTriangularArbitrage(
    exchangeName: string,
    pairs: string[],
    orderBooks: any[]
  ): ArbitrageOpportunity | null {
    try {
      let initialAmount = botConfig.maxTradeAmount;
      let currentAmount = initialAmount;

      // Primeira trade
      const firstRate = orderBooks[0].asks[0][0];
      currentAmount = currentAmount / firstRate;

      // Segunda trade
      const secondRate = orderBooks[1].asks[0][0];
      currentAmount = currentAmount / secondRate;

      // Terceira trade
      const thirdRate = orderBooks[2].bids[0][0];
      currentAmount = currentAmount * thirdRate;

      const profit = ((currentAmount - initialAmount) / initialAmount) * 100;
      const fees = this.calculateTotalFees(exchangeName);
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

  private calculateTotalFees(exchangeName: string): number {
    try {
      const exchange = this.exchangeManager.getExchange(exchangeName);
      const feePerTrade = exchange.getTradingFee();
      return feePerTrade * 3; // 3 trades na arbitragem triangular
    } catch {
      return 0.3; // 0.1% por trade como fallback
    }
  }

  private validateOpportunity(opportunity: ArbitrageOpportunity): boolean {
    try {
      // Verificar lucro mínimo
      if (opportunity.expectedProfit < botConfig.minProfitPercentage) {
        return false;
      }

      // Verificar tempo máximo
      if (Date.now() - opportunity.timestamp > 5000) {
        return false;
      }

      // Verificar saldo
      const balance = this.exchangeManager.getBalance(
        opportunity.exchanges[0],
        'USDT'
      );
      if (balance < opportunity.requiredBalance) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const sessionId = Date.now().toString();
    this.logger.info(`Iniciando execução de arbitragem ${opportunity.type} (${sessionId})`);

    try {
      // Validar novamente antes de executar
      if (!this.validateOpportunity(opportunity)) {
        throw new Error('Oportunidade não é mais válida');
      }

      if (opportunity.type === 'simple') {
        await this.executeSimpleArbitrage(opportunity);
      } else {
        await this.executeTriangularArbitrage(opportunity);
      }

    } catch (error) {
      this.logger.error(`Erro na execução da arbitragem: ${error.message}`);
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
        .createOrder(pair, 'market', 'buy', amount);
      
      await this.waitForTradeConfirmation(buyExchange, buyOrder.id);

      // Vender no exchange mais caro
      const sellOrder = await this.exchangeManager
        .getExchange(sellExchange)
        .createOrder(pair, 'market', 'sell', amount);
      
      await this.waitForTradeConfirmation(sellExchange, sellOrder.id);

      const profit = this.calculateActualProfit([buyOrder, sellOrder]);
      this.logger.info(`Arbitragem simples concluída com sucesso: ${profit}% de lucro`);
    } catch (error) {
      throw new Error(`Erro na arbitragem simples: ${error.message}`);
    }
  }

  private async executeTriangularArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const exchange = this.exchangeManager.getExchange(opportunity.exchanges[0]);
    const trades = [];

    try {
      for (let i = 0; i < opportunity.path.length; i++) {
        const pair = opportunity.path[i];
        const trade = await exchange.createOrder(
          pair,
          'market',
          'buy',
          opportunity.requiredBalance
        );
        trades.push(trade);

        await this.waitForTradeConfirmation(exchange.name, trade.id);
      }

      const profit = this.calculateActualProfit(trades);
      this.logger.info(`Arbitragem triangular concluída com sucesso: ${profit}% de lucro`);
    } catch (error) {
      throw new Error(`Erro na arbitragem triangular: ${error.message}`);
    }
  }

  private async waitForTradeConfirmation(exchangeName: string, tradeId: string): Promise<void> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const trade = await this.exchangeManager
          .getExchange(exchangeName)
          .fetchOrder(tradeId);

        if (trade.status === 'closed') {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      } catch (error) {
        this.logger.warn(`Erro ao verificar trade ${tradeId}: ${error.message}`);
        attempts++;
      }
    }

    throw new Error(`Trade ${tradeId} não confirmado após ${maxAttempts} tentativas`);
  }

  private calculateActualProfit(trades: any[]): number {
    try {
      const initial = trades[0].cost;
      const final = trades[trades.length - 1].cost;
      return ((final - initial) / initial) * 100;
    } catch {
      return 0;
    }
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