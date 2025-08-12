# CP-020: Multi-Exchange Data Synchronization

## Objective
Implement a comprehensive data synchronization system that aggregates and harmonizes data from multiple cryptocurrency exchanges (Binance, Coinbase Pro, Kraken, KuCoin) to provide users with a unified portfolio view and consistent market data.

## Priority
High

## Category
Exchange Integration

## Acceptance Criteria
- [ ] Unified data aggregation layer for all supported exchanges
- [ ] Real-time price data synchronization and conflict resolution
- [ ] Portfolio balance consolidation across multiple exchanges
- [ ] Historical data alignment and gap filling
- [ ] Exchange-specific data format normalization
- [ ] Duplicate transaction detection and merging
- [ ] Automatic data validation and integrity checks
- [ ] Configurable synchronization intervals and priorities
- [ ] Error handling and fallback mechanisms
- [ ] Performance optimization for large datasets

## Technical Implementation Details

### Data Synchronization Orchestrator
```javascript
// services/dataSynchronization/synchronizationOrchestrator.js
class SynchronizationOrchestrator {
  constructor() {
    this.exchanges = {
      binance: require('../exchanges/binanceClient'),
      coinbase: require('../exchanges/coinbaseProClient'),
      kraken: require('../exchanges/krakenClient'),
      kucoin: require('../exchanges/kucoinClient')
    };
    
    this.logger = require('../loggingService');
    this.cache = require('../cacheService');
    this.queue = require('../queueService');
    
    this.syncInterval = 60000; // 1 minute
    this.syncStatus = new Map();
    
    this.initializeSynchronization();
  }

  async initializeSynchronization() {
    // Start periodic synchronization
    setInterval(() => {
      this.synchronizeAllExchanges();
    }, this.syncInterval);

    // Start real-time WebSocket synchronization
    this.setupRealtimeSync();
  }

  async synchronizeAllExchanges() {
    const syncPromises = [];
    
    for (const [exchangeName, exchangeClient] of Object.entries(this.exchanges)) {
      syncPromises.push(this.synchronizeExchange(exchangeName, exchangeClient));
    }

    try {
      const results = await Promise.allSettled(syncPromises);
      
      // Process results and update sync status
      results.forEach((result, index) => {
        const exchangeName = Object.keys(this.exchanges)[index];
        
        if (result.status === 'fulfilled') {
          this.syncStatus.set(exchangeName, {
            status: 'success',
            lastSync: new Date(),
            data: result.value
          });
        } else {
          this.syncStatus.set(exchangeName, {
            status: 'error',
            lastSync: new Date(),
            error: result.reason.message
          });
        }
      });

      // Aggregate and reconcile data
      await this.aggregateExchangeData();
      
      this.logger.info('Exchange synchronization completed', {
        exchanges: Object.keys(this.exchanges),
        results: Array.from(this.syncStatus.entries())
      });
    } catch (error) {
      this.logger.error('Exchange synchronization failed', error);
    }
  }

  async synchronizeExchange(exchangeName, exchangeClient) {
    try {
      this.logger.info(`Starting ${exchangeName} synchronization`);
      
      // Get market data
      const marketData = await this.synchronizeMarketData(exchangeName, exchangeClient);
      
      // Get user data for all connected users
      const userData = await this.synchronizeUserData(exchangeName, exchangeClient);
      
      return {
        exchange: exchangeName,
        marketData,
        userData,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`${exchangeName} synchronization failed`, error);
      throw error;
    }
  }

  async synchronizeMarketData(exchangeName, exchangeClient) {
    try {
      // Get current prices
      const prices = await exchangeClient.getCurrentPrices();
      
      // Store in unified format
      await this.storeNormalizedPrices(exchangeName, prices);
      
      // Cache for quick access
      await this.cache.set(`${exchangeName}:prices`, prices, 60);
      
      return {
        priceCount: Object.keys(prices).length,
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Market data sync failed for ${exchangeName}`, error);
      throw error;
    }
  }

  async synchronizeUserData(exchangeName, exchangeClient) {
    try {
      // Get all users with credentials for this exchange
      const users = await UserExchangeCredentials.findAll({
        where: { exchange: exchangeName },
        include: [{ model: User }]
      });

      const userSyncPromises = users.map(userCred => 
        this.synchronizeUserAccount(exchangeName, exchangeClient, userCred.userId)
      );

      const results = await Promise.allSettled(userSyncPromises);
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const errorCount = results.filter(r => r.status === 'rejected').length;

      return {
        totalUsers: users.length,
        successCount,
        errorCount
      };
    } catch (error) {
      this.logger.error(`User data sync failed for ${exchangeName}`, error);
      throw error;
    }
  }

  async synchronizeUserAccount(exchangeName, exchangeClient, userId) {
    try {
      // Sync account balances
      const balances = await exchangeClient.getAccountInfo(userId);
      await this.updateUserHoldings(userId, exchangeName, balances.balances);
      
      // Sync trading history (incremental)
      const lastSync = await this.getLastSyncTime(userId, exchangeName);
      const trades = await exchangeClient.getTradingHistory(userId, '', 100);
      
      const newTrades = trades.filter(trade => 
        !lastSync || trade.timestamp > lastSync
      );
      
      if (newTrades.length > 0) {
        await this.storeNewTrades(userId, exchangeName, newTrades);
      }
      
      // Update last sync time
      await this.updateLastSyncTime(userId, exchangeName);
      
      return {
        userId,
        balanceCount: balances.balances.length,
        newTradeCount: newTrades.length
      };
    } catch (error) {
      this.logger.error(`User account sync failed`, error, { userId, exchangeName });
      throw error;
    }
  }

  async storeNormalizedPrices(exchangeName, prices) {
    const normalizedPrices = [];
    
    for (const [symbol, priceData] of Object.entries(prices)) {
      const normalized = this.normalizePriceData(exchangeName, symbol, priceData);
      normalizedPrices.push(normalized);
    }

    // Batch insert/update prices
    await Price.bulkCreate(normalizedPrices, {
      updateOnDuplicate: ['price', 'bid', 'ask', 'volume', 'timestamp'],
      validate: true
    });
  }

  normalizePriceData(exchangeName, symbol, priceData) {
    // Normalize symbol format (e.g., BTC-USD, BTCUSD, BTC/USD -> BTC-USD)
    const normalizedSymbol = this.normalizeSymbol(exchangeName, symbol);
    
    return {
      exchange: exchangeName,
      symbol: normalizedSymbol,
      originalSymbol: symbol,
      price: priceData.price,
      bid: priceData.bid || priceData.price,
      ask: priceData.ask || priceData.price,
      volume: priceData.volume || 0,
      change24h: priceData.change || priceData.change24h || 0,
      changePercent24h: priceData.changeRate || priceData.changePercent || 0,
      high24h: priceData.high || 0,
      low24h: priceData.low || 0,
      timestamp: priceData.timestamp || new Date(),
      lastUpdated: new Date()
    };
  }

  normalizeSymbol(exchangeName, symbol) {
    // Exchange-specific symbol normalization
    switch (exchangeName) {
      case 'binance':
        // BTCUSDT -> BTC-USDT
        return symbol.replace(/([A-Z]{2,})([A-Z]{3,})$/, '$1-$2');
      
      case 'coinbase':
        // Already in BTC-USD format
        return symbol;
      
      case 'kraken':
        // XBTUSD -> BTC-USD, handle Kraken's naming
        const krakenMap = {
          'XXBT': 'BTC',
          'XETH': 'ETH',
          'ZUSD': 'USD',
          'ZEUR': 'EUR'
        };
        
        let normalized = symbol;
        for (const [kraken, standard] of Object.entries(krakenMap)) {
          normalized = normalized.replace(kraken, standard);
        }
        
        // Add hyphen if not present
        return normalized.includes('-') ? normalized : 
               normalized.replace(/([A-Z]{2,})([A-Z]{3,})$/, '$1-$2');
      
      case 'kucoin':
        // Already in BTC-USDT format
        return symbol;
      
      default:
        return symbol;
    }
  }

  async aggregateExchangeData() {
    try {
      // Aggregate prices from all exchanges
      await this.aggregatePrices();
      
      // Aggregate portfolio data
      await this.aggregatePortfolios();
      
      // Update market statistics
      await this.updateMarketStatistics();
      
    } catch (error) {
      this.logger.error('Data aggregation failed', error);
      throw error;
    }
  }

  async aggregatePrices() {
    // Get all unique symbols across exchanges
    const symbols = await Price.findAll({
      attributes: ['symbol'],
      group: ['symbol'],
      raw: true
    });

    for (const { symbol } of symbols) {
      await this.calculateAggregatedPrice(symbol);
    }
  }

  async calculateAggregatedPrice(symbol) {
    const exchangePrices = await Price.findAll({
      where: { symbol },
      order: [['timestamp', 'DESC']],
      limit: 10 // Last 10 prices from different exchanges
    });

    if (exchangePrices.length === 0) return;

    // Calculate volume-weighted average price
    const totalVolume = exchangePrices.reduce((sum, p) => sum + p.volume, 0);
    
    let weightedPrice = 0;
    let totalWeight = 0;

    for (const price of exchangePrices) {
      const weight = totalVolume > 0 ? price.volume / totalVolume : 1 / exchangePrices.length;
      weightedPrice += price.price * weight;
      totalWeight += weight;
    }

    const aggregatedPrice = totalWeight > 0 ? weightedPrice / totalWeight : 
                           exchangePrices[0].price;

    // Store aggregated price
    await AggregatedPrice.upsert({
      symbol,
      price: aggregatedPrice,
      exchangeCount: exchangePrices.length,
      totalVolume,
      priceSpread: Math.max(...exchangePrices.map(p => p.price)) - 
                   Math.min(...exchangePrices.map(p => p.price)),
      timestamp: new Date(),
      exchanges: exchangePrices.map(p => ({
        name: p.exchange,
        price: p.price,
        volume: p.volume,
        weight: totalVolume > 0 ? p.volume / totalVolume : 1 / exchangePrices.length
      }))
    });
  }

  async aggregatePortfolios() {
    // Get all users with holdings across multiple exchanges
    const users = await User.findAll({
      include: [{
        model: Holding,
        where: { amount: { [Op.gt]: 0 } }
      }]
    });

    for (const user of users) {
      await this.aggregateUserPortfolio(user.id);
    }
  }

  async aggregateUserPortfolio(userId) {
    const holdings = await Holding.findAll({
      where: { userId }
    });

    // Group holdings by symbol across exchanges
    const consolidatedHoldings = new Map();

    for (const holding of holdings) {
      const symbol = holding.symbol;
      
      if (consolidatedHoldings.has(symbol)) {
        const existing = consolidatedHoldings.get(symbol);
        existing.totalAmount += holding.amount;
        existing.totalAvailable += holding.available || 0;
        existing.totalLocked += holding.locked || 0;
        existing.exchanges.push({
          exchange: holding.source,
          amount: holding.amount,
          available: holding.available,
          locked: holding.locked
        });
      } else {
        consolidatedHoldings.set(symbol, {
          symbol,
          totalAmount: holding.amount,
          totalAvailable: holding.available || 0,
          totalLocked: holding.locked || 0,
          exchanges: [{
            exchange: holding.source,
            amount: holding.amount,
            available: holding.available,
            locked: holding.locked
          }]
        });
      }
    }

    // Update consolidated portfolio
    await ConsolidatedPortfolio.destroy({ where: { userId } });
    
    const consolidatedEntries = Array.from(consolidatedHoldings.values()).map(holding => ({
      userId,
      symbol: holding.symbol,
      totalAmount: holding.totalAmount,
      totalAvailable: holding.totalAvailable,
      totalLocked: holding.totalLocked,
      exchangeCount: holding.exchanges.length,
      exchanges: holding.exchanges,
      lastUpdated: new Date()
    }));

    await ConsolidatedPortfolio.bulkCreate(consolidatedEntries);
  }

  setupRealtimeSync() {
    // Setup WebSocket connections for real-time data
    for (const [exchangeName, exchangeClient] of Object.entries(this.exchanges)) {
      if (typeof exchangeClient.setupWebSocket === 'function') {
        this.setupExchangeWebSocket(exchangeName, exchangeClient);
      }
    }
  }

  async setupExchangeWebSocket(exchangeName, exchangeClient) {
    try {
      // Get popular trading pairs
      const popularPairs = await this.getPopularTradingPairs(exchangeName);
      
      exchangeClient.setupWebSocket(popularPairs, (data) => {
        this.handleRealtimeUpdate(exchangeName, data);
      });
      
      this.logger.info(`WebSocket setup completed for ${exchangeName}`, {
        pairCount: popularPairs.length
      });
    } catch (error) {
      this.logger.error(`WebSocket setup failed for ${exchangeName}`, error);
    }
  }

  async handleRealtimeUpdate(exchangeName, data) {
    try {
      // Normalize and store real-time price update
      const normalized = this.normalizePriceData(exchangeName, data.symbol || data.pair, data);
      
      // Update database
      await Price.upsert(normalized);
      
      // Update aggregated price
      await this.calculateAggregatedPrice(normalized.symbol);
      
      // Emit to WebSocket clients
      this.emitPriceUpdate(normalized);
      
    } catch (error) {
      this.logger.error('Real-time update processing failed', error, {
        exchange: exchangeName,
        data
      });
    }
  }

  async getPopularTradingPairs(exchangeName) {
    // Get most traded pairs for this exchange
    const popularPairs = await Price.findAll({
      where: { exchange: exchangeName },
      order: [['volume', 'DESC']],
      limit: 50,
      attributes: ['originalSymbol'],
      group: ['originalSymbol']
    });

    return popularPairs.map(p => p.originalSymbol);
  }

  async updateLastSyncTime(userId, exchangeName) {
    await UserExchangeCredentials.update(
      { lastSyncAt: new Date() },
      { where: { userId, exchange: exchangeName } }
    );
  }

  async getLastSyncTime(userId, exchangeName) {
    const credentials = await UserExchangeCredentials.findOne({
      where: { userId, exchange: exchangeName }
    });
    
    return credentials?.lastSyncAt;
  }

  getSyncStatus() {
    return Array.from(this.syncStatus.entries()).map(([exchange, status]) => ({
      exchange,
      ...status
    }));
  }
}

module.exports = SynchronizationOrchestrator;
```

### Data Validation and Integrity Service
```javascript
// services/dataSynchronization/dataValidationService.js
class DataValidationService {
  constructor() {
    this.logger = require('../loggingService');
    this.toleranceThreshold = 0.05; // 5% price difference tolerance
  }

  async validatePriceData(exchangeName, symbol, newPrice, existingPrices) {
    const validationResults = {
      isValid: true,
      warnings: [],
      errors: []
    };

    // Basic validation
    if (!this.isValidPrice(newPrice.price)) {
      validationResults.isValid = false;
      validationResults.errors.push('Invalid price value');
      return validationResults;
    }

    // Cross-exchange price validation
    if (existingPrices.length > 0) {
      const priceValidation = this.validateCrossExchangePrices(newPrice, existingPrices);
      validationResults.warnings.push(...priceValidation.warnings);
      
      if (priceValidation.suspiciousPrice) {
        validationResults.warnings.push(
          `Price deviation detected: ${newPrice.price} vs market average`
        );
      }
    }

    // Volume validation
    if (newPrice.volume < 0) {
      validationResults.errors.push('Negative volume detected');
      validationResults.isValid = false;
    }

    // Timestamp validation
    const now = new Date();
    const priceAge = now - new Date(newPrice.timestamp);
    
    if (priceAge > 5 * 60 * 1000) { // 5 minutes
      validationResults.warnings.push('Price data is stale');
    }

    return validationResults;
  }

  isValidPrice(price) {
    return typeof price === 'number' && 
           price > 0 && 
           price < Number.MAX_SAFE_INTEGER &&
           !isNaN(price);
  }

  validateCrossExchangePrices(newPrice, existingPrices) {
    const prices = existingPrices.map(p => p.price);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    const deviation = Math.abs(newPrice.price - avgPrice) / avgPrice;
    
    return {
      suspiciousPrice: deviation > this.toleranceThreshold,
      deviation,
      averagePrice: avgPrice,
      warnings: deviation > this.toleranceThreshold ? 
        [`Price deviation: ${(deviation * 100).toFixed(2)}%`] : []
    };
  }

  async detectDuplicateTransactions(userId, newTransactions) {
    const duplicates = [];
    
    for (const transaction of newTransactions) {
      const existing = await Transaction.findOne({
        where: {
          userId,
          symbol: transaction.symbol,
          type: transaction.type,
          amount: transaction.amount,
          price: transaction.price,
          timestamp: {
            [Op.between]: [
              new Date(transaction.timestamp.getTime() - 60000), // 1 minute before
              new Date(transaction.timestamp.getTime() + 60000)  // 1 minute after
            ]
          }
        }
      });
      
      if (existing) {
        duplicates.push({
          new: transaction,
          existing: existing.id
        });
      }
    }
    
    return duplicates;
  }

  async validateBalanceConsistency(userId, exchangeName, newBalances) {
    const issues = [];
    
    for (const balance of newBalances) {
      // Check for negative balances
      if (balance.total < 0) {
        issues.push({
          type: 'negative_balance',
          symbol: balance.asset,
          value: balance.total
        });
      }
      
      // Check for impossible balance changes
      const previousBalance = await Holding.findOne({
        where: { userId, symbol: balance.asset, source: exchangeName }
      });
      
      if (previousBalance) {
        const change = Math.abs(balance.total - previousBalance.amount);
        const changePercent = change / previousBalance.amount;
        
        if (changePercent > 0.5) { // 50% change
          issues.push({
            type: 'large_balance_change',
            symbol: balance.asset,
            previousAmount: previousBalance.amount,
            newAmount: balance.total,
            changePercent: changePercent * 100
          });
        }
      }
    }
    
    return issues;
  }
}
```

## Required Technologies
- **Bull Queue** - Job scheduling and processing
- **Redis** - Caching and coordination
- **WebSocket** - Real-time data streaming
- **Sequelize** - Database ORM with transactions
- **Node-cron** - Scheduled synchronization

## Testing Requirements

### Unit Tests
```javascript
describe('SynchronizationOrchestrator', () => {
  let orchestrator;

  beforeEach(() => {
    orchestrator = new SynchronizationOrchestrator();
  });

  test('should normalize symbols correctly across exchanges', () => {
    expect(orchestrator.normalizeSymbol('binance', 'BTCUSDT')).toBe('BTC-USDT');
    expect(orchestrator.normalizeSymbol('coinbase', 'BTC-USD')).toBe('BTC-USD');
    expect(orchestrator.normalizeSymbol('kraken', 'XBTUSD')).toBe('BTC-USD');
    expect(orchestrator.normalizeSymbol('kucoin', 'BTC-USDT')).toBe('BTC-USDT');
  });

  test('should calculate aggregated prices correctly', async () => {
    const mockPrices = [
      { exchange: 'binance', price: 50000, volume: 100 },
      { exchange: 'coinbase', price: 50100, volume: 50 },
      { exchange: 'kraken', price: 49900, volume: 75 }
    ];

    const aggregated = await orchestrator.calculateAggregatedPrice('BTC-USD');
    
    expect(aggregated.price).toBeCloseTo(50022.22, 2); // Volume-weighted average
    expect(aggregated.exchangeCount).toBe(3);
  });
});
```

### Integration Tests
```javascript
describe('Multi-Exchange Synchronization', () => {
  test('should sync data from all exchanges successfully', async () => {
    const orchestrator = new SynchronizationOrchestrator();
    
    await orchestrator.synchronizeAllExchanges();
    
    const syncStatus = orchestrator.getSyncStatus();
    
    expect(syncStatus.length).toBe(4); // All 4 exchanges
    expect(syncStatus.every(s => s.status === 'success')).toBe(true);
  });

  test('should detect and handle duplicate transactions', async () => {
    const validator = new DataValidationService();
    const userId = 'test-user-id';
    
    // Create existing transaction
    await Transaction.create({
      userId,
      symbol: 'BTC',
      type: 'buy',
      amount: 1.0,
      price: 50000,
      timestamp: new Date()
    });

    // Check for duplicates
    const newTransactions = [{
      symbol: 'BTC',
      type: 'buy', 
      amount: 1.0,
      price: 50000,
      timestamp: new Date()
    }];

    const duplicates = await validator.detectDuplicateTransactions(userId, newTransactions);
    
    expect(duplicates.length).toBe(1);
  });
});
```

## Dependencies
- CP-016: Binance Exchange Integration
- CP-017: Coinbase Pro Exchange Integration
- CP-018: Kraken Exchange Integration
- CP-019: KuCoin Exchange Integration

## Data Models

### Aggregated Price Model
```javascript
const AggregatedPrice = sequelize.define('AggregatedPrice', {
  symbol: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
  exchangeCount: { type: DataTypes.INTEGER, allowNull: false },
  totalVolume: { type: DataTypes.DECIMAL(20, 8), defaultValue: 0 },
  priceSpread: { type: DataTypes.DECIMAL(20, 8), defaultValue: 0 },
  exchanges: { type: DataTypes.JSONB },
  timestamp: { type: DataTypes.DATE, allowNull: false }
});
```

### Consolidated Portfolio Model
```javascript
const ConsolidatedPortfolio = sequelize.define('ConsolidatedPortfolio', {
  userId: { type: DataTypes.UUID, allowNull: false },
  symbol: { type: DataTypes.STRING, allowNull: false },
  totalAmount: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
  totalAvailable: { type: DataTypes.DECIMAL(20, 8), defaultValue: 0 },
  totalLocked: { type: DataTypes.DECIMAL(20, 8), defaultValue: 0 },
  exchangeCount: { type: DataTypes.INTEGER, allowNull: false },
  exchanges: { type: DataTypes.JSONB },
  lastUpdated: { type: DataTypes.DATE, allowNull: false }
});
```

## Synchronization Strategy

### Sync Frequencies
- **Real-time**: WebSocket updates (immediate)
- **High-frequency**: Price updates (every minute)
- **Medium-frequency**: Balance updates (every 5 minutes)
- **Low-frequency**: Trading history (every hour)

### Priority Levels
1. **Critical**: User balance changes
2. **High**: Popular trading pair prices
3. **Medium**: All market data
4. **Low**: Historical data backfill

## Error Recovery Mechanisms

### Partial Failure Handling
- Continue synchronization for successful exchanges
- Retry failed exchanges with exponential backoff
- Alert on persistent failures

### Data Consistency Checks
- Validate cross-exchange price consistency
- Detect and resolve data conflicts
- Maintain audit trails for all changes

## Performance Optimizations

### Batch Processing
- Bulk database operations
- Parallel exchange requests
- Efficient data transformations

### Caching Strategy
- Redis caching for frequently accessed data
- Cache invalidation on updates
- Distributed cache synchronization

## Definition of Done
- [ ] Unified data aggregation system operational
- [ ] Real-time synchronization from all exchanges
- [ ] Portfolio consolidation across exchanges working
- [ ] Data validation and integrity checks functional
- [ ] Symbol normalization handling all exchanges
- [ ] Duplicate detection and prevention implemented
- [ ] Performance optimization meeting requirements
- [ ] Error handling and recovery mechanisms active
- [ ] All tests passing with comprehensive coverage
- [ ] Monitoring and alerting for sync failures
- [ ] Documentation complete with architecture diagrams
- [ ] Production deployment with full synchronization

## Estimated Time
**Beginner Developer**: 12-15 days
**Intermediate Developer**: 8-10 days
**Senior Developer**: 6-8 days

## Required Skills
- Multi-source data integration patterns
- Real-time data synchronization
- Data normalization and transformation
- Conflict resolution algorithms
- Performance optimization for large datasets
- Database transaction management
- WebSocket real-time communication
- Error handling and recovery strategies

## Related Issues
- CP-021: Exchange Rate Limiting and Error Handling
- CP-022: Historical Data Import and Processing
- CP-023: Exchange Webhook Management
- CP-024: Exchange API Health Monitoring