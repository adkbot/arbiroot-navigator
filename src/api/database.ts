import mongoose from 'mongoose';
import { Logger } from '../lib/logger';

// Schemas
const TradeSchema = new mongoose.Schema({
  sessionId: String,
  timestamp: Date,
  exchange: String,
  pair: String,
  type: String,
  side: String,
  amount: Number,
  price: Number,
  cost: Number,
  fee: {
    cost: Number,
    currency: String
  },
  status: String
});

const OpportunitySchema = new mongoose.Schema({
  timestamp: Date,
  exchanges: [String],
  path: [String],
  expectedProfit: Number,
  actualProfit: Number,
  status: String,
  trades: [TradeSchema]
});

const BalanceSchema = new mongoose.Schema({
  timestamp: Date,
  exchange: String,
  currency: String,
  free: Number,
  used: Number,
  total: Number
});

const MetricsSchema = new mongoose.Schema({
  timestamp: Date,
  totalTrades: Number,
  successfulTrades: Number,
  failedTrades: Number,
  totalProfit: Number,
  averageProfit: Number,
  highestProfit: Number,
  lowestProfit: Number,
  successRate: Number
});

// Models
const Trade = mongoose.model('Trade', TradeSchema);
const Opportunity = mongoose.model('Opportunity', OpportunitySchema);
const Balance = mongoose.model('Balance', BalanceSchema);
const Metrics = mongoose.model('Metrics', MetricsSchema);

export class DatabaseAPI {
  private logger: Logger;
  private isConnected: boolean = false;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public async connect(uri: string): Promise<void> {
    try {
      await mongoose.connect(uri);
      this.isConnected = true;
      this.logger.info('Conectado ao banco de dados');
    } catch (error) {
      this.logger.error(`Erro ao conectar ao banco de dados: ${error.message}`);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      this.logger.info('Desconectado do banco de dados');
    }
  }

  // Métodos para Trades
  public async saveTrade(tradeData: any): Promise<any> {
    const trade = new Trade({
      ...tradeData,
      timestamp: new Date()
    });
    return await trade.save();
  }

  public async getTradesBySession(sessionId: string): Promise<any[]> {
    return await Trade.find({ sessionId }).sort({ timestamp: -1 });
  }

  public async getRecentTrades(limit: number = 100): Promise<any[]> {
    return await Trade.find().sort({ timestamp: -1 }).limit(limit);
  }

  // Métodos para Oportunidades
  public async saveOpportunity(opportunityData: any): Promise<any> {
    const opportunity = new Opportunity({
      ...opportunityData,
      timestamp: new Date()
    });
    return await opportunity.save();
  }

  public async getRecentOpportunities(limit: number = 100): Promise<any[]> {
    return await Opportunity.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('trades');
  }

  public async updateOpportunityStatus(id: string, status: string): Promise<any> {
    return await Opportunity.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  }

  // Métodos para Saldos
  public async saveBalance(balanceData: any): Promise<any> {
    const balance = new Balance({
      ...balanceData,
      timestamp: new Date()
    });
    return await balance.save();
  }

  public async getLatestBalance(exchange: string, currency: string): Promise<any> {
    return await Balance.findOne({ exchange, currency })
      .sort({ timestamp: -1 });
  }

  public async getBalanceHistory(
    exchange: string,
    currency: string,
    limit: number = 100
  ): Promise<any[]> {
    return await Balance.find({ exchange, currency })
      .sort({ timestamp: -1 })
      .limit(limit);
  }

  // Métodos para Métricas
  public async saveMetrics(metricsData: any): Promise<any> {
    const metrics = new Metrics({
      ...metricsData,
      timestamp: new Date()
    });
    return await metrics.save();
  }

  public async getLatestMetrics(): Promise<any> {
    return await Metrics.findOne().sort({ timestamp: -1 });
  }

  public async getMetricsHistory(limit: number = 100): Promise<any[]> {
    return await Metrics.find().sort({ timestamp: -1 }).limit(limit);
  }

  // Métodos de Análise
  public async calculateDailyMetrics(date: Date): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const trades = await Trade.find({
      timestamp: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    const totalTrades = trades.length;
    const successfulTrades = trades.filter(t => t.status === 'completed').length;
    const profits = trades.map(t => t.actualProfit || 0);

    return {
      timestamp: date,
      totalTrades,
      successfulTrades,
      failedTrades: totalTrades - successfulTrades,
      totalProfit: profits.reduce((a, b) => a + b, 0),
      averageProfit: profits.length ? profits.reduce((a, b) => a + b, 0) / profits.length : 0,
      highestProfit: Math.max(...profits, 0),
      lowestProfit: Math.min(...profits, 0),
      successRate: totalTrades ? (successfulTrades / totalTrades) * 100 : 0
    };
  }

  public async getProfitableOpportunities(
    minProfit: number,
    limit: number = 100
  ): Promise<any[]> {
    return await Opportunity.find({
      actualProfit: { $gte: minProfit }
    })
      .sort({ actualProfit: -1 })
      .limit(limit);
  }

  public async getFailedTrades(limit: number = 100): Promise<any[]> {
    return await Trade.find({ status: 'failed' })
      .sort({ timestamp: -1 })
      .limit(limit);
  }
}