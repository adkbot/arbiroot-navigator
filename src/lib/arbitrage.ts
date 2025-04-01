
import { ExchangeManager, ArbitrageExecutor } from './exchange';
import { PriceData, ArbitrageOpportunity } from './types';

// Find only simple cross-exchange arbitrage opportunities
export function findArbitrageOpportunities(
  prices: PriceData[], 
  options: { 
    minProfitPercentage: number,
    includeExchanges: string[]
  }
): ArbitrageOpportunity[] {
  console.log(`Buscando oportunidades de arbitragem simples com lucro mínimo de ${options.minProfitPercentage}%...`);
  const opportunities: ArbitrageOpportunity[] = [];
  
  // Get list of symbols and exchanges from price data
  const symbols = [...new Set(prices.map(p => p.symbol))];
  
  // Filter exchanges by the ones requested
  const exchanges = [...new Set(prices.map(p => p.exchange))].filter(ex => 
    options.includeExchanges.includes(ex)
  );
  
  console.log(`Analisando ${symbols.length} símbolos em ${exchanges.length} exchanges...`);
  
  // For each symbol, find the exchange with lowest and highest price
  for (const symbol of symbols) {
    const pricesForSymbol = prices.filter(p => 
      p.symbol === symbol && 
      exchanges.includes(p.exchange)
    );
    
    if (pricesForSymbol.length < 2) continue; // Need at least 2 exchanges to compare
    
    // Find lowest and highest prices
    let lowestPrice = { exchange: '', price: Number.MAX_VALUE };
    let highestPrice = { exchange: '', price: 0 };
    
    for (const priceData of pricesForSymbol) {
      if (priceData.price < lowestPrice.price) {
        lowestPrice = { exchange: priceData.exchange, price: priceData.price };
      }
      
      if (priceData.price > highestPrice.price) {
        highestPrice = { exchange: priceData.exchange, price: priceData.price };
      }
    }
    
    // Calculate profit percentage
    if (lowestPrice.exchange && highestPrice.exchange && lowestPrice.exchange !== highestPrice.exchange) {
      const priceDiff = highestPrice.price - lowestPrice.price;
      const profitPercentage = (priceDiff / lowestPrice.price) * 100;
      
      // Only add if profit meets minimum requirement
      if (profitPercentage >= options.minProfitPercentage) {
        const profit = (10000 * profitPercentage) / 100; // Example with $10000 base
        
        opportunities.push({
          id: `simple-${lowestPrice.exchange}-${highestPrice.exchange}-${symbol}-${Date.now()}`,
          type: 'simple',
          profit: profit,
          profitPercentage: profitPercentage,
          path: [symbol],
          details: `${lowestPrice.exchange} → ${highestPrice.exchange}: ${symbol} (${profitPercentage.toFixed(2)}%)`,
          timestamp: Date.now(),
          exchanges: [lowestPrice.exchange, highestPrice.exchange],
          minimumRequired: 1000 // Minimum required for trade
        });
      }
    }
  }
  
  // Sort by profit percentage descending
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

// Dummy implementations for compatibility with existing code
export class ArbitrageManager {
  private exchangeManager: ExchangeManager;
  private arbitrageExecutor: ArbitrageExecutor;
  
  constructor() {
    this.exchangeManager = new ExchangeManager();
    this.arbitrageExecutor = new ArbitrageExecutor();
  }
  
  async verifyArbitrageResult(result: any) {
    return this.arbitrageExecutor.verifyArbitrageResult(result);
  }
}
