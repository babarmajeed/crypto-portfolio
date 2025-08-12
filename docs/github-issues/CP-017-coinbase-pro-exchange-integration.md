# CP-017: Coinbase Pro Exchange Integration

## Objective
Implement comprehensive integration with Coinbase Pro (Advanced Trade) API to fetch real-time market data, historical prices, trading pairs, and account information for enhanced portfolio tracking capabilities.

## Priority
High

## Category
Exchange Integration

## Acceptance Criteria
- [ ] Coinbase Pro API client with proper authentication
- [ ] Real-time price data fetching for all supported products
- [ ] Historical price data import with OHLCV candles
- [ ] Account balance synchronization (read-only access)
- [ ] Trading history import and transaction mapping
- [ ] WebSocket feed integration for live market data
- [ ] Rate limiting compliance with Coinbase Pro limits
- [ ] Comprehensive error handling and circuit breakers
- [ ] Data validation and normalization
- [ ] Monitoring and alerting for API health

## Technical Implementation Details

### Coinbase Pro API Client
```javascript
// services/exchanges/coinbaseProClient.js
const axios = require('axios');
const crypto = require('crypto');
const WebSocket = require('ws');

class CoinbaseProClient {
  constructor() {
    this.baseURL = 'https://api.exchange.coinbase.com';
    this.sandboxURL = 'https://api-public.sandbox.exchange.coinbase.com';
    this.wsURL = 'wss://ws-feed.exchange.coinbase.com';
    this.wsSandboxURL = 'wss://ws-feed-public.sandbox.exchange.coinbase.com';
    
    this.isProduction = process.env.NODE_ENV === 'production';
    this.apiURL = this.isProduction ? this.baseURL : this.sandboxURL;
    this.websocketURL = this.isProduction ? this.wsURL : this.wsSandboxURL;
    
    this.rateLimiter = require('../rateLimitCoordinator');
    this.logger = require('../loggingService');
    this.cache = require('../cacheService');
    
    this.axiosInstance = axios.create({
      baseURL: this.apiURL,
      timeout: 30000,
      headers: {
        'CB-VERSION': '2023-01-01',
        'User-Agent': 'CryptoPortfolio/1.0'
      }
    });
  }

  generateSignature(timestamp, method, requestPath, body, secret) {
    const message = timestamp + method.toUpperCase() + requestPath + (body || '');
    return crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(message).digest('base64');
  }

  async makeAuthenticatedRequest(method, endpoint, data = null, userCredentials = null) {
    if (!userCredentials) {
      throw new Error('Authentication required for this endpoint');
    }

    const timestamp = Date.now() / 1000;
    const requestPath = endpoint;
    const body = data ? JSON.stringify(data) : '';
    
    const signature = this.generateSignature(
      timestamp,
      method,
      requestPath,
      body,
      userCredentials.passphrase
    );

    const headers = {
      'CB-ACCESS-KEY': userCredentials.apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'CB-ACCESS-PASSPHRASE': userCredentials.passphrase,
      'Content-Type': 'application/json'
    };

    try {
      await this.rateLimiter.waitForExchangeAvailability('coinbase', 1);

      const response = await this.axiosInstance({
        method,
        url: requestPath,
        data,
        headers
      });

      return response.data;
    } catch (error) {
      this.handleAPIError(error);
      throw error;
    }
  }

  async makePublicRequest(endpoint, params = {}) {
    try {
      await this.rateLimiter.waitForExchangeAvailability('coinbase', 1);

      const response = await this.axiosInstance.get(endpoint, { params });
      return response.data;
    } catch (error) {
      this.handleAPIError(error);
      throw error;
    }
  }

  async getCurrentPrices(productIds = []) {
    try {
      const cacheKey = 'coinbase:current_prices';
      const cached = await this.cache.get(cacheKey);
      
      if (cached && productIds.length === 0) {
        return cached;
      }

      const ticker = await this.makePublicRequest('/products/ticker');
      const prices = {};

      if (productIds.length === 0) {
        // Get all products
        const products = await this.getProducts();
        
        for (const product of products) {
          if (product.status === 'online' && product.trading_disabled === false) {
            try {
              const productTicker = await this.makePublicRequest(`/products/${product.id}/ticker`);
              prices[product.id] = this.formatPriceData(product.id, productTicker);
            } catch (error) {
              this.logger.warn(`Failed to fetch ticker for ${product.id}`, error);
            }
          }
        }
      } else {
        // Get specific products
        for (const productId of productIds) {
          try {
            const productTicker = await this.makePublicRequest(`/products/${productId}/ticker`);
            prices[productId] = this.formatPriceData(productId, productTicker);
          } catch (error) {
            this.logger.warn(`Failed to fetch ticker for ${productId}`, error);
          }
        }
      }

      // Cache for 30 seconds
      await this.cache.set(cacheKey, prices, 30);

      this.logger.info('Coinbase Pro prices fetched successfully', {
        productCount: Object.keys(prices).length,
        exchange: 'coinbase'
      });

      return prices;
    } catch (error) {
      this.logger.error('Failed to fetch Coinbase Pro prices', error, { productIds });
      throw new Error(`Coinbase Pro API error: ${error.message}`);
    }
  }

  async getHistoricalPrices(productId, granularity = 86400, start = null, end = null) {
    try {
      const cacheKey = `coinbase:historical:${productId}:${granularity}:${start}:${end}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const params = { granularity };
      
      if (start) params.start = start;
      if (end) params.end = end;

      const candles = await this.makePublicRequest(`/products/${productId}/candles`, params);

      const historicalData = candles.map(candle => ({
        timestamp: new Date(candle[0] * 1000),
        low: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        open: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5])
      })).sort((a, b) => a.timestamp - b.timestamp);

      // Cache for 5 minutes
      await this.cache.set(cacheKey, historicalData, 300);

      return historicalData;
    } catch (error) {
      this.logger.error('Failed to fetch Coinbase Pro historical data', error, {
        productId,
        granularity,
        start,
        end
      });
      throw error;
    }
  }

  async getProducts() {
    try {
      const cacheKey = 'coinbase:products';
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const products = await this.makePublicRequest('/products');
      
      const formattedProducts = products.map(product => ({
        id: product.id,
        displayName: product.display_name,
        baseCurrency: product.base_currency,
        quoteCurrency: product.quote_currency,
        baseMinSize: parseFloat(product.base_min_size),
        baseMaxSize: parseFloat(product.base_max_size),
        quoteIncrement: parseFloat(product.quote_increment),
        status: product.status,
        tradingDisabled: product.trading_disabled
      }));

      // Cache for 1 hour
      await this.cache.set(cacheKey, formattedProducts, 3600);

      return formattedProducts;
    } catch (error) {
      this.logger.error('Failed to fetch Coinbase Pro products', error);
      throw error;
    }
  }

  async getAccountInfo(userId) {
    try {
      const userCredentials = await UserExchangeCredentials.findOne({
        where: { userId, exchange: 'coinbase' }
      });

      if (!userCredentials) {
        throw new Error('Coinbase Pro credentials not configured for user');
      }

      const accounts = await this.makeAuthenticatedRequest(
        'GET',
        '/accounts',
        null,
        userCredentials
      );

      const balances = accounts
        .filter(account => parseFloat(account.balance) > 0 || parseFloat(account.hold) > 0)
        .map(account => ({
          currency: account.currency,
          balance: parseFloat(account.balance),
          hold: parseFloat(account.hold),
          available: parseFloat(account.available),
          total: parseFloat(account.balance)
        }));

      this.logger.info('Coinbase Pro account info retrieved', {
        userId,
        accountCount: accounts.length,
        balanceCount: balances.length
      });

      return {
        balances,
        accounts: accounts.length,
        updateTime: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to fetch Coinbase Pro account info', error, { userId });
      throw error;
    }
  }

  async getTradingHistory(userId, productId = '', limit = 100, after = null) {
    try {
      const userCredentials = await UserExchangeCredentials.findOne({
        where: { userId, exchange: 'coinbase' }
      });

      if (!userCredentials) {
        throw new Error('Coinbase Pro credentials not configured for user');
      }

      const params = { limit };
      if (after) params.after = after;

      let fills = [];
      
      if (productId) {
        params.product_id = productId;
        fills = await this.makeAuthenticatedRequest('GET', '/fills', null, userCredentials);
      } else {
        // Get fills for all products
        fills = await this.makeAuthenticatedRequest('GET', '/fills', null, userCredentials);
      }

      const formattedTrades = fills.map(fill => ({
        id: fill.trade_id,
        orderId: fill.order_id,
        productId: fill.product_id,
        side: fill.side,
        size: parseFloat(fill.size),
        price: parseFloat(fill.price),
        fee: parseFloat(fill.fee),
        liquidity: fill.liquidity,
        createdAt: new Date(fill.created_at),
        settled: fill.settled
      }));

      return formattedTrades;
    } catch (error) {
      this.logger.error('Failed to fetch Coinbase Pro trading history', error, {
        userId,
        productId
      });
      throw error;
    }
  }

  setupWebSocket(productIds, callback) {
    try {
      const ws = new WebSocket(this.websocketURL);
      
      ws.on('open', () => {
        const subscribeMessage = {
          type: 'subscribe',
          product_ids: productIds,
          channels: ['ticker', 'level2']
        };
        
        ws.send(JSON.stringify(subscribeMessage));
        
        this.logger.info('Coinbase Pro WebSocket connection established', {
          productCount: productIds.length
        });
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          
          if (message.type === 'ticker') {
            const formattedData = {
              productId: message.product_id,
              price: parseFloat(message.price),
              change24h: parseFloat(message.open_24h) - parseFloat(message.price),
              volume: parseFloat(message.volume_24h),
              time: new Date(message.time),
              exchange: 'coinbase'
            };

            callback(formattedData);
          }
        } catch (error) {
          this.logger.error('WebSocket message processing error', error);
        }
      });

      ws.on('error', (error) => {
        this.logger.error('Coinbase Pro WebSocket error', error);
      });

      ws.on('close', () => {
        this.logger.info('Coinbase Pro WebSocket connection closed');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          this.setupWebSocket(productIds, callback);
        }, 5000);
      });

      return ws;
    } catch (error) {
      this.logger.error('Failed to setup Coinbase Pro WebSocket', error, { productIds });
      throw error;
    }
  }

  formatPriceData(productId, ticker) {
    return {
      productId,
      price: parseFloat(ticker.price),
      bid: parseFloat(ticker.bid),
      ask: parseFloat(ticker.ask),
      volume: parseFloat(ticker.volume),
      timestamp: new Date(ticker.time),
      exchange: 'coinbase'
    };
  }

  handleAPIError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          this.logger.warn('Coinbase Pro API bad request', { status, data });
          break;
        case 401:
          this.logger.error('Coinbase Pro API unauthorized', { status, data });
          break;
        case 403:
          this.logger.error('Coinbase Pro API forbidden', { status, data });
          break;
        case 429:
          this.logger.warn('Coinbase Pro API rate limited', { status, data });
          break;
        case 500:
          this.logger.error('Coinbase Pro API server error', { status, data });
          break;
        default:
          this.logger.error('Coinbase Pro API error', { status, data });
      }
    } else {
      this.logger.error('Coinbase Pro network error', error);
    }
  }

  async testConnection() {
    try {
      const products = await this.makePublicRequest('/products');
      const serverTime = await this.makePublicRequest('/time');

      return {
        connected: true,
        serverTime: new Date(serverTime.iso),
        productCount: products.length
      };
    } catch (error) {
      this.logger.error('Coinbase Pro connection test failed', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = CoinbaseProClient;
```

### Exchange Service Integration
```javascript
// services/exchanges/coinbaseExchangeService.js
class CoinbaseExchangeService {
  constructor() {
    this.client = new CoinbaseProClient();
    this.logger = require('../loggingService');
  }

  async syncUserBalances(userId) {
    try {
      const accountInfo = await this.client.getAccountInfo(userId);
      
      // Convert Coinbase format to standard format
      const standardBalances = accountInfo.balances.map(balance => ({
        asset: balance.currency,
        free: balance.available,
        locked: balance.hold,
        total: balance.total
      }));

      // Update user holdings in database
      await this.updateUserHoldings(userId, 'coinbase', standardBalances);

      return {
        balances: standardBalances,
        updateTime: accountInfo.updateTime
      };
    } catch (error) {
      this.logger.error('Failed to sync Coinbase balances', error, { userId });
      throw error;
    }
  }

  async updateUserHoldings(userId, exchange, balances) {
    const transaction = await db.transaction();
    
    try {
      // Clear existing Coinbase holdings
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
          available: balance.free,
          locked: balance.locked,
          source: exchange,
          lastUpdated: new Date()
        }));

      await Holding.bulkCreate(holdings, { transaction });
      
      await transaction.commit();

      this.logger.info('Coinbase holdings updated successfully', {
        userId,
        holdingCount: holdings.length
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async importTradingHistory(userId, productId = '') {
    try {
      const trades = await this.client.getTradingHistory(userId, productId);
      const importedCount = await this.storeTradingHistory(userId, 'coinbase', trades);

      return {
        imported: importedCount,
        total: trades.length,
        exchange: 'coinbase',
        productId
      };
    } catch (error) {
      this.logger.error('Failed to import Coinbase trading history', error, {
        userId,
        productId
      });
      throw error;
    }
  }

  async storeTradingHistory(userId, exchange, trades) {
    let importedCount = 0;
    
    for (const trade of trades) {
      try {
        // Parse product ID to get base and quote currencies
        const [baseCurrency, quoteCurrency] = trade.productId.split('-');
        
        const [transaction, created] = await Transaction.findOrCreate({
          where: {
            userId,
            externalId: `${exchange}_${trade.id}`,
            source: exchange
          },
          defaults: {
            userId,
            symbol: baseCurrency,
            type: trade.side,
            amount: trade.size,
            price: trade.price,
            fee: trade.fee,
            feeAsset: quoteCurrency,
            timestamp: trade.createdAt,
            externalId: `${exchange}_${trade.id}`,
            source: exchange,
            metadata: {
              orderId: trade.orderId,
              productId: trade.productId,
              liquidity: trade.liquidity,
              settled: trade.settled,
              originalData: trade
            }
          }
        });

        if (created) {
          importedCount++;
        }
      } catch (error) {
        this.logger.warn('Failed to import individual Coinbase trade', error, {
          userId,
          tradeId: trade.id
        });
      }
    }

    return importedCount;
  }

  async getMarketData(productIds = []) {
    try {
      if (productIds.length === 0) {
        const products = await this.client.getProducts();
        productIds = products
          .filter(p => p.status === 'online' && !p.tradingDisabled)
          .map(p => p.id);
      }

      const prices = await this.client.getCurrentPrices(productIds);
      
      // Normalize data format
      const marketData = Object.entries(prices).map(([productId, data]) => ({
        symbol: productId,
        price: data.price,
        bid: data.bid,
        ask: data.ask,
        volume: data.volume,
        timestamp: data.timestamp,
        exchange: 'coinbase'
      }));

      return marketData;
    } catch (error) {
      this.logger.error('Failed to get Coinbase market data', error, { productIds });
      throw error;
    }
  }
}

module.exports = CoinbaseExchangeService;
```

## Required Technologies
- **axios** - HTTP client for REST API calls
- **ws** - WebSocket client for real-time data
- **crypto** - HMAC signature generation
- **rate-limiter-flexible** - Rate limiting

## Testing Requirements

### Unit Tests
```javascript
describe('CoinbaseProClient', () => {
  let coinbaseClient;

  beforeEach(() => {
    coinbaseClient = new CoinbaseProClient();
  });

  test('should fetch current prices for specific products', async () => {
    const prices = await coinbaseClient.getCurrentPrices(['BTC-USD', 'ETH-USD']);
    
    expect(prices).toHaveProperty('BTC-USD');
    expect(prices).toHaveProperty('ETH-USD');
    expect(prices['BTC-USD'].price).toBeGreaterThan(0);
  });

  test('should generate correct API signature', () => {
    const timestamp = 1640995200;
    const method = 'GET';
    const requestPath = '/accounts';
    const body = '';
    const secret = 'test-secret';

    const signature = coinbaseClient.generateSignature(timestamp, method, requestPath, body, secret);
    
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
  });

  test('should handle rate limiting correctly', async () => {
    const rateLimitSpy = jest.spyOn(coinbaseClient.rateLimiter, 'waitForExchangeAvailability');
    
    await coinbaseClient.getCurrentPrices(['BTC-USD']);
    
    expect(rateLimitSpy).toHaveBeenCalledWith('coinbase', 1);
  });
});
```

### Integration Tests
```javascript
describe('Coinbase Pro Integration', () => {
  test('should sync user balances from Coinbase Pro', async () => {
    const userId = 'test-user-id';
    
    await UserExchangeCredentials.create({
      userId,
      exchange: 'coinbase',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret',
      passphrase: 'test-passphrase'
    });

    const exchangeService = new CoinbaseExchangeService();
    const result = await exchangeService.syncUserBalances(userId);
    
    expect(result.balances).toBeDefined();
    expect(Array.isArray(result.balances)).toBe(true);
  });

  test('should import trading history correctly', async () => {
    const userId = 'test-user-id';
    const exchangeService = new CoinbaseExchangeService();
    
    const result = await exchangeService.importTradingHistory(userId, 'BTC-USD');
    
    expect(result.imported).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeGreaterThanOrEqual(result.imported);
  });
});
```

## Dependencies
- CP-016: Binance Exchange Integration
- CP-012: API Rate Limiting and Throttling
- CP-008: Caching Layer and Performance Optimization

## API Endpoints Integration

### Coinbase Pro API Endpoints
1. **Public Market Data**
   - `/products` - Trading pairs information
   - `/products/<id>/ticker` - Current price data
   - `/products/<id>/candles` - Historical OHLCV data

2. **Authenticated Endpoints**
   - `/accounts` - Account balances
   - `/fills` - Trading history and fills

3. **WebSocket Feeds**
   - `ticker` channel - Real-time price updates
   - `level2` channel - Order book updates

## Rate Limiting Strategy

### Coinbase Pro Rate Limits
- **Public**: 3 requests per second
- **Private**: 5 requests per second per API key
- **Message rate**: 4 messages per second for WebSocket

### Implementation Strategy
- Request queuing with priority levels
- Separate rate limiters for public and private endpoints
- WebSocket connection management with reconnection logic
- Exponential backoff for failed requests

## Authentication & Security

### API Key Authentication
```javascript
// CB-ACCESS-KEY: API key
// CB-ACCESS-SIGN: Base64-encoded HMAC SHA256 signature
// CB-ACCESS-TIMESTAMP: Request timestamp
// CB-ACCESS-PASSPHRASE: API key passphrase
```

### Security Best Practices
- Secure storage of API credentials
- Read-only API permissions
- Request signature validation
- Connection encryption (HTTPS/WSS)

## Error Handling Patterns

### Common Coinbase Pro Errors
1. **400 Bad Request**: Invalid parameters
2. **401 Unauthorized**: Authentication failed
3. **403 Forbidden**: Insufficient permissions
4. **429 Too Many Requests**: Rate limit exceeded
5. **500 Internal Server Error**: Coinbase server issues

### Circuit Breaker Implementation
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Definition of Done
- [ ] Coinbase Pro API client fully implemented
- [ ] Real-time and historical data fetching operational
- [ ] Account synchronization and balance updates working
- [ ] Trading history import with proper mapping
- [ ] WebSocket integration for live market data
- [ ] Rate limiting compliance verified
- [ ] Authentication and security measures implemented
- [ ] Comprehensive error handling and circuit breakers
- [ ] All tests passing with high coverage
- [ ] Performance benchmarks meeting requirements
- [ ] Documentation complete with API usage examples
- [ ] Production deployment with monitoring

## Estimated Time
**Beginner Developer**: 7-9 days
**Intermediate Developer**: 5-6 days
**Senior Developer**: 3-5 days

## Required Skills
- REST API integration and authentication
- WebSocket real-time data handling
- HMAC signature generation and validation
- Rate limiting and circuit breaker patterns
- Financial data processing and normalization
- Error handling and retry mechanisms
- Security best practices for API credentials
- Asynchronous JavaScript programming

## Related Issues
- CP-016: Binance Exchange Integration
- CP-018: Kraken Exchange Integration
- CP-020: Multi-Exchange Data Synchronization
- CP-021: Exchange Rate Limiting and Error Handling