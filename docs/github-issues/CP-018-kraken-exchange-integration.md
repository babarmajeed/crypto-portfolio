# CP-018: Kraken Exchange Integration

## Objective
Implement comprehensive integration with Kraken exchange API to fetch real-time market data, historical prices, trading pairs, and account information, providing users with a complete view of their Kraken portfolio holdings.

## Priority
High

## Category
Exchange Integration

## Acceptance Criteria
- [ ] Kraken API client with proper authentication and API versioning
- [ ] Real-time price data fetching for all supported trading pairs
- [ ] Historical OHLCV data import with configurable intervals
- [ ] Account balance synchronization with staking rewards tracking
- [ ] Trading history import with comprehensive trade details
- [ ] WebSocket integration for live market updates
- [ ] Rate limiting compliance with Kraken's tiered limits
- [ ] Advanced error handling with retry strategies
- [ ] Data normalization and validation for consistency
- [ ] Comprehensive monitoring and health checks

## Technical Implementation Details

### Kraken API Client
```javascript
// services/exchanges/krakenClient.js
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const WebSocket = require('ws');

class KrakenClient {
  constructor() {
    this.publicURL = 'https://api.kraken.com/0/public';
    this.privateURL = 'https://api.kraken.com/0/private';
    this.wsURL = 'wss://ws.kraken.com';
    this.wsAuthURL = 'wss://ws-auth.kraken.com';
    
    this.rateLimiter = require('../rateLimitCoordinator');
    this.logger = require('../loggingService');
    this.cache = require('../cacheService');
    
    // Kraken uses different naming conventions
    this.assetPairMap = new Map();
    this.initializeAssetMapping();
    
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'CryptoPortfolio/1.0'
      }
    });
  }

  async initializeAssetMapping() {
    try {
      const assetPairs = await this.getAssetPairs();
      
      for (const [pairId, pairInfo] of Object.entries(assetPairs)) {
        this.assetPairMap.set(pairInfo.wsname || pairId, pairId);
        this.assetPairMap.set(pairId, pairInfo.wsname || pairId);
      }
    } catch (error) {
      this.logger.warn('Failed to initialize Kraken asset mapping', error);
    }
  }

  generateSignature(urlPath, data, secret, nonce) {
    const message = querystring.stringify(data);
    const secretBuffer = Buffer.from(secret, 'base64');
    const hash = crypto.createHash('sha256');
    const hmac = crypto.createHmac('sha512', secretBuffer);
    
    const hashDigest = hash.update(nonce + message).digest('binary');
    const hmacDigest = hmac.update(urlPath + hashDigest, 'binary').digest('base64');
    
    return hmacDigest;
  }

  async makePrivateRequest(endpoint, data = {}, userCredentials = null) {
    if (!userCredentials) {
      throw new Error('Authentication required for this endpoint');
    }

    const nonce = Date.now() * 1000; // Kraken requires microsecond precision
    const postData = { ...data, nonce };
    const urlPath = `/0/private/${endpoint}`;
    
    const signature = this.generateSignature(
      urlPath,
      postData,
      userCredentials.apiSecret,
      nonce
    );

    const headers = {
      'API-Key': userCredentials.apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    try {
      await this.rateLimiter.waitForExchangeAvailability('kraken', 1);

      const response = await this.axiosInstance.post(
        `${this.privateURL}/${endpoint}`,
        querystring.stringify(postData),
        { headers }
      );

      if (response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API error: ${response.data.error.join(', ')}`);
      }

      return response.data.result;
    } catch (error) {
      this.handleAPIError(error);
      throw error;
    }
  }

  async makePublicRequest(endpoint, params = {}) {
    try {
      await this.rateLimiter.waitForExchangeAvailability('kraken', 1);

      const response = await this.axiosInstance.get(
        `${this.publicURL}/${endpoint}`,
        { params }
      );

      if (response.data.error && response.data.error.length > 0) {
        throw new Error(`Kraken API error: ${response.data.error.join(', ')}`);
      }

      return response.data.result;
    } catch (error) {
      this.handleAPIError(error);
      throw error;
    }
  }

  async getCurrentPrices(pairs = []) {
    try {
      const cacheKey = 'kraken:current_prices';
      const cached = await this.cache.get(cacheKey);
      
      if (cached && pairs.length === 0) {
        return cached;
      }

      let tickerData;
      
      if (pairs.length === 0) {
        tickerData = await this.makePublicRequest('Ticker');
      } else {
        const pairString = pairs.join(',');
        tickerData = await this.makePublicRequest('Ticker', { pair: pairString });
      }

      const prices = {};
      
      for (const [pairId, ticker] of Object.entries(tickerData)) {
        prices[pairId] = this.formatPriceData(pairId, ticker);
      }

      // Cache for 30 seconds
      await this.cache.set(cacheKey, prices, 30);

      this.logger.info('Kraken prices fetched successfully', {
        pairCount: Object.keys(prices).length,
        exchange: 'kraken'
      });

      return prices;
    } catch (error) {
      this.logger.error('Failed to fetch Kraken prices', error, { pairs });
      throw new Error(`Kraken API error: ${error.message}`);
    }
  }

  async getHistoricalPrices(pair, interval = 1440, since = null) {
    try {
      const cacheKey = `kraken:historical:${pair}:${interval}:${since}`;
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const params = { pair, interval };
      if (since) params.since = since;

      const ohlcData = await this.makePublicRequest('OHLC', params);
      
      const pairData = ohlcData[pair];
      if (!pairData) {
        throw new Error(`No data found for pair: ${pair}`);
      }

      const historicalData = pairData.map(candle => ({
        timestamp: new Date(candle[0] * 1000),
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        vwap: parseFloat(candle[5]),
        volume: parseFloat(candle[6]),
        count: parseInt(candle[7])
      }));

      // Cache for 5 minutes
      await this.cache.set(cacheKey, historicalData, 300);

      return historicalData;
    } catch (error) {
      this.logger.error('Failed to fetch Kraken historical data', error, {
        pair,
        interval,
        since
      });
      throw error;
    }
  }

  async getAssetPairs() {
    try {
      const cacheKey = 'kraken:asset_pairs';
      const cached = await this.cache.get(cacheKey);
      
      if (cached) {
        return cached;
      }

      const assetPairs = await this.makePublicRequest('AssetPairs');
      
      // Cache for 1 hour
      await this.cache.set(cacheKey, assetPairs, 3600);

      return assetPairs;
    } catch (error) {
      this.logger.error('Failed to fetch Kraken asset pairs', error);
      throw error;
    }
  }

  async getAccountInfo(userId) {
    try {
      const userCredentials = await UserExchangeCredentials.findOne({
        where: { userId, exchange: 'kraken' }
      });

      if (!userCredentials) {
        throw new Error('Kraken credentials not configured for user');
      }

      const accountBalance = await this.makePrivateRequest('Balance', {}, userCredentials);
      
      const balances = [];
      
      for (const [asset, balance] of Object.entries(accountBalance)) {
        const balanceValue = parseFloat(balance);
        if (balanceValue > 0) {
          balances.push({
            asset: this.normalizeAssetName(asset),
            balance: balanceValue,
            locked: 0, // Kraken doesn't separate locked balances in this endpoint
            total: balanceValue
          });
        }
      }

      // Get staking balances if available
      try {
        const stakingBalance = await this.makePrivateRequest('Staking/Assets', {}, userCredentials);
        
        for (const stakingAsset of stakingBalance) {
          const existingBalance = balances.find(b => b.asset === stakingAsset.asset);
          if (existingBalance) {
            existingBalance.staking = parseFloat(stakingAsset.balance);
            existingBalance.total += existingBalance.staking;
          } else {
            balances.push({
              asset: stakingAsset.asset,
              balance: 0,
              staking: parseFloat(stakingAsset.balance),
              total: parseFloat(stakingAsset.balance)
            });
          }
        }
      } catch (stakingError) {
        // Staking endpoint might not be available for all accounts
        this.logger.info('Staking data not available', { userId });
      }

      this.logger.info('Kraken account info retrieved', {
        userId,
        balanceCount: balances.length
      });

      return {
        balances,
        updateTime: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to fetch Kraken account info', error, { userId });
      throw error;
    }
  }

  async getTradingHistory(userId, type = 'all', trades = true, start = null, end = null) {
    try {
      const userCredentials = await UserExchangeCredentials.findOne({
        where: { userId, exchange: 'kraken' }
      });

      if (!userCredentials) {
        throw new Error('Kraken credentials not configured for user');
      }

      const params = { type, trades };
      if (start) params.start = start;
      if (end) params.end = end;

      const tradesData = await this.makePrivateRequest('TradesHistory', params, userCredentials);
      
      const formattedTrades = [];
      
      for (const [tradeId, trade] of Object.entries(tradesData.trades)) {
        formattedTrades.push({
          id: tradeId,
          orderId: trade.ordertxid,
          pair: trade.pair,
          side: trade.type,
          orderType: trade.ordertype,
          price: parseFloat(trade.price),
          volume: parseFloat(trade.vol),
          fee: parseFloat(trade.fee),
          cost: parseFloat(trade.cost),
          margin: parseFloat(trade.margin || 0),
          time: new Date(trade.time * 1000),
          misc: trade.misc,
          ledgers: trade.ledgers
        });
      }

      return formattedTrades;
    } catch (error) {
      this.logger.error('Failed to fetch Kraken trading history', error, {
        userId,
        type
      });
      throw error;
    }
  }

  setupWebSocket(pairs, callback) {
    try {
      const ws = new WebSocket(this.wsURL);
      
      ws.on('open', () => {
        const subscribeMessage = {
          event: 'subscribe',
          pair: pairs,
          subscription: {
            name: 'ticker'
          }
        };
        
        ws.send(JSON.stringify(subscribeMessage));
        
        this.logger.info('Kraken WebSocket connection established', {
          pairCount: pairs.length
        });
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          
          // Kraken sends different message types
          if (Array.isArray(message) && message.length >= 4) {
            const [channelId, tickerData, channelName, pair] = message;
            
            if (channelName === 'ticker') {
              const formattedData = {
                pair: pair,
                price: parseFloat(tickerData.c[0]), // Last trade price
                bid: parseFloat(tickerData.b[0]),   // Best bid
                ask: parseFloat(tickerData.a[0]),   // Best ask
                volume: parseFloat(tickerData.v[1]), // Volume (24h)
                high: parseFloat(tickerData.h[1]),   // High (24h)
                low: parseFloat(tickerData.l[1]),    // Low (24h)
                change: parseFloat(tickerData.p[1]), // Change (24h)
                timestamp: new Date(),
                exchange: 'kraken'
              };

              callback(formattedData);
            }
          }
        } catch (error) {
          this.logger.error('Kraken WebSocket message processing error', error);
        }
      });

      ws.on('error', (error) => {
        this.logger.error('Kraken WebSocket error', error);
      });

      ws.on('close', () => {
        this.logger.info('Kraken WebSocket connection closed');
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          this.setupWebSocket(pairs, callback);
        }, 5000);
      });

      return ws;
    } catch (error) {
      this.logger.error('Failed to setup Kraken WebSocket', error, { pairs });
      throw error;
    }
  }

  formatPriceData(pair, ticker) {
    return {
      pair,
      price: parseFloat(ticker.c[0]), // Last trade price
      bid: parseFloat(ticker.b[0]),   // Best bid
      ask: parseFloat(ticker.a[0]),   // Best ask
      volume: parseFloat(ticker.v[1]), // Volume (24h)
      high: parseFloat(ticker.h[1]),   // High (24h)
      low: parseFloat(ticker.l[1]),    // Low (24h)
      change: parseFloat(ticker.p[1]), // Change (24h)
      timestamp: new Date(),
      exchange: 'kraken'
    };
  }

  normalizeAssetName(krakenAsset) {
    // Kraken uses different asset names (e.g., XXBT for BTC)
    const assetMap = {
      'XXBT': 'BTC',
      'XETH': 'ETH',
      'XLTC': 'LTC',
      'XREP': 'REP',
      'XZEC': 'ZEC',
      'ZUSD': 'USD',
      'ZEUR': 'EUR',
      'ZGBP': 'GBP',
      'ZJPY': 'JPY',
      'ZCAD': 'CAD'
    };

    return assetMap[krakenAsset] || krakenAsset;
  }

  handleAPIError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      // Kraken-specific error handling
      if (data && data.error) {
        const errorMessages = data.error;
        
        for (const errorMsg of errorMessages) {
          if (errorMsg.includes('EAPI:Rate limit exceeded')) {
            this.logger.warn('Kraken rate limit exceeded', { error: errorMsg });
          } else if (errorMsg.includes('EAPI:Invalid key')) {
            this.logger.error('Kraken invalid API key', { error: errorMsg });
          } else if (errorMsg.includes('EAPI:Invalid signature')) {
            this.logger.error('Kraken invalid signature', { error: errorMsg });
          } else {
            this.logger.error('Kraken API error', { error: errorMsg, status });
          }
        }
      }
    } else {
      this.logger.error('Kraken network error', error);
    }
  }

  async testConnection() {
    try {
      const serverTime = await this.makePublicRequest('Time');
      const systemStatus = await this.makePublicRequest('SystemStatus');

      return {
        connected: true,
        serverTime: new Date(serverTime.unixtime * 1000),
        status: systemStatus.status,
        timestamp: new Date(systemStatus.timestamp)
      };
    } catch (error) {
      this.logger.error('Kraken connection test failed', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = KrakenClient;
```

### Exchange Service Integration
```javascript
// services/exchanges/krakenExchangeService.js
class KrakenExchangeService {
  constructor() {
    this.client = new KrakenClient();
    this.logger = require('../loggingService');
  }

  async syncUserBalances(userId) {
    try {
      const accountInfo = await this.client.getAccountInfo(userId);
      
      // Convert Kraken format to standard format
      const standardBalances = accountInfo.balances.map(balance => ({
        asset: balance.asset,
        free: balance.balance - (balance.locked || 0),
        locked: balance.locked || 0,
        staking: balance.staking || 0,
        total: balance.total
      }));

      // Update user holdings in database
      await this.updateUserHoldings(userId, 'kraken', standardBalances);

      return {
        balances: standardBalances,
        updateTime: accountInfo.updateTime
      };
    } catch (error) {
      this.logger.error('Failed to sync Kraken balances', error, { userId });
      throw error;
    }
  }

  async updateUserHoldings(userId, exchange, balances) {
    const transaction = await db.transaction();
    
    try {
      // Clear existing Kraken holdings
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
          staking: balance.staking,
          source: exchange,
          lastUpdated: new Date()
        }));

      await Holding.bulkCreate(holdings, { transaction });
      
      await transaction.commit();

      this.logger.info('Kraken holdings updated successfully', {
        userId,
        holdingCount: holdings.length
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async importTradingHistory(userId, type = 'all') {
    try {
      const trades = await this.client.getTradingHistory(userId, type);
      const importedCount = await this.storeTradingHistory(userId, 'kraken', trades);

      return {
        imported: importedCount,
        total: trades.length,
        exchange: 'kraken',
        type
      };
    } catch (error) {
      this.logger.error('Failed to import Kraken trading history', error, {
        userId,
        type
      });
      throw error;
    }
  }

  async storeTradingHistory(userId, exchange, trades) {
    let importedCount = 0;
    
    for (const trade of trades) {
      try {
        // Parse asset names from pair
        const assetPairs = await this.client.getAssetPairs();
        const pairInfo = assetPairs[trade.pair];
        
        let baseAsset = trade.pair;
        let quoteAsset = 'USD';
        
        if (pairInfo) {
          baseAsset = this.client.normalizeAssetName(pairInfo.base);
          quoteAsset = this.client.normalizeAssetName(pairInfo.quote);
        }

        const [transaction, created] = await Transaction.findOrCreate({
          where: {
            userId,
            externalId: `${exchange}_${trade.id}`,
            source: exchange
          },
          defaults: {
            userId,
            symbol: baseAsset,
            type: trade.side,
            amount: trade.volume,
            price: trade.price,
            fee: trade.fee,
            feeAsset: quoteAsset,
            timestamp: trade.time,
            externalId: `${exchange}_${trade.id}`,
            source: exchange,
            metadata: {
              orderId: trade.orderId,
              pair: trade.pair,
              orderType: trade.orderType,
              cost: trade.cost,
              margin: trade.margin,
              misc: trade.misc,
              ledgers: trade.ledgers,
              originalData: trade
            }
          }
        });

        if (created) {
          importedCount++;
        }
      } catch (error) {
        this.logger.warn('Failed to import individual Kraken trade', error, {
          userId,
          tradeId: trade.id
        });
      }
    }

    return importedCount;
  }

  async getMarketData(pairs = []) {
    try {
      if (pairs.length === 0) {
        const assetPairs = await this.client.getAssetPairs();
        pairs = Object.keys(assetPairs).filter(pair => {
          const pairInfo = assetPairs[pair];
          return pairInfo.status === 'online';
        });
      }

      const prices = await this.client.getCurrentPrices(pairs);
      
      // Normalize data format
      const marketData = Object.entries(prices).map(([pair, data]) => ({
        symbol: pair,
        price: data.price,
        bid: data.bid,
        ask: data.ask,
        volume: data.volume,
        high: data.high,
        low: data.low,
        change: data.change,
        timestamp: data.timestamp,
        exchange: 'kraken'
      }));

      return marketData;
    } catch (error) {
      this.logger.error('Failed to get Kraken market data', error, { pairs });
      throw error;
    }
  }
}

module.exports = KrakenExchangeService;
```

## Required Technologies
- **axios** - HTTP client for API requests
- **crypto** - HMAC signature generation
- **querystring** - URL encoding for form data
- **ws** - WebSocket client for real-time data

## Testing Requirements

### Unit Tests
```javascript
describe('KrakenClient', () => {
  let krakenClient;

  beforeEach(() => {
    krakenClient = new KrakenClient();
  });

  test('should generate correct API signature', () => {
    const urlPath = '/0/private/Balance';
    const data = { nonce: 1640995200000 };
    const secret = 'test-secret';
    const nonce = 1640995200000;

    const signature = krakenClient.generateSignature(urlPath, data, secret, nonce);
    
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
  });

  test('should normalize Kraken asset names correctly', () => {
    expect(krakenClient.normalizeAssetName('XXBT')).toBe('BTC');
    expect(krakenClient.normalizeAssetName('XETH')).toBe('ETH');
    expect(krakenClient.normalizeAssetName('ZUSD')).toBe('USD');
    expect(krakenClient.normalizeAssetName('ADA')).toBe('ADA'); // No mapping
  });

  test('should fetch current prices for specific pairs', async () => {
    const prices = await krakenClient.getCurrentPrices(['XBTUSD', 'ETHUSD']);
    
    expect(prices).toHaveProperty('XBTUSD');
    expect(prices).toHaveProperty('ETHUSD');
    expect(prices['XBTUSD'].price).toBeGreaterThan(0);
  });
});
```

### Integration Tests
```javascript
describe('Kraken Integration', () => {
  test('should sync user balances including staking', async () => {
    const userId = 'test-user-id';
    
    await UserExchangeCredentials.create({
      userId,
      exchange: 'kraken',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret'
    });

    const exchangeService = new KrakenExchangeService();
    const result = await exchangeService.syncUserBalances(userId);
    
    expect(result.balances).toBeDefined();
    expect(Array.isArray(result.balances)).toBe(true);
    
    // Check if staking balances are included
    const stakingBalance = result.balances.find(b => b.staking > 0);
    if (stakingBalance) {
      expect(stakingBalance.total).toBe(stakingBalance.free + stakingBalance.locked + stakingBalance.staking);
    }
  });
});
```

## Dependencies
- CP-016: Binance Exchange Integration
- CP-017: Coinbase Pro Exchange Integration
- CP-012: API Rate Limiting and Throttling

## API Endpoints Integration

### Kraken API Endpoints
1. **Public Market Data**
   - `/0/public/Time` - Server time
   - `/0/public/SystemStatus` - System status
   - `/0/public/AssetPairs` - Trading pair information
   - `/0/public/Ticker` - Ticker information
   - `/0/public/OHLC` - OHLC data

2. **Private Endpoints** (Authenticated)
   - `/0/private/Balance` - Account balance
   - `/0/private/TradesHistory` - Trades history
   - `/0/private/Staking/Assets` - Staking balances

3. **WebSocket Feeds**
   - `ticker` - Real-time price updates
   - `trade` - Real-time trade data
   - `book` - Order book updates

## Rate Limiting Strategy

### Kraken Rate Limits
- **Public API**: No specific limits documented
- **Private API**: Tiered based on verification level
  - Starter: 15 calls per minute
  - Intermediate: 20 calls per minute  
  - Pro: 20 calls per minute

### Implementation Features
- Counter-based rate limiting
- User tier detection and adjustment
- Request queuing and prioritization
- Graceful degradation under limits

## Unique Kraken Features

### Asset Name Normalization
Kraken uses unique asset naming (XXBT for BTC, XETH for ETH)

### Staking Integration
- Native staking balance tracking
- Automatic staking reward calculation
- Integrated portfolio value including staked assets

### Advanced Order Types
- Support for margin trading data
- Complex order type tracking
- Comprehensive trade metadata

## Error Handling Patterns

### Kraken-Specific Errors
```javascript
const KRAKEN_ERRORS = {
  'EAPI:Invalid key': 'Invalid API key',
  'EAPI:Invalid signature': 'Invalid API signature',
  'EAPI:Rate limit exceeded': 'Rate limit exceeded',
  'EGeneral:Invalid arguments': 'Invalid arguments provided',
  'EService:Unavailable': 'Service temporarily unavailable',
  'EQuery:Unknown asset pair': 'Unknown trading pair'
};
```

### Retry Strategy
```javascript
async retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Definition of Done
- [ ] Kraken API client with complete authentication
- [ ] Real-time and historical data fetching operational
- [ ] Account balance sync including staking rewards
- [ ] Trading history import with asset normalization
- [ ] WebSocket integration for live market updates
- [ ] Rate limiting with tier-based adjustments
- [ ] Kraken-specific error handling implemented
- [ ] Asset name normalization working correctly
- [ ] All tests passing with comprehensive coverage
- [ ] Performance benchmarks meeting requirements
- [ ] Documentation complete with Kraken-specific examples
- [ ] Production deployment with monitoring

## Estimated Time
**Beginner Developer**: 8-10 days
**Intermediate Developer**: 5-7 days
**Senior Developer**: 4-5 days

## Required Skills
- Kraken API documentation understanding
- HMAC-SHA512 signature generation
- Asset name mapping and normalization
- Staking and DeFi integration concepts
- WebSocket real-time data handling
- Financial data processing patterns
- Error handling and retry mechanisms
- Performance optimization for API calls

## Related Issues
- CP-016: Binance Exchange Integration
- CP-017: Coinbase Pro Exchange Integration
- CP-019: KuCoin Exchange Integration
- CP-020: Multi-Exchange Data Synchronization