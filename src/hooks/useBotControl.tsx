
import { useState, useEffect, useCallback } from 'react';
import { toast } from "@/components/ui/use-toast";
import { useWallet } from '@/contexts/WalletContext';
import { findTriangularArbitrageOpportunities } from '@/lib/arbitrage';
import { fetchPrices } from '@/lib/api';
import { PriceData, ArbitrageOpportunity } from '@/lib/types';
import { ExchangeManager } from '@/lib/exchange';

type BotStatus = 'idle' | 'scanning' | 'trading' | 'waiting' | 'paused';

export function useBotControl() {
  const [botActive, setBotActive] = useState(false);
  const [botPaused, setBotPaused] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [lastProfit, setLastProfit] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState(0);
  const [botStatus, setBotStatus] = useState<BotStatus>('idle');
  const [botInterval, setBotInterval] = useState<number | null>(null);
  const [totalArbitrages, setTotalArbitrages] = useState(0);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const { wallet, updateWalletBalance } = useWallet();
  const [exchangeManager] = useState(() => new ExchangeManager());

  // Limpar intervalo do bot quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (botInterval) {
        clearInterval(botInterval);
      }
    };
  }, [botInterval]);

  const playSound = (type: 'start' | 'end') => {
    // Criar e tocar um som
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    
    oscillator.connect(gain);
    gain.connect(context.destination);
    
    if (type === 'start') {
      // Tom mais alto para iniciar
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
    } else {
      // Dois bipes para finalizar
      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';
      
      // Programar dois bipes
      gain.gain.setValueAtTime(0.5, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
      gain.gain.setValueAtTime(0.5, context.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
      
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.6);
      return;
    }
    
    // Um único bipe para iniciar
    gain.gain.setValueAtTime(0.5, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.4);
  };
  
  const executeArbitrageOpportunity = async (opportunity: ArbitrageOpportunity) => {
    if (!wallet?.isAuthorized) {
      console.error("Carteira não autorizada para realizar operações");
      return false;
    }
    
    try {
      setBotStatus('trading');
      
      console.log(`Executando arbitragem: ${opportunity.details}`);
      
      // Verificar saldo da carteira para garantir fundos suficientes
      if (wallet.balance.usdt < opportunity.minimumRequired) {
        toast({
          variant: "destructive",
          title: "Fundos insuficientes",
          description: `É necessário pelo menos $${opportunity.minimumRequired} USDT para esta operação.`,
        });
        return false;
      }
      
      // Verificar liquidez nos mercados
      for (const exchange of opportunity.exchanges) {
        for (const symbol of opportunity.path) {
          const liquidityInfo = await exchangeManager.checkLiquidity(exchange, symbol, opportunity.minimumRequired);
          
          if (liquidityInfo.bidVolume < opportunity.minimumRequired || liquidityInfo.askVolume < opportunity.minimumRequired) {
            toast({
              variant: "destructive",
              title: "Liquidez insuficiente",
              description: `Liquidez insuficiente em ${exchange} para o par ${symbol}.`,
            });
            return false;
          }
        }
      }
      
      // Executar as ordens necessárias para realizar a arbitragem
      const trades = [];
      
      if (opportunity.type === 'simple') {
        // Arbitragem simples (entre duas exchanges)
        const [exchange1, exchange2] = opportunity.exchanges;
        const symbol = opportunity.path[0];
        
        // Comprar na exchange com preço mais baixo
        const buy = await exchangeManager.createOrder(
          exchange1, 
          symbol, 
          'limit', 
          'buy', 
          opportunity.minimumRequired / opportunity.profitPercentage
        );
        
        // Vender na exchange com preço mais alto
        const sell = await exchangeManager.createOrder(
          exchange2,
          symbol,
          'limit',
          'sell',
          opportunity.minimumRequired / opportunity.profitPercentage
        );
        
        trades.push(buy, sell);
      } else if (opportunity.type === 'triangular') {
        // Arbitragem triangular (dentro da mesma exchange)
        const exchange = opportunity.exchanges[0];
        
        // Executar cada etapa do ciclo triangular
        let amount = opportunity.minimumRequired;
        
        for (let i = 0; i < opportunity.path.length; i++) {
          const currentSymbol = opportunity.path[i];
          const nextSymbol = opportunity.path[(i + 1) % opportunity.path.length];
          
          // Determinar se é uma compra ou venda com base na direção
          const side = i % 2 === 0 ? 'buy' : 'sell';
          
          const trade = await exchangeManager.createOrder(
            exchange,
            `${currentSymbol}/${nextSymbol}`,
            'limit',
            side,
            amount
          );
          
          // Ajustar a quantidade para a próxima operação
          amount = trade.amount * trade.price * (1 - trade.fee / 100);
          trades.push(trade);
        }
      }
      
      // Verificar o resultado da arbitragem
      const arbitrageResult = await exchangeManager.verifyArbitrageResult(trades);
      
      if (arbitrageResult) {
        // Calcular lucro real
        const realProfit = opportunity.profit;
        
        setLastProfit(realProfit);
        setTotalProfit(prev => prev + realProfit);
        setTotalArbitrages(prev => prev + 1);
        
        // Atualizar saldo da carteira após arbitragem
        await updateWalletBalance();
        
        toast({
          title: "Arbitragem Executada",
          description: `${opportunity.details} - Lucro: +$${realProfit.toFixed(2)}`,
        });
        
        playSound('end');
        
        console.log(`Arbitragem concluída com sucesso. Lucro: $${realProfit.toFixed(2)}`);
        return true;
      } else {
        toast({
          variant: "destructive",
          title: "Falha na arbitragem",
          description: "A operação de arbitragem não foi concluída com sucesso.",
        });
        return false;
      }
    } catch (error) {
      console.error("Erro ao executar arbitragem:", error);
      toast({
        variant: "destructive",
        title: "Erro na execução",
        description: "Ocorreu um erro ao executar a operação de arbitragem.",
      });
      return false;
    } finally {
      setBotStatus('waiting');
    }
  };
  
  // Função para buscar preços e oportunidades
  const scanForOpportunities = useCallback(async () => {
    if (!botActive || botPaused) return;
    
    setBotStatus('scanning');
    
    try {
      // Buscar preços reais
      const priceData = await fetchPrices();
      setPrices(priceData);
      
      if (priceData.length > 0) {
        // Calcular oportunidades reais
        const ops = findTriangularArbitrageOpportunities(priceData, {
          minProfitPercentage: 0.5,
          maxPathLength: 3,
          includeExchanges: ['binance', 'coinbase', 'kraken']
        });
        
        setOpportunities(ops);
        
        // Se houver oportunidades lucrativas, executar a arbitragem
        const profitableOps = ops.filter(o => o.profitPercentage > 0.8);
        
        if (profitableOps.length > 0 && wallet?.isAuthorized) {
          // Executar a arbitragem mais lucrativa
          const bestOpportunity = profitableOps[0];
          await executeArbitrageOpportunity(bestOpportunity);
        } else {
          // Sem oportunidades lucrativas no momento
          setBotStatus('waiting');
        }
      }
    } catch (error) {
      console.error("Erro ao buscar oportunidades:", error);
      setBotStatus('waiting');
    }
  }, [botActive, botPaused, wallet, updateWalletBalance]);

  const toggleBot = () => {
    if (botActive) {
      // Se já estiver ativo, isso é tratado por stop/pause
      return;
    }
    
    // Iniciar o bot
    setIsActivating(true);
    
    setTimeout(() => {
      setIsActivating(false);
      setBotActive(true);
      setBotPaused(false);
      setBotStatus('scanning');
      
      toast({
        title: "Bot Iniciado",
        description: "Bot de arbitragem está executando operações em tempo real",
      });
      
      playSound('start');
      
      // Executar imediatamente a primeira vez
      scanForOpportunities();
      
      // Configurar intervalo para execução periódica
      const interval = window.setInterval(() => {
        if (!botPaused) {
          scanForOpportunities();
        }
      }, 15000); // A cada 15 segundos
      
      setBotInterval(interval);
    }, 2000);
  };
  
  const pauseBot = () => {
    if (!botActive) return;
    
    setBotPaused(true);
    setBotStatus('paused');
    
    toast({
      title: "Bot Pausado",
      description: "Bot de arbitragem foi pausado",
    });
  };
  
  const restartBot = () => {
    if (!botActive || !botPaused) return;
    
    setBotPaused(false);
    setBotStatus('scanning');
    
    toast({
      title: "Bot Retomado",
      description: "Bot de arbitragem retomou a operação em tempo real",
    });
    
    playSound('start');
    
    // Executar imediatamente ao retomar
    scanForOpportunities();
  };
  
  const stopBot = () => {
    if (!botActive) return;
    
    // Parar o bot
    if (botInterval) {
      clearInterval(botInterval);
      setBotInterval(null);
    }
    
    setBotActive(false);
    setBotPaused(false);
    setBotStatus('idle');
    
    toast({
      title: "Bot Parado",
      description: "Bot de arbitragem foi parado",
    });
  };

  return {
    botActive,
    botPaused,
    isActivating,
    lastProfit,
    totalProfit,
    botStatus,
    totalArbitrages,
    opportunities,
    toggleBot,
    pauseBot,
    restartBot,
    stopBot
  };
}
