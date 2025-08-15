import { 
  Trader, 
  TraderLeaderboardEntry, 
  SocialTradingFilters, 
  UserSocialProfile,
  CommunityInsight,
  SocialNotification,
  TradingChallenge,
  InsightFilters
} from '../types/social.types';

export class SocialTradingService {
  private baseURL: string;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  async getTopTraders(filters: SocialTradingFilters = {}): Promise<TraderLeaderboardEntry[]> {
    try {
      const cacheKey = this.getCacheKey('top-traders', filters);
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation - replace with actual API call
      const mockTraders: TraderLeaderboardEntry[] = [
        {
          rank: 1,
          previousRank: 2,
          trader: {
            id: 'trader_1',
            name: 'Alex Thompson',
            username: 'alex_crypto',
            avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
            bio: 'Crypto enthusiast and DeFi specialist with 5+ years experience',
            strategy: 'DeFi Yield Farming',
            strategyDescription: 'Focus on high-yield DeFi protocols with risk management',
            followers: 12543,
            following: 234,
            copiers: 891,
            totalReturn: 287.5,
            monthlyReturn: 18.2,
            weeklyReturn: 4.1,
            dailyReturn: 0.8,
            winRate: 73.2,
            totalTrades: 156,
            profitableTrades: 114,
            maxDrawdown: 12.4,
            sharpeRatio: 2.1,
            riskScore: 6.5,
            badges: [
              {
                id: 'verified',
                name: 'Verified Trader',
                icon: '✅',
                description: 'Verified professional trader',
                earnedDate: '2024-01-15T00:00:00Z',
                rarity: 'rare'
              },
              {
                id: 'top_performer',
                name: 'Top Performer',
                icon: '🏆',
                description: 'Top 1% performer this quarter',
                earnedDate: '2024-03-01T00:00:00Z',
                rarity: 'epic'
              }
            ],
            isVerified: true,
            isPro: true,
            joinedDate: '2023-08-15T00:00:00Z',
            lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            country: 'United States',
            socialLinks: {
              twitter: 'https://twitter.com/alex_crypto',
              telegram: 'https://t.me/alexcrypto'
            }
          },
          score: 95.7,
          metrics: {
            totalReturn: 287.5,
            winRate: 73.2,
            followers: 12543,
            copiers: 891,
            riskScore: 6.5
          },
          change24h: 2.3,
          change7d: 8.1,
          trending: true
        },
        {
          rank: 2,
          previousRank: 1,
          trader: {
            id: 'trader_2',
            name: 'Sarah Chen',
            username: 'crypto_sarah',
            avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b2bd?w=100',
            bio: 'Technical analysis expert and swing trader',
            strategy: 'Technical Analysis',
            strategyDescription: 'Chart-based trading with strong risk management',
            followers: 8932,
            following: 156,
            copiers: 567,
            totalReturn: 245.8,
            monthlyReturn: 15.7,
            weeklyReturn: 3.2,
            dailyReturn: 0.6,
            winRate: 68.9,
            totalTrades: 203,
            profitableTrades: 140,
            maxDrawdown: 15.2,
            sharpeRatio: 1.8,
            riskScore: 7.2,
            badges: [
              {
                id: 'veteran',
                name: 'Veteran Trader',
                icon: '🎖️',
                description: '2+ years of consistent performance',
                earnedDate: '2024-02-01T00:00:00Z',
                rarity: 'rare'
              }
            ],
            isVerified: true,
            isPro: false,
            joinedDate: '2023-06-10T00:00:00Z',
            lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            country: 'Canada'
          },
          score: 92.4,
          metrics: {
            totalReturn: 245.8,
            winRate: 68.9,
            followers: 8932,
            copiers: 567,
            riskScore: 7.2
          },
          change24h: -1.8,
          change7d: 5.4,
          trending: false
        },
        {
          rank: 3,
          trader: {
            id: 'trader_3',
            name: 'Mike Rodriguez',
            username: 'btc_mike',
            avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100',
            bio: 'Bitcoin maximalist and long-term HODLer',
            strategy: 'Buy & Hold',
            strategyDescription: 'Long-term accumulation strategy with DCA',
            followers: 6721,
            following: 89,
            copiers: 423,
            totalReturn: 198.3,
            monthlyReturn: 12.1,
            weeklyReturn: 2.8,
            dailyReturn: 0.4,
            winRate: 81.5,
            totalTrades: 54,
            profitableTrades: 44,
            maxDrawdown: 8.7,
            sharpeRatio: 2.5,
            riskScore: 4.2,
            badges: [
              {
                id: 'hodler',
                name: 'Diamond Hands',
                icon: '💎',
                description: 'Held positions through major corrections',
                earnedDate: '2024-01-20T00:00:00Z',
                rarity: 'epic'
              }
            ],
            isVerified: false,
            isPro: true,
            joinedDate: '2023-09-05T00:00:00Z',
            lastActive: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            country: 'Spain'
          },
          score: 89.1,
          metrics: {
            totalReturn: 198.3,
            winRate: 81.5,
            followers: 6721,
            copiers: 423,
            riskScore: 4.2
          },
          change24h: 0.5,
          change7d: 3.2,
          trending: false
        }
      ];

      // Apply filters
      let filteredTraders = mockTraders;

      if (filters.strategy) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.strategy.toLowerCase().includes(filters.strategy!.toLowerCase())
        );
      }

      if (filters.minReturn) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.totalReturn >= filters.minReturn!
        );
      }

      if (filters.maxDrawdown) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.maxDrawdown <= filters.maxDrawdown!
        );
      }

      if (filters.minWinRate) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.winRate >= filters.minWinRate!
        );
      }

      if (filters.minFollowers) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.followers >= filters.minFollowers!
        );
      }

      if (filters.verified !== undefined) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.isVerified === filters.verified
        );
      }

      if (filters.pro !== undefined) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.isPro === filters.pro
        );
      }

      if (filters.country) {
        filteredTraders = filteredTraders.filter(entry => 
          entry.trader.country === filters.country
        );
      }

      // Apply sorting
      if (filters.sortBy) {
        filteredTraders.sort((a, b) => {
          let aValue, bValue;
          
          switch (filters.sortBy) {
            case 'return':
              aValue = a.trader.totalReturn;
              bValue = b.trader.totalReturn;
              break;
            case 'followers':
              aValue = a.trader.followers;
              bValue = b.trader.followers;
              break;
            case 'winRate':
              aValue = a.trader.winRate;
              bValue = b.trader.winRate;
              break;
            case 'risk':
              aValue = a.trader.riskScore;
              bValue = b.trader.riskScore;
              break;
            case 'activity':
              aValue = new Date(a.trader.lastActive).getTime();
              bValue = new Date(b.trader.lastActive).getTime();
              break;
            default:
              aValue = a.score;
              bValue = b.score;
          }

          const result = filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
          return result;
        });
      }

      this.setCache(cacheKey, filteredTraders, 5 * 60 * 1000); // 5 minute cache
      return filteredTraders;

    } catch (error) {
      console.error('Error fetching top traders:', error);
      throw error;
    }
  }

  async getTraderProfile(traderId: string): Promise<Trader> {
    try {
      const cacheKey = this.getCacheKey('trader-profile', { traderId });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation
      const topTraders = await this.getTopTraders();
      const trader = topTraders.find(entry => entry.trader.id === traderId)?.trader;
      
      if (!trader) {
        throw new Error('Trader not found');
      }

      // Add performance history and portfolio allocation
      const enhancedTrader: Trader = {
        ...trader,
        performanceHistory: this.generatePerformanceHistory(),
        portfolioAllocation: this.generatePortfolioAllocation()
      };

      this.setCache(cacheKey, enhancedTrader, 2 * 60 * 1000); // 2 minute cache
      return enhancedTrader;

    } catch (error) {
      console.error('Error fetching trader profile:', error);
      throw error;
    }
  }

  async followTrader(traderId: string): Promise<void> {
    try {
      // Mock implementation - would call actual API
      console.log(`Following trader: ${traderId}`);
      
      // Invalidate related caches
      this.invalidateCache('trader-profile');
      this.invalidateCache('followed-traders');
      
    } catch (error) {
      console.error('Error following trader:', error);
      throw error;
    }
  }

  async unfollowTrader(traderId: string): Promise<void> {
    try {
      // Mock implementation
      console.log(`Unfollowing trader: ${traderId}`);
      
      // Invalidate related caches
      this.invalidateCache('trader-profile');
      this.invalidateCache('followed-traders');
      
    } catch (error) {
      console.error('Error unfollowing trader:', error);
      throw error;
    }
  }

  async getFollowedTraders(userId: string): Promise<Trader[]> {
    try {
      const cacheKey = this.getCacheKey('followed-traders', { userId });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation - return subset of top traders
      const topTraders = await this.getTopTraders();
      const followedTraders = topTraders.slice(0, 2).map(entry => entry.trader);

      this.setCache(cacheKey, followedTraders, 5 * 60 * 1000);
      return followedTraders;

    } catch (error) {
      console.error('Error fetching followed traders:', error);
      throw error;
    }
  }

  async getCommunityInsights(filters: InsightFilters = {}): Promise<CommunityInsight[]> {
    try {
      const cacheKey = this.getCacheKey('community-insights', filters);
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation
      const topTraders = await this.getTopTraders();
      const mockInsights: CommunityInsight[] = [
        {
          id: 'insight_1',
          title: 'Bitcoin Breaking Key Resistance - Bullish Signal Ahead',
          content: 'BTC has successfully broken through the $45,000 resistance level with strong volume. This could signal the start of a new bullish rally. Key levels to watch: Support at $44,500, next resistance at $48,000.',
          author: topTraders[0].trader,
          category: 'analysis',
          tags: ['bitcoin', 'technical-analysis', 'breakout', 'bullish'],
          assets: ['BTC'],
          likes: 234,
          comments: 45,
          shares: 67,
          views: 1247,
          isLiked: false,
          isBookmarked: false,
          sentiment: 'bullish',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          commentsList: []
        },
        {
          id: 'insight_2',
          title: 'DeFi Summer 2.0: Top Protocols to Watch',
          content: 'The DeFi space is heating up again with innovative protocols offering attractive yields. My top picks: Uniswap V4 launch, Compound III improvements, and new lending protocols on L2s.',
          author: topTraders[1].trader,
          category: 'strategy',
          tags: ['defi', 'yield-farming', 'uniswap', 'compound'],
          assets: ['UNI', 'COMP'],
          likes: 156,
          comments: 32,
          shares: 28,
          views: 892,
          sentiment: 'bullish',
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          commentsList: []
        },
        {
          id: 'insight_3',
          title: 'Risk Management: Position Sizing in Volatile Markets',
          content: 'In these uncertain times, proper position sizing is crucial. I never risk more than 2% of my portfolio on a single trade. Here\'s my framework for calculating position sizes based on volatility.',
          author: topTraders[2].trader,
          category: 'education',
          tags: ['risk-management', 'position-sizing', 'education'],
          likes: 89,
          comments: 23,
          shares: 15,
          views: 567,
          sentiment: 'neutral',
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          commentsList: []
        }
      ];

      // Apply filters
      let filteredInsights = mockInsights;

      if (filters.category) {
        filteredInsights = filteredInsights.filter(insight => 
          insight.category === filters.category
        );
      }

      if (filters.author) {
        filteredInsights = filteredInsights.filter(insight => 
          insight.author.id === filters.author
        );
      }

      if (filters.asset) {
        filteredInsights = filteredInsights.filter(insight => 
          insight.assets?.includes(filters.asset!)
        );
      }

      if (filters.sentiment) {
        filteredInsights = filteredInsights.filter(insight => 
          insight.sentiment === filters.sentiment
        );
      }

      if (filters.timeframe && filters.timeframe !== 'all') {
        const cutoffTime = this.getTimeframeCutoff(filters.timeframe);
        filteredInsights = filteredInsights.filter(insight => 
          new Date(insight.createdAt) > cutoffTime
        );
      }

      // Apply sorting
      if (filters.sortBy) {
        filteredInsights.sort((a, b) => {
          switch (filters.sortBy) {
            case 'recent':
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'popular':
              return (b.likes + b.shares) - (a.likes + a.shares);
            case 'trending':
              return (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares);
            case 'comments':
              return b.comments - a.comments;
            default:
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        });
      }

      this.setCache(cacheKey, filteredInsights, 3 * 60 * 1000);
      return filteredInsights;

    } catch (error) {
      console.error('Error fetching community insights:', error);
      throw error;
    }
  }

  async likeInsight(insightId: string): Promise<void> {
    try {
      // Mock implementation
      console.log(`Liking insight: ${insightId}`);
      this.invalidateCache('community-insights');
    } catch (error) {
      console.error('Error liking insight:', error);
      throw error;
    }
  }

  async commentOnInsight(insightId: string, comment: string): Promise<void> {
    try {
      // Mock implementation
      console.log(`Commenting on insight ${insightId}: ${comment}`);
      this.invalidateCache('community-insights');
    } catch (error) {
      console.error('Error commenting on insight:', error);
      throw error;
    }
  }

  async shareInsight(insightId: string): Promise<void> {
    try {
      // Mock implementation
      console.log(`Sharing insight: ${insightId}`);
      this.invalidateCache('community-insights');
    } catch (error) {
      console.error('Error sharing insight:', error);
      throw error;
    }
  }

  async getUserSocialProfile(userId: string): Promise<UserSocialProfile> {
    try {
      const cacheKey = this.getCacheKey('user-social-profile', { userId });
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;

      // Mock implementation
      const followedTraders = await this.getFollowedTraders(userId);
      const insights = await this.getCommunityInsights();

      const mockProfile: UserSocialProfile = {
        userId,
        trader: {
          id: userId,
          name: 'John Doe',
          username: 'john_trader',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
          bio: 'Passionate crypto trader and blockchain enthusiast',
          strategy: 'Diversified Portfolio',
          followers: 145,
          following: 23,
          copiers: 12,
          totalReturn: 45.7,
          monthlyReturn: 8.2,
          weeklyReturn: 1.9,
          dailyReturn: 0.3,
          winRate: 62.5,
          totalTrades: 89,
          profitableTrades: 56,
          maxDrawdown: 18.3,
          sharpeRatio: 1.2,
          riskScore: 7.8,
          badges: [],
          isVerified: false,
          isPro: false,
          joinedDate: '2024-01-10T00:00:00Z',
          lastActive: new Date().toISOString()
        },
        following: followedTraders,
        followers: [],
        copyTrades: [],
        insights: insights.slice(0, 2),
        achievements: [],
        challenges: [],
        notifications: [],
        stats: {
          totalFollowers: 145,
          totalFollowing: 23,
          totalCopiers: 12,
          totalInsights: 8,
          totalLikes: 234,
          totalComments: 45,
          reputation: 78,
          rank: 1247,
          joinedDate: '2024-01-10T00:00:00Z',
          lastActive: new Date().toISOString()
        },
        settings: {
          profileVisibility: 'public',
          tradeVisibility: 'followers',
          allowCopyTrading: true,
          allowMessages: true,
          allowMentions: true,
          emailNotifications: true,
          pushNotifications: true,
          copyTradeAlerts: true,
          insightAlerts: true,
          followAlerts: true
        }
      };

      this.setCache(cacheKey, mockProfile, 5 * 60 * 1000);
      return mockProfile;

    } catch (error) {
      console.error('Error fetching user social profile:', error);
      throw error;
    }
  }

  private generatePerformanceHistory() {
    const history = [];
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    
    let portfolioValue = 10000;
    
    for (let i = 0; i < 365; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dailyReturn = (Math.random() - 0.5) * 0.1; // -5% to +5% daily
      portfolioValue *= (1 + dailyReturn);
      
      history.push({
        date: date.toISOString(),
        value: portfolioValue,
        portfolioValue,
        dailyReturn: dailyReturn * 100,
        cumulativeReturn: ((portfolioValue - 10000) / 10000) * 100
      });
    }
    
    return history;
  }

  private generatePortfolioAllocation() {
    return [
      { asset: 'Bitcoin', symbol: 'BTC', percentage: 40, value: 4000, change24h: 2.1 },
      { asset: 'Ethereum', symbol: 'ETH', percentage: 25, value: 2500, change24h: 1.8 },
      { asset: 'Cardano', symbol: 'ADA', percentage: 15, value: 1500, change24h: -0.5 },
      { asset: 'Solana', symbol: 'SOL', percentage: 10, value: 1000, change24h: 3.2 },
      { asset: 'Polygon', symbol: 'MATIC', percentage: 6, value: 600, change24h: 1.1 },
      { asset: 'Chainlink', symbol: 'LINK', percentage: 4, value: 400, change24h: -1.2 }
    ];
  }

  private getTimeframeCutoff(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(0);
    }
  }

  private getCacheKey(endpoint: string, params: any): string {
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private invalidateCache(prefix: string): void {
    for (const [key] of this.cache) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const socialTradingService = new SocialTradingService();
export default SocialTradingService;