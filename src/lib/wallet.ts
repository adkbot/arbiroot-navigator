import { ethers } from 'ethers';
import { Logger } from './logger';
import { WalletInfo, ChainType } from './types';

export class WalletManager {
  private providers: Record<ChainType, ethers.providers.JsonRpcProvider>;
  private wallets: Map<string, ethers.Wallet>;
  private logger: Logger;
  
  // Configurações das redes suportadas
  private readonly CHAIN_CONFIGS = {
    ethereum: {
      rpc: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
      chainId: 1,
      nativeCurrency: 'ETH'
    },
    polygon: {
      rpc: 'https://polygon-rpc.com',
      chainId: 137,
      nativeCurrency: 'MATIC'
    },
    binance: {
      rpc: 'https://bsc-dataseed.binance.org',
      chainId: 56,
      nativeCurrency: 'BNB'
    },
    arbitrum: {
      rpc: 'https://arb1.arbitrum.io/rpc',
      chainId: 42161,
      nativeCurrency: 'ETH'
    }
  };

  // Endereços dos contratos de tokens mais comuns
  private readonly TOKEN_ADDRESSES = {
    ethereum: {
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    },
    polygon: {
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
    },
    binance: {
      USDT: '0x55d398326f99059fF775485246999027B3197955',
      USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
      BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
    },
    arbitrum: {
      USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
      DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
    }
  };

  constructor() {
    this.logger = new Logger('WalletManager');
    this.wallets = new Map();
    this.providers = this.initializeProviders();
  }

  private initializeProviders(): Record<ChainType, ethers.providers.JsonRpcProvider> {
    const providers: Partial<Record<ChainType, ethers.providers.JsonRpcProvider>> = {};
    
    Object.entries(this.CHAIN_CONFIGS).forEach(([chain, config]) => {
      try {
        providers[chain as ChainType] = new ethers.providers.JsonRpcProvider(
          config.rpc,
          {
            name: chain,
            chainId: config.chainId
          }
        );
      } catch (error) {
        this.logger.error(`Erro ao inicializar provider para ${chain}:`, error);
      }
    });

    return providers as Record<ChainType, ethers.providers.JsonRpcProvider>;
  }

  async connectWallet(privateKey: string, chain: ChainType): Promise<WalletInfo> {
    try {
      const provider = this.providers[chain];
      if (!provider) {
        throw new Error(`Provider não encontrado para a rede ${chain}`);
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      const address = await wallet.getAddress();
      
      this.wallets.set(address, wallet);
      
      const walletInfo = await this.getWalletInfo(address, chain);
      this.logger.info(`Carteira conectada com sucesso: ${address} na rede ${chain}`);
      
      return walletInfo;
    } catch (error) {
      this.logger.error('Erro ao conectar carteira:', error);
      throw new Error(`Falha ao conectar carteira: ${error.message}`);
    }
  }

  async getWalletInfo(address: string, chain: ChainType): Promise<WalletInfo> {
    try {
      const provider = this.providers[chain];
      const nativeBalance = await provider.getBalance(address);
      const tokenBalances = await this.getTokenBalances(address, chain);

      return {
        address,
        chain,
        balance: {
          native: parseFloat(ethers.utils.formatEther(nativeBalance)),
          usdt: tokenBalances.USDT || 0,
          ...tokenBalances
        },
        isConnected: true,
        isAuthorized: true,
        lastActivity: Date.now()
      };
    } catch (error) {
      this.logger.error(`Erro ao buscar informações da carteira ${address}:`, error);
      throw error;
    }
  }

  private async getTokenBalances(address: string, chain: ChainType): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};
    const tokens = this.TOKEN_ADDRESSES[chain];

    const ERC20_ABI = [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)'
    ];

    for (const [symbol, tokenAddress] of Object.entries(tokens)) {
      try {
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, this.providers[chain]);
        const balance = await contract.balanceOf(address);
        const decimals = await contract.decimals();
        balances[symbol] = parseFloat(ethers.utils.formatUnits(balance, decimals));
      } catch (error) {
        this.logger.error(`Erro ao buscar saldo de ${symbol}:`, error);
        balances[symbol] = 0;
      }
    }

    return balances;
  }

  async sendTransaction(
    fromAddress: string,
    toAddress: string,
    amount: string,
    chain: ChainType,
    tokenAddress?: string
  ): Promise<ethers.providers.TransactionResponse> {
    const wallet = this.wallets.get(fromAddress);
    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    try {
      if (tokenAddress) {
        // Transferência de token ERC20
        const contract = new ethers.Contract(
          tokenAddress,
          [
            'function transfer(address, uint256) returns (bool)',
            'function decimals() view returns (uint8)'
          ],
          wallet
        );

        const decimals = await contract.decimals();
        const value = ethers.utils.parseUnits(amount, decimals);
        
        const tx = await contract.transfer(toAddress, value, {
          gasLimit: 100000 // Estimativa de gas para transferências ERC20
        });

        return tx;
      } else {
        // Transferência de moeda nativa
        const tx = await wallet.sendTransaction({
          to: toAddress,
          value: ethers.utils.parseEther(amount)
        });

        return tx;
      }
    } catch (error) {
      this.logger.error('Erro ao enviar transação:', error);
      throw new Error(`Falha ao enviar transação: ${error.message}`);
    }
  }

  async signMessage(address: string, message: string): Promise<string> {
    const wallet = this.wallets.get(address);
    if (!wallet) {
      throw new Error('Carteira não encontrada');
    }

    try {
      return await wallet.signMessage(message);
    } catch (error) {
      this.logger.error('Erro ao assinar mensagem:', error);
      throw new Error(`Falha ao assinar mensagem: ${error.message}`);
    }
  }

  async disconnectWallet(address: string): Promise<void> {
    this.wallets.delete(address);
    this.logger.info(`Carteira desconectada: ${address}`);
  }

  isConnected(address: string): boolean {
    return this.wallets.has(address);
  }

  getProvider(chain: ChainType): ethers.providers.JsonRpcProvider {
    const provider = this.providers[chain];
    if (!provider) {
      throw new Error(`Provider não encontrado para a rede ${chain}`);
    }
    return provider;
  }
}