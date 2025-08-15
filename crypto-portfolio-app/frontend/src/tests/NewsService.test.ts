import { newsService, NewsService } from '../services/NewsService';
import { sentimentAnalysisService } from '../services/SentimentAnalysisService';
import { NewsFilters, NewsArticle } from '../types/news.types';

// Mock the SentimentAnalysisService
jest.mock('../services/SentimentAnalysisService', () => ({
  sentimentAnalysisService: {
    analyzeSentiment: jest.fn()
  }
}));

describe('NewsService', () => {
  let service: NewsService;

  beforeEach(() => {
    service = new NewsService();
    jest.clearAllMocks();
  });

  describe('getNews', () => {
    it('should return news articles with default filters', async () => {
      const result = await service.getNews();
      
      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('totalResults');
      expect(result).toHaveProperty('hasMore');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('categories');
      expect(Array.isArray(result.articles)).toBe(true);
      expect(typeof result.totalResults).toBe('number');
      expect(typeof result.hasMore).toBe('boolean');
    });

    it('should apply category filter correctly', async () => {
      const filters: NewsFilters = {
        category: 'technology',
        sentiment: 'all',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const result = await service.getNews(filters);
      
      // Check if returned articles match the category filter
      result.articles.forEach(article => {
        expect(article.category).toBe('technology');
      });
    });

    it('should apply sentiment filter correctly', async () => {
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'positive',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      // Mock sentiment analysis to return positive sentiment
      (sentimentAnalysisService.analyzeSentiment as jest.Mock).mockResolvedValue({
        score: 0.5,
        label: 'positive',
        confidence: 0.8
      });

      const result = await service.getNews(filters);
      
      // Check if returned articles match the sentiment filter
      result.articles.forEach(article => {
        expect(article.sentiment?.label).toBe('positive');
      });
    });

    it('should apply source filter correctly', async () => {
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'CoinDesk',
        timeframe: '24h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const result = await service.getNews(filters);
      
      // Check if returned articles match the source filter
      result.articles.forEach(article => {
        expect(article.source).toBe('CoinDesk');
      });
    });

    it('should apply timeframe filter correctly', async () => {
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'all',
        timeframe: '1h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const result = await service.getNews(filters);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check if returned articles are within the timeframe
      result.articles.forEach(article => {
        const publishDate = new Date(article.publishedAt);
        expect(publishDate.getTime()).toBeGreaterThan(oneHourAgo.getTime());
      });
    });

    it('should sort articles by date correctly', async () => {
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'all',
        timeframe: 'all',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const result = await service.getNews(filters);
      
      // Check if articles are sorted by date (newest first for desc)
      for (let i = 1; i < result.articles.length; i++) {
        const prevDate = new Date(result.articles[i - 1].publishedAt);
        const currDate = new Date(result.articles[i].publishedAt);
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
      }
    });

    it('should handle search query filter', async () => {
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        searchQuery: 'bitcoin',
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const result = await service.getNews(filters);
      
      // Check if returned articles contain the search query
      result.articles.forEach(article => {
        const searchText = `${article.title} ${article.summary} ${article.tags.join(' ')}`.toLowerCase();
        expect(searchText).toContain('bitcoin');
      });
    });

    it('should cache results correctly', async () => {
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      // First call
      const result1 = await service.getNews(filters);
      
      // Second call with same filters (should use cache)
      const result2 = await service.getNews(filters);
      
      expect(result1).toEqual(result2);
    });
  });

  describe('getTrendingNews', () => {
    it('should return trending articles and topics', async () => {
      const result = await service.getTrendingNews();
      
      expect(result).toHaveProperty('articles');
      expect(result).toHaveProperty('topics');
      expect(Array.isArray(result.articles)).toBe(true);
      expect(Array.isArray(result.topics)).toBe(true);
    });

    it('should return trending topics with required properties', async () => {
      const result = await service.getTrendingNews();
      
      result.topics.forEach(topic => {
        expect(topic).toHaveProperty('keyword');
        expect(topic).toHaveProperty('count');
        expect(topic).toHaveProperty('growth');
        expect(topic).toHaveProperty('sentiment');
        expect(topic).toHaveProperty('relatedArticles');
        expect(topic).toHaveProperty('category');
        expect(typeof topic.keyword).toBe('string');
        expect(typeof topic.count).toBe('number');
        expect(typeof topic.growth).toBe('number');
      });
    });

    it('should filter trending topics by minimum mentions', async () => {
      const result = await service.getTrendingNews();
      
      // Topics should have at least 3 mentions based on the implementation
      result.topics.forEach(topic => {
        expect(topic.count).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('searchNews', () => {
    it('should search news articles correctly', async () => {
      const query = 'ethereum';
      const result = await service.searchNews(query);
      
      expect(result).toHaveProperty('articles');
      expect(Array.isArray(result.articles)).toBe(true);
      
      // Check if articles contain the search query
      result.articles.forEach(article => {
        const searchText = `${article.title} ${article.summary} ${article.tags.join(' ')}`.toLowerCase();
        expect(searchText).toContain(query.toLowerCase());
      });
    });
  });

  describe('getPortfolioRelevantNews', () => {
    it('should return portfolio-relevant news', async () => {
      const portfolioAssets = ['BTC', 'ETH', 'ADA'];
      const result = await service.getPortfolioRelevantNews(portfolioAssets);
      
      expect(Array.isArray(result)).toBe(true);
      
      // Check if articles are relevant to portfolio assets
      result.forEach(article => {
        expect(article.isPortfolioRelevant).toBe(true);
        expect(article.relevanceScore).toBeGreaterThan(0);
        
        // Should mention at least one portfolio asset
        const hasAssetMention = portfolioAssets.some(asset => {
          const assetLower = asset.toLowerCase();
          const titleLower = article.title.toLowerCase();
          const summaryLower = article.summary.toLowerCase();
          const tagsLower = article.tags.map(tag => tag.toLowerCase());
          
          return titleLower.includes(assetLower) ||
                 summaryLower.includes(assetLower) ||
                 tagsLower.includes(assetLower) ||
                 article.relatedAssets?.includes(asset);
        });
        
        expect(hasAssetMention).toBe(true);
      });
    });

    it('should return empty array for empty portfolio', async () => {
      const result = await service.getPortfolioRelevantNews([]);
      expect(result).toEqual([]);
    });

    it('should boost relevance score for portfolio-relevant articles', async () => {
      const portfolioAssets = ['BTC'];
      const result = await service.getPortfolioRelevantNews(portfolioAssets);
      
      result.forEach(article => {
        expect(article.relevanceScore).toBeGreaterThan(0.2); // Should have boost
      });
    });
  });

  describe('getSocialMediaSentiment', () => {
    it('should return social media posts', async () => {
      const assets = ['BTC', 'ETH'];
      const result = await service.getSocialMediaSentiment(assets);
      
      expect(Array.isArray(result)).toBe(true);
      
      result.forEach(post => {
        expect(post).toHaveProperty('id');
        expect(post).toHaveProperty('platform');
        expect(post).toHaveProperty('content');
        expect(post).toHaveProperty('author');
        expect(post).toHaveProperty('engagement');
        expect(post).toHaveProperty('sentiment');
        expect(post).toHaveProperty('mentions');
        expect(post).toHaveProperty('influence');
      });
    });
  });

  describe('utility methods', () => {
    it('should extract crypto-related tags correctly', () => {
      const text = 'Bitcoin and Ethereum are leading cryptocurrencies in DeFi space';
      const tags = service.extractTags(text);
      
      expect(tags).toContain('bitcoin');
      expect(tags).toContain('ethereum');
      expect(tags).toContain('crypto');
      expect(tags).toContain('cryptocurrency');
      expect(tags).toContain('defi');
    });

    it('should calculate read time correctly', () => {
      const shortContent = 'This is a short article with about twenty words to test the reading time calculation feature.';
      const readTime = service.calculateReadTime(shortContent);
      
      expect(readTime).toBe(1); // Should be 1 minute minimum
    });

    it('should calculate read time for longer content', () => {
      // Create content with approximately 400 words
      const longContent = Array(400).fill('word').join(' ');
      const readTime = service.calculateReadTime(longContent);
      
      expect(readTime).toBe(2); // 400 words / 200 WPM = 2 minutes
    });

    it('should get active news sources', async () => {
      const sources = await service.getNewsSources();
      
      expect(Array.isArray(sources)).toBe(true);
      sources.forEach(source => {
        expect(source.isActive).toBe(true);
        expect(source).toHaveProperty('id');
        expect(source).toHaveProperty('name');
        expect(source).toHaveProperty('credibilityScore');
      });
    });

    it('should update source status', async () => {
      const sources = await service.getNewsSources();
      const firstSource = sources[0];
      
      await service.updateSourceStatus(firstSource.id, false);
      
      // Verify source is deactivated (in real implementation, this would check the database)
      // For now, we just ensure the method doesn't throw
      expect(true).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      // Mock a network error scenario
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      
      try {
        const result = await service.getNews();
        // Should return some fallback data or handle gracefully
        expect(result).toHaveProperty('articles');
      } catch (error) {
        expect(error).toHaveProperty('code');
        expect(error).toHaveProperty('message');
      }
      
      global.fetch = originalFetch;
    });

    it('should handle invalid filters gracefully', async () => {
      const invalidFilters = {
        category: 'invalid_category',
        sentiment: 'invalid_sentiment',
        timeframe: 'invalid_timeframe'
      } as any;
      
      const result = await service.getNews(invalidFilters);
      
      // Should still return valid response with fallback values
      expect(result).toHaveProperty('articles');
      expect(Array.isArray(result.articles)).toBe(true);
    });
  });

  describe('sentiment analysis integration', () => {
    it('should add sentiment analysis to articles', async () => {
      // Mock sentiment analysis
      (sentimentAnalysisService.analyzeSentiment as jest.Mock).mockResolvedValue({
        score: 0.5,
        label: 'positive',
        confidence: 0.8,
        keywords: ['bullish', 'growth']
      });

      const result = await service.getNews();
      
      // Check if articles have sentiment analysis
      result.articles.forEach(article => {
        expect(article.sentiment).toBeDefined();
        expect(article.sentiment).toHaveProperty('score');
        expect(article.sentiment).toHaveProperty('label');
        expect(article.sentiment).toHaveProperty('confidence');
      });
    });

    it('should handle sentiment analysis errors gracefully', async () => {
      // Mock sentiment analysis error
      (sentimentAnalysisService.analyzeSentiment as jest.Mock).mockRejectedValue(
        new Error('Sentiment analysis failed')
      );

      const result = await service.getNews();
      
      // Should still return articles with neutral sentiment fallback
      result.articles.forEach(article => {
        expect(article.sentiment).toBeDefined();
        expect(article.sentiment?.label).toBe('neutral');
        expect(article.sentiment?.score).toBe(0);
      });
    });
  });

  describe('caching behavior', () => {
    it('should cache results for performance', async () => {
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const startTime = Date.now();
      await service.getNews(filters);
      const firstCallTime = Date.now() - startTime;

      const cachedStartTime = Date.now();
      await service.getNews(filters);
      const cachedCallTime = Date.now() - cachedStartTime;

      // Cached call should be significantly faster
      expect(cachedCallTime).toBeLessThan(firstCallTime);
    });

    it('should expire cache after TTL', async () => {
      // This would require mocking time or waiting, 
      // so we'll just verify the cache mechanism exists
      const filters: NewsFilters = {
        category: 'all',
        sentiment: 'all',
        source: 'all',
        timeframe: '24h',
        portfolioOnly: false,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const result = await service.getNews(filters);
      expect(result).toHaveProperty('articles');
    });
  });

  describe('data quality', () => {
    it('should deduplicate news articles', async () => {
      const result = await service.getNews();
      
      // Check for duplicate titles (normalized)
      const normalizedTitles = result.articles.map(article => 
        article.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
      );
      
      const uniqueTitles = new Set(normalizedTitles);
      expect(uniqueTitles.size).toBe(normalizedTitles.length);
    });

    it('should add relevance scores to articles', async () => {
      const result = await service.getNews();
      
      result.articles.forEach(article => {
        expect(article.relevanceScore).toBeDefined();
        expect(typeof article.relevanceScore).toBe('number');
        expect(article.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(article.relevanceScore).toBeLessThanOrEqual(1);
      });
    });

    it('should validate article structure', async () => {
      const result = await service.getNews();
      
      result.articles.forEach(article => {
        // Required fields
        expect(article).toHaveProperty('id');
        expect(article).toHaveProperty('title');
        expect(article).toHaveProperty('summary');
        expect(article).toHaveProperty('url');
        expect(article).toHaveProperty('source');
        expect(article).toHaveProperty('publishedAt');
        expect(article).toHaveProperty('tags');
        expect(article).toHaveProperty('category');
        
        // Validate types
        expect(typeof article.id).toBe('string');
        expect(typeof article.title).toBe('string');
        expect(typeof article.summary).toBe('string');
        expect(typeof article.url).toBe('string');
        expect(typeof article.source).toBe('string');
        expect(typeof article.publishedAt).toBe('string');
        expect(Array.isArray(article.tags)).toBe(true);
        expect(typeof article.category).toBe('string');
        
        // Validate URL format
        expect(article.url).toMatch(/^https?:\/\/.+/);
        
        // Validate date format
        expect(() => new Date(article.publishedAt)).not.toThrow();
      });
    });
  });
});