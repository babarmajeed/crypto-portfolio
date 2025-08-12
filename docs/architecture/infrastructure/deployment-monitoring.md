# Deployment and Monitoring Architecture

## Overview
Comprehensive deployment strategy and monitoring infrastructure for the crypto portfolio application, ensuring high availability, observability, and operational excellence.

## Deployment Architecture

### Multi-Environment Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                   Production Environment                   │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Region    │  │   Region    │  │   Region    │        │
│  │  us-west-2  │  │  us-east-1  │  │  eu-west-1  │        │
│  │ (Primary)   │  │    (DR)     │  │  (Global)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Staging Environment                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Load      │  │ Application │  │  Database   │        │
│  │  Testing    │  │  Testing    │  │  Testing    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Development Environment                     │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Feature    │  │Integration  │  │   Preview   │        │
│  │   Testing   │  │   Testing   │  │ Deployments │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Infrastructure as Code (Terraform)

```hcl
# terraform/environments/production/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
  }
  
  backend "s3" {
    bucket         = "crypto-portfolio-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "crypto-portfolio-prod"
  cidr = "10.0.0.0/16"

  azs             = ["us-west-2a", "us-west-2b", "us-west-2c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  enable_vpn_gateway = true
  enable_dns_hostnames = true
  enable_dns_support = true

  tags = {
    Environment = "production"
    Project     = "crypto-portfolio"
    Terraform   = "true"
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "crypto-portfolio-prod"
  cluster_version = "1.28"

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    application = {
      name = "application-nodes"
      
      instance_types = ["m5.xlarge"]
      capacity_type  = "ON_DEMAND"
      
      min_size     = 3
      max_size     = 10
      desired_size = 5

      k8s_labels = {
        Environment = "production"
        NodeType    = "application"
      }

      tags = {
        ExtraTag = "application-nodes"
      }
    }

    database = {
      name = "database-nodes"
      
      instance_types = ["r5.2xlarge"]
      capacity_type  = "ON_DEMAND"
      
      min_size     = 2
      max_size     = 5
      desired_size = 3

      k8s_labels = {
        Environment = "production"
        NodeType    = "database"
      }

      taints = [
        {
          key    = "database"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]
    }
  }

  # Cluster access entry
  access_entries = {
    admin = {
      kubernetes_groups = []
      principal_arn     = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/EKSAdminRole"

      policy_associations = {
        admin = {
          policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = {
            type = "cluster"
          }
        }
      }
    }
  }

  tags = {
    Environment = "production"
    Project     = "crypto-portfolio"
  }
}

# RDS for PostgreSQL
module "postgres" {
  source = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "crypto-portfolio-prod"

  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = "db.r6g.2xlarge"
  allocated_storage = 500
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "crypto_portfolio"
  username = "postgres"
  password = random_password.db_password.result

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = module.vpc.database_subnet_group

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "Sun:04:00-Sun:05:00"

  monitoring_interval    = 60
  monitoring_role_name   = "RDSEnhancedMonitoringRole"
  create_monitoring_role = true

  performance_insights_enabled = true
  performance_insights_retention_period = 7

  multi_az               = true
  publicly_accessible    = false
  deletion_protection    = true

  tags = {
    Environment = "production"
    Project     = "crypto-portfolio"
  }
}

# ElastiCache for Redis
module "redis" {
  source = "terraform-aws-modules/elasticache/aws"
  version = "~> 1.0"

  cluster_id           = "crypto-portfolio-prod"
  description          = "Redis cluster for crypto portfolio"

  node_type            = "cache.r6g.xlarge"
  num_cache_nodes      = 3
  parameter_group_name = "default.redis7"
  port                 = 6379
  engine_version       = "7.0"

  subnet_group_name = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  tags = {
    Environment = "production"
    Project     = "crypto-portfolio"
  }
}

# Application Load Balancer
module "alb" {
  source = "terraform-aws-modules/alb/aws"
  version = "~> 8.0"

  name = "crypto-portfolio-prod"

  load_balancer_type = "application"

  vpc_id          = module.vpc.vpc_id
  subnets         = module.vpc.public_subnets
  security_groups = [aws_security_group.alb.id]

  target_groups = [
    {
      name             = "crypto-portfolio-tg"
      backend_protocol = "HTTP"
      backend_port     = 80
      target_type      = "ip"
      health_check = {
        enabled             = true
        healthy_threshold   = 2
        interval            = 30
        matcher             = "200"
        path                = "/health"
        port                = "traffic-port"
        protocol            = "HTTP"
        timeout             = 5
        unhealthy_threshold = 2
      }
    }
  ]

  https_listeners = [
    {
      port               = 443
      protocol           = "HTTPS"
      certificate_arn    = aws_acm_certificate.main.arn
      target_group_index = 0
    }
  ]

  http_tcp_listeners = [
    {
      port        = 80
      protocol    = "HTTP"
      action_type = "redirect"
      redirect = {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  ]

  tags = {
    Environment = "production"
    Project     = "crypto-portfolio"
  }
}

# Security Groups
resource "aws_security_group" "rds" {
  name_prefix = "crypto-portfolio-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "crypto-portfolio-rds-sg"
  }
}

# Outputs
output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  value = module.eks.cluster_security_group_id
}

output "rds_endpoint" {
  value = module.postgres.db_instance_endpoint
}

output "redis_endpoint" {
  value = module.redis.cluster_cache_nodes[0].address
}
```

### Helm Charts for Application Deployment

```yaml
# helm/crypto-portfolio/Chart.yaml
apiVersion: v2
name: crypto-portfolio
description: Crypto Portfolio Application
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
- name: prometheus
  version: 23.4.0
  repository: https://prometheus-community.github.io/helm-charts
  condition: monitoring.prometheus.enabled
- name: grafana
  version: 6.59.5
  repository: https://grafana.github.io/helm-charts
  condition: monitoring.grafana.enabled

---
# helm/crypto-portfolio/values/production.yaml
global:
  imageRegistry: ghcr.io
  imageRepository: crypto-portfolio-org/crypto-portfolio
  imageTag: "1.0.0"
  imagePullPolicy: IfNotPresent

replicaCount:
  authService: 5
  portfolioService: 8
  marketDataService: 6
  analyticsService: 4
  notificationService: 3
  apiGateway: 3

resources:
  authService:
    requests:
      memory: "512Mi"
      cpu: "500m"
    limits:
      memory: "1Gi"
      cpu: "1000m"
  portfolioService:
    requests:
      memory: "1Gi"
      cpu: "1000m"
    limits:
      memory: "2Gi"
      cpu: "2000m"
  marketDataService:
    requests:
      memory: "1Gi"
      cpu: "1000m"
    limits:
      memory: "2Gi"
      cpu: "2000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

ingress:
  enabled: true
  className: "alb"
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: "arn:aws:acm:us-west-2:account:certificate/cert-id"
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS":443}]'
  hosts:
    - host: api.crypto-portfolio.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: crypto-portfolio-tls
      hosts:
        - api.crypto-portfolio.com

service:
  type: ClusterIP
  port: 80

nodeSelector:
  NodeType: application

tolerations: []

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app.kubernetes.io/name
            operator: In
            values: ["crypto-portfolio"]
        topologyKey: kubernetes.io/hostname

podDisruptionBudget:
  enabled: true
  minAvailable: 2

networkPolicy:
  enabled: true
  ingress:
    - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx
      ports:
      - protocol: TCP
        port: 8080
  egress:
    - to: []
      ports:
      - protocol: TCP
        port: 5432
      - protocol: TCP
        port: 6379
      - protocol: TCP
        port: 9092

secrets:
  create: true
  annotations:
    external-secrets.io/backend: vault
    external-secrets.io/key: crypto-portfolio/production

configMaps:
  create: true
  data:
    LOG_LEVEL: "info"
    NODE_ENV: "production"
    METRICS_ENABLED: "true"
```

## Monitoring Architecture

### Observability Stack

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Custom    │  │   Health    │  │  Business   │        │
│  │  Metrics    │  │   Checks    │  │  Metrics    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Observability Platform                     │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Prometheus  │  │   Grafana   │  │  AlertMgr   │        │
│  │ (Metrics)   │  │(Dashboards) │  │  (Alerts)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Jaeger    │  │ Elasticsearch│  │   Fluentd   │        │
│  │ (Tracing)   │  │    (Logs)   │  │(Log Shipper)│        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                Infrastructure Layer                        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Node Exporter│  │   cAdvisor  │  │  K8s State  │        │
│  │ (System)    │  │(Containers) │  │  Metrics    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Prometheus Configuration

```yaml
# monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: crypto-portfolio-prod
    region: us-west-2

rule_files:
  - "/etc/prometheus/rules/*.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  # Kubernetes API Server
  - job_name: 'kubernetes-apiserver'
    kubernetes_sd_configs:
    - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
    - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
      action: keep
      regex: default;kubernetes;https

  # Kubernetes Nodes
  - job_name: 'kubernetes-nodes'
    kubernetes_sd_configs:
    - role: node
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
    - action: labelmap
      regex: __meta_kubernetes_node_label_(.+)

  # Application Services
  - job_name: 'crypto-portfolio-services'
    kubernetes_sd_configs:
    - role: endpoints
      namespaces:
        names: [crypto-portfolio]
    relabel_configs:
    - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
      action: keep
      regex: true
    - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
      action: replace
      target_label: __metrics_path__
      regex: (.+)
    - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
      action: replace
      regex: ([^:]+)(?::\d+)?;(\d+)
      replacement: $1:$2
      target_label: __address__
    - action: labelmap
      regex: __meta_kubernetes_service_label_(.+)
    - source_labels: [__meta_kubernetes_namespace]
      action: replace
      target_label: kubernetes_namespace
    - source_labels: [__meta_kubernetes_service_name]
      action: replace
      target_label: kubernetes_name

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
    - targets: ['redis-exporter:9121']

  # PostgreSQL Exporter
  - job_name: 'postgres'
    static_configs:
    - targets: ['postgres-exporter:9187']

  # Kafka Exporter
  - job_name: 'kafka'
    static_configs:
    - targets: ['kafka-exporter:9308']

---
# monitoring/prometheus/rules/application.yml
groups:
- name: application.rules
  rules:
  # HTTP Error Rate
  - alert: HighHTTPErrorRate
    expr: |
      (
        sum(rate(http_requests_total{status=~"5.."}[5m])) by (service, method, route)
        /
        sum(rate(http_requests_total[5m])) by (service, method, route)
      ) > 0.05
    for: 5m
    labels:
      severity: warning
      team: backend
    annotations:
      summary: "High HTTP error rate detected"
      description: "HTTP error rate is {{ $value | humanizePercentage }} for {{ $labels.service }}/{{ $labels.route }}"
      runbook_url: "https://runbooks.crypto-portfolio.com/high-error-rate"

  # High Response Time
  - alert: HighResponseTime
    expr: |
      histogram_quantile(0.95,
        sum(rate(http_request_duration_seconds_bucket[5m])) by (service, method, route, le)
      ) > 2
    for: 5m
    labels:
      severity: warning
      team: backend
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s for {{ $labels.service }}/{{ $labels.route }}"

  # High Memory Usage
  - alert: HighMemoryUsage
    expr: |
      (
        container_memory_usage_bytes{pod=~"crypto-portfolio-.*"}
        /
        container_spec_memory_limit_bytes{pod=~"crypto-portfolio-.*"}
      ) > 0.9
    for: 10m
    labels:
      severity: critical
      team: sre
    annotations:
      summary: "High memory usage detected"
      description: "Memory usage is {{ $value | humanizePercentage }} for {{ $labels.pod }}"

  # High CPU Usage
  - alert: HighCPUUsage
    expr: |
      (
        rate(container_cpu_usage_seconds_total{pod=~"crypto-portfolio-.*"}[5m])
        /
        container_spec_cpu_quota{pod=~"crypto-portfolio-.*"} * container_spec_cpu_period{pod=~"crypto-portfolio-.*"}
      ) > 0.8
    for: 10m
    labels:
      severity: warning
      team: sre
    annotations:
      summary: "High CPU usage detected"
      description: "CPU usage is {{ $value | humanizePercentage }} for {{ $labels.pod }}"

  # Database Connection Pool
  - alert: DatabaseConnectionPoolNearLimit
    expr: |
      (
        pg_stat_database_numbackends{datname="crypto_portfolio"}
        /
        pg_settings_max_connections
      ) > 0.8
    for: 5m
    labels:
      severity: warning
      team: backend
    annotations:
      summary: "Database connection pool near limit"
      description: "Database connections are at {{ $value | humanizePercentage }} of the limit"

  # Redis Memory Usage
  - alert: RedisHighMemoryUsage
    expr: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
    for: 5m
    labels:
      severity: warning
      team: backend
    annotations:
      summary: "Redis memory usage high"
      description: "Redis memory usage is {{ $value | humanizePercentage }}"

  # Kafka Lag
  - alert: KafkaConsumerLag
    expr: kafka_consumer_lag_max > 1000
    for: 5m
    labels:
      severity: warning
      team: backend
    annotations:
      summary: "Kafka consumer lag high"
      description: "Consumer lag is {{ $value }} messages for {{ $labels.topic }}"
```

### Grafana Dashboards

```json
{
  "dashboard": {
    "id": null,
    "title": "Crypto Portfolio - Application Overview",
    "tags": ["crypto-portfolio", "application"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "HTTP Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec",
            "min": 0
          }
        ],
        "legend": {
          "show": true,
          "values": true,
          "current": true
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 0
        }
      },
      {
        "id": 2,
        "title": "HTTP Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{service}}"
          }
        ],
        "yAxes": [
          {
            "label": "Error Rate",
            "min": 0,
            "max": 1,
            "unit": "percentunit"
          }
        ],
        "thresholds": [
          {
            "value": 0.05,
            "colorMode": "critical",
            "op": "gt"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 0
        }
      },
      {
        "id": 3,
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (service, le))",
            "legendFormat": "{{service}}"
          }
        ],
        "yAxes": [
          {
            "label": "Duration",
            "min": 0,
            "unit": "s"
          }
        ],
        "thresholds": [
          {
            "value": 2,
            "colorMode": "critical",
            "op": "gt"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        }
      },
      {
        "id": 4,
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "websocket_connections_active",
            "legendFormat": "Active Connections"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "unit": "short"
          }
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        }
      },
      {
        "id": 5,
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"crypto_portfolio\"}",
            "legendFormat": "Active Connections"
          },
          {
            "expr": "pg_settings_max_connections",
            "legendFormat": "Max Connections"
          }
        ],
        "yAxes": [
          {
            "label": "Connections",
            "min": 0
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 16
        }
      },
      {
        "id": 6,
        "title": "Memory Usage by Service",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(container_memory_usage_bytes{pod=~\"crypto-portfolio-.*\"}) by (pod)",
            "legendFormat": "{{pod}}"
          }
        ],
        "yAxes": [
          {
            "label": "Memory",
            "min": 0,
            "unit": "bytes"
          }
        ],
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 16
        }
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

### Application Health Checks

```typescript
// src/health/health-check.ts
import { Request, Response } from 'express';
import { DatabaseHealth } from './database-health';
import { RedisHealth } from './redis-health';
import { KafkaHealth } from './kafka-health';
import { ExternalServiceHealth } from './external-service-health';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  details?: any;
}

interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthCheck[];
  metadata: {
    node: string;
    environment: string;
    region: string;
  };
}

class HealthCheckService {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();

  constructor() {
    this.registerChecks();
  }

  private registerChecks(): void {
    this.checks.set('database', () => new DatabaseHealth().check());
    this.checks.set('redis', () => new RedisHealth().check());
    this.checks.set('kafka', () => new KafkaHealth().check());
    this.checks.set('external-apis', () => new ExternalServiceHealth().check());
  }

  async performHealthCheck(): Promise<HealthResponse> {
    const startTime = Date.now();
    const results: HealthCheck[] = [];

    // Run all health checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
      try {
        const result = await Promise.race([
          checkFn(),
          this.timeout(5000, name) // 5 second timeout
        ]);
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: error.message,
          responseTime: Date.now() - startTime
        });
      }
    });

    await Promise.all(checkPromises);

    // Determine overall status
    const overallStatus = this.calculateOverallStatus(results);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
      uptime: process.uptime(),
      checks: results,
      metadata: {
        node: process.env.NODE_NAME || 'unknown',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'us-west-2'
      }
    };
  }

  private calculateOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  private async timeout(ms: number, checkName: string): Promise<HealthCheck> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check ${checkName} timed out after ${ms}ms`));
      }, ms);
    });
  }

  // Express middleware
  async healthEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.performHealthCheck();
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        error: error.message
      });
    }
  }

  // Readiness probe - checks if service is ready to receive traffic
  async readinessEndpoint(req: Request, res: Response): Promise<void> {
    try {
      // Only check essential services for readiness
      const essentialChecks = ['database', 'redis'];
      const results = await Promise.all(
        essentialChecks.map(name => this.checks.get(name)!())
      );

      const isReady = results.every(check => check.status === 'healthy');
      
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        timestamp: new Date().toISOString(),
        checks: results
      });
    } catch (error) {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  }

  // Liveness probe - checks if service is alive
  async livenessEndpoint(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    });
  }
}

export const healthCheckService = new HealthCheckService();
```

### Log Aggregation with Fluentd

```yaml
# logging/fluentd-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
  namespace: crypto-portfolio
data:
  fluent.conf: |
    <source>
      @type tail
      @id in_tail_container_logs
      path /var/log/containers/*crypto-portfolio*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>

    <filter kubernetes.**>
      @type kubernetes_metadata
      @id filter_kube_metadata
      kubernetes_url "#{ENV['FLUENT_FILTER_KUBERNETES_URL'] || 'https://' + ENV['KUBERNETES_SERVICE_HOST'] + ':' + ENV['KUBERNETES_SERVICE_PORT'] + '/api'}"
      verify_ssl "#{ENV['KUBERNETES_VERIFY_SSL'] || true}"
      ca_file "#{ENV['KUBERNETES_CA_FILE']}"
      skip_labels false
      skip_container_metadata false
      skip_master_url false
      skip_namespace_metadata false
    </filter>

    # Parse application logs
    <filter kubernetes.**crypto-portfolio**>
      @type parser
      key_name log
      reserve_data true
      remove_key_name_field true
      <parse>
        @type json
        time_key timestamp
        time_format %Y-%m-%dT%H:%M:%S.%LZ
      </parse>
    </filter>

    # Add common fields
    <filter kubernetes.**crypto-portfolio**>
      @type record_transformer
      <record>
        environment "#{ENV['ENVIRONMENT'] || 'unknown'}"
        cluster "#{ENV['CLUSTER_NAME'] || 'unknown'}"
        application crypto-portfolio
      </record>
    </filter>

    # Route to different outputs based on log level
    <match kubernetes.**crypto-portfolio**>
      @type rewrite_tag_filter
      <rule>
        key level
        pattern ^(ERROR|FATAL)$
        tag error.${tag}
      </rule>
      <rule>
        key level
        pattern ^(WARN|WARNING)$
        tag warning.${tag}
      </rule>
      <rule>
        key level
        pattern ^(INFO|DEBUG|TRACE)$
        tag info.${tag}
      </rule>
    </match>

    # Send error logs to alerting system
    <match error.**>
      @type forward
      <server>
        name alerting-service
        host "#{ENV['ALERTING_SERVICE_HOST']}"
        port 24224
      </server>
      <buffer>
        @type file
        path /var/log/fluentd-buffers/error.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_thread_count 2
        flush_interval 5s
        retry_forever
        retry_max_interval 30
        chunk_limit_size 2M
        queue_limit_length 8
        overflow_action block
      </buffer>
    </match>

    # Send all logs to Elasticsearch
    <match **>
      @type elasticsearch
      host "#{ENV['ELASTICSEARCH_HOST'] || 'elasticsearch'}"
      port "#{ENV['ELASTICSEARCH_PORT'] || '9200'}"
      logstash_format true
      logstash_prefix crypto-portfolio
      logstash_dateformat %Y.%m.%d
      include_tag_key true
      type_name _doc
      tag_key @log_name
      <buffer>
        @type file
        path /var/log/fluentd-buffers/kubernetes.system.buffer
        flush_mode interval
        retry_type exponential_backoff
        flush_thread_count 2
        flush_interval 5s
        retry_forever
        retry_max_interval 30
        chunk_limit_size 2M
        queue_limit_length 8
        overflow_action block
      </buffer>
    </match>
```

### Alerting with AlertManager

```yaml
# monitoring/alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'smtp.sendgrid.net:587'
  smtp_from: 'alerts@crypto-portfolio.com'
  smtp_auth_username: 'apikey'
  smtp_auth_password: '${SENDGRID_API_KEY}'

route:
  group_by: ['alertname', 'severity', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default'
  routes:
  - match:
      severity: critical
    receiver: 'critical-alerts'
    group_wait: 10s
    repeat_interval: 1h
  - match:
      team: backend
    receiver: 'backend-team'
  - match:
      team: sre
    receiver: 'sre-team'

receivers:
- name: 'default'
  email_configs:
  - to: 'team@crypto-portfolio.com'
    subject: '[{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Labels: {{ range .Labels.SortedPairs }}{{ .Name }}: {{ .Value }}{{ end }}
      {{ end }}

- name: 'critical-alerts'
  email_configs:
  - to: 'oncall@crypto-portfolio.com'
    subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
    body: |
      CRITICAL ALERT
      {{ range .Alerts }}
      Summary: {{ .Annotations.summary }}
      Description: {{ .Annotations.description }}
      Runbook: {{ .Annotations.runbook_url }}
      {{ end }}
  slack_configs:
  - api_url: '${SLACK_API_URL}'
    channel: '#critical-alerts'
    title: 'Critical Alert: {{ .GroupLabels.alertname }}'
    text: |
      {{ range .Alerts }}
      {{ .Annotations.summary }}
      {{ .Annotations.description }}
      {{ end }}
  pagerduty_configs:
  - routing_key: '${PAGERDUTY_INTEGRATION_KEY}'
    description: '{{ .GroupLabels.alertname }}: {{ .Alerts.0.Annotations.summary }}'

- name: 'backend-team'
  slack_configs:
  - api_url: '${SLACK_API_URL}'
    channel: '#backend-alerts'
    title: '{{ .GroupLabels.alertname }}'
    text: |
      {{ range .Alerts }}
      {{ .Annotations.summary }}
      Service: {{ .Labels.service }}
      {{ end }}

- name: 'sre-team'
  slack_configs:
  - api_url: '${SLACK_API_URL}'
    channel: '#sre-alerts'
    title: '{{ .GroupLabels.alertname }}'
    text: |
      {{ range .Alerts }}
      {{ .Annotations.summary }}
      Infrastructure Component: {{ .Labels.component }}
      {{ end }}

inhibit_rules:
- source_match:
    severity: 'critical'
  target_match:
    severity: 'warning'
  equal: ['alertname', 'service']
```

This deployment and monitoring architecture provides:
- **Infrastructure as Code**: Terraform for reproducible infrastructure
- **Multi-Environment Strategy**: Separate environments with proper promotion paths
- **Comprehensive Monitoring**: Metrics, logs, traces, and health checks
- **Automated Alerting**: Intelligent routing and escalation
- **High Availability**: Multi-region deployment with disaster recovery
- **Security**: Network policies, secrets management, and access controls
- **Observability**: Complete visibility into application and infrastructure health
- **Operational Excellence**: Runbooks, dashboards, and automated responses