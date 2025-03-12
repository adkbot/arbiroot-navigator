
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";

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

  useEffect(() => {
    // Clean up bot simulation on unmount
    return () => {
      if (botInterval) {
        clearInterval(botInterval);
      }
    };
  }, [botInterval]);

  const playSound = (type: 'start' | 'end') => {
    // Create and play a sound
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    
    oscillator.connect(gain);
    gain.connect(context.destination);
    
    if (type === 'start') {
      // Higher pitch for start
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
    } else {
      // Two beeps for end
      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';
      
      // Schedule two beeps
      gain.gain.setValueAtTime(0.5, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
      gain.gain.setValueAtTime(0.5, context.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
      
      oscillator.start(context.currentTime);
      oscillator.stop(context.currentTime + 0.6);
      return;
    }
    
    // Single beep for start
    gain.gain.setValueAtTime(0.5, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.4);
  };

  const toggleBot = () => {
    if (botActive) {
      // If already active, this is handled by stop/pause
      return;
    }
    
    // Start the bot
    setIsActivating(true);
    
    setTimeout(() => {
      setIsActivating(false);
      setBotActive(true);
      setBotPaused(false);
      setBotStatus('scanning');
      
      toast({
        title: "Bot Started",
        description: "Arbitrage bot is now running",
      });
      
      playSound('start');
      
      // Simulate bot activity
      const interval = window.setInterval(() => {
        if (botPaused) return; // Skip updates if paused
        
        const actions = ['scanning', 'trading', 'waiting'];
        const randomStatus = actions[Math.floor(Math.random() * actions.length)] as BotStatus;
        setBotStatus(randomStatus);
        
        // Occasionally generate profits
        if (randomStatus === 'trading' && Math.random() > 0.5) {
          const profit = parseFloat((Math.random() * 5).toFixed(2));
          setLastProfit(profit);
          setTotalProfit(prev => parseFloat((prev + profit).toFixed(2)));
          setTotalArbitrages(prev => prev + 1);
          
          toast({
            title: "Trade Executed",
            description: `Profit: +$${profit}`,
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
      title: "Bot Paused",
      description: "Arbitrage bot has been paused",
    });
  };
  
  const restartBot = () => {
    if (!botActive || !botPaused) return;
    
    setBotPaused(false);
    setBotStatus('scanning');
    
    toast({
      title: "Bot Resumed",
      description: "Arbitrage bot has resumed operation",
    });
    
    playSound('start');
  };
  
  const stopBot = () => {
    if (!botActive) return;
    
    // Stop the bot
    if (botInterval) {
      clearInterval(botInterval);
      setBotInterval(null);
    }
    
    setBotActive(false);
    setBotPaused(false);
    setBotStatus('idle');
    
    toast({
      title: "Bot Stopped",
      description: "Arbitrage bot has been stopped",
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
