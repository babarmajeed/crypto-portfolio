# Docker Containerization and Kubernetes Orchestration

## Overview
Comprehensive containerization strategy using Docker and Kubernetes orchestration for scalable, resilient deployment of the crypto portfolio microservices architecture.

## Docker Containerization

### Multi-Stage Dockerfile Strategy

#### Node.js Services Dockerfile

```dockerfile
# Base image for all Node.js services
FROM node:18-alpine AS base

# Install security updates and tools
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development dependencies stage  
FROM base AS deps-dev
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/

RUN npm ci

# Build stage
FROM deps-dev AS build
WORKDIR /app

# Copy source code
COPY . .

# Build the application
RUN npm run build && \
    npm prune --production

# Production stage
FROM base AS production
WORKDIR /app

# Copy built application and production dependencies
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Security: run as non-root user
USER nextjs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

EXPOSE 3000
```

#### Service-Specific Dockerfiles

```dockerfile
# Portfolio Service
FROM crypto-portfolio-base:latest AS portfolio-service

WORKDIR /app

COPY services/portfolio/package*.json ./
RUN npm ci --only=production

COPY services/portfolio/src ./src
COPY services/portfolio/dist ./dist

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

EXPOSE 3002

CMD ["node", "dist/portfolio-service.js"]

---

# Market Data Service  
FROM crypto-portfolio-base:latest AS market-data-service

WORKDIR /app

COPY services/market-data/package*.json ./
RUN npm ci --only=production

COPY services/market-data/src ./src
COPY services/market-data/dist ./dist

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3003/health || exit 1

EXPOSE 3003

CMD ["node", "dist/market-data-service.js"]

---

# Analytics Service (with Python dependencies)
FROM python:3.11-alpine AS analytics-base

RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    ta-lib-dev \
    && pip install --no-cache-dir numpy pandas ta-lib

FROM analytics-base AS analytics-service

WORKDIR /app

# Install Python dependencies
COPY services/analytics/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python source
COPY services/analytics/src ./src

# Install Node.js for the API layer
RUN apk add --no-cache nodejs npm

# Copy Node.js package files
COPY services/analytics/package*.json ./
RUN npm ci --only=production

# Copy Node.js source
COPY services/analytics/dist ./dist

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3004/health || exit 1

EXPOSE 3004

CMD ["node", "dist/analytics-service.js"]
```

### Docker Compose for Development

```yaml
# docker-compose.yml
version: '3.8'

networks:
  crypto-portfolio:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  mongodb_data:
  kafka_data:
  zookeeper_data:

services:
  # Infrastructure Services
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: crypto_portfolio
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - crypto-portfolio
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - crypto-portfolio
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:6
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: admin
      MONGO_INITDB_DATABASE: crypto_portfolio
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"
    networks:
      - crypto-portfolio
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.4.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    volumes:
      - zookeeper_data:/var/lib/zookeeper/data
    networks:
      - crypto-portfolio
    healthcheck:
      test: ["CMD", "bash", "-c", "echo 'ruok' | nc localhost 2181"]
      interval: 10s
      timeout: 5s
      retries: 5

  kafka:
    image: confluentinc/cp-kafka:7.4.0
    depends_on:
      zookeeper:
        condition: service_healthy
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: true
    volumes:
      - kafka_data:/var/lib/kafka/data
    ports:
      - "29092:29092"
    networks:
      - crypto-portfolio
    healthcheck:
      test: ["CMD", "kafka-broker-api-versions", "--bootstrap-server", "localhost:9092"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Application Services
  auth-service:
    build:
      context: .
      dockerfile: services/auth/Dockerfile
      target: production
    environment:
      NODE_ENV: development
      PORT: 3001
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/crypto_portfolio
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-jwt-secret
      JWT_REFRESH_SECRET: your-jwt-refresh-secret
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - crypto-portfolio
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  portfolio-service:
    build:
      context: .
      dockerfile: services/portfolio/Dockerfile
      target: production
    environment:
      NODE_ENV: development
      PORT: 3002
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/crypto_portfolio
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
    ports:
      - "3002:3002"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
    networks:
      - crypto-portfolio
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  market-data-service:
    build:
      context: .
      dockerfile: services/market-data/Dockerfile
      target: production
    environment:
      NODE_ENV: development
      PORT: 3003
      REDIS_URL: redis://redis:6379
      MONGODB_URL: mongodb://admin:admin@mongodb:27017/crypto_portfolio?authSource=admin
      KAFKA_BROKERS: kafka:9092
    ports:
      - "3003:3003"
    depends_on:
      redis:
        condition: service_healthy
      mongodb:
        condition: service_healthy
      kafka:
        condition: service_healthy
    networks:
      - crypto-portfolio
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'

  analytics-service:
    build:
      context: .
      dockerfile: services/analytics/Dockerfile
      target: production
    environment:
      NODE_ENV: development
      PORT: 3004
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/crypto_portfolio
      REDIS_URL: redis://redis:6379
      KAFKA_BROKERS: kafka:9092
    ports:
      - "3004:3004"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      kafka:
        condition: service_healthy
    networks:
      - crypto-portfolio
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'

  # API Gateway
  api-gateway:
    build:
      context: .
      dockerfile: api-gateway/Dockerfile
      target: production
    environment:
      NODE_ENV: development
      PORT: 3000
      AUTH_SERVICE_URL: http://auth-service:3001
      PORTFOLIO_SERVICE_URL: http://portfolio-service:3002
      MARKET_DATA_SERVICE_URL: http://market-data-service:3003
      ANALYTICS_SERVICE_URL: http://analytics-service:3004
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      - auth-service
      - portfolio-service
      - market-data-service
      - analytics-service
    networks:
      - crypto-portfolio
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'

  # Monitoring
  prometheus:
    image: prom/prometheus:v2.45.0
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    networks:
      - crypto-portfolio

  grafana:
    image: grafana/grafana:10.0.0
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - ./monitoring/grafana:/etc/grafana/provisioning
    ports:
      - "3001:3000"
    networks:
      - crypto-portfolio
```

## Kubernetes Deployment

### Namespace and ConfigMaps

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: crypto-portfolio
  labels:
    name: crypto-portfolio
    version: v1

---
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: crypto-portfolio
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  KAFKA_BROKERS: "kafka-cluster-kafka-bootstrap:9092"
  REDIS_URL: "redis://redis-cluster:6379"
  DATABASE_URL: "postgresql://postgres:5432/crypto_portfolio"

---
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: crypto-portfolio
type: Opaque
data:
  JWT_SECRET: <base64-encoded-jwt-secret>
  JWT_REFRESH_SECRET: <base64-encoded-refresh-secret>
  DATABASE_PASSWORD: <base64-encoded-db-password>
  REDIS_PASSWORD: <base64-encoded-redis-password>
```

### Service Deployments

```yaml
# auth-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: crypto-portfolio
  labels:
    app: auth-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
      version: v1
  template:
    metadata:
      labels:
        app: auth-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: auth-service
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: auth-service
        image: crypto-portfolio/auth-service:v1.0.0
        imagePullPolicy: IfNotPresent
        ports:
        - containerPort: 3001
          name: http
          protocol: TCP
        env:
        - name: PORT
          value: "3001"
        - name: NODE_ENV
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: NODE_ENV
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: app-config
              key: DATABASE_URL
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DATABASE_PASSWORD
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: JWT_SECRET
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL

---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: crypto-portfolio
  labels:
    app: auth-service
spec:
  selector:
    app: auth-service
  ports:
  - port: 80
    targetPort: 3001
    protocol: TCP
    name: http
  type: ClusterIP

---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: auth-service-hpa
  namespace: crypto-portfolio
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: auth-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
```

### Database Deployments

```yaml
# postgres.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: crypto-portfolio
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
          name: postgres
        env:
        - name: POSTGRES_DB
          value: crypto_portfolio
        - name: POSTGRES_USER
          value: postgres
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: DATABASE_PASSWORD
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - pg_isready -U postgres
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: crypto-portfolio
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  clusterIP: None  # Headless service
```

### Redis Cluster

```yaml
# redis-cluster.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis-cluster
  namespace: crypto-portfolio
spec:
  serviceName: redis-cluster
  replicas: 6
  selector:
    matchLabels:
      app: redis-cluster
  template:
    metadata:
      labels:
        app: redis-cluster
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - /etc/redis/redis.conf
        ports:
        - containerPort: 6379
          name: client
        - containerPort: 16379
          name: gossip
        volumeMounts:
        - name: redis-config
          mountPath: /etc/redis
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-config
        configMap:
          name: redis-config
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi

---
apiVersion: v1
kind: Service
metadata:
  name: redis-cluster
  namespace: crypto-portfolio
spec:
  selector:
    app: redis-cluster
  ports:
  - port: 6379
    targetPort: 6379
    name: client
  - port: 16379
    targetPort: 16379
    name: gossip
  clusterIP: None
```

### Kafka Cluster using Strimzi

```yaml
# kafka-cluster.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: kafka-cluster
  namespace: crypto-portfolio
spec:
  kafka:
    version: 3.5.0
    replicas: 3
    listeners:
    - name: plain
      port: 9092
      type: internal
      tls: false
    - name: tls
      port: 9093
      type: internal
      tls: true
      authentication:
        type: tls
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      inter.broker.protocol.version: "3.5"
    storage:
      type: jbod
      volumes:
      - id: 0
        type: persistent-claim
        size: 100Gi
        deleteClaim: false
        class: fast-ssd
    resources:
      requests:
        memory: 2Gi
        cpu: 1000m
      limits:
        memory: 4Gi
        cpu: 2000m
    jvmOptions:
      -Xms: 1024m
      -Xmx: 1024m
    metricsConfig:
      type: jmxPrometheusExporter
      valueFrom:
        configMapKeyRef:
          name: kafka-metrics
          key: kafka-metrics-config.yml
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi
      deleteClaim: false
      class: fast-ssd
    resources:
      requests:
        memory: 512Mi
        cpu: 250m
      limits:
        memory: 1Gi
        cpu: 500m
    metricsConfig:
      type: jmxPrometheusExporter
      valueFrom:
        configMapKeyRef:
          name: kafka-metrics
          key: zookeeper-metrics-config.yml
  entityOperator:
    topicOperator: {}
    userOperator: {}
    tlsSidecar:
      resources:
        requests:
          cpu: 200m
          memory: 64Mi
        limits:
          cpu: 500m
          memory: 128Mi

---
# Kafka Topics
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: portfolio-holdings-updated
  namespace: crypto-portfolio
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  partitions: 12
  replicas: 3
  config:
    retention.ms: 604800000  # 7 days
    compression.type: snappy

---
apiVersion: kafka.strimzi.io/v1beta2
kind: KafkaTopic
metadata:
  name: market-prices-updated
  namespace: crypto-portfolio
  labels:
    strimzi.io/cluster: kafka-cluster
spec:
  partitions: 24
  replicas: 3
  config:
    retention.ms: 86400000   # 1 day
    cleanup.policy: compact
    compression.type: snappy
```

### Ingress Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crypto-portfolio-ingress
  namespace: crypto-portfolio
  annotations:
    kubernetes.io/ingress.class: "nginx"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://crypto-portfolio.com"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization"
spec:
  tls:
  - hosts:
    - api.crypto-portfolio.com
    secretName: crypto-portfolio-tls
  rules:
  - host: api.crypto-portfolio.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 80

---
# Certificate Issuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@crypto-portfolio.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Monitoring and Observability

```yaml
# monitoring.yaml
apiVersion: v1
kind: ServiceMonitor
metadata:
  name: crypto-portfolio-services
  namespace: crypto-portfolio
spec:
  selector:
    matchLabels:
      monitoring: "true"
  endpoints:
  - port: http
    path: /metrics
    interval: 30s

---
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: crypto-portfolio-alerts
  namespace: crypto-portfolio
spec:
  groups:
  - name: crypto-portfolio.rules
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Error rate is above 10% for {{ $labels.service }}"
    
    - alert: HighLatency
      expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High latency detected"
        description: "95th percentile latency is above 2s for {{ $labels.service }}"
    
    - alert: PodCrashLooping
      expr: rate(kube_pod_container_status_restarts_total[15m]) > 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Pod is crash looping"
        description: "Pod {{ $labels.pod }} in namespace {{ $labels.namespace }} is crash looping"
```

### Helm Chart Structure

```yaml
# Chart.yaml
apiVersion: v2
name: crypto-portfolio
description: A Helm chart for Crypto Portfolio Application
type: application
version: 1.0.0
appVersion: "1.0.0"
dependencies:
- name: postgresql
  version: 12.1.2
  repository: https://charts.bitnami.com/bitnami
  condition: postgresql.enabled
- name: redis
  version: 17.3.7
  repository: https://charts.bitnami.com/bitnami
  condition: redis.enabled
- name: strimzi-kafka-operator
  version: 0.36.1
  repository: https://strimzi.io/charts/
  condition: kafka.enabled

---
# values.yaml
global:
  imageRegistry: docker.io
  imageTag: "1.0.0"
  imagePullPolicy: IfNotPresent
  storageClass: "fast-ssd"

replicaCount:
  authService: 3
  portfolioService: 3
  marketDataService: 2
  analyticsService: 2
  apiGateway: 2

resources:
  authService:
    requests:
      memory: "256Mi"
      cpu: "250m"
    limits:
      memory: "512Mi"
      cpu: "500m"
  portfolioService:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: api.crypto-portfolio.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: crypto-portfolio-tls
      hosts:
        - api.crypto-portfolio.com

postgresql:
  enabled: true
  auth:
    database: crypto_portfolio
    username: postgres
  primary:
    persistence:
      enabled: true
      size: 100Gi
      storageClass: "fast-ssd"

redis:
  enabled: true
  architecture: replication
  replica:
    replicaCount: 2
  persistence:
    enabled: true
    size: 10Gi

kafka:
  enabled: true
  replicas: 3
  persistence:
    size: 100Gi

monitoring:
  prometheus:
    enabled: true
  grafana:
    enabled: true
    adminPassword: "admin123"
```

This containerization and orchestration architecture provides:
- **Scalability**: Horizontal pod autoscaling based on metrics
- **High Availability**: Multi-replica deployments with proper resource allocation
- **Security**: Non-root containers, security contexts, and network policies
- **Observability**: Comprehensive monitoring with Prometheus and Grafana
- **Persistence**: Stateful storage for databases and message queues
- **Service Discovery**: Kubernetes-native service discovery and load balancing
- **SSL/TLS**: Automated certificate management with cert-manager
- **Resource Management**: CPU and memory limits and requests
- **Health Checks**: Liveness and readiness probes for all services