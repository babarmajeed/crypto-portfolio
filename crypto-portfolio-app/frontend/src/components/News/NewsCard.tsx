import React, { useState } from 'react';
import { NewsArticle } from '../../types/news.types';
import SentimentIndicator from './SentimentIndicator';
import { 
  FiExternalLink, 
  FiBookmark, 
  FiShare2, 
  FiClock,
  FiTrendingUp,
  FiUser,
  FiTag,
  FiEye,
  FiHeart
} from 'react-icons/fi';

interface NewsCardProps {
  article: NewsArticle;
  viewMode?: 'cards' | 'compact';
  showPortfolioIndicator?: boolean;
  onRead?: (articleId: string) => void;
  onBookmark?: (articleId: string) => void;
  onShare?: (articleId: string, platform: string) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  viewMode = 'cards',
  showPortfolioIndicator = true,
  onRead,
  onBookmark,
  onShare
}) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleReadMore = () => {
    if (onRead) {
      onRead(article.id);
    }
    window.open(article.url, '_blank', 'noopener,noreferrer');
  };

  const handleBookmark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBookmark) {
      onBookmark(article.id);
    }
  };

  const handleShare = (e: React.MouseEvent, platform: string = 'native') => {
    e.stopPropagation();
    if (onShare) {
      onShare(article.id, platform);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  const getSentimentColor = (sentiment: any) => {
    if (!sentiment) return 'text-gray-500';
    
    switch (sentiment.label) {
      case 'positive':
        return 'text-green-600 dark:text-green-400';
      case 'negative':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-500 dark:text-gray-400';
    }
  };

  if (viewMode === 'compact') {
    return (
      <div 
        className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-all duration-200 cursor-pointer bg-white dark:bg-gray-800"
        onClick={handleReadMore}
      >
        <div className="flex items-start space-x-4">
          {/* Image */}
          {article.image && !imageError && (
            <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <img
                src={article.image}
                alt={article.title}
                className="w-full h-full object-cover"
                onLoad={() => setIsImageLoaded(true)}
                onError={() => setImageError(true)}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white line-clamp-2 pr-4">
                {article.title}
              </h3>
              
              {/* Actions */}
              <div className="flex items-center space-x-2 ml-2">
                {article.sentiment && (
                  <SentimentIndicator
                    sentiment={article.sentiment}
                    size="xs"
                  />
                )}
                
                <button
                  onClick={handleBookmark}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Bookmark"
                >
                  <FiBookmark className="h-4 w-4" />
                </button>
                
                <button
                  onClick={(e) => handleShare(e)}
                  className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  title="Share"
                >
                  <FiShare2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
              {article.summary}
            </p>

            {/* Meta info */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center">
                  <FiUser className="h-3 w-3 mr-1" />
                  {article.source}
                </span>
                <span className="flex items-center">
                  <FiClock className="h-3 w-3 mr-1" />
                  {formatTimeAgo(article.publishedAt)}
                </span>
                {article.readTime && (
                  <span>{article.readTime} min read</span>
                )}
              </div>

              {showPortfolioIndicator && article.isPortfolioRelevant && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  Portfolio
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article 
      className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer bg-white dark:bg-gray-800 group"
      onClick={handleReadMore}
    >
      {/* Image */}
      {article.image && !imageError && (
        <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onLoad={() => setIsImageLoaded(true)}
            onError={() => setImageError(true)}
          />
          
          {/* Overlay indicators */}
          <div className="absolute top-4 left-4 flex space-x-2">
            {article.sentiment && (
              <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-full px-2 py-1">
                <SentimentIndicator
                  sentiment={article.sentiment}
                  size="xs"
                  showLabel
                />
              </div>
            )}
            
            {showPortfolioIndicator && article.isPortfolioRelevant && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                Portfolio
              </span>
            )}
          </div>

          {/* Category badge */}
          <div className="absolute top-4 right-4">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-black/60 text-white capitalize">
              {article.category}
            </span>
          </div>
        </div>
      )}

      <div className="p-6">
        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-3 mb-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {article.title}
        </h2>

        {/* Summary */}
        <p className="text-gray-600 dark:text-gray-300 line-clamp-3 mb-4">
          {article.summary}
        </p>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                <FiTag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
            {article.tags.length > 4 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                +{article.tags.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Related Assets */}
        {article.relatedAssets && article.relatedAssets.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.relatedAssets.slice(0, 3).map((asset) => (
              <span
                key={asset}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              >
                {asset}
              </span>
            ))}
          </div>
        )}

        {/* Author and meta info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center">
              <FiUser className="h-4 w-4 mr-1" />
              {article.author || article.source}
            </span>
            <span className="flex items-center">
              <FiClock className="h-4 w-4 mr-1" />
              {formatTimeAgo(article.publishedAt)}
            </span>
            {article.readTime && (
              <span>{article.readTime} min read</span>
            )}
          </div>

          {/* Relevance score */}
          {article.relevanceScore && (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <FiTrendingUp className="h-4 w-4 mr-1" />
              {Math.round(article.relevanceScore * 100)}%
            </div>
          )}
        </div>

        {/* Social stats */}
        {article.socialStats && (
          <div className="flex items-center space-x-6 mb-4 text-sm text-gray-500 dark:text-gray-400">
            {article.socialStats.likes > 0 && (
              <span className="flex items-center">
                <FiHeart className="h-4 w-4 mr-1" />
                {article.socialStats.likes.toLocaleString()}
              </span>
            )}
            {article.socialStats.shares > 0 && (
              <span className="flex items-center">
                <FiShare2 className="h-4 w-4 mr-1" />
                {article.socialStats.shares}
              </span>
            )}
            {article.socialStats.engagement > 0 && (
              <span className="flex items-center">
                <FiTrendingUp className="h-4 w-4 mr-1" />
                {Math.round(article.socialStats.engagement * 100)}% engagement
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            {article.sentiment && (
              <SentimentIndicator
                sentiment={article.sentiment}
                size="sm"
                showLabel
              />
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBookmark}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
              title="Bookmark article"
            >
              <FiBookmark className="h-4 w-4" />
            </button>
            
            <button
              onClick={(e) => handleShare(e)}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
              title="Share article"
            >
              <FiShare2 className="h-4 w-4" />
            </button>

            <button
              onClick={handleReadMore}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <span>Read More</span>
              <FiExternalLink className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

export default NewsCard;