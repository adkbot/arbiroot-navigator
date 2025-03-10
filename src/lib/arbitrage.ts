
import { PriceData, ArbitrageOpportunity, ArbitrageParams } from './types';

// Find triangular arbitrage opportunities
export function findTriangularArbitrageOpportunities(
  prices: PriceData[],
  params: ArbitrageParams
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const { minProfitPercentage, maxPathLength, includeExchanges } = params;
  
  // Group prices by exchange
  const pricesByExchange: Record<string, PriceData[]> = {};
  prices.forEach(price => {
    if (!includeExchanges.includes(price.exchange)) return;
    
    if (!pricesByExchange[price.exchange]) {
      pricesByExchange[price.exchange] = [];
    }
    pricesByExchange[price.exchange].push(price);
  });
  
  // Check each exchange for triangular opportunities
  Object.entries(pricesByExchange).forEach(([exchange, exchangePrices]) => {
    // Find all trading pairs and build a price map
    const priceMap = new Map<string, number>();
    const symbols = new Set<string>();
    const assets = new Set<string>();
    
    exchangePrices.forEach(price => {
      priceMap.set(price.symbol, price.price);
      symbols.add(price.symbol);
      
      const [base, quote] = price.symbol.split('/');
      assets.add(base);
      assets.add(quote);
    });
    
    // For each starting asset, find potential paths
    assets.forEach(startAsset => {
      findArbitragePaths(
        startAsset, 
        startAsset, 
        assets, 
        symbols, 
        priceMap, 
        1.0, 
        [startAsset], 
        exchange,
        maxPathLength,
        minProfitPercentage,
        opportunities
      );
    });
  });
  
  // Find simple arbitrage opportunities between exchanges
  findSimpleArbitrageOpportunities(prices, params, opportunities);
  
  // Sort by profit percentage (descending)
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

// Helper function to find paths for triangular arbitrage
function findArbitragePaths(
  currentAsset: string,
  startAsset: string,
  assets: Set<string>,
  symbols: Set<string>,
  priceMap: Map<string, number>,
  currentValue: number,
  path: string[],
  exchange: string,
  maxDepth: number,
  minProfitPercentage: number,
  opportunities: ArbitrageOpportunity[]
): void {
  // Stop if we've reached the maximum path length
  if (path.length > maxDepth) return;
  
  // If we've returned to the starting asset and have at least 3 assets in the path
  if (currentAsset === startAsset && path.length > 2) {
    const profitPercentage = (currentValue - 1) * 100;
    
    // Check if the profit meets the minimum threshold
    if (profitPercentage >= minProfitPercentage) {
      opportunities.push({
        id: `tri-${exchange}-${path.join('-')}-${Date.now()}`,
        type: 'triangular',
        profit: currentValue - 1,
        profitPercentage,
        path: [...path],
        details: `${path.join(' → ')} (${profitPercentage.toFixed(2)}%)`,
        timestamp: Date.now(),
        exchanges: [exchange],
      });
    }
    return;
  }
  
  // Check all possible next assets
  assets.forEach(nextAsset => {
    if (nextAsset === currentAsset) return;
    
    // Try both direct and inverse pairs
    const directPair = `${currentAsset}/${nextAsset}`;
    const inversePair = `${nextAsset}/${currentAsset}`;
    
    let newValue = currentValue;
    let foundPath = false;
    
    if (symbols.has(directPair)) {
      // Direct exchange: sell current for next
      newValue = currentValue / priceMap.get(directPair)!;
      foundPath = true;
    } else if (symbols.has(inversePair)) {
      // Inverse exchange: buy next with current
      newValue = currentValue * priceMap.get(inversePair)!;
      foundPath = true;
    }
    
    if (foundPath && !path.includes(nextAsset)) {
      // Apply a 0.1% trading fee for each hop
      newValue *= 0.999;
      
      // Continue the path
      findArbitragePaths(
        nextAsset,
        startAsset,
        assets,
        symbols,
        priceMap,
        newValue,
        [...path, nextAsset],
        exchange,
        maxDepth,
        minProfitPercentage,
        opportunities
      );
    }
  });
}

// Find simple arbitrage opportunities between different exchanges
function findSimpleArbitrageOpportunities(
  prices: PriceData[],
  params: ArbitrageParams,
  opportunities: ArbitrageOpportunity[]
): void {
  const { minProfitPercentage, includeExchanges } = params;
  
  // Group prices by symbol
  const pricesBySymbol: Record<string, PriceData[]> = {};
  prices.forEach(price => {
    if (!includeExchanges.includes(price.exchange)) return;
    
    if (!pricesBySymbol[price.symbol]) {
      pricesBySymbol[price.symbol] = [];
    }
    pricesBySymbol[price.symbol].push(price);
  });
  
  // Find arbitrage opportunities for each symbol
  Object.entries(pricesBySymbol).forEach(([symbol, symbolPrices]) => {
    if (symbolPrices.length < 2) return;
    
    // Find the lowest ask (sell) and highest bid (buy) prices
    const lowestAsk = symbolPrices.reduce((min, price) => 
      price.price < min.price ? price : min, symbolPrices[0]);
    
    const highestBid = symbolPrices.reduce((max, price) => 
      price.price > max.price ? price : max, symbolPrices[0]);
    
    // Only consider different exchanges
    if (lowestAsk.exchange === highestBid.exchange) return;
    
    // Calculate profit percentage (accounting for 0.1% fee on each exchange)
    const buyPrice = lowestAsk.price;
    const sellPrice = highestBid.price;
    const profitPercentage = ((sellPrice / buyPrice) * 0.998 - 1) * 100;
    
    if (profitPercentage >= minProfitPercentage) {
      opportunities.push({
        id: `simple-${symbol}-${lowestAsk.exchange}-${highestBid.exchange}-${Date.now()}`,
        type: 'simple',
        profit: (sellPrice - buyPrice) * 0.998,
        profitPercentage,
        path: [symbol],
        details: `Buy ${symbol} on ${lowestAsk.exchange} at ${buyPrice.toFixed(6)}, sell on ${highestBid.exchange} at ${sellPrice.toFixed(6)} (${profitPercentage.toFixed(2)}%)`,
        timestamp: Date.now(),
        exchanges: [lowestAsk.exchange, highestBid.exchange],
      });
    }
  });
}
