
import { useState, useEffect, useCallback } from 'react';
import { toast } from "@/components/ui/use-toast";
import { useWallet } from '@/contexts/WalletContext';
import { findTriangularArbitrageOpportunities } from '@/lib/arbitrage';
import { fetchPrices } from '@/lib/api';
import { PriceData, ArbitrageOpportunity } from '@/lib/types';

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
        
        // Se houver oportunidades lucrativas, simular execução
        const profitableOps = ops.filter(o => o.profitPercentage > 0.8);
        
        if (profitableOps.length > 0 && wallet?.isAuthorized) {
          setBotStatus('trading');
          
          // Aguardar um momento para simular a troca
          setTimeout(() => {
            // Verificar se não foi pausado durante o intervalo
            if (botActive && !botPaused) {
              // Usar a primeira oportunidade lucrativa disponível
              const op = profitableOps[0];
              const profit = op.profit;
              
              setLastProfit(profit);
              setTotalProfit(prev => prev + profit);
              setTotalArbitrages(prev => prev + 1);
              
              // Atualizar saldo da carteira após arbitragem
              updateWalletBalance().catch(console.error);
              
              // Notificar usuário
              toast({
                title: "Arbitragem Executada",
                description: `${op.details} - Lucro: +$${profit.toFixed(2)}`,
              });
              
              playSound('end');
              
              setBotStatus('waiting');
            }
          }, 3000);
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
        description: "Bot de arbitragem está em execução",
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
      description: "Bot de arbitragem retomou a operação",
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
