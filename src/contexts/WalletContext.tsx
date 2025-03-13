import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { toast } from "@/components/ui/use-toast";

enum ChainType {
  POLYGON = 'polygon',
  ETHEREUM = 'ethereum',
  BINANCE = 'binance',
  ARBITRUM = 'arbitrum'
}

interface WalletInfo {
  address: string;
  chain: ChainType;
  balance: {
    native: number;
    usdt: number;
  };
  isConnected: boolean;
  isAuthorized: boolean;
}

interface WalletContextType {
  wallet: WalletInfo | null;
  isConnecting: boolean;
  connectWallet: (chain: ChainType) => Promise<void>;
  disconnectWallet: () => void;
  authorizeSpending: () => Promise<void>;
  updateWalletBalance: () => Promise<void>;
  getGasPrice: () => Promise<number>;
}

interface WindowWithEthereum extends Window {
  ethereum?: {
    request: (args: { method: string; params?: any[] }) => Promise<any>;
    on: (event: string, callback: (...args: any[]) => void) => void;
    selectedAddress: string | null;
    chainId: string;
  };
}

// RPCs confiáveis
const ALCHEMY_RPC = "https://eth-mainnet.alchemyapi.io/v2/SUA_CHAVE";
const INFURA_RPC = "https://mainnet.infura.io/v3/SUA_CHAVE";

const getRPCProvider = (chain: ChainType) => {
  switch (chain) {
    case ChainType.ETHEREUM:
      return ALCHEMY_RPC;
    case ChainType.POLYGON:
      return "https://polygon-rpc.com";
    case ChainType.BINANCE:
      return "https://bsc-dataseed.binance.org/";
    case ChainType.ARBITRUM:
      return "https://arb1.arbitrum.io/rpc";
    default:
      throw new Error("Rede não suportada");
  }
};

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

  const getGasPrice = async (): Promise<number> => {
    try {
      const ethereum = (window as WindowWithEthereum).ethereum;
      if (!ethereum) throw new Error("MetaMask não encontrado");

      const gasPriceWei = await ethereum.request({ method: 'eth_gasPrice' });
      return parseInt(gasPriceWei, 16) / 1e9;
    } catch (error) {
      console.error("Erro ao obter taxa de gás:", error);
      return 0;
    }
  };

  const updateWalletBalance = async (): Promise<void> => {
    if (!wallet) return;
    
    try {
      const rpcUrl = getRPCProvider(wallet.chain);
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_getBalance",
          params: [wallet.address, "latest"],
          id: 1,
        }),
      });
      const data = await response.json();
      const nativeBalance = parseInt(data.result, 16) / 1e18;

      setWallet(prev => prev ? {
        ...prev,
        balance: { native: nativeBalance, usdt: prev.balance.usdt }
      } : null);
      
    } catch (error) {
      console.error('Erro ao atualizar saldo:', error);
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
      const accounts = await ethereum?.request({ method: 'eth_requestAccounts' });

      if (!accounts || accounts.length === 0) {
        throw new Error("Nenhuma conta encontrada no MetaMask.");
      }

      const address = accounts[0];

      let currentChainId = await ethereum?.request({ method: 'eth_chainId' });
      const targetChainId = getRPCProvider(chain);

      if (currentChainId !== targetChainId && ethereum) {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainId }],
        });
      }

      const balanceWei = await ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });
      const nativeBalance = parseInt(balanceWei, 16) / 1e18;

      const newWallet: WalletInfo = {
        address,
        chain,
        balance: { usdt: 0, native: nativeBalance },
        isConnected: true,
        isAuthorized: false
      };

      setWallet(newWallet);

      const gasPrice = await getGasPrice();
      toast({
        title: "Carteira Conectada",
        description: `Conectado a ${address.substring(0, 6)}...${address.substring(address.length - 4)} na rede ${chain}. Taxa de gás: ${gasPrice.toFixed(2)} Gwei.`,
      });

    } catch (error: any) {
      console.error('Erro ao conectar carteira:', error);
      toast({
        variant: "destructive",
        title: "Falha na Conexão",
        description: error.message || "Erro ao conectar carteira.",
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWallet(null);
    localStorage.removeItem('wallet');
    toast({
      title: "Carteira Desconectada",
      description: "Sua carteira foi desconectada",
    });
  };

  const authorizeSpending = async (): Promise<void> => {
    if (!wallet) return Promise.reject('Nenhuma carteira conectada');
    
    setIsConnecting(true);
    
    try {
      if (!hasMetaMask()) throw new Error("MetaMask não encontrado");

      const ethereum = (window as WindowWithEthereum).ethereum;
      const message = `Autorizo este contrato a gastar USDT na rede ${wallet.chain}`;
      const signature = await ethereum?.request({
        method: 'personal_sign',
        params: [message, wallet.address],
      });

      if (!signature) throw new Error("Falha ao obter assinatura");

      setWallet(prev => prev ? { ...prev, isAuthorized: true } : null);

      toast({ title: "Autorização Concedida", description: "Transação autorizada com sucesso." });

    } catch (error: any) {
      toast({ variant: "destructive", title: "Erro ao autorizar", description: error.message });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <WalletContext.Provider value={{ wallet, isConnecting, connectWallet, disconnectWallet, authorizeSpending, updateWalletBalance, getGasPrice }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet deve ser usado dentro de WalletProvider');
  return context;
};
