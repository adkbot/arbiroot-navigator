
import { useState, useEffect } from 'react';
import { toast } from "@/components/ui/use-toast";

type BotStatus = 'idle' | 'scanning' | 'trading' | 'waiting';

export function useBotControl() {
  const [botActive, setBotActive] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [lastProfit, setLastProfit] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState(0);
  const [botStatus, setBotStatus] = useState<BotStatus>('idle');
  const [botInterval, setBotInterval] = useState<number | null>(null);

  useEffect(() => {
    // Clean up bot simulation on unmount
    return () => {
      if (botInterval) {
        clearInterval(botInterval);
      }
    };
  }, [botInterval]);

  const toggleBot = () => {
    if (botActive) {
      // Stop the bot
      if (botInterval) {
        clearInterval(botInterval);
        setBotInterval(null);
      }
      setBotActive(false);
      setBotStatus('idle');
      toast({
        title: "Bot Stopped",
        description: "Arbitrage bot has been stopped",
      });
      return;
    }
    
    // Start the bot
    setIsActivating(true);
    
    setTimeout(() => {
      setIsActivating(false);
      setBotActive(true);
      setBotStatus('scanning');
      toast({
        title: "Bot Started",
        description: "Arbitrage bot is now running",
      });
      
      // Simulate bot activity
      const interval = window.setInterval(() => {
        const actions = ['scanning', 'trading', 'waiting'];
        const randomStatus = actions[Math.floor(Math.random() * actions.length)] as BotStatus;
        setBotStatus(randomStatus);
        
        // Occasionally generate profits
        if (randomStatus === 'trading' && Math.random() > 0.5) {
          const profit = parseFloat((Math.random() * 5).toFixed(2));
          setLastProfit(profit);
          setTotalProfit(prev => parseFloat((prev + profit).toFixed(2)));
          
          toast({
            title: "Trade Executed",
            description: `Profit: +$${profit}`,
          });
        }
      }, 5000);
      
      setBotInterval(interval);
    }, 2000);
  };

  return {
    botActive,
    isActivating,
    lastProfit,
    totalProfit,
    botStatus,
    toggleBot
  };
}
