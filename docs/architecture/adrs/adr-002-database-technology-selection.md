# ADR-002: Database Technology Selection

## Status
Accepted

## Context
We need to select appropriate database technologies for our crypto portfolio application. The system requires:
- Real-time market data processing (high write throughput)
- Complex portfolio calculations and analytics
- User transaction history with ACID compliance
- Time-series data for price histories and charts
- Flexible document storage for configurations and logs
- High availability and disaster recovery capabilities

## Decision
We will adopt a **polyglot persistence** approach with multiple database technologies:

1. **PostgreSQL** - Primary transactional database
2. **MongoDB** - Document store for flexible data
3. **Redis** - In-memory cache and session store
4. **InfluxDB/TimescaleDB** - Time-series data (optional enhancement)

## Rationale

### PostgreSQL as Primary Database

**Advantages:**
- **ACID Compliance**: Essential for financial transactions
- **Strong Consistency**: Critical for portfolio calculations
- **Rich Query Language**: Complex joins and analytics
- **JSON Support**: Flexible schema when needed (JSONB)
- **Extensions**: PostGIS for geographical data, full-text search
- **Mature Ecosystem**: Battle-tested in financial applications

**Use Cases:**
- User accounts and authentication
- Portfolio holdings and balances
- Transaction records
- Exchange configurations
- Audit logs

### MongoDB for Document Storage

**Advantages:**
- **Schema Flexibility**: Evolving data structures
- **Horizontal Scaling**: Sharding support
- **Rich Querying**: Aggregation framework
- **High Write Throughput**: Good for market data ingestion
- **Document Model**: Natural fit for JSON APIs

**Use Cases:**
- Market data aggregation
- User activity logs
- Configuration data
- Analytics results cache
- Third-party API responses

### Redis for Caching and Sessions

**Advantages:**
- **Ultra-fast Performance**: Sub-millisecond latency
- **Data Structures**: Lists, sets, sorted sets, hashes
- **Pub/Sub**: Real-time messaging
- **Persistence Options**: RDB snapshots and AOF
- **Clustering**: Horizontal scaling

**Use Cases:**
- Real-time price caching
- Session management
- Rate limiting counters
- WebSocket connection tracking
- Temporary calculations

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Database Layer                           │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ PostgreSQL  │  │  MongoDB    │  │    Redis    │        │
│  │(Transactional│  │ (Documents) │  │  (Cache)    │        │
│  │    Data)    │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Data Distribution Strategy

### PostgreSQL Tables
```sql
-- Core business entities
users, user_profiles, user_exchanges
cryptocurrencies, exchanges
portfolio_holdings, transactions
alerts, notifications
audit_logs
```

### MongoDB Collections
```javascript
// Dynamic and aggregated data
market_data, price_history_aggregated
user_activity_logs, api_request_logs
third_party_responses, configuration_cache
analytics_results, portfolio_snapshots
```

### Redis Data Structures
```redis
# Real-time data
price:{symbol}:USD - Current prices (Hash)
session:{user_id} - User sessions (String)
rate_limit:{user_id} - API rate limits (String)
websocket:users - Active connections (Set)
portfolio:calculated:{user_id} - Cached calculations (Hash)
```

## Consistency Model

### Strong Consistency
- **PostgreSQL**: All financial transactions
- **Critical operations**: Portfolio balance updates

### Eventual Consistency
- **MongoDB**: Market data aggregations, logs
- **Redis**: Cache invalidation, real-time updates

### Compensation Patterns
- **Saga Pattern**: For distributed transactions
- **Event Sourcing**: For audit trails and recovery

## Scaling Strategy

### PostgreSQL Scaling
1. **Vertical Scaling**: Increase instance size first
2. **Read Replicas**: For reporting and analytics
3. **Connection Pooling**: PgBouncer for connection management
4. **Partitioning**: Time-based partitioning for large tables

### MongoDB Scaling
1. **Replica Sets**: 3-node clusters minimum
2. **Sharding**: Horizontal scaling by user_id or symbol
3. **Indexing Strategy**: Compound indexes for common queries

### Redis Scaling
1. **Redis Cluster**: 6-node cluster (3 masters, 3 replicas)
2. **Data Partitioning**: Consistent hashing
3. **Memory Optimization**: Appropriate data structures

## Backup and Recovery

### PostgreSQL
- **Continuous WAL archiving** to S3
- **Daily full backups** with 30-day retention
- **Point-in-time recovery** capability
- **Cross-region replication** for disaster recovery

### MongoDB
- **Replica set snapshots** every 6 hours
- **Oplog backup** for incremental recovery
- **Cross-region replica** in different availability zone

### Redis
- **RDB snapshots** every hour during business hours
- **AOF persistence** for durability
- **Backup to persistent storage** before maintenance

## Security Considerations

### Access Control
- **PostgreSQL**: Role-based access, row-level security
- **MongoDB**: Database and collection-level permissions
- **Redis**: AUTH and ACL for access control

### Encryption
- **At Rest**: All databases encrypted with customer-managed keys
- **In Transit**: TLS 1.3 for all database connections
- **Application Level**: Sensitive data encrypted before storage

### Network Security
- **VPC Isolation**: Databases in private subnets
- **Security Groups**: Restrictive firewall rules
- **VPN Access**: Secure access for administrators

## Operational Considerations

### Monitoring
- **PostgreSQL**: pg_stat_statements, query performance
- **MongoDB**: MongoDB Compass, profiler
- **Redis**: Redis Insight, memory usage monitoring

### Maintenance
- **Automated Updates**: Minor version updates automated
- **Maintenance Windows**: Sunday 2-4 AM for major updates
- **Health Checks**: Continuous monitoring with alerting

## Trade-offs and Limitations

### Complexity
- **Multiple Technologies**: Increased operational overhead
- **Data Consistency**: Eventual consistency challenges
- **Development Complexity**: Multiple drivers and patterns

### Benefits vs. Costs
| Aspect | Benefits | Costs |
|--------|----------|-------|
| **Performance** | Optimized for each use case | Multiple connection pools |
| **Scalability** | Independent scaling | Complex deployment |
| **Flexibility** | Right tool for each job | Learning curve |
| **Reliability** | Fault isolation | Multiple failure points |

## Migration Strategy

### Phase 1: Core Setup (Weeks 1-2)
1. PostgreSQL cluster setup
2. Basic Redis cache implementation
3. Essential tables and indexes

### Phase 2: Document Storage (Weeks 3-4)
1. MongoDB cluster deployment
2. Market data ingestion pipeline
3. Log aggregation setup

### Phase 3: Optimization (Weeks 5-6)
1. Performance tuning
2. Backup and monitoring setup
3. Disaster recovery testing

## Alternatives Considered

### Single Database Approach
- **PostgreSQL Only**: Would limit scalability for market data
- **MongoDB Only**: Lacks ACID guarantees for financial data
- **Rejected**: Doesn't meet all requirements optimally

### NewSQL Databases
- **CockroachDB**: Good for distributed ACID, but less mature
- **TiDB**: Interesting hybrid, but operational complexity
- **Deferred**: Will consider for future scalability needs

### Cloud-Native Solutions
- **AWS RDS/DocumentDB**: Considered for managed services
- **Google Cloud SQL/Firestore**: Alternative cloud option
- **Decision**: Start with self-managed for cost and control

## Success Criteria

### Performance Metrics
- **PostgreSQL**: < 10ms average query time for transactions
- **MongoDB**: < 50ms for market data queries
- **Redis**: < 1ms for cache operations

### Availability Targets
- **PostgreSQL**: 99.9% uptime (< 44 minutes downtime/month)
- **MongoDB**: 99.5% uptime for non-critical data
- **Redis**: 99.95% uptime for caching layer

### Scalability Goals
- **PostgreSQL**: Handle 10,000+ concurrent connections
- **MongoDB**: Process 100,000+ market data updates/second
- **Redis**: Support 1M+ cache operations/second

## Compliance and Audit

### Data Retention
- **Transactional Data**: 7 years retention for regulatory compliance
- **Market Data**: 2 years hot storage, 5 years cold storage
- **Logs**: 1 year retention with archival to S3

### Audit Requirements
- **All financial transactions** logged with immutable audit trail
- **Database access logging** enabled for compliance
- **Change tracking** for all schema modifications

This decision provides a solid foundation for our crypto portfolio application while allowing for future growth and optimization based on actual usage patterns.