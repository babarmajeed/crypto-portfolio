# ADR-005: Messaging and Event Architecture

## Status
Accepted

## Context
Our crypto portfolio application requires a robust messaging and event-driven architecture to handle:
- Real-time market data streaming from multiple exchanges
- Asynchronous processing of portfolio calculations
- Event-driven communication between microservices
- User notifications and real-time updates
- Integration with external APIs and webhooks
- Audit trails and event sourcing for compliance

Requirements:
- Process 100,000+ market data events per second
- Ensure message delivery and ordering guarantees
- Support for event replay and recovery mechanisms
- Horizontal scaling capability
- Low latency for critical price updates
- High availability with no single point of failure

## Decision
We will implement an **event-driven architecture** using **Apache Kafka** as the primary message broker with the following components:

1. **Apache Kafka** for high-throughput event streaming
2. **Event sourcing** for audit trails and state reconstruction
3. **CQRS pattern** for read/write separation
4. **Saga pattern** for distributed transactions
5. **Dead letter queues** for error handling
6. **Schema registry** for event schema evolution

## Rationale

### Apache Kafka Selection

**Why Kafka:**
- **High Throughput**: Millions of messages per second
- **Durability**: Persistent storage with replication
- **Scalability**: Horizontal scaling with partitioning
- **Ordering Guarantees**: Per-partition message ordering
- **Stream Processing**: Built-in stream processing capabilities
- **Ecosystem**: Rich ecosystem with connectors and tools
- **Battle-tested**: Proven in financial and real-time applications

**Kafka vs Alternatives:**

| Feature | Kafka | RabbitMQ | AWS SQS | Redis |
|---------|--------|----------|---------|-------|
| **Throughput** | Very High | Medium | Medium | High |
| **Durability** | High | High | High | Medium |
| **Ordering** | Partition-level | Queue-level | FIFO queues | Limited |
| **Scalability** | Excellent | Good | Excellent | Good |
| **Complexity** | High | Medium | Low | Low |
| **Cost** | Self-hosted | Self-hosted | Pay-per-use | Self-hosted |

**Decision Factors:**
- **Throughput requirements**: Kafka's superior performance for high-volume data
- **Event sourcing**: Native support for event log patterns
- **Stream processing**: Built-in capabilities for real-time analytics
- **Ecosystem maturity**: Extensive tooling and community support

## Architecture Design

### Event-Driven Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Event Producers                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Exchange   │  │ Portfolio   │  │    User     │        │
│  │   APIs      │  │  Service    │  │  Actions    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Apache Kafka                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Market    │  │ Portfolio   │  │    User     │        │
│  │   Events    │  │   Events    │  │   Events    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Event Consumers                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Analytics   │  │Notification │  │   Cache     │        │
│  │  Service    │  │  Service    │  │  Service    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Topic Design Strategy

```yaml
# Topic naming convention: {domain}.{entity}.{action}
topics:
  # Market data domain (high volume)
  market.prices.updated:
    partitions: 24
    replication_factor: 3
    retention_ms: 86400000    # 1 day
    cleanup_policy: compact   # Keep latest price only
    compression_type: snappy

  market.trades.executed:
    partitions: 24
    replication_factor: 3
    retention_ms: 259200000   # 3 days
    compression_type: snappy

  # Portfolio domain (medium volume)
  portfolio.holdings.updated:
    partitions: 12
    replication_factor: 3
    retention_ms: 604800000   # 7 days
    compression_type: snappy

  portfolio.transactions.created:
    partitions: 12
    replication_factor: 3
    retention_ms: 2592000000  # 30 days
    compression_type: snappy

  portfolio.calculations.completed:
    partitions: 6
    replication_factor: 3
    retention_ms: 604800000   # 7 days

  # User domain (low volume)
  user.accounts.created:
    partitions: 6
    replication_factor: 3
    retention_ms: -1          # Infinite retention
    cleanup_policy: compact

  user.sessions.updated:
    partitions: 6
    replication_factor: 3
    retention_ms: 3600000     # 1 hour

  # Notifications domain
  notifications.email.send:
    partitions: 6
    replication_factor: 3
    retention_ms: 86400000    # 1 day

  notifications.push.send:
    partitions: 6
    replication_factor: 3
    retention_ms: 86400000    # 1 day

  # System events
  system.errors.occurred:
    partitions: 3
    replication_factor: 3
    retention_ms: 604800000   # 7 days

  system.audit.logged:
    partitions: 6
    replication_factor: 3
    retention_ms: 31536000000 # 1 year
```

## Event Schema Design

### Base Event Schema (Avro)

```json
{
  "namespace": "com.cryptoportfolio.events",
  "type": "record",
  "name": "BaseEvent",
  "fields": [
    {
      "name": "eventId",
      "type": "string",
      "doc": "Unique event identifier (UUID)"
    },
    {
      "name": "eventType",
      "type": "string",
      "doc": "Type of event (e.g., PriceUpdated, PortfolioCalculated)"
    },
    {
      "name": "eventVersion",
      "type": "string",
      "default": "1.0",
      "doc": "Event schema version for compatibility"
    },
    {
      "name": "timestamp",
      "type": "long",
      "logicalType": "timestamp-millis",
      "doc": "Event occurrence timestamp in milliseconds"
    },
    {
      "name": "aggregateId",
      "type": "string",
      "doc": "ID of the aggregate that generated the event"
    },
    {
      "name": "aggregateType",
      "type": "string",
      "doc": "Type of aggregate (Portfolio, User, Market)"
    },
    {
      "name": "correlationId",
      "type": ["null", "string"],
      "default": null,
      "doc": "Correlation ID for request tracing"
    },
    {
      "name": "causationId",
      "type": ["null", "string"],
      "default": null,
      "doc": "ID of the event that caused this event"
    },
    {
      "name": "metadata",
      "type": {
        "type": "map",
        "values": "string"
      },
      "default": {},
      "doc": "Additional metadata key-value pairs"
    }
  ]
}
```

### Specific Event Schemas

```json
// Market Price Updated Event
{
  "namespace": "com.cryptoportfolio.events.market",
  "type": "record",
  "name": "PriceUpdatedEvent",
  "fields": [
    {"name": "symbol", "type": "string"},
    {"name": "exchange", "type": "string"},
    {"name": "price", "type": {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}},
    {"name": "volume24h", "type": {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}},
    {"name": "change24h", "type": {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}},
    {"name": "marketCap", "type": ["null", {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 2}]},
    {"name": "timestamp", "type": "long", "logicalType": "timestamp-millis"}
  ]
}

// Portfolio Updated Event
{
  "namespace": "com.cryptoportfolio.events.portfolio",
  "type": "record",
  "name": "PortfolioUpdatedEvent",
  "fields": [
    {"name": "userId", "type": "string"},
    {"name": "portfolioId", "type": "string"},
    {"name": "holdings", "type": {
      "type": "array",
      "items": {
        "type": "record",
        "name": "Holding",
        "fields": [
          {"name": "symbol", "type": "string"},
          {"name": "quantity", "type": {"type": "bytes", "logicalType": "decimal", "precision": 36, "scale": 18}},
          {"name": "averageCostBasis", "type": ["null", {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}]},
          {"name": "exchangeId", "type": ["null", "string"]}
        ]
      }
    }},
    {"name": "totalValue", "type": {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}},
    {"name": "previousValue", "type": ["null", {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}]}
  ]
}

// Transaction Created Event
{
  "namespace": "com.cryptoportfolio.events.portfolio",
  "type": "record",
  "name": "TransactionCreatedEvent",
  "fields": [
    {"name": "transactionId", "type": "string"},
    {"name": "userId", "type": "string"},
    {"name": "symbol", "type": "string"},
    {"name": "transactionType", "type": {
      "type": "enum",
      "name": "TransactionType",
      "symbols": ["BUY", "SELL", "TRANSFER_IN", "TRANSFER_OUT", "REWARD", "STAKE", "UNSTAKE"]
    }},
    {"name": "quantity", "type": {"type": "bytes", "logicalType": "decimal", "precision": 36, "scale": 18}},
    {"name": "pricePerUnit", "type": ["null", {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}]},
    {"name": "fee", "type": {"type": "bytes", "logicalType": "decimal", "precision": 18, "scale": 8}},
    {"name": "exchangeId", "type": ["null", "string"]},
    {"name": "executedAt", "type": "long", "logicalType": "timestamp-millis"}
  ]
}
```

## Event Sourcing Implementation

### Event Store Design

```typescript
interface EventStore {
  appendEvents(streamId: string, events: DomainEvent[], expectedVersion?: number): Promise<void>;
  getEvents(streamId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getSnapshot(streamId: string): Promise<Snapshot | null>;
  saveSnapshot(streamId: string, snapshot: Snapshot): Promise<void>;
}

class KafkaEventStore implements EventStore {
  private producer: Producer;
  private consumer: Consumer;

  async appendEvents(
    streamId: string,
    events: DomainEvent[],
    expectedVersion?: number
  ): Promise<void> {
    // Optimistic concurrency control
    if (expectedVersion !== undefined) {
      const currentVersion = await this.getStreamVersion(streamId);
      if (currentVersion !== expectedVersion) {
        throw new ConcurrencyError(`Expected version ${expectedVersion}, but was ${currentVersion}`);
      }
    }

    const records = events.map((event, index) => ({
      topic: this.getTopicForEvent(event.eventType),
      key: streamId,
      value: JSON.stringify({
        ...event,
        streamId,
        version: (expectedVersion || 0) + index + 1
      }),
      headers: {
        'event-type': event.eventType,
        'event-version': event.eventVersion,
        'stream-id': streamId
      }
    }));

    await this.producer.sendBatch({
      topicMessages: [{
        topic: records[0].topic,
        messages: records
      }]
    });
  }

  async getEvents(streamId: string, fromVersion = 0): Promise<DomainEvent[]> {
    // In practice, this would read from a dedicated event store
    // or from Kafka using a specific consumer group
    const events: DomainEvent[] = [];
    
    // Read from all relevant topics
    const topics = this.getAllEventTopics();
    
    for (const topic of topics) {
      const topicEvents = await this.readEventsFromTopic(topic, streamId, fromVersion);
      events.push(...topicEvents);
    }

    return events.sort((a, b) => a.version - b.version);
  }
}
```

### Aggregate Pattern

```typescript
abstract class AggregateRoot {
  protected id: string;
  protected version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  protected addEvent(event: DomainEvent): void {
    event.aggregateId = this.id;
    event.aggregateType = this.constructor.name;
    event.version = this.version + this.uncommittedEvents.length + 1;
    
    this.uncommittedEvents.push(event);
    this.apply(event);
  }

  protected abstract apply(event: DomainEvent): void;

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.version += this.uncommittedEvents.length;
    this.uncommittedEvents = [];
  }

  static fromHistory<T extends AggregateRoot>(
    constructor: new (id: string) => T,
    events: DomainEvent[]
  ): T {
    const aggregate = new constructor(events[0]?.aggregateId);
    
    for (const event of events) {
      aggregate.apply(event);
      aggregate.version = event.version;
    }
    
    return aggregate;
  }
}

class Portfolio extends AggregateRoot {
  private holdings: Map<string, Holding> = new Map();
  private totalValue: number = 0;

  addTransaction(transaction: Transaction): void {
    const event = new TransactionCreatedEvent({
      transactionId: transaction.id,
      userId: transaction.userId,
      symbol: transaction.symbol,
      transactionType: transaction.type,
      quantity: transaction.quantity,
      pricePerUnit: transaction.pricePerUnit,
      fee: transaction.fee,
      exchangeId: transaction.exchangeId,
      executedAt: transaction.executedAt
    });

    this.addEvent(event);
  }

  protected apply(event: DomainEvent): void {
    switch (event.eventType) {
      case 'TransactionCreated':
        this.applyTransactionCreated(event as TransactionCreatedEvent);
        break;
      case 'PortfolioUpdated':
        this.applyPortfolioUpdated(event as PortfolioUpdatedEvent);
        break;
    }
  }

  private applyTransactionCreated(event: TransactionCreatedEvent): void {
    const holding = this.holdings.get(event.symbol) || new Holding(event.symbol);
    
    switch (event.transactionType) {
      case 'BUY':
        holding.addQuantity(event.quantity, event.pricePerUnit);
        break;
      case 'SELL':
        holding.reduceQuantity(event.quantity);
        break;
    }
    
    this.holdings.set(event.symbol, holding);
  }
}
```

## CQRS Implementation

### Command Side

```typescript
interface Command {
  commandId: string;
  aggregateId: string;
  userId: string;
  timestamp: number;
}

class CreateTransactionCommand implements Command {
  commandId: string;
  aggregateId: string; // portfolioId
  userId: string;
  timestamp: number;
  
  constructor(
    public readonly transactionData: {
      symbol: string;
      type: TransactionType;
      quantity: number;
      pricePerUnit?: number;
      fee: number;
      exchangeId?: string;
    }
  ) {
    this.commandId = generateUUID();
    this.timestamp = Date.now();
  }
}

class PortfolioCommandHandler {
  constructor(
    private eventStore: EventStore,
    private eventBus: EventBus
  ) {}

  async handle(command: CreateTransactionCommand): Promise<void> {
    // Load aggregate from event store
    const events = await this.eventStore.getEvents(command.aggregateId);
    const portfolio = Portfolio.fromHistory(Portfolio, events);

    // Execute business logic
    const transaction = new Transaction(command.transactionData);
    portfolio.addTransaction(transaction);

    // Save events
    const uncommittedEvents = portfolio.getUncommittedEvents();
    await this.eventStore.appendEvents(
      command.aggregateId,
      uncommittedEvents,
      portfolio.version - uncommittedEvents.length
    );

    // Publish events
    for (const event of uncommittedEvents) {
      await this.eventBus.publish(event);
    }

    portfolio.markEventsAsCommitted();
  }
}
```

### Query Side (Read Models)

```typescript
class PortfolioReadModel {
  constructor(
    private database: Database,
    private cache: CacheService
  ) {}

  async updateFromEvent(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case 'TransactionCreated':
        await this.handleTransactionCreated(event as TransactionCreatedEvent);
        break;
      case 'PortfolioUpdated':
        await this.handlePortfolioUpdated(event as PortfolioUpdatedEvent);
        break;
    }
  }

  private async handleTransactionCreated(event: TransactionCreatedEvent): Promise<void> {
    // Update transaction read model
    await this.database.transactions.insert({
      id: event.transactionId,
      userId: event.userId,
      symbol: event.symbol,
      type: event.transactionType,
      quantity: event.quantity,
      pricePerUnit: event.pricePerUnit,
      fee: event.fee,
      exchangeId: event.exchangeId,
      executedAt: new Date(event.executedAt),
      createdAt: new Date(event.timestamp)
    });

    // Update portfolio holdings read model
    await this.updatePortfolioHoldings(event.userId, event.symbol);

    // Invalidate cache
    await this.cache.invalidate(`portfolio:${event.userId}`);
  }

  async getPortfolioSummary(userId: string): Promise<PortfolioSummary> {
    // Check cache first
    const cached = await this.cache.get(`portfolio:summary:${userId}`);
    if (cached) {
      return cached;
    }

    // Query read model
    const summary = await this.database.query(`
      SELECT 
        user_id,
        SUM(quantity * current_price) as total_value,
        SUM(quantity * (current_price - average_cost_basis)) as total_gain_loss
      FROM portfolio_holdings_view 
      WHERE user_id = ? AND quantity > 0
      GROUP BY user_id
    `, [userId]);

    // Cache result
    await this.cache.set(`portfolio:summary:${userId}`, summary, 300);

    return summary;
  }
}
```

## Error Handling and Resilience

### Dead Letter Queue Implementation

```typescript
class DeadLetterQueueHandler {
  private dlqProducer: Producer;

  async handleFailedMessage(
    originalTopic: string,
    message: any,
    error: Error,
    retryCount: number
  ): Promise<void> {
    const dlqMessage = {
      originalTopic,
      originalPartition: message.partition,
      originalOffset: message.offset,
      originalKey: message.key,
      originalValue: message.value,
      originalHeaders: message.headers,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      },
      retryCount,
      firstFailureTime: message.headers?.['first-failure-time'] || Date.now(),
      lastFailureTime: Date.now()
    };

    await this.dlqProducer.send({
      topic: `${originalTopic}.dlq`,
      key: message.key,
      value: JSON.stringify(dlqMessage),
      headers: {
        'original-topic': originalTopic,
        'error-type': error.name,
        'retry-count': retryCount.toString(),
        'dlq-timestamp': Date.now().toString()
      }
    });
  }

  async reprocessDLQMessage(dlqMessage: any): Promise<void> {
    try {
      // Attempt to reprocess the original message
      await this.processMessage(dlqMessage.originalValue);
      
      // If successful, remove from DLQ
      await this.markDLQMessageProcessed(dlqMessage);
    } catch (error) {
      // If still failing, determine if we should retry or give up
      if (dlqMessage.retryCount < 5) {
        await this.scheduleRetry(dlqMessage, error);
      } else {
        await this.sendToManualReview(dlqMessage, error);
      }
    }
  }
}
```

### Circuit Breaker for External Dependencies

```typescript
class EventProcessorCircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 30000; // 30 seconds

  async processWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        if (fallback) {
          return fallback();
        }
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        return fallback();
      }
      
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

## Monitoring and Observability

### Event Processing Metrics

```typescript
class EventMetricsCollector {
  private prometheus: any;

  constructor() {
    this.setupMetrics();
  }

  private setupMetrics(): void {
    this.eventProcessingDuration = new this.prometheus.Histogram({
      name: 'event_processing_duration_seconds',
      help: 'Duration of event processing',
      labelNames: ['event_type', 'consumer_group', 'topic']
    });

    this.eventProcessingTotal = new this.prometheus.Counter({
      name: 'events_processed_total',
      help: 'Total number of events processed',
      labelNames: ['event_type', 'consumer_group', 'status']
    });

    this.kafkaConsumerLag = new this.prometheus.Gauge({
      name: 'kafka_consumer_lag',
      help: 'Consumer lag by topic and partition',
      labelNames: ['topic', 'partition', 'consumer_group']
    });
  }

  recordEventProcessed(
    eventType: string,
    consumerGroup: string,
    topic: string,
    duration: number,
    success: boolean
  ): void {
    this.eventProcessingDuration
      .labels(eventType, consumerGroup, topic)
      .observe(duration);

    this.eventProcessingTotal
      .labels(eventType, consumerGroup, success ? 'success' : 'failure')
      .inc();
  }

  recordConsumerLag(topic: string, partition: number, consumerGroup: string, lag: number): void {
    this.kafkaConsumerLag
      .labels(topic, partition.toString(), consumerGroup)
      .set(lag);
  }
}
```

### Event Tracing

```typescript
class EventTracer {
  async traceEvent(event: DomainEvent, context: TraceContext): Promise<void> {
    const span = this.tracer.startSpan(`event.${event.eventType}`, {
      parent: context.span,
      kind: 'event',
      attributes: {
        'event.id': event.eventId,
        'event.type': event.eventType,
        'event.version': event.eventVersion,
        'aggregate.id': event.aggregateId,
        'aggregate.type': event.aggregateType,
        'correlation.id': event.correlationId,
        'causation.id': event.causationId
      }
    });

    try {
      await this.processEvent(event);
      span.setStatus({ code: 'OK' });
    } catch (error) {
      span.setStatus({ code: 'ERROR', message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }
}
```

## Performance Optimization

### Batch Processing

```typescript
class BatchEventProcessor {
  private batchSize = 100;
  private batchTimeout = 1000; // 1 second
  private pendingEvents: DomainEvent[] = [];
  private lastBatchTime = Date.now();

  async processEvent(event: DomainEvent): Promise<void> {
    this.pendingEvents.push(event);

    if (this.shouldProcessBatch()) {
      await this.processBatch();
    }
  }

  private shouldProcessBatch(): boolean {
    return (
      this.pendingEvents.length >= this.batchSize ||
      Date.now() - this.lastBatchTime >= this.batchTimeout
    );
  }

  private async processBatch(): Promise<void> {
    if (this.pendingEvents.length === 0) {
      return;
    }

    const batch = [...this.pendingEvents];
    this.pendingEvents = [];
    this.lastBatchTime = Date.now();

    try {
      await this.processEventBatch(batch);
    } catch (error) {
      // Handle batch failure - could retry individual events
      await this.handleBatchFailure(batch, error);
    }
  }

  private async processEventBatch(events: DomainEvent[]): Promise<void> {
    // Group events by type for optimal processing
    const eventsByType = this.groupEventsByType(events);

    // Process each type in parallel
    await Promise.all(
      Object.entries(eventsByType).map(([type, typeEvents]) =>
        this.processEventsByType(type, typeEvents)
      )
    );
  }
}
```

## Success Metrics

### Performance Targets
- **Event throughput**: 100,000+ events/second
- **End-to-end latency**: < 100ms for critical events
- **Consumer lag**: < 1000 messages per partition
- **Event processing success rate**: > 99.9%

### Reliability Targets
- **Message durability**: No message loss with min_insync_replicas=2
- **Availability**: 99.9% Kafka cluster uptime
- **Recovery time**: < 5 minutes for consumer failures

### Monitoring Alerts
- Consumer lag > 5000 messages
- Event processing failure rate > 1%
- Kafka cluster node failures
- DLQ message accumulation

This messaging and event architecture provides a robust foundation for building a scalable, resilient, and observable crypto portfolio application that can handle high-volume real-time data processing while maintaining data consistency and reliability.