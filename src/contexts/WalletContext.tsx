
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

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  const hasMetaMask = (): boolean => {
    return !!(window as WindowWithEthereum).ethereum;
  };

  const connectWallet = async (chain: ChainType): Promise<void> => {
    setIsConnecting(true);
    
    try {
      if (!hasMetaMask()) {
        toast({
          variant: "destructive",
          title: "MetaMask not found",
          description: "Please install MetaMask browser extension first.",
        });
        setIsConnecting(false);
        return Promise.reject("MetaMask not found");
      }
      
      // Request account access
      const ethereum = (window as WindowWithEthereum).ethereum;
      const accounts = await ethereum?.request({ method: 'eth_requestAccounts' });
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask');
      }
      
      const address = accounts[0];
      
      // Check current chain and switch if needed
      const currentChainId = await ethereum?.request({ method: 'eth_chainId' });
      const targetChainId = chainIdMap[chain];
      
      if (currentChainId !== targetChainId) {
        try {
          // Try to switch to the chain
          await ethereum?.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetChainId }],
          });
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            toast({
              variant: "destructive",
              title: "Network Error",
              description: `Please add ${chain} network to your MetaMask first.`,
            });
          }
          throw switchError;
        }
      }
      
      // Get balance
      const balanceWei = await ethereum?.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      
      // Convert from wei to native token (ETH, MATIC, etc.)
      const nativeBalance = parseInt(balanceWei, 16) / 1e18;
      
      // Create wallet object
      const mockWallet: WalletInfo = {
        address: address,
        chain: chain,
        balance: {
          // Mock USDT balance for now - in a real app, would call the USDT contract
          usdt: parseFloat((Math.random() * 10000).toFixed(2)),
          native: nativeBalance
        },
        isConnected: true,
        isAuthorized: false
      };
      
      setWallet(mockWallet);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${address.substring(0, 6)}...${address.substring(address.length - 4)} on ${chain}`,
      });
      
    } catch (error: any) {
      console.error('Error connecting to wallet:', error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: error.message || "Failed to connect to wallet. Please try again.",
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
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
    
    try {
      if (!hasMetaMask()) {
        throw new Error("MetaMask not found");
      }
      
      const ethereum = (window as WindowWithEthereum).ethereum;
      
      // In a real app, this would be a call to approve the USDT contract
      // For this demo, we'll simulate a personal signature to authorize
      const message = `I authorize ArbiRoot Navigator to spend my USDT on ${wallet.chain} network for arbitrage trading`;
      const signature = await ethereum?.request({
        method: 'personal_sign',
        params: [message, wallet.address],
      });
      
      if (!signature) {
        throw new Error("Failed to get signature");
      }
      
      // Update wallet state
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
