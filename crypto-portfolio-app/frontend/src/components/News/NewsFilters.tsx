import React, { useState } from 'react';
import { NewsFilters as NewsFiltersType, NewsCategory, TrendingTopic } from '../../types/news.types';
import { FiFilter, FiX, FiSearch, FiCalendar, FiTag, FiTrendingUp } from 'react-icons/fi';

interface NewsFiltersProps {
  filters: NewsFiltersType;
  onFiltersChange: (filters: Partial<NewsFiltersType>) => void;
  trending?: TrendingTopic[];
  className?: string;
}

export const NewsFilters: React.FC<NewsFiltersProps> = ({
  filters,
  onFiltersChange,
  trending = [],
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const categories: { value: NewsCategory | 'all'; label: string }[] = [
    { value: 'all', label: 'All Categories' },
    { value: 'market', label: 'Market News' },
    { value: 'technology', label: 'Technology' },
    { value: 'regulation', label: 'Regulation' },
    { value: 'adoption', label: 'Adoption' },
    { value: 'defi', label: 'DeFi' },
    { value: 'nft', label: 'NFT' },
    { value: 'mining', label: 'Mining' },
    { value: 'exchange', label: 'Exchange' },
    { value: 'analysis', label: 'Analysis' },
    { value: 'security', label: 'Security' },
    { value: 'general', label: 'General' }
  ];

  const sentiments: { value: 'all' | 'positive' | 'negative' | 'neutral'; label: string; icon: string }[] = [
    { value: 'all', label: 'All Sentiment', icon: '📊' },
    { value: 'positive', label: 'Positive', icon: '📈' },
    { value: 'negative', label: 'Negative', icon: '📉' },
    { value: 'neutral', label: 'Neutral', icon: '➖' }
  ];

  const timeframes: { value: string; label: string }[] = [
    { value: 'all', label: 'All Time' },
    { value: '1h', label: 'Last Hour' },
    { value: '6h', label: 'Last 6 Hours' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' }
  ];

  const sortOptions: { value: string; label: string }[] = [
    { value: 'date', label: 'Date' },
    { value: 'relevance', label: 'Relevance' },
    { value: 'sentiment', label: 'Sentiment' },
    { value: 'social', label: 'Social Engagement' }
  ];

  const sources = [
    { value: 'all', label: 'All Sources' },
    { value: 'CoinDesk', label: 'CoinDesk' },
    { value: 'Cointelegraph', label: 'Cointelegraph' },
    { value: 'CryptoPanic', label: 'CryptoPanic' },
    { value: 'Financial Times', label: 'Financial Times' }
  ];

  const handleFilterChange = (key: keyof NewsFiltersType, value: any) => {
    onFiltersChange({ [key]: value });
  };

  const handleTagAdd = (tag: string) => {
    const currentTags = filters.tags || [];
    if (!currentTags.includes(tag)) {
      onFiltersChange({ tags: [...currentTags, tag] });
    }
  };

  const handleTagRemove = (tag: string) => {
    const currentTags = filters.tags || [];
    onFiltersChange({ tags: currentTags.filter(t => t !== tag) });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      category: 'all',
      sentiment: 'all',
      source: 'all',
      timeframe: '24h',
      portfolioOnly: false,
      searchQuery: undefined,
      tags: undefined,
      minRelevanceScore: undefined,
      hasImage: undefined,
      sortBy: 'date',
      sortOrder: 'desc'
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.category !== 'all' ||
      filters.sentiment !== 'all' ||
      filters.source !== 'all' ||
      filters.timeframe !== '24h' ||
      filters.portfolioOnly ||
      filters.searchQuery ||
      (filters.tags && filters.tags.length > 0) ||
      filters.minRelevanceScore ||
      filters.hasImage ||
      filters.sortBy !== 'date' ||
      filters.sortOrder !== 'desc'
    );
  };

  return (
    <div className={`bg-gray-50 dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <FiFilter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Filters
          </h3>
          {hasActiveFilters() && (
            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 text-xs font-medium px-2 py-1 rounded-full">
              Active
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {hasActiveFilters() && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Clear All
            </button>
          )}
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {isExpanded ? <FiX className="h-4 w-4" /> : <FiFilter className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Quick Filters (Always Visible) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sentiment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sentiment
          </label>
          <select
            value={filters.sentiment}
            onChange={(e) => handleFilterChange('sentiment', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          >
            {sentiments.map((sentiment) => (
              <option key={sentiment.value} value={sentiment.value}>
                {sentiment.icon} {sentiment.label}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <FiCalendar className="inline h-4 w-4 mr-1" />
            Timeframe
          </label>
          <select
            value={filters.timeframe}
            onChange={(e) => handleFilterChange('timeframe', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          >
            {timeframes.map((timeframe) => (
              <option key={timeframe.value} value={timeframe.value}>
                {timeframe.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Source and Sort */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Source
              </label>
              <select
                value={filters.source}
                onChange={(e) => handleFilterChange('source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                {sources.map((source) => (
                  <option key={source.value} value={source.value}>
                    {source.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sort By
              </label>
              <div className="flex space-x-2">
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                
                <select
                  value={filters.sortOrder}
                  onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                >
                  <option value="desc">↓ Desc</option>
                  <option value="asc">↑ Asc</option>
                </select>
              </div>
            </div>
          </div>

          {/* Relevance Score */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Minimum Relevance Score: {filters.minRelevanceScore || 0}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={(filters.minRelevanceScore || 0) * 100}
              onChange={(e) => handleFilterChange('minRelevanceScore', parseInt(e.target.value) / 100)}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            />
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.portfolioOnly}
                onChange={(e) => handleFilterChange('portfolioOnly', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Portfolio-relevant only
              </span>
            </label>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={filters.hasImage}
                onChange={(e) => handleFilterChange('hasImage', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Articles with images only
              </span>
            </label>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <FiTag className="inline h-4 w-4 mr-1" />
              Tags
            </label>
            
            {/* Current Tags */}
            {filters.tags && filters.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {filters.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                  >
                    {tag}
                    <button
                      onClick={() => handleTagRemove(tag)}
                      className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                    >
                      <FiX className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Trending Tags */}
            {trending.length > 0 && (
              <div>
                <div className="flex items-center space-x-1 mb-2">
                  <FiTrendingUp className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Trending topics:
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trending.slice(0, 8).map((topic) => (
                    <button
                      key={topic.keyword}
                      onClick={() => handleTagAdd(topic.keyword)}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      disabled={filters.tags?.includes(topic.keyword)}
                    >
                      {topic.keyword}
                      <span className="ml-1 text-xs text-gray-500">
                        {topic.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewsFilters;