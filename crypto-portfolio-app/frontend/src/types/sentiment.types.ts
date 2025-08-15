// Sentiment Analysis Type Definitions
export interface SentimentScore {
  score: number; // -1 to 1 range, where -1 is very bearish, 1 is very bullish
  confidence: number; // 0 to 1, confidence in the sentiment score
  magnitude?: number; // 0 to 1, strength of sentiment regardless of polarity
}

export interface SentimentSource {
  name: string;
  score: number;
  confidence: number;
  weight?: number;
  lastUpdated: string;
  metadata?: Record<string, any>;
}

export interface AggregatedSentiment extends SentimentScore {
  sources: SentimentSource[];
  insights: SentimentInsight[];
  trend: 'bullish' | 'bearish' | 'neutral';
  volatility: number;
}

export interface SentimentInsight {
  icon: string;
  text: string;
  impact: 'low' | 'medium' | 'high';
  type: 'positive' | 'negative' | 'neutral';
  source?: string;
  confidence: number;
}

// Fear & Greed Index
export interface FearGreedIndex {
  value: number; // 0 to 100
  label: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  components: FearGreedComponent[];
  lastUpdated: string;
  trend: number; // Change from previous period
  historicalAverage?: number;
}

export interface FearGreedComponent {
  name: string;
  value: number; // 0 to 100
  weight: number; // Percentage weight in final calculation
  description?: string;
  trend?: number;
}

// Historical Data
export interface SentimentHistoryPoint {
  date: string;
  sentiment: number;
  fearGreed: number;
  volume?: number;
  price?: number;
  sources: {
    news: number;
    social: number;
    onChain: number;
  };
}

export interface SentimentHistory {
  data: SentimentHistoryPoint[];
  timeframe: string;
  symbol: string;
  correlations?: {
    priceCorrelation: number;
    volumeCorrelation: number;
  };
}

// News Sentiment
export interface NewsSentiment extends SentimentScore {
  articleCount: number;
  sources: string[];
  topHeadlines: NewsHeadline[];
  sourceBreakdown: Record<string, SentimentScore>;
}

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  sentiment: SentimentScore;
  relevance: number;
  summary?: string;
}

// Social Media Sentiment
export interface SocialSentiment extends SentimentScore {
  platforms: {
    twitter: TwitterSentiment;
    reddit: RedditSentiment;
    discord?: DiscordSentiment;
  };
  overallMentions: number;
  trendingTopics: string[];
  influencerSentiment?: InfluencerSentiment[];
}

export interface TwitterSentiment extends SentimentScore {
  mentionCount: number;
  engagementRate: number;
  retweetRatio: number;
  topTweets: Tweet[];
  hashtagSentiment: Record<string, SentimentScore>;
}

export interface Tweet {
  id: string;
  text: string;
  author: string;
  authorFollowers: number;
  createdAt: string;
  sentiment: SentimentScore;
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface RedditSentiment extends SentimentScore {
  postCount: number;
  commentCount: number;
  upvoteRatio: number;
  topPosts: RedditPost[];
  subredditBreakdown: Record<string, SentimentScore>;
}

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  author: string;
  createdAt: string;
  sentiment: SentimentScore;
  engagement: {
    upvotes: number;
    downvotes: number;
    comments: number;
    awards: number;
  };
}

export interface DiscordSentiment extends SentimentScore {
  messageCount: number;
  serverCount: number;
  activeUsers: number;
}

export interface InfluencerSentiment {
  name: string;
  platform: string;
  followers: number;
  sentiment: SentimentScore;
  influence: number; // Weighted impact on overall sentiment
  recentPosts: number;
}

// On-Chain Sentiment
export interface OnChainSentiment extends SentimentScore {
  metrics: OnChainMetrics;
  indicators: OnChainIndicator[];
  whaleActivity: WhaleActivity;
  exchangeFlows: ExchangeFlows;
  networkHealth: NetworkHealth;
}

export interface OnChainMetrics {
  activeAddresses: number;
  activeAddressesTrend: number;
  transactionVolume: number;
  transactionVolumeUSD: number;
  networkHashRate?: number;
  averageTransactionFee: number;
  mvrv: number; // Market Value to Realized Value
  nvt: number; // Network Value to Transactions
  hodlWaves: HodlWave[];
}

export interface OnChainIndicator {
  name: string;
  value: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0 to 1
  description: string;
}

export interface WhaleActivity {
  largeTransactions: number;
  whaleNetFlow: number;
  topHolderConcentration: number;
  accumulationTrend: number;
  distributionTrend: number;
}

export interface ExchangeFlows {
  inflow: number;
  outflow: number;
  netFlow: number;
  inflowTrend: number;
  outflowTrend: number;
  exchangeReserves: number;
  reservesTrend: number;
}

export interface NetworkHealth {
  hashRate: number;
  difficulty: number;
  blockTime: number;
  mempool: number;
  feesPressure: number;
}

export interface HodlWave {
  ageRange: string;
  percentage: number;
  trend: number;
}

// Sentiment Alerts
export interface SentimentAlert {
  id: string;
  name: string;
  symbol: string;
  type: 'sentiment' | 'fearGreed' | 'social' | 'onChain';
  condition: AlertCondition;
  isActive: boolean;
  triggeredAt?: string;
  createdAt: string;
  userId: string;
}

export interface AlertCondition {
  metric: string;
  operator: 'above' | 'below' | 'equals' | 'crosses_above' | 'crosses_below';
  value: number;
  timeframe?: string;
  cooldown?: number; // Minutes before alert can trigger again
}

export interface TriggeredAlert extends SentimentAlert {
  triggeredValue: number;
  message: string;
  triggeredAt: string;
}

// Correlation Analysis
export interface SentimentCorrelation {
  symbol: string;
  timeframe: string;
  correlations: {
    sentimentToPrice: CorrelationData;
    sentimentToVolume: CorrelationData;
    fearGreedToPrice: CorrelationData;
    socialToPrice: CorrelationData;
    onChainToPrice: CorrelationData;
  };
  predictivePower: number; // 0 to 1, how well sentiment predicts price
  laggingIndicators: string[];
  leadingIndicators: string[];
}

export interface CorrelationData {
  coefficient: number; // -1 to 1
  significance: number; // p-value
  strength: 'weak' | 'moderate' | 'strong';
  direction: 'positive' | 'negative' | 'neutral';
  lag?: number; // Days of lag for maximum correlation
}

// API Filters and Parameters
export interface SentimentFilters {
  symbols?: string[];
  timeframe?: '1h' | '4h' | '1d' | '7d' | '30d' | '90d';
  sources?: ('news' | 'twitter' | 'reddit' | 'onchain')[];
  minConfidence?: number;
  includeHistorical?: boolean;
  limit?: number;
}

export interface SentimentAnalysisConfig {
  weights: {
    news: number;
    social: number;
    onChain: number;
  };
  sources: {
    newsProviders: string[];
    socialPlatforms: string[];
    onChainProviders: string[];
  };
  updateInterval: number; // Minutes
  cacheExpiry: number; // Minutes
  alertThresholds: {
    extremeFear: number;
    fear: number;
    greed: number;
    extremeGreed: number;
  };
}

// Service Response Types
export interface SentimentAnalysisResponse {
  aggregatedSentiment: AggregatedSentiment;
  fearGreedIndex: FearGreedIndex;
  newsSentiment: NewsSentiment;
  socialSentiment: SocialSentiment;
  onChainSentiment: OnChainSentiment;
  sentimentHistory: SentimentHistory;
  correlations: SentimentCorrelation;
  lastUpdated: string;
}

export interface SentimentError {
  code: string;
  message: string;
  source?: string;
  timestamp: string;
  retryAfter?: number;
}

// Component Props Types
export interface SentimentDashboardProps {
  symbols?: string[];
  defaultSymbol?: string;
  defaultTimeframe?: string;
  showAlerts?: boolean;
  showCorrelation?: boolean;
  className?: string;
}

export interface FearGreedIndexProps {
  value: number;
  label: string;
  components?: FearGreedComponent[];
  size?: number;
  showComponents?: boolean;
  showTrend?: boolean;
  className?: string;
}

export interface SentimentChartProps {
  data: SentimentHistoryPoint[];
  fearGreedData?: SentimentHistoryPoint[];
  symbol: string;
  timeframe: string;
  height?: number;
  showPrice?: boolean;
  showVolume?: boolean;
  className?: string;
}

export interface SentimentAlertsProps {
  alerts: SentimentAlert[];
  currentSentiment: AggregatedSentiment;
  onCreateAlert: (alert: Omit<SentimentAlert, 'id' | 'createdAt'>) => void;
  onUpdateAlert: (alertId: string, updates: Partial<SentimentAlert>) => void;
  onDeleteAlert: (alertId: string) => void;
  className?: string;
}

// Utility Types
export type SentimentTrend = 'strongly_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strongly_bearish';
export type TimeframePeriod = '1h' | '4h' | '1d' | '7d' | '30d' | '90d';
export type SentimentSourceType = 'news' | 'social' | 'onchain' | 'technical' | 'fundamental';

// Mock Data Generation Types
export interface MockSentimentConfig {
  volatility: number; // 0 to 1, how much sentiment fluctuates
  trend: number; // -1 to 1, overall trend bias
  cyclePeriod: number; // Days for sentiment cycles
  noiseLevel: number; // 0 to 1, random noise in data
}