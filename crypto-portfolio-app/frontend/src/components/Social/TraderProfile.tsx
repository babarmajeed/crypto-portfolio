import React, { useState } from 'react';
import { Trader, CopyTradeSettings } from '../../types/social.types';
import { 
  FiX, 
  FiUserPlus, 
  FiCopy, 
  FiTrendingUp, 
  FiTrendingDown,
  FiShield,
  FiAward,
  FiDollarSign,
  FiBarChart3,
  FiClock,
  FiTarget
} from 'react-icons/fi';

interface TraderProfileProps {
  trader: Trader;
  onFollow: (traderId: string) => void;
  onStartCopyTrade: (traderId: string, settings: CopyTradeSettings) => Promise<void>;
  onClose: () => void;
}

export const TraderProfile: React.FC<TraderProfileProps> = ({
  trader,
  onFollow,
  onStartCopyTrade,
  onClose
}) => {
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySettings, setCopySettings] = useState<CopyTradeSettings>({
    allocation: 1000,
    stopLoss: 5,
    takeProfit: 15,
    maxOpenTrades: 5,
    copyMode: 'proportional'
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleStartCopyTrade = async () => {
    try {
      setIsLoading(true);
      await onStartCopyTrade(trader.id, copySettings);
      setShowCopyModal(false);
    } catch (error) {
      console.error('Failed to start copy trade:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPerformanceColor = (value: number) => {
    if (value > 0) return 'text-green-600 dark:text-green-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const formatDuration = (dateString: string) => {
    const startDate = new Date(dateString);
    const now = new Date();
    const diffInMonths = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    if (diffInMonths < 1) return 'Less than a month';
    if (diffInMonths === 1) return '1 month';
    return `${diffInMonths} months`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                src={trader.avatar}
                alt={trader.name}
                className="w-16 h-16 rounded-full"
              />
              {trader.isVerified && (
                <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                  <FiShield className="h-4 w-4" />
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {trader.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                @{trader.username}
              </p>
              <div className="flex items-center space-x-2 mt-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                  {trader.strategy}
                </span>
                {trader.badges.map((badge, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
                  >
                    <FiAward className="h-3 w-3 mr-1" />
                    {badge}
                  </span>
                ))}
              </div>
            </div>
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
          {/* Bio */}
          {trader.bio && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                About
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                {trader.bio}
              </p>
            </div>
          )}

          {/* Performance Overview */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Performance Overview
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                <div className={`text-2xl font-bold ${getPerformanceColor(trader.totalReturn)}`}>
                  {trader.totalReturn >= 0 ? '+' : ''}{trader.totalReturn.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Return</div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trader.winRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Win Rate</div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {trader.totalTrades}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Trades</div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {trader.maxDrawdown.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</div>
              </div>
            </div>
          </div>

          {/* Detailed Metrics */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Detailed Metrics
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Sharpe Ratio</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {trader.sharpeRatio.toFixed(2)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Average Trade Duration</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {trader.avgTradeDuration}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Best Trade</span>
                  <span className={`font-medium ${getPerformanceColor(trader.bestTrade)}`}>
                    +{trader.bestTrade.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Worst Trade</span>
                  <span className={`font-medium ${getPerformanceColor(trader.worstTrade)}`}>
                    {trader.worstTrade.toFixed(1)}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Risk Score</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {trader.riskScore}/10
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Trading Since</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDuration(trader.joinDate)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Followers</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {trader.followers.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Copiers</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {trader.copiers.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Performance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Performance
            </h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <FiClock className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-1" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last 7 Days</span>
                </div>
                <div className={`text-lg font-semibold ${getPerformanceColor(trader.weeklyReturn || 0)}`}>
                  {trader.weeklyReturn ? (trader.weeklyReturn >= 0 ? '+' : '') + trader.weeklyReturn.toFixed(1) + '%' : 'N/A'}
                </div>
              </div>
              
              <div className="text-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <FiBarChart3 className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-1" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last 30 Days</span>
                </div>
                <div className={`text-lg font-semibold ${getPerformanceColor(trader.monthlyReturn || 0)}`}>
                  {trader.monthlyReturn ? (trader.monthlyReturn >= 0 ? '+' : '') + trader.monthlyReturn.toFixed(1) + '%' : 'N/A'}
                </div>
              </div>
              
              <div className="text-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  <FiTrendingUp className="h-4 w-4 text-gray-600 dark:text-gray-400 mr-1" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Last 90 Days</span>
                </div>
                <div className={`text-lg font-semibold ${getPerformanceColor(trader.quarterlyReturn || 0)}`}>
                  {trader.quarterlyReturn ? (trader.quarterlyReturn >= 0 ? '+' : '') + trader.quarterlyReturn.toFixed(1) + '%' : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onFollow(trader.id)}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            >
              <FiUserPlus className="h-5 w-5" />
              <span>Follow Trader</span>
            </button>
            
            <button
              onClick={() => setShowCopyModal(true)}
              className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
            >
              <FiCopy className="h-5 w-5" />
              <span>Start Copy Trading</span>
            </button>
          </div>
        </div>

        {/* Copy Trading Modal */}
        {showCopyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Configure Copy Trading
                  </h3>
                  <button
                    onClick={() => setShowCopyModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FiDollarSign className="inline h-4 w-4 mr-1" />
                      Allocation Amount ($)
                    </label>
                    <input
                      type="number"
                      value={copySettings.allocation}
                      onChange={(e) => setCopySettings({ ...copySettings, allocation: Number(e.target.value) })}
                      min="100"
                      max="50000"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FiTrendingDown className="inline h-4 w-4 mr-1" />
                      Stop Loss (%)
                    </label>
                    <input
                      type="number"
                      value={copySettings.stopLoss}
                      onChange={(e) => setCopySettings({ ...copySettings, stopLoss: Number(e.target.value) })}
                      min="1"
                      max="20"
                      step="0.5"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      <FiTarget className="inline h-4 w-4 mr-1" />
                      Take Profit (%)
                    </label>
                    <input
                      type="number"
                      value={copySettings.takeProfit}
                      onChange={(e) => setCopySettings({ ...copySettings, takeProfit: Number(e.target.value) })}
                      min="5"
                      max="100"
                      step="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Max Open Trades
                    </label>
                    <input
                      type="number"
                      value={copySettings.maxOpenTrades}
                      onChange={(e) => setCopySettings({ ...copySettings, maxOpenTrades: Number(e.target.value) })}
                      min="1"
                      max="20"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Copy Mode
                    </label>
                    <select
                      value={copySettings.copyMode}
                      onChange={(e) => setCopySettings({ ...copySettings, copyMode: e.target.value as 'proportional' | 'fixed' })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="proportional">Proportional</option>
                      <option value="fixed">Fixed Amount</option>
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Proportional: Copy trades as a percentage of your allocation. Fixed: Copy exact amounts.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowCopyModal(false)}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartCopyTrade}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      'Start Copy Trading'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TraderProfile;