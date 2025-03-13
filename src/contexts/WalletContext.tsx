
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { toast } from "@/components/ui/use-toast";
import { ethers } from 'ethers';
import { ChainType, WalletInfo } from '@/lib/types';

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
    removeListener: (event: string, callback: (...args: any[]) => void) => void;
    selectedAddress: string | null;
    chainId: string;
    isMetaMask?: boolean;
  };
}

// Chain IDs for different networks
const CHAIN_IDS = {
  ethereum: '0x1', // 1
  polygon: '0x89', // 137
  binance: '0x38', // 56
  arbitrum: '0xa4b1' // 42161
};

// Token contract addresses
const TOKEN_ADDRESSES = {
  polygon: {
    USDT: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f'
  },
  ethereum: {
    USDT: '0xdac17f958d2ee523a2206206994597c13d831ec7'
  },
  binance: {
    USDT: '0x55d398326f99059ff775485246999027b3197955'
  },
  arbitrum: {
    USDT: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9'
  }
};

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    // Try to restore wallet connection from localStorage
    const savedWallet = localStorage.getItem('wallet');
    if (savedWallet) {
      try {
        const parsedWallet = JSON.parse(savedWallet);
        
        // Check if MetaMask is still connected with this address
        setTimeout(async () => {
          const ethereum = (window as WindowWithEthereum).ethereum;
          if (ethereum) {
            try {
              // Force reconnection with MetaMask instead of auto-connecting
              const accounts = await ethereum.request({ method: 'eth_accounts' });
              
              if (accounts && accounts.length > 0 && 
                  accounts[0].toLowerCase() === parsedWallet.address.toLowerCase()) {
                // MetaMask is still connected, update the wallet with fresh data
                connectWallet(parsedWallet.chain);
              } else {
                // MetaMask disconnected or account changed, clear our state
                setWallet(null);
                localStorage.removeItem('wallet');
              }
            } catch (error) {
              console.error('Failed to check MetaMask connection', error);
              setWallet(null);
              localStorage.removeItem('wallet');
            }
          } else {
            setWallet(null);
            localStorage.removeItem('wallet');
          }
        }, 1000);
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

  // Listen for account changes in MetaMask
  useEffect(() => {
    const ethereum = (window as WindowWithEthereum).ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected from MetaMask
        setWallet(null);
        localStorage.removeItem('wallet');
        toast({
          title: "Carteira Desconectada",
          description: "Sua carteira foi desconectada do MetaMask",
        });
      } else if (wallet && accounts[0].toLowerCase() !== wallet.address.toLowerCase()) {
        // User switched accounts, update our state
        if (wallet.chain) {
          connectWallet(wallet.chain);
        }
      }
    };

    const handleChainChanged = (chainId: string) => {
      // User changed network, reload the page to reset the state
      window.location.reload();
    };

    ethereum.on('accountsChanged', handleAccountsChanged);
    ethereum.on('chainChanged', handleChainChanged);
    
    return () => {
      // Remove listeners on cleanup
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [wallet]);

  const hasMetaMask = (): boolean => {
    return !!(window as WindowWithEthereum).ethereum?.isMetaMask;
  };

  const getGasPrice = async (): Promise<number> => {
    try {
      const ethereum = (window as WindowWithEthereum).ethereum;
      if (!ethereum) throw new Error("MetaMask não encontrado");

      const provider = new ethers.providers.Web3Provider(ethereum as any);
      const gasPriceWei = await provider.getGasPrice();
      return parseFloat(ethers.utils.formatUnits(gasPriceWei, 'gwei'));
    } catch (error) {
      console.error("Erro ao obter taxa de gás:", error);
      return 0;
    }
  };

  const getTokenBalance = async (address: string, chain: ChainType): Promise<number> => {
    try {
      const ethereum = (window as WindowWithEthereum).ethereum;
      if (!ethereum) throw new Error("MetaMask não encontrado");

      const tokenAddress = TOKEN_ADDRESSES[chain]?.USDT;
      if (!tokenAddress) return 0;

      // Create a provider using the current connection
      const provider = new ethers.providers.Web3Provider(ethereum as any);
      
      // Create contract instance
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Get token balance and decimals
      const balance = await contract.balanceOf(address);
      const decimals = await contract.decimals();
      
      // Convert to human-readable format
      return parseFloat(ethers.utils.formatUnits(balance, decimals));
    } catch (error) {
      console.error("Error fetching token balance:", error);
      throw error; // Re-throw to handle in the calling function
    }
  };

  const updateWalletBalance = async (): Promise<void> => {
    if (!wallet) return;
    
    try {
      const ethereum = (window as WindowWithEthereum).ethereum;
      if (!ethereum) throw new Error("MetaMask não encontrado");

      // Create a provider
      const provider = new ethers.providers.Web3Provider(ethereum as any);
      
      // Get native balance (ETH, MATIC, BNB, etc.)
      const nativeBalanceWei = await provider.getBalance(wallet.address);
      const nativeBalance = parseFloat(ethers.utils.formatEther(nativeBalanceWei));
      
      // Get USDT balance
      const usdtBalance = await getTokenBalance(wallet.address, wallet.chain);
      
      setWallet(prev => prev ? {
        ...prev,
        balance: { 
          ...prev.balance,
          native: nativeBalance, 
          usdt: usdtBalance 
        }
      } : null);
      
      console.log("Updated balances:", { native: nativeBalance, usdt: usdtBalance });
      
    } catch (error) {
      console.error('Erro ao atualizar saldo:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar saldo",
        description: "Não foi possível obter o saldo atual da carteira.",
      });
      throw error;
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
        throw new Error("MetaMask não encontrado");
      }

      const ethereum = (window as WindowWithEthereum).ethereum;
      
      // Always request accounts to ensure MetaMask popup appears
      try {
        const accounts = await ethereum?.request({ method: 'eth_requestAccounts' });
        
        if (!accounts || accounts.length === 0) {
          throw new Error("Nenhuma conta encontrada no MetaMask.");
        }
        
        const address = accounts[0];
        
        // Get current chain ID
        const currentChainId = await ethereum?.request({ method: 'eth_chainId' });
        const targetChainId = CHAIN_IDS[chain];
        
        // Switch network if needed
        if (currentChainId !== targetChainId) {
          try {
            await ethereum?.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: targetChainId }],
            });
          } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
              // Add the network to MetaMask
              let networkParams;
              
              switch(chain) {
                case 'polygon':
                  networkParams = {
                    chainId: targetChainId,
                    chainName: 'Polygon Mainnet',
                    nativeCurrency: {
                      name: 'MATIC',
                      symbol: 'MATIC',
                      decimals: 18
                    },
                    rpcUrls: ['https://polygon-rpc.com'],
                    blockExplorerUrls: ['https://polygonscan.com']
                  };
                  break;
                case 'binance':
                  networkParams = {
                    chainId: targetChainId,
                    chainName: 'Binance Smart Chain',
                    nativeCurrency: {
                      name: 'BNB',
                      symbol: 'BNB',
                      decimals: 18
                    },
                    rpcUrls: ['https://bsc-dataseed.binance.org'],
                    blockExplorerUrls: ['https://bscscan.com']
                  };
                  break;
                case 'arbitrum':
                  networkParams = {
                    chainId: targetChainId,
                    chainName: 'Arbitrum One',
                    nativeCurrency: {
                      name: 'ETH',
                      symbol: 'ETH',
                      decimals: 18
                    },
                    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
                    blockExplorerUrls: ['https://arbiscan.io']
                  };
                  break;
                default:
                  throw new Error(`Rede ${chain} não suportada para adição automática.`);
              }
              
              try {
                await ethereum?.request({
                  method: 'wallet_addEthereumChain',
                  params: [networkParams]
                });
              } catch (addError) {
                throw new Error(`Erro ao adicionar a rede ${chain}: ${addError.message}`);
              }
            } else {
              throw switchError;
            }
          }
        }
        
        // Create a provider
        const provider = new ethers.providers.Web3Provider(ethereum as any);
        
        // Get native balance
        const balanceWei = await provider.getBalance(address);
        const nativeBalance = parseFloat(ethers.utils.formatEther(balanceWei));
        
        // Get USDT balance
        let usdtBalance = 0;
        try {
          usdtBalance = await getTokenBalance(address, chain);
        } catch (error) {
          console.error("Error fetching USDT balance:", error);
          // Continue with zero USDT balance but don't fail the whole connection
        }
        
        const newWallet: WalletInfo = {
          address,
          chain,
          balance: { 
            native: nativeBalance, 
            usdt: usdtBalance
          },
          isConnected: true,
          isAuthorized: false
        };
        
        setWallet(newWallet);
        
        const gasPrice = await getGasPrice();
        toast({
          title: "Carteira Conectada",
          description: `Conectado a ${address.substring(0, 6)}...${address.substring(address.length - 4)} na rede ${chain}. Taxa de gás: ${gasPrice.toFixed(2)} Gwei.`,
        });
        
      } catch (err: any) {
        if (err.code === -32002) {
          // MetaMask is already processing the request
          toast({
            variant: "default",
            title: "Ação pendente",
            description: "Verifique o MetaMask, uma solicitação de conexão já está aberta.",
          });
        } else {
          throw err;
        }
      }

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
      const message = `Autorizo este contrato a gastar USDT na rede ${wallet.chain} - ${Date.now()}`;
      
      const signature = await ethereum?.request({
        method: 'personal_sign',
        params: [ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message)), wallet.address],
      });

      if (!signature) throw new Error("Falha ao obter assinatura");

      setWallet(prev => prev ? { ...prev, isAuthorized: true } : null);

      toast({ 
        title: "Autorização Concedida", 
        description: "Transação autorizada com sucesso." 
      });

    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Erro ao autorizar", 
        description: error.message 
      });
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <WalletContext.Provider value={{ 
      wallet, 
      isConnecting, 
      connectWallet, 
      disconnectWallet, 
      authorizeSpending, 
      updateWalletBalance, 
      getGasPrice 
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet deve ser usado dentro de WalletProvider');
  return context;
};
