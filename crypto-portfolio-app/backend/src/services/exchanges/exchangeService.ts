import { BinanceClient } from './binanceClient';
import { CoinbaseClient } from './coinbaseClient';
import { loggingService } from '../loggingService';
import { prisma } from '../../config/database';
import { EventEmitter } from 'events';

interface ExchangeBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

interface ExchangeAccountInfo {
  balances: ExchangeBalance[];
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: Date;
}

interface ExchangeTrade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  commission: number;
  commissionAsset: string;
  time: Date;
  isMaker: boolean;
}

interface ExchangeCredentials {
  id: string;
  userId: string;
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  sandbox: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ExchangeService extends EventEmitter {
  private exchangeClients: Map<string, any> = new Map();
  private publicClients: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializePublicClients();
  }

  private initializePublicClients(): void {
    // Initialize public clients that don't require authentication
    this.publicClients.set('binance', BinanceClient.createPublic());
    this.publicClients.set('coinbase', CoinbaseClient.createPublic());
  }

  async getUserExchangeClient(userId: string, exchange: string): Promise<any> {
    const cacheKey = `${userId}_${exchange}`;
    
    if (this.exchangeClients.has(cacheKey)) {
      return this.exchangeClients.get(cacheKey);
    }

    const credentials = await this.getUserCredentials(userId, exchange);
    if (!credentials) {
      throw new Error(`No ${exchange} credentials found for user ${userId}`);
    }

    let client;
    switch (exchange.toLowerCase()) {
      case 'binance':
        client = BinanceClient.createWithCredentials(credentials.apiKey, credentials.apiSecret);
        break;
      case 'coinbase':
        if (!credentials.passphrase) {
          throw new Error('Passphrase is required for Coinbase Pro');
        }
        client = CoinbaseClient.createWithCredentials(credentials.apiKey, credentials.apiSecret, credentials.passphrase);
        break;
      default:
        throw new Error(`Exchange ${exchange} not supported`);
    }

    this.exchangeClients.set(cacheKey, client);
    return client;
  }

  getPublicClient(exchange: string): any {
    const client = this.publicClients.get(exchange.toLowerCase());
    if (!client) {
      throw new Error(`Public client for ${exchange} not available`);
    }
    return client;
  }

  async getUserCredentials(userId: string, exchange: string): Promise<ExchangeCredentials | null> {
    try {
      const credentials = await prisma.userExchangeCredential.findFirst({
        where: {
          userId,
          exchange: exchange.toLowerCase(),
          isActive: true
        }
      });

      return credentials as ExchangeCredentials | null;
    } catch (error) {
      loggingService.error('Failed to get user credentials', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange
      });
      return null;
    }
  }

  async syncUserBalances(userId: string, exchange: string = 'binance'): Promise<ExchangeAccountInfo> {
    try {
      const exchangeClient = await this.getUserExchangeClient(userId, exchange);
      const accountInfo = await exchangeClient.getAccountInfo();
      
      // Update user holdings in database
      await this.updateUserHoldings(userId, exchange, accountInfo.balances);

      loggingService.info('User balances synced successfully', {
        userId,
        exchange,
        balanceCount: accountInfo.balances.length
      });

      return accountInfo;
    } catch (error) {
      loggingService.error('Failed to sync user balances', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange
      });
      throw error;
    }
  }

  private async updateUserHoldings(
    userId: string, 
    exchange: string, 
    balances: ExchangeBalance[]
  ): Promise<void> {
    try {
      // Use transaction for data consistency
      await prisma.$transaction(async (tx) => {
        // Clear existing exchange holdings
        await tx.holding.deleteMany({
          where: {
            userId,
            source: exchange
          }
        });

        // Insert new holdings
        const holdings = balances
          .filter(balance => balance.total > 0)
          .map(balance => ({
            userId,
            symbol: balance.asset,
            amount: balance.total,
            availableAmount: balance.free,
            lockedAmount: balance.locked,
            source: exchange,
            lastUpdated: new Date()
          }));

        if (holdings.length > 0) {
          await tx.holding.createMany({
            data: holdings
          });
        }
      });

      loggingService.info('User holdings updated successfully', {
        userId,
        exchange,
        holdingCount: balances.length
      });
    } catch (error) {
      loggingService.error('Failed to update user holdings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange
      });
      throw error;
    }
  }

  async importTradingHistory(
    userId: string, 
    exchange: string = 'binance', 
    symbol: string = ''
  ): Promise<{ imported: number; total: number; exchange: string; symbol: string }> {
    try {
      const exchangeClient = await this.getUserExchangeClient(userId, exchange);
      const trades = await exchangeClient.getTradingHistory(symbol);

      const importedCount = await this.storeTradingHistory(userId, exchange, trades);

      loggingService.info('Trading history imported successfully', {
        userId,
        exchange,
        symbol,
        imported: importedCount,
        total: trades.length
      });

      return {
        imported: importedCount,
        total: trades.length,
        exchange,
        symbol
      };
    } catch (error) {
      loggingService.error('Failed to import trading history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange,
        symbol
      });
      throw error;
    }
  }

  private async storeTradingHistory(
    userId: string, 
    exchange: string, 
    trades: ExchangeTrade[]
  ): Promise<number> {
    let importedCount = 0;
    
    for (const trade of trades) {
      try {
        const existingTransaction = await prisma.transaction.findFirst({
          where: {
            userId,
            externalId: `${exchange}_${trade.id}`,
            source: exchange
          }
        });

        if (!existingTransaction) {
          await prisma.transaction.create({
            data: {
              userId,
              symbol: trade.symbol,
              type: trade.side.toUpperCase() as 'BUY' | 'SELL',
              amount: trade.quantity,
              price: trade.price,
              fee: trade.commission,
              feeAsset: trade.commissionAsset,
              timestamp: trade.time,
              externalId: `${exchange}_${trade.id}`,
              source: exchange,
              status: 'COMPLETED',
              metadata: {
                isMaker: trade.isMaker,
                originalData: trade
              }
            }
          });
          importedCount++;
        }
      } catch (error) {
        loggingService.warn('Failed to import individual trade', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId,
          tradeId: trade.id,
          exchange
        });
      }
    }

    return importedCount;
  }

  async getCurrentPrices(exchange: string = 'binance', symbols: string[] = []): Promise<Record<string, any>> {
    try {
      const publicClient = this.getPublicClient(exchange);
      return await publicClient.getCurrentPrices(symbols);
    } catch (error) {
      loggingService.error('Failed to get current prices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        exchange,
        symbols
      });
      throw error;
    }
  }

  async getHistoricalPrices(
    exchange: string = 'binance',
    symbol: string,
    interval: string = '1d',
    limit: number = 100
  ): Promise<any[]> {
    try {
      const publicClient = this.getPublicClient(exchange);
      return await publicClient.getHistoricalPrices(symbol, interval, limit);
    } catch (error) {
      loggingService.error('Failed to get historical prices', {
        error: error instanceof Error ? error.message : 'Unknown error',
        exchange,
        symbol,
        interval,
        limit
      });
      throw error;
    }
  }

  async getExchangeInfo(exchange: string = 'binance'): Promise<any> {
    try {
      const publicClient = this.getPublicClient(exchange);
      return await publicClient.getExchangeInfo();
    } catch (error) {
      loggingService.error('Failed to get exchange info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        exchange
      });
      throw error;
    }
  }

  async testConnection(exchange: string = 'binance'): Promise<{ connected: boolean; serverTime?: Date; latency?: number; error?: string }> {
    try {
      const publicClient = this.getPublicClient(exchange);
      return await publicClient.testConnection();
    } catch (error) {
      loggingService.error('Connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        exchange
      });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testUserConnection(userId: string, exchange: string = 'binance'): Promise<{ connected: boolean; error?: string }> {
    try {
      const exchangeClient = await this.getUserExchangeClient(userId, exchange);
      const accountInfo = await exchangeClient.getAccountInfo();
      
      return {
        connected: true
      };
    } catch (error) {
      loggingService.error('User connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange
      });
      return {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  setupRealTimeUpdates(exchange: string, symbols: string[], callback: (data: any) => void): void {
    try {
      const publicClient = this.getPublicClient(exchange);
      
      publicClient.setupWebSocket(symbols, (data: any) => {
        this.emit('priceUpdate', data);
        callback(data);
      });

      loggingService.info('Real-time updates setup completed', {
        exchange,
        symbols
      });
    } catch (error) {
      loggingService.error('Failed to setup real-time updates', {
        error: error instanceof Error ? error.message : 'Unknown error',
        exchange,
        symbols
      });
      throw error;
    }
  }

  async validateCredentials(userId: string, exchange: string, apiKey: string, apiSecret: string, passphrase?: string): Promise<boolean> {
    try {
      let client;
      switch (exchange.toLowerCase()) {
        case 'binance':
          client = BinanceClient.createWithCredentials(apiKey, apiSecret);
          break;
        case 'coinbase':
          if (!passphrase) {
            throw new Error('Passphrase is required for Coinbase Pro');
          }
          client = CoinbaseClient.createWithCredentials(apiKey, apiSecret, passphrase);
          break;
        default:
          throw new Error(`Exchange ${exchange} not supported`);
      }

      await client.getAccountInfo();
      return true;
    } catch (error) {
      loggingService.warn('Credentials validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange
      });
      return false;
    }
  }

  async saveUserCredentials(
    userId: string,
    exchange: string,
    apiKey: string,
    apiSecret: string,
    sandbox: boolean = false,
    passphrase?: string
  ): Promise<ExchangeCredentials> {
    try {
      // Validate credentials first
      const isValid = await this.validateCredentials(userId, exchange, apiKey, apiSecret, passphrase);
      if (!isValid) {
        throw new Error('Invalid API credentials');
      }

      // Deactivate existing credentials
      await prisma.userExchangeCredential.updateMany({
        where: {
          userId,
          exchange: exchange.toLowerCase()
        },
        data: {
          isActive: false
        }
      });

      // Create new credentials record
      const credentials = await prisma.userExchangeCredential.create({
        data: {
          userId,
          exchange: exchange.toLowerCase(),
          apiKey,
          apiSecret, // In production, this should be encrypted
          passphrase: passphrase || null,
          sandboxMode: sandbox,
          isActive: true
        }
      });

      // Clear cached client to force re-authentication
      const cacheKey = `${userId}_${exchange}`;
      this.exchangeClients.delete(cacheKey);

      loggingService.info('User credentials saved successfully', {
        userId,
        exchange,
        sandbox
      });

      return credentials as ExchangeCredentials;
    } catch (error) {
      loggingService.error('Failed to save user credentials', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange
      });
      throw error;
    }
  }

  async removeUserCredentials(userId: string, exchange: string): Promise<void> {
    try {
      await prisma.userExchangeCredential.updateMany({
        where: {
          userId,
          exchange: exchange.toLowerCase()
        },
        data: {
          isActive: false
        }
      });

      // Clear cached client
      const cacheKey = `${userId}_${exchange}`;
      this.exchangeClients.delete(cacheKey);

      loggingService.info('User credentials removed successfully', {
        userId,
        exchange
      });
    } catch (error) {
      loggingService.error('Failed to remove user credentials', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        exchange
      });
      throw error;
    }
  }

  getSupportedExchanges(): string[] {
    return ['binance', 'coinbase']; // Will expand as more exchanges are added
  }

  async getExchangeStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};
    
    for (const exchange of this.getSupportedExchanges()) {
      try {
        const connectionTest = await this.testConnection(exchange);
        status[exchange] = connectionTest;
      } catch (error) {
        status[exchange] = {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return status;
  }
}

// Create singleton instance
export const exchangeService = new ExchangeService();
export default exchangeService;