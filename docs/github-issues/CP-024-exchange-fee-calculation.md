# CP-024: Exchange Fee Calculator and Optimizer

## Overview
Implement comprehensive fee calculation and optimization system to help users minimize trading costs across different exchanges and trading strategies.

## Objectives
- Calculate trading fees for different order types and sizes
- Compare fees across exchanges for optimal execution
- Implement fee tier tracking based on trading volume
- Create fee optimization recommendations

## Acceptance Criteria
- [ ] Accurate fee calculation for all supported exchanges
- [ ] Fee comparison tool for cross-exchange analysis
- [ ] Trading volume tracking for fee tier determination
- [ ] Fee optimization suggestions
- [ ] Historical fee tracking and analysis
- [ ] Maker/taker fee differentiation
- [ ] Withdrawal fee calculations
- [ ] Fee impact on profit/loss calculations
- [ ] Real-time fee updates from exchange APIs

## Technical Implementation

### File Structure
```
src/
  services/
    fees/
      FeeCalculatorService.js
      FeeOptimizerService.js
      FeeTierTracker.js
      ExchangeFeeProvider.js
  types/
    fee.types.js
  config/
    fee-schedules.js
```

### Core Implementation
```javascript
// FeeCalculatorService.js
class FeeCalculatorService {
  constructor() {
    this.feeProviders = new Map();
    this.feeTierTracker = new FeeTierTracker();
  }

  async calculateTradingFee(exchange, orderType, amount, price, symbol) {
    const feeProvider = this.feeProviders.get(exchange);
    const userTier = await this.feeTierTracker.getUserTier(exchange);
    
    const feeRate = feeProvider.getFeeRate(orderType, userTier, symbol);
    const orderValue = amount * price;
    
    return {
      feeRate,
      feeAmount: orderValue * feeRate,
      orderValue,
      netAmount: orderValue - (orderValue * feeRate),
      tier: userTier,
      feeType: orderType === 'market' ? 'taker' : 'maker'
    };
  }

  async calculateWithdrawalFee(exchange, symbol, amount) {
    const feeProvider = this.feeProviders.get(exchange);
    const withdrawalFee = await feeProvider.getWithdrawalFee(symbol);
    
    return {
      feeAmount: withdrawalFee.fixed || (amount * withdrawalFee.percentage),
      feeType: withdrawalFee.type,
      minimumWithdrawal: withdrawalFee.minimum,
      maximumWithdrawal: withdrawalFee.maximum
    };
  }

  async compareExchangeFees(symbol, amount, price, orderType) {
    const exchanges = Array.from(this.feeProviders.keys());
    const feeComparisons = await Promise.all(
      exchanges.map(async exchange => {
        const fee = await this.calculateTradingFee(
          exchange, orderType, amount, price, symbol
        );
        return { exchange, ...fee };
      })
    );

    return feeComparisons.sort((a, b) => a.feeAmount - b.feeAmount);
  }
}
```

### Fee Tier Tracking
```javascript
// FeeTierTracker.js
class FeeTierTracker {
  constructor(portfolioService) {
    this.portfolioService = portfolioService;
    this.tierCache = new Map();
  }

  async getUserTier(exchange) {
    const cached = this.tierCache.get(exchange);
    if (cached && this.isCacheValid(cached)) {
      return cached.tier;
    }

    const tradingVolume = await this.get30DayVolume(exchange);
    const tier = this.calculateTier(exchange, tradingVolume);
    
    this.tierCache.set(exchange, {
      tier,
      volume: tradingVolume,
      timestamp: Date.now()
    });

    return tier;
  }

  calculateTier(exchange, volume) {
    const tiers = FEE_TIERS[exchange];
    
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (volume >= tiers[i].volumeThreshold) {
        return tiers[i];
      }
    }
    
    return tiers[0]; // Default tier
  }

  async get30DayVolume(exchange) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const trades = await this.portfolioService.getTrades({
      exchange,
      startDate: thirtyDaysAgo,
      endDate: new Date()
    });

    return trades.reduce((total, trade) => 
      total + (trade.quantity * trade.price), 0
    );
  }
}
```

### Fee Optimizer
```javascript
// FeeOptimizerService.js
class FeeOptimizerService {
  constructor(feeCalculator) {
    this.feeCalculator = feeCalculator;
  }

  async optimizeOrder(symbol, amount, side) {
    const exchanges = ['binance', 'coinbase', 'kraken'];
    const currentPrice = await this.getCurrentPrice(symbol);
    
    const optimizations = await Promise.all(
      exchanges.map(async exchange => {
        const marketFee = await this.feeCalculator.calculateTradingFee(
          exchange, 'market', amount, currentPrice, symbol
        );
        
        const limitFee = await this.feeCalculator.calculateTradingFee(
          exchange, 'limit', amount, currentPrice, symbol
        );

        return {
          exchange,
          market: marketFee,
          limit: limitFee,
          savings: marketFee.feeAmount - limitFee.feeAmount
        };
      })
    );

    return this.rankOptimizations(optimizations);
  }

  rankOptimizations(optimizations) {
    return optimizations
      .sort((a, b) => a.limit.feeAmount - b.limit.feeAmount)
      .map((opt, index) => ({
        ...opt,
        rank: index + 1,
        recommendation: this.generateRecommendation(opt)
      }));
  }

  generateRecommendation(optimization) {
    const { market, limit, savings, exchange } = optimization;
    
    if (savings > 0) {
      return {
        type: 'use_limit_order',
        message: `Use limit order on ${exchange} to save $${savings.toFixed(2)}`,
        savingsAmount: savings,
        savingsPercentage: (savings / market.feeAmount) * 100
      };
    }
    
    return {
      type: 'optimal',
      message: `${exchange} offers the lowest fees for this trade`,
      totalFee: limit.feeAmount
    };
  }
}
```

### Fee Configuration
```javascript
// fee-schedules.js
export const FEE_TIERS = {
  binance: [
    { tier: 0, volumeThreshold: 0, makerFee: 0.001, takerFee: 0.001 },
    { tier: 1, volumeThreshold: 50, makerFee: 0.0009, takerFee: 0.001 },
    { tier: 2, volumeThreshold: 500, makerFee: 0.0008, takerFee: 0.001 },
    // ... more tiers
  ],
  coinbase: [
    { tier: 0, volumeThreshold: 0, makerFee: 0.005, takerFee: 0.005 },
    { tier: 1, volumeThreshold: 10000, makerFee: 0.0035, takerFee: 0.005 },
    // ... more tiers
  ]
};

export const WITHDRAWAL_FEES = {
  binance: {
    BTC: { fixed: 0.0005, minimum: 0.001 },
    ETH: { fixed: 0.005, minimum: 0.01 },
    // ... more assets
  }
};
```

## Testing Requirements
- Unit tests for fee calculations
- Integration tests with exchange APIs
- Fee tier calculation accuracy tests
- Optimization algorithm validation
- Historical fee tracking tests

## Dependencies
- Depends on: CP-003 (Exchange API Integration)
- Depends on: CP-004 (Portfolio Management)
- Blocks: CP-055 (Cost Basis Tracking)

## Time Estimate
**Beginner**: 6-7 days
**Intermediate**: 3-4 days
**Advanced**: 2-3 days

## Required Skills
- Financial calculations and fee structures
- Algorithm optimization
- Data caching strategies
- Trading concept understanding
- Mathematical precision handling