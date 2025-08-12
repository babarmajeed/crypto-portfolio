# Message Queue Architecture - Apache Kafka Implementation

## Overview
Event-driven architecture using Apache Kafka for async processing, real-time data streaming, and service decoupling.

## Kafka Cluster Architecture

### Cluster Configuration

```yaml
# Production Kafka Cluster
kafka:
  cluster:
    brokers: 3
    replication_factor: 3
    min_insync_replicas: 2
    partition_count: 12
    
  # Broker configuration
  broker:
    num_network_threads: 8
    num_io_threads: 16
    socket_send_buffer_bytes: 102400
    socket_receive_buffer_bytes: 102400
    socket_request_max_bytes: 104857600
    
  # Log configuration
  log:
    retention_hours: 168  # 7 days
    retention_bytes: 107374182400  # 100GB
    segment_bytes: 1073741824  # 1GB
    cleanup_policy: delete
    
  # Compression
  compression_type: snappy
  
  # Zookeeper
  zookeeper:
    connect: zk1:2181,zk2:2181,zk3:2181
    session_timeout_ms: 18000
    connection_timeout_ms: 18000
```

### Topic Design Strategy

```yaml
# Topic naming convention: {domain}.{entity}.{action}
topics:
  # Portfolio domain
  portfolio.holdings.updated:
    partitions: 12
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 604800000  # 7 days
    
  portfolio.transactions.created:
    partitions: 12
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 2592000000  # 30 days
    
  # Market data domain
  market.prices.updated:
    partitions: 24
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 86400000   # 1 day
    cleanup_policy: compact  # Keep latest price only
    
  market.trades.executed:
    partitions: 24
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 259200000  # 3 days
    
  # User domain
  user.accounts.created:
    partitions: 6
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: -1  # Infinite retention
    
  user.sessions.updated:
    partitions: 6
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 3600000    # 1 hour
    
  # Notifications domain
  notifications.email.send:
    partitions: 6
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 86400000   # 1 day
    
  notifications.push.send:
    partitions: 6
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 86400000   # 1 day
    
  # Analytics domain
  analytics.events.tracked:
    partitions: 12
    replication_factor: 3
    min_insync_replicas: 2
    retention_ms: 2592000000 # 30 days
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
      "doc": "Type of event (e.g., PortfolioUpdated)"
    },
    {
      "name": "eventVersion",
      "type": "string",
      "default": "1.0",
      "doc": "Event schema version"
    },
    {
      "name": "timestamp",
      "type": "long",
      "logicalType": "timestamp-millis",
      "doc": "Event occurrence timestamp"
    },
    {
      "name": "aggregateId",
      "type": "string",
      "doc": "ID of the aggregate that generated the event"
    },
    {
      "name": "aggregateType",
      "type": "string",
      "doc": "Type of aggregate (e.g., Portfolio, User)"
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
      "doc": "Additional metadata"
    }
  ]
}
```

### Portfolio Events Schema

```json
{
  "namespace": "com.cryptoportfolio.events.portfolio",
  "type": "record",
  "name": "PortfolioUpdatedEvent",
  "fields": [
    {
      "name": "userId",
      "type": "string",
      "doc": "User ID who owns the portfolio"
    },
    {
      "name": "portfolioId",
      "type": "string",
      "doc": "Portfolio identifier"
    },
    {
      "name": "holdings",
      "type": {
        "type": "array",
        "items": {
          "type": "record",
          "name": "Holding",
          "fields": [
            {"name": "symbol", "type": "string"},
            {"name": "quantity", "type": "string"},
            {"name": "averageCostBasis", "type": ["null", "string"], "default": null},
            {"name": "exchangeId", "type": ["null", "string"], "default": null}
          ]
        }
      }
    },
    {
      "name": "totalValue",
      "type": "string",
      "doc": "Total portfolio value in USD"
    },
    {
      "name": "previousValue",
      "type": ["null", "string"],
      "default": null,
      "doc": "Previous portfolio value for comparison"
    }
  ]
}

{
  "namespace": "com.cryptoportfolio.events.portfolio",
  "type": "record",
  "name": "TransactionCreatedEvent",
  "fields": [
    {
      "name": "transactionId",
      "type": "string",
      "doc": "Transaction identifier"
    },
    {
      "name": "userId",
      "type": "string",
      "doc": "User ID"
    },
    {
      "name": "symbol",
      "type": "string",
      "doc": "Cryptocurrency symbol"
    },
    {
      "name": "transactionType",
      "type": {
        "type": "enum",
        "name": "TransactionType",
        "symbols": ["BUY", "SELL", "TRANSFER_IN", "TRANSFER_OUT", "REWARD", "STAKE", "UNSTAKE"]
      }
    },
    {
      "name": "quantity",
      "type": "string",
      "doc": "Transaction quantity"
    },
    {
      "name": "pricePerUnit",
      "type": ["null", "string"],
      "default": null,
      "doc": "Price per unit in USD"
    },
    {
      "name": "fee",
      "type": "string",
      "default": "0",
      "doc": "Transaction fee"
    },
    {
      "name": "exchangeId",
      "type": ["null", "string"],
      "default": null,
      "doc": "Exchange where transaction occurred"
    },
    {
      "name": "executedAt",
      "type": "long",
      "logicalType": "timestamp-millis",
      "doc": "Transaction execution timestamp"
    }
  ]
}
```

### Market Data Events Schema

```json
{
  "namespace": "com.cryptoportfolio.events.market",
  "type": "record",
  "name": "PriceUpdatedEvent",
  "fields": [
    {
      "name": "symbol",
      "type": "string",
      "doc": "Cryptocurrency symbol"
    },
    {
      "name": "exchange",
      "type": "string",
      "doc": "Exchange name"
    },
    {
      "name": "price",
      "type": "string",
      "doc": "Current price in USD"
    },
    {
      "name": "volume24h",
      "type": "string",
      "doc": "24-hour trading volume"
    },
    {
      "name": "change24h",
      "type": "string",
      "doc": "24-hour price change percentage"
    },
    {
      "name": "marketCap",
      "type": ["null", "string"],
      "default": null,
      "doc": "Market capitalization"
    },
    {
      "name": "timestamp",
      "type": "long",
      "logicalType": "timestamp-millis",
      "doc": "Price update timestamp"
    }
  ]
}
```

## Producer Implementation

### Portfolio Service Producer

```typescript
import { Kafka, Producer, ProducerRecord } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';

interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  [key: string]: any;
}

class PortfolioEventProducer {
  private producer: Producer;

  constructor(private kafka: Kafka) {
    this.producer = this.kafka.producer({
      groupId: 'portfolio-service-producer',
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
    });
  }

  async publishPortfolioUpdated(
    userId: string,
    portfolioData: any,
    metadata: EventMetadata = {}
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: 'PortfolioUpdated',
      eventVersion: '1.0',
      timestamp: Date.now(),
      aggregateId: userId,
      aggregateType: 'Portfolio',
      correlationId: metadata.correlationId,
      causationId: metadata.causationId,
      metadata: {
        ...metadata,
        source: 'portfolio-service'
      },
      data: {
        userId,
        portfolioId: portfolioData.id,
        holdings: portfolioData.holdings,
        totalValue: portfolioData.totalValue.toString(),
        previousValue: portfolioData.previousValue?.toString()
      }
    };

    const record: ProducerRecord = {
      topic: 'portfolio.holdings.updated',
      key: userId,
      value: JSON.stringify(event),
      partition: this.getPartition(userId),
      headers: {
        'event-type': event.eventType,
        'event-version': event.eventVersion,
        'correlation-id': metadata.correlationId || '',
        'content-type': 'application/json'
      }
    };

    await this.producer.send(record);
  }

  async publishTransactionCreated(
    transactionData: any,
    metadata: EventMetadata = {}
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: 'TransactionCreated',
      eventVersion: '1.0',
      timestamp: Date.now(),
      aggregateId: transactionData.id,
      aggregateType: 'Transaction',
      correlationId: metadata.correlationId,
      causationId: metadata.causationId,
      metadata: {
        ...metadata,
        source: 'portfolio-service'
      },
      data: {
        transactionId: transactionData.id,
        userId: transactionData.userId,
        symbol: transactionData.symbol,
        transactionType: transactionData.type,
        quantity: transactionData.quantity.toString(),
        pricePerUnit: transactionData.pricePerUnit?.toString(),
        fee: transactionData.fee.toString(),
        exchangeId: transactionData.exchangeId,
        executedAt: transactionData.executedAt.getTime()
      }
    };

    const record: ProducerRecord = {
      topic: 'portfolio.transactions.created',
      key: transactionData.userId,
      value: JSON.stringify(event),
      partition: this.getPartition(transactionData.userId),
      headers: {
        'event-type': event.eventType,
        'event-version': event.eventVersion,
        'correlation-id': metadata.correlationId || '',
        'content-type': 'application/json'
      }
    };

    await this.producer.send(record);
  }

  private getPartition(key: string): number {
    // Simple hash-based partitioning
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash) % 12; // 12 partitions
  }
}
```

### Market Data Producer

```typescript
class MarketDataProducer {
  private producer: Producer;

  constructor(private kafka: Kafka) {
    this.producer = this.kafka.producer({
      groupId: 'market-data-producer',
      allowAutoTopicCreation: false,
      transactionTimeout: 30000,
      compression: 'snappy',
      batchSize: 16384,
      lingerMs: 10
    });
  }

  async publishPriceUpdate(
    symbol: string,
    exchange: string,
    priceData: any
  ): Promise<void> {
    const event = {
      eventId: uuidv4(),
      eventType: 'PriceUpdated',
      eventVersion: '1.0',
      timestamp: Date.now(),
      aggregateId: `${symbol}:${exchange}`,
      aggregateType: 'MarketData',
      data: {
        symbol,
        exchange,
        price: priceData.price.toString(),
        volume24h: priceData.volume24h.toString(),
        change24h: priceData.change24h.toString(),
        marketCap: priceData.marketCap?.toString(),
        timestamp: priceData.timestamp
      }
    };

    const record: ProducerRecord = {
      topic: 'market.prices.updated',
      key: symbol,
      value: JSON.stringify(event),
      headers: {
        'event-type': event.eventType,
        'exchange': exchange,
        'symbol': symbol,
        'content-type': 'application/json'
      }
    };

    await this.producer.send(record);
  }

  async publishBatchPriceUpdates(priceUpdates: any[]): Promise<void> {
    const records = priceUpdates.map(update => ({
      topic: 'market.prices.updated',
      key: update.symbol,
      value: JSON.stringify({
        eventId: uuidv4(),
        eventType: 'PriceUpdated',
        eventVersion: '1.0',
        timestamp: Date.now(),
        aggregateId: `${update.symbol}:${update.exchange}`,
        aggregateType: 'MarketData',
        data: update
      }),
      headers: {
        'event-type': 'PriceUpdated',
        'exchange': update.exchange,
        'symbol': update.symbol,
        'content-type': 'application/json'
      }
    }));

    await this.producer.sendBatch({
      topicMessages: [{
        topic: 'market.prices.updated',
        messages: records
      }]
    });
  }
}
```

## Consumer Implementation

### Portfolio Analytics Consumer

```typescript
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

class PortfolioAnalyticsConsumer {
  private consumer: Consumer;

  constructor(private kafka: Kafka) {
    this.consumer = this.kafka.consumer({
      groupId: 'portfolio-analytics-service',
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576, // 1MB
      minBytes: 1,
      maxBytes: 10485760, // 10MB
      maxWaitTimeInMs: 5000
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    
    await this.consumer.subscribe({
      topics: [
        'portfolio.holdings.updated',
        'portfolio.transactions.created',
        'market.prices.updated'
      ],
      fromBeginning: false
    });

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        try {
          await this.processMessage(payload);
        } catch (error) {
          console.error('Error processing message:', error);
          // Implement dead letter queue logic here
        }
      },
      eachBatch: async ({ batch, resolveOffset, heartbeat, isRunning, isStale }) => {
        for (const message of batch.messages) {
          if (!isRunning() || isStale()) break;
          
          await this.processMessage({
            topic: batch.topic,
            partition: batch.partition,
            message
          } as EachMessagePayload);
          
          resolveOffset(message.offset);
          await heartbeat();
        }
      }
    });
  }

  private async processMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, message } = payload;
    const event = JSON.parse(message.value?.toString() || '{}');

    switch (topic) {
      case 'portfolio.holdings.updated':
        await this.handlePortfolioUpdated(event);
        break;
      
      case 'portfolio.transactions.created':
        await this.handleTransactionCreated(event);
        break;
      
      case 'market.prices.updated':
        await this.handlePriceUpdated(event);
        break;
      
      default:
        console.warn(`Unknown topic: ${topic}`);
    }
  }

  private async handlePortfolioUpdated(event: any): Promise<void> {
    const { userId, holdings, totalValue } = event.data;
    
    // Calculate portfolio metrics
    const metrics = await this.calculatePortfolioMetrics(userId, holdings, totalValue);
    
    // Store analytics data
    await this.storePortfolioAnalytics(userId, metrics);
    
    // Check for alerts
    await this.checkPortfolioAlerts(userId, metrics);
  }

  private async handleTransactionCreated(event: any): Promise<void> {
    const { userId, symbol, transactionType, quantity, pricePerUnit } = event.data;
    
    // Update transaction analytics
    await this.updateTransactionAnalytics(userId, {
      symbol,
      type: transactionType,
      quantity: parseFloat(quantity),
      price: pricePerUnit ? parseFloat(pricePerUnit) : null
    });
  }

  private async handlePriceUpdated(event: any): Promise<void> {
    const { symbol, price, change24h } = event.data;
    
    // Find affected portfolios
    const affectedUsers = await this.getUsersWithSymbol(symbol);
    
    // Update portfolio values for affected users
    for (const userId of affectedUsers) {
      await this.updatePortfolioValue(userId, symbol, parseFloat(price));
    }
    
    // Check price alerts
    await this.checkPriceAlerts(symbol, parseFloat(price), parseFloat(change24h));
  }
}
```

### Notification Service Consumer

```typescript
class NotificationConsumer {
  private consumer: Consumer;

  constructor(private kafka: Kafka) {
    this.consumer = this.kafka.consumer({
      groupId: 'notification-service',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
  }

  async start(): Promise<void> {
    await this.consumer.connect();
    
    await this.consumer.subscribe({
      topics: [
        'notifications.email.send',
        'notifications.push.send',
        'portfolio.holdings.updated'
      ],
      fromBeginning: false
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = JSON.parse(message.value?.toString() || '{}');
        
        switch (topic) {
          case 'notifications.email.send':
            await this.sendEmail(event.data);
            break;
            
          case 'notifications.push.send':
            await this.sendPushNotification(event.data);
            break;
            
          case 'portfolio.holdings.updated':
            await this.checkPortfolioNotifications(event.data);
            break;
        }
      }
    });
  }

  private async sendEmail(emailData: any): Promise<void> {
    // Email sending logic
  }

  private async sendPushNotification(pushData: any): Promise<void> {
    // Push notification logic
  }

  private async checkPortfolioNotifications(portfolioData: any): Promise<void> {
    // Check if portfolio changes trigger notifications
  }
}
```

## Error Handling and Dead Letter Queues

### Dead Letter Queue Configuration

```typescript
class DeadLetterQueueHandler {
  private dlqProducer: Producer;

  constructor(private kafka: Kafka) {
    this.dlqProducer = this.kafka.producer({
      groupId: 'dlq-producer'
    });
  }

  async sendToDeadLetterQueue(
    originalTopic: string,
    message: any,
    error: Error,
    metadata: any = {}
  ): Promise<void> {
    const dlqMessage = {
      originalTopic,
      originalMessage: message,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      },
      metadata,
      retryCount: metadata.retryCount || 0
    };

    await this.dlqProducer.send({
      topic: `${originalTopic}.dlq`,
      value: JSON.stringify(dlqMessage),
      headers: {
        'original-topic': originalTopic,
        'error-type': error.name,
        'retry-count': (metadata.retryCount || 0).toString()
      }
    });
  }
}
```

## Monitoring and Metrics

### Kafka Metrics Collection

```typescript
class KafkaMetricsCollector {
  private kafka: Kafka;
  private admin: any;

  async collectBrokerMetrics(): Promise<BrokerMetrics> {
    const brokers = await this.admin.describeCluster();
    const metrics = {
      brokerCount: brokers.brokers.length,
      controllerId: brokers.controller,
      clusterInfo: brokers
    };

    return metrics;
  }

  async collectTopicMetrics(): Promise<TopicMetrics[]> {
    const topics = await this.admin.listTopics();
    const topicMetrics = [];

    for (const topic of topics) {
      const metadata = await this.admin.fetchTopicMetadata({ topics: [topic] });
      const offsets = await this.admin.fetchTopicOffsets(topic);
      
      topicMetrics.push({
        name: topic,
        partitions: metadata.topics[0].partitions.length,
        replicationFactor: metadata.topics[0].partitions[0].replicas.length,
        totalMessages: this.calculateTotalMessages(offsets),
        lagMetrics: await this.calculateConsumerLag(topic)
      });
    }

    return topicMetrics;
  }

  async collectConsumerGroupMetrics(): Promise<ConsumerGroupMetrics[]> {
    const groups = await this.admin.listGroups();
    const groupMetrics = [];

    for (const group of groups.groups) {
      const description = await this.admin.describeGroups([group.groupId]);
      const offsets = await this.admin.fetchOffsets({
        groupId: group.groupId,
        topics: description.groups[0].members.map(m => m.memberAssignment)
      });

      groupMetrics.push({
        groupId: group.groupId,
        state: description.groups[0].state,
        memberCount: description.groups[0].members.length,
        lag: this.calculateGroupLag(offsets)
      });
    }

    return groupMetrics;
  }
}
```

This message queue architecture provides:
- **Scalability**: Partitioned topics for horizontal scaling
- **Reliability**: Replication and durability guarantees
- **Performance**: Batch processing and compression
- **Monitoring**: Comprehensive metrics and alerting
- **Error Handling**: Dead letter queues and retry mechanisms
- **Schema Evolution**: Avro schema registry integration