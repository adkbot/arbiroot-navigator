
import { CircleDollarSign, TrendingUp, RefreshCw } from "lucide-react";
import { WalletInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";

interface WalletBalancesProps {
  wallet: WalletInfo;
  totalProfit: number;
  lastProfit: number | null;
}

const WalletBalances = ({ wallet, totalProfit, lastProfit }: WalletBalancesProps) => {
  const { updateWalletBalance } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());
  
  // Auto-refresh balances every 60 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshBalance(false);
    }, 60000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  const refreshBalance = async (showToast: boolean = true) => {
    setIsRefreshing(true);
    try {
      await updateWalletBalance();
      setLastUpdateTime(Date.now());
      
      if (showToast) {
        toast({
          title: "Saldo atualizado",
          description: `Saldo atualizado com sucesso às ${new Date().toLocaleTimeString()}`
        });
      }
    } catch (error) {
      console.error("Falha ao atualizar saldo:", error);
      if (showToast) {
        toast({
          variant: "destructive",
          title: "Erro ao atualizar",
          description: "Não foi possível atualizar o saldo. Tente novamente.",
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleRefreshBalance = () => refreshBalance(true);
  
  const formatBalance = (balance: number, decimals: number = 2) => {
    if (balance === 0) return "0";
    if (balance < 0.01) return "<0.01";
    return balance.toFixed(decimals);
  };
  
  // Calculate time since last update
  const getUpdateTimeText = () => {
    const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
    
    if (seconds < 60) {
      return "agora";
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}min atrás`;
    } else {
      return `${Math.floor(seconds / 3600)}h atrás`;
    }
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Saldo USDT</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">${formatBalance(wallet.balance.usdt)}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5" 
            onClick={handleRefreshBalance}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Lucro Total</span>
        </div>
        <span className={`font-medium ${totalProfit > 0 ? 'text-green-500' : ''}`}>
          ${formatBalance(totalProfit)}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm">Saldo Nativo</span>
        <span className="font-medium truncate max-w-[120px]">{formatBalance(wallet.balance.native, 4)} {
          wallet.chain === 'polygon' ? 'MATIC' : 
          wallet.chain === 'ethereum' ? 'ETH' : 
          wallet.chain === 'binance' ? 'BNB' : 'ETH'
        }</span>
      </div>
      
      {lastProfit !== null && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">Último Trade</span>
          </div>
          <span className="text-green-500 font-medium">+${formatBalance(lastProfit)}</span>
        </div>
      )}
      
      <div className="flex justify-end mt-1">
        <span className="text-xs text-muted-foreground">
          Atualizado: {getUpdateTimeText()}
        </span>
      </div>
    </div>
  );
};

export default WalletBalances;
