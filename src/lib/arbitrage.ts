import { ExchangeManager } from './exchange';
import { Logger } from './logger';
import {
  ArbitrageOpportunity,
  ArbitrageSession,
  TradeResult,
  PriceData,
  RiskMetrics,
  LiquidityInfo
} from './types';

export class ArbitrageExecutor {
  private exchangeManager: ExchangeManager;
  private logger: Logger;
  private sessions: Map<string, ArbitrageSession>;
  private readonly MIN_PROFIT_AFTER_FEES = 0.002; // 0.2%
  private readonly MAX_SLIPPAGE = 0.005; // 0.5%
  private readonly MIN_LIQUIDITY_RATIO = 3; // Volume disponível deve ser 3x maior que o necessário

  constructor(exchangeManager: ExchangeManager) {
    this.exchangeManager = exchangeManager;
    this.logger = new Logger('ArbitrageExecutor');
    this.sessions = new Map();
  }

  private createSession(opportunity: ArbitrageOpportunity): ArbitrageSession {
    const session: ArbitrageSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      trades: [],
      status: 'pending',
      profitTarget: opportunity.profit,
      currentProfit: 0,
      errors: []
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async executeTriangularArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
    const session = this.createSession(opportunity);
    
    try {
      this.logger.info(`Iniciando arbitragem triangular: ${opportunity.details}`);
      session.status = 'executing';

      // 1. Verificar saldos e condições de risco
      await this.validateBalances(opportunity);
      
      // 2. Verificar liquidez em todos os pares
      await this.validateLiquidity(opportunity);
      
      // 3. Calcular métricas de risco
      const riskMetrics = await this.calculateRiskMetrics(opportunity);
      if (riskMetrics.executionRisk === 'high') {
        throw new Error('Risco de execução muito alto');
      }

      // 4. Executar trades em sequência
      for (const [index, trade] of opportunity.path.entries()) {
        const result = await this.executeTrade(trade, opportunity.exchanges[index], session);
        session.trades.push(result);
        
        // Verificar se ainda é lucrativo continuar
        if (!this.isStillProfitable(session, opportunity)) {
          throw new Error('Oportunidade não é mais lucrativa');
        }
      }

      // 5. Verificar resultado final
      await this.verifyArbitrageResult(session);
      
      session.status = 'completed';
      this.logger.info(`Arbitragem concluída com sucesso: ${session.id}`);
      
    } catch (error) {
      session.status = 'failed';
      session.errors.push(error.message);
      this.logger.error(`Erro na arbitragem ${session.id}:`, error);
      
      // Iniciar processo de rollback se necessário
      if (session.trades.length > 0) {
        await this.rollbackTrades(session);
      }
      
      throw error;
    }
  }

  private async validateBalances(opportunity: ArbitrageOpportunity): Promise<void> {
    for (const exchangeId of opportunity.exchanges) {
      const balance = await this.exchangeManager.fetchBalance(exchangeId, true);
      
      // Verificar se há saldo suficiente para a operação
      if (!this.hasEnoughBalance(balance, opportunity)) {
        throw new Error(`Saldo insuficiente na exchange ${exchangeId}`);
      }
    }
  }

  private async validateLiquidity(opportunity: ArbitrageOpportunity): Promise<void> {
    const liquidityChecks: LiquidityInfo[] = [];
    
    for (const [index, symbol] of opportunity.path.entries()) {
      const exchangeId = opportunity.exchanges[index];
      const requiredAmount = opportunity.minimumRequired || 0;
      
      const liquidity = await this.exchangeManager.checkLiquidity(
        exchangeId,
        symbol,
        requiredAmount * this.MIN_LIQUIDITY_RATIO
      );
      
      if (!liquidity.isLiquid) {
        throw new Error(`Liquidez insuficiente para ${symbol} em ${exchangeId}`);
      }
      
      liquidityChecks.push(liquidity);
    }
  }

  private async calculateRiskMetrics(opportunity: ArbitrageOpportunity): Promise<RiskMetrics> {
    const metrics: RiskMetrics = {
      volatility: 0,
      slippageEstimate: 0,
      liquidityScore: 0,
      executionRisk: 'low',
      maxLoss: 0
    };

    // Calcular volatilidade média dos pares
    for (const [index, symbol] of opportunity.path.entries()) {
      const exchangeId = opportunity.exchanges[index];
      const ticker = await this.exchangeManager.fetchTicker(exchangeId, symbol);
      
      // Cálculo simplificado de volatilidade usando spread
      const spread = (ticker.ask - ticker.bid) / ticker.bid;
      metrics.volatility += spread;
      
      // Estimar slippage baseado no volume
      const slippage = this.estimateSlippage(ticker);
      metrics.slippageEstimate += slippage;
    }

    metrics.volatility /= opportunity.path.length;
    metrics.slippageEstimate /= opportunity.path.length;
    
    // Determinar nível de risco
    if (metrics.volatility > 0.01 || metrics.slippageEstimate > this.MAX_SLIPPAGE) {
      metrics.executionRisk = 'high';
    } else if (metrics.volatility > 0.005 || metrics.slippageEstimate > this.MAX_SLIPPAGE / 2) {
      metrics.executionRisk = 'medium';
    }

    // Calcular potencial máximo de perda
    metrics.maxLoss = opportunity.minimumRequired * (metrics.slippageEstimate + metrics.volatility);

    return metrics;
  }

  private async executeTrade(
    symbol: string,
    exchangeId: string,
    session: ArbitrageSession
  ): Promise<TradeResult> {
    try {
      const orderType = 'limit'; // Usar ordem limit para melhor preço
      const side = this.determineTradeSide(symbol, session);
      const amount = this.calculateTradeAmount(symbol, session);
      const price = await this.calculateOptimalPrice(symbol, exchangeId, side);

      const result = await this.exchangeManager.createOrder(
        exchangeId,
        symbol,
        orderType,
        side,
        amount,
        price
      );

      // Aguardar confirmação da ordem
      await this.waitForOrderCompletion(result.id, symbol, exchangeId);

      return result;
    } catch (error) {
      this.logger.error(`Erro ao executar trade ${symbol} em ${exchangeId}:`, error);
      throw error;
    }
  }

  private async rollbackTrades(session: ArbitrageSession): Promise<void> {
    this.logger.warn(`Iniciando rollback para sessão ${session.id}`);
    
    for (const trade of session.trades.reverse()) {
      try {
        // Executar ordem inversa para compensar
        const side = trade.side === 'buy' ? 'sell' : 'buy';
        await this.exchangeManager.createOrder(
          trade.exchange,
          trade.symbol,
          'market', // Usar market order para garantir execução rápida
          side,
          trade.filled
        );
      } catch (error) {
        this.logger.error(`Erro no rollback do trade ${trade.id}:`, error);
      }
    }
  }

  private isStillProfitable(session: ArbitrageSession, opportunity: ArbitrageOpportunity): boolean {
    const currentProfit = this.calculateCurrentProfit(session);
    return currentProfit >= opportunity.profit * (1 - this.MAX_SLIPPAGE);
  }

  private calculateCurrentProfit(session: ArbitrageSession): number {
    // Implementar cálculo real de lucro baseado nos trades executados
    return session.trades.reduce((profit, trade) => {
      return profit + (trade.side === 'buy' ? -trade.cost : trade.cost);
    }, 0);
  }

  private async waitForOrderCompletion(
    orderId: string,
    symbol: string,
    exchangeId: string,
    timeout = 30000
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const order = await this.exchangeManager.getExchange(exchangeId).fetchOrder(orderId, symbol);
      
      if (order.status === 'closed') {
        return;
      }
      
      if (order.status === 'canceled' || order.status === 'expired') {
        throw new Error(`Ordem ${orderId} não foi completada: ${order.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Timeout aguardando conclusão da ordem ${orderId}`);
  }

  private estimateSlippage(ticker: PriceData): number {
    if (!ticker.volume) return this.MAX_SLIPPAGE;
    
    // Quanto maior o volume, menor o slippage esperado
    const volumeScore = Math.min(1, ticker.volume / 100000);
    return this.MAX_SLIPPAGE * (1 - volumeScore);
  }

  private hasEnoughBalance(balance: any, opportunity: ArbitrageOpportunity): boolean {
    // Implementar verificação real de saldo considerando as moedas necessárias
    return true; // Placeholder
  }

  private determineTradeSide(symbol: string, session: ArbitrageSession): 'buy' | 'sell' {
    // Implementar lógica real para determinar lado do trade
    return 'buy'; // Placeholder
  }

  private calculateTradeAmount(symbol: string, session: ArbitrageSession): number {
    // Implementar cálculo real do montante do trade
    return 0; // Placeholder
  }

  private async calculateOptimalPrice(
    symbol: string,
    exchangeId: string,
    side: 'buy' | 'sell'
  ): Promise<number> {
    const orderbook = await this.exchangeManager.fetchOrderBook(exchangeId, symbol);
    const orders = side === 'buy' ? orderbook.asks : orderbook.bids;
    
    // Implementar cálculo real do preço ótimo baseado no order book
    return orders[0][0]; // Placeholder - usar primeiro preço disponível
  }
}

export function findTriangularArbitrageOpportunities() {
  return [
    {
      type: 'triangular',
      profit: 25.45,
      profitPercentage: 0.85,
      path: ['BTC/USDT', 'ETH/BTC', 'ETH/USDT'],
      details: 'Buy BTC with USDT, buy ETH with BTC, sell ETH for USDT',
      timestamp: Date.now(),
      exchanges: ['binance']
    },
    {
      type: 'triangular',
      profit: 42.18,
      profitPercentage: 1.21,
      path: ['ETH/USDT', 'XRP/ETH', 'XRP/USDT'],
      details: 'Buy ETH with USDT, buy XRP with ETH, sell XRP for USDT',
      timestamp: Date.now() - 120000,
      exchanges: ['kucoin']
    }
  ];
}
