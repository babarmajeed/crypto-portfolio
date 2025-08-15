import React, { useState, useCallback, useMemo } from 'react';
import { useNewsFeed } from '../../hooks/useNewsFeed';
import { usePortfolio } from '../../hooks/usePortfolio';
import { NewsFilters as NewsFiltersType } from '../../types/news.types';
import NewsCard from './NewsCard';
import NewsFilters from './NewsFilters';
import TrendingNews from './TrendingNews';
import SentimentIndicator from './SentimentIndicator';
import { FiRefreshCw, FiTrendingUp, FiFilter, FiSearch, FiEye, FiBookmark } from 'react-icons/fi';

interface NewsFeedProps {
  className?: string;
  showTrending?: boolean;
  showFilters?: boolean;
  showPortfolioNews?: boolean;
  maxArticles?: number;
}

export const NewsFeed: React.FC<NewsFeedProps> = ({
  className = '',
  showTrending = true,
  showFilters = true,
  showPortfolioNews = true,
  maxArticles
}) => {
  const { portfolioAssets } = usePortfolio();
  const assets = portfolioAssets.map(asset => asset.symbol);
  
  const {
    news,
    trendingNews,
    portfolioNews,
    trendingTopics,
    isLoading,
    hasMore,
    error,
    metrics,
    currentFilters,
    searchQuery,
    loadMore,
    refresh,
    searchNews,
    clearSearch,
    updateFilters,
    autoRefresh,
    setAutoRefresh
  } = useNewsFeed({}, assets);

  const [activeTab, setActiveTab] = useState<'all' | 'portfolio' | 'trending'>('all');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');

  // Filter and display logic
  const displayedArticles = useMemo(() => {
    let articles = [];
    
    switch (activeTab) {
      case 'portfolio':
        articles = portfolioNews;
        break;
      case 'trending':
        articles = trendingNews;
        break;
      default:
        articles = news;
    }

    if (maxArticles) {
      articles = articles.slice(0, maxArticles);
    }

    return articles;
  }, [activeTab, news, portfolioNews, trendingNews, maxArticles]);

  const handleLoadMore = useCallback(() => {
    if (activeTab === 'all' && hasMore && !isLoading) {
      loadMore();
    }
  }, [activeTab, hasMore, isLoading, loadMore]);

  const handleTabChange = useCallback((tab: 'all' | 'portfolio' | 'trending') => {
    setActiveTab(tab);
  }, []);

  const handleFilterChange = useCallback((filters: Partial<NewsFiltersType>) => {
    updateFilters(filters);
  }, [updateFilters]);

  const handleSearch = useCallback((query: string) => {
    searchNews(query);
  }, [searchNews]);

  // Infinite scroll detection
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
    
    if (scrollPercentage > 0.8 && hasMore && !isLoading && activeTab === 'all') {
      handleLoadMore();
    }
  }, [hasMore, isLoading, activeTab, handleLoadMore]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            News Feed
          </h2>
          
          <div className="flex items-center space-x-2">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg transition-colors ${
                autoRefresh
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
              title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
            >
              <FiRefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            </button>

            {/* View mode toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'cards' ? 'compact' : 'cards')}
              className="p-2 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title={`Switch to ${viewMode === 'cards' ? 'compact' : 'card'} view`}
            >
              <FiEye className="h-4 w-4" />
            </button>

            {/* Filters toggle */}
            {showFilters && (
              <button
                onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                className="p-2 rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Toggle filters"
              >
                <FiFilter className="h-4 w-4" />
              </button>
            )}

            {/* Refresh button */}
            <button
              onClick={refresh}
              disabled={isLoading}
              className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
              title="Refresh news"
            >
              <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search news..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => handleTabChange('all')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            All News ({news.length})
          </button>
          
          {showPortfolioNews && portfolioNews.length > 0 && (
            <button
              onClick={() => handleTabChange('portfolio')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'portfolio'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FiBookmark className="inline h-4 w-4 mr-1" />
              Portfolio ({portfolioNews.length})
            </button>
          )}
          
          {showTrending && (
            <button
              onClick={() => handleTabChange('trending')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'trending'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FiTrendingUp className="inline h-4 w-4 mr-1" />
              Trending ({trendingNews.length})
            </button>
          )}
        </div>

        {/* Overall Sentiment */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Market Sentiment:
            </span>
            <SentimentIndicator
              sentiment={{
                score: metrics.avgSentimentScore,
                label: metrics.avgSentimentScore > 0.1 ? 'positive' : 
                       metrics.avgSentimentScore < -0.1 ? 'negative' : 'neutral',
                confidence: 0.8
              }}
              size="sm"
              showLabel
            />
          </div>
          
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {displayedArticles.length} articles
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFiltersPanel && (
        <div className="border-b border-gray-200 dark:border-gray-700 p-6">
          <NewsFilters
            filters={currentFilters}
            onFiltersChange={handleFilterChange}
            trending={trendingTopics}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="h-5 w-5 text-red-400">⚠️</div>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                  Error loading news
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-400">
                  {error.message}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Trending Topics (for trending tab) */}
        {activeTab === 'trending' && showTrending && (
          <div className="mb-6">
            <TrendingNews topics={trendingTopics} />
          </div>
        )}

        {/* Articles */}
        <div 
          className={`space-y-6 ${viewMode === 'compact' ? 'space-y-3' : ''} max-h-screen overflow-y-auto`}
          onScroll={handleScroll}
        >
          {displayedArticles.length === 0 && !isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-400 dark:text-gray-500 mb-2">
                📰
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No news articles found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {activeTab === 'portfolio' 
                  ? 'No news found for your portfolio assets'
                  : activeTab === 'trending'
                  ? 'No trending articles available'
                  : 'Try adjusting your filters or search terms'
                }
              </p>
            </div>
          ) : (
            displayedArticles.map((article, index) => (
              <NewsCard
                key={article.id}
                article={article}
                viewMode={viewMode}
                showPortfolioIndicator={activeTab !== 'portfolio'}
                onRead={() => {}}
                onBookmark={() => {}}
                onShare={() => {}}
              />
            ))
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <FiRefreshCw className="h-5 w-5 animate-spin" />
                <span>Loading news...</span>
              </div>
            </div>
          )}

          {/* Load more button */}
          {activeTab === 'all' && hasMore && !isLoading && (
            <div className="text-center py-6">
              <button
                onClick={handleLoadMore}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Load More Articles
              </button>
            </div>
          )}

          {/* End of feed message */}
          {activeTab === 'all' && !hasMore && displayedArticles.length > 0 && (
            <div className="text-center py-6 text-gray-500 dark:text-gray-400">
              You've reached the end of the news feed
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsFeed;