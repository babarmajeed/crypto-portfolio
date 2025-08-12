# CP-009: Background Job Processing and Queues

## Objective
Implement a robust background job processing system using message queues to handle time-consuming tasks like data synchronization, price updates, portfolio calculations, and email notifications without blocking the main application thread.

## Priority
High

## Category
Backend Infrastructure

## Acceptance Criteria
- [ ] Redis-based message queue system setup (Bull Queue)
- [ ] Job worker processes for different task types
- [ ] Price data synchronization jobs with scheduling
- [ ] Portfolio calculation and rebalancing jobs
- [ ] Email notification queue processing
- [ ] Failed job retry mechanisms with exponential backoff
- [ ] Job monitoring dashboard and metrics
- [ ] Dead letter queue for permanently failed jobs
- [ ] Rate limiting for API-dependent jobs
- [ ] Horizontal scaling support for workers

## Technical Implementation Details

### Queue System Architecture
```javascript
// queues/index.js
const Queue = require('bull');
const redis = require('../config/redis');

// Initialize different queues for different job types
const queues = {
  priceUpdate: new Queue('price update', redis.connection),
  portfolioCalculation: new Queue('portfolio calculation', redis.connection),
  emailNotification: new Queue('email notification', redis.connection),
  dataSync: new Queue('data synchronization', redis.connection),
  reportGeneration: new Queue('report generation', redis.connection)
};

module.exports = queues;
```

### Job Definitions
```javascript
// jobs/priceUpdateJob.js
class PriceUpdateJob {
  static async process(job) {
    const { symbols, exchange } = job.data;
    
    try {
      console.log(`Processing price update for ${symbols.length} symbols from ${exchange}`);
      
      const exchangeService = ExchangeFactory.create(exchange);
      const prices = await exchangeService.getCurrentPrices(symbols);
      
      // Batch update prices in database
      await PriceService.batchUpdatePrices(prices);
      
      // Emit real-time updates via WebSocket
      SocketService.emitPriceUpdates(prices);
      
      return { success: true, updatedCount: prices.length };
    } catch (error) {
      console.error('Price update job failed:', error);
      throw error;
    }
  }
}

// Register job processor
queues.priceUpdate.process('updatePrices', 5, PriceUpdateJob.process);
```

### Portfolio Calculation Job
```javascript
// jobs/portfolioCalculationJob.js
class PortfolioCalculationJob {
  static async process(job) {
    const { userId, portfolioId } = job.data;
    
    try {
      // Get user portfolio holdings
      const holdings = await Portfolio.getHoldings(portfolioId);
      
      // Calculate current values
      const calculations = await PortfolioService.calculateMetrics(holdings);
      
      // Update portfolio performance metrics
      await Portfolio.updateMetrics(portfolioId, calculations);
      
      // Check for rebalancing opportunities
      const rebalanceNeeded = await PortfolioService.checkRebalanceNeeds(portfolioId);
      
      if (rebalanceNeeded) {
        // Queue rebalancing notification
        await queues.emailNotification.add('rebalanceAlert', {
          userId,
          portfolioId,
          recommendations: rebalanceNeeded
        });
      }
      
      return { success: true, metrics: calculations };
    } catch (error) {
      console.error('Portfolio calculation failed:', error);
      throw error;
    }
  }
}
```

### Job Scheduler
```javascript
// scheduler/index.js
const cron = require('node-cron');
const queues = require('../queues');

class JobScheduler {
  static init() {
    // Price updates every minute during market hours
    cron.schedule('* * * * *', async () => {
      const activeSymbols = await Portfolio.getActiveSymbols();
      
      await queues.priceUpdate.add('updatePrices', {
        symbols: activeSymbols,
        exchange: 'binance'
      }, {
        priority: 1,
        attempts: 3,
        backoff: 'exponential'
      });
    });
    
    // Portfolio calculations every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      const activePortfolios = await Portfolio.getActivePortfolios();
      
      for (const portfolio of activePortfolios) {
        await queues.portfolioCalculation.add('calculateMetrics', {
          userId: portfolio.userId,
          portfolioId: portfolio.id
        }, {
          delay: Math.random() * 60000, // Spread load over 1 minute
          attempts: 2
        });
      }
    });
    
    // Daily reports at 9 AM
    cron.schedule('0 9 * * *', async () => {
      const users = await User.getActiveUsers();
      
      for (const user of users) {
        if (user.emailPreferences.dailyReport) {
          await queues.reportGeneration.add('dailyReport', {
            userId: user.id,
            date: new Date().toISOString().split('T')[0]
          });
        }
      }
    });
  }
}
```

### Worker Process
```javascript
// workers/index.js
const queues = require('../queues');

// Email notification worker
queues.emailNotification.process('sendEmail', 10, async (job) => {
  const { to, subject, template, data } = job.data;
  
  try {
    await EmailService.sendTemplatedEmail(to, subject, template, data);
    return { success: true, emailSent: true };
  } catch (error) {
    console.error('Email job failed:', error);
    throw error;
  }
});

// Data synchronization worker
queues.dataSync.process('syncExchangeData', 3, async (job) => {
  const { userId, exchangeId } = job.data;
  
  try {
    const exchangeService = ExchangeFactory.create(exchangeId);
    const trades = await exchangeService.getRecentTrades(userId);
    
    await Transaction.syncFromExchange(userId, trades);
    
    return { success: true, syncedCount: trades.length };
  } catch (error) {
    console.error('Exchange sync failed:', error);
    throw error;
  }
});
```

## Required Technologies
- **Bull** - Redis-based queue management
- **Redis** - Message broker and job storage
- **node-cron** - Job scheduling
- **ioredis** - Redis client
- **cluster** - Multi-process workers

## Testing Requirements

### Unit Tests
```javascript
describe('PriceUpdateJob', () => {
  test('should process price updates successfully', async () => {
    const jobData = {
      symbols: ['BTC', 'ETH'],
      exchange: 'binance'
    };
    
    const result = await PriceUpdateJob.process({ data: jobData });
    
    expect(result.success).toBe(true);
    expect(result.updatedCount).toBeGreaterThan(0);
  });
  
  test('should handle API failures gracefully', async () => {
    // Mock API failure
    ExchangeFactory.create = jest.fn().mockImplementation(() => ({
      getCurrentPrices: jest.fn().mockRejectedValue(new Error('API Error'))
    }));
    
    await expect(PriceUpdateJob.process({ data: {} })).rejects.toThrow('API Error');
  });
});
```

### Integration Tests
```javascript
describe('Queue Integration', () => {
  test('should add and process jobs correctly', async () => {
    const job = await queues.priceUpdate.add('updatePrices', {
      symbols: ['BTC'],
      exchange: 'test'
    });
    
    expect(job.id).toBeDefined();
    
    // Wait for processing
    const result = await job.finished();
    expect(result.success).toBe(true);
  });
});
```

## Dependencies
- CP-008: Caching Layer and Performance Optimization
- CP-010: Email and Notification Services
- CP-016-025: Exchange Integration issues

## Job Types and Priorities

### High Priority Jobs
1. **Price Updates** - Real-time price synchronization
2. **Portfolio Calculations** - Performance metrics
3. **Alert Processing** - User notifications

### Medium Priority Jobs
1. **Data Synchronization** - Exchange data import
2. **Report Generation** - Daily/weekly reports
3. **Backup Operations** - Data backup tasks

### Low Priority Jobs
1. **Analytics Processing** - Historical analysis
2. **Cleanup Tasks** - Old data removal
3. **Maintenance Jobs** - System optimization

## Monitoring and Metrics
```javascript
// monitoring/queueMetrics.js
class QueueMetrics {
  static async getStats() {
    const stats = {};
    
    for (const [name, queue] of Object.entries(queues)) {
      stats[name] = {
        waiting: await queue.getWaiting().length,
        active: await queue.getActive().length,
        completed: await queue.getCompleted().length,
        failed: await queue.getFailed().length,
        delayed: await queue.getDelayed().length
      };
    }
    
    return stats;
  }
}
```

## Definition of Done
- [ ] Bull queue system implemented and configured
- [ ] All job types created with proper error handling
- [ ] Job schedulers running for automated tasks
- [ ] Worker processes deployed and scaling
- [ ] Retry mechanisms working for failed jobs
- [ ] Monitoring dashboard showing queue health
- [ ] Dead letter queue handling implemented
- [ ] Performance testing completed
- [ ] Documentation with job management guide
- [ ] Production deployment with monitoring

## Estimated Time
**Beginner Developer**: 6-8 days
**Intermediate Developer**: 4-5 days
**Senior Developer**: 3-4 days

## Required Skills
- Message queue concepts and Redis
- Node.js worker processes and clustering
- Cron job scheduling and timing
- Error handling and retry strategies
- Performance monitoring and optimization
- Database transaction management
- API integration patterns

## Related Issues
- CP-008: Caching Layer and Performance Optimization
- CP-010: Email and Notification Services
- CP-013: Logging, Monitoring and Analytics
- CP-016: Binance Exchange Integration