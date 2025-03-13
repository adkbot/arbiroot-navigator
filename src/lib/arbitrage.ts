import { PriceData, ArbitrageOpportunity, ArbitrageParams } from './types';
import ccxt from 'ccxt';
import { ethers } from 'ethers';

// -----------------------------
// Consultas de saldo da carteira usando ethers.js e a API pública do Polygon
// -----------------------------
const POLYGON_RPC_URL = "https://polygon-rpc.com";
const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
// Substitua pelo seu endereço real de carteira (deve iniciar com "0x")
const WALLET_ADDRESS = "0xYOUR_WALLET_ADDRESS_HERE";
// Contrato USDT no Polygon (ERC‑20 oficial)
const USDT_CONTRACT_ADDRESS = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export async function fetchWalletBalances() {
  try {
    const maticBalanceBN = await provider.getBalance(WALLET_ADDRESS);
    const maticBalance = parseFloat(ethers.utils.formatEther(maticBalanceBN));
    const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const usdtBalanceBN = await usdtContract.balanceOf(WALLET_ADDRESS);
    const usdtDecimals = await usdtContract.decimals();
    const usdtBalance = parseFloat(ethers.utils.formatUnits(usdtBalanceBN, usdtDecimals));
    return { matic: maticBalance, usdt: usdtBalance };
  } catch (error) {
    console.error("Erro ao buscar saldos da carteira:", error);
    return { matic: 0, usdt: 0 };
  }
}

// -----------------------------
// Funções de Arbitragem Real (Triangular e Simples)
// -----------------------------

// Identifica oportunidades de arbitragem real, considerando lucro líquido mínimo (descontadas taxas)
export function findTriangularArbitrageOpportunities(
  prices: PriceData[],
  params: ArbitrageParams
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const { minProfitPercentage, maxPathLength, includeExchanges } = params;
  
  // Agrupa preços por exchange
  const pricesByExchange: Record<string, PriceData[]> = {};
  prices.forEach(price => {
    if (!includeExchanges.includes(price.exchange)) return;
    if (!pricesByExchange[price.exchange]) {
      pricesByExchange[price.exchange] = [];
    }
    pricesByExchange[price.exchange].push(price);
  });
  
  // Para cada exchange, busca oportunidades triangulares
  Object.entries(pricesByExchange).forEach(([exchange, exchangePrices]) => {
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
  
  // Busca oportunidades simples entre exchanges
  findSimpleArbitrageOpportunities(prices, params, opportunities);
  
  // Ordena as oportunidades por lucro percentual (maior para menor)
  return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
}

// Função recursiva para identificar caminhos de arbitragem triangular
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
  if (path.length > maxDepth) return;
  
  if (currentAsset === startAsset && path.length > 2) {
    const profitPercentage = (currentValue - 1) * 100;
    if (profitPercentage >= minProfitPercentage) {
      opportunities.push({
        id: tri-${exchange}-${path.join('-')}-${Date.now()},
        type: 'triangular',
        profit: currentValue - 1,
        profitPercentage,
        path: [...path],
        details: ${path.join(' → ')} (${profitPercentage.toFixed(2)}%),
        timestamp: Date.now(),
        exchanges: [exchange],
      });
    }
    return;
  }
  
  assets.forEach(nextAsset => {
    if (nextAsset === currentAsset) return;
    const directPair = ${currentAsset}/${nextAsset};
    const inversePair = ${nextAsset}/${currentAsset};
    
    let newValue = currentValue;
    let foundPath = false;
    
    if (symbols.has(directPair)) {
      newValue = currentValue / priceMap.get(directPair)!;
      foundPath = true;
    } else if (symbols.has(inversePair)) {
      newValue = currentValue * priceMap.get(inversePair)!;
      foundPath = true;
    }
    
    if (foundPath && !path.includes(nextAsset)) {
      // Aplica taxa de 0,1% por operação
      newValue *= 0.999;
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

// Identifica oportunidades simples entre exchanges
function findSimpleArbitrageOpportunities(
  prices: PriceData[],
  params: ArbitrageParams,
  opportunities: ArbitrageOpportunity[]
): void {
  const { minProfitPercentage, includeExchanges } = params;
  const pricesBySymbol: Record<string, PriceData[]> = {};
  
  prices.forEach(price => {
    if (!includeExchanges.includes(price.exchange)) return;
    if (!pricesBySymbol[price.symbol]) {
      pricesBySymbol[price.symbol] = [];
    }
    pricesBySymbol[price.symbol].push(price);
  });
  
  Object.entries(pricesBySymbol).forEach(([symbol, symbolPrices]) => {
    if (symbolPrices.length < 2) return;
    
    const lowestAsk = symbolPrices.reduce((min, price) => 
      price.price < min.price ? price : min, symbolPrices[0]);
    const highestBid = symbolPrices.reduce((max, price) => 
      price.price > max.price ? price : max, symbolPrices[0]);
    
    if (lowestAsk.exchange === highestBid.exchange) return;
    
    const buyPrice = lowestAsk.price;
    const sellPrice = highestBid.price;
    // Considera taxa de 0,1% em cada operação (total de 0,2%)
    const profitPercentage = ((sellPrice / buyPrice) * 0.998 - 1) * 100;
    
    if (profitPercentage >= minProfitPercentage) {
      opportunities.push({
        id: simple-${symbol}-${lowestAsk.exchange}-${highestBid.exchange}-${Date.now()},
        type: 'simple',
        profit: (sellPrice - buyPrice) * 0.998,
        profitPercentage,
        path: [symbol],
        details: Buy ${symbol} on ${lowestAsk.exchange} at ${buyPrice.toFixed(6)}, sell on ${highestBid.exchange} at ${sellPrice.toFixed(6)} (${profitPercentage.toFixed(2)}%),
        timestamp: Date.now(),
        exchanges: [lowestAsk.exchange, highestBid.exchange],
      });
    }
  });
}

// -----------------------------
// Execução Real de Ordens com Integração às APIs, Tratamento de Slippage, Limites de Taxa, Rollback e Gestão de Risco
// -----------------------------
async function executeTriangularArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
  try {
    console.log(Iniciando execução de arbitragem triangular: ${opportunity.details});
    // 1. Verifica saldos e condições de risco antes de iniciar
    const balances = await fetchWalletBalances();
    if (!riskCheck(balances, opportunity)) {
      throw new Error("Condições de risco não atendidas para arbitragem triangular.");
    }
    
    // 2. Para cada par na cadeia de arbitragem, executa a ordem com controle de slippage e limites de taxa
    for (let i = 0; i < opportunity.path.length - 1; i++) {
      const fromAsset = opportunity.path[i];
      const toAsset = opportunity.path[i + 1];
      
      // Obtém dados de mercado para o par atual
      const marketData = await getMarketDataForPair(fromAsset, toAsset);
      // Calcula preço de execução considerando slippage
      const executionPrice = calculateExecutionPrice(marketData, fromAsset, toAsset);
      
      // Executa ordem real via API da exchange (placeholder para integração real)
      const orderResult = await placeOrder(opportunity.exchanges[0], fromAsset, toAsset, executionPrice);
      if (!orderResult.success) {
        throw new Error(Falha na execução da ordem para ${fromAsset}/${toAsset});
      }
    }
    console.log(Arbitragem triangular executada com sucesso: ${opportunity.details});
  } catch (error) {
    console.error(Erro na execução de arbitragem triangular: ${error});
    // Em caso de erro, inicia mecanismo de rollback para compensar operações já executadas
    await rollbackOrders(opportunity);
  }
}

async function executeSimpleArbitrage(opportunity: ArbitrageOpportunity): Promise<void> {
  try {
    console.log(Iniciando execução de arbitragem simples: ${opportunity.details});
    // 1. Verifica saldos e condições de risco nas exchanges envolvidas
    const balances = await fetchWalletBalances();
    if (!riskCheck(balances, opportunity)) {
      throw new Error("Condições de risco não atendidas para arbitragem simples.");
    }
    
    // 2. Obtém dados de mercado para cada exchange para avaliar slippage
    const buyMarketData = await getMarketDataForExchange(opportunity.exchanges[0], opportunity.path[0]);
    const sellMarketData = await getMarketDataForExchange(opportunity.exchanges[1], opportunity.path[0]);
    
    const buyPrice = calculateExecutionPrice(buyMarketData, 'buy');
    const sellPrice = calculateExecutionPrice(sellMarketData, 'sell');
    
    // 3. Executa ordem de compra na exchange com menor preço
    const buyOrderResult = await placeOrder(opportunity.exchanges[0], 'BUY', opportunity.path[0], buyPrice);
    if (!buyOrderResult.success) {
      throw new Error("Falha na execução da ordem de compra.");
    }
    
    // 4. Executa ordem de venda na exchange com maior preço
    const sellOrderResult = await placeOrder(opportunity.exchanges[1], 'SELL', opportunity.path[0], sellPrice);
    if (!sellOrderResult.success) {
      throw new Error("Falha na execução da ordem de venda.");
    }
    console.log(Arbitragem simples executada com sucesso: ${opportunity.details});
  } catch (error) {
    console.error(Erro na execução de arbitragem simples: ${error});
    // Em caso de erro, inicia rollback para compensar operações já efetuadas
    await rollbackOrders(opportunity);
  }
}

// Função principal que identifica oportunidades e executa as ordens se o lucro líquido for suficiente
export async function processArbitrageOpportunities(
  prices: PriceData[],
  params: ArbitrageParams
): Promise<void> {
  const opportunities = findTriangularArbitrageOpportunities(prices, params);
  
  for (const opp of opportunities) {
    if (opp.profitPercentage >= params.minProfitPercentage) {
      if (opp.type === 'triangular') {
        await executeTriangularArbitrage(opp);
      } else if (opp.type === 'simple') {
        await executeSimpleArbitrage(opp);
      }
    } else {
      console.log(Oportunidade descartada (lucro insuficiente): ${opp.details});
    }
  }
}

// -----------------------------
// Funções Auxiliares para Gestão de Risco, Slippage, Execução de Ordens e Rollback
// -----------------------------
function riskCheck(balances: { matic: number; usdt: number }, opportunity: ArbitrageOpportunity): boolean {
  // Exemplo de verificação: saldo mínimo de USDT para operar
  if (balances.usdt < 10) {
    console.warn("Saldo insuficiente para a operação.");
    return false;
  }
  // Outras verificações (volatilidade, limites de exposição, etc.) podem ser adicionadas aqui
  return true;
}

async function getMarketDataForPair(fromAsset: string, toAsset: string): Promise<any> {
  // Placeholder para obter dados reais do mercado para o par
  return { bid: 1.0, ask: 1.0 };
}

async function getMarketDataForExchange(exchangeId: string, symbol: string): Promise<any> {
  // Placeholder para obter dados reais do mercado de uma exchange específica
  return { bid: 1.0, ask: 1.0 };
}

function calculateExecutionPrice(marketData: any, ...args: any[]): number {
  // Placeholder: calcula o preço de execução considerando um fator de slippage
  return marketData.ask * 1.001;
}

async function placeOrder(exchangeId: string, sideOrFromAsset: string, symbolOrToAsset: string, price: number): Promise<{ success: boolean }> {
  // Placeholder para integração com a API real de execução de ordens da exchange
  console.log(Ordem enviada: Exchange ${exchangeId}, ${sideOrFromAsset} ${symbolOrToAsset} a ${price});
  // Simula sucesso na ordem
  return { success: true };
}

async function rollbackOrders(opportunity: ArbitrageOpportunity): Promise<void> {
  // Placeholder para implementar rollback em caso de falhas na execução
  console.warn(Rollback iniciado para a oportunidade: ${opportunity.details});
  // Aqui, implemente a lógica para cancelar ordens pendentes ou compensar operações já executadas
}