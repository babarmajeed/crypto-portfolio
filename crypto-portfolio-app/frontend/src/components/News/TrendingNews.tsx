import React, { useState } from 'react';
import { TrendingTopic, NewsArticle } from '../../types/news.types';
import SentimentIndicator from './SentimentIndicator';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiChevronRight, 
  FiExternalLink,
  FiArrowUp,
  FiArrowDown,
  FiMinus
} from 'react-icons/fi';

interface TrendingNewsProps {
  topics: TrendingTopic[];
  className?: string;
  maxTopics?: number;
  showArticles?: boolean;
}

export const TrendingNews: React.FC<TrendingNewsProps> = ({
  topics,
  className = '',
  maxTopics = 10,
  showArticles = true
}) => {
  const [selectedTopic, setSelectedTopic] = useState<TrendingTopic | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const displayedTopics = topics.slice(0, maxTopics);

  const toggleTopicExpanded = (keyword: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(keyword)) {
      newExpanded.delete(keyword);
    } else {
      newExpanded.add(keyword);
    }
    setExpandedTopics(newExpanded);
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) {
      return <FiArrowUp className="h-3 w-3 text-green-500" />;
    } else if (growth < 0) {
      return <FiArrowDown className="h-3 w-3 text-red-500" />;
    }
    return <FiMinus className="h-3 w-3 text-gray-500" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600 dark:text-green-400';
    if (growth < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      market: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      technology: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      regulation: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      adoption: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      defi: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      nft: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      mining: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      exchange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      security: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      general: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    };
    return colors[category] || colors.general;
  };

  const formatGrowth = (growth: number) => {
    const absGrowth = Math.abs(growth);
    return `${growth > 0 ? '+' : ''}${absGrowth.toFixed(1)}%`;
  };

  if (displayedTopics.length === 0) {
    return (
      <div className={`bg-white dark:bg-gray-900 rounded-lg p-6 text-center ${className}`}>
        <FiTrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600 dark:text-gray-400">No trending topics available</p>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FiTrendingUp className="h-5 w-5 mr-2 text-blue-600" />
            Trending Topics
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {displayedTopics.length} topics
          </span>
        </div>
      </div>

      {/* Topics List */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {displayedTopics.map((topic, index) => {
          const isExpanded = expandedTopics.has(topic.keyword);
          
          return (
            <div key={topic.keyword} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              {/* Topic Header */}
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleTopicExpanded(topic.keyword)}
              >
                <div className="flex items-center space-x-3 flex-1">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {index + 1}
                  </div>

                  {/* Keyword and Stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-base font-medium text-gray-900 dark:text-white capitalize">
                        {topic.keyword}
                      </h4>
                      
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(topic.category)}`}>
                        {topic.category}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center">
                        <span className="font-medium">{topic.count}</span>
                        <span className="ml-1">mentions</span>
                      </span>
                      
                      <span className={`flex items-center space-x-1 ${getGrowthColor(topic.growth)}`}>
                        {getGrowthIcon(topic.growth)}
                        <span className="font-medium">{formatGrowth(topic.growth)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sentiment and Expand */}
                <div className="flex items-center space-x-3">
                  <SentimentIndicator
                    sentiment={topic.sentiment}
                    size="sm"
                    showIcon
                  />
                  
                  <FiChevronRight 
                    className={`h-4 w-4 text-gray-400 transition-transform ${
                      isExpanded ? 'transform rotate-90' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && showArticles && topic.relatedArticles.length > 0 && (
                <div className="mt-4 pl-9">
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Related Articles ({topic.relatedArticles.length})
                    </h5>
                    
                    {topic.relatedArticles.slice(0, 3).map((article) => (
                      <div 
                        key={article.id}
                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        onClick={() => window.open(article.url, '_blank')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0 pr-3">
                            <h6 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                              {article.title}
                            </h6>
                            
                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                              {article.summary}
                            </p>
                            
                            <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                              <span>{article.source}</span>
                              <span>•</span>
                              <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                              {article.readTime && (
                                <>
                                  <span>•</span>
                                  <span>{article.readTime} min read</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {article.sentiment && (
                              <SentimentIndicator
                                sentiment={article.sentiment}
                                size="xs"
                              />
                            )}
                            <FiExternalLink className="h-3 w-3 text-gray-400" />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {topic.relatedArticles.length > 3 && (
                      <div className="text-center">
                        <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                          View {topic.relatedArticles.length - 3} more articles
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {topics.length > maxTopics && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <button className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium">
            View {topics.length - maxTopics} more trending topics
          </button>
        </div>
      )}
    </div>
  );
};

// Compact version for sidebar or smaller spaces
export const TrendingTopicsCompact: React.FC<{
  topics: TrendingTopic[];
  maxTopics?: number;
  onTopicClick?: (topic: TrendingTopic) => void;
}> = ({ 
  topics, 
  maxTopics = 5,
  onTopicClick 
}) => {
  const displayedTopics = topics.slice(0, maxTopics);

  return (
    <div className="space-y-2">
      {displayedTopics.map((topic, index) => (
        <div
          key={topic.keyword}
          className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg cursor-pointer transition-colors"
          onClick={() => onTopicClick?.(topic)}
        >
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-4">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {topic.keyword}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {topic.count}
            </span>
            <span className={`text-xs font-medium ${getGrowthColor(topic.growth)}`}>
              {formatGrowth(topic.growth)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TrendingNews;