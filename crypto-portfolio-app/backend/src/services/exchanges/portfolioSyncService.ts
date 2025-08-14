import { EventEmitter } from 'events';
import { exchangeService } from './exchangeService';
import { cacheService } from '../cacheService';
import { rateLimitService } from '../rateLimitService';
import { loggingService } from '../loggingService';
import { prisma } from '../../config/database';

interface ExchangeBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

interface PortfolioSyncRequest {
  userId: string;
  exchange: string;
  syncType?: 'full' | 'balances' | 'transactions' | 'orders';
  forceRefresh?: boolean;
}

interface PortfolioSyncResponse {
  userId: string;
  exchange: string;
  syncType: string;
  syncedAt: Date;
  balances: ExchangeBalance[];
  totalValue: number;
  lastTransactionId?: string;
  errors?: string[];
  warnings?: string[];
}

interface ExchangeTransaction {
  transactionId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  feeAsset: string;
  timestamp: Date;
  type: 'trade' | 'deposit' | 'withdrawal';
}

interface SyncStatus {
  userId: string;
  exchange: string;
  status: 'syncing' | 'completed' | 'failed';
  progress: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

class PortfolioSyncService extends EventEmitter {
  private syncStatuses = new Map<string, SyncStatus>();
  private syncQueue = new Map<string, PortfolioSyncRequest[]>();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  async syncPortfolio(request: PortfolioSyncRequest): Promise<PortfolioSyncResponse> {
    const { userId, exchange, syncType = 'full', forceRefresh = false } = request;
    const syncKey = `${userId}:${exchange}`;

    try {
      // Check if already syncing
      const currentSync = this.syncStatuses.get(syncKey);
      if (currentSync && currentSync.status === 'syncing') {
        throw new Error(`Portfolio sync already in progress for ${exchange}`);
      }

      // Check rate limits
      await rateLimitService.waitForExchangeAvailability(exchange, 1);

      // Start sync status tracking
      const syncStatus: SyncStatus = {
        userId,
        exchange,
        status: 'syncing',
        progress: 0,
        startTime: new Date()
      };
      this.syncStatuses.set(syncKey, syncStatus);

      this.emit('sync-started', { userId, exchange, syncType });

      loggingService.info('Starting portfolio sync', {
        userId,
        exchange,
        syncType,
        forceRefresh
      });

      // Check cache if not force refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedPortfolioData(userId, exchange);
        if (cachedData) {
          loggingService.info('Using cached portfolio data', { userId, exchange });
          this.syncStatuses.delete(syncKey);
          return cachedData;
        }
      }

      // Perform sync based on type
      let syncResponse: PortfolioSyncResponse;
      
      switch (syncType) {
        case 'balances':
          syncResponse = await this.syncBalances(userId, exchange);
          break;
        case 'transactions':
          syncResponse = await this.syncTransactions(userId, exchange);
          break;
        case 'orders':
          syncResponse = await this.syncOrders(userId, exchange);
          break;
        case 'full':
        default:
          syncResponse = await this.syncFull(userId, exchange);
          break;
      }

      // Update sync status
      syncStatus.status = 'completed';
      syncStatus.endTime = new Date();
      syncStatus.progress = 100;
      this.syncStatuses.set(syncKey, syncStatus);

      // Cache the result
      await this.cachePortfolioData(userId, exchange, syncResponse);

      // Update database
      await this.updatePortfolioInDatabase(syncResponse);

      this.emit('sync-completed', syncResponse);

      loggingService.info('Portfolio sync completed', {
        userId,
        exchange,
        syncType,
        balancesCount: syncResponse.balances.length,
        totalValue: syncResponse.totalValue
      });

      // Clean up sync status after delay
      setTimeout(() => {
        this.syncStatuses.delete(syncKey);
      }, 300000); // 5 minutes

      return syncResponse;

    } catch (error: any) {
      // Update sync status with error
      const syncStatus = this.syncStatuses.get(syncKey);
      if (syncStatus) {
        syncStatus.status = 'failed';
        syncStatus.error = error.message;
        syncStatus.endTime = new Date();
        this.syncStatuses.set(syncKey, syncStatus);
      }

      this.emit('sync-failed', { userId, exchange, error: error.message });

      loggingService.error('Portfolio sync failed', {
        userId,
        exchange,
        syncType,
        error: error.message
      });

      throw error;
    }
  }

  async syncBalances(userId: string, exchange: string): Promise<PortfolioSyncResponse> {
    const client = await exchangeService.getAuthenticatedClient(userId, exchange);
    
    let balances: ExchangeBalance[] = [];
    
    switch (exchange) {
      case 'binance':
        balances = await this.syncBinanceBalances(client);
        break;
      case 'coinbase':
        balances = await this.syncCoinbaseBalances(client);
        break;
      case 'kraken':
        balances = await this.syncKrakenBalances(client);
        break;
      case 'kucoin':
        balances = await this.syncKuCoinBalances(client);
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }

    // Calculate total value (would need price service)
    const totalValue = await this.calculatePortfolioValue(balances);

    return {
      userId,
      exchange,
      syncType: 'balances',
      syncedAt: new Date(),
      balances,
      totalValue
    };
  }

  async syncTransactions(userId: string, exchange: string): Promise<PortfolioSyncResponse> {
    const client = await exchangeService.getAuthenticatedClient(userId, exchange);
    
    // Get last synced transaction ID from database
    const lastSyncedId = await this.getLastSyncedTransactionId(userId, exchange);
    
    let transactions: ExchangeTransaction[] = [];
    
    switch (exchange) {
      case 'binance':
        transactions = await this.syncBinanceTransactions(client, lastSyncedId);
        break;
      case 'coinbase':
        transactions = await this.syncCoinbaseTransactions(client, lastSyncedId);
        break;
      case 'kraken':
        transactions = await this.syncKrakenTransactions(client, lastSyncedId);
        break;
      case 'kucoin':
        transactions = await this.syncKuCoinTransactions(client, lastSyncedId);
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }

    // Store transactions in database
    await this.storeTransactions(userId, exchange, transactions);

    // Get updated balances after transaction sync
    const balances = await this.calculateBalancesFromTransactions(userId, exchange);
    const totalValue = await this.calculatePortfolioValue(balances);

    const lastTransactionId = transactions.length > 0 
      ? transactions[transactions.length - 1].transactionId 
      : lastSyncedId;

    return {
      userId,
      exchange,
      syncType: 'transactions',
      syncedAt: new Date(),
      balances,
      totalValue,
      lastTransactionId
    };
  }

  async syncOrders(userId: string, exchange: string): Promise<PortfolioSyncResponse> {
    const client = await exchangeService.getAuthenticatedClient(userId, exchange);
    
    // Sync open and recent closed orders
    let orders: any[] = [];
    
    switch (exchange) {
      case 'binance':
        orders = await this.syncBinanceOrders(client);
        break;
      case 'coinbase':
        orders = await this.syncCoinbaseOrders(client);
        break;
      case 'kraken':
        orders = await this.syncKrakenOrders(client);
        break;
      case 'kucoin':
        orders = await this.syncKuCoinOrders(client);
        break;
      default:
        throw new Error(`Unsupported exchange: ${exchange}`);
    }

    // Store orders in database
    await this.storeOrders(userId, exchange, orders);

    // Get current balances (orders don't directly affect balances until filled)
    const syncResponse = await this.syncBalances(userId, exchange);
    syncResponse.syncType = 'orders';

    return syncResponse;
  }

  async syncFull(userId: string, exchange: string): Promise<PortfolioSyncResponse> {
    const syncKey = `${userId}:${exchange}`;
    
    try {
      // Update progress
      this.updateSyncProgress(syncKey, 10);

      // Sync balances first
      const balancesSync = await this.syncBalances(userId, exchange);
      this.updateSyncProgress(syncKey, 40);

      // Sync transactions
      const transactionsSync = await this.syncTransactions(userId, exchange);
      this.updateSyncProgress(syncKey, 70);

      // Sync orders
      await this.syncOrders(userId, exchange);
      this.updateSyncProgress(syncKey, 90);

      // Combine results
      const fullSyncResponse: PortfolioSyncResponse = {
        userId,
        exchange,
        syncType: 'full',
        syncedAt: new Date(),
        balances: balancesSync.balances,
        totalValue: balancesSync.totalValue,
        lastTransactionId: transactionsSync.lastTransactionId
      };

      this.updateSyncProgress(syncKey, 100);

      return fullSyncResponse;

    } catch (error: any) {
      loggingService.error('Full sync failed', {
        userId,
        exchange,
        error: error.message
      });
      throw error;
    }
  }

  private async syncBinanceBalances(client: any): Promise<ExchangeBalance[]> {
    const accountInfo = await client.accountInfo();
    
    return accountInfo.balances
      .filter((balance: any) => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
      .map((balance: any) => ({
        asset: balance.asset,
        free: parseFloat(balance.free),
        locked: parseFloat(balance.locked),
        total: parseFloat(balance.free) + parseFloat(balance.locked)
      }));
  }

  private async syncCoinbaseBalances(client: any): Promise<ExchangeBalance[]> {
    const accounts = await client.getAccounts();
    
    return accounts
      .filter((account: any) => parseFloat(account.balance.amount) > 0)
      .map((account: any) => ({
        asset: account.balance.currency,
        free: parseFloat(account.balance.amount),
        locked: 0, // Coinbase doesn't separate locked balances in basic account info
        total: parseFloat(account.balance.amount)
      }));
  }

  private async syncKrakenBalances(client: any): Promise<ExchangeBalance[]> {
    const balanceResponse = await client.getBalance();
    const balances = balanceResponse.result;
    
    return Object.entries(balances)
      .filter(([asset, balance]: [string, any]) => parseFloat(balance) > 0)
      .map(([asset, balance]: [string, any]) => ({
        asset: asset.startsWith('X') || asset.startsWith('Z') ? asset.slice(1) : asset,
        free: parseFloat(balance),
        locked: 0, // Would need separate API call for locked balances
        total: parseFloat(balance)
      }));
  }

  private async syncKuCoinBalances(client: any): Promise<ExchangeBalance[]> {
    const accountsResponse = await client.getAccounts();
    const accounts = accountsResponse.data;
    
    // Group by currency and sum up different account types
    const balanceMap = new Map<string, { free: number; locked: number }>();
    
    accounts.forEach((account: any) => {
      const currency = account.currency;
      const available = parseFloat(account.available) || 0;
      const holds = parseFloat(account.holds) || 0;
      
      if (!balanceMap.has(currency)) {
        balanceMap.set(currency, { free: 0, locked: 0 });
      }
      
      const existing = balanceMap.get(currency)!;
      existing.free += available;
      existing.locked += holds;
    });
    
    return Array.from(balanceMap.entries())
      .filter(([currency, balance]) => balance.free > 0 || balance.locked > 0)
      .map(([currency, balance]) => ({
        asset: currency,
        free: balance.free,
        locked: balance.locked,
        total: balance.free + balance.locked
      }));
  }

  private async syncBinanceTransactions(client: any, lastSyncedId?: string): Promise<ExchangeTransaction[]> {
    // Get trade history
    const trades = await client.getAllOrders({ limit: 500 });
    
    return trades
      .filter((trade: any) => trade.status === 'FILLED')
      .filter((trade: any) => !lastSyncedId || trade.orderId > parseInt(lastSyncedId))
      .map((trade: any) => ({
        transactionId: trade.orderId.toString(),
        symbol: trade.symbol,
        side: trade.side.toLowerCase(),
        quantity: parseFloat(trade.executedQty),
        price: parseFloat(trade.price),
        fee: parseFloat(trade.commission || 0),
        feeAsset: trade.commissionAsset || trade.symbol.slice(0, 3),
        timestamp: new Date(trade.time),
        type: 'trade' as const
      }));
  }

  private async syncCoinbaseTransactions(client: any, lastSyncedId?: string): Promise<ExchangeTransaction[]> {
    const fills = await client.getFills({ limit: 100 });
    
    return fills
      .filter((fill: any) => !lastSyncedId || fill.trade_id > lastSyncedId)
      .map((fill: any) => ({
        transactionId: fill.trade_id,
        symbol: fill.product_id,
        side: fill.side,
        quantity: parseFloat(fill.size),
        price: parseFloat(fill.price),
        fee: parseFloat(fill.fee),
        feeAsset: fill.product_id.split('-')[1], // Assume quote currency for fees
        timestamp: new Date(fill.created_at),
        type: 'trade' as const
      }));
  }

  private async syncKrakenTransactions(client: any, lastSyncedId?: string): Promise<ExchangeTransaction[]> {
    const tradesResponse = await client.getTrades();
    const trades = tradesResponse.result.trades;
    
    return Object.entries(trades)
      .map(([tradeId, trade]: [string, any]) => ({
        transactionId: tradeId,
        symbol: trade.pair,
        side: trade.type as 'buy' | 'sell',
        quantity: parseFloat(trade.vol),
        price: parseFloat(trade.price),
        fee: parseFloat(trade.fee),
        feeAsset: trade.pair.slice(-3), // Simplified fee asset detection
        timestamp: new Date(trade.time * 1000),
        type: 'trade' as const
      }));
  }

  private async syncKuCoinTransactions(client: any, lastSyncedId?: string): Promise<ExchangeTransaction[]> {
    const fillsResponse = await client.getFills({ pageSize: 100 });
    const fills = fillsResponse.data.items;
    
    return fills
      .filter((fill: any) => !lastSyncedId || fill.tradeId > lastSyncedId)
      .map((fill: any) => ({
        transactionId: fill.tradeId,
        symbol: fill.symbol,
        side: fill.side,
        quantity: parseFloat(fill.size),
        price: parseFloat(fill.price),
        fee: parseFloat(fill.fee),
        feeAsset: fill.feeCurrency,
        timestamp: new Date(fill.createdAt),
        type: 'trade' as const
      }));
  }

  private async syncBinanceOrders(client: any): Promise<any[]> {
    const openOrders = await client.getOpenOrders();
    const recentOrders = await client.getAllOrders({ limit: 50 });
    
    // Combine and deduplicate
    const allOrders = [...openOrders, ...recentOrders];
    const uniqueOrders = Array.from(
      new Map(allOrders.map(order => [order.orderId, order])).values()
    );
    
    return uniqueOrders;
  }

  private async syncCoinbaseOrders(client: any): Promise<any[]> {
    const [openOrders, recentOrders] = await Promise.all([
      client.getOrders({ status: 'open' }),
      client.getOrders({ limit: 50 })
    ]);
    
    // Combine and deduplicate by order ID
    const allOrders = [...openOrders, ...recentOrders];
    const uniqueOrders = Array.from(
      new Map(allOrders.map(order => [order.id, order])).values()
    );
    
    return uniqueOrders;
  }

  private async syncKrakenOrders(client: any): Promise<any[]> {
    const [openOrders, closedOrders] = await Promise.all([
      client.getOpenOrders(),
      client.getClosedOrders({ ofs: 0, closetime: 'close' })
    ]);
    
    const allOrders = [
      ...Object.entries(openOrders.result.open || {}),
      ...Object.entries(closedOrders.result.closed || {})
    ].map(([orderId, order]) => ({ orderId, ...order }));
    
    return allOrders;
  }

  private async syncKuCoinOrders(client: any): Promise<any[]> {
    const [openOrders, recentOrders] = await Promise.all([
      client.getOrders({ status: 'active' }),
      client.getOrders({ pageSize: 50 })
    ]);
    
    const allOrders = [...openOrders.data.items, ...recentOrders.data.items];
    const uniqueOrders = Array.from(
      new Map(allOrders.map(order => [order.id, order])).values()
    );
    
    return uniqueOrders;
  }

  private updateSyncProgress(syncKey: string, progress: number): void {
    const syncStatus = this.syncStatuses.get(syncKey);
    if (syncStatus) {
      syncStatus.progress = progress;
      this.syncStatuses.set(syncKey, syncStatus);
      
      this.emit('sync-progress', {
        userId: syncStatus.userId,
        exchange: syncStatus.exchange,
        progress
      });
    }
  }

  private async calculatePortfolioValue(balances: ExchangeBalance[]): Promise<number> {
    // This would integrate with a price service to calculate USD value
    // For now, return a placeholder
    return balances.reduce((total, balance) => total + balance.total, 0);
  }

  private async getCachedPortfolioData(userId: string, exchange: string): Promise<PortfolioSyncResponse | null> {
    try {
      const cacheKey = `portfolio:${userId}:${exchange}`;
      const cachedData = await cacheService.get(cacheKey);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      loggingService.warn('Failed to get cached portfolio data', { userId, exchange, error });
      return null;
    }
  }

  private async cachePortfolioData(userId: string, exchange: string, data: PortfolioSyncResponse): Promise<void> {
    try {
      const cacheKey = `portfolio:${userId}:${exchange}`;
      await cacheService.set(cacheKey, JSON.stringify(data), 300); // 5 minutes
    } catch (error) {
      loggingService.warn('Failed to cache portfolio data', { userId, exchange, error });
    }
  }

  private async updatePortfolioInDatabase(syncResponse: PortfolioSyncResponse): Promise<void> {
    try {
      // Update user's portfolio balances in database
      await prisma.portfolioBalance.upsert({
        where: {
          userId_exchange: {
            userId: syncResponse.userId,
            exchange: syncResponse.exchange
          }
        },
        update: {
          balances: JSON.stringify(syncResponse.balances),
          totalValue: syncResponse.totalValue,
          lastSyncAt: syncResponse.syncedAt
        },
        create: {
          userId: syncResponse.userId,
          exchange: syncResponse.exchange,
          balances: JSON.stringify(syncResponse.balances),
          totalValue: syncResponse.totalValue,
          lastSyncAt: syncResponse.syncedAt
        }
      });
    } catch (error) {
      loggingService.error('Failed to update portfolio in database', {
        userId: syncResponse.userId,
        exchange: syncResponse.exchange,
        error
      });
    }
  }

  private async getLastSyncedTransactionId(userId: string, exchange: string): Promise<string | undefined> {
    try {
      const lastSync = await prisma.portfolioSync.findFirst({
        where: {
          userId,
          exchange,
          syncType: 'transactions'
        },
        orderBy: {
          syncedAt: 'desc'
        }
      });
      
      return lastSync?.lastTransactionId || undefined;
    } catch (error) {
      loggingService.warn('Failed to get last synced transaction ID', { userId, exchange, error });
      return undefined;
    }
  }

  private async storeTransactions(userId: string, exchange: string, transactions: ExchangeTransaction[]): Promise<void> {
    try {
      for (const transaction of transactions) {
        await prisma.portfolioTransaction.upsert({
          where: {
            userId_exchange_transactionId: {
              userId,
              exchange,
              transactionId: transaction.transactionId
            }
          },
          update: {
            symbol: transaction.symbol,
            side: transaction.side,
            quantity: transaction.quantity,
            price: transaction.price,
            fee: transaction.fee,
            feeAsset: transaction.feeAsset,
            timestamp: transaction.timestamp,
            type: transaction.type
          },
          create: {
            userId,
            exchange,
            transactionId: transaction.transactionId,
            symbol: transaction.symbol,
            side: transaction.side,
            quantity: transaction.quantity,
            price: transaction.price,
            fee: transaction.fee,
            feeAsset: transaction.feeAsset,
            timestamp: transaction.timestamp,
            type: transaction.type
          }
        });
      }
    } catch (error) {
      loggingService.error('Failed to store transactions', { userId, exchange, error });
    }
  }

  private async storeOrders(userId: string, exchange: string, orders: any[]): Promise<void> {
    try {
      for (const order of orders) {
        const orderId = order.orderId || order.id;
        if (!orderId) continue;

        await prisma.portfolioOrder.upsert({
          where: {
            userId_exchange_orderId: {
              userId,
              exchange,
              orderId: orderId.toString()
            }
          },
          update: {
            symbol: order.symbol || order.product_id,
            side: (order.side || order.type)?.toLowerCase(),
            type: order.type?.toLowerCase(),
            quantity: parseFloat(order.origQty || order.size || order.vol || '0'),
            price: parseFloat(order.price || '0'),
            status: order.status?.toLowerCase(),
            timestamp: new Date(order.time || order.created_at || order.createdAt || Date.now()),
            updatedAt: new Date()
          },
          create: {
            userId,
            exchange,
            orderId: orderId.toString(),
            symbol: order.symbol || order.product_id,
            side: (order.side || order.type)?.toLowerCase(),
            type: order.type?.toLowerCase(),
            quantity: parseFloat(order.origQty || order.size || order.vol || '0'),
            price: parseFloat(order.price || '0'),
            status: order.status?.toLowerCase(),
            timestamp: new Date(order.time || order.created_at || order.createdAt || Date.now())
          }
        });
      }
    } catch (error) {
      loggingService.error('Failed to store orders', { userId, exchange, error });
    }
  }

  private async calculateBalancesFromTransactions(userId: string, exchange: string): Promise<ExchangeBalance[]> {
    // This would calculate current balances based on transaction history
    // For now, return empty array and let balance sync handle it
    return [];
  }

  getSyncStatus(userId: string, exchange: string): SyncStatus | null {
    const syncKey = `${userId}:${exchange}`;
    return this.syncStatuses.get(syncKey) || null;
  }

  getAllSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatuses.values());
  }

  async cancelSync(userId: string, exchange: string): Promise<boolean> {
    const syncKey = `${userId}:${exchange}`;
    const syncStatus = this.syncStatuses.get(syncKey);
    
    if (syncStatus && syncStatus.status === 'syncing') {
      syncStatus.status = 'failed';
      syncStatus.error = 'Cancelled by user';
      syncStatus.endTime = new Date();
      
      this.emit('sync-cancelled', { userId, exchange });
      return true;
    }
    
    return false;
  }

  getSupportedExchanges(): string[] {
    return ['binance', 'coinbase', 'kraken', 'kucoin'];
  }
}

export const portfolioSyncService = new PortfolioSyncService();