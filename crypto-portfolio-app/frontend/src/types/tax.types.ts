/**
 * CP-049: Automated Tax Reporting and Compliance Tools
 * Comprehensive TypeScript definitions for tax calculations, reporting, and compliance
 */

// =============================================================================
// Core Tax Types
// =============================================================================

export type TaxJurisdiction = 
  | 'US'        // United States
  | 'UK'        // United Kingdom  
  | 'CA'        // Canada
  | 'AU'        // Australia
  | 'DE'        // Germany
  | 'NL'        // Netherlands
  | 'FR'        // France
  | 'CH'        // Switzerland
  | 'SG'        // Singapore
  | 'JP';       // Japan

export type AccountingMethod = 
  | 'FIFO'        // First In, First Out (most common)
  | 'LIFO'        // Last In, First Out
  | 'HIFO'        // Highest In, First Out (tax optimized)
  | 'SPECIFIC_ID' // Specific Identification (manual lot selection)
  | 'AVERAGE';    // Average Cost Basis

export type TaxableEventType = 
  | 'capital_gain'     // Sale/disposal for gain
  | 'capital_loss'     // Sale/disposal for loss
  | 'ordinary_income'  // Staking, mining, wages
  | 'interest_income'  // DeFi lending interest
  | 'dividend_income'  // Token dividends
  | 'airdrop_income'   // Free tokens received
  | 'fork_income'      // Hard fork tokens
  | 'gift_received'    // Tokens received as gift
  | 'gift_given'       // Tokens given as gift
  | 'deductible_loss'  // Tax-deductible losses
  | 'business_income'  // Professional trading
  | 'business_expense'; // Business-related costs

export type HoldingPeriod = 'short_term' | 'long_term';

export type TaxFormType = 
  | 'form_8949'     // US: Sales and Other Dispositions of Capital Assets
  | 'schedule_d'    // US: Capital Gains and Losses
  | 'form_1040'     // US: Individual Income Tax Return
  | 'schedule_c'    // US: Business Income/Loss
  | 'form_1099_misc'// US: Miscellaneous Income
  | 'cg_summary'    // UK: Capital Gains Summary
  | 'sa100'         // UK: Self Assessment
  | 't1_general'    // CA: General Income Tax Return
  | 'schedule_3';   // CA: Capital Gains

// =============================================================================
// Tax Configuration and Rates
// =============================================================================

export interface TaxBracket {
  min: number;
  max: number;
  rate: number; // Percentage
}

export interface JurisdictionTaxConfig {
  jurisdiction: TaxJurisdiction;
  currency: string;
  taxYear: number;
  longTermThresholdDays: number; // Days to qualify for long-term treatment
  federal: {
    brackets: TaxBracket[];
    standardDeduction: number;
    capitalGainsRates: {
      shortTerm: TaxBracket[];
      longTerm: TaxBracket[];
    };
  };
  state?: {
    brackets: TaxBracket[];
    standardDeduction?: number;
    capitalGainsRates?: {
      shortTerm: TaxBracket[];
      longTerm: TaxBracket[];
    };
  };
  local?: {
    rate: number;
  };
  deMinimisThreshold?: number; // Minimum reportable amount
  washSaleRuleDays?: number;   // Wash sale rule period
  deductionLimits: {
    capitalLossLimit: number;    // Annual capital loss deduction limit
    businessExpenseLimit?: number;
  };
}

// =============================================================================
// Transaction and Position Types
// =============================================================================

export interface TaxableTransaction {
  id: string;
  date: string;
  type: TaxableEventType;
  asset: string;
  quantity: number;
  price?: number;
  total?: number;
  fees?: number;
  exchangeId?: string;
  walletAddress?: string;
  txHash?: string;
  description?: string;
  costBasis?: number;
  proceeds?: number;
  gainLoss?: number;
  holdingPeriod?: HoldingPeriod;
  washSaleAdjustment?: boolean;
  isBusinessTransaction?: boolean;
  originalTransaction?: string; // Link to original transaction
  relatedTransactions?: string[]; // IDs of related transactions
  taxYear?: number;
  jurisdiction?: TaxJurisdiction;
  accountingMethod?: AccountingMethod;
  notes?: string;
  auditTrail: {
    calculatedAt: string;
    calculationMethod: string;
    assumptionsUsed: string[];
    dataSource: string;
  };
}

export interface TaxLot {
  id: string;
  asset: string;
  acquiredDate: string;
  quantity: number;
  costBasisPerUnit: number;
  totalCostBasis: number;
  source: 'purchase' | 'mining' | 'staking' | 'airdrop' | 'fork' | 'gift';
  exchangeId?: string;
  walletAddress?: string;
  isWashSale?: boolean;
  washSaleDeferred?: number;
  originalTransactionId: string;
}

export interface TaxPosition {
  asset: string;
  totalQuantity: number;
  totalCostBasis: number;
  averageCostBasis: number;
  lots: TaxLot[];
  unrealizedGainLoss: number;
  lastUpdated: string;
}

// =============================================================================
// Tax Calculation Results
// =============================================================================

export interface CapitalGainLoss {
  transactionId: string;
  asset: string;
  disposalDate: string;
  disposalQuantity: number;
  proceeds: number;
  costBasis: number;
  gainLoss: number;
  holdingPeriod: HoldingPeriod;
  accountingMethod: AccountingMethod;
  matchedLots: Array<{
    lotId: string;
    quantity: number;
    costBasisPerUnit: number;
    acquiredDate: string;
  }>;
  washSaleAdjustment?: {
    disallowedLoss: number;
    adjustedCostBasis: number;
    deferredLotId: string;
  };
}

export interface TaxCalculationSummary {
  year: number;
  jurisdiction: TaxJurisdiction;
  accountingMethod: AccountingMethod;
  
  // Capital Gains/Losses
  shortTermGains: number;
  shortTermLosses: number;
  longTermGains: number;
  longTermLosses: number;
  netCapitalGains: number;
  capitalLossCarryforward: number;
  
  // Income
  ordinaryIncome: {
    stakingRewards: number;
    miningRewards: number;
    interestIncome: number;
    airdrops: number;
    forks: number;
    businessIncome: number;
    total: number;
  };
  
  // Deductions
  deductions: {
    transactionFees: number;
    gasFees: number;
    businessExpenses: number;
    professionalFees: number;
    softwareSubscriptions: number;
    total: number;
  };
  
  // Tax Liability
  adjustedGrossIncome: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  localTax: number;
  totalTax: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  
  // Processing Summary
  totalTransactionsProcessed: number;
  transactionsWithGains: number;
  transactionsWithLosses: number;
  unreportableTransactions: number; // Below de minimis
  
  // Audit Information
  calculationDate: string;
  dataCompleteness: number; // Percentage
  assumptionsMade: string[];
  potentialIssues: TaxIssue[];
}

export interface TaxIssue {
  id: string;
  type: 'warning' | 'error' | 'info';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'data_missing' | 'calculation_assumption' | 'compliance_risk' | 'optimization_opportunity';
  message: string;
  description: string;
  affectedTransactions: string[];
  suggestedAction: string;
  potentialImpact: {
    taxLiability: number;
    compliance: string;
  };
  resolution?: {
    action: string;
    completedAt: string;
    notes: string;
  };
}

// =============================================================================
// Tax Optimization
// =============================================================================

export interface LossHarvestingOpportunity {
  id: string;
  asset: string;
  currentPosition: {
    quantity: number;
    costBasis: number;
    currentValue: number;
    unrealizedLoss: number;
  };
  harvestingStrategy: {
    sellQuantity: number;
    realizedLoss: number;
    taxSavings: number;
    repurchaseDate?: string; // After wash sale period
    repurchasePrice?: number;
  };
  washSaleRisk: boolean;
  priority: 'low' | 'medium' | 'high';
  expirationDate?: string; // When opportunity expires
  implementation: {
    steps: string[];
    estimatedCost: number;
    complexity: 'simple' | 'moderate' | 'complex';
  };
}

export interface TaxOptimizationStrategy {
  id: string;
  name: string;
  description: string;
  category: 'loss_harvesting' | 'gain_timing' | 'method_optimization' | 'jurisdiction_planning';
  applicability: {
    jurisdiction: TaxJurisdiction[];
    accountingMethod: AccountingMethod[];
    minimumPortfolioSize: number;
  };
  potentialSavings: {
    currentYear: number;
    futureYears: number;
    probability: number; // 0-1
  };
  implementation: {
    timeframe: 'immediate' | 'end_of_year' | 'next_year' | 'long_term';
    complexity: 'simple' | 'moderate' | 'complex';
    requirements: string[];
    risks: string[];
  };
  trackingMetrics: {
    successCriteria: string[];
    monitoringFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  };
}

export interface TaxProjection {
  year: number;
  scenario: 'conservative' | 'likely' | 'optimistic';
  assumptions: {
    portfolioGrowth: number;
    tradingActivity: 'low' | 'medium' | 'high';
    marketConditions: 'bear' | 'sideways' | 'bull';
    taxLawChanges: boolean;
  };
  projectedResults: {
    capitalGains: number;
    ordinaryIncome: number;
    totalTax: number;
    afterTaxReturns: number;
  };
  optimizationPotential: {
    potentialSavings: number;
    recommendedActions: string[];
    timeToImplement: string;
  };
  confidenceLevel: number; // 0-1
}

// =============================================================================
// Tax Forms and Reporting
// =============================================================================

export interface TaxForm {
  formType: TaxFormType;
  jurisdiction: TaxJurisdiction;
  taxYear: number;
  version: string;
  generatedAt: string;
  status: 'draft' | 'review' | 'final' | 'filed';
  
  metadata: {
    preparerName?: string;
    preparerLicense?: string;
    softwareUsed: string;
    dataSource: string;
    calculationMethod: AccountingMethod;
  };
  
  sections: Array<{
    sectionId: string;
    sectionName: string;
    fields: Array<{
      fieldId: string;
      fieldName: string;
      value: string | number;
      source: 'calculated' | 'manual' | 'imported';
      supportingData?: any;
    }>;
  }>;
  
  supportingSchedules: Array<{
    scheduleType: string;
    transactions: TaxableTransaction[];
    summary: any;
  }>;
  
  auditTrail: {
    dataSnapshot: string; // Hash of underlying data
    calculationLog: string[];
    reviewHistory: Array<{
      reviewedBy: string;
      reviewedAt: string;
      changes: string[];
      approved: boolean;
    }>;
  };
}

export interface TaxReport {
  id: string;
  reportType: 'comprehensive' | 'summary' | 'gains_losses' | 'income' | 'audit_trail';
  jurisdiction: TaxJurisdiction;
  taxYear: number;
  accountingMethod: AccountingMethod;
  generatedAt: string;
  generatedBy: string;
  
  summary: TaxCalculationSummary;
  
  sections: {
    executiveSummary: {
      totalTax: number;
      effectiveRate: number;
      keyInsights: string[];
      importantDates: string[];
    };
    
    capitalGains: {
      summary: any;
      transactions: CapitalGainLoss[];
      lotDetails: TaxLot[];
    };
    
    income: {
      summary: any;
      breakdown: any;
      sources: any;
    };
    
    deductions: {
      summary: any;
      categories: any;
      supportingDocuments: any;
    };
    
    optimization: {
      opportunities: LossHarvestingOpportunity[];
      strategies: TaxOptimizationStrategy[];
      projections: TaxProjection[];
    };
    
    compliance: {
      filingRequirements: string[];
      deadlines: Date[];
      potentialIssues: TaxIssue[];
      recommendations: string[];
    };
  };
  
  appendices: {
    transactionListing: TaxableTransaction[];
    methodologyNotes: string[];
    assumptionsUsed: string[];
    dataQualityReport: any;
  };
  
  export: {
    formats: ('pdf' | 'excel' | 'csv' | 'turbotax' | 'taxact' | 'json')[];
    integrationsAvailable: string[];
  };
}

// =============================================================================
// Tax Software Integration
// =============================================================================

export interface TaxSoftwareIntegration {
  provider: 'turbotax' | 'taxact' | 'hrblock' | 'freetaxusa' | 'taxslayer';
  version: string;
  supportedForms: TaxFormType[];
  importFormat: 'csv' | 'xml' | 'json' | 'api';
  exportCapabilities: {
    directImport: boolean;
    fileExport: boolean;
    apiIntegration: boolean;
  };
  mappingRules: {
    [key: string]: string; // Internal field -> Software field mapping
  };
  validationRules: string[];
  lastTested: string;
  compatibility: {
    minVersion: string;
    maxVersion?: string;
    knownIssues: string[];
  };
}

export interface AuditTrail {
  id: string;
  taxpayerId: string;
  taxYear: number;
  generatedAt: string;
  scope: 'complete' | 'capital_gains' | 'income' | 'deductions';
  
  dataSource: {
    exchanges: string[];
    wallets: string[];
    manualEntries: number;
    importedFiles: string[];
    lastSyncDate: string;
  };
  
  calculationMethodology: {
    accountingMethod: AccountingMethod;
    jurisdiction: TaxJurisdiction;
    assumptionsMade: string[];
    interpretationsUsed: string[];
  };
  
  transactionTrail: Array<{
    transactionId: string;
    originalData: any;
    processedData: any;
    calculationSteps: string[];
    finalClassification: TaxableEventType;
    supportingDocumentation: string[];
  }>;
  
  reviewAndApproval: {
    selfReview: {
      completed: boolean;
      date?: string;
      checklist: Array<{
        item: string;
        verified: boolean;
        notes?: string;
      }>;
    };
    professionalReview?: {
      reviewerName: string;
      reviewerCredentials: string;
      reviewDate: string;
      findings: string[];
      approved: boolean;
      signature?: string;
    };
  };
  
  complianceChecklist: Array<{
    requirement: string;
    met: boolean;
    evidence: string[];
    notes?: string;
  }>;
  
  backupAndRecovery: {
    dataBackupLocation: string;
    calculationBackup: string;
    recoveryTested: boolean;
    retentionPeriod: number; // Years
  };
}

// =============================================================================
// Hooks and Component Props
// =============================================================================

export interface UseTaxCalculationsOptions {
  transactions: TaxableTransaction[];
  year: number;
  jurisdiction: TaxJurisdiction;
  accountingMethod: AccountingMethod;
  autoCalculate?: boolean;
  cacheResults?: boolean;
}

export interface UseTaxCalculationsReturn {
  // State
  isCalculating: boolean;
  isOptimizing: boolean;
  error: string | null;
  
  // Results
  summary: TaxCalculationSummary | null;
  capitalGains: CapitalGainLoss[];
  positions: TaxPosition[];
  issues: TaxIssue[];
  
  // Optimization
  lossHarvestingOpportunities: LossHarvestingOpportunity[];
  optimizationStrategies: TaxOptimizationStrategy[];
  projections: TaxProjection[];
  
  // Actions
  recalculate: () => Promise<void>;
  optimizeForTaxes: () => Promise<void>;
  generateReport: (type: TaxReport['reportType']) => Promise<TaxReport>;
  exportToSoftware: (provider: string) => Promise<any>;
  
  // Utils
  validateData: () => Promise<TaxIssue[]>;
  previewTaxImpact: (transactions: TaxableTransaction[]) => Promise<number>;
}

export interface TaxDashboardProps {
  transactions: TaxableTransaction[];
  defaultYear?: number;
  defaultJurisdiction?: TaxJurisdiction;
  defaultAccountingMethod?: AccountingMethod;
  showOptimization?: boolean;
  onExportReport?: (report: TaxReport) => void;
  onOptimizationApplied?: (strategy: TaxOptimizationStrategy) => void;
}

export interface TaxCalculatorProps {
  transactions: TaxableTransaction[];
  year: number;
  jurisdiction: TaxJurisdiction;
  accountingMethod: AccountingMethod;
  onCalculationComplete?: (summary: TaxCalculationSummary) => void;
  allowMethodChange?: boolean;
  showDetailedBreakdown?: boolean;
}

export interface TaxReportsProps {
  summary: TaxCalculationSummary;
  capitalGains: CapitalGainLoss[];
  year: number;
  jurisdiction: TaxJurisdiction;
  onExport?: (format: string, data: any) => void;
  availableFormats?: string[];
  showAuditTrail?: boolean;
}

export interface TaxOptimizationProps {
  opportunities: LossHarvestingOpportunity[];
  strategies: TaxOptimizationStrategy[];
  projections: TaxProjection[];
  currentSummary: TaxCalculationSummary;
  onApplyStrategy?: (strategy: TaxOptimizationStrategy) => void;
  onScheduleOptimization?: (opportunity: LossHarvestingOpportunity) => void;
}

// =============================================================================
// Service Configurations
// =============================================================================

export interface TaxServiceConfig {
  defaultJurisdiction: TaxJurisdiction;
  defaultAccountingMethod: AccountingMethod;
  cacheTTL: number; // Cache time-to-live in milliseconds
  enableOptimization: boolean;
  enableAuditTrail: boolean;
  dataRetentionYears: number;
  
  jurisdictionSettings: {
    [key in TaxJurisdiction]?: {
      enabled: boolean;
      taxYearEnd: string; // MM-DD format
      filingDeadline: string; // MM-DD format
      supportedMethods: AccountingMethod[];
      requiredForms: TaxFormType[];
    };
  };
  
  integrations: {
    enabled: boolean;
    providers: TaxSoftwareIntegration[];
    apiKeys: { [provider: string]: string };
  };
  
  optimization: {
    enabled: boolean;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    lookAheadDays: number;
    minimumSavings: number;
  };
  
  reporting: {
    defaultFormats: string[];
    includeAuditTrail: boolean;
    professionalReviewRequired: boolean;
    automatedValidation: boolean;
  };
}

// =============================================================================
// Error Types
// =============================================================================

export class TaxCalculationError extends Error {
  constructor(
    message: string,
    public code: string,
    public jurisdiction?: TaxJurisdiction,
    public affectedTransactions?: string[]
  ) {
    super(message);
    this.name = 'TaxCalculationError';
  }
}

export class TaxComplianceError extends Error {
  constructor(
    message: string,
    public requirement: string,
    public jurisdiction: TaxJurisdiction,
    public severity: 'warning' | 'error' | 'critical'
  ) {
    super(message);
    this.name = 'TaxComplianceError';
  }
}

export class TaxDataError extends Error {
  constructor(
    message: string,
    public missingData: string[],
    public affectedCalculations: string[]
  ) {
    super(message);
    this.name = 'TaxDataError';
  }
}

// =============================================================================
// Constants and Defaults
// =============================================================================

export const DEFAULT_TAX_SETTINGS = {
  jurisdiction: 'US' as TaxJurisdiction,
  accountingMethod: 'FIFO' as AccountingMethod,
  year: new Date().getFullYear(),
  includeFees: true,
  enableWashSaleRules: true,
  enableOptimization: true,
  generateAuditTrail: true
};

export const SUPPORTED_JURISDICTIONS: Array<{
  id: TaxJurisdiction;
  name: string;
  currency: string;
  taxYearEnd: string;
  filingDeadline: string;
}> = [
  { id: 'US', name: 'United States', currency: 'USD', taxYearEnd: '12-31', filingDeadline: '04-15' },
  { id: 'UK', name: 'United Kingdom', currency: 'GBP', taxYearEnd: '04-05', filingDeadline: '01-31' },
  { id: 'CA', name: 'Canada', currency: 'CAD', taxYearEnd: '12-31', filingDeadline: '04-30' },
  { id: 'AU', name: 'Australia', currency: 'AUD', taxYearEnd: '06-30', filingDeadline: '10-31' },
  { id: 'DE', name: 'Germany', currency: 'EUR', taxYearEnd: '12-31', filingDeadline: '05-31' },
  { id: 'NL', name: 'Netherlands', currency: 'EUR', taxYearEnd: '12-31', filingDeadline: '04-01' },
  { id: 'FR', name: 'France', currency: 'EUR', taxYearEnd: '12-31', filingDeadline: '05-31' },
  { id: 'CH', name: 'Switzerland', currency: 'CHF', taxYearEnd: '12-31', filingDeadline: '03-31' },
  { id: 'SG', name: 'Singapore', currency: 'SGD', taxYearEnd: '12-31', filingDeadline: '04-15' },
  { id: 'JP', name: 'Japan', currency: 'JPY', taxYearEnd: '12-31', filingDeadline: '03-15' }
];

export const ACCOUNTING_METHODS: Array<{
  id: AccountingMethod;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  bestFor: string[];
}> = [
  {
    id: 'FIFO',
    name: 'First In, First Out',
    description: 'Sells the oldest acquired assets first',
    pros: ['Most widely accepted', 'Simple to understand', 'Good for rising markets'],
    cons: ['May result in higher taxes in bull markets', 'Less flexible'],
    bestFor: ['Beginners', 'Long-term investors', 'Conservative strategies']
  },
  {
    id: 'LIFO',
    name: 'Last In, First Out',
    description: 'Sells the most recently acquired assets first',
    pros: ['May reduce taxes in rising markets', 'Good for active trading'],
    cons: ['Not accepted in all jurisdictions', 'Can be complex'],
    bestFor: ['Active traders', 'Rising market conditions']
  },
  {
    id: 'HIFO',
    name: 'Highest In, First Out',
    description: 'Sells assets with highest cost basis first to maximize losses',
    pros: ['Optimizes for tax reduction', 'Maximizes current deductions'],
    cons: ['Complex to track', 'May not be optimal long-term'],
    bestFor: ['Tax optimization', 'High-frequency traders']
  },
  {
    id: 'SPECIFIC_ID',
    name: 'Specific Identification',
    description: 'Manually select which specific lots to sell',
    pros: ['Maximum control', 'Optimal tax management', 'Flexible strategy'],
    cons: ['Requires detailed record keeping', 'Complex to manage'],
    bestFor: ['Professional traders', 'Advanced users', 'Tax professionals']
  },
  {
    id: 'AVERAGE',
    name: 'Average Cost Basis',
    description: 'Uses average cost of all holdings',
    pros: ['Simple calculation', 'Smooths out volatility'],
    cons: ['Limited jurisdiction support', 'Less tax optimization'],
    bestFor: ['Simple portfolios', 'Some international jurisdictions']
  }
];

export const TAX_EVENT_CATEGORIES = {
  capital_transactions: ['capital_gain', 'capital_loss'],
  income_events: ['ordinary_income', 'interest_income', 'dividend_income', 'airdrop_income', 'fork_income'],
  business_events: ['business_income', 'business_expense'],
  gift_events: ['gift_received', 'gift_given'],
  deduction_events: ['deductible_loss']
};

// =============================================================================
// Export All Types
// =============================================================================

export type {
  // Core types are already exported above
};

export default {
  // Configuration exports
  DEFAULT_TAX_SETTINGS,
  SUPPORTED_JURISDICTIONS,
  ACCOUNTING_METHODS,
  TAX_EVENT_CATEGORIES
};