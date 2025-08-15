import { useState, useEffect, useCallback, useMemo } from 'react';
import { newsService } from '../services/NewsService';
import { sentimentAnalysisService } from '../services/SentimentAnalysisService';
import { 
  NewsArticle, 
  NewsFilters, 
  NewsMetrics, 
  NewsError,
  TrendingTopic,
  UseNewsFeedReturn 
} from '../types/news.types';

export const useNewsFeed = (
  initialFilters: Partial<NewsFilters> = {},
  portfolioAssets: string[] = []
): UseNewsFeedReturn => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [trendingNews, setTrendingNews] = useState<NewsArticle[]>([]);
  const [portfolioNews, setPortfolioNews] = useState<NewsArticle[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<NewsError | null>(null);
  const [currentFilters, setCurrentFilters] = useState<NewsFilters>({
    category: 'all',
    sentiment: 'all',
    source: 'all',
    timeframe: '24h',
    portfolioOnly: false,
    sortBy: 'date',
    sortOrder: 'desc',
    ...initialFilters
  });
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5 * 60 * 1000); // 5 minutes

  const loadNews = useCallback(async (
    filters: NewsFilters = currentFilters,
    isRefresh: boolean = false
  ) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const response = await newsService.getNews(filters);
      
      if (isRefresh) {
        setNews(response.articles);
        setPage(1);
      } else {
        setNews(prev => page === 1 ? response.articles : [...prev, ...response.articles]);
      }
      
      setHasMore(response.hasMore);
      
    } catch (err) {
      console.error('Error loading news:', err);
      setError({
        code: 'LOAD_ERROR',
        message: 'Failed to load news',
        timestamp: new Date().toISOString(),
        details: err
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [currentFilters, page]);

  const loadTrendingNews = useCallback(async () => {
    try {
      const trending = await newsService.getTrendingNews();
      setTrendingNews(trending.articles);
      setTrendingTopics(trending.topics);
    } catch (err) {
      console.error('Error loading trending news:', err);
    }
  }, []);

  const loadPortfolioNews = useCallback(async () => {
    if (portfolioAssets.length === 0) {
      setPortfolioNews([]);
      return;
    }

    try {
      const portfolioRelevant = await newsService.getPortfolioRelevantNews(
        portfolioAssets,
        { ...currentFilters, portfolioOnly: true }
      );
      setPortfolioNews(portfolioRelevant);
    } catch (err) {
      console.error('Error loading portfolio news:', err);
    }
  }, [portfolioAssets, currentFilters]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    
    setPage(prev => prev + 1);
    await loadNews(currentFilters, false);
  }, [hasMore, isLoading, loadNews, currentFilters]);

  const refresh = useCallback(async () => {
    setPage(1);
    await Promise.all([
      loadNews(currentFilters, true),
      loadTrendingNews(),
      loadPortfolioNews()
    ]);
  }, [loadNews, loadTrendingNews, loadPortfolioNews, currentFilters]);

  const searchNews = useCallback(async (query: string) => {
    setSearchQuery(query);
    const searchFilters = { ...currentFilters, searchQuery: query };
    setCurrentFilters(searchFilters);
    setPage(1);
    await loadNews(searchFilters, true);
  }, [currentFilters, loadNews]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    const clearedFilters = { ...currentFilters };
    delete clearedFilters.searchQuery;
    setCurrentFilters(clearedFilters);
    setPage(1);
    loadNews(clearedFilters, true);
  }, [currentFilters, loadNews]);

  const updateFilters = useCallback(async (newFilters: Partial<NewsFilters>) => {
    const updatedFilters = { ...currentFilters, ...newFilters };
    setCurrentFilters(updatedFilters);
    setPage(1);
    await loadNews(updatedFilters, true);
  }, [currentFilters, loadNews]);

  // Calculate metrics
  const metrics = useMemo((): NewsMetrics => {
    const allNews = [...news, ...portfolioNews];
    
    const categoryCounts = allNews.reduce((acc, article) => {
      acc[article.category] = (acc[article.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sentimentDistribution = allNews.reduce((acc, article) => {
      if (article.sentiment) {
        acc[article.sentiment.label] = (acc[article.sentiment.label] || 0) + 1;
      }
      return acc;
    }, { positive: 0, negative: 0, neutral: 0 });

    const sourceDistribution = allNews.reduce((acc, article) => {
      acc[article.source] = (acc[article.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgSentimentScore = allNews
      .filter(article => article.sentiment)
      .reduce((sum, article) => sum + (article.sentiment?.score || 0), 0) / 
      allNews.filter(article => article.sentiment).length || 0;

    const trendingKeywords = trendingTopics
      .slice(0, 10)
      .map(topic => topic.keyword);

    return {
      totalArticles: allNews.length,
      categoryCounts,
      sentimentDistribution,
      sourceDistribution,
      avgSentimentScore: Number(avgSentimentScore.toFixed(3)),
      trendingKeywords,
      portfolioRelevantCount: portfolioNews.length,
      readingStats: {
        totalRead: 0, // Would be tracked in real implementation
        avgReadTime: 0,
        bookmarkedCount: 0
      }
    };
  }, [news, portfolioNews, trendingTopics]);

  // Initial load
  useEffect(() => {
    refresh();
  }, []);

  // Portfolio assets change
  useEffect(() => {
    loadPortfolioNews();
  }, [loadPortfolioNews]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      if (!isLoading && !refreshing) {
        refresh();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, isLoading, refreshing, refresh]);

  // Additional utility functions
  const getNewsByCategory = useCallback((category: string) => {
    return news.filter(article => article.category === category);
  }, [news]);

  const getNewsBySentiment = useCallback((sentiment: 'positive' | 'negative' | 'neutral') => {
    return news.filter(article => article.sentiment?.label === sentiment);
  }, [news]);

  const getNewsWithHighEngagement = useCallback((threshold: number = 0.7) => {
    return news.filter(article => 
      article.socialStats && article.socialStats.engagement >= threshold
    );
  }, [news]);

  const markAsRead = useCallback(async (articleId: string) => {
    // In a real implementation, this would call an API to mark the article as read
    setNews(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, isRead: true }
        : article
    ));
  }, []);

  const bookmarkArticle = useCallback(async (articleId: string) => {
    // In a real implementation, this would call an API to bookmark the article
    setNews(prev => prev.map(article => 
      article.id === articleId 
        ? { ...article, isBookmarked: true }
        : article
    ));
  }, []);

  const shareArticle = useCallback(async (articleId: string, platform: string) => {
    const article = news.find(a => a.id === articleId);
    if (!article) return;

    try {
      if (navigator.share && platform === 'native') {
        await navigator.share({
          title: article.title,
          text: article.summary,
          url: article.url
        });
      } else {
        // Fallback to copying URL to clipboard
        await navigator.clipboard.writeText(article.url);
      }
    } catch (err) {
      console.error('Error sharing article:', err);
    }
  }, [news]);

  return {
    // Core data
    news,
    trendingNews,
    portfolioNews,
    trendingTopics,
    
    // State
    isLoading,
    hasMore,
    error,
    metrics,
    currentFilters,
    searchQuery,
    
    // Actions
    loadMore,
    refresh,
    searchNews,
    clearSearch,
    updateFilters,
    
    // Utility methods
    getNewsByCategory,
    getNewsBySentiment,
    getNewsWithHighEngagement,
    markAsRead,
    bookmarkArticle,
    shareArticle,
    
    // Settings
    autoRefresh,
    setAutoRefresh,
    refreshInterval,
    setRefreshInterval
  };
};

export default useNewsFeed;