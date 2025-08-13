# CP-041: Real-time Cryptocurrency News Feed Integration

## Overview
Integrate real-time cryptocurrency news feeds with sentiment analysis, personalized filtering, and portfolio-relevant news alerts to keep users informed about market-moving events.

## Objectives
- Aggregate news from multiple cryptocurrency sources
- Implement sentiment analysis for news articles
- Create personalized news filtering based on portfolio holdings
- Build real-time news alerts and notifications

## Acceptance Criteria
- [ ] Real-time news feed aggregation from multiple sources
- [ ] Sentiment analysis with positive/negative/neutral classification
- [ ] Portfolio-relevant news filtering and highlights
- [ ] News categorization (market updates, regulations, technology, etc.)
- [ ] Search and filter functionality for news articles
- [ ] News alerts based on keywords and portfolio assets
- [ ] Social media integration (Twitter, Reddit sentiment)
- [ ] News impact correlation with price movements
- [ ] Bookmarking and reading history
- [ ] Mobile-optimized news reading experience

## Technical Implementation

### File Structure
```
src/
  components/
    News/
      NewsFeed.jsx
      NewsCard.jsx
      NewsFilters.jsx
      NewsAlerts.jsx
      SentimentIndicator.jsx
      TrendingNews.jsx
  hooks/
    useNewsFeed.js
    useNewsAlerts.js
    useNewsSentiment.js
  services/
    NewsService.js
    SentimentAnalysisService.js
    NewsAggregatorService.js
  types/
    news.types.js
  utils/
    newsUtils.js
    sentimentUtils.js
```

### News Feed Component
```jsx
// NewsFeed.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNewsFeed } from '../hooks/useNewsFeed';
import { useNewsAlerts } from '../hooks/useNewsAlerts';
import NewsCard from './NewsCard';
import NewsFilters from './NewsFilters';
import SentimentIndicator from './SentimentIndicator';
import TrendingNews from './TrendingNews';

const NewsFeed = ({ portfolioAssets = [], showPortfolioNews = true }) => {
  const [filters, setFilters] = useState({
    category: 'all',
    sentiment: 'all',
    source: 'all',
    timeframe: '24h',
    portfolioOnly: false
  });
  
  const [viewMode, setViewMode] = useState('feed'); // feed, trending, alerts
  const [selectedNews, setSelectedNews] = useState(null);
  const newsContainerRef = useRef(null);

  const {
    news,
    trendingNews,
    portfolioNews,
    isLoading,
    hasMore,
    loadMore,
    refresh
  } = useNewsFeed(filters, portfolioAssets);

  const {
    alerts,
    createAlert,
    removeAlert,
    alertHistory
  } = useNewsAlerts(portfolioAssets);

  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refresh();
      }, 60000); // Refresh every minute

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refresh]);

  // Infinite scroll handler
  useEffect(() => {
    const container = newsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop <= clientHeight * 1.5) {
        if (hasMore && !isLoading) {
          loadMore();
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoading, loadMore]);

  const handleFilterChange = (newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleNewsClick = (newsItem) => {
    setSelectedNews(newsItem);
  };

  const handleBookmark = (newsItem) => {
    // Add to bookmarks
    console.log('Bookmarking:', newsItem.title);
  };

  const handleShare = (newsItem) => {
    if (navigator.share) {
      navigator.share({
        title: newsItem.title,
        text: newsItem.summary,
        url: newsItem.url
      });
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(newsItem.url);
    }
  };

  const getDisplayedNews = () => {
    switch (viewMode) {
      case 'trending':
        return trendingNews;
      case 'portfolio':
        return portfolioNews;
      case 'alerts':
        return alertHistory;
      default:
        return news;
    }
  };

  const renderNewsStats = () => {
    const totalNews = news.length;
    const positiveNews = news.filter(n => n.sentiment?.score > 0.1).length;
    const negativeNews = news.filter(n => n.sentiment?.score < -0.1).length;
    const neutralNews = totalNews - positiveNews - negativeNews;

    return (
      <div className="news-stats">
        <div className="stat-item">
          <span className="stat-label">Total</span>
          <span className="stat-value">{totalNews}</span>
        </div>
        <div className="stat-item positive">
          <span className="stat-label">Positive</span>
          <span className="stat-value">{positiveNews}</span>
        </div>
        <div className="stat-item negative">
          <span className="stat-label">Negative</span>
          <span className="stat-value">{negativeNews}</span>
        </div>
        <div className="stat-item neutral">
          <span className="stat-label">Neutral</span>
          <span className="stat-value">{neutralNews}</span>
        </div>
      </div>
    );
  };

  const renderViewModeSelector = () => (
    <div className="view-mode-selector">
      <button
        className={`mode-btn ${viewMode === 'feed' ? 'active' : ''}`}
        onClick={() => setViewMode('feed')}
      >
        📰 All News
      </button>
      <button
        className={`mode-btn ${viewMode === 'trending' ? 'active' : ''}`}
        onClick={() => setViewMode('trending')}
      >
        🔥 Trending
      </button>
      {showPortfolioNews && (
        <button
          className={`mode-btn ${viewMode === 'portfolio' ? 'active' : ''}`}
          onClick={() => setViewMode('portfolio')}
        >
          💼 Portfolio
        </button>
      )}
      <button
        className={`mode-btn ${viewMode === 'alerts' ? 'active' : ''}`}
        onClick={() => setViewMode('alerts')}
      >
        🔔 Alerts
      </button>
    </div>
  );

  return (
    <div className="news-feed">
      <div className="news-feed-header">
        <div className="header-top">
          <h2>Cryptocurrency News</h2>
          <div className="header-controls">
            <button
              className={`auto-refresh-btn ${autoRefresh ? 'active' : ''}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              title="Auto refresh"
            >
              🔄
            </button>
            <button
              className="refresh-btn"
              onClick={refresh}
              disabled={isLoading}
              title="Refresh now"
            >
              ↻
            </button>
          </div>
        </div>

        {renderViewModeSelector()}
        {renderNewsStats()}
      </div>

      <NewsFilters
        filters={filters}
        onChange={handleFilterChange}
        portfolioAssets={portfolioAssets}
      />

      <div className="news-content">
        {viewMode === 'trending' && (
          <TrendingNews
            trendingNews={trendingNews}
            onNewsClick={handleNewsClick}
          />
        )}

        <div 
          className="news-list-container"
          ref={newsContainerRef}
        >
          {isLoading && news.length === 0 ? (
            <div className="news-loading">
              <div className="loading-spinner"></div>
              <p>Loading latest news...</p>
            </div>
          ) : (
            <div className="news-list">
              {getDisplayedNews().map((newsItem, index) => (
                <NewsCard
                  key={`${newsItem.id}-${index}`}
                  news={newsItem}
                  onClick={() => handleNewsClick(newsItem)}
                  onBookmark={() => handleBookmark(newsItem)}
                  onShare={() => handleShare(newsItem)}
                  isPortfolioRelevant={portfolioNews.includes(newsItem)}
                />
              ))}
              
              {isLoading && (
                <div className="loading-more">
                  <div className="loading-spinner"></div>
                  <p>Loading more news...</p>
                </div>
              )}
              
              {!hasMore && news.length > 0 && (
                <div className="end-of-news">
                  <p>You've reached the end of the news feed</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedNews && (
        <div className="news-modal-overlay" onClick={() => setSelectedNews(null)}>
          <div className="news-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedNews.title}</h3>
              <button
                className="close-modal"
                onClick={() => setSelectedNews(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="news-meta">
                <span className="news-source">{selectedNews.source}</span>
                <span className="news-date">
                  {new Date(selectedNews.publishedAt).toLocaleString()}
                </span>
                <SentimentIndicator sentiment={selectedNews.sentiment} />
              </div>
              
              {selectedNews.image && (
                <img
                  src={selectedNews.image}
                  alt={selectedNews.title}
                  className="news-image"
                />
              )}
              
              <div className="news-content">
                <p className="news-summary">{selectedNews.summary}</p>
                {selectedNews.content && (
                  <div className="news-full-content">
                    {selectedNews.content}
                  </div>
                )}
              </div>
              
              <div className="modal-actions">
                <a
                  href={selectedNews.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="read-full-btn"
                >
                  Read Full Article
                </a>
                <button
                  onClick={() => handleBookmark(selectedNews)}
                  className="bookmark-btn"
                >
                  🔖 Bookmark
                </button>
                <button
                  onClick={() => handleShare(selectedNews)}
                  className="share-btn"
                >
                  📤 Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsFeed;
```

### News Feed Hook
```javascript
// useNewsFeed.js
import { useState, useEffect, useCallback } from 'react';
import { newsService } from '../services/NewsService';

export const useNewsFeed = (filters, portfolioAssets) => {
  const [news, setNews] = useState([]);
  const [trendingNews, setTrendingNews] = useState([]);
  const [portfolioNews, setPortfolioNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);

  const loadNews = useCallback(async (pageNum = 1, append = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const [newsData, trendingData] = await Promise.all([
        newsService.getNews({ ...filters, page: pageNum }),
        pageNum === 1 ? newsService.getTrendingNews() : Promise.resolve(null)
      ]);

      if (append) {
        setNews(prev => [...prev, ...newsData.articles]);
      } else {
        setNews(newsData.articles);
      }

      if (trendingData) {
        setTrendingNews(trendingData.articles);
      }

      // Filter portfolio-relevant news
      if (portfolioAssets.length > 0) {
        const portfolioRelevant = newsData.articles.filter(article =>
          portfolioAssets.some(asset =>
            article.title.toLowerCase().includes(asset.toLowerCase()) ||
            article.summary?.toLowerCase().includes(asset.toLowerCase()) ||
            article.tags?.includes(asset.toLowerCase())
          )
        );
        
        if (append) {
          setPortfolioNews(prev => [...prev, ...portfolioRelevant]);
        } else {
          setPortfolioNews(portfolioRelevant);
        }
      }

      setHasMore(newsData.hasMore);
      setPage(pageNum);

    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [filters, portfolioAssets]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      loadNews(page + 1, true);
    }
  }, [hasMore, isLoading, page, loadNews]);

  const refresh = useCallback(() => {
    loadNews(1, false);
  }, [loadNews]);

  useEffect(() => {
    loadNews(1, false);
  }, [loadNews]);

  return {
    news,
    trendingNews,
    portfolioNews,
    isLoading,
    hasMore,
    error,
    loadMore,
    refresh
  };
};
```

### News Service
```javascript
// NewsService.js
import { sentimentAnalysisService } from './SentimentAnalysisService';

class NewsService {
  constructor() {
    this.apiSources = [
      'https://api.coindesk.com',
      'https://api.cointelegraph.com',
      'https://newsapi.org/v2',
      'https://api.cryptopanic.com'
    ];
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  async getNews(filters = {}) {
    try {
      const cacheKey = JSON.stringify(filters);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }

      // Aggregate news from multiple sources
      const newsPromises = [
        this.getCoinDeskNews(filters),
        this.getCoinTelegraphNews(filters),
        this.getNewsAPINews(filters),
        this.getCryptoPanicNews(filters)
      ];

      const results = await Promise.allSettled(newsPromises);
      const allNews = [];

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          allNews.push(...result.value);
        }
      });

      // Deduplicate and sort by relevance
      const uniqueNews = this.deduplicateNews(allNews);
      const sortedNews = this.sortNewsByRelevance(uniqueNews, filters);
      
      // Add sentiment analysis
      const newsWithSentiment = await this.addSentimentAnalysis(sortedNews);

      // Apply filters
      const filteredNews = this.applyFilters(newsWithSentiment, filters);

      const result = {
        articles: filteredNews,
        hasMore: filteredNews.length >= 20,
        totalResults: filteredNews.length
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error fetching news:', error);
      throw error;
    }
  }

  async getCoinDeskNews(filters) {
    try {
      // Mock implementation - replace with actual API call
      return [
        {
          id: 'cd1',
          title: 'Bitcoin Hits New All-Time High as Institutional Adoption Grows',
          summary: 'Bitcoin reached a new milestone today as major corporations continue to add BTC to their treasury reserves.',
          content: 'Full article content...',
          url: 'https://coindesk.com/article1',
          source: 'CoinDesk',
          publishedAt: new Date().toISOString(),
          image: 'https://example.com/bitcoin-image.jpg',
          tags: ['bitcoin', 'institutional', 'adoption'],
          category: 'market'
        }
      ];
    } catch (error) {
      console.error('Error fetching CoinDesk news:', error);
      return [];
    }
  }

  async getCoinTelegraphNews(filters) {
    try {
      // Mock implementation
      return [
        {
          id: 'ct1',
          title: 'Ethereum 2.0 Staking Rewards Reach All-Time High',
          summary: 'Ethereum staking has become increasingly profitable as network activity surges.',
          content: 'Full article content...',
          url: 'https://cointelegraph.com/article1',
          source: 'Cointelegraph',
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
          image: 'https://example.com/ethereum-image.jpg',
          tags: ['ethereum', 'staking', 'rewards'],
          category: 'technology'
        }
      ];
    } catch (error) {
      console.error('Error fetching Cointelegraph news:', error);
      return [];
    }
  }

  async getNewsAPINews(filters) {
    try {
      const apiKey = process.env.REACT_APP_NEWS_API_KEY;
      if (!apiKey) return [];

      const response = await fetch(`https://newsapi.org/v2/everything?q=cryptocurrency&apiKey=${apiKey}&pageSize=20`);
      const data = await response.json();

      return data.articles?.map(article => ({
        id: `newsapi-${article.url}`,
        title: article.title,
        summary: article.description,
        content: article.content,
        url: article.url,
        source: article.source.name,
        publishedAt: article.publishedAt,
        image: article.urlToImage,
        tags: this.extractTags(article.title + ' ' + article.description),
        category: 'general'
      })) || [];
    } catch (error) {
      console.error('Error fetching NewsAPI news:', error);
      return [];
    }
  }

  async getCryptoPanicNews(filters) {
    try {
      // Mock implementation
      return [
        {
          id: 'cp1',
          title: 'DeFi Protocol Launches Revolutionary Yield Farming Feature',
          summary: 'A new DeFi protocol promises unprecedented yields through innovative farming mechanisms.',
          content: 'Full article content...',
          url: 'https://cryptopanic.com/article1',
          source: 'CryptoPanic',
          publishedAt: new Date(Date.now() - 7200000).toISOString(),
          tags: ['defi', 'yield-farming', 'innovation'],
          category: 'technology'
        }
      ];
    } catch (error) {
      console.error('Error fetching CryptoPanic news:', error);
      return [];
    }
  }

  deduplicateNews(newsArray) {
    const seen = new Set();
    return newsArray.filter(news => {
      const key = news.title.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  sortNewsByRelevance(newsArray, filters) {
    return newsArray.sort((a, b) => {
      // Sort by recency first
      const dateA = new Date(a.publishedAt);
      const dateB = new Date(b.publishedAt);
      
      if (dateB - dateA !== 0) {
        return dateB - dateA;
      }

      // Then by source credibility (CoinDesk, Cointelegraph higher)
      const sourceScores = {
        'CoinDesk': 10,
        'Cointelegraph': 9,
        'CryptoPanic': 7,
        'default': 5
      };

      const scoreA = sourceScores[a.source] || sourceScores.default;
      const scoreB = sourceScores[b.source] || sourceScores.default;

      return scoreB - scoreA;
    });
  }

  async addSentimentAnalysis(newsArray) {
    const newsWithSentiment = await Promise.all(
      newsArray.map(async (news) => {
        try {
          const sentiment = await sentimentAnalysisService.analyzeSentiment(
            news.title + ' ' + news.summary
          );
          return { ...news, sentiment };
        } catch (error) {
          console.error('Error analyzing sentiment:', error);
          return { ...news, sentiment: { score: 0, label: 'neutral' } };
        }
      })
    );

    return newsWithSentiment;
  }

  applyFilters(newsArray, filters) {
    return newsArray.filter(news => {
      // Category filter
      if (filters.category && filters.category !== 'all') {
        if (news.category !== filters.category) return false;
      }

      // Sentiment filter
      if (filters.sentiment && filters.sentiment !== 'all') {
        if (filters.sentiment === 'positive' && news.sentiment?.score <= 0.1) return false;
        if (filters.sentiment === 'negative' && news.sentiment?.score >= -0.1) return false;
        if (filters.sentiment === 'neutral' && Math.abs(news.sentiment?.score || 0) > 0.1) return false;
      }

      // Source filter
      if (filters.source && filters.source !== 'all') {
        if (news.source !== filters.source) return false;
      }

      // Timeframe filter
      if (filters.timeframe) {
        const publishDate = new Date(news.publishedAt);
        const now = new Date();
        const hoursDiff = (now - publishDate) / (1000 * 60 * 60);
        
        switch (filters.timeframe) {
          case '1h':
            if (hoursDiff > 1) return false;
            break;
          case '6h':
            if (hoursDiff > 6) return false;
            break;
          case '24h':
            if (hoursDiff > 24) return false;
            break;
          case '7d':
            if (hoursDiff > 168) return false;
            break;
        }
      }

      return true;
    });
  }

  extractTags(text) {
    const cryptoTerms = [
      'bitcoin', 'btc', 'ethereum', 'eth', 'defi', 'nft', 'blockchain',
      'crypto', 'cryptocurrency', 'altcoin', 'staking', 'mining', 'trading'
    ];

    const lowerText = text.toLowerCase();
    return cryptoTerms.filter(term => lowerText.includes(term));
  }

  async getTrendingNews() {
    try {
      // Get news and find trending topics
      const allNews = await this.getNews({ timeframe: '24h' });
      
      // Simple trending algorithm based on keyword frequency
      const keywordCounts = {};
      allNews.articles.forEach(news => {
        news.tags?.forEach(tag => {
          keywordCounts[tag] = (keywordCounts[tag] || 0) + 1;
        });
      });

      const trendingKeywords = Object.entries(keywordCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([keyword]) => keyword);

      const trendingArticles = allNews.articles.filter(news =>
        news.tags?.some(tag => trendingKeywords.includes(tag))
      ).slice(0, 10);

      return {
        articles: trendingArticles,
        trendingKeywords
      };
    } catch (error) {
      console.error('Error getting trending news:', error);
      return { articles: [], trendingKeywords: [] };
    }
  }

  async searchNews(query, filters = {}) {
    try {
      const allNews = await this.getNews(filters);
      const lowerQuery = query.toLowerCase();
      
      const searchResults = allNews.articles.filter(news =>
        news.title.toLowerCase().includes(lowerQuery) ||
        news.summary?.toLowerCase().includes(lowerQuery) ||
        news.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );

      return {
        articles: searchResults,
        query,
        totalResults: searchResults.length
      };
    } catch (error) {
      console.error('Error searching news:', error);
      throw error;
    }
  }
}

export const newsService = new NewsService();
```

## Testing Requirements
- News aggregation accuracy testing
- Sentiment analysis validation
- Real-time update functionality testing
- Mobile responsiveness testing
- Performance testing with large news volumes

## Dependencies
- Depends on: CP-033 (Notification System)
- Depends on: CP-034 (Mobile Responsive Design)
- Blocks: CP-042 (Social Trading Features)

## Time Estimate
**Beginner**: 8-10 days
**Intermediate**: 5-7 days
**Advanced**: 3-5 days

## Required Skills
- News API integration
- Sentiment analysis concepts
- Real-time data processing
- Text processing and natural language processing
- Infinite scroll and performance optimization