# CP-016: Binance Exchange Integration

## Objective
Implement comprehensive integration with Binance exchange API to fetch real-time market data, historical prices, trading pairs, and account information for the crypto portfolio tracker.

## Priority
High

## Category
Exchange Integration

## Acceptance Criteria
- [ ] Binance API client with proper authentication
- [ ] Real-time price data fetching for all supported pairs
- [ ] Historical price data import and processing
- [ ] Account balance synchronization (read-only)
- [ ] Trading history import and reconciliation
- [ ] WebSocket connection for live price updates
- [ ] Rate limiting compliance with Binance API limits
- [ ] Error handling and retry mechanisms
- [ ] Data validation and sanitization
- [ ] Comprehensive logging and monitoring

## Technical Implementation Details

### Binance API Client
```javascript
// services/exchanges/binanceClient.js
const Binance = require('node-binance-api');
const crypto = require('crypto');

class BinanceClient {
  constructor() {
    this.client = new Binance({
      APIKEY: process.env.BINANCE_API_KEY,
      APISECRET: process.env.BINANCE_API_SECRET,
      useServerTime: true,
      reconnect: true,
      verbose: false,
      log: (msg) => {
        console.log(`Binance: ${msg}`);
      }
    });

    this.rateLimiter = require('../rateLimitCoordinator');
    this.logger = require('../loggingService');
    this.cache = require('../cacheService');
  }

  async getCurrentPrices(symbols = []) {
    try {
      await this.rateLimiter.waitForExchangeAvailability('binance', 1);

      let prices;
      if (symbols.length === 0) {
        // Get all prices
        prices = await this.client.prices();
      } else {
        // Get specific symbols
        const symbolsString = symbols.join(',');
        prices = await this.client.prices(symbolsString);
      }

      const formattedPrices = this.formatPriceData(prices);
      
      // Cache prices for 30 seconds
      await this.cache.set('binance:current_prices', formattedPrices, 30);

      this.logger.info('Binance prices fetched successfully', {
        symbolCount: Object.keys(formattedPrices).length,
        exchange: 'binance'
      });

      return formattedPrices;
    } catch (error) {
      this.logger.error('Failed to fetch Binance prices', error, { symbols });
      throw new Error(`Binance API error: ${error.message}`);
    }
  }

  async getHistoricalPrices(symbol, interval = '1d', limit = 100) {
    try {
      await this.rateLimiter.waitForExchangeAvailability('binance', 1);

      const cacheKey = `binance:historical:${symbol}:${interval}:${limit}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const candles = await this.client.candlesticks(symbol, interval, {
        limit,
        endTime: Date.now()
      });

      const historicalData = candles.map(candle => ({
        timestamp: new Date(candle[0]),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      }));

      // Cache for 5 minutes
      await this.cache.set(cacheKey, historicalData, 300);

      return historicalData;
    } catch (error) {
      this.logger.error('Failed to fetch Binance historical data', error, {
        symbol,
        interval,
        limit
      });
      throw error;
    }
  }

  async getAccountInfo(userId) {
    try {
      // Ensure user has provided API credentials
      const userCredentials = await UserExchangeCredentials.findOne({
        where: { userId, exchange: 'binance' }
      });

      if (!userCredentials) {
        throw new Error('Binance credentials not configured for user');
      }

      await this.rateLimiter.waitForExchangeAvailability('binance', 10);

      // Create client with user credentials
      const userClient = new Binance({
        APIKEY: userCredentials.apiKey,
        APISECRET: userCredentials.apiSecret,
        useServerTime: true
      });

      const accountInfo = await userClient.account();
      
      const balances = accountInfo.balances
        .filter(balance => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
        .map(balance => ({
          asset: balance.asset,
          free: parseFloat(balance.free),
          locked: parseFloat(balance.locked),
          total: parseFloat(balance.free) + parseFloat(balance.locked)
        }));

      this.logger.info('Binance account info retrieved', {
        userId,
        balanceCount: balances.length
      });

      return {
        balances,
        accountType: accountInfo.accountType,
        canTrade: accountInfo.canTrade,
        canWithdraw: accountInfo.canWithdraw,
        canDeposit: accountInfo.canDeposit,
        updateTime: new Date(accountInfo.updateTime)
      };
    } catch (error) {
      this.logger.error('Failed to fetch Binance account info', error, { userId });
      throw error;
    }
  }

  async getTradingHistory(userId, symbol = '', limit = 100) {
    try {
      const userCredentials = await UserExchangeCredentials.findOne({
        where: { userId, exchange: 'binance' }
      });

      if (!userCredentials) {
        throw new Error('Binance credentials not configured for user');
      }

      await this.rateLimiter.waitForExchangeAvailability('binance', 10);

      const userClient = new Binance({
        APIKEY: userCredentials.apiKey,
        APISECRET: userCredentials.apiSecret,
        useServerTime: true
      });

      let trades = [];
      
      if (symbol) {
        trades = await userClient.myTrades(symbol, { limit });
      } else {
        // Get all symbols user has traded
        const accountInfo = await userClient.account();
        const symbols = accountInfo.balances
          .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
          .map(b => `${b.asset}USDT`); // Assume USDT pairs

        for (const sym of symbols) {
          try {
            const symbolTrades = await userClient.myTrades(sym, { limit: 50 });
            trades = trades.concat(symbolTrades);
          } catch (error) {
            // Symbol might not exist, continue
            continue;
          }
        }
      }

      const formattedTrades = trades.map(trade => ({
        id: trade.id,
        symbol: trade.symbol,
        side: trade.isBuyer ? 'buy' : 'sell',
        quantity: parseFloat(trade.qty),
        price: parseFloat(trade.price),
        commission: parseFloat(trade.commission),
        commissionAsset: trade.commissionAsset,
        time: new Date(trade.time),
        isMaker: trade.isMaker
      }));

      return formattedTrades;
    } catch (error) {
      this.logger.error('Failed to fetch Binance trading history', error, {
        userId,
        symbol
      });
      throw error;
    }
  }

  async getExchangeInfo() {
    try {
      const cacheKey = 'binance:exchange_info';
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      await this.rateLimiter.waitForExchangeAvailability('binance', 1);

      const info = await this.client.exchangeInfo();
      
      const tradingPairs = info.symbols
        .filter(symbol => symbol.status === 'TRADING')
        .map(symbol => ({
          symbol: symbol.symbol,
          baseAsset: symbol.baseAsset,
          quoteAsset: symbol.quoteAsset,
          status: symbol.status,
          minOrderSize: this.extractMinOrderSize(symbol.filters),
          tickSize: this.extractTickSize(symbol.filters)
        }));

      const exchangeInfo = {
        timezone: info.timezone,
        serverTime: new Date(info.serverTime),
        rateLimits: info.rateLimits,
        tradingPairs,
        totalPairs: tradingPairs.length
      };

      // Cache for 1 hour
      await this.cache.set(cacheKey, exchangeInfo, 3600);

      return exchangeInfo;
    } catch (error) {
      this.logger.error('Failed to fetch Binance exchange info', error);
      throw error;
    }
  }

  setupWebSocket(symbols, callback) {
    try {
      const streams = symbols.map(symbol => `${symbol.toLowerCase()}@ticker`);
      
      this.client.websockets.combined(streams, (streamData) => {
        try {
          const data = streamData.data;
          const formattedData = {
            symbol: data.s,
            price: parseFloat(data.c),
            change: parseFloat(data.P),
            changePercent: parseFloat(data.P),
            volume: parseFloat(data.v),
            high: parseFloat(data.h),
            low: parseFloat(data.l),
            timestamp: new Date(data.E)
          };

          callback(formattedData);
        } catch (error) {
          this.logger.error('WebSocket data processing error', error);
        }
      });

      this.logger.info('Binance WebSocket connection established', {
        streamCount: streams.length
      });
    } catch (error) {
      this.logger.error('Failed to setup Binance WebSocket', error, { symbols });
      throw error;
    }
  }

  formatPriceData(prices) {
    const formatted = {};
    
    for (const [symbol, price] of Object.entries(prices)) {
      formatted[symbol] = {
        symbol,
        price: parseFloat(price),
        timestamp: new Date(),
        exchange: 'binance'
      };
    }

    return formatted;
  }

  extractMinOrderSize(filters) {
    const lotSizeFilter = filters.find(f => f.filterType === 'LOT_SIZE');
    return lotSizeFilter ? parseFloat(lotSizeFilter.minQty) : 0;
  }

  extractTickSize(filters) {
    const priceFilter = filters.find(f => f.filterType === 'PRICE_FILTER');
    return priceFilter ? parseFloat(priceFilter.tickSize) : 0;
  }

  async testConnection() {
    try {
      await this.rateLimiter.waitForExchangeAvailability('binance', 1);
      
      const serverTime = await this.client.time();
      const ping = await this.client.ping();

      return {
        connected: true,
        serverTime: new Date(serverTime),
        latency: ping
      };
    } catch (error) {
      this.logger.error('Binance connection test failed', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = BinanceClient;
```

### Exchange Service Integration
```javascript
// services/exchangeService.js
class ExchangeService {
  constructor() {
    this.exchanges = {
      binance: new BinanceClient(),
      // Other exchanges will be added later
    };
  }

  async syncUserBalances(userId, exchange = 'binance') {
    try {
      const exchangeClient = this.exchanges[exchange];
      
      if (!exchangeClient) {
        throw new Error(`Exchange ${exchange} not supported`);
      }

      const accountInfo = await exchangeClient.getAccountInfo(userId);
      
      // Update user holdings in database
      await this.updateUserHoldings(userId, exchange, accountInfo.balances);

      return accountInfo;
    } catch (error) {
      this.logger.error('Failed to sync user balances', error, { userId, exchange });
      throw error;
    }
  }

  async updateUserHoldings(userId, exchange, balances) {
    const transaction = await db.transaction();
    
    try {
      // Clear existing exchange holdings
      await Holding.destroy({
        where: { userId, source: exchange },
        transaction
      });

      // Insert new holdings
      const holdings = balances
        .filter(balance => balance.total > 0)
        .map(balance => ({
          userId,
          symbol: balance.asset,
          amount: balance.total,
          source: exchange,
          lastUpdated: new Date()
        }));

      await Holding.bulkCreate(holdings, { transaction });
      
      await transaction.commit();

      this.logger.info('User holdings updated successfully', {
        userId,
        exchange,
        holdingCount: holdings.length
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async importTradingHistory(userId, exchange = 'binance', symbol = '') {
    try {
      const exchangeClient = this.exchanges[exchange];
      const trades = await exchangeClient.getTradingHistory(userId, symbol);

      const importedCount = await this.storeTradingHistory(userId, exchange, trades);

      return {
        imported: importedCount,
        total: trades.length,
        exchange,
        symbol
      };
    } catch (error) {
      this.logger.error('Failed to import trading history', error, {
        userId,
        exchange,
        symbol
      });
      throw error;
    }
  }

  async storeTradingHistory(userId, exchange, trades) {
    let importedCount = 0;
    
    for (const trade of trades) {
      try {
        const [transaction, created] = await Transaction.findOrCreate({
          where: {
            userId,
            externalId: `${exchange}_${trade.id}`,
            source: exchange
          },
          defaults: {
            userId,
            symbol: trade.symbol,
            type: trade.side,
            amount: trade.quantity,
            price: trade.price,
            fee: trade.commission,
            feeAsset: trade.commissionAsset,
            timestamp: trade.time,
            externalId: `${exchange}_${trade.id}`,
            source: exchange,
            metadata: {
              isMaker: trade.isMaker,
              originalData: trade
            }
          }
        });

        if (created) {
          importedCount++;
        }
      } catch (error) {
        this.logger.warn('Failed to import individual trade', error, {
          userId,
          tradeId: trade.id
        });
      }
    }

    return importedCount;
  }
}
```

## Required Technologies
- **node-binance-api** - Binance API client
- **ws** - WebSocket connections
- **crypto** - API signature generation
- **rate-limiter-flexible** - Rate limiting

## Testing Requirements

### Unit Tests
```javascript
describe('BinanceClient', () => {
  let binanceClient;

  beforeEach(() => {
    binanceClient = new BinanceClient();
  });

  test('should fetch current prices', async () => {
    const prices = await binanceClient.getCurrentPrices(['BTCUSDT', 'ETHUSDT']);
    
    expect(prices).toHaveProperty('BTCUSDT');
    expect(prices).toHaveProperty('ETHUSDT');
    expect(prices.BTCUSDT.price).toBeGreaterThan(0);
  });

  test('should handle API errors gracefully', async () => {
    // Mock API failure
    binanceClient.client.prices = jest.fn().mockRejectedValue(new Error('API Error'));
    
    await expect(binanceClient.getCurrentPrices()).rejects.toThrow('Binance API error');
  });

  test('should respect rate limits', async () => {
    const startTime = Date.now();
    
    // Make multiple rapid requests
    await Promise.all([
      binanceClient.getCurrentPrices(['BTCUSDT']),
      binanceClient.getCurrentPrices(['ETHUSDT']),
      binanceClient.getCurrentPrices(['ADAUSDT'])
    ]);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should take some time due to rate limiting
    expect(duration).toBeGreaterThan(100);
  });
});
```

### Integration Tests
```javascript
describe('Binance Integration', () => {
  test('should sync user balances from Binance', async () => {
    const userId = 'test-user-id';
    
    // Setup mock user credentials
    await UserExchangeCredentials.create({
      userId,
      exchange: 'binance',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret'
    });

    const exchangeService = new ExchangeService();
    const result = await exchangeService.syncUserBalances(userId, 'binance');
    
    expect(result.balances).toBeDefined();
    expect(Array.isArray(result.balances)).toBe(true);
  });
});
```

## Dependencies
- CP-012: API Rate Limiting and Throttling
- CP-008: Caching Layer and Performance Optimization
- CP-013: Logging, Monitoring and Analytics

## API Endpoints Integration

### Binance API Endpoints Used
1. **Public Market Data**
   - `/api/v3/ticker/price` - Current prices
   - `/api/v3/klines` - Historical candlestick data
   - `/api/v3/exchangeInfo` - Trading pair information

2. **Account Information** (Requires API credentials)
   - `/api/v3/account` - Account balances
   - `/api/v3/myTrades` - Trading history

3. **WebSocket Streams**
   - `<symbol>@ticker` - Real-time price updates
   - `<symbol>@depth` - Order book updates

## Rate Limiting Strategy

### Binance Rate Limits
- **General**: 1200 requests per minute
- **Account**: 60 requests per minute  
- **Orders**: 10 orders per second

### Implementation Strategy
- Distributed rate limiting using Redis
- Request queuing and batching
- Exponential backoff on rate limit errors
- Priority queuing for critical requests

## Error Handling

### Common Error Scenarios
1. **API Key Issues**: Invalid or expired credentials
2. **Rate Limiting**: Too many requests
3. **Network Issues**: Connection timeouts
4. **Data Issues**: Invalid symbols or parameters

### Error Recovery
```javascript
async retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Security Considerations

### API Credential Management
- Encrypted storage of user API keys
- Read-only permissions only
- Secure credential validation
- Regular security audits

### Data Privacy
- No trading operations (read-only)
- Secure data transmission (HTTPS)
- Data encryption at rest
- User consent for data access

## Definition of Done
- [ ] Binance API client implemented with full functionality
- [ ] Real-time and historical data fetching working
- [ ] Account synchronization and balance updates functional
- [ ] Trading history import and reconciliation complete
- [ ] WebSocket integration for live updates operational
- [ ] Rate limiting compliance verified
- [ ] Comprehensive error handling and retry logic
- [ ] Security measures for API credentials implemented
- [ ] All tests passing with high coverage
- [ ] Performance benchmarks meeting requirements
- [ ] Documentation complete with usage examples
- [ ] Production deployment with monitoring

## Estimated Time
**Beginner Developer**: 8-10 days
**Intermediate Developer**: 5-7 days
**Senior Developer**: 4-5 days

## Required Skills
- Cryptocurrency exchange APIs
- WebSocket real-time connections
- Rate limiting and API management
- Database synchronization patterns
- Error handling and retry mechanisms
- Security best practices for API credentials
- Financial data processing and validation
- Asynchronous programming patterns

## Related Issues
- CP-012: API Rate Limiting and Throttling
- CP-017: Coinbase Pro Exchange Integration
- CP-020: Multi-Exchange Data Synchronization
- CP-021: Exchange Rate Limiting and Error Handling