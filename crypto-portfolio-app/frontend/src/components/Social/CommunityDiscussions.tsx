import React, { useState } from 'react';
import { CommunityInsight } from '../../types/social.types';
import { 
  FiHeart, 
  FiMessageCircle, 
  FiShare2, 
  FiMoreHorizontal,
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiUser,
  FiEye,
  FiFlag
} from 'react-icons/fi';

interface CommunityDiscussionsProps {
  insights: CommunityInsight[];
  onLikeInsight: (insightId: string) => void;
  onCommentInsight: (insightId: string, comment: string) => void;
  onShareInsight: (insightId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export const CommunityDiscussions: React.FC<CommunityDiscussionsProps> = ({
  insights,
  onLikeInsight,
  onCommentInsight,
  onShareInsight,
  isLoading = false,
  className = ''
}) => {
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({});
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getInsightTypeIcon = (type: string) => {
    switch (type) {
      case 'bullish':
        return <FiTrendingUp className="h-4 w-4 text-green-500" />;
      case 'bearish':
        return <FiTrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <FiMessageCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'bullish':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'bearish':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    }
  };

  const handleAddComment = (insightId: string) => {
    const comment = newComment[insightId];
    if (comment && comment.trim()) {
      onCommentInsight(insightId, comment.trim());
      setNewComment({ ...newComment, [insightId]: '' });
    }
  };

  const toggleComments = (insightId: string) => {
    setShowComments({
      ...showComments,
      [insightId]: !showComments[insightId]
    });
  };

  if (isLoading) {
    return (
      <div className={`space-y-6 ${className}`}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
          >
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/4"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                <div className="flex space-x-4">
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-12">
        <FiMessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No community insights yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Be the first to share your trading insights with the community
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
        >
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start space-x-3">
                <img
                  src={insight.author.avatar}
                  alt={insight.author.name}
                  className="w-10 h-10 rounded-full"
                />
                
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {insight.author.name}
                    </h4>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      @{insight.author.username}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getInsightTypeColor(insight.type)}`}>
                      {getInsightTypeIcon(insight.type)}
                      <span className="ml-1 capitalize">{insight.type}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                    <FiClock className="h-3 w-3" />
                    <span>{formatTime(insight.timestamp)}</span>
                    {insight.asset && (
                      <>
                        <span>•</span>
                        <span className="font-medium">{insight.asset}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Menu */}
              <div className="relative">
                <button
                  onClick={() => setActiveMenuId(activeMenuId === insight.id ? null : insight.id)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                >
                  <FiMoreHorizontal className="h-4 w-4" />
                </button>
                
                {activeMenuId === insight.id && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg z-10 border border-gray-200 dark:border-gray-600">
                    <div className="py-1">
                      <button className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left">
                        <FiFlag className="h-4 w-4 mr-2" />
                        Report
                      </button>
                      <button className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left">
                        <FiUser className="h-4 w-4 mr-2" />
                        View Profile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <p className="text-gray-900 dark:text-white text-base leading-relaxed">
                {insight.content}
              </p>
              
              {insight.tags && insight.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {insight.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Engagement Stats */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-6">
                <button
                  onClick={() => onLikeInsight(insight.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors"
                >
                  <FiHeart className="h-4 w-4" />
                  <span className="text-sm">{insight.likes}</span>
                </button>
                
                <button
                  onClick={() => toggleComments(insight.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-colors"
                >
                  <FiMessageCircle className="h-4 w-4" />
                  <span className="text-sm">{insight.comments?.length || 0}</span>
                </button>
                
                <button
                  onClick={() => onShareInsight(insight.id)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-colors"
                >
                  <FiShare2 className="h-4 w-4" />
                  <span className="text-sm">{insight.shares}</span>
                </button>
                
                <div className="flex items-center space-x-2 text-gray-500">
                  <FiEye className="h-4 w-4" />
                  <span className="text-sm">{insight.views}</span>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            {showComments[insight.id] && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {/* Add Comment */}
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                    <FiUser className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  </div>
                  
                  <div className="flex-1">
                    <textarea
                      value={newComment[insight.id] || ''}
                      onChange={(e) => setNewComment({ ...newComment, [insight.id]: e.target.value })}
                      placeholder="Add a comment..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
                    />
                    
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handleAddComment(insight.id)}
                        disabled={!newComment[insight.id]?.trim()}
                        className="px-4 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Comment
                      </button>
                    </div>
                  </div>
                </div>

                {/* Existing Comments */}
                {insight.comments && insight.comments.length > 0 && (
                  <div className="space-y-3">
                    {insight.comments.map((comment, index) => (
                      <div key={index} className="flex items-start space-x-3">
                        <img
                          src={comment.author.avatar}
                          alt={comment.author.name}
                          className="w-8 h-8 rounded-full"
                        />
                        
                        <div className="flex-1">
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-sm text-gray-900 dark:text-white">
                                {comment.author.name}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {formatTime(comment.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommunityDiscussions;