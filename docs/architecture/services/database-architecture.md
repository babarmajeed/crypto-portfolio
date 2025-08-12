# Database Architecture Design

## Overview
Multi-database strategy optimized for different data patterns and access requirements.

## Database Selection Strategy

### PostgreSQL - Primary Transactional Database

**Use Cases:**
- User accounts and authentication data
- Portfolio holdings and transactions
- Financial calculations requiring ACID compliance
- Structured relational data with complex queries

**Schema Design:**

```sql
-- Users and Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Profiles
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency_preference VARCHAR(3) DEFAULT 'USD',
    notification_preferences JSONB,
    risk_tolerance VARCHAR(20) CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exchanges
CREATE TABLE exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    api_base_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    supported_features JSONB,
    rate_limits JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Exchange Connections
CREATE TABLE user_exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    exchange_id UUID NOT NULL REFERENCES exchanges(id),
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    passphrase_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, exchange_id)
);

-- Cryptocurrencies
CREATE TABLE cryptocurrencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    coingecko_id VARCHAR(100),
    coinmarketcap_id INTEGER,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol)
);

-- Portfolio Holdings
CREATE TABLE portfolio_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    exchange_id UUID REFERENCES exchanges(id),
    cryptocurrency_id UUID NOT NULL REFERENCES cryptocurrencies(id),
    quantity DECIMAL(36, 18) NOT NULL DEFAULT 0,
    average_cost_basis DECIMAL(18, 8),
    total_cost_basis DECIMAL(18, 8),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, exchange_id, cryptocurrency_id)
);

-- Transactions
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    exchange_id UUID REFERENCES exchanges(id),
    cryptocurrency_id UUID NOT NULL REFERENCES cryptocurrencies(id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'transfer_in', 'transfer_out', 'reward', 'stake', 'unstake')),
    quantity DECIMAL(36, 18) NOT NULL,
    price_per_unit DECIMAL(18, 8),
    fee DECIMAL(18, 8) DEFAULT 0,
    fee_currency_id UUID REFERENCES cryptocurrencies(id),
    total_value DECIMAL(18, 8),
    exchange_transaction_id VARCHAR(255),
    transaction_hash VARCHAR(255),
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Price History (Partitioned by date)
CREATE TABLE price_history (
    id BIGSERIAL,
    cryptocurrency_id UUID NOT NULL REFERENCES cryptocurrencies(id),
    exchange_id UUID REFERENCES exchanges(id),
    price_usd DECIMAL(18, 8) NOT NULL,
    volume_24h DECIMAL(18, 8),
    market_cap DECIMAL(18, 2),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions for price history
CREATE TABLE price_history_2024_01 PARTITION OF price_history
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

**Indexing Strategy:**
```sql
-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_portfolio_holdings_user_id ON portfolio_holdings(user_id);
CREATE INDEX idx_transactions_user_id_executed_at ON transactions(user_id, executed_at DESC);
CREATE INDEX idx_price_history_crypto_timestamp ON price_history(cryptocurrency_id, timestamp DESC);
CREATE INDEX idx_user_exchanges_user_id ON user_exchanges(user_id) WHERE is_active = true;

-- Composite indexes for common queries
CREATE INDEX idx_transactions_user_crypto_type ON transactions(user_id, cryptocurrency_id, transaction_type);
CREATE INDEX idx_holdings_user_exchange ON portfolio_holdings(user_id, exchange_id) WHERE quantity > 0;
```

### MongoDB - Document Store for Flexible Data

**Use Cases:**
- Market data aggregation and caching
- User activity logs and analytics
- Configuration and metadata
- Time-series data for charts

**Collections Design:**

```javascript
// Market Data Collection
{
  _id: ObjectId,
  symbol: "BTC",
  exchange: "binance",
  data: {
    price: 45000.50,
    volume24h: 1234567890,
    change24h: 2.5,
    high24h: 46000,
    low24h: 44000,
    marketCap: 850000000000
  },
  timestamp: ISODate("2024-01-15T10:30:00Z"),
  metadata: {
    source: "exchange_api",
    confidence: 0.99
  }
}

// User Activity Logs
{
  _id: ObjectId,
  userId: "550e8400-e29b-41d4-a716-446655440000",
  action: "portfolio_view",
  metadata: {
    ip: "192.168.1.1",
    userAgent: "Mozilla/5.0...",
    sessionId: "abc123",
    duration: 1500
  },
  timestamp: ISODate("2024-01-15T10:30:00Z")
}

// Analytics Cache
{
  _id: ObjectId,
  userId: "550e8400-e29b-41d4-a716-446655440000",
  type: "portfolio_performance",
  period: "1M",
  data: {
    totalValue: 15000.50,
    totalGainLoss: 2500.25,
    percentageChange: 16.67,
    topPerformers: [
      { symbol: "ETH", gain: 25.5 },
      { symbol: "BTC", gain: 15.2 }
    ]
  },
  calculatedAt: ISODate("2024-01-15T10:00:00Z"),
  expiresAt: ISODate("2024-01-15T11:00:00Z")
}
```

### Redis - Caching and Real-time Data

**Use Cases:**
- Real-time price caching
- Session storage
- Rate limiting counters
- WebSocket connection tracking
- Temporary data storage

**Data Structures:**

```redis
# Real-time prices (Hash)
HSET crypto:prices:BTC:USD price 45000.50 timestamp 1705317000 volume 1234567890

# User sessions (String with TTL)
SET session:abc123 "user_id:550e8400-e29b-41d4-a716-446655440000" EX 3600

# Rate limiting (String with TTL)
SET rate_limit:api:user:123 10 EX 60

# WebSocket connections (Set)
SADD websocket:users:price_updates user:550e8400-e29b-41d4-a716-446655440000

# Cache for expensive calculations (Hash with TTL)
HSET portfolio:calculated:550e8400-e29b-41d4-a716-446655440000 total_value 15000.50 last_updated 1705317000
EXPIRE portfolio:calculated:550e8400-e29b-41d4-a716-446655440000 300
```

## Database Scaling Strategy

### PostgreSQL Scaling

**Read Replicas:**
```yaml
# Primary database for writes
postgresql-primary:
  host: db-primary.crypto-portfolio.com
  port: 5432
  database: crypto_portfolio
  max_connections: 100

# Read replicas for analytics and reporting
postgresql-read-replicas:
  - host: db-read-1.crypto-portfolio.com
    port: 5432
    weight: 50
  - host: db-read-2.crypto-portfolio.com
    port: 5432
    weight: 50
```

**Partitioning Strategy:**
- **Horizontal partitioning** for price_history by timestamp (monthly)
- **Vertical partitioning** for user data (separate sensitive data)
- **Sharding** by user_id for portfolio data at scale

### MongoDB Scaling

**Sharding Configuration:**
```javascript
// Shard key selection
sh.shardCollection("crypto_portfolio.market_data", { "symbol": 1, "timestamp": 1 })
sh.shardCollection("crypto_portfolio.user_activity", { "userId": "hashed" })

// Replica set configuration
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "mongo-1:27017", priority: 1 },
    { _id: 1, host: "mongo-2:27017", priority: 0.5 },
    { _id: 2, host: "mongo-3:27017", priority: 0.5, arbiterOnly: true }
  ]
})
```

### Redis Scaling

**Cluster Configuration:**
```yaml
redis-cluster:
  nodes:
    - redis-1:6379
    - redis-2:6379
    - redis-3:6379
    - redis-4:6379
    - redis-5:6379
    - redis-6:6379
  replicas: 1
  cluster-enabled: yes
```

## Data Consistency Strategy

### Eventual Consistency Pattern
- Use event sourcing for critical portfolio updates
- Implement saga pattern for distributed transactions
- CQRS for read/write separation

### Data Synchronization
```javascript
// Event-driven updates
{
  eventType: "PortfolioUpdated",
  userId: "550e8400-e29b-41d4-a716-446655440000",
  data: {
    holdings: [...],
    totalValue: 15000.50
  },
  timestamp: "2024-01-15T10:30:00Z",
  version: 42
}
```

## Backup and Recovery

### PostgreSQL Backup Strategy
- **Continuous WAL archiving** to S3
- **Daily full backups** with retention policy
- **Point-in-time recovery** capability
- **Cross-region replication** for disaster recovery

### MongoDB Backup Strategy
- **Replica set snapshots** every 6 hours
- **Oplog backup** for point-in-time recovery
- **Sharded cluster backup coordination**

### Redis Backup Strategy
- **RDB snapshots** every hour
- **AOF persistence** for durability
- **Cluster backup coordination**

## Performance Optimization

### Query Optimization
- **Connection pooling** with PgBouncer
- **Query caching** with Redis
- **Materialized views** for complex analytics
- **Database query monitoring** with pg_stat_statements

### Data Archival
- **Cold storage** for historical price data older than 2 years
- **Data compression** for archived transactions
- **Automated archival jobs** based on data age and access patterns