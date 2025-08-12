# CP-004: Database Design and Data Storage

## 📋 Issue Type
**Epic** - Infrastructure

## 🎯 Objective
Design and implement a robust, scalable database architecture for storing multi-exchange portfolio data, user information, and financial analytics with high performance and data integrity.

## 📝 Description
Create a comprehensive database design that efficiently handles cryptocurrency portfolio data from multiple exchanges, real-time price updates, historical data, and user-generated content while maintaining ACID compliance and optimal query performance.

## ✅ Acceptance Criteria

### Core Database Schema
- [ ] User and authentication tables
- [ ] Exchange and API credentials management
- [ ] Portfolio and holdings structure
- [ ] Transaction history and trade records
- [ ] Price data and market information
- [ ] Analytics and performance metrics
- [ ] Audit logs and system events

### Performance Optimization
- [ ] Database indexing strategy
- [ ] Query optimization and execution plans
- [ ] Partitioning for historical data
- [ ] Read replicas for analytics
- [ ] Connection pooling configuration
- [ ] Caching layer with Redis
- [ ] Database monitoring and alerts

### Data Integrity and Security
- [ ] Foreign key constraints and relationships
- [ ] Data validation and check constraints
- [ ] Encryption for sensitive data
- [ ] Backup and recovery procedures
- [ ] Point-in-time recovery capability
- [ ] Data retention policies
- [ ] GDPR compliance measures

## 🛠️ Database Architecture

### PostgreSQL Schema Design
```sql
-- ===============================
-- USERS AND AUTHENTICATION
-- ===============================

CREATE TYPE user_role AS ENUM ('admin', 'premium', 'basic');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  totp_secret VARCHAR(32),
  backup_codes TEXT[],
  role user_role DEFAULT 'basic',
  status user_status DEFAULT 'active',
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  last_login TIMESTAMP,
  last_activity TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===============================
-- EXCHANGES AND API MANAGEMENT
-- ===============================

CREATE TYPE exchange_status AS ENUM ('active', 'inactive', 'error', 'rate_limited');

CREATE TABLE exchanges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  website_url VARCHAR(255),
  api_base_url VARCHAR(255) NOT NULL,
  websocket_url VARCHAR(255),
  rate_limit_per_minute INTEGER DEFAULT 1200,
  requires_kyc BOOLEAN DEFAULT FALSE,
  supported_countries TEXT[],
  trading_fees JSONB,
  status exchange_status DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_exchange_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exchange_id UUID REFERENCES exchanges(id),
  api_key_encrypted TEXT NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  passphrase_encrypted TEXT,
  sandbox_mode BOOLEAN DEFAULT FALSE,
  permissions TEXT[] DEFAULT ARRAY['read'],
  last_sync TIMESTAMP,
  sync_status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, exchange_id)
);

-- ===============================
-- CRYPTOCURRENCIES AND MARKETS
-- ===============================

CREATE TABLE cryptocurrencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  coingecko_id VARCHAR(100),
  coinmarketcap_id INTEGER,
  description TEXT,
  logo_url VARCHAR(500),
  website_url VARCHAR(255),
  whitepaper_url VARCHAR(255),
  max_supply DECIMAL(30, 8),
  circulating_supply DECIMAL(30, 8),
  market_cap_rank INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trading_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_id UUID REFERENCES exchanges(id),
  base_currency_id UUID REFERENCES cryptocurrencies(id),
  quote_currency_id UUID REFERENCES cryptocurrencies(id),
  symbol VARCHAR(50) NOT NULL,
  min_order_size DECIMAL(30, 8),
  max_order_size DECIMAL(30, 8),
  price_precision INTEGER DEFAULT 8,
  quantity_precision INTEGER DEFAULT 8,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(exchange_id, symbol)
);

-- ===============================
-- PRICE DATA AND MARKET DATA
-- ===============================

-- Partitioned table for price data
CREATE TABLE price_data (
  id BIGSERIAL,
  trading_pair_id UUID REFERENCES trading_pairs(id),
  price DECIMAL(30, 8) NOT NULL,
  volume_24h DECIMAL(30, 8),
  market_cap DECIMAL(30, 8),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  source VARCHAR(50) NOT NULL
) PARTITION BY RANGE (timestamp);

-- Create monthly partitions (example for 2024)
CREATE TABLE price_data_2024_01 PARTITION OF price_data
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... continue for each month

CREATE INDEX idx_price_data_timestamp ON price_data (timestamp);
CREATE INDEX idx_price_data_pair_timestamp ON price_data (trading_pair_id, timestamp);

-- Real-time price updates
CREATE TABLE current_prices (
  trading_pair_id UUID PRIMARY KEY REFERENCES trading_pairs(id),
  price DECIMAL(30, 8) NOT NULL,
  change_24h DECIMAL(10, 4),
  volume_24h DECIMAL(30, 8),
  last_updated TIMESTAMP DEFAULT NOW(),
  INDEX (last_updated)
);

-- ===============================
-- PORTFOLIO AND HOLDINGS
-- ===============================

CREATE TYPE portfolio_type AS ENUM ('main', 'trading', 'savings', 'defi');

CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  type portfolio_type DEFAULT 'main',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  cryptocurrency_id UUID REFERENCES cryptocurrencies(id),
  exchange_id UUID REFERENCES exchanges(id),
  quantity DECIMAL(30, 8) NOT NULL DEFAULT 0,
  average_cost DECIMAL(30, 8),
  total_cost DECIMAL(30, 8),
  last_sync TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(portfolio_id, cryptocurrency_id, exchange_id)
);

-- ===============================
-- TRANSACTION HISTORY
-- ===============================

CREATE TYPE transaction_type AS ENUM (
  'buy', 'sell', 'deposit', 'withdrawal', 
  'transfer', 'staking_reward', 'airdrop', 
  'fork', 'mining', 'fee', 'dividend'
);

CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES portfolios(id),
  exchange_id UUID REFERENCES exchanges(id),
  exchange_transaction_id VARCHAR(255),
  type transaction_type NOT NULL,
  status transaction_status DEFAULT 'completed',
  cryptocurrency_id UUID REFERENCES cryptocurrencies(id),
  quantity DECIMAL(30, 8) NOT NULL,
  price DECIMAL(30, 8),
  fee DECIMAL(30, 8) DEFAULT 0,
  fee_currency_id UUID REFERENCES cryptocurrencies(id),
  total_value DECIMAL(30, 8),
  notes TEXT,
  transaction_hash VARCHAR(255),
  block_number BIGINT,
  executed_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
) PARTITION BY RANGE (executed_at);

-- Create quarterly partitions for transactions
CREATE TABLE transactions_2024_q1 PARTITION OF transactions
FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');

CREATE INDEX idx_transactions_user_executed ON transactions (user_id, executed_at);
CREATE INDEX idx_transactions_portfolio ON transactions (portfolio_id);
CREATE INDEX idx_transactions_crypto ON transactions (cryptocurrency_id);

-- ===============================
-- ANALYTICS AND PERFORMANCE
-- ===============================

CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  total_value DECIMAL(30, 8) NOT NULL,
  total_cost DECIMAL(30, 8),
  unrealized_pnl DECIMAL(30, 8),
  realized_pnl DECIMAL(30, 8),
  roi_percentage DECIMAL(10, 4),
  snapshot_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(portfolio_id, snapshot_date)
);

CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL, -- '1d', '7d', '30d', '1y', 'all'
  return_percentage DECIMAL(10, 4),
  volatility DECIMAL(10, 4),
  sharpe_ratio DECIMAL(10, 4),
  max_drawdown DECIMAL(10, 4),
  alpha DECIMAL(10, 4),
  beta DECIMAL(10, 4),
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(portfolio_id, period)
);
```

### Redis Caching Strategy
```javascript
// Cache structure for real-time data
const cacheKeys = {
  currentPrices: 'prices:current',
  portfolioValue: 'portfolio:value:{userId}',
  userSession: 'session:{sessionId}',
  exchangeRateLimit: 'ratelimit:{exchangeId}:{userId}',
  marketData: 'market:data:{symbol}',
  portfolioSnapshot: 'portfolio:snapshot:{portfolioId}'
};

// TTL configurations
const cacheTTL = {
  prices: 30, // 30 seconds
  portfolioValue: 300, // 5 minutes
  marketData: 60, // 1 minute
  session: 86400, // 24 hours
  rateLimit: 60 // 1 minute
};
```

## 🔧 Performance Optimization

### Indexing Strategy
```sql
-- High-performance indexes
CREATE INDEX idx_users_email_hash ON users USING hash(email);
CREATE INDEX idx_holdings_portfolio_crypto ON holdings (portfolio_id, cryptocurrency_id);
CREATE INDEX idx_transactions_user_date ON transactions (user_id, executed_at DESC);
CREATE INDEX idx_price_data_symbol_time ON price_data (trading_pair_id, timestamp DESC);

-- Partial indexes for active records
CREATE INDEX idx_users_active ON users (id) WHERE status = 'active';
CREATE INDEX idx_holdings_active ON holdings (portfolio_id) WHERE quantity > 0;

-- Composite indexes for common queries
CREATE INDEX idx_transactions_portfolio_type_date ON transactions (portfolio_id, type, executed_at);
CREATE INDEX idx_price_data_recent ON price_data (trading_pair_id, timestamp) 
WHERE timestamp > NOW() - INTERVAL '7 days';
```

### Database Configuration
```sql
-- PostgreSQL optimization settings
-- postgresql.conf adjustments
shared_buffers = '256MB'
effective_cache_size = '1GB'
maintenance_work_mem = '64MB'
checkpoint_completion_target = 0.9
wal_buffers = '16MB'
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

## 🧪 Testing and Validation

### Data Integrity Tests
- [ ] Foreign key constraint validation
- [ ] Check constraint validation
- [ ] Data type validation
- [ ] Null constraint testing
- [ ] Unique constraint testing

### Performance Tests
- [ ] Query execution time benchmarks
- [ ] Concurrent user load testing
- [ ] Large dataset query performance
- [ ] Index effectiveness testing
- [ ] Cache hit ratio validation

### Backup and Recovery Tests
- [ ] Full database backup procedures
- [ ] Point-in-time recovery testing
- [ ] Cross-region backup replication
- [ ] Disaster recovery simulation
- [ ] Data corruption recovery

## 🔗 Dependencies
- **Depends on**: CP-001 (Project Setup), CP-002 (Authentication)
- **Blocks**: CP-005 (API Key Management), CP-016 (Exchange Integration)

## 🎯 Definition of Done
- [ ] All database tables created with proper constraints
- [ ] Indexes optimized for query performance
- [ ] Redis caching layer configured
- [ ] Backup and recovery procedures tested
- [ ] Performance benchmarks met
- [ ] Security measures implemented
- [ ] Migration scripts created
- [ ] Documentation complete

## 📚 Resources
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Database Design Best Practices](https://www.vertabelo.com/blog/database-design-best-practices/)
- [Redis Caching Strategies](https://redis.io/docs/manual/patterns/)

## 🏷️ Labels
`database`, `postgresql`, `redis`, `performance`, `infrastructure`, `critical`

## ⏱️ Estimated Time
**24-32 hours** for experienced database developer

## 👥 Assignee
Requires developer with:
- Advanced PostgreSQL knowledge
- Database design experience
- Performance optimization skills
- Security and backup expertise

---
*The database is the foundation of data integrity. Design it well, and everything else becomes easier.*