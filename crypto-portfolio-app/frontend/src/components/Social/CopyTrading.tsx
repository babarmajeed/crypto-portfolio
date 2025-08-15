import React, { useState } from 'react';
import { CopyTrade } from '../../types/social.types';
import { 
  FiPlay, 
  FiPause, 
  FiStop, 
  FiSettings, 
  FiTrendingUp,
  FiTrendingDown,
  FiClock,
  FiDollarSign,
  FiBarChart3
} from 'react-icons/fi';

interface CopyTradingProps {
  copyTrades: CopyTrade[];
  onStopCopyTrade: (copyTradeId: string) => Promise<void>;
  onPauseCopyTrade: (copyTradeId: string) => Promise<void>;
  onResumeCopyTrade: (copyTradeId: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const CopyTrading: React.FC<CopyTradingProps> = ({
  copyTrades,
  onStopCopyTrade,
  onPauseCopyTrade,
  onResumeCopyTrade,
  isLoading = false,
  className = ''
}) => {
  const [selectedCopyTrade, setSelectedCopyTrade] = useState<CopyTrade | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<void>, copyTradeId: string) => {
    try {
      setActionLoading(copyTradeId);
      await action();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDuration = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return '1 day';
    return `${diffInDays} days`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'stopped':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPerformanceColor = (performance: number) => {
    if (performance > 0) return 'text-green-600 dark:text-green-400';
    if (performance < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
              </div>
              <div className="w-32 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (copyTrades.length === 0) {
    return (
      <div className="text-center py-12">
        <FiBarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No copy trades active
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Start copying successful traders to see your copy trades here
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {copyTrades.map((copyTrade) => (
        <div
          key={copyTrade.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              {/* Trader Info */}
              <div className="flex items-center space-x-4">
                <img
                  src={copyTrade.trader.avatar}
                  alt={copyTrade.trader.name}
                  className="w-12 h-12 rounded-full"
                />
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {copyTrade.trader.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {copyTrade.trader.strategy}
                  </p>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(copyTrade.status)}`}>
                      {copyTrade.status}
                    </span>
                    
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <FiClock className="h-3 w-3 mr-1" />
                      {formatDuration(copyTrade.startDate)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setSelectedCopyTrade(copyTrade)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                  title="Settings"
                >
                  <FiSettings className="h-4 w-4" />
                </button>

                {copyTrade.status === 'active' && (
                  <button
                    onClick={() => handleAction(() => onPauseCopyTrade(copyTrade.id), copyTrade.id)}
                    disabled={actionLoading === copyTrade.id}
                    className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 rounded-lg transition-all disabled:opacity-50"
                    title="Pause copy trading"
                  >
                    <FiPause className="h-4 w-4" />
                  </button>
                )}

                {copyTrade.status === 'paused' && (
                  <button
                    onClick={() => handleAction(() => onResumeCopyTrade(copyTrade.id), copyTrade.id)}
                    disabled={actionLoading === copyTrade.id}
                    className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all disabled:opacity-50"
                    title="Resume copy trading"
                  >
                    <FiPlay className="h-4 w-4" />
                  </button>
                )}

                <button
                  onClick={() => handleAction(() => onStopCopyTrade(copyTrade.id), copyTrade.id)}
                  disabled={actionLoading === copyTrade.id}
                  className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all disabled:opacity-50"
                  title="Stop copy trading"
                >
                  <FiStop className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-center mb-1">
                  <FiDollarSign className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${copyTrade.allocatedAmount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Allocated
                </div>
              </div>

              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${copyTrade.currentValue.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Current Value
                </div>
              </div>

              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className={`text-lg font-semibold ${getPerformanceColor(copyTrade.totalReturnPercentage)}`}>
                  {copyTrade.totalReturnPercentage >= 0 ? '+' : ''}{copyTrade.totalReturnPercentage.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Total Return
                </div>
              </div>

              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {copyTrade.statistics.winRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Win Rate
                </div>
              </div>

              <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {copyTrade.statistics.totalTrades}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Total Trades
                </div>
              </div>
            </div>

            {/* Recent Performance */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-400">Daily:</span>
                  <span className={`font-medium ${getPerformanceColor(copyTrade.dailyReturn)}`}>
                    {copyTrade.dailyReturn >= 0 ? '+' : ''}{copyTrade.dailyReturn.toFixed(2)}%
                  </span>
                  {copyTrade.dailyReturn > 0 ? (
                    <FiTrendingUp className="h-3 w-3 text-green-500" />
                  ) : copyTrade.dailyReturn < 0 ? (
                    <FiTrendingDown className="h-3 w-3 text-red-500" />
                  ) : null}
                </div>

                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-400">Weekly:</span>
                  <span className={`font-medium ${getPerformanceColor(copyTrade.weeklyReturn)}`}>
                    {copyTrade.weeklyReturn >= 0 ? '+' : ''}{copyTrade.weeklyReturn.toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="text-gray-600 dark:text-gray-400">Monthly:</span>
                  <span className={`font-medium ${getPerformanceColor(copyTrade.monthlyReturn)}`}>
                    {copyTrade.monthlyReturn >= 0 ? '+' : ''}{copyTrade.monthlyReturn.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="text-gray-600 dark:text-gray-400">
                Max Drawdown: <span className="text-red-600">{copyTrade.statistics.maxDrawdownPercentage.toFixed(1)}%</span>
              </div>
            </div>

            {/* Settings Summary */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <div className="space-x-4">
                  <span>Stop Loss: {copyTrade.settings.stopLoss}%</span>
                  <span>Take Profit: {copyTrade.settings.takeProfit}%</span>
                  <span>Max Trades: {copyTrade.settings.maxOpenTrades}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span>Copy Mode:</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {copyTrade.settings.copyMode}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Settings Modal */}
      {selectedCopyTrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Copy Trade Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  defaultValue={selectedCopyTrade.settings.stopLoss}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Take Profit (%)
                </label>
                <input
                  type="number"
                  defaultValue={selectedCopyTrade.settings.takeProfit}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Open Trades
                </label>
                <input
                  type="number"
                  defaultValue={selectedCopyTrade.settings.maxOpenTrades}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setSelectedCopyTrade(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Implement settings update
                  setSelectedCopyTrade(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Update Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CopyTrading;