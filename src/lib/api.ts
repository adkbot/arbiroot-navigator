import ccxt from 'ccxt';
import { ethers } from 'ethers';
import { PriceData, ExchangeInfo } from './types';

// Dados reais das exchanges
export const exchanges: ExchangeInfo[] = [
  { id: 'binance', name: 'Binance', logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png', active: true },
  { id: 'coinbase', name: 'Coinbase', logo: 'https://cryptologos.cc/logos/coinbase-coin-logo.png', active: true },
  { id: 'kraken', name: 'Kraken', logo: 'https://cryptologos.cc/logos/kraken-logo.png', active: true },
  { id: 'kucoin', name: 'KuCoin', logo: 'https://cryptologos.cc/logos/kucoin-token-kcs-logo.png', active: true },
  { id: 'ftx', name: 'FTX', logo: 'https://cryptologos.cc/logos/ftx-token-ftt-logo.png', active: true },
  { id: 'huobi', name: 'Huobi', logo: 'https://cryptologos.cc/logos/huobi-token-ht-logo.png', active: true },
  { id: 'bitfinex', name: 'Bitfinex', logo: 'https://cryptologos.cc/logos/bitfinex-logo.png', active: true },
  { id: 'bybit', name: 'Bybit', logo: 'https://cryptologos.cc/logos/bybit-logo.png', active: true },
  { id: 'okx', name: 'OKX', logo: 'https://cryptologos.cc/logos/okb-okb-logo.png', active: true },
  { id: 'gate', name: 'Gate.io', logo: 'https://cryptologos.cc/logos/gate-logo.png', active: true },
];

// Pares de negociação populares (dados reais)
export const tradingPairs = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOT/USDT', 'DOGE/USDT', 'AVAX/USDT', 'MATIC/USDT',
  'LINK/USDT', 'UNI/USDT', 'ATOM/USDT', 'LTC/USDT', 'BCH/USDT',
  'ETH/BTC', 'BNB/BTC', 'SOL/BTC', 'ADA/BTC', 'XRP/BTC',
];

// Função auxiliar para adaptar o formato do par conforme cada exchange
function convertSymbolForExchange(exchangeId: string, pair: string): string {
  switch (exchangeId) {
    case 'kraken':
      return pair.replace('BTC', 'XBT').replace('/', '');
    case 'coinbase':
      return pair.replace('/', '-');
    default:
      return pair.replace('/', '');
  }
}

// Busca preços reais utilizando ccxt para cada exchange ativa e cada par
export async function fetchPrices(): Promise<PriceData[]> {
  const prices: PriceData[] = [];
  const now = Date.now();
  const exchangeInstances: Record<string, any> = {};

  for (const exch of exchanges) {
    if (!exch.active) continue;
    try {
      switch (exch.id) {
        case 'binance': exchangeInstances[exch.id] = new ccxt.binance(); break;
        case 'coinbase': exchangeInstances[exch.id] = new ccxt.coinbasepro(); break;
        case 'kraken': exchangeInstances[exch.id] = new ccxt.kraken(); break;
        case 'kucoin': exchangeInstances[exch.id] = new ccxt.kucoin(); break;
        case 'ftx': exchangeInstances[exch.id] = new ccxt.ftx(); break;
        case 'huobi': exchangeInstances[exch.id] = new ccxt.huobi(); break;
        case 'bitfinex': exchangeInstances[exch.id] = new ccxt.bitfinex(); break;
        case 'bybit': exchangeInstances[exch.id] = new ccxt.bybit(); break;
        case 'okx': exchangeInstances[exch.id] = new ccxt.okx(); break;
        case 'gate': exchangeInstances[exch.id] = new ccxt.gateio(); break;
        default: console.error(`Exchange ${exch.id} não suportada.`);
      }
    } catch (error) {
      console.error(`Erro ao inicializar ${exch.id}:`, error);
    }
  }

  const promises = Object.keys(exchangeInstances).map(async (exchId) => {
    const instance = exchangeInstances[exchId];
    for (const pair of tradingPairs) {
      const symbol = convertSymbolForExchange(exchId, pair);
      try {
        const ticker = await instance.fetchTicker(symbol);
        prices.push({
          symbol: pair,
          price: ticker.last,
          exchange: exchId,
          timestamp: now,
        });
      } catch (error) {
        console.error(`Erro ao buscar ticker para ${pair} na ${exchId}:`, error);
      }
    }
  });

  await Promise.all(promises);
  return prices;
}

// --- Consultas de saldo da carteira usando ethers.js e a API pública do Polygon ---

const POLYGON_RPC_URL = "https://polygon-rpc.com";
const provider = new ethers.providers.JsonRpcProvider(POLYGON_RPC_URL);
// Atenção: o endereço abaixo é o fornecido, mas para funcionar corretamente deve ser um endereço válido (geralmente iniciando com "0x")
const WALLET_ADDRESS = "J7PZRY2CZ6SMAIEUD6WKZJN7IV5638J97M";
// Contrato USDT no Polygon (ERC‑20 oficial)
const USDT_CONTRACT_ADDRESS = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

export async function fetchWalletBalances() {
  try {
    let maticBalance = await provider.getBalance(WALLET_ADDRESS);
    maticBalance = parseFloat(ethers.utils.formatEther(maticBalance));
    const usdtContract = new ethers.Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
    let usdtBalance = await usdtContract.balanceOf(WALLET_ADDRESS);
    const usdtDecimals = await usdtContract.decimals();
    usdtBalance = parseFloat(ethers.utils.formatUnits(usdtBalance, usdtDecimals));
    return { matic: maticBalance, usdt: usdtBalance };
  } catch (error) {
    console.error("Erro ao buscar saldos da carteira:", error);
    return { matic: 0, usdt: 0 };
  }
}

// --- Exemplo de uso da API 0x para obter cotação de swap (dados reais) ---
export async function fetchSwapQuote(sellToken: string, buyToken: string, sellAmount: string) {
  try {
    const url = `https://api.0x.org/swap/v1/quote?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}`;
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Erro ao buscar cotação 0x:", error);
    return null;
  }
}
