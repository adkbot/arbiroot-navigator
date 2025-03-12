
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
  const { wallet, disconnectWallet } = useWallet();
  const { 
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
  } = useBotControl();
  
  if (!wallet || !wallet.isConnected) {
    return <WalletNotConnected />;
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Bot de Arbitragem</CardTitle>
          <Badge 
            variant={!botActive ? "outline" : botPaused ? "secondary" : "default"}
            className={!botActive ? "" : botPaused ? "bg-amber-500" : "bg-green-500"}
          >
            {!botActive ? "Inativo" : botPaused ? "Pausado" : "Ativo"}
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
            <BotStatus 
              botStatus={botStatus} 
              totalArbitrages={totalArbitrages} 
            />
            
            <BotControl 
              toggleBot={toggleBot}
              pauseBot={pauseBot}
              restartBot={restartBot}
              stopBot={stopBot}
              disconnectWallet={disconnectWallet}
              botActive={botActive}
              botPaused={botPaused}
              isActivating={isActivating}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WalletStatus;
