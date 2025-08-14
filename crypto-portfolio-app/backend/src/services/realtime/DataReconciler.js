import { exchangeService } from '../exchanges/exchangeService.js';
import { redis } from '../../config/redis.js';
import { loggingService } from '../loggingService.js';

/**
 * Data Reconciler for Real-time Portfolio Updates
 * Ensures data consistency and handles reconciliation between different data sources
 */
class DataReconciler {
  constructor() {
    this.reconciliationInterval = 30000; // 30 seconds
    this.maxReconciliationAge = 300000; // 5 minutes
    this.priceTolerancePercent = 5; // 5% tolerance for price differences
    
    // Track reconciliation status
    this.lastReconciliation = new Map(); // symbol -> timestamp
    this.reconciliationErrors = new Map(); // symbol -> error count
    this.conflictResolutionStrategies = new Map(); // symbol -> strategy
    
    // Metrics
    this.metrics = {
      totalReconciliations: 0,
      successfulReconciliations: 0,
      conflictsFound: 0,
      conflictsResolved: 0,
      averageReconciliationTime: 0
    };
  }

  /**
   * Reconcile price data from multiple sources
   */
  async reconcileData(symbols, currentPriceCache) {
    const startTime = Date.now();
    const reconciledData = new Map();
    
    try {
      loggingService.info('Starting data reconciliation', {
        symbolCount: symbols.length
      });

      // Group symbols by exchange for batch processing
      const symbolsByExchange = this.groupSymbolsByExchange(symbols);
      
      // Fetch fresh data from all exchanges
      const freshDataPromises = Object.entries(symbolsByExchange).map(
        ([exchange, exchangeSymbols]) => 
          this.fetchFreshDataFromExchange(exchange, exchangeSymbols)
      );
      
      const freshDataResults = await Promise.allSettled(freshDataPromises);
      
      // Process results and reconcile
      for (let i = 0; i < freshDataResults.length; i++) {
        const result = freshDataResults[i];
        const exchange = Object.keys(symbolsByExchange)[i];
        
        if (result.status === 'fulfilled' && result.value) {
          await this.processExchangeData(
            exchange, 
            result.value, 
            currentPriceCache, 
            reconciledData
          );
        } else {
          loggingService.warn('Failed to fetch data from exchange', {
            exchange,
            error: result.reason?.message
          });
        }
      }
      
      // Apply conflict resolution where needed
      await this.resolveDataConflicts(reconciledData, currentPriceCache);
      
      // Store reconciled data in cache if Redis is available
      await this.cacheReconciledData(reconciledData);
      
      // Update metrics
      const reconciliationTime = Date.now() - startTime;
      this.updateMetrics(symbols.length, reconciledData.size, reconciliationTime);
      
      loggingService.info('Data reconciliation completed', {
        symbolsRequested: symbols.length,
        symbolsReconciled: reconciledData.size,
        duration: reconciliationTime
      });
      
      return reconciledData;
      
    } catch (error) {
      loggingService.error('Error during data reconciliation', {
        error: error.message,
        symbols: symbols.slice(0, 5) // Log first 5 symbols only
      });
      
      // Return current cache as fallback
      return new Map(
        symbols.map(symbol => [symbol, currentPriceCache.get(symbol)])
          .filter(([_, data]) => data)
      );
    }
  }

  /**
   * Group symbols by their primary exchange
   */
  groupSymbolsByExchange(symbols) {
    const groups = {
      binance: [],
      coinbase: [],
      kraken: [],
      kucoin: []
    };
    
    for (const symbol of symbols) {
      // Determine best exchange for this symbol
      const exchange = this.getBestExchangeForSymbol(symbol);
      if (groups[exchange]) {
        groups[exchange].push(symbol);
      }
    }
    
    // Remove empty groups
    return Object.fromEntries(
      Object.entries(groups).filter(([_, symbols]) => symbols.length > 0)
    );
  }

  /**
   * Determine best exchange for symbol based on liquidity/reliability
   */
  getBestExchangeForSymbol(symbol) {
    // Preference order based on general liquidity and reliability
    const exchanges = ['binance', 'coinbase', 'kraken', 'kucoin'];
    
    // For major pairs, prefer Binance for liquidity
    const majorSymbols = ['BTCUSDT', 'ETHUSDT', 'BTCUSD', 'ETHUSD'];
    if (majorSymbols.some(major => symbol.includes(major.replace('USDT', '').replace('USD', '')))) {
      return 'binance';
    }
    
    // For USD pairs, prefer Coinbase
    if (symbol.includes('USD') && !symbol.includes('USDT')) {
      return 'coinbase';
    }
    
    // Default to Binance for most symbols
    return 'binance';
  }

  /**
   * Fetch fresh data from specific exchange
   */
  async fetchFreshDataFromExchange(exchange, symbols) {
    try {
      const promises = symbols.map(async (symbol) => {
        try {
          const data = await exchangeService.getSymbolPrice(exchange, symbol);
          return { symbol, data };
        } catch (error) {
          loggingService.debug(`Failed to fetch ${symbol} from ${exchange}`, {
            error: error.message
          });
          return { symbol, data: null, error: error.message };
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      return results
        .filter(result => result.status === 'fulfilled' && result.value.data)
        .map(result => result.value);
        
    } catch (error) {
      loggingService.error(`Error fetching data from ${exchange}`, {
        error: error.message,
        symbolCount: symbols.length
      });
      return [];
    }
  }

  /**
   * Process data from exchange and compare with cache
   */
  async processExchangeData(exchange, exchangeData, currentPriceCache, reconciledData) {
    for (const { symbol, data } of exchangeData) {
      if (!data || !data.price) continue;
      
      const cachedData = currentPriceCache.get(symbol);
      const freshData = {
        ...data,
        symbol,
        exchange,
        timestamp: new Date(),
        lastUpdated: new Date(),
        source: 'reconciliation'
      };
      
      if (!cachedData) {
        // No cached data, use fresh data
        reconciledData.set(symbol, freshData);
        continue;
      }
      
      // Compare and resolve conflicts
      const resolvedData = await this.resolveDataConflict(
        symbol,
        cachedData,
        freshData
      );
      
      reconciledData.set(symbol, resolvedData);
      this.lastReconciliation.set(symbol, Date.now());
    }
  }

  /**
   * Resolve conflict between cached and fresh data
   */
  async resolveDataConflict(symbol, cachedData, freshData) {
    try {
      // Check if prices are significantly different
      const priceDifferencePercent = this.calculatePriceDifference(
        cachedData.price,
        freshData.price
      );
      
      if (priceDifferencePercent <= this.priceTolerancePercent) {
        // Prices are close, merge data
        return this.mergeCompatibleData(cachedData, freshData);
      }
      
      // Significant difference found
      this.metrics.conflictsFound++;
      
      loggingService.warn('Price conflict detected', {
        symbol,
        cachedPrice: cachedData.price,
        freshPrice: freshData.price,
        difference: priceDifferencePercent,
        cachedSource: cachedData.exchange,
        freshSource: freshData.exchange
      });
      
      // Apply conflict resolution strategy
      const resolvedData = await this.applyConflictResolution(
        symbol,
        cachedData,
        freshData,
        priceDifferencePercent
      );
      
      this.metrics.conflictsResolved++;
      return resolvedData;
      
    } catch (error) {
      loggingService.error('Error resolving data conflict', {
        symbol,
        error: error.message
      });
      
      // Fallback to fresh data
      return freshData;
    }
  }

  /**
   * Apply conflict resolution strategy
   */
  async applyConflictResolution(symbol, cachedData, freshData, priceDifference) {
    const strategy = this.getConflictResolutionStrategy(symbol, priceDifference);
    
    switch (strategy) {
      case 'trust_fresh':
        return {
          ...freshData,
          conflictResolution: 'trusted_fresh_data',
          conflictDetails: {
            priceDifference,
            cachedPrice: cachedData.price,
            cachedSource: cachedData.exchange
          }
        };
        
      case 'trust_cached':
        return {
          ...cachedData,
          lastUpdated: new Date(),
          conflictResolution: 'trusted_cached_data',
          conflictDetails: {
            priceDifference,
            freshPrice: freshData.price,
            freshSource: freshData.exchange
          }
        };
        
      case 'average':
        const averagePrice = (cachedData.price + freshData.price) / 2;
        return {
          ...this.mergeCompatibleData(cachedData, freshData),
          price: averagePrice,
          conflictResolution: 'averaged_prices',
          conflictDetails: {
            priceDifference,
            cachedPrice: cachedData.price,
            freshPrice: freshData.price,
            averagePrice
          }
        };
        
      case 'fetch_additional':
        return await this.fetchAdditionalDataForResolution(symbol, cachedData, freshData);
        
      default:
        return freshData;
    }
  }

  /**
   * Get conflict resolution strategy based on conditions
   */
  getConflictResolutionStrategy(symbol, priceDifference) {
    // Check if we have a predefined strategy for this symbol
    const predefined = this.conflictResolutionStrategies.get(symbol);
    if (predefined) return predefined;
    
    // Dynamic strategy based on conditions
    if (priceDifference > 20) {
      // Very large difference, fetch additional data
      return 'fetch_additional';
    } else if (priceDifference > 10) {
      // Large difference, trust cached if recent, otherwise fresh
      return 'trust_fresh';
    } else {
      // Moderate difference, average the prices
      return 'average';
    }
  }

  /**
   * Fetch additional data from multiple sources for resolution
   */
  async fetchAdditionalDataForResolution(symbol, cachedData, freshData) {
    try {
      // Fetch from 2-3 additional exchanges
      const additionalExchanges = ['binance', 'coinbase', 'kraken']
        .filter(ex => ex !== cachedData.exchange && ex !== freshData.exchange)
        .slice(0, 2);
      
      const additionalDataPromises = additionalExchanges.map(exchange =>
        exchangeService.getSymbolPrice(exchange, symbol).catch(() => null)
      );
      
      const additionalResults = await Promise.allSettled(additionalDataPromises);
      const additionalPrices = additionalResults
        .filter(result => result.status === 'fulfilled' && result.value?.price)
        .map(result => result.value.price);
      
      if (additionalPrices.length === 0) {
        // No additional data, default to fresh
        return freshData;
      }
      
      // Calculate consensus price
      const allPrices = [cachedData.price, freshData.price, ...additionalPrices];
      const consensusPrice = this.calculateConsensusPrice(allPrices);
      
      return {
        ...this.mergeCompatibleData(cachedData, freshData),
        price: consensusPrice,
        conflictResolution: 'consensus_price',
        conflictDetails: {
          allPrices,
          consensusPrice,
          additionalSources: additionalExchanges
        }
      };
      
    } catch (error) {
      loggingService.warn('Failed to fetch additional data for resolution', {
        symbol,
        error: error.message
      });
      return freshData;
    }
  }

  /**
   * Calculate consensus price from multiple sources
   */
  calculateConsensusPrice(prices) {
    if (prices.length === 0) return 0;
    if (prices.length === 1) return prices[0];
    
    // Remove outliers (prices that are > 2 standard deviations from mean)
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const standardDeviation = Math.sqrt(
      prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length
    );
    
    const filteredPrices = prices.filter(price => 
      Math.abs(price - mean) <= 2 * standardDeviation
    );
    
    // Return median of filtered prices
    const sortedPrices = filteredPrices.sort((a, b) => a - b);
    const mid = Math.floor(sortedPrices.length / 2);
    
    return sortedPrices.length % 2 === 0
      ? (sortedPrices[mid - 1] + sortedPrices[mid]) / 2
      : sortedPrices[mid];
  }

  /**
   * Calculate price difference percentage
   */
  calculatePriceDifference(price1, price2) {
    if (price1 === 0 && price2 === 0) return 0;
    if (price1 === 0 || price2 === 0) return 100;
    
    return Math.abs((price2 - price1) / price1) * 100;
  }

  /**
   * Merge compatible data from different sources
   */
  mergeCompatibleData(cachedData, freshData) {
    return {
      symbol: freshData.symbol,
      price: freshData.price, // Use fresh price
      change24h: freshData.change24h || cachedData.change24h || 0,
      volume24h: freshData.volume24h || cachedData.volume24h || 0,
      timestamp: freshData.timestamp,
      lastUpdated: new Date(),
      exchange: freshData.exchange,
      source: 'reconciled',
      originalSources: [
        cachedData.exchange || 'cached',
        freshData.exchange || 'fresh'
      ]
    };
  }

  /**
   * Resolve all data conflicts in reconciled data
   */
  async resolveDataConflicts(reconciledData, currentPriceCache) {
    // This method can implement additional conflict resolution logic
    // For now, individual conflicts are resolved during processing
    
    // Check for missing critical symbols
    const criticalSymbols = ['BTCUSDT', 'ETHUSDT', 'BTCUSD', 'ETHUSD'];
    const missingSyimbols = criticalSymbols.filter(symbol => 
      !reconciledData.has(symbol) && currentPriceCache.has(symbol)
    );
    
    // Add missing critical symbols from cache
    for (const symbol of missingSyimbols) {
      const cachedData = currentPriceCache.get(symbol);
      reconciledData.set(symbol, {
        ...cachedData,
        lastUpdated: new Date(),
        source: 'cached_fallback'
      });
    }
  }

  /**
   * Cache reconciled data in Redis
   */
  async cacheReconciledData(reconciledData) {
    if (!redis) return;
    
    try {
      const cachePromises = Array.from(reconciledData.entries()).map(
        ([symbol, data]) => {
          const cacheKey = `reconciled_price:${symbol}`;
          const cacheValue = JSON.stringify(data);
          return redis.setex(cacheKey, 300, cacheValue); // 5 minute expiration
        }
      );
      
      await Promise.allSettled(cachePromises);
      
    } catch (error) {
      loggingService.debug('Failed to cache reconciled data', {
        error: error.message
      });
    }
  }

  /**
   * Get reconciliation status for symbol
   */
  getReconciliationStatus(symbol) {
    const lastReconciliation = this.lastReconciliation.get(symbol);
    const errorCount = this.reconciliationErrors.get(symbol) || 0;
    const now = Date.now();
    
    return {
      symbol,
      lastReconciliation: lastReconciliation ? new Date(lastReconciliation) : null,
      timeSinceReconciliation: lastReconciliation ? now - lastReconciliation : null,
      errorCount,
      needsReconciliation: !lastReconciliation || 
        (now - lastReconciliation) > this.maxReconciliationAge,
      status: errorCount > 3 ? 'error' : 
              !lastReconciliation ? 'never' : 
              (now - lastReconciliation) > this.maxReconciliationAge ? 'stale' : 'current'
    };
  }

  /**
   * Force reconciliation for specific symbols
   */
  async forceReconciliation(symbols) {
    loggingService.info('Forcing reconciliation for symbols', { symbols });
    
    // Clear last reconciliation timestamps to force refresh
    symbols.forEach(symbol => {
      this.lastReconciliation.delete(symbol);
    });
    
    // Return empty cache to trigger fresh fetch
    return this.reconcileData(symbols, new Map());
  }

  /**
   * Set conflict resolution strategy for symbol
   */
  setConflictResolutionStrategy(symbol, strategy) {
    const validStrategies = ['trust_fresh', 'trust_cached', 'average', 'fetch_additional'];
    if (!validStrategies.includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
    
    this.conflictResolutionStrategies.set(symbol, strategy);
  }

  /**
   * Update reconciliation metrics
   */
  updateMetrics(requested, reconciled, duration) {
    this.metrics.totalReconciliations++;
    this.metrics.successfulReconciliations += reconciled > 0 ? 1 : 0;
    
    // Update average duration
    this.metrics.averageReconciliationTime = 
      (this.metrics.averageReconciliationTime * (this.metrics.totalReconciliations - 1) + duration) /
      this.metrics.totalReconciliations;
  }

  /**
   * Get reconciliation metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalReconciliations > 0 ? 
        this.metrics.successfulReconciliations / this.metrics.totalReconciliations : 0,
      conflictRate: this.metrics.totalReconciliations > 0 ? 
        this.metrics.conflictsFound / this.metrics.totalReconciliations : 0,
      conflictResolutionRate: this.metrics.conflictsFound > 0 ? 
        this.metrics.conflictsResolved / this.metrics.conflictsFound : 0,
      activeSymbols: this.lastReconciliation.size,
      strategiesSet: this.conflictResolutionStrategies.size
    };
  }

  /**
   * Clear reconciliation history
   */
  clearHistory() {
    this.lastReconciliation.clear();
    this.reconciliationErrors.clear();
    this.conflictResolutionStrategies.clear();
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.clearHistory();
  }
}

export { DataReconciler };