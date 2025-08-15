export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content?: string;
  url: string;
  source: string;
  author?: string;
  publishedAt: string;
  updatedAt?: string;
  image?: string;
  tags: string[];
  category: NewsCategory;
  sentiment?: SentimentAnalysis;
  relevanceScore?: number;
  isPortfolioRelevant?: boolean;
  relatedAssets?: string[];
  readTime?: number;
  socialStats?: SocialStats;
  priceImpact?: PriceImpact;
}

export interface SentimentAnalysis {
  score: number; // -1 to 1 scale
  label: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0 to 1
  keywords?: string[];
  emotions?: {
    fear?: number;
    greed?: number;
    optimism?: number;
    uncertainty?: number;
  };
}

export interface SocialStats {
  shares: number;
  comments: number;
  likes: number;
  retweets?: number;
  redditScore?: number;
  engagement: number;
}

export interface PriceImpact {
  correlation: number;
  timeframe: string;
  significance: 'high' | 'medium' | 'low' | 'none';
  affectedAssets: string[];
}

export type NewsCategory = 
  | 'market'
  | 'technology'
  | 'regulation'
  | 'adoption'
  | 'security'
  | 'defi'
  | 'nft'
  | 'mining'
  | 'exchange'
  | 'analysis'
  | 'general';

export interface NewsFilters {
  category: NewsCategory | 'all';
  sentiment: 'positive' | 'negative' | 'neutral' | 'all';
  source: string | 'all';
  timeframe: '1h' | '6h' | '24h' | '7d' | '30d' | 'all';
  portfolioOnly: boolean;
  searchQuery?: string;
  tags?: string[];
  minRelevanceScore?: number;
  hasImage?: boolean;
  sortBy?: 'date' | 'relevance' | 'sentiment' | 'social';
  sortOrder?: 'asc' | 'desc';
}

export interface NewsAlert {
  id: string;
  name: string;
  keywords: string[];
  assets: string[];
  category?: NewsCategory;
  sentiment?: 'positive' | 'negative' | 'neutral';
  minRelevanceScore?: number;
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
  notificationMethod: ('push' | 'email' | 'sms')[];
}

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  credibilityScore: number;
  updateFrequency: number; // minutes
  categories: NewsCategory[];
  isActive: boolean;
  apiEndpoint?: string;
  rssUrl?: string;
}

export interface TrendingTopic {
  keyword: string;
  count: number;
  growth: number; // percentage change
  sentiment: SentimentAnalysis;
  relatedArticles: NewsArticle[];
  category: NewsCategory;
}

export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
  hasMore: boolean;
  page: number;
  sources: string[];
  categories: NewsCategory[];
  timeRange: {
    from: string;
    to: string;
  };
}

export interface SocialMediaPost {
  id: string;
  platform: 'twitter' | 'reddit' | 'telegram' | 'discord';
  content: string;
  author: string;
  url: string;
  publishedAt: string;
  engagement: SocialStats;
  sentiment: SentimentAnalysis;
  mentions: string[];
  hashtags: string[];
  influence: number; // 0 to 1
}

export interface NewsBookmark {
  id: string;
  articleId: string;
  userId: string;
  bookmarkedAt: string;
  tags: string[];
  notes?: string;
  isRead: boolean;
  readAt?: string;
}

export interface ReadingHistory {
  articleId: string;
  readAt: string;
  readDuration: number; // seconds
  scrollPercentage: number;
  fromSource: 'feed' | 'search' | 'alert' | 'bookmark' | 'trending';
}

export interface NewsMetrics {
  totalArticles: number;
  categoryCounts: Record<NewsCategory, number>;
  sentimentDistribution: {
    positive: number;
    negative: number;
    neutral: number;
  };
  sourceDistribution: Record<string, number>;
  avgSentimentScore: number;
  trendingKeywords: string[];
  portfolioRelevantCount: number;
  readingStats: {
    totalRead: number;
    avgReadTime: number;
    bookmarkedCount: number;
  };
}

export interface NewsSettings {
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  defaultFilters: NewsFilters;
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  readingPreferences: {
    fontSize: 'small' | 'medium' | 'large';
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    showImages: boolean;
    autoMarkAsRead: boolean;
  };
  privacy: {
    trackReading: boolean;
    shareData: boolean;
    personalizedRecommendations: boolean;
  };
}

export interface NewsError {
  code: string;
  message: string;
  source?: string;
  timestamp: string;
  details?: any;
}

// API Response types
export interface NewsAPIResponse {
  status: 'ok' | 'error';
  totalResults?: number;
  articles?: any[];
  code?: string;
  message?: string;
}

export interface CryptoPanicResponse {
  count: number;
  next?: string;
  previous?: string;
  results: any[];
}

export interface CoinDeskResponse {
  data: any[];
  meta?: {
    total: number;
    page: number;
    perPage: number;
  };
}

// Hook return types
export interface UseNewsFeedReturn {
  news: NewsArticle[];
  trendingNews: NewsArticle[];
  portfolioNews: NewsArticle[];
  isLoading: boolean;
  hasMore: boolean;
  error: NewsError | null;
  metrics: NewsMetrics;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  searchNews: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export interface UseNewsAlertsReturn {
  alerts: NewsAlert[];
  activeAlerts: NewsAlert[];
  alertHistory: NewsArticle[];
  createAlert: (alert: Omit<NewsAlert, 'id' | 'createdAt' | 'triggerCount'>) => Promise<void>;
  updateAlert: (id: string, updates: Partial<NewsAlert>) => Promise<void>;
  removeAlert: (id: string) => Promise<void>;
  toggleAlert: (id: string) => Promise<void>;
  testAlert: (id: string) => Promise<void>;
}

export interface UseNewsSentimentReturn {
  analyzeSentiment: (text: string) => Promise<SentimentAnalysis>;
  batchAnalyzeSentiment: (texts: string[]) => Promise<SentimentAnalysis[]>;
  getSentimentTrends: (timeframe: string) => Promise<SentimentAnalysis[]>;
  isLoading: boolean;
  error: NewsError | null;
}