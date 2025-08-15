import { 
  NewsArticle, 
  NewsFilters, 
  NewsResponse, 
  NewsSource, 
  TrendingTopic,
  SocialMediaPost,
  NewsCategory,
  NewsError
} from '../types/news.types';
import { sentimentAnalysisService } from './SentimentAnalysisService';

class NewsService {
  private apiSources: NewsSource[] = [
    {
      id: 'coindesk',
      name: 'CoinDesk',
      url: 'https://coindesk.com',
      credibilityScore: 9.5,
      updateFrequency: 15,
      categories: ['market', 'technology', 'regulation', 'adoption'],
      isActive: true,
      rssUrl: 'https://coindesk.com/arc/outboundfeeds/rss/'
    },
    {
      id: 'cointelegraph',
      name: 'Cointelegraph',
      url: 'https://cointelegraph.com',
      credibilityScore: 9.0,
      updateFrequency: 10,
      categories: ['market', 'technology', 'analysis', 'defi'],
      isActive: true,
      rssUrl: 'https://cointelegraph.com/rss'
    },
    {
      id: 'cryptopanic',
      name: 'CryptoPanic',
      url: 'https://cryptopanic.com',
      credibilityScore: 8.5,
      updateFrequency: 5,
      categories: ['market', 'general', 'analysis'],
      isActive: true,
      apiEndpoint: 'https://cryptopanic.com/api/v1/posts/'
    },
    {
      id: 'newsapi',
      name: 'NewsAPI',
      url: 'https://newsapi.org',
      credibilityScore: 8.0,
      updateFrequency: 30,
      categories: ['general', 'technology', 'regulation'],
      isActive: true,
      apiEndpoint: 'https://newsapi.org/v2/everything'
    }
  ];

  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private sentimentService = sentimentAnalysisService;
  private baseURL = process.env.REACT_APP_API_BASE_URL || '/api';

  constructor() {
    this.initializeCache();
  }

  private initializeCache(): void {
    // Clear expired cache entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > value.ttl) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  private getCacheKey(endpoint: string, params: any): string {
    return `${endpoint}_${JSON.stringify(params)}`;
  }

  private setCache(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  async getNews(filters: NewsFilters = {} as NewsFilters): Promise<NewsResponse> {
    try {
      const cacheKey = this.getCacheKey('news', filters);
      const cached = this.getCache(cacheKey);
      if (cached) return cached;

      const defaultFilters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc',
        ...filters
      };

      // Aggregate news from multiple sources in parallel
      const newsPromises = this.apiSources
        .filter(source => source.isActive)
        .map(source => this.fetchFromSource(source, defaultFilters));

      const results = await Promise.allSettled(newsPromises);
      const allNews: NewsArticle[] = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          allNews.push(...result.value);
        } else {
          console.warn(`Failed to fetch from ${this.apiSources[index].name}:`, result.reason);
        }
      });

      // Process and filter news
      const processedNews = await this.processNews(allNews, defaultFilters);
      
      const response: NewsResponse = {
        articles: processedNews,
        totalResults: processedNews.length,
        hasMore: processedNews.length >= 20,
        page: 1,
        sources: [...new Set(processedNews.map(n => n.source))],
        categories: [...new Set(processedNews.map(n => n.category))],
        timeRange: {
          from: this.getTimeframeStart(defaultFilters.timeframe),
          to: new Date().toISOString()
        }
      };

      this.setCache(cacheKey, response);
      return response;

    } catch (error) {
      console.error('Error fetching news:', error);
      throw this.createNewsError('FETCH_ERROR', 'Failed to fetch news', error);
    }
  }

  private async fetchFromSource(source: NewsSource, filters: NewsFilters): Promise<NewsArticle[]> {
    try {
      switch (source.id) {
        case 'coindesk':
          return await this.fetchCoinDeskNews(filters);
        case 'cointelegraph':
          return await this.fetchCoinTelegraphNews(filters);
        case 'cryptopanic':
          return await this.fetchCryptoPanicNews(filters);
        case 'newsapi':
          return await this.fetchNewsAPINews(filters);
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error fetching from ${source.name}:`, error);
      return [];
    }
  }

  private async fetchCoinDeskNews(filters: NewsFilters): Promise<NewsArticle[]> {
    // Mock implementation - replace with actual RSS/API parsing
    const mockNews: NewsArticle[] = [
      {
        id: 'coindesk_1',
        title: 'Bitcoin Reaches New Milestone as Institutional Adoption Accelerates',
        summary: 'Major corporations continue to allocate treasury funds to Bitcoin, driving institutional adoption to new heights.',
        content: 'The latest wave of institutional Bitcoin adoption has pushed the cryptocurrency to new milestones...',
        url: 'https://coindesk.com/markets/2024/01/15/bitcoin-institutional-adoption/',
        source: 'CoinDesk',
        author: 'Sarah Chen',
        publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        image: 'https://images.unsplash.com/photo-1605792657660-596af9009e82?w=800',
        tags: ['bitcoin', 'institutional', 'adoption', 'treasury'],
        category: 'market',
        relatedAssets: ['BTC'],
        readTime: 3,
        socialStats: {
          shares: 245,
          comments: 89,
          likes: 1205,
          retweets: 156,
          engagement: 0.78
        }
      },
      {
        id: 'coindesk_2',
        title: 'Ethereum Staking Rewards Hit All-Time High Amid Network Upgrades',
        summary: 'Ethereum validators are earning record rewards as network participation increases following recent protocol improvements.',
        content: 'Ethereum staking has become increasingly lucrative for validators...',
        url: 'https://coindesk.com/tech/2024/01/15/ethereum-staking-ath/',
        source: 'CoinDesk',
        author: 'Michael Torres',
        publishedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800',
        tags: ['ethereum', 'staking', 'validators', 'yield'],
        category: 'technology',
        relatedAssets: ['ETH'],
        readTime: 4,
        socialStats: {
          shares: 178,
          comments: 67,
          likes: 892,
          retweets: 134,
          engagement: 0.65
        }
      }
    ];

    return mockNews;
  }

  private async fetchCoinTelegraphNews(filters: NewsFilters): Promise<NewsArticle[]> {
    // Mock implementation
    const mockNews: NewsArticle[] = [
      {
        id: 'cointelegraph_1',
        title: 'DeFi Protocol Launches Revolutionary Cross-Chain Bridge',
        summary: 'A new decentralized finance protocol introduces groundbreaking interoperability features for seamless asset transfers.',
        content: 'The DeFi ecosystem continues to evolve with innovative solutions...',
        url: 'https://cointelegraph.com/news/defi-cross-chain-bridge-launch',
        source: 'Cointelegraph',
        author: 'Alex Rodriguez',
        publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?w=800',
        tags: ['defi', 'cross-chain', 'bridge', 'interoperability'],
        category: 'defi',
        relatedAssets: ['ETH', 'MATIC', 'AVAX'],
        readTime: 5,
        socialStats: {
          shares: 312,
          comments: 145,
          likes: 1456,
          retweets: 287,
          engagement: 0.82
        }
      }
    ];

    return mockNews;
  }

  private async fetchCryptoPanicNews(filters: NewsFilters): Promise<NewsArticle[]> {
    try {
      const apiKey = process.env.REACT_APP_CRYPTOPANIC_API_KEY;
      if (!apiKey) {
        return this.getMockCryptoPanicNews();
      }

      // In production, implement actual API call
      // const response = await fetch(`https://cryptopanic.com/api/v1/posts/?auth_token=${apiKey}&public=true`);
      // const data = await response.json();

      return this.getMockCryptoPanicNews();
    } catch (error) {
      console.error('Error fetching CryptoPanic news:', error);
      return [];
    }
  }

  private getMockCryptoPanicNews(): NewsArticle[] {
    return [
      {
        id: 'cryptopanic_1',
        title: 'Major Exchange Announces Support for New Layer 2 Solutions',
        summary: 'Leading cryptocurrency exchange expands trading options with support for emerging Layer 2 scaling solutions.',
        content: 'The integration of Layer 2 solutions continues to gain momentum...',
        url: 'https://cryptopanic.com/news/exchange-layer2-support',
        source: 'CryptoPanic',
        publishedAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        tags: ['exchange', 'layer2', 'scaling', 'trading'],
        category: 'exchange',
        relatedAssets: ['ETH', 'MATIC', 'ARB'],
        readTime: 2,
        socialStats: {
          shares: 89,
          comments: 34,
          likes: 445,
          engagement: 0.45
        }
      }
    ];
  }

  private async fetchNewsAPINews(filters: NewsFilters): Promise<NewsArticle[]> {
    try {
      const apiKey = process.env.REACT_APP_NEWSAPI_KEY;
      if (!apiKey) {
        return this.getMockNewsAPINews();
      }

      // In production, implement actual API call
      return this.getMockNewsAPINews();
    } catch (error) {
      console.error('Error fetching NewsAPI news:', error);
      return [];
    }
  }

  private getMockNewsAPINews(): NewsArticle[] {
    return [
      {
        id: 'newsapi_1',
        title: 'Regulatory Framework for Digital Assets Gains Global Support',
        summary: 'International financial authorities collaborate on comprehensive guidelines for cryptocurrency regulation.',
        content: 'Global regulatory coordination efforts are taking shape...',
        url: 'https://example.com/news/crypto-regulation-framework',
        source: 'Financial Times',
        publishedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        tags: ['regulation', 'framework', 'global', 'compliance'],
        category: 'regulation',
        relatedAssets: ['BTC', 'ETH'],
        readTime: 6,
        socialStats: {
          shares: 567,
          comments: 234,
          likes: 2134,
          engagement: 0.91
        }
      }
    ];
  }

  private async processNews(allNews: NewsArticle[], filters: NewsFilters): Promise<NewsArticle[]> {
    // Remove duplicates
    const uniqueNews = this.deduplicateNews(allNews);
    
    // Add sentiment analysis
    const newsWithSentiment = await this.addSentimentAnalysis(uniqueNews);
    
    // Apply filters
    const filteredNews = this.applyFilters(newsWithSentiment, filters);
    
    // Sort news
    const sortedNews = this.sortNews(filteredNews, filters.sortBy!, filters.sortOrder!);
    
    // Add relevance scores
    const newsWithRelevance = this.addRelevanceScores(sortedNews, filters);

    return newsWithRelevance;
  }

  private deduplicateNews(newsArray: NewsArticle[]): NewsArticle[] {
    const seen = new Set<string>();
    return newsArray.filter(news => {
      const key = this.normalizeTitle(news.title);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private normalizeTitle(title: string): string {
    return title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async addSentimentAnalysis(newsArray: NewsArticle[]): Promise<NewsArticle[]> {
    const newsWithSentiment = await Promise.all(
      newsArray.map(async (news) => {
        try {
          const text = `${news.title} ${news.summary}`;
          const sentiment = await this.sentimentService.analyzeSentiment(text);
          return { ...news, sentiment };
        } catch (error) {
          console.error('Error analyzing sentiment for news:', error);
          return {
            ...news,
            sentiment: { score: 0, label: 'neutral' as const, confidence: 0 }
          };
        }
      })
    );

    return newsWithSentiment;
  }

  private applyFilters(newsArray: NewsArticle[], filters: NewsFilters): NewsArticle[] {
    return newsArray.filter(news => {
      // Category filter
      if (filters.category !== 'all' && news.category !== filters.category) {
        return false;
      }

      // Sentiment filter
      if (filters.sentiment !== 'all' && news.sentiment?.label !== filters.sentiment) {
        return false;
      }

      // Source filter
      if (filters.source !== 'all' && news.source !== filters.source) {
        return false;
      }

      // Timeframe filter
      if (filters.timeframe !== 'all') {
        const publishDate = new Date(news.publishedAt);
        const cutoffDate = this.getTimeframeCutoff(filters.timeframe);
        if (publishDate < cutoffDate) {
          return false;
        }
      }

      // Search query filter
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchText = `${news.title} ${news.summary} ${news.tags.join(' ')}`.toLowerCase();
        if (!searchText.includes(query)) {
          return false;
        }
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some(tag => 
          news.tags.some(newsTag => newsTag.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasTag) {
          return false;
        }
      }

      // Relevance score filter
      if (filters.minRelevanceScore && news.relevanceScore) {
        if (news.relevanceScore < filters.minRelevanceScore) {
          return false;
        }
      }

      // Image filter
      if (filters.hasImage && !news.image) {
        return false;
      }

      return true;
    });
  }

  private sortNews(newsArray: NewsArticle[], sortBy: string, sortOrder: string): NewsArticle[] {
    return [...newsArray].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          comparison = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
          break;
        case 'relevance':
          comparison = (b.relevanceScore || 0) - (a.relevanceScore || 0);
          break;
        case 'sentiment':
          comparison = (b.sentiment?.score || 0) - (a.sentiment?.score || 0);
          break;
        case 'social':
          comparison = (b.socialStats?.engagement || 0) - (a.socialStats?.engagement || 0);
          break;
        default:
          comparison = new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }

      return sortOrder === 'asc' ? -comparison : comparison;
    });
  }

  private addRelevanceScores(newsArray: NewsArticle[], filters: NewsFilters): NewsArticle[] {
    return newsArray.map(news => {
      let score = 0;

      // Base score from source credibility
      const source = this.apiSources.find(s => s.name === news.source);
      score += (source?.credibilityScore || 5) / 10; // 0.5 to 0.95

      // Recency bonus (newer = higher score)
      const hoursOld = (Date.now() - new Date(news.publishedAt).getTime()) / (1000 * 60 * 60);
      score += Math.max(0, (24 - hoursOld) / 24) * 0.3; // Up to 0.3 bonus

      // Social engagement bonus
      if (news.socialStats) {
        const engagementScore = Math.min(news.socialStats.engagement, 1) * 0.2;
        score += engagementScore;
      }

      // Sentiment extremity bonus (very positive or negative news gets higher score)
      if (news.sentiment) {
        const sentimentExtremity = Math.abs(news.sentiment.score);
        score += sentimentExtremity * 0.15;
      }

      return { ...news, relevanceScore: Math.min(score, 1) };
    });
  }

  private getTimeframeCutoff(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
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

  private getTimeframeStart(timeframe: string): string {
    return this.getTimeframeCutoff(timeframe).toISOString();
  }

  async getTrendingNews(): Promise<{ articles: NewsArticle[]; topics: TrendingTopic[] }> {
    try {
      const cacheKey = this.getCacheKey('trending', {});
      const cached = this.getCache(cacheKey);
      if (cached) return cached;

      const recentNews = await this.getNews({ timeframe: '24h', sortBy: 'social' });
      
      // Calculate trending topics
      const keywordCounts = new Map<string, { count: number; articles: NewsArticle[]; sentiment: number[] }>();
      
      recentNews.articles.forEach(article => {
        article.tags.forEach(tag => {
          if (!keywordCounts.has(tag)) {
            keywordCounts.set(tag, { count: 0, articles: [], sentiment: [] });
          }
          const data = keywordCounts.get(tag)!;
          data.count++;
          data.articles.push(article);
          if (article.sentiment) {
            data.sentiment.push(article.sentiment.score);
          }
        });
      });

      // Create trending topics
      const topics: TrendingTopic[] = Array.from(keywordCounts.entries())
        .filter(([_, data]) => data.count >= 3) // Minimum 3 mentions
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([keyword, data]) => ({
          keyword,
          count: data.count,
          growth: Math.random() * 50, // Mock growth percentage
          sentiment: {
            score: data.sentiment.reduce((sum, score) => sum + score, 0) / data.sentiment.length || 0,
            label: this.getSentimentLabel(data.sentiment.reduce((sum, score) => sum + score, 0) / data.sentiment.length || 0),
            confidence: 0.8
          },
          relatedArticles: data.articles.slice(0, 5),
          category: this.inferCategoryFromKeyword(keyword)
        }));

      // Get trending articles (high social engagement)
      const trendingArticles = recentNews.articles
        .filter(article => article.socialStats && article.socialStats.engagement > 0.6)
        .slice(0, 10);

      const result = { articles: trendingArticles, topics };
      this.setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes TTL
      
      return result;
    } catch (error) {
      console.error('Error getting trending news:', error);
      throw this.createNewsError('TRENDING_ERROR', 'Failed to get trending news', error);
    }
  }

  private getSentimentLabel(score: number): 'positive' | 'negative' | 'neutral' {
    if (score > 0.1) return 'positive';
    if (score < -0.1) return 'negative';
    return 'neutral';
  }

  private inferCategoryFromKeyword(keyword: string): NewsCategory {
    const categoryMap: Record<string, NewsCategory> = {
      'bitcoin': 'market',
      'ethereum': 'market',
      'defi': 'defi',
      'nft': 'nft',
      'regulation': 'regulation',
      'adoption': 'adoption',
      'mining': 'mining',
      'exchange': 'exchange',
      'staking': 'technology',
      'bridge': 'technology'
    };

    return categoryMap[keyword.toLowerCase()] || 'general';
  }

  async searchNews(query: string, filters: NewsFilters = {} as NewsFilters): Promise<NewsResponse> {
    try {
      const searchFilters = { ...filters, searchQuery: query };
      return await this.getNews(searchFilters);
    } catch (error) {
      console.error('Error searching news:', error);
      throw this.createNewsError('SEARCH_ERROR', 'Failed to search news', error);
    }
  }

  async getPortfolioRelevantNews(portfolioAssets: string[], filters: NewsFilters = {} as NewsFilters): Promise<NewsArticle[]> {
    try {
      const allNews = await this.getNews(filters);
      
      const relevantNews = allNews.articles.filter(article => {
        // Check if article mentions any portfolio assets
        const mentions = portfolioAssets.some(asset => {
          const assetLower = asset.toLowerCase();
          const titleLower = article.title.toLowerCase();
          const summaryLower = article.summary.toLowerCase();
          const tagsLower = article.tags.map(tag => tag.toLowerCase());
          
          return titleLower.includes(assetLower) ||
                 summaryLower.includes(assetLower) ||
                 tagsLower.includes(assetLower) ||
                 article.relatedAssets?.includes(asset);
        });

        return mentions;
      });

      // Mark as portfolio relevant and add portfolio-specific relevance boost
      return relevantNews.map(article => ({
        ...article,
        isPortfolioRelevant: true,
        relevanceScore: Math.min((article.relevanceScore || 0) + 0.2, 1)
      }));

    } catch (error) {
      console.error('Error getting portfolio relevant news:', error);
      throw this.createNewsError('PORTFOLIO_NEWS_ERROR', 'Failed to get portfolio relevant news', error);
    }
  }

  async getSocialMediaSentiment(assets: string[]): Promise<SocialMediaPost[]> {
    try {
      // Mock implementation - replace with actual social media API integration
      const mockPosts: SocialMediaPost[] = [
        {
          id: 'twitter_1',
          platform: 'twitter',
          content: 'Bitcoin adoption by major corporations is accelerating faster than expected. This could be a major catalyst for the next bull run. #Bitcoin #BTC',
          author: '@CryptoAnalyst',
          url: 'https://twitter.com/CryptoAnalyst/status/123456789',
          publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          engagement: {
            shares: 45,
            comments: 12,
            likes: 234,
            retweets: 45,
            engagement: 0.67
          },
          sentiment: {
            score: 0.8,
            label: 'positive',
            confidence: 0.9
          },
          mentions: ['Bitcoin', 'BTC'],
          hashtags: ['Bitcoin', 'BTC'],
          influence: 0.75
        }
      ];

      return mockPosts;
    } catch (error) {
      console.error('Error getting social media sentiment:', error);
      return [];
    }
  }

  private createNewsError(code: string, message: string, details?: any): NewsError {
    return {
      code,
      message,
      timestamp: new Date().toISOString(),
      details
    };
  }

  // Additional utility methods
  extractTags(text: string): string[] {
    const cryptoTerms = [
      'bitcoin', 'btc', 'ethereum', 'eth', 'defi', 'nft', 'blockchain',
      'crypto', 'cryptocurrency', 'altcoin', 'staking', 'mining', 'trading',
      'regulation', 'adoption', 'yield', 'liquidity', 'bridge', 'layer2'
    ];

    const lowerText = text.toLowerCase();
    return cryptoTerms.filter(term => lowerText.includes(term));
  }

  calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  }

  async getNewsSources(): Promise<NewsSource[]> {
    return this.apiSources.filter(source => source.isActive);
  }

  async updateSourceStatus(sourceId: string, isActive: boolean): Promise<void> {
    const source = this.apiSources.find(s => s.id === sourceId);
    if (source) {
      source.isActive = isActive;
    }
  }
}

export const newsService = new NewsService();
export default NewsService;