# API Gateway Architecture

## Overview
Comprehensive API Gateway implementation using Kong/Istio for routing, authentication, rate limiting, and cross-cutting concerns in the crypto portfolio microservices architecture.

## Gateway Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                           │
│                  (AWS ALB/CloudFlare)                      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway                           │
│                    (Kong/Istio)                            │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Auth     │  │ Rate Limit  │  │  Request    │        │
│  │ Middleware  │  │ Middleware  │  │ Transform   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Logging    │  │ Monitoring  │  │   Circuit   │        │
│  │ Middleware  │  │ Middleware  │  │  Breaker    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Service Mesh                             │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Portfolio   │  │ Market Data │  │    Auth     │        │
│  │ Service     │  │ Service     │  │  Service    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Analytics   │  │Notification │  │ File Proc   │        │
│  │ Service     │  │ Service     │  │ Service     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Kong API Gateway Configuration

```yaml
# kong.yml - Declarative configuration
_format_version: "3.0"
_transform: true

services:
  # Authentication Service
  - name: auth-service
    url: http://auth-service:3001
    plugins:
      - name: prometheus
        config:
          per_consumer: true
      - name: request-transformer
        config:
          remove:
            headers: ["x-internal-auth"]
    routes:
      - name: auth-login
        paths: ["/api/v1/auth/login"]
        methods: ["POST"]
        strip_path: false
        plugins:
          - name: rate-limiting
            config:
              minute: 5
              hour: 20
              policy: redis
              redis_host: redis
              redis_port: 6379
      - name: auth-register
        paths: ["/api/v1/auth/register"]
        methods: ["POST"]
        strip_path: false
        plugins:
          - name: rate-limiting
            config:
              minute: 3
              hour: 10
              policy: redis
      - name: auth-protected
        paths: ["/api/v1/auth"]
        methods: ["GET", "PUT", "DELETE"]
        strip_path: false
        plugins:
          - name: jwt
            config:
              secret_is_base64: false
              key_claim_name: kid
              algorithm: HS256

  # Portfolio Service
  - name: portfolio-service
    url: http://portfolio-service:3002
    plugins:
      - name: prometheus
      - name: correlation-id
        config:
          header_name: X-Correlation-ID
          generator: uuid#counter
          echo_downstream: true
    routes:
      - name: portfolio-routes
        paths: ["/api/v1/portfolio"]
        strip_path: false
        plugins:
          - name: jwt
            config:
              secret_is_base64: false
          - name: rate-limiting
            config:
              minute: 100
              hour: 1000
              policy: redis
          - name: acl
            config:
              allow: ["user", "premium"]

  # Market Data Service
  - name: market-data-service
    url: http://market-data-service:3003
    plugins:
      - name: prometheus
      - name: response-transformer
        config:
          add:
            headers: ["X-Cache-Status:MISS"]
    routes:
      - name: market-data-public
        paths: ["/api/v1/market/prices", "/api/v1/market/charts"]
        methods: ["GET"]
        strip_path: false
        plugins:
          - name: rate-limiting
            config:
              minute: 200
              hour: 5000
              policy: redis
          - name: proxy-cache
            config:
              request_method: ["GET"]
              response_code: [200]
              content_type: ["application/json"]
              cache_ttl: 60
              strategy: memory
      - name: market-data-protected
        paths: ["/api/v1/market/alerts", "/api/v1/market/watchlist"]
        strip_path: false
        plugins:
          - name: jwt
          - name: rate-limiting
            config:
              minute: 50
              hour: 500

  # Analytics Service
  - name: analytics-service
    url: http://analytics-service:3004
    routes:
      - name: analytics-routes
        paths: ["/api/v1/analytics"]
        strip_path: false
        plugins:
          - name: jwt
          - name: rate-limiting
            config:
              minute: 30
              hour: 300
              policy: redis
          - name: acl
            config:
              allow: ["premium", "admin"]
          - name: request-size-limiting
            config:
              allowed_payload_size: 10

  # File Processing Service
  - name: file-processing-service
    url: http://file-processing-service:3005
    routes:
      - name: file-upload
        paths: ["/api/v1/files/upload"]
        methods: ["POST"]
        strip_path: false
        plugins:
          - name: jwt
          - name: rate-limiting
            config:
              minute: 5
              hour: 20
          - name: request-size-limiting
            config:
              allowed_payload_size: 52428800  # 50MB

  # Notification Service
  - name: notification-service
    url: http://notification-service:3006
    routes:
      - name: notification-routes
        paths: ["/api/v1/notifications"]
        strip_path: false
        plugins:
          - name: jwt
          - name: rate-limiting
            config:
              minute: 50
              hour: 200

# Global Plugins
plugins:
  - name: cors
    config:
      origins: ["https://crypto-portfolio.com", "https://app.crypto-portfolio.com"]
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
      headers: ["Accept", "Accept-Version", "Content-Length", "Content-MD5", "Content-Type", "Date", "Authorization"]
      exposed_headers: ["X-Auth-Token"]
      credentials: true
      max_age: 3600

  - name: request-id
    config:
      header_name: X-Request-ID
      generator: uuid

  - name: ip-restriction
    config:
      deny: ["192.168.1.0/24"]  # Block internal networks from external access

consumers:
  - username: mobile-app
    custom_id: mobile-app-v1
    plugins:
      - name: key-auth
        config:
          key: mobile-app-api-key-v1
      - name: rate-limiting
        config:
          minute: 1000
          hour: 10000

  - username: web-app
    custom_id: web-app-v1
    plugins:
      - name: key-auth
        config:
          key: web-app-api-key-v1
      - name: rate-limiting
        config:
          minute: 500
          hour: 5000

  - username: admin
    custom_id: admin-user
    acls:
      - group: admin
    plugins:
      - name: rate-limiting
        config:
          minute: 2000
          hour: 20000
```

### Custom Kong Plugins

#### JWT Enhanced Plugin

```lua
-- jwt-enhanced.lua
local jwt = require "resty.jwt"
local cjson = require "cjson"

local JWTEnhancedHandler = {}

function JWTEnhancedHandler:access(conf)
  local headers = kong.request.get_headers()
  local auth_header = headers["authorization"]
  
  if not auth_header then
    return kong.response.exit(401, {message = "Missing Authorization header"})
  end
  
  local token = auth_header:match("Bearer%s+(.+)")
  if not token then
    return kong.response.exit(401, {message = "Invalid Authorization header format"})
  end
  
  -- Verify JWT
  local jwt_obj = jwt:verify(conf.secret, token)
  if not jwt_obj.valid then
    return kong.response.exit(401, {message = "Invalid JWT token"})
  end
  
  -- Check token blacklist in Redis
  local redis = require "resty.redis"
  local red = redis:new()
  red:connect("redis", 6379)
  
  local blacklisted = red:get("blacklist:" .. token)
  if blacklisted and blacklisted ~= ngx.null then
    return kong.response.exit(401, {message = "Token has been revoked"})
  end
  
  -- Add user context to headers
  kong.service.request.set_header("X-User-ID", jwt_obj.payload.userId)
  kong.service.request.set_header("X-User-Roles", cjson.encode(jwt_obj.payload.roles))
  kong.service.request.set_header("X-User-Email", jwt_obj.payload.email)
  
  red:close()
end

return JWTEnhancedHandler
```

#### Dynamic Rate Limiting Plugin

```lua
-- dynamic-rate-limiting.lua
local redis = require "resty.redis"
local cjson = require "cjson"

local DynamicRateLimitingHandler = {}

function DynamicRateLimitingHandler:access(conf)
  local headers = kong.request.get_headers()
  local user_id = headers["x-user-id"]
  local user_roles = headers["x-user-roles"]
  
  if not user_id then
    return
  end
  
  -- Get user's rate limit configuration
  local red = redis:new()
  red:connect("redis", 6379)
  
  local user_limits = red:get("rate_limits:" .. user_id)
  local limits = conf.default_limits
  
  if user_limits and user_limits ~= ngx.null then
    limits = cjson.decode(user_limits)
  else
    -- Set limits based on user role
    local roles = cjson.decode(user_roles or "[]")
    if self:has_role(roles, "premium") then
      limits = conf.premium_limits
    elseif self:has_role(roles, "admin") then
      limits = conf.admin_limits
    end
  end
  
  -- Apply rate limiting
  local current_minute = math.floor(ngx.time() / 60)
  local key = "rate_limit:" .. user_id .. ":" .. current_minute
  
  local current_count = red:incr(key)
  red:expire(key, 60)
  
  if current_count > limits.minute then
    return kong.response.exit(429, {
      message = "Rate limit exceeded",
      limit = limits.minute,
      remaining = 0,
      reset = (current_minute + 1) * 60
    })
  end
  
  -- Add rate limit headers
  kong.response.set_header("X-RateLimit-Limit", limits.minute)
  kong.response.set_header("X-RateLimit-Remaining", limits.minute - current_count)
  kong.response.set_header("X-RateLimit-Reset", (current_minute + 1) * 60)
  
  red:close()
end

function DynamicRateLimitingHandler:has_role(roles, target_role)
  for _, role in ipairs(roles) do
    if role == target_role then
      return true
    end
  end
  return false
end

return DynamicRateLimitingHandler
```

### Istio Service Mesh Configuration

```yaml
# istio-gateway.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: crypto-portfolio-gateway
  namespace: crypto-portfolio
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: crypto-portfolio-tls
    hosts:
    - api.crypto-portfolio.com
  - port:
      number: 80
      name: http
      protocol: HTTP
    hosts:
    - api.crypto-portfolio.com
    tls:
      httpsRedirect: true

---
# istio-virtual-service.yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: crypto-portfolio-vs
  namespace: crypto-portfolio
spec:
  hosts:
  - api.crypto-portfolio.com
  gateways:
  - crypto-portfolio-gateway
  http:
  # Authentication routes
  - match:
    - uri:
        prefix: /api/v1/auth
    route:
    - destination:
        host: auth-service
        port:
          number: 3001
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
    retries:
      attempts: 3
      perTryTimeout: 10s
    timeout: 30s

  # Portfolio routes
  - match:
    - uri:
        prefix: /api/v1/portfolio
    route:
    - destination:
        host: portfolio-service
        port:
          number: 3002
        subset: v1
      weight: 90
    - destination:
        host: portfolio-service
        port:
          number: 3002
        subset: v2
      weight: 10
    headers:
      request:
        add:
          x-service-version: portfolio-v1

  # Market data routes with caching
  - match:
    - uri:
        prefix: /api/v1/market
      headers:
        cache-control:
          exact: no-cache
    route:
    - destination:
        host: market-data-service
        port:
          number: 3003
  - match:
    - uri:
        prefix: /api/v1/market
    route:
    - destination:
        host: market-data-cache
        port:
          number: 6379
    headers:
      response:
        add:
          x-cache-status: HIT

---
# destination-rules.yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: portfolio-service-dr
  namespace: crypto-portfolio
spec:
  host: portfolio-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
        maxRequestsPerConnection: 10
    circuitBreaker:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
    loadBalancer:
      simple: LEAST_CONN
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2

---
# security-policy.yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: crypto-portfolio-authz
  namespace: crypto-portfolio
spec:
  selector:
    matchLabels:
      app: portfolio-service
  rules:
  - from:
    - source:
        requestPrincipals: ["cluster.local/ns/crypto-portfolio/sa/frontend"]
  - to:
    - operation:
        methods: ["GET"]
        paths: ["/api/v1/portfolio/public/*"]
  - when:
    - key: request.headers[x-user-role]
      values: ["admin", "premium"]
    to:
    - operation:
        methods: ["GET", "POST", "PUT", "DELETE"]
```

### API Gateway Middleware Stack

```typescript
// middleware/gateway-middleware.ts
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import compression from 'compression';
import { createProxyMiddleware } from 'http-proxy-middleware';

interface ServiceConfig {
  name: string;
  url: string;
  pathPrefix: string;
  timeout: number;
  retries: number;
  healthCheck: string;
}

class APIGateway {
  private app: express.Application;
  private services: Map<string, ServiceConfig> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupServices();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }));

    // Compression
    this.app.use(compression());

    // CORS
    this.app.use((req, res, next) => {
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
      const origin = req.headers.origin;
      
      if (allowedOrigins.includes(origin!)) {
        res.setHeader('Access-Control-Allow-Origin', origin!);
      }
      
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Request ID
    this.app.use((req, res, next) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || this.generateRequestId();
      res.setHeader('X-Request-ID', req.headers['x-request-id']);
      next();
    });

    // Logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
      });
      
      next();
    });

    // Global rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.headers['x-user-id'] || req.ip;
      }
    }));
  }

  private setupServices(): void {
    this.services.set('auth', {
      name: 'auth-service',
      url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
      pathPrefix: '/api/v1/auth',
      timeout: 30000,
      retries: 3,
      healthCheck: '/health'
    });

    this.services.set('portfolio', {
      name: 'portfolio-service',
      url: process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio-service:3002',
      pathPrefix: '/api/v1/portfolio',
      timeout: 30000,
      retries: 2,
      healthCheck: '/health'
    });

    this.services.set('market-data', {
      name: 'market-data-service',
      url: process.env.MARKET_DATA_SERVICE_URL || 'http://market-data-service:3003',
      pathPrefix: '/api/v1/market',
      timeout: 15000,
      retries: 2,
      healthCheck: '/health'
    });

    this.services.set('analytics', {
      name: 'analytics-service',
      url: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3004',
      pathPrefix: '/api/v1/analytics',
      timeout: 60000,
      retries: 1,
      healthCheck: '/health'
    });

    // Initialize circuit breakers
    for (const [name, config] of this.services.entries()) {
      this.circuitBreakers.set(name, new CircuitBreaker(config));
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: this.getServiceHealthStatus()
      });
    });

    // Service routes
    for (const [name, config] of this.services.entries()) {
      this.setupServiceRoute(name, config);
    }

    // Fallback route
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Gateway error:', err);
      
      res.status(err.status || 500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    });
  }

  private setupServiceRoute(serviceName: string, config: ServiceConfig): void {
    const circuitBreaker = this.circuitBreakers.get(serviceName)!;
    
    this.app.use(config.pathPrefix, async (req, res, next) => {
      try {
        // Check circuit breaker
        if (circuitBreaker.isOpen()) {
          return res.status(503).json({
            error: 'Service temporarily unavailable',
            service: serviceName,
            timestamp: new Date().toISOString()
          });
        }

        // Create proxy
        const proxy = createProxyMiddleware({
          target: config.url,
          changeOrigin: true,
          timeout: config.timeout,
          retries: config.retries,
          onError: (err, req, res) => {
            circuitBreaker.recordFailure();
            res.status(502).json({
              error: 'Service unavailable',
              service: serviceName,
              message: err.message,
              timestamp: new Date().toISOString()
            });
          },
          onProxyRes: (proxyRes, req, res) => {
            circuitBreaker.recordSuccess();
            
            // Add service headers
            res.setHeader('X-Service-Name', serviceName);
            res.setHeader('X-Service-Time', Date.now() - req.startTime);
          },
          onProxyReq: (proxyReq, req, res) => {
            req.startTime = Date.now();
            
            // Add gateway headers
            proxyReq.setHeader('X-Gateway-Request-ID', req.headers['x-request-id']);
            proxyReq.setHeader('X-Gateway-Timestamp', new Date().toISOString());
            
            // Forward user context
            if (req.headers['x-user-id']) {
              proxyReq.setHeader('X-User-ID', req.headers['x-user-id']);
            }
            if (req.headers['x-user-roles']) {
              proxyReq.setHeader('X-User-Roles', req.headers['x-user-roles']);
            }
          }
        });

        proxy(req, res, next);
      } catch (error) {
        next(error);
      }
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getServiceHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, config] of this.services.entries()) {
      const circuitBreaker = this.circuitBreakers.get(name)!;
      status[name] = {
        url: config.url,
        healthy: !circuitBreaker.isOpen(),
        circuitState: circuitBreaker.getState(),
        failures: circuitBreaker.getFailureCount()
      };
    }
    
    return status;
  }

  listen(port: number): void {
    this.app.listen(port, () => {
      console.log(`API Gateway listening on port ${port}`);
    });
  }
}

// Circuit Breaker Implementation
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureThreshold = 5;
  private resetTimeout = 30000; // 30 seconds
  private successThreshold = 3;
  private halfOpenSuccessCount = 0;

  constructor(private config: ServiceConfig) {}

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.halfOpenSuccessCount = 0;
        return false;
      }
      return true;
    }
    
    return false;
  }

  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
      this.state = 'CLOSED';
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

export default APIGateway;
```

### Monitoring and Observability

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    rule_files:
      - /etc/prometheus/rules/*.yml
    
    scrape_configs:
      - job_name: 'kong'
        static_configs:
          - targets: ['kong-admin:8001']
        metrics_path: '/metrics'
        scrape_interval: 30s
      
      - job_name: 'istio-proxy'
        kubernetes_sd_configs:
          - role: endpoints
            namespaces:
              names:
                - crypto-portfolio
        relabel_configs:
          - source_labels: [__meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
            action: keep
            regex: istio-proxy;http-monitoring
      
      - job_name: 'api-gateway'
        static_configs:
          - targets: ['api-gateway:3000']
        metrics_path: '/metrics'

    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager:9093

---
# grafana-dashboard.json
{
  "dashboard": {
    "title": "API Gateway Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(kong_http_requests_total[5m])",
            "legendFormat": "{{service}} - {{method}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(kong_request_duration_ms_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(kong_http_requests_total{status=~\"5..\"}[5m]) / rate(kong_http_requests_total[5m])",
            "legendFormat": "5xx Error Rate"
          }
        ]
      },
      {
        "title": "Circuit Breaker Status",
        "type": "stat",
        "targets": [
          {
            "expr": "circuit_breaker_state",
            "legendFormat": "{{service}}"
          }
        ]
      }
    ]
  }
}
```

This API Gateway architecture provides:
- **Centralized Entry Point**: Single point of access for all services
- **Authentication & Authorization**: JWT validation and RBAC enforcement
- **Rate Limiting**: Dynamic rate limiting based on user roles and quotas
- **Circuit Breakers**: Fault tolerance and cascading failure prevention
- **Monitoring**: Comprehensive metrics and observability
- **Security**: CORS, CSRF protection, and security headers
- **Caching**: Response caching for improved performance
- **Load Balancing**: Traffic distribution across service instances
- **Request Transformation**: Header manipulation and request/response transformation