
import { CircleDollarSign, TrendingUp, RefreshCw } from "lucide-react";
import { WalletInfo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";

interface WalletBalancesProps {
  wallet: WalletInfo;
  totalProfit: number;
  lastProfit: number | null;
}

const WalletBalances = ({ wallet, totalProfit, lastProfit }: WalletBalancesProps) => {
  const { updateWalletBalance } = useWallet();
  
  const handleRefreshBalance = async () => {
    await updateWalletBalance();
  };
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Saldo USDT</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">${wallet.balance.usdt.toFixed(2)}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5" 
            onClick={handleRefreshBalance}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Lucro Total</span>
        </div>
        <span className={`font-medium ${totalProfit > 0 ? 'text-green-500' : ''}`}>
          ${totalProfit.toFixed(2)}
        </span>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm">Saldo Nativo</span>
        <span className="font-medium truncate max-w-[120px]">{wallet.balance.native.toFixed(4)} {
          wallet.chain === 'polygon' ? 'MATIC' : 
          wallet.chain === 'ethereum' ? 'ETH' : 
          wallet.chain === 'binance' ? 'BNB' : 'ARB'
        }</span>
      </div>
      
      {lastProfit !== null && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm">Último Trade</span>
          </div>
          <span className="text-green-500 font-medium">+${lastProfit}</span>
        </div>
      )}
    </div>
  );
};

export default WalletBalances;
