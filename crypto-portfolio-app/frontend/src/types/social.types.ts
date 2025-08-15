export interface Trader {
  id: string;
  name: string;
  username: string;
  email?: string;
  avatar: string;
  bio?: string;
  strategy: string;
  strategyDescription?: string;
  followers: number;
  following: number;
  copiers: number;
  totalReturn: number;
  monthlyReturn: number;
  weeklyReturn: number;
  dailyReturn: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  riskScore: number;
  badges: TradingBadge[];
  isVerified: boolean;
  isPro: boolean;
  joinedDate: string;
  lastActive: string;
  country?: string;
  socialLinks?: SocialLinks;
  performanceHistory?: PerformanceHistory[];
  portfolioAllocation?: PortfolioAllocation[];
}

export interface TradingBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earnedDate: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface SocialLinks {
  twitter?: string;
  telegram?: string;
  discord?: string;
  youtube?: string;
  website?: string;
}

export interface PerformanceHistory {
  date: string;
  value: number;
  portfolioValue: number;
  dailyReturn: number;
  cumulativeReturn: number;
}

export interface PortfolioAllocation {
  asset: string;
  symbol: string;
  percentage: number;
  value: number;
  change24h: number;
}

export interface Trade {
  id: string;
  traderId: string;
  asset: string;
  assetIcon?: string;
  symbol: string;
  type: 'buy' | 'sell';
  side?: 'long' | 'short';
  amount: number;
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  pnlPercentage?: number;
  fees?: number;
  openDate: string;
  closeDate?: string;
  status: 'open' | 'closed' | 'pending';
  notes?: string;
  tags?: string[];
}

export interface CopyTrade {
  id: string;
  userId: string;
  traderId: string;
  trader: Trader;
  allocatedAmount: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPercentage: number;
  dailyReturn: number;
  weeklyReturn: number;
  monthlyReturn: number;
  performance: number;
  duration: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'paused' | 'stopped';
  settings: CopyTradeSettings;
  trades: Trade[];
  statistics: CopyTradeStatistics;
}

export interface CopyTradeSettings {
  amount: number;
  stopLoss: number;
  takeProfit: number;
  maxOpenTrades: number;
  maxDailyTrades: number;
  copyMode: 'fixed' | 'percentage' | 'proportional';
  copyPercentage?: number;
  allowShorts: boolean;
  allowLeverage: boolean;
  maxLeverage?: number;
  skipAssets?: string[];
  onlyAssets?: string[];
  autoRebalance: boolean;
  rebalanceFrequency?: 'daily' | 'weekly' | 'monthly';
}

export interface CopyTradeStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercentage: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  totalFees: number;
}

export interface CommunityInsight {
  id: string;
  title: string;
  content: string;
  author: Trader;
  category: InsightCategory;
  tags: string[];
  assets?: string[];
  images?: string[];
  charts?: ChartData[];
  likes: number;
  comments: number;
  shares: number;
  views: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  createdAt: string;
  updatedAt: string;
  commentsList?: Comment[];
}

export type InsightCategory = 
  | 'analysis'
  | 'strategy'
  | 'news'
  | 'education'
  | 'signal'
  | 'discussion'
  | 'poll'
  | 'achievement';

export interface Comment {
  id: string;
  author: Trader;
  content: string;
  likes: number;
  isLiked?: boolean;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface ChartData {
  id: string;
  type: 'line' | 'candlestick' | 'bar' | 'area';
  data: any[];
  config?: any;
}

export interface TraderLeaderboardEntry {
  rank: number;
  previousRank?: number;
  trader: Trader;
  score: number;
  metrics: {
    totalReturn: number;
    winRate: number;
    followers: number;
    copiers: number;
    riskScore: number;
  };
  change24h: number;
  change7d: number;
  trending: boolean;
}

export interface SocialNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  from?: Trader;
  relatedAsset?: string;
  relatedTrade?: Trade;
  relatedInsight?: CommunityInsight;
  read: boolean;
  createdAt: string;
}

export type NotificationType =
  | 'new_follower'
  | 'new_copier'
  | 'trade_copied'
  | 'trade_closed'
  | 'insight_liked'
  | 'insight_commented'
  | 'mentioned'
  | 'achievement'
  | 'milestone'
  | 'alert';

export interface TradingChallenge {
  id: string;
  name: string;
  description: string;
  type: 'competition' | 'challenge' | 'quest';
  status: 'upcoming' | 'active' | 'completed';
  startDate: string;
  endDate: string;
  prize: string;
  participants: number;
  leaderboard: TraderLeaderboardEntry[];
  rules: string[];
  requirements: ChallengeRequirements;
  rewards: ChallengeRewards;
}

export interface ChallengeRequirements {
  minTrades?: number;
  minFollowers?: number;
  minBalance?: number;
  minWinRate?: number;
  requiredAssets?: string[];
  requiredBadges?: string[];
}

export interface ChallengeRewards {
  winner: string;
  runnerUp?: string;
  top10?: string;
  participation?: string;
  badges?: TradingBadge[];
}

export interface UserSocialProfile {
  userId: string;
  trader?: Trader;
  following: Trader[];
  followers: Trader[];
  copyTrades: CopyTrade[];
  insights: CommunityInsight[];
  achievements: TradingBadge[];
  challenges: TradingChallenge[];
  notifications: SocialNotification[];
  stats: UserSocialStats;
  settings: UserSocialSettings;
}

export interface UserSocialStats {
  totalFollowers: number;
  totalFollowing: number;
  totalCopiers: number;
  totalInsights: number;
  totalLikes: number;
  totalComments: number;
  reputation: number;
  rank: number;
  joinedDate: string;
  lastActive: string;
}

export interface UserSocialSettings {
  profileVisibility: 'public' | 'followers' | 'private';
  tradeVisibility: 'public' | 'followers' | 'private';
  allowCopyTrading: boolean;
  allowMessages: boolean;
  allowMentions: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
  copyTradeAlerts: boolean;
  insightAlerts: boolean;
  followAlerts: boolean;
}

export interface SocialTradingFilters {
  strategy?: string;
  minReturn?: number;
  maxDrawdown?: number;
  minWinRate?: number;
  minFollowers?: number;
  timeframe?: '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
  verified?: boolean;
  pro?: boolean;
  country?: string;
  sortBy?: 'return' | 'followers' | 'winRate' | 'risk' | 'activity';
  sortOrder?: 'asc' | 'desc';
}

export interface CopyTradeFilters {
  status?: 'active' | 'paused' | 'stopped';
  minReturn?: number;
  trader?: string;
  asset?: string;
  sortBy?: 'return' | 'date' | 'amount' | 'performance';
  sortOrder?: 'asc' | 'desc';
}

export interface InsightFilters {
  category?: InsightCategory;
  author?: string;
  asset?: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  timeframe?: '24h' | '7d' | '30d' | 'all';
  sortBy?: 'recent' | 'popular' | 'trending' | 'comments';
}