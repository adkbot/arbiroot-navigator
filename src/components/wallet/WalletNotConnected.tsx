
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useWallet } from '@/contexts/WalletContext';
import { ChainType } from "@/lib/types";

const WalletNotConnected = () => {
  const { connectWallet } = useWallet();
  
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => connectWallet('polygon')}
          >
            Connect Wallet
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletNotConnected;
