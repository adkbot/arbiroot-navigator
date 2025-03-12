
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";
import { useWallet } from '@/contexts/WalletContext';

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
  const { wallet } = useWallet();

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
      
      // Simular atividade do bot
      const interval = window.setInterval(() => {
        if (botPaused) return; // Pular atualizações se estiver pausado
        
        const actions = ['scanning', 'trading', 'waiting'];
        const randomStatus = actions[Math.floor(Math.random() * actions.length)] as BotStatus;
        setBotStatus(randomStatus);
        
        // Ocasionalmente gerar lucros
        if (randomStatus === 'trading' && Math.random() > 0.5) {
          const profit = parseFloat((Math.random() * 5).toFixed(2));
          setLastProfit(profit);
          setTotalProfit(prev => parseFloat((prev + profit).toFixed(2)));
          setTotalArbitrages(prev => prev + 1);
          
          toast({
            title: "Transação Executada",
            description: `Lucro: +$${profit}`,
          });
          
          playSound('end');
        }
      }, 5000);
      
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
    toggleBot,
    pauseBot,
    restartBot,
    stopBot
  };
}
