
/**
 * CCXT Browser Helper
 * This file provides helper functions to work with CCXT in the browser environment
 * and helps handle the limitations of using CCXT in a browser context
 */

import { binance, coinbase, kraken, kucoin, huobi, okx } from 'ccxt';

// Map of available exchange classes in CCXT
export const exchangeClasses = {
  binance,
  coinbase,
  kraken,
  kucoin,
  huobi,
  okx
};

// Function to create a new exchange instance safely
export function createExchange(id: string, config: any = {}) {
  if (!exchangeClasses[id as keyof typeof exchangeClasses]) {
    throw new Error(`Exchange ${id} is not supported`);
  }
  
  const ExchangeClass = exchangeClasses[id as keyof typeof exchangeClasses];
  return new ExchangeClass({
    enableRateLimit: true,
    timeout: 30000,
    ...config
  });
}

// Get a list of all supported exchanges
export function getSupportedExchanges() {
  return Object.keys(exchangeClasses);
}

// Handle common CCXT errors specifically in browser context
export function handleCcxtError(error: any, defaultMessage: string = "Exchange API error") {
  if (error.name === 'NetworkError') {
    return {
      message: "Network connection issue. Check your internet connection.",
      type: "network"
    };
  } else if (error.message.includes('CORS')) {
    return {
      message: "CORS restriction detected. This is a browser limitation when accessing exchange APIs directly.",
      type: "cors" 
    };
  } else if (error.message.includes('timeout')) {
    return {
      message: "Request timed out. The exchange might be experiencing high load.",
      type: "timeout"
    };
  } else if (error.message.includes('rate limit')) {
    return {
      message: "Rate limit exceeded. Please wait before making more requests.",
      type: "ratelimit"
    };
  }
  
  return {
    message: defaultMessage,
    type: "unknown",
    original: error.message
  };
}

// Extract the relevant fields from a CCXT ticker object
export function normalizeTicker(ticker: any, exchange: string, symbol: string): any {
  return {
    symbol,
    exchange,
    price: ticker?.last || ticker?.close || 0,
    timestamp: ticker?.timestamp || Date.now(),
    volume: ticker?.baseVolume || ticker?.quoteVolume || ticker?.volume || 0,
    high: ticker?.high || 0,
    low: ticker?.low || 0,
    bid: ticker?.bid || 0,
    ask: ticker?.ask || 0
  };
}
