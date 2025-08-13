// Key Management Types for CP-005 API Key Management System

export interface CreateCredentialRequest {
  exchangeId: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
  permissions: string[];
  sandboxMode?: boolean;
  ipWhitelist?: string[];
  securityLevel?: SecurityLevel;
}

export interface CreateCredentialResponse {
  credentialId: string;
  validationStatus: KeyValidationStatus;
  riskAssessment: RiskAssessment;
  nextRotation?: Date;
  warnings?: string[];
}

export interface UpdateCredentialRequest {
  credentialId: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  permissions?: string[];
  ipWhitelist?: string[];
  securityLevel?: SecurityLevel;
  rotationPeriod?: number;
}

export interface CredentialSummary {
  credentialId: string;
  exchangeName: string;
  permissions: string[];
  validationStatus: KeyValidationStatus;
  securityLevel: SecurityLevel;
  riskScore: number;
  lastValidated?: Date;
  nextRotation?: Date;
  createdAt: Date;
  isActive: boolean;
}

export interface CredentialDetails extends CredentialSummary {
  usageMetrics: UsageMetrics;
  securityMetrics: SecurityMetrics;
  rotationHistory: RotationHistoryItem[];
  auditSummary: AuditSummary;
}

export interface UsageMetrics {
  totalRequests: number;
  requestsLast24h: number;
  requestsLast7d: number;
  averageRequestsPerDay: number;
  lastUsed?: Date;
  mostUsedEndpoints: EndpointUsage[];
  errorRate: number;
  rateLimitHits: number;
}

export interface EndpointUsage {
  endpoint: string;
  requests: number;
  errors: number;
  averageLatency: number;
  lastUsed: Date;
}

export interface SecurityMetrics {
  accessAttempts: number;
  suspiciousActivities: number;
  ipAddressesUsed: number;
  geographicLocations: string[];
  deviceFingerprints: number;
  anomaliesDetected: number;
  securityAlerts: number;
  lastSecurityIncident?: Date;
}

export interface RotationHistoryItem {
  id: string;
  rotationType: RotationType;
  rotationReason: RotationReason;
  rotationStatus: RotationStatus;
  initiatedAt: Date;
  completedAt?: Date;
  migrationProgress: number;
  errorDetails?: string;
}

export interface AuditSummary {
  totalEvents: number;
  eventsLast24h: number;
  eventsLast7d: number;
  riskDistribution: RiskDistribution;
  topOperations: OperationCount[];
  complianceScore: number;
  lastReviewDate?: Date;
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface OperationCount {
  operation: KeyOperation;
  count: number;
  successRate: number;
}

export interface ValidateCredentialRequest {
  credentialId: string;
  testConnections?: boolean;
  checkPermissions?: boolean;
  updateMetrics?: boolean;
}

export interface ValidationReport {
  credentialId: string;
  exchangeName: string;
  validationStatus: KeyValidationStatus;
  validationTime: Date;
  connectionTests: ConnectionTestResult[];
  permissionTests: PermissionTestResult[];
  performanceMetrics: PerformanceMetrics;
  recommendations: string[];
  warnings: string[];
  errors: string[];
}

export interface ConnectionTestResult {
  testName: string;
  status: 'pass' | 'fail' | 'warning';
  responseTime: number;
  details: string;
  error?: string;
}

export interface PermissionTestResult {
  permission: string;
  granted: boolean;
  tested: boolean;
  scope?: string;
  restrictions?: string[];
  error?: string;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorRate: number;
  rateLimitUtilization: number;
  throughputScore: number;
  reliabilityScore: number;
}

export interface RotateCredentialRequest {
  credentialId: string;
  rotationReason: RotationReason;
  gracePeriodHours?: number;
  backwardCompatible?: boolean;
  newCredentials?: Partial<ExchangeCredentials>;
}

export interface RotationPlan {
  rotationId: string;
  credentialId: string;
  rotationType: RotationType;
  estimatedDuration: number;
  steps: RotationStep[];
  rollbackPlan: RollbackPlan;
  riskAssessment: RiskAssessment;
}

export interface RotationStep {
  stepNumber: number;
  stepName: string;
  description: string;
  estimatedDuration: number;
  dependencies: string[];
  rollbackSupported: boolean;
}

export interface RollbackPlan {
  enabled: boolean;
  deadline: Date;
  steps: RollbackStep[];
  validationChecks: string[];
}

export interface RollbackStep {
  stepNumber: number;
  stepName: string;
  description: string;
  automated: boolean;
}

export interface CredentialFilter {
  exchangeId?: string;
  validationStatus?: KeyValidationStatus;
  securityLevel?: SecurityLevel;
  riskLevel?: RiskLevel;
  isActive?: boolean;
  sandboxMode?: boolean;
  needsRotation?: boolean;
  hasIssues?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface SecurityDashboard {
  totalCredentials: number;
  activeCredentials: number;
  credentialsByStatus: Record<KeyValidationStatus, number>;
  credentialsByRisk: Record<RiskLevel, number>;
  credentialsByExchange: Record<string, number>;
  upcomingRotations: UpcomingRotation[];
  securityAlerts: SecurityAlertSummary[];
  complianceStatus: ComplianceStatus;
  systemHealth: SystemHealthStatus;
}

export interface UpcomingRotation {
  credentialId: string;
  exchangeName: string;
  rotationType: RotationType;
  scheduledDate: Date;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityAlertSummary {
  id: string;
  type: string;
  severity: RiskLevel;
  title: string;
  affectedResources: number;
  createdAt: Date;
  acknowledged: boolean;
}

export interface ComplianceStatus {
  overallScore: number;
  encryptionCompliance: number;
  auditCompliance: number;
  rotationCompliance: number;
  accessControlCompliance: number;
  lastAssessment: Date;
  recommendations: string[];
}

export interface SystemHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  performanceScore: number;
  errorRate: number;
  lastHealthCheck: Date;
  issues: HealthIssue[];
}

export interface HealthIssue {
  type: string;
  severity: RiskLevel;
  description: string;
  affectedComponents: string[];
  recommendedAction: string;
}

// Import from encryption types
import {
  SecurityLevel,
  KeyValidationStatus,
  RiskAssessment,
  KeyOperation,
  RotationType,
  RotationReason,
  RotationStatus,
  ExchangeCredentials,
  RiskLevel
} from './encryption';