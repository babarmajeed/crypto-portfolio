import React, { useState } from 'react';
import { 
  FiShare2, 
  FiX, 
  FiCamera, 
  FiEye,
  FiEyeOff,
  FiTrendingUp,
  FiTrendingDown,
  FiDollarSign,
  FiClock,
  FiTarget,
  FiBarChart3
} from 'react-icons/fi';

interface Trade {
  id: string;
  asset: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
  pnl?: number;
  pnlPercentage?: number;
  status: 'open' | 'closed';
}

interface TradeShareSettings {
  includeAmount: boolean;
  includePrice: boolean;
  includePnL: boolean;
  includeStrategy: boolean;
  visibility: 'public' | 'followers' | 'private';
  addComment: boolean;
}

interface TradeSharingProps {
  trade: Trade;
  onShare: (trade: Trade, settings: TradeShareSettings, comment?: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const TradeSharing: React.FC<TradeSharingProps> = ({
  trade,
  onShare,
  onClose,
  isOpen
}) => {
  const [shareSettings, setShareSettings] = useState<TradeShareSettings>({
    includeAmount: false,
    includePrice: true,
    includePnL: true,
    includeStrategy: false,
    visibility: 'followers',
    addComment: true
  });
  
  const [comment, setComment] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTradeTypeIcon = (type: string) => {
    return type === 'buy' ? (
      <FiTrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <FiTrendingDown className="h-4 w-4 text-red-500" />
    );
  };

  const getTradeTypeColor = (type: string) => {
    return type === 'buy' 
      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
  };

  const getPnLColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-600 dark:text-green-400';
    if (pnl < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const handleShare = async () => {
    try {
      setIsSharing(true);
      await onShare(trade, shareSettings, comment.trim() || undefined);
      onClose();
    } catch (error) {
      console.error('Failed to share trade:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    switch (visibility) {
      case 'public':
        return <FiEye className="h-4 w-4" />;
      case 'followers':
        return <FiEye className="h-4 w-4" />;
      case 'private':
        return <FiEyeOff className="h-4 w-4" />;
      default:
        return <FiEye className="h-4 w-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FiShare2 className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Share Trade
            </h2>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
          >
            <FiX className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Trade Preview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Trade Preview
            </h3>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${getTradeTypeColor(trade.type)}`}>
                    {getTradeTypeIcon(trade.type)}
                    <span className="capitalize">{trade.type}</span>
                  </div>
                  
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {trade.asset}
                  </h4>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400">
                    <FiClock className="h-3 w-3" />
                    <span>{formatTime(trade.timestamp)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {shareSettings.includeAmount && (
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-center mb-1">
                      <FiDollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(trade.amount)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Amount</div>
                  </div>
                )}

                {shareSettings.includePrice && (
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-center mb-1">
                      <FiTarget className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(trade.price)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Price</div>
                  </div>
                )}

                {shareSettings.includePnL && trade.pnl !== undefined && (
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-center mb-1">
                      <FiBarChart3 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div className={`text-lg font-semibold ${getPnLColor(trade.pnl)}`}>
                      {formatCurrency(trade.pnl)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">P&L</div>
                  </div>
                )}

                {shareSettings.includePnL && trade.pnlPercentage !== undefined && (
                  <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
                    <div className={`text-lg font-semibold ${getPnLColor(trade.pnlPercentage)}`}>
                      {formatPercentage(trade.pnlPercentage)}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Return</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Privacy Settings */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Privacy & Visibility
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Who can see this trade?
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'public', label: 'Everyone', description: 'Visible to all users' },
                    { value: 'followers', label: 'Followers only', description: 'Only your followers can see this' },
                    { value: 'private', label: 'Private', description: 'Only you can see this (saved as draft)' }
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={shareSettings.visibility === option.value}
                        onChange={(e) => setShareSettings({
                          ...shareSettings,
                          visibility: e.target.value as TradeShareSettings['visibility']
                        })}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {getVisibilityIcon(option.value)}
                          <span className="font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {option.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data to Include */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Information to Share
            </h3>
            
            <div className="space-y-3">
              {[
                { key: 'includePrice', label: 'Entry/Exit Price', description: 'Show the price at which you entered or exited' },
                { key: 'includeAmount', label: 'Trade Amount', description: 'Show how much you invested in this trade' },
                { key: 'includePnL', label: 'Profit & Loss', description: 'Show your gains or losses from this trade' },
                { key: 'includeStrategy', label: 'Trading Strategy', description: 'Include details about your strategy (if available)' }
              ].map((option) => (
                <label
                  key={option.key}
                  className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={shareSettings[option.key as keyof TradeShareSettings] as boolean}
                    onChange={(e) => setShareSettings({
                      ...shareSettings,
                      [option.key]: e.target.checked
                    })}
                    className="mt-1"
                  />
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {option.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Comment */}
          {shareSettings.addComment && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add a Comment (Optional)
              </h3>
              
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts about this trade, your strategy, or market insights..."
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white resize-none"
              />
              
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {comment.length}/500 characters
                </span>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={shareSettings.addComment}
                    onChange={(e) => setShareSettings({
                      ...shareSettings,
                      addComment: e.target.checked
                    })}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Include comment
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={isSharing}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {isSharing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sharing...</span>
                </>
              ) : (
                <>
                  <FiShare2 className="h-4 w-4" />
                  <span>Share Trade</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeSharing;