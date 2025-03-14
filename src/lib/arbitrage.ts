import { Logger } from './logger';
import { ExchangeManager } from './exchange';
import { WalletManager } from './wallet';
import { AlertManager } from './alert';
import { botConfig } from '../config';

interface ArbitrageOpportunity {
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
    this.executionInterval = setInterval(
      () => this.executeArbitrageLoop(),
      1000 // Verificar oportunidades a cada segundo
    );
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
    
    this.logger.info('Sistema de arbitragem parado');
  }

  private async executeArbitrageLoop(): Promise<void> {
    try {
      // Buscar oportunidades de arbitragem
      const opportunities = await this.findArbitrageOpportunities();
      
      // Filtrar e ordenar por maior lucro
      const validOpportunities = opportunities
        .filter(opp => this.validateOpportunity(opp))
        .sort((a, b) => b.expectedProfit - a.expectedProfit);

      if (validOpportunities.length > 0) {
        const bestOpportunity = validOpportunities[0];
        await this.executeArbitrage(bestOpportunity);
      }

    } catch (error) {
      this.logger.error(`Erro no loop de arbitragem: ${error.message}`);
    }
  }

  private async findArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const exchanges = this.exchangeManager.getExchanges();
    
    // Lista de pares comuns para verificar
    const commonPairs = [
      ['BTC/USDT', 'ETH/BTC', 'ETH/USDT'],
      ['BTC/USDT', 'BNB/BTC', 'BNB/USDT'],
      ['ETH/USDT', 'BNB/ETH', 'BNB/USDT']
    ];

    for (const pairs of commonPairs) {
      for (const exchange of exchanges) {
        try {
          // Verificar se o exchange suporta todos os pares
          const supported = pairs.every(pair => exchange.hasPair(pair));
          if (!supported) continue;

          // Buscar order books
          const orderBooks = await Promise.all(
            pairs.map(pair => exchange.fetchOrderBook(pair))
          );

          // Calcular oportunidade
          const opportunity = this.calculateTriangularArbitrage(
            exchange.name,
            pairs,
            orderBooks
          );

          if (opportunity && opportunity.expectedProfit > botConfig.minProfitPercentage) {
            opportunities.push(opportunity);
          }

        } catch (error) {
          this.logger.error(`Erro ao buscar oportunidades em ${exchange.name}: ${error.message}`);
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
      // Simulação de trades para calcular lucro potencial
      let initialAmount = botConfig.maxTradeAmount;
      let currentAmount = initialAmount;

      // Primeira trade
      const firstBook = orderBooks[0];
      const firstRate = firstBook.asks[0][0];
      currentAmount = currentAmount / firstRate;

      // Segunda trade
      const secondBook = orderBooks[1];
      const secondRate = secondBook.asks[0][0];
      currentAmount = currentAmount / secondRate;

      // Terceira trade (fechamento)
      const thirdBook = orderBooks[2];
      const thirdRate = thirdBook.bids[0][0];
      currentAmount = currentAmount * thirdRate;

      // Calcular lucro
      const profit = ((currentAmount - initialAmount) / initialAmount) * 100;

      // Considerar taxas
      const totalFees = this.calculateTotalFees(exchangeName);
      const netProfit = profit - totalFees;

      if (netProfit > botConfig.minProfitPercentage) {
        return {
          exchanges: [exchangeName],
          path: pairs,
          expectedProfit: netProfit,
          requiredBalance: initialAmount,
          timestamp: Date.now()
        };
      }

      return null;

    } catch (error) {
      this.logger.error(`Erro ao calcular arbitragem: ${error.message}`);
      return null;
    }
  }

  private calculateTotalFees(exchangeName: string): number {
    const exchange = this.exchangeManager.getExchange(exchangeName);
    const feePerTrade = exchange.getTradingFee();
    return feePerTrade * 3; // 3 trades na arbitragem triangular
  }

  private validateOpportunity(opportunity: ArbitrageOpportunity): boolean {
    // Verificar se o lucro esperado é maior que o mínimo
    if (opportunity.expectedProfit < botConfig.minProfitPercentage) {
      return false;
    }

    // Verificar se não está expirada (mais de 5 segundos)
    if (Date.now() - opportunity.timestamp > 5000) {
      return false;
    }

    // Verificar se temos saldo suficiente
    const balance = this.exchangeManager.getBalance(
      opportunity.exchanges[0],
      'USDT'
    );
    if (balance < opportunity.requiredBalance) {
      return false;
    }

    return true;
  }

  private async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const sessionId = Date.now().toString();
    this.logger.info(`Iniciando execução de arbitragem (${sessionId})`);

    try {
      // Validar novamente antes de executar
      if (!this.validateOpportunity(opportunity)) {
        throw new Error('Oportunidade não é mais válida');
      }

      // Executar trades em sequência
      const exchange = this.exchangeManager.getExchange(opportunity.exchanges[0]);
      const trades = [];

      for (let i = 0; i < opportunity.path.length; i++) {
        const pair = opportunity.path[i];
        const trade = await exchange.createOrder(pair, 'market', 'buy', opportunity.requiredBalance);
        trades.push(trade);

        // Aguardar confirmação
        await this.waitForTradeConfirmation(exchange, trade.id);
      }

      // Calcular resultado final
      const finalBalance = await exchange.fetchBalance();
      const profit = this.calculateActualProfit(trades);

      this.logger.info(`Arbitragem concluída com sucesso: ${profit}% de lucro`);

    } catch (error) {
      this.logger.error(`Erro na execução da arbitragem: ${error.message}`);
      await this.rollbackTrades(opportunity.exchanges[0], sessionId);
    }
  }

  private async waitForTradeConfirmation(exchange: any, tradeId: string): Promise<void> {
    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const trade = await exchange.fetchOrder(tradeId);
      if (trade.status === 'closed') {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error(`Trade ${tradeId} não confirmado após ${maxAttempts} tentativas`);
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