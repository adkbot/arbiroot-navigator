
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { ChainType } from "@/lib/types";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet, 
  CircleDollarSign, 
  Shield, 
  CheckCircle, 
  Clock
} from "lucide-react";
import { useWallet } from '@/contexts/WalletContext';

const WalletConnect = () => {
  const { wallet, isConnecting, connectWallet, disconnectWallet, authorizeSpending } = useWallet();
  const [selectedChain, setSelectedChain] = useState<ChainType>('polygon');
  
  // Simple chain selection options
  const chains: ChainType[] = ['polygon', 'ethereum', 'binance', 'arbitrum'];
  
  // If not connected, show the connect button
  if (!wallet) {
    return (
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="mr-2">
              {selectedChain.charAt(0).toUpperCase() + selectedChain.slice(1)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-2">
              {chains.map(chain => (
                <Button 
                  key={chain}
                  variant={chain === selectedChain ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSelectedChain(chain)}
                >
                  {chain.charAt(0).toUpperCase() + chain.slice(1)}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        
        <Button 
          variant="default" 
          size="sm" 
          onClick={() => connectWallet(selectedChain)}
          disabled={isConnecting}
          className="flex items-center gap-2"
        >
          {isConnecting ? (
            <>
              <Clock className="h-4 w-4 animate-spin" />
              Conectando...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4" />
              Conectar Carteira
            </>
          )}
        </Button>
      </div>
    );
  }
  
  // If connected, show wallet info
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2"
        >
          <Badge 
            variant="outline" 
            className={`h-2 w-2 rounded-full ${wallet.chain === 'polygon' ? 'bg-purple-500' : 
              wallet.chain === 'ethereum' ? 'bg-blue-500' : 
              wallet.chain === 'binance' ? 'bg-yellow-500' : 'bg-red-500'}`}
          />
          <span className="text-xs font-medium truncate max-w-[120px]">{wallet.address}</span>
          <CircleDollarSign className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Detalhes da Carteira</h4>
            <Badge variant="outline">
              {wallet.chain.charAt(0).toUpperCase() + wallet.chain.slice(1)}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Endereço</span>
              <span className="text-sm font-medium truncate max-w-[200px]">{wallet.address}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Saldo USDT</span>
              <span className="text-sm font-medium">${wallet.balance.usdt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Saldo Nativo</span>
              <span className="text-sm font-medium">{wallet.balance.native.toFixed(4)} {
                wallet.chain === 'polygon' ? 'MATIC' : 
                wallet.chain === 'ethereum' ? 'ETH' : 
                wallet.chain === 'binance' ? 'BNB' : 'ARB'
              }</span>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="text-sm">Autorizar Bot para Trading</span>
              </div>
              
              {wallet.isAuthorized ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs">Autorizado</span>
                </div>
              ) : (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={authorizeSpending}
                  disabled={isConnecting}
                  className="h-7 text-xs"
                >
                  {isConnecting ? "Processando..." : "Autorizar"}
                </Button>
              )}
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={disconnectWallet}
            className="w-full mt-2"
          >
            Desconectar Carteira
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default WalletConnect;
