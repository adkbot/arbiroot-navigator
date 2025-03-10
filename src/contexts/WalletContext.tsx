
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { WalletInfo, ChainType } from '@/lib/types';
import { toast } from "@/components/ui/use-toast";

interface WalletContextType {
  wallet: WalletInfo | null;
  isConnecting: boolean;
  connectWallet: (chain: ChainType) => Promise<void>;
  disconnectWallet: () => void;
  authorizeSpending: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Load wallet from local storage on initial render
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

  // Save wallet to local storage when it changes
  useEffect(() => {
    if (wallet) {
      localStorage.setItem('wallet', JSON.stringify(wallet));
    } else {
      localStorage.removeItem('wallet');
    }
  }, [wallet]);

  const connectWallet = async (chain: ChainType): Promise<void> => {
    setIsConnecting(true);
    
    return new Promise((resolve, reject) => {
      try {
        // In a real implementation, this would connect to MetaMask or similar
        setTimeout(() => {
          const mockWallet: WalletInfo = {
            address: '0x' + Math.random().toString(16).slice(2, 12) + '...' + Math.random().toString(16).slice(2, 6),
            chain: chain,
            balance: {
              usdt: parseFloat((Math.random() * 10000).toFixed(2)),
              native: parseFloat((Math.random() * 5).toFixed(4))
            },
            isConnected: true,
            isAuthorized: false
          };
          
          setWallet(mockWallet);
          setIsConnecting(false);
          toast({
            title: "Wallet Connected",
            description: `Connected to ${mockWallet.address} on ${chain}`,
          });
          resolve();
        }, 1500);
      } catch (error) {
        setIsConnecting(false);
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: "Failed to connect to wallet. Please try again.",
        });
        reject(error);
      }
    });
  };

  const disconnectWallet = () => {
    setWallet(null);
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected",
    });
  };

  const authorizeSpending = async (): Promise<void> => {
    if (!wallet) return Promise.reject('No wallet connected');
    
    setIsConnecting(true);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        setWallet(prev => prev ? { ...prev, isAuthorized: true } : null);
        setIsConnecting(false);
        toast({
          title: "Spending Authorized",
          description: "The bot is now authorized to perform arbitrage trades",
        });
        resolve();
      }, 2000);
    });
  };

  return (
    <WalletContext.Provider
      value={{
        wallet,
        isConnecting,
        connectWallet,
        disconnectWallet,
        authorizeSpending
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
