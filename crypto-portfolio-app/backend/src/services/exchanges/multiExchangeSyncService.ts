import { exchangeService } from './exchangeService';
import { loggingService } from '../loggingService';
import { cacheService } from '../cacheService';
import { prisma } from '../../config/database';
import { EventEmitter } from 'events';

interface PriceData {
  symbol: string;
  price: number;
  timestamp: Date;
  exchange: string;
}

interface ArbitrageOpportunity {
  symbol: string;
  baseSymbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPercentage: number;
  timestamp: Date;
  confidence: number;
}

interface PortfolioBalance {
  userId: string;
  asset: string;
  totalBalance: number;
  exchanges: {
    [exchangeName: string]: {
      available: number;
      locked: number;
      total: number;
    };
  };
  lastUpdated: Date;
}

interface SyncStatus {
  exchange: string;
  lastSync: Date;
  status: 'success' | 'error' | 'pending';
  nextSync?: Date;
  error?: string;
}

interface MarketData {
  symbol: string;
  baseSymbol: string;
  prices: {
    [exchangeName: string]: PriceData;
  };
  bestBid?: {
    exchange: string;
    price: number;
  };
  bestAsk?: {
    exchange: string;
    price: number;
  };
  spread?: number;
  volume24h?: number;
  lastUpdated: Date;
}

export class MultiExchangeSyncService extends EventEmitter {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map();
  private supportedExchanges: string[];
  private symbolMappings: Map<string, Record<string, string>> = new Map();

  constructor() {
    super();
    this.supportedExchanges = exchangeService.getSupportedExchanges();
    this.initializeSymbolMappings();
  }

  private initializeSymbolMappings(): void {
    // Map standardized symbols to exchange-specific formats
    const btcMappings = {
      binance: 'BTCUSDT',
      coinbase: 'BTC-USD',
      kraken: 'XXBTZUSD',
      kucoin: 'BTC-USDT'
    };

    const ethMappings = {
      binance: 'ETHUSDT',
      coinbase: 'ETH-USD',
      kraken: 'XETHZUSD',
      kucoin: 'ETH-USDT'
    };

    this.symbolMappings.set('BTC/USDT', btcMappings);
    this.symbolMappings.set('ETH/USDT', ethMappings);
    this.symbolMappings.set('BTC/USD', btcMappings);
    this.symbolMappings.set('ETH/USD', ethMappings);
  }

  private getExchangeSymbol(standardSymbol: string, exchange: string): string {
    const mapping = this.symbolMappings.get(standardSymbol);
    return mapping?.[exchange] || standardSymbol;
  }

  private getStandardSymbol(exchangeSymbol: string, exchange: string): string {
    for (const [standard, mapping] of this.symbolMappings.entries()) {
      if (mapping[exchange] === exchangeSymbol) {
        return standard;
      }
    }
    return exchangeSymbol;
  }

  async startSynchronization(interval: number = 30000): Promise<void> {
    try {
      loggingService.info('Starting multi-exchange synchronization', { interval });

      // Start sync for each exchange
      for (const exchange of this.supportedExchanges) {
        const syncTimer = setInterval(async () => {
          await this.syncExchangeData(exchange);
        }, interval);

        this.syncIntervals.set(exchange, syncTimer);
      }

      // Initial sync
      await this.performFullSync();

      this.emit('sync-started', { exchanges: this.supportedExchanges, interval });
      
      loggingService.info('Multi-exchange synchronization started successfully');
    } catch (error) {
      loggingService.error('Error starting synchronization', error);
      throw error;
    }
  }

  async stopSynchronization(): Promise<void> {
    try {
      // Clear all intervals
      for (const [exchange, timer] of this.syncIntervals) {
        clearInterval(timer);
        this.syncIntervals.delete(exchange);
      }

      this.emit('sync-stopped');
      loggingService.info('Multi-exchange synchronization stopped');
    } catch (error) {
      loggingService.error('Error stopping synchronization', error);
      throw error;
    }
  }

  async performFullSync(): Promise<void> {
    try {
      loggingService.info('Performing full multi-exchange sync');

      const syncPromises = this.supportedExchanges.map(exchange => 
        this.syncExchangeData(exchange)
      );

      await Promise.allSettled(syncPromises);

      // After syncing all exchanges, detect arbitrage opportunities
      await this.detectArbitrageOpportunities();

      this.emit('full-sync-completed');
      loggingService.info('Full sync completed successfully');
    } catch (error) {
      loggingService.error('Error performing full sync', error);
      throw error;
    }
  }

  private async syncExchangeData(exchange: string): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Get current prices for major pairs
      const symbols = this.getMajorTradingPairs(exchange);
      const prices = await exchangeService.getCurrentPrices(exchange, symbols);

      // Cache the price data
      const cacheKey = `sync:${exchange}:prices`;
      await cacheService.set?.(cacheKey, JSON.stringify(prices), 300); // 5-minute cache

      // Update sync status
      await this.updateSyncStatus(exchange, 'success');

      const duration = Date.now() - startTime;
      loggingService.debug('Exchange sync completed', { exchange, duration, symbolCount: Object.keys(prices).length });

      this.emit('exchange-synced', { exchange, prices, duration });
    } catch (error) {
      await this.updateSyncStatus(exchange, 'error', error instanceof Error ? error.message : 'Unknown error');
      loggingService.error('Error syncing exchange data', { exchange, error });
      
      this.emit('exchange-sync-error', { exchange, error });
    }
  }

  private getMajorTradingPairs(exchange: string): string[] {
    const majorPairs = ['BTC/USDT', 'ETH/USDT', 'BTC/USD', 'ETH/USD'];
    return majorPairs.map(pair => this.getExchangeSymbol(pair, exchange)).filter(Boolean);
  }

  async getUnifiedMarketData(standardSymbol: string): Promise<MarketData | null> {
    try {
      const prices: Record<string, PriceData> = {};
      let bestBid: MarketData['bestBid'];
      let bestAsk: MarketData['bestAsk'];

      // Collect prices from all exchanges
      for (const exchange of this.supportedExchanges) {
        try {
          const exchangeSymbol = this.getExchangeSymbol(standardSymbol, exchange);
          const exchangePrices = await exchangeService.getCurrentPrices(exchange, [exchangeSymbol]);
          
          if (exchangePrices[exchangeSymbol]) {
            const priceData = exchangePrices[exchangeSymbol];
            prices[exchange] = priceData;

            // Update best bid/ask
            if (!bestBid || priceData.price > bestBid.price) {
              bestBid = { exchange, price: priceData.price };
            }
            if (!bestAsk || priceData.price < bestAsk.price) {
              bestAsk = { exchange, price: priceData.price };
            }
          }
        } catch (error) {
          loggingService.warn('Failed to get price from exchange', { exchange, standardSymbol, error });
        }
      }

      if (Object.keys(prices).length === 0) {
        return null;
      }

      const spread = bestBid && bestAsk ? bestAsk.price - bestBid.price : 0;

      return {
        symbol: standardSymbol,
        baseSymbol: standardSymbol.split('/')[0],
        prices,
        bestBid,
        bestAsk,
        spread,
        lastUpdated: new Date()
      };
    } catch (error) {
      loggingService.error('Error getting unified market data', { standardSymbol, error });
      throw error;
    }
  }

  async detectArbitrageOpportunities(minSpreadPercentage: number = 0.5): Promise<ArbitrageOpportunity[]> {
    try {
      const opportunities: ArbitrageOpportunity[] = [];
      const majorPairs = ['BTC/USDT', 'ETH/USDT'];

      for (const standardSymbol of majorPairs) {
        const marketData = await this.getUnifiedMarketData(standardSymbol);
        
        if (!marketData || Object.keys(marketData.prices).length < 2) {
          continue;
        }

        const exchangePrices = Object.entries(marketData.prices);
        
        // Compare all exchange pairs
        for (let i = 0; i < exchangePrices.length; i++) {
          for (let j = i + 1; j < exchangePrices.length; j++) {
            const [buyExchange, buyData] = exchangePrices[i];
            const [sellExchange, sellData] = exchangePrices[j];

            const spread = Math.abs(sellData.price - buyData.price);
            const avgPrice = (buyData.price + sellData.price) / 2;
            const spreadPercentage = (spread / avgPrice) * 100;

            if (spreadPercentage >= minSpreadPercentage) {
              const isReversed = buyData.price > sellData.price;
              
              opportunities.push({
                symbol: standardSymbol,
                baseSymbol: standardSymbol.split('/')[0],
                buyExchange: isReversed ? sellExchange : buyExchange,
                sellExchange: isReversed ? buyExchange : sellExchange,
                buyPrice: isReversed ? sellData.price : buyData.price,
                sellPrice: isReversed ? buyData.price : sellData.price,
                spread,
                spreadPercentage,
                timestamp: new Date(),
                confidence: this.calculateConfidence(spreadPercentage, Object.keys(marketData.prices).length)
              });
            }
          }
        }
      }

      // Cache arbitrage opportunities
      if (opportunities.length > 0) {
        await cacheService.set?.('arbitrage:opportunities', JSON.stringify(opportunities), 60);
        this.emit('arbitrage-detected', opportunities);
      }

      loggingService.info('Arbitrage detection completed', { opportunitiesFound: opportunities.length });
      return opportunities;
    } catch (error) {
      loggingService.error('Error detecting arbitrage opportunities', error);
      return [];
    }
  }

  private calculateConfidence(spreadPercentage: number, exchangeCount: number): number {
    // Higher spread and more exchanges increase confidence
    const spreadScore = Math.min(spreadPercentage / 5, 1); // Max spread score at 5%
    const exchangeScore = Math.min(exchangeCount / 4, 1); // Max exchange score at 4 exchanges
    
    return Math.round((spreadScore * 0.7 + exchangeScore * 0.3) * 100);
  }

  async aggregateUserPortfolio(userId: string): Promise<PortfolioBalance[]> {
    try {
      const aggregatedBalances: Map<string, PortfolioBalance> = new Map();

      // Get balances from all exchanges where user has credentials
      for (const exchange of this.supportedExchanges) {
        try {
          const hasCredentials = await exchangeService.hasValidCredentials(userId, exchange);
          
          if (!hasCredentials) {
            continue;
          }

          const client = await exchangeService.getAuthenticatedClient(userId, exchange);
          const accountInfo = await client.getAccountInfo();

          for (const balance of accountInfo.balances) {
            const asset = this.normalizeAssetSymbol(balance.asset || balance.currency);
            
            if (!aggregatedBalances.has(asset)) {
              aggregatedBalances.set(asset, {
                userId,
                asset,
                totalBalance: 0,
                exchanges: {},
                lastUpdated: new Date()
              });
            }

            const portfolio = aggregatedBalances.get(asset)!;
            const available = balance.available || balance.free || balance.balance;
            const locked = balance.holds || balance.locked || balance.reserved || 0;
            const total = available + locked;

            portfolio.exchanges[exchange] = {
              available,
              locked,
              total
            };

            portfolio.totalBalance += total;
            portfolio.lastUpdated = new Date();
          }
        } catch (error) {
          loggingService.warn('Error aggregating portfolio from exchange', { exchange, userId, error });
        }
      }

      const result = Array.from(aggregatedBalances.values()).filter(p => p.totalBalance > 0);
      
      // Cache the aggregated portfolio
      await cacheService.set?.(
        `portfolio:aggregated:${userId}`, 
        JSON.stringify(result), 
        300 // 5-minute cache
      );

      loggingService.info('Portfolio aggregation completed', { 
        userId, 
        assetsFound: result.length,
        exchangesProcessed: this.supportedExchanges.length
      });

      return result;
    } catch (error) {
      loggingService.error('Error aggregating user portfolio', { userId, error });
      throw error;
    }
  }

  private normalizeAssetSymbol(asset: string): string {
    // Normalize asset symbols across exchanges
    const normalizations: Record<string, string> = {
      'XXBT': 'BTC',
      'XETH': 'ETH',
      'ZUSD': 'USD',
      'ZEUR': 'EUR'
    };

    return normalizations[asset] || asset;
  }

  async reconcileBalances(userId: string): Promise<{
    discrepancies: Array<{
      asset: string;
      expectedTotal: number;
      actualTotal: number;
      difference: number;
      exchanges: string[];
    }>;
    lastReconciliation: Date;
  }> {
    try {
      const portfolio = await this.aggregateUserPortfolio(userId);
      const discrepancies: any[] = [];

      // Check for balance discrepancies (this is a simplified example)
      for (const balance of portfolio) {
        const exchangeBalances = Object.values(balance.exchanges);
        const calculatedTotal = exchangeBalances.reduce((sum, ex) => sum + ex.total, 0);
        
        if (Math.abs(calculatedTotal - balance.totalBalance) > 0.000001) {
          discrepancies.push({
            asset: balance.asset,
            expectedTotal: calculatedTotal,
            actualTotal: balance.totalBalance,
            difference: calculatedTotal - balance.totalBalance,
            exchanges: Object.keys(balance.exchanges)
          });
        }
      }

      const result = {
        discrepancies,
        lastReconciliation: new Date()
      };

      // Cache reconciliation results
      await cacheService.set?.(
        `reconciliation:${userId}`, 
        JSON.stringify(result), 
        600 // 10-minute cache
      );

      if (discrepancies.length > 0) {
        this.emit('balance-discrepancy', { userId, discrepancies });
      }

      return result;
    } catch (error) {
      loggingService.error('Error reconciling balances', { userId, error });
      throw error;
    }
  }

  private async updateSyncStatus(exchange: string, status: 'success' | 'error' | 'pending', error?: string): Promise<void> {
    try {
      const syncStatus: SyncStatus = {
        exchange,
        lastSync: new Date(),
        status,
        error
      };

      await cacheService.set?.(
        `sync:status:${exchange}`, 
        JSON.stringify(syncStatus), 
        3600 // 1-hour cache
      );
    } catch (err) {
      loggingService.error('Error updating sync status', { exchange, error: err });
    }
  }

  async getSyncStatus(): Promise<SyncStatus[]> {
    try {
      const statuses: SyncStatus[] = [];

      for (const exchange of this.supportedExchanges) {
        const cached = await cacheService.get?.(`sync:status:${exchange}`);
        
        if (cached) {
          statuses.push(JSON.parse(cached));
        } else {
          statuses.push({
            exchange,
            lastSync: new Date(0),
            status: 'pending'
          });
        }
      }

      return statuses;
    } catch (error) {
      loggingService.error('Error getting sync status', error);
      return [];
    }
  }

  async getArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    try {
      const cached = await cacheService.get?.('arbitrage:opportunities');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      loggingService.error('Error getting arbitrage opportunities', error);
      return [];
    }
  }

  isRunning(): boolean {
    return this.syncIntervals.size > 0;
  }

  getSupportedExchanges(): string[] {
    return [...this.supportedExchanges];
  }
}

// Create singleton instance
export const multiExchangeSyncService = new MultiExchangeSyncService();
export default multiExchangeSyncService;