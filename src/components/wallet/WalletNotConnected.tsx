
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useWallet } from '@/contexts/WalletContext';
import { useState } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChainType } from "@/lib/types";

const WalletNotConnected = () => {
  const { connectWallet, isConnecting } = useWallet();
  const [selectedChain, setSelectedChain] = useState<ChainType>('polygon');
  
  const handleConnectWallet = async () => {
    try {
      await connectWallet(selectedChain);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Wallet Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          <Wallet className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            Conecte sua carteira para executar operações de arbitragem em tempo real
          </p>
          
          <div className="w-full max-w-xs">
            <Select 
              value={selectedChain} 
              onValueChange={(value) => setSelectedChain(value as ChainType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a rede" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="polygon">Polygon (MATIC)</SelectItem>
                <SelectItem value="ethereum">Ethereum (ETH)</SelectItem>
                <SelectItem value="binance">Binance Smart Chain (BNB)</SelectItem>
                <SelectItem value="arbitrum">Arbitrum (ARB)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="default" 
            onClick={handleConnectWallet}
            disabled={isConnecting}
            className="w-full max-w-xs"
          >
            {isConnecting ? "Conectando..." : "Conectar Carteira"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletNotConnected;
