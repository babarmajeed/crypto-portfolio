# Job Processing System Documentation

## Overview

The crypto portfolio backend includes a comprehensive background job processing system built with Bull queues, Redis, and Node.js clustering. This system handles asynchronous tasks like price updates, portfolio calculations, email notifications, data synchronization, and report generation.

## Architecture

### Core Components

1. **Queue System** (`src/queues/`)
   - Bull-based message queues
   - Redis storage backend
   - Configurable priorities and retries
   - Dead letter queue support

2. **Job Processors** (`src/jobs/`)
   - Specialized handlers for each job type
   - Error handling and retry logic
   - Performance metrics collection
   - Real-time progress updates

3. **Worker Management** (`src/workers/`)
   - Multi-process worker clustering
   - Health monitoring and auto-recovery
   - Graceful shutdown handling
   - Dynamic scaling capabilities

4. **Scheduler** (`src/scheduler/`)
   - Cron-based job scheduling
   - Configurable intervals
   - Job dependency management
   - Automatic scheduling for recurring tasks

5. **Monitoring** (`src/monitoring/`)
   - Real-time metrics collection
   - Performance dashboards
   - Error tracking and alerting
   - System health monitoring

## Queue Types

### 1. Price Update Queue
- **Purpose**: Real-time price synchronization from exchanges
- **Concurrency**: 5 workers
- **Priority**: High
- **Frequency**: Every minute (high priority symbols), Every 5 minutes (all symbols)
- **Retry**: 3 attempts with exponential backoff

### 2. Portfolio Calculation Queue
- **Purpose**: Calculate portfolio values and performance metrics
- **Concurrency**: 3 workers
- **Priority**: High
- **Frequency**: Every 5 minutes
- **Retry**: 3 attempts with exponential backoff

### 3. Email Notification Queue
- **Purpose**: Send templated emails and alerts
- **Concurrency**: 10 workers
- **Priority**: Medium
- **Frequency**: On-demand
- **Retry**: 5 attempts with exponential backoff

### 4. Data Sync Queue
- **Purpose**: Synchronize exchange data (transactions, balances, orders)
- **Concurrency**: 3 workers
- **Priority**: Medium
- **Frequency**: Every hour
- **Retry**: 5 attempts with exponential backoff

### 5. Report Generation Queue
- **Purpose**: Generate portfolio reports (PDF, CSV, Excel)
- **Concurrency**: 2 workers
- **Priority**: Low
- **Frequency**: Daily/Weekly scheduled
- **Retry**: 3 attempts with exponential backoff

## API Endpoints

### Queue Management

```bash
# Get queue status
GET /api/v1/queues/status

# Pause a queue
POST /api/v1/queues/pause/:queueName

# Resume a queue
POST /api/v1/queues/resume/:queueName

# Clean old jobs
POST /api/v1/queues/clean/:queueName?grace=86400000
```

### Job Creation

```bash
# Schedule price update
POST /api/v1/queues/jobs/price-update
{
  "symbols": ["BTC", "ETH"],
  "priority": 10
}

# Schedule portfolio calculation
POST /api/v1/queues/jobs/portfolio-calculation
{
  "userId": "user123",
  "calculateAll": true
}

# Schedule email notification
POST /api/v1/queues/jobs/email-notification
{
  "to": "user@example.com",
  "template": "welcome",
  "subject": "Welcome!",
  "data": {"name": "John"}
}

# Schedule data sync
POST /api/v1/queues/jobs/data-sync
{
  "userId": "user123",
  "exchange": "binance",
  "syncType": "transactions"
}

# Schedule report generation
POST /api/v1/queues/jobs/report-generation
{
  "userId": "user123",
  "reportType": "portfolio_summary",
  "format": "pdf",
  "period": "monthly"
}
```

### Monitoring

```bash
# Get dashboard
GET /api/v1/queues/dashboard

# Get system metrics
GET /api/v1/queues/metrics/system/:hours

# Get queue metrics
GET /api/v1/queues/metrics/queue/:queueName/:hours

# Get performance summary
GET /api/v1/queues/performance/summary
```

### Scheduler

```bash
# Get scheduled jobs
GET /api/v1/queues/scheduler/jobs

# Toggle scheduled job
POST /api/v1/queues/scheduler/toggle/:jobId
{
  "enabled": false
}
```

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_QUEUE_DB=1

# Worker Configuration
MAX_WORKERS=4
WORKER_CONCURRENCY=5

# Job Configuration
JOB_RETRY_ATTEMPTS=3
JOB_RETRY_DELAY=5000
JOB_CLEANUP_INTERVAL=3600000
```

### Queue Configuration

Each queue can be configured with:
- **Concurrency**: Number of jobs processed simultaneously
- **Retry Attempts**: Number of retry attempts for failed jobs
- **Retry Delay**: Delay between retry attempts (exponential backoff)
- **Priority**: Job priority (1-15, higher = more important)
- **Remove Policies**: When to remove completed/failed jobs

## Usage Examples

### Programmatic Job Scheduling

```typescript
import { jobProcessingService } from '@/services/jobProcessingService';

// Initialize and start job processing
await jobProcessingService.initialize();
await jobProcessingService.start();

// Schedule immediate price update
const jobId = await jobProcessingService.scheduleImmediatePriceUpdate(['BTC', 'ETH']);

// Schedule user portfolio calculation
const portfolioJobId = await jobProcessingService.scheduleUserPortfolioCalculation('user123');

// Schedule welcome email
const emailJobId = await jobProcessingService.scheduleWelcomeEmail(
  'user@example.com',
  { name: 'John Doe' }
);

// Schedule exchange sync
const syncJobId = await jobProcessingService.scheduleExchangeSync(
  'user123',
  'binance',
  SyncType.TRANSACTIONS
);

// Schedule tax report
const reportJobId = await jobProcessingService.scheduleTaxReport('user123', 2023);
```

### Bulk Operations

```typescript
// Bulk price updates
const symbolGroups = [['BTC', 'ETH'], ['ADA', 'SOL']];
const jobIds = await jobProcessingService.scheduleBulkPriceUpdates(symbolGroups);

// Bulk portfolio calculations
const userIds = ['user1', 'user2', 'user3'];
const portfolioJobIds = await jobProcessingService.scheduleBulkPortfolioCalculations(userIds);
```

## Monitoring and Metrics

### Dashboard Features

- **Overview**: Total queues, jobs, workers, system health
- **Queue Status**: Waiting, active, completed, failed jobs per queue
- **Worker Health**: Worker status, job processing counts, uptime
- **Performance**: Throughput, error rates, processing times
- **Alerts**: System health alerts and warnings

### Key Metrics

- **Throughput**: Jobs processed per minute
- **Error Rate**: Percentage of failed jobs
- **Processing Time**: Average job processing duration
- **Queue Backlog**: Number of waiting jobs
- **Worker Utilization**: Active workers vs total workers
- **System Health**: Overall system status (healthy/warning/critical)

## Error Handling

### Retry Strategy

1. **Exponential Backoff**: Delays increase exponentially (1s, 5s, 25s)
2. **Maximum Attempts**: Configurable per queue type
3. **Dead Letter Queue**: Permanently failed jobs moved to DLQ
4. **Error Classification**: Retryable vs non-retryable errors

### Error Recovery

- **Worker Recovery**: Automatic worker restart on failures
- **Queue Recovery**: Stalled job detection and recovery
- **Data Recovery**: Redis persistence for queue state
- **Graceful Degradation**: System continues with reduced capacity

## Performance Optimization

### Scaling Strategies

1. **Horizontal Scaling**: Add more worker processes
2. **Queue Splitting**: Separate queues for different job types
3. **Priority Queues**: Process high-priority jobs first
4. **Batch Processing**: Group related jobs together

### Memory Management

- **Job Cleanup**: Automatic removal of old completed jobs
- **Memory Monitoring**: Track worker memory usage
- **Garbage Collection**: Regular cleanup of stale data
- **Resource Limits**: Set memory limits per worker

## Development

### Running Locally

```bash
# Start Redis
redis-server

# Start the application (includes job processing)
npm run dev

# Run workers separately (optional)
npm run worker

# Run scheduler separately (optional)
npm run scheduler

# Open queue dashboard
npm run queue:dashboard

# Clean all queues
npm run queue:clean
```

### Testing

```bash
# Run job processing tests
npm test -- --testPathPattern=queue

# Test specific queue functionality
npm test -- src/tests/queue.test.ts

# Run with coverage
npm run test:coverage
```

### Debugging

1. **Logging**: Detailed logs for all job processing activities
2. **Dashboard**: Real-time monitoring via web interface
3. **Redis CLI**: Direct queue inspection with Redis commands
4. **Metrics**: Performance metrics collection and analysis

## Production Deployment

### Prerequisites

- Redis cluster for high availability
- Sufficient memory for job storage
- Network connectivity to all exchanges
- Email service configuration (SMTP/SendGrid)

### Deployment Checklist

- [ ] Configure Redis with persistence
- [ ] Set appropriate worker limits
- [ ] Configure error monitoring (Sentry)
- [ ] Set up log aggregation
- [ ] Configure health check endpoints
- [ ] Set up monitoring and alerting
- [ ] Test failover scenarios
- [ ] Configure backup strategies

### Security Considerations

- Secure Redis with authentication
- Encrypt sensitive job data
- Implement access controls for admin endpoints
- Monitor for suspicious job patterns
- Rate limit job creation APIs
- Audit job processing logs

## Troubleshooting

### Common Issues

1. **Queue Backlog**: High number of waiting jobs
   - Solution: Scale workers, optimize job processing

2. **High Error Rate**: Many failed jobs
   - Solution: Check external service connectivity, review error logs

3. **Worker Crashes**: Workers repeatedly failing
   - Solution: Review memory usage, check for unhandled exceptions

4. **Slow Processing**: Jobs taking too long
   - Solution: Optimize job logic, add more workers

5. **Redis Connection Issues**: Queue operations failing
   - Solution: Check Redis connectivity, increase connection limits

### Debug Commands

```bash
# Check queue status
curl http://localhost:3001/api/v1/queues/status

# View Redis queue data
redis-cli
> KEYS bull:*
> LLEN bull:priceUpdate:waiting

# Monitor worker processes
ps aux | grep node

# Check application logs
tail -f logs/application.log
```

## Support

For issues related to the job processing system:

1. Check the dashboard at `/api/v1/queues/dashboard`
2. Review application logs
3. Check Redis connectivity and status
4. Monitor system resources (CPU, memory)
5. Verify external service availability

For further assistance, contact the development team or refer to the main project documentation.