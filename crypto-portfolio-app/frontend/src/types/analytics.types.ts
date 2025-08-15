/**
 * CP-050: Advanced Portfolio Analytics and Insights Engine Types
 * Comprehensive TypeScript definitions for portfolio analytics, performance metrics,
 * risk analysis, attribution modeling, and AI-powered insights
 */

// Core Analytics Types
export interface PortfolioAnalytics {
  // Summary Metrics
  totalValue: number;
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  
  // Detailed Analysis
  performanceMetrics: PerformanceMetrics;
  riskMetrics: RiskMetrics;
  attributionAnalysis: AttributionAnalysis;
  sectorAnalysis: SectorAnalysis;
  correlationAnalysis: CorrelationAnalysis;
  
  // AI-Generated Content
  insights: AnalyticsInsight[];
  optimizationSuggestions: OptimizationSuggestion[];
  
  // Time Series Data
  timeSeries: TimeSeriesData[];
  
  // Metadata
  timeframe: TimeframeOption;
  calculatedAt: string;
  dataQuality: DataQualityAssessment;
}

// Performance Metrics
export interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  cagr: number; // Compound Annual Growth Rate
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  alpha: number;
  beta: number;
  rSquared: number;
  trackingError: number;
  informationRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number; // in days
  upCaptureRatio: number;
  downCaptureRatio: number;
  winRate: number; // percentage of positive periods
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  
  // Risk-Adjusted Returns
  riskAdjustedReturn: number;
  valueAtRisk: VaRMetrics;
  conditionalVaR: VaRMetrics;
  
  // Time-Based Metrics
  returns: {
    daily: number[];
    monthly: number[];
    quarterly: number[];
    yearly: number[];
  };
  
  // Benchmark Comparison
  benchmarkComparison: BenchmarkComparison;
}

export interface VaRMetrics {
  oneDay: {
    confidence95: number;
    confidence99: number;
    confidence99_9: number;
  };
  oneWeek: {
    confidence95: number;
    confidence99: number;
    confidence99_9: number;
  };
  oneMonth: {
    confidence95: number;
    confidence99: number;
    confidence99_9: number;
  };
  methodology: 'historical' | 'parametric' | 'monte_carlo';
}

export interface BenchmarkComparison {
  benchmark: BenchmarkData;
  relativeName: string;
  relativeReturn: number;
  trackingError: number;
  informationRatio: number;
  upCaptureRatio: number;
  downCaptureRatio: number;
  beta: number;
  alpha: number;
  correlation: number;
  timeSeries: TimeSeriesComparison[];
}

export interface BenchmarkData {
  id: string;
  name: string;
  symbol: string;
  description: string;
  category: 'crypto_index' | 'traditional_index' | 'sector_index' | 'custom';
  returns: {
    daily: number[];
    total: number;
    annualized: number;
  };
}

export interface TimeSeriesComparison {
  date: string;
  portfolioValue: number;
  benchmarkValue: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  relativeReturn: number;
  rollingAlpha: number;
  rollingBeta: number;
}

// Risk Analysis
export interface RiskMetrics {
  volatility: number;
  downVolatility: number; // downside deviation
  beta: number;
  valueAtRisk: VaRMetrics;
  conditionalValueAtRisk: VaRMetrics;
  maxDrawdown: number;
  maxDrawdownDate: string;
  drawdownDuration: number;
  correlationRisk: number;
  concentrationRisk: number;
  liquidityRisk: LiquidityRisk;
  
  // Stress Testing
  stressTestResults: StressTestResult[];
  scenarioAnalysis: ScenarioAnalysisResult[];
  
  // Advanced Risk Metrics
  skewness: number;
  kurtosis: number;
  tailRisk: number;
  leftTailExpectation: number;
  rightTailExpectation: number;
  
  // Correlation Analysis
  correlationMatrix: CorrelationMatrix;
  diversificationRatio: number;
}

export interface LiquidityRisk {
  averageDailyVolume: Map<string, number>;
  liquidityScore: number; // 0-100
  liquidityWarnings: LiquidityWarning[];
  illiquidAssets: string[]; // assets with low liquidity
  estimatedLiquidationTime: number; // days to liquidate full position
}

export interface LiquidityWarning {
  asset: string;
  severity: 'low' | 'medium' | 'high';
  issue: string;
  impact: string;
}

export interface StressTestResult {
  scenario: string;
  description: string;
  portfolioImpact: number; // percentage change
  worstAsset: string;
  bestAsset: string;
  recoveryTimeEstimate: number; // days
  probability: number; // 0-1
  severity: 'low' | 'medium' | 'high' | 'extreme';
}

export interface ScenarioAnalysisResult {
  name: string;
  description: string;
  probability: number;
  expectedReturn: number;
  portfolioValue: number;
  impactByAsset: Map<string, number>;
  hedgingStrategies: string[];
}

export interface CorrelationMatrix {
  matrix: Map<string, Map<string, number>>;
  averageCorrelation: number;
  highestCorrelations: CorrelationPair[];
  lowestCorrelations: CorrelationPair[];
  clusterAnalysis: CorrelationCluster[];
}

export interface CorrelationPair {
  asset1: string;
  asset2: string;
  correlation: number;
  significance: number; // statistical significance
  timeStability: number; // how stable the correlation is over time
}

export interface CorrelationCluster {
  assets: string[];
  averageIntraClusterCorrelation: number;
  clusterRisk: number;
  diversificationBenefit: number;
}

// Attribution Analysis
export interface AttributionAnalysis {
  byAsset: Map<string, AssetAttribution>;
  byTimeperiod: Map<string, PeriodAttribution>;
  byStrategy: Map<string, StrategyAttribution>;
  bySector: Map<string, SectorAttribution>;
  byGeography: Map<string, GeographyAttribution>;
  
  // Performance Decomposition
  totalReturn: number;
  selectionEffect: number;
  allocationEffect: number;
  interactionEffect: number;
  currencyEffect?: number;
  
  // Risk Attribution
  riskContribution: Map<string, RiskContribution>;
  marginalRiskContribution: Map<string, number>;
  componentRiskContribution: Map<string, number>;
}

export interface AssetAttribution {
  asset: string;
  weight: number;
  returns: number;
  contribution: number;
  alpha: number;
  beta: number;
  residualReturn: number;
  specificRisk: number;
  systematicRisk: number;
  informationRatio: number;
  trackingError: number;
}

export interface PeriodAttribution {
  period: string;
  startDate: string;
  endDate: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  activeReturn: number;
  attribution: number;
  majorEvents: AttributionEvent[];
}

export interface StrategyAttribution {
  strategy: string;
  description: string;
  allocation: number;
  returns: number;
  contribution: number;
  riskContribution: number;
  sharpeRatio: number;
}

export interface SectorAttribution {
  sector: string;
  weight: number;
  benchmarkWeight: number;
  overUnderWeight: number;
  sectorReturn: number;
  portfolioSectorReturn: number;
  selectionEffect: number;
  allocationEffect: number;
  totalEffect: number;
}

export interface GeographyAttribution {
  region: string;
  weight: number;
  returns: number;
  contribution: number;
  currencyImpact?: number;
  politicalRisk: number;
  economicRisk: number;
}

export interface AttributionEvent {
  date: string;
  event: string;
  impact: number;
  assets: string[];
  category: 'market' | 'crypto_specific' | 'regulatory' | 'technical' | 'fundamental';
}

export interface RiskContribution {
  asset: string;
  marginalContribution: number;
  componentContribution: number;
  percentageContribution: number;
  diversificationBenefit: number;
}

// Sector Analysis
export interface SectorAnalysis {
  allocation: Map<string, SectorAllocation>;
  diversificationScore: number;
  recommendations: SectorRecommendation[];
  benchmarkComparison: SectorBenchmarkComparison;
  trends: SectorTrend[];
  correlationAnalysis: SectorCorrelationAnalysis;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
  assets: PortfolioAsset[];
  performance: SectorPerformance;
  risk: SectorRisk;
}

export interface SectorPerformance {
  returns: {
    oneDay: number;
    oneWeek: number;
    oneMonth: number;
    threeMonth: number;
    oneYear: number;
    ytd: number;
  };
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface SectorRisk {
  beta: number;
  correlation: number;
  valueAtRisk: number;
  liquidityRisk: number;
  concentrationRisk: number;
  regulatoryRisk: 'low' | 'medium' | 'high';
}

export interface SectorRecommendation {
  type: 'warning' | 'suggestion' | 'opportunity';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  priority: number; // 1-10
  actionable: boolean;
  estimatedBenefit?: number;
}

export interface SectorBenchmarkComparison {
  overweightSectors: string[];
  underweightSectors: string[];
  neutralSectors: string[];
  activeWeights: Map<string, number>;
  tiltAnalysis: SectorTiltAnalysis;
}

export interface SectorTiltAnalysis {
  growthTilt: number; // -1 to 1
  valueTilt: number; // -1 to 1
  sizeTilt: number; // -1 to 1 (small cap to large cap)
  qualityTilt: number; // -1 to 1
  momentumTilt: number; // -1 to 1
}

export interface SectorTrend {
  sector: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-1
  timeHorizon: 'short' | 'medium' | 'long';
  catalysts: string[];
  risks: string[];
}

export interface SectorCorrelationAnalysis {
  intraSectorCorrelation: Map<string, number>;
  interSectorCorrelation: Map<string, Map<string, number>>;
  sectorBeta: Map<string, number>;
  diversificationBenefit: number;
}

// AI Insights
export interface AnalyticsInsight {
  id: string;
  type: 'performance' | 'risk' | 'allocation' | 'market' | 'tax' | 'rebalancing';
  severity: 'info' | 'warning' | 'critical' | 'opportunity';
  title: string;
  description: string;
  detailedAnalysis: string;
  confidence: number; // 0-1
  impact: InsightImpact;
  actionableRecommendations: ActionableRecommendation[];
  supportingData: any;
  generatedAt: string;
  expiresAt?: string;
  tags: string[];
}

export interface InsightImpact {
  financial: number; // estimated financial impact in USD
  risk: number; // risk impact on scale of -1 to 1
  time: number; // time impact in days
  complexity: 'simple' | 'moderate' | 'complex';
  reversibility: 'reversible' | 'partially_reversible' | 'irreversible';
}

export interface ActionableRecommendation {
  action: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  estimatedBenefit: number;
  estimatedCost: number;
  timeframe: string;
  riskLevel: 'low' | 'medium' | 'high';
  requirements: string[];
  steps: RecommendationStep[];
}

export interface RecommendationStep {
  order: number;
  description: string;
  estimatedTime: number; // minutes
  required: boolean;
  automatable: boolean;
}

// Optimization
export interface OptimizationSuggestion {
  id: string;
  type: 'rebalancing' | 'tax_optimization' | 'risk_reduction' | 'return_enhancement';
  title: string;
  description: string;
  methodology: 'mpt' | 'black_litterman' | 'risk_parity' | 'equal_weight' | 'momentum' | 'mean_reversion';
  
  // Current vs Proposed Allocation
  currentAllocation: Map<string, number>;
  proposedAllocation: Map<string, number>;
  allocationChanges: Map<string, AllocationChange>;
  
  // Expected Impact
  expectedReturn: number;
  expectedRisk: number;
  expectedSharpe: number;
  riskReduction: number;
  returnEnhancement: number;
  
  // Implementation Details
  transactions: OptimizationTransaction[];
  estimatedCosts: OptimizationCosts;
  implementation: OptimizationImplementation;
  
  // Confidence and Risk
  confidence: number; // 0-1
  sensitivity: SensitivityAnalysis;
  constraints: OptimizationConstraint[];
}

export interface AllocationChange {
  asset: string;
  currentWeight: number;
  proposedWeight: number;
  change: number;
  changeType: 'buy' | 'sell' | 'hold';
  reasoning: string;
}

export interface OptimizationTransaction {
  action: 'buy' | 'sell';
  asset: string;
  quantity: number;
  estimatedPrice: number;
  estimatedValue: number;
  timing: 'immediate' | 'gradual' | 'opportunistic';
  priority: number;
}

export interface OptimizationCosts {
  tradingFees: number;
  spread: number;
  marketImpact: number;
  taxImplications: number;
  opportunityCost: number;
  totalCost: number;
}

export interface OptimizationImplementation {
  strategy: 'immediate' | 'gradual' | 'conditional';
  timeframe: string;
  phases: ImplementationPhase[];
  monitoringRequirements: string[];
  exitCriteria: string[];
}

export interface ImplementationPhase {
  phase: number;
  description: string;
  transactions: OptimizationTransaction[];
  expectedDuration: number; // days
  successCriteria: string[];
  riskMitigation: string[];
}

export interface SensitivityAnalysis {
  returnSensitivity: Map<string, number>; // sensitivity to asset return changes
  volatilitySensitivity: Map<string, number>; // sensitivity to volatility changes
  correlationSensitivity: number; // sensitivity to correlation changes
  robustness: number; // 0-1, how robust the optimization is to parameter changes
}

export interface OptimizationConstraint {
  type: 'weight' | 'turnover' | 'sector' | 'risk' | 'return' | 'custom';
  description: string;
  value: number;
  operator: '>' | '<' | '=' | '>=' | '<=';
  violationPenalty: number;
}

// Time Series and Data
export interface TimeSeriesData {
  date: string;
  value: number;
  returns: number;
  cumulativeReturns: number;
  drawdown: number;
  volatility: number; // rolling volatility
  volume?: number;
  transactions: PortfolioTransaction[];
  
  // Intraday data (if available)
  intraday?: IntradayData[];
  
  // Market context
  marketContext: MarketContext;
}

export interface IntradayData {
  timestamp: string;
  value: number;
  volume?: number;
}

export interface MarketContext {
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  volatilityRegime: 'low' | 'medium' | 'high';
  trendDirection: 'up' | 'down' | 'sideways';
  majorEvents: string[];
  economicIndicators: Map<string, number>;
}

export interface PortfolioTransaction {
  id: string;
  timestamp: string;
  type: 'buy' | 'sell' | 'transfer' | 'staking' | 'rewards';
  asset: string;
  quantity: number;
  price: number;
  value: number;
  fees: number;
  exchange: string;
  category: string;
}

export interface PortfolioAsset {
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  value: number;
  percentage: number;
  averageCostBasis: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  sector: string;
  marketCap?: number;
  volume24h?: number;
}

// Data Quality
export interface DataQualityAssessment {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues: DataQualityIssue[];
  completeness: DataCompleteness;
  accuracy: DataAccuracy;
  timeliness: DataTimeliness;
  consistency: DataConsistency;
}

export interface DataQualityIssue {
  type: 'missing' | 'inconsistent' | 'outdated' | 'invalid';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedFields: string[];
  impact: string;
  recommendation: string;
}

export interface DataCompleteness {
  transactionData: number; // 0-100
  priceData: number; // 0-100
  volumeData: number; // 0-100
  fundamentalData: number; // 0-100
  overallScore: number; // 0-100
}

export interface DataAccuracy {
  priceAccuracy: number; // 0-100
  volumeAccuracy: number; // 0-100
  transactionAccuracy: number; // 0-100
  overallScore: number; // 0-100
}

export interface DataTimeliness {
  lastUpdated: string;
  updateFrequency: number; // minutes
  staleness: number; // minutes since last update
  isTimely: boolean;
}

export interface DataConsistency {
  internalConsistency: number; // 0-100
  externalConsistency: number; // 0-100 (against external sources)
  overallScore: number; // 0-100
}

// UI Component Types
export interface AnalyticsDashboardProps {
  portfolioData: PortfolioData;
  transactions: PortfolioTransaction[];
  timeframe?: TimeframeOption;
  showOptimization?: boolean;
  showInsights?: boolean;
  showBenchmarks?: boolean;
  onOptimizationApplied?: (suggestion: OptimizationSuggestion) => void;
  onInsightAction?: (action: string, insight: AnalyticsInsight) => void;
  onExportReport?: (report: AnalyticsReport) => void;
}

export interface PortfolioData {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  assets: PortfolioAsset[];
  lastUpdated: string;
}

export type TimeframeOption = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | '2Y' | '5Y' | 'ALL';

export type ComparisonMode = 'benchmark' | 'peer' | 'sector' | 'custom';

// Hook Options and Returns
export interface UsePortfolioAnalyticsOptions {
  portfolioData: PortfolioData;
  transactions: PortfolioTransaction[];
  timeframe: TimeframeOption;
  enableRealTime?: boolean;
  cacheResults?: boolean;
  benchmarks?: string[];
}

export interface UsePortfolioAnalyticsReturn {
  analytics: PortfolioAnalytics | null;
  isLoading: boolean;
  error: string | null;
  refreshAnalytics: () => Promise<void>;
  exportAnalytics: (format: 'pdf' | 'excel' | 'csv') => Promise<void>;
  clearCache: () => void;
}

export interface UsePerformanceMetricsOptions {
  portfolioData: PortfolioData;
  transactions: PortfolioTransaction[];
  timeframe: TimeframeOption;
  benchmarks?: BenchmarkData[];
  riskFreeRate?: number;
}

export interface UsePerformanceMetricsReturn {
  performanceMetrics: PerformanceMetrics | null;
  returns: number[];
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  isCalculating: boolean;
  recalculate: () => Promise<void>;
}

export interface UseRiskAnalysisOptions {
  portfolioData: PortfolioData;
  transactions: PortfolioTransaction[];
  timeframe: TimeframeOption;
  confidenceLevels?: number[];
  stressTestScenarios?: string[];
}

export interface UseRiskAnalysisReturn {
  riskMetrics: RiskMetrics | null;
  correlationMatrix: CorrelationMatrix | null;
  varAnalysis: VaRMetrics | null;
  stressTests: StressTestResult[];
  isAnalyzing: boolean;
  runStressTest: (scenario: string) => Promise<StressTestResult>;
}

export interface UseBenchmarkDataOptions {
  benchmarks: string[];
  timeframe: TimeframeOption;
  autoRefresh?: boolean;
}

export interface UseBenchmarkDataReturn {
  benchmarkData: Map<string, BenchmarkData>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Export Report Types
export interface AnalyticsReport {
  id: string;
  title: string;
  generatedAt: string;
  timeframe: TimeframeOption;
  portfolioData: PortfolioData;
  analytics: PortfolioAnalytics;
  
  sections: {
    executiveSummary: ReportSection;
    performanceAnalysis: ReportSection;
    riskAssessment: ReportSection;
    attribution: ReportSection;
    optimization: ReportSection;
    insights: ReportSection;
  };
  
  appendices: {
    methodology: string[];
    assumptions: string[];
    dataQuality: DataQualityAssessment;
    definitions: Map<string, string>;
  };
  
  exportFormats: ('pdf' | 'excel' | 'csv' | 'json')[];
}

export interface ReportSection {
  title: string;
  summary: string;
  charts: ChartConfig[];
  tables: TableConfig[];
  insights: string[];
  data: any;
}

export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area' | 'candlestick' | 'heatmap';
  title: string;
  data: any;
  options: any;
}

export interface TableConfig {
  title: string;
  columns: TableColumn[];
  data: any[];
  options: TableOptions;
}

export interface TableColumn {
  key: string;
  label: string;
  type: 'string' | 'number' | 'percentage' | 'currency' | 'date';
  format?: string;
  sortable?: boolean;
}

export interface TableOptions {
  sortable: boolean;
  filterable: boolean;
  paginated: boolean;
  pageSize: number;
  exportable: boolean;
}

// Constants and Enums
export const SUPPORTED_BENCHMARKS = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    description: 'Bitcoin as benchmark',
    category: 'crypto_index' as const
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    description: 'Ethereum as benchmark',
    category: 'crypto_index' as const
  },
  {
    id: 'total_crypto',
    name: 'Total Crypto Market Cap',
    symbol: 'TOTALCAP',
    description: 'Total cryptocurrency market capitalization',
    category: 'crypto_index' as const
  },
  {
    id: 'defi_pulse',
    name: 'DeFi Pulse Index',
    symbol: 'DPI',
    description: 'DeFi Pulse Index',
    category: 'sector_index' as const
  },
  {
    id: 'sp500',
    name: 'S&P 500',
    symbol: 'SPY',
    description: 'S&P 500 Index',
    category: 'traditional_index' as const
  },
  {
    id: 'nasdaq',
    name: 'NASDAQ-100',
    symbol: 'QQQ',
    description: 'NASDAQ-100 Index',
    category: 'traditional_index' as const
  },
  {
    id: 'gold',
    name: 'Gold',
    symbol: 'GLD',
    description: 'Gold as store of value',
    category: 'traditional_index' as const
  }
] as const;

export const CRYPTO_SECTORS = [
  'Store of Value',
  'Smart Contracts',
  'DeFi',
  'Layer 1',
  'Layer 2',
  'Exchange Tokens',
  'Stablecoins',
  'Oracles',
  'Interoperability',
  'Privacy',
  'Gaming',
  'NFTs',
  'Metaverse',
  'Web3',
  'Infrastructure',
  'Other'
] as const;

export const TIMEFRAME_OPTIONS: { id: TimeframeOption; label: string; days: number }[] = [
  { id: '1D', label: '1 Day', days: 1 },
  { id: '1W', label: '1 Week', days: 7 },
  { id: '1M', label: '1 Month', days: 30 },
  { id: '3M', label: '3 Months', days: 90 },
  { id: '6M', label: '6 Months', days: 180 },
  { id: '1Y', label: '1 Year', days: 365 },
  { id: '2Y', label: '2 Years', days: 730 },
  { id: '5Y', label: '5 Years', days: 1825 },
  { id: 'ALL', label: 'All Time', days: -1 }
];

export const DEFAULT_ANALYTICS_SETTINGS = {
  timeframe: '1Y' as TimeframeOption,
  benchmark: 'btc',
  confidenceLevel: 95,
  riskFreeRate: 0.02, // 2%
  rebalancingThreshold: 0.05, // 5%
  enableRealTime: false,
  cacheResults: true
} as const;

export const RISK_TOLERANCE_LEVELS = [
  { id: 'conservative', label: 'Conservative', maxVolatility: 0.15, maxDrawdown: 0.10 },
  { id: 'moderate', label: 'Moderate', maxVolatility: 0.25, maxDrawdown: 0.20 },
  { id: 'aggressive', label: 'Aggressive', maxVolatility: 0.40, maxDrawdown: 0.35 },
  { id: 'speculative', label: 'Speculative', maxVolatility: 1.0, maxDrawdown: 0.70 }
] as const;

export type RiskToleranceLevel = typeof RISK_TOLERANCE_LEVELS[number]['id'];
export type CryptoSector = typeof CRYPTO_SECTORS[number];
export type SupportedBenchmark = typeof SUPPORTED_BENCHMARKS[number]['id'];

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AnalyticsFilter<T> = {
  [K in keyof T]?: T[K] | ((value: T[K]) => boolean);
};

export type SortConfig<T> = {
  key: keyof T;
  direction: 'asc' | 'desc';
};

export type PaginationConfig = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

// Error Types
export class AnalyticsError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AnalyticsError';
  }
}

export class InsufficientDataError extends AnalyticsError {
  constructor(message: string, public minimumRequired: number, public actual: number) {
    super(message, 'INSUFFICIENT_DATA', { minimumRequired, actual });
  }
}

export class CalculationError extends AnalyticsError {
  constructor(message: string, public calculation: string, public input?: any) {
    super(message, 'CALCULATION_ERROR', { calculation, input });
  }
}

export class BenchmarkError extends AnalyticsError {
  constructor(message: string, public benchmark: string) {
    super(message, 'BENCHMARK_ERROR', { benchmark });
  }
}

// Export all types
export type {
  PortfolioAnalytics,
  PerformanceMetrics,
  RiskMetrics,
  AttributionAnalysis,
  SectorAnalysis,
  CorrelationAnalysis,
  AnalyticsInsight,
  OptimizationSuggestion,
  TimeSeriesData,
  BenchmarkComparison,
  DataQualityAssessment
};