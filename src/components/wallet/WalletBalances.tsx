
import { CircleDollarSign, TrendingUp } from "lucide-react";
import { WalletInfo } from "@/lib/types";

interface WalletBalancesProps {
  wallet: WalletInfo;
  totalProfit: number;
  lastProfit: number | null;
}

const WalletBalances = ({ wallet, totalProfit, lastProfit }: WalletBalancesProps) => {
  return (
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
  );
};

export default WalletBalances;
