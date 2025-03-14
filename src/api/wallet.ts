import { ethers } from 'ethers';
import { Logger } from '../lib/logger';
import { networkConfig } from '../config';

// ABI mínimo para tokens ERC20
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

export class WalletAPI {
  private providers: Map<string, ethers.providers.JsonRpcProvider> = new Map();
  private wallets: Map<string, ethers.Wallet> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Inicializar providers para cada rede
    Object.entries(networkConfig).forEach(([network, config]) => {
      const provider = new ethers.providers.JsonRpcProvider(config.rpc);
      this.providers.set(network, provider);
    });
  }

  public async connectWallet(network: string, privateKey: string): Promise<string> {
    try {
      const provider = this.providers.get(network);
      if (!provider) {
        throw new Error(`Rede ${network} não suportada`);
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      this.wallets.set(network, wallet);

      const address = await wallet.getAddress();
      this.logger.info(`Carteira conectada na rede ${network}: ${address}`);

      return address;
    } catch (error) {
      this.logger.error(`Erro ao conectar carteira na rede ${network}: ${error.message}`);
      throw error;
    }
  }

  public async getBalance(network: string): Promise<string> {
    const wallet = this.getWallet(network);
    const balance = await wallet.getBalance();
    return ethers.utils.formatEther(balance);
  }

  public async getTokenBalance(network: string, tokenAddress: string): Promise<string> {
    const wallet = this.getWallet(network);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    
    const balance = await token.balanceOf(await wallet.getAddress());
    return ethers.utils.formatEther(balance);
  }

  public async sendTransaction(
    network: string,
    to: string,
    amount: string,
    gasLimit?: number
  ): Promise<ethers.providers.TransactionResponse> {
    const wallet = this.getWallet(network);
    
    const tx = {
      to,
      value: ethers.utils.parseEther(amount),
      gasLimit: gasLimit || 21000
    };

    return await wallet.sendTransaction(tx);
  }

  public async sendToken(
    network: string,
    tokenAddress: string,
    to: string,
    amount: string
  ): Promise<ethers.providers.TransactionResponse> {
    const wallet = this.getWallet(network);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    
    const decimals = await token.decimals();
    const value = ethers.utils.parseUnits(amount, decimals);
    
    return await token.transfer(to, value);
  }

  public async approveToken(
    network: string,
    tokenAddress: string,
    spender: string,
    amount: string
  ): Promise<ethers.providers.TransactionResponse> {
    const wallet = this.getWallet(network);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    
    const decimals = await token.decimals();
    const value = ethers.utils.parseUnits(amount, decimals);
    
    return await token.approve(spender, value);
  }

  public async signMessage(network: string, message: string): Promise<string> {
    const wallet = this.getWallet(network);
    return await wallet.signMessage(message);
  }

  public async waitForTransaction(
    network: string,
    txHash: string,
    confirmations: number = 1
  ): Promise<ethers.providers.TransactionReceipt> {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new Error(`Rede ${network} não suportada`);
    }

    return await provider.waitForTransaction(txHash, confirmations);
  }

  public async estimateGas(
    network: string,
    to: string,
    data?: string
  ): Promise<ethers.BigNumber> {
    const wallet = this.getWallet(network);
    
    const tx = {
      from: await wallet.getAddress(),
      to,
      data
    };

    return await wallet.estimateGas(tx);
  }

  public async getNonce(network: string): Promise<number> {
    const wallet = this.getWallet(network);
    return await wallet.getTransactionCount();
  }

  public async getGasPrice(network: string): Promise<ethers.BigNumber> {
    const provider = this.providers.get(network);
    if (!provider) {
      throw new Error(`Rede ${network} não suportada`);
    }

    return await provider.getGasPrice();
  }

  public disconnectWallet(network: string): void {
    this.wallets.delete(network);
    this.logger.info(`Carteira desconectada da rede ${network}`);
  }

  private getWallet(network: string): ethers.Wallet {
    const wallet = this.wallets.get(network);
    if (!wallet) {
      throw new Error(`Carteira não conectada na rede ${network}`);
    }
    return wallet;
  }
}