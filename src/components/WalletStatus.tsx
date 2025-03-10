
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  CircleDollarSign, 
  TrendingUp, 
  ShieldCheck, 
  Power, 
  Loader2
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useWallet } from '@/contexts/WalletContext';

const WalletStatus = () => {
  const { wallet, connectWallet } = useWallet();
  const [botActive, setBotActive] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [lastProfit, setLastProfit] = useState<number | null>(null);
  const [totalProfit, setTotalProfit] = useState(0);
  const [botStatus, setBotStatus] = useState<'idle' | 'scanning' | 'trading' | 'waiting'>('idle');
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
        const randomStatus = actions[Math.floor(Math.random() * actions.length)] as 'scanning' | 'trading' | 'waiting';
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
  
  if (!wallet || !wallet.isConnected) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Wallet Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <Wallet className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              Connect your wallet to enable arbitrage trading
            </p>
            <Button variant="outline" size="sm" onClick={() => connectWallet('polygon')}>
              Connect Wallet
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Arbitrage Bot</CardTitle>
          <Badge 
            variant={botActive ? "default" : "outline"}
            className={botActive ? "bg-green-500" : ""}
          >
            {botActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">USDT Balance</span>
            </div>
            <span className="font-medium">${wallet.balance.usdt.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Total Profit</span>
            </div>
            <span className={`font-medium ${totalProfit > 0 ? 'text-green-500' : ''}`}>
              ${totalProfit.toFixed(2)}
            </span>
          </div>
          
          {lastProfit !== null && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm">Last Trade</span>
              </div>
              <span className="text-green-500 font-medium">+${lastProfit}</span>
            </div>
          )}
        </div>
        
        <div className="pt-2 border-t">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Authorization</span>
            </div>
            <Badge variant={wallet.isAuthorized ? "outline" : "destructive"} className={wallet.isAuthorized ? "border-green-500 text-green-500" : ""}>
              {wallet.isAuthorized ? "Approved" : "Required"}
            </Badge>
          </div>
        </div>
        
        {wallet.isAuthorized && (
          <>
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Bot Status</span>
                </div>
                <Badge variant="outline" className="capitalize">
                  {botStatus === 'scanning' && (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Scanning
                    </span>
                  )}
                  {botStatus === 'trading' && (
                    <span className="flex items-center gap-1 text-green-500">
                      <TrendingUp className="h-3 w-3" />
                      Trading
                    </span>
                  )}
                  {botStatus === 'waiting' && "Waiting"}
                  {botStatus === 'idle' && "Idle"}
                </Badge>
              </div>
            </div>
            
            <Button
              variant={botActive ? "outline" : "default"}
              className="w-full"
              onClick={toggleBot}
              disabled={isActivating}
            >
              {isActivating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Power className="h-4 w-4" />
                  {botActive ? "Stop Bot" : "Start Bot"}
                </span>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletStatus;
