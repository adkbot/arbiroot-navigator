
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from '@/contexts/WalletContext';
import { useBotControl } from '@/hooks/useBotControl';
import WalletNotConnected from './wallet/WalletNotConnected';
import WalletBalances from './wallet/WalletBalances';
import AuthStatus from './wallet/AuthStatus';
import BotStatus from './wallet/BotStatus';
import BotControl from './wallet/BotControl';

const WalletStatus = () => {
  const { wallet } = useWallet();
  const { 
    botActive,
    isActivating,
    lastProfit,
    totalProfit,
    botStatus,
    toggleBot
  } = useBotControl();
  
  if (!wallet || !wallet.isConnected) {
    return <WalletNotConnected />;
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
        <WalletBalances 
          wallet={wallet} 
          totalProfit={totalProfit} 
          lastProfit={lastProfit} 
        />
        
        <AuthStatus wallet={wallet} />
        
        {wallet.isAuthorized && (
          <>
            <BotStatus botStatus={botStatus} />
            
            <BotControl 
              toggleBot={toggleBot} 
              botActive={botActive} 
              isActivating={isActivating} 
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletStatus;
