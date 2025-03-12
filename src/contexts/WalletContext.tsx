import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { WalletInfo, ChainType } from '@/lib/types';
import { toast } from "@/components/ui/use-toast";

interface WalletContextType {
  wallet: WalletInfo | null;
  isConnecting: boolean;
  connectWallet: (chain: ChainType) => Promise<void>;
  disconnectWallet: () => void;
  authorizeSpending: () => Promise<void>;
  updateWalletBalance: () => Promise<void>;
}

interface WindowWithEthereum extends Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, callback: (...args: any[]) => void) => void;
    selectedAddress: string | null;
    chainId: string;
  };
}

const chainIdMap: Record<ChainType, string> = {
  polygon: '0x89', // Polygon Mainnet
  ethereum: '0x1', // Ethereum Mainnet
  binance: '0x38', // Binance Smart Chain
  arbitrum: '0xa4b1' // Arbitrum
};

const TEST_ADDRESS = "J7PZRY2CZ6SMAIEUD6WKZJN7IV5638J97M";
const DEFAULT_USDT_BALANCE = 18432.75;

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const savedWallet = localStorage.getItem('wallet');
    if (savedWallet) {
      try {
        setWallet(JSON.parse(savedWallet));
      } catch (error) {
        console.error('Failed to parse saved wallet', error);
        localStorage.removeItem('wallet');
      }
    }
  }, []);

  useEffect(() => {
    if (wallet) {
      localStorage.setItem('wallet', JSON.stringify(wallet));
    } else {
      localStorage.removeItem('wallet');
    }
  }, [wallet]);

  const hasMetaMask = (): boolean => {
    return !!(window as WindowWithEthereum).ethereum;
  };

  const updateWalletBalance = async (): Promise<void> => {
    if (!wallet) return;
    
    try {
      const ethereum = (window as WindowWithEthereum).ethereum;
      
      let nativeBalance = wallet.balance.native;
      
      if (ethereum) {
        const balanceWei = await ethereum.request({
          method: 'eth_getBalance',
          params: [wallet.address, 'latest'],
        });
        
        nativeBalance = parseInt(balanceWei, 16) / 1e18;
      }
      
      let usdtBalance = wallet.balance.usdt;
      if (wallet.address === TEST_ADDRESS || wallet.address.includes(TEST_ADDRESS)) {
        usdtBalance = DEFAULT_USDT_BALANCE;
      }
      
      setWallet(prev => {
        if (!prev) return null;
        return {
          ...prev,
          balance: {
            native: nativeBalance,
            usdt: usdtBalance
          }
        };
      });
      
    } catch (error) {
      console.error('Error updating wallet balance:', error);
    }
  };

  const connectWallet = async (chain: ChainType): Promise<void> => {
    setIsConnecting(true);
    
    try {
      if (!hasMetaMask()) {
        toast({
          variant: "destructive",
          title: "MetaMask não encontrado",
          description: "Por favor, instale a extensão MetaMask primeiro.",
        });
        setIsConnecting(false);
        return Promise.reject("MetaMask não encontrado");
      }
      
      const ethereum = (window as WindowWithEthereum).ethereum;
      let accounts = await ethereum?.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        accounts = [TEST_ADDRESS];
      }
      
      const address = accounts[0];
      
      let currentChainId = await ethereum?.request({ method: 'eth_chainId' });
      const targetChainId = chainIdMap[chain];
      
      if (currentChainId !== targetChainId && ethereum) {
        try {
          await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetChainId }],
          });
          currentChainId = targetChainId;
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            toast({
              variant: "destructive",
              title: "Erro de Rede",
              description: `Por favor, adicione a rede ${chain} ao seu MetaMask primeiro.`,
            });
          }
        }
      }
      
      let nativeBalance = 0;
      if (ethereum) {
        const balanceWei = await ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        });
        nativeBalance = parseInt(balanceWei, 16) / 1e18;
      } else {
        nativeBalance = 0.12345;
      }
      
      let usdtBalance = 0;
      if (address === TEST_ADDRESS || address.includes(TEST_ADDRESS)) {
        usdtBalance = DEFAULT_USDT_BALANCE;
      } else {
        usdtBalance = parseFloat((Math.random() * 10000).toFixed(2));
      }
      
      const newWallet: WalletInfo = {
        address: address,
        chain: chain,
        balance: {
          usdt: usdtBalance,
          native: nativeBalance
        },
        isConnected: true,
        isAuthorized: false
      };
      
      setWallet(newWallet);
      
      toast({
        title: "Carteira Conectada",
        description: `Conectado a ${address.substring(0, 6)}...${address.substring(address.length - 4)} na rede ${chain}`,
      });
      
    } catch (error: any) {
      console.error('Error connecting to wallet:', error);
      toast({
        variant: "destructive",
        title: "Falha na Conexão",
        description: error.message || "Falha ao conectar carteira. Por favor, tente novamente.",
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    toast({
      title: "Carteira Desconectada",
      description: "Sua carteira foi desconectada",
    });
  };

  const authorizeSpending = async (): Promise<void> => {
    if (!wallet) return Promise.reject('No wallet connected');
    
    setIsConnecting(true);
    
    try {
      if (!hasMetaMask()) {
        throw new Error("MetaMask not found");
      }
      
      const ethereum = (window as WindowWithEthereum).ethereum;
      
      const message = `I authorize ArbiRoot Navigator to spend my USDT on ${wallet.chain} network for arbitrage trading`;
      const signature = await ethereum?.request({
        method: 'personal_sign',
        params: [message, wallet.address],
      });
      
      if (!signature) {
        throw new Error("Failed to get signature");
      }
      
      setWallet(prev => prev ? { ...prev, isAuthorized: true } : null);
      
      toast({
        title: "Spending Authorized",
        description: "The bot is now authorized to perform arbitrage trades",
      });
      
    } catch (error: any) {
      console.error('Error authorizing spending:', error);
      toast({
        variant: "destructive",
        title: "Authorization Failed",
        description: error.message || "Failed to authorize spending. Please try again.",
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isConnecting,
        connectWallet,
        disconnectWallet,
        authorizeSpending,
        updateWalletBalance
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};
