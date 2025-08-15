// Transaction Categorization and Tagging Types

// Core categorization types
export type CategoryType = 'trading' | 'income' | 'expense' | 'transfer' | 'defi' | 'custom';
export type TaxType = 'capital_gains' | 'income' | 'expense' | 'non_taxable';
export type CategorizationMethod = 'manual' | 'rule_based' | 'pattern_recognition' | 'ml_classifier';
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high';

// Category interface
export interface TransactionCategory {
  id: string;
  name: string;
  description?: string;
  type: CategoryType;
  taxType: TaxType;
  color: string;
  icon?: string;
  isDefault: boolean;
  isActive: boolean;
  parentCategoryId?: string;
  subCategories?: string[];
  rules: CategoryRule[];
  createdAt: string;
  updatedAt: string;
  usage: CategoryUsage;
}

// Category usage statistics
export interface CategoryUsage {
  totalTransactions: number;
  totalAmount: number;
  lastUsed?: string;
  frequency: number;
  averageAmount: number;
  monthlyUsage: { [month: string]: number };
}

// Tag interface
export interface TransactionTag {
  id: string;
  name: string;
  description?: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
  category?: 'tax' | 'personal' | 'business' | 'investment' | 'custom';
  createdAt: string;
  updatedAt: string;
  usage: TagUsage;
}

// Tag usage statistics
export interface TagUsage {
  totalTransactions: number;
  lastUsed?: string;
  frequency: number;
  coUsedTags: { [tagId: string]: number };
}

// Categorization rule types
export interface CategoryRule {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  createdAt: string;
  updatedAt: string;
  usage: RuleUsage;
}

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'array' | 'regex';
  caseSensitive?: boolean;
}

export type ConditionField = 
  | 'asset' 
  | 'type' 
  | 'amount' 
  | 'price' 
  | 'total' 
  | 'fees' 
  | 'exchange' 
  | 'description' 
  | 'notes' 
  | 'timestamp'
  | 'dayOfWeek'
  | 'timeOfDay'
  | 'source';

export type ConditionOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains' 
  | 'starts_with' 
  | 'ends_with'
  | 'greater_than' 
  | 'less_than' 
  | 'between' 
  | 'in' 
  | 'not_in' 
  | 'regex_match'
  | 'is_empty'
  | 'is_not_empty';

export interface RuleAction {
  type: 'assign_category' | 'add_tag' | 'remove_tag' | 'set_tax_type' | 'add_note';
  value: any;
  confidence?: number;
}

export interface RuleUsage {
  matches: number;
  lastMatched?: string;
  successRate: number;
  avgConfidence: number;
}

// Pattern recognition types
export interface TransactionPattern {
  id: string;
  name: string;
  description?: string;
  type: PatternType;
  confidence: number;
  frequency: PatternFrequency;
  features: PatternFeature[];
  examples: PatternExample[];
  suggestedCategory?: string;
  suggestedTags: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  usage: PatternUsage;
}

export type PatternType = 
  | 'recurring_transaction'
  | 'amount_pattern' 
  | 'timing_pattern' 
  | 'exchange_pattern'
  | 'asset_correlation'
  | 'behavioral_pattern';

export type PatternFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'irregular';

export interface PatternFeature {
  name: string;
  type: 'numerical' | 'categorical' | 'temporal' | 'text';
  value: any;
  weight: number;
  description?: string;
}

export interface PatternExample {
  transactionId: string;
  matchScore: number;
  features: { [key: string]: any };
  timestamp: string;
}

export interface PatternUsage {
  matches: number;
  accuracy: number;
  lastMatched?: string;
  falsePositives: number;
  falseNegatives: number;
}

// Machine Learning types
export interface MLModel {
  id: string;
  name: string;
  type: MLModelType;
  version: string;
  status: MLModelStatus;
  accuracy: number;
  trainingData: MLTrainingData;
  features: MLFeature[];
  parameters: MLParameters;
  performance: MLPerformance;
  createdAt: string;
  updatedAt: string;
  lastTrainedAt?: string;
}

export type MLModelType = 
  | 'naive_bayes'
  | 'decision_tree' 
  | 'random_forest' 
  | 'svm' 
  | 'neural_network'
  | 'ensemble';

export type MLModelStatus = 'training' | 'ready' | 'outdated' | 'error';

export interface MLTrainingData {
  totalSamples: number;
  trainingSamples: number;
  testingSamples: number;
  validationSamples: number;
  categories: string[];
  features: string[];
  lastUpdated: string;
}

export interface MLFeature {
  name: string;
  type: 'numerical' | 'categorical' | 'text' | 'boolean';
  importance: number;
  encoding?: string;
  preprocessing?: string[];
}

export interface MLParameters {
  learningRate?: number;
  maxDepth?: number;
  numEstimators?: number;
  regularization?: number;
  [key: string]: any;
}

export interface MLPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix: number[][];
  classificationReport: ClassificationReport;
  crossValidationScores: number[];
}

export interface ClassificationReport {
  [category: string]: {
    precision: number;
    recall: number;
    f1Score: number;
    support: number;
  };
}

// Categorization result types
export interface CategorizationResult {
  transactionId: string;
  suggestions: CategorySuggestion[];
  confidence: number;
  method: CategorizationMethod;
  reasoning: string;
  timestamp: string;
  userAction?: UserCategorizationAction;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasoning: string;
  method: CategorizationMethod;
  tags?: TagSuggestion[];
  taxImplications?: TaxImplication[];
}

export interface TagSuggestion {
  tagId: string;
  tagName: string;
  confidence: number;
  reasoning: string;
}

export interface TaxImplication {
  type: TaxType;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  amount?: number;
}

export interface UserCategorizationAction {
  action: 'accepted' | 'rejected' | 'modified' | 'ignored';
  selectedCategoryId?: string;
  selectedTagIds?: string[];
  feedback?: string;
  timestamp: string;
}

// Extended transaction type with categorization
export interface CategorizedTransaction {
  id: string;
  exchangeId?: string;
  exchangeTransactionId?: string;
  type: string;
  asset: string;
  amount: number;
  price?: number;
  total?: number;
  fees?: number;
  timestamp: string;
  status: string;
  // Categorization fields
  categoryId?: string;
  category?: TransactionCategory;
  tagIds: string[];
  tags: TransactionTag[];
  categorizedAt?: string;
  categorizedBy: CategorizationMethod;
  categorizationConfidence?: number;
  categorizationReasoning?: string;
  taxType?: TaxType;
  isReviewed: boolean;
  userNotes?: string;
  metadata?: CategorizedTransactionMetadata;
}

export interface CategorizedTransactionMetadata {
  originalSuggestions?: CategorySuggestion[];
  patternMatches?: string[];
  ruleMatches?: string[];
  mlPredictions?: MLPrediction[];
  userFeedback?: UserCategorizationAction[];
  lastModified: string;
  modificationHistory: ModificationHistoryEntry[];
}

export interface MLPrediction {
  modelId: string;
  categoryId: string;
  confidence: number;
  features: { [key: string]: any };
  timestamp: string;
}

export interface ModificationHistoryEntry {
  field: string;
  oldValue: any;
  newValue: any;
  method: CategorizationMethod;
  userId?: string;
  timestamp: string;
  reasoning?: string;
}

// Bulk categorization types
export interface BulkCategorizationRequest {
  transactionIds: string[];
  operation: BulkOperation;
  filters?: BulkFilters;
  dryRun?: boolean;
}

export interface BulkOperation {
  type: 'assign_category' | 'add_tags' | 'remove_tags' | 'clear_categorization' | 'apply_rule' | 'merge_categories';
  categoryId?: string;
  tagIds?: string[];
  ruleId?: string;
  force?: boolean;
  preserveExisting?: boolean;
}

export interface BulkFilters {
  dateRange?: { start: string; end: string };
  assets?: string[];
  exchanges?: string[];
  amountRange?: { min: number; max: number };
  categories?: string[];
  tags?: string[];
  uncategorizedOnly?: boolean;
  reviewedOnly?: boolean;
}

export interface BulkCategorizationResult {
  requestId: string;
  totalTransactions: number;
  successfulUpdates: number;
  failedUpdates: number;
  skippedTransactions: number;
  errors: BulkCategorizationError[];
  summary: BulkCategorizationSummary;
  timestamp: string;
}

export interface BulkCategorizationError {
  transactionId: string;
  error: string;
  severity: 'warning' | 'error';
}

export interface BulkCategorizationSummary {
  operationType: string;
  affectedCategories: string[];
  affectedTags: string[];
  estimatedTaxImpact?: number;
  warnings: string[];
}

// Analytics and insights types
export interface CategoryAnalytics {
  timeframe: AnalyticsTimeframe;
  distribution: CategoryDistribution;
  trends: CategoryTrend[];
  insights: CategoryInsight[];
  taxSummary: TaxSummary;
  performance: CategorizationPerformance;
  updatedAt: string;
}

export type AnalyticsTimeframe = 'week' | 'month' | 'quarter' | 'year' | 'all_time' | 'custom';

export interface CategoryDistribution {
  byCategory: { [categoryId: string]: CategoryStats };
  byTaxType: { [taxType: string]: TaxTypeStats };
  byExchange: { [exchange: string]: ExchangeStats };
  byAsset: { [asset: string]: AssetStats };
}

export interface CategoryStats {
  categoryId: string;
  categoryName: string;
  transactionCount: number;
  totalAmount: number;
  percentage: number;
  averageAmount: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
}

export interface TaxTypeStats {
  taxType: TaxType;
  transactionCount: number;
  totalAmount: number;
  estimatedTaxLiability: number;
  categories: string[];
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface ExchangeStats {
  exchange: string;
  categorizedTransactions: number;
  uncategorizedTransactions: number;
  categorizationRate: number;
  topCategories: { categoryId: string; count: number }[];
}

export interface AssetStats {
  asset: string;
  categorizedTransactions: number;
  uncategorizedTransactions: number;
  topCategories: { categoryId: string; count: number }[];
  totalValue: number;
}

export interface CategoryTrend {
  categoryId: string;
  categoryName: string;
  dataPoints: TrendDataPoint[];
  direction: 'up' | 'down' | 'stable';
  changePercentage: number;
  forecast?: TrendDataPoint[];
}

export interface TrendDataPoint {
  date: string;
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
}

export interface CategoryInsight {
  type: InsightType;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  actionable: boolean;
  suggestions?: string[];
  relatedCategories: string[];
  impact: InsightImpact;
}

export type InsightType = 
  | 'unusual_activity'
  | 'categorization_gap'
  | 'tax_optimization'
  | 'pattern_detected'
  | 'accuracy_decline'
  | 'new_trend';

export interface InsightImpact {
  financial?: number;
  tax?: number;
  accuracy?: number;
  efficiency?: number;
}

export interface TaxSummary {
  taxYear: number;
  totalCapitalGains: number;
  totalCapitalLosses: number;
  netCapitalGains: number;
  totalIncome: number;
  totalExpenses: number;
  estimatedTaxLiability: number;
  categorizedPercentage: number;
  uncategorizedValue: number;
  recommendations: TaxRecommendation[];
}

export interface TaxRecommendation {
  type: 'categorization' | 'optimization' | 'compliance';
  description: string;
  impact: number;
  priority: 'low' | 'medium' | 'high';
  actionRequired: boolean;
}

export interface CategorizationPerformance {
  overall: PerformanceMetrics;
  byMethod: { [method: string]: PerformanceMetrics };
  modelPerformance?: MLPerformance;
  improvementSuggestions: string[];
}

export interface PerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  userAcceptanceRate: number;
  avgConfidence: number;
  processingTime: number;
  totalPredictions: number;
  correctPredictions: number;
}

// Import/Export types
export interface CategorizationExport {
  version: string;
  exportedAt: string;
  categories: TransactionCategory[];
  tags: TransactionTag[];
  rules: CategoryRule[];
  patterns?: TransactionPattern[];
  mlModels?: Partial<MLModel>[];
  settings: CategorizationSettings;
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  totalTransactions: number;
  categorizedTransactions: number;
  exportFormat: 'full' | 'categories_only' | 'rules_only' | 'minimal';
  includeUsageStats: boolean;
  includeMLModels: boolean;
  checksums: { [key: string]: string };
}

export interface CategorizationImport {
  source: 'file' | 'url' | 'api';
  format: 'json' | 'csv' | 'excel';
  data: any;
  options: ImportOptions;
}

export interface ImportOptions {
  mergeStrategy: 'overwrite' | 'merge' | 'skip_existing';
  validateData: boolean;
  createBackup: boolean;
  importCategories: boolean;
  importTags: boolean;
  importRules: boolean;
  importPatterns: boolean;
  importMLModels: boolean;
}

export interface ImportResult {
  success: boolean;
  importedCategories: number;
  importedTags: number;
  importedRules: number;
  importedPatterns: number;
  skippedItems: number;
  errors: ImportError[];
  warnings: string[];
  backupId?: string;
}

export interface ImportError {
  item: string;
  error: string;
  line?: number;
  severity: 'warning' | 'error';
  suggestion?: string;
}

// Settings and configuration
export interface CategorizationSettings {
  defaultCategory?: string;
  autoCategorizationEnabled: boolean;
  minConfidenceThreshold: number;
  requireManualReview: boolean;
  enablePatternLearning: boolean;
  enableMLClassification: boolean;
  mlModelType: MLModelType;
  retrainInterval: number; // days
  maxSuggestions: number;
  enableTaxOptimization: boolean;
  taxReportingStandard: 'us' | 'uk' | 'eu' | 'other';
  backupEnabled: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  dataRetentionDays: number;
  debugMode: boolean;
}

// Hook return types
export interface UseCategorizationReturn {
  // State
  categories: TransactionCategory[];
  tags: TransactionTag[];
  rules: CategoryRule[];
  patterns: TransactionPattern[];
  settings: CategorizationSettings;
  isLoading: boolean;
  error: string | null;
  
  // Analytics
  analytics: CategoryAnalytics | null;
  
  // Category management
  createCategory: (category: Omit<TransactionCategory, 'id' | 'createdAt' | 'updatedAt' | 'usage'>) => Promise<TransactionCategory>;
  updateCategory: (id: string, updates: Partial<TransactionCategory>) => Promise<TransactionCategory>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Tag management
  createTag: (tag: Omit<TransactionTag, 'id' | 'createdAt' | 'updatedAt' | 'usage'>) => Promise<TransactionTag>;
  updateTag: (id: string, updates: Partial<TransactionTag>) => Promise<TransactionTag>;
  deleteTag: (id: string) => Promise<void>;
  
  // Rule management
  createRule: (rule: Omit<CategoryRule, 'id' | 'createdAt' | 'updatedAt' | 'usage'>) => Promise<CategoryRule>;
  updateRule: (id: string, updates: Partial<CategoryRule>) => Promise<CategoryRule>;
  deleteRule: (id: string) => Promise<void>;
  
  // Categorization operations
  categorizeTransaction: (transactionId: string, categoryId: string, tagIds?: string[], method?: CategorizationMethod) => Promise<void>;
  getCategorySuggestions: (transactionId: string) => Promise<CategorySuggestion[]>;
  bulkCategorize: (request: BulkCategorizationRequest) => Promise<BulkCategorizationResult>;
  
  // Pattern recognition
  detectPatterns: (transactionIds?: string[]) => Promise<TransactionPattern[]>;
  trainMLModel: (options?: MLTrainingOptions) => Promise<MLModel>;
  
  // Import/Export
  exportData: (options: ExportOptions) => Promise<CategorizationExport>;
  importData: (data: CategorizationImport) => Promise<ImportResult>;
  
  // Settings
  updateSettings: (settings: Partial<CategorizationSettings>) => Promise<void>;
  
  // Analytics
  refreshAnalytics: (timeframe?: AnalyticsTimeframe) => Promise<void>;
  generateInsights: () => Promise<CategoryInsight[]>;
}

export interface MLTrainingOptions {
  modelType?: MLModelType;
  trainingRatio?: number;
  features?: string[];
  hyperparameters?: MLParameters;
  crossValidation?: boolean;
  saveModel?: boolean;
}

export interface ExportOptions {
  format: 'full' | 'categories_only' | 'rules_only' | 'minimal';
  includeUsageStats: boolean;
  includeMLModels: boolean;
  includePatterns: boolean;
  compression?: boolean;
}

// Component prop types
export interface CategoryManagerProps {
  initialTab?: 'categorize' | 'bulk' | 'analytics' | 'rules';
  transactionFilters?: BulkFilters;
  onCategoryChange?: (transactionId: string, categoryId: string) => void;
  onBulkComplete?: (result: BulkCategorizationResult) => void;
}

export interface TransactionCategorizerProps {
  transaction: CategorizedTransaction;
  suggestions?: CategorySuggestion[];
  onCategorize: (categoryId: string, tagIds?: string[]) => void;
  onRequestSuggestions: () => void;
  showConfidence?: boolean;
  allowManualEntry?: boolean;
}

export interface BulkCategorizationProps {
  transactions: CategorizedTransaction[];
  selectedTransactionIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onBulkOperation: (request: BulkCategorizationRequest) => Promise<BulkCategorizationResult>;
  filters: BulkFilters;
  onFiltersChange: (filters: BulkFilters) => void;
}

export interface CategoryAnalyticsProps {
  analytics: CategoryAnalytics;
  timeframe: AnalyticsTimeframe;
  onTimeframeChange: (timeframe: AnalyticsTimeframe) => void;
  onRefresh: () => void;
  showTaxInsights?: boolean;
  showPatternInsights?: boolean;
}

// Default categories for initialization
export const DEFAULT_CATEGORIES: Omit<TransactionCategory, 'id' | 'createdAt' | 'updatedAt' | 'usage' | 'rules'>[] = [
  {
    name: 'Trading',
    description: 'Buy/sell transactions for capital gains',
    type: 'trading',
    taxType: 'capital_gains',
    color: '#3B82F6',
    icon: 'TrendingUp',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Staking Rewards',
    description: 'Income from staking cryptocurrencies',
    type: 'income',
    taxType: 'income',
    color: '#10B981',
    icon: 'Award',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Mining',
    description: 'Income from cryptocurrency mining',
    type: 'income',
    taxType: 'income',
    color: '#8B5CF6',
    icon: 'Cpu',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Airdrops',
    description: 'Free tokens received from airdrops',
    type: 'income',
    taxType: 'income',
    color: '#06B6D4',
    icon: 'Gift',
    isDefault: true,
    isActive: true
  },
  {
    name: 'DeFi',
    description: 'Decentralized finance activities',
    type: 'defi',
    taxType: 'capital_gains',
    color: '#F59E0B',
    icon: 'Zap',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Transaction Fees',
    description: 'Network and exchange fees',
    type: 'expense',
    taxType: 'expense',
    color: '#EF4444',
    icon: 'CreditCard',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Transfers',
    description: 'Moving funds between wallets/exchanges',
    type: 'transfer',
    taxType: 'non_taxable',
    color: '#6B7280',
    icon: 'ArrowRightLeft',
    isDefault: true,
    isActive: true
  }
];

export const DEFAULT_TAGS: Omit<TransactionTag, 'id' | 'createdAt' | 'updatedAt' | 'usage'>[] = [
  {
    name: 'High Priority',
    description: 'Important transactions requiring attention',
    color: '#EF4444',
    category: 'personal',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Tax Deductible',
    description: 'Potentially tax-deductible expenses',
    color: '#10B981',
    category: 'tax',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Business',
    description: 'Business-related transactions',
    color: '#3B82F6',
    category: 'business',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Long Term',
    description: 'Long-term investment transactions',
    color: '#8B5CF6',
    category: 'investment',
    isDefault: true,
    isActive: true
  },
  {
    name: 'Short Term',
    description: 'Short-term trading transactions',
    color: '#F59E0B',
    category: 'investment',
    isDefault: true,
    isActive: true
  }
];