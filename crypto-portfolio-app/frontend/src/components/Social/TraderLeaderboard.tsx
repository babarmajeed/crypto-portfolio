import React, { useState } from 'react';
import { TraderLeaderboardEntry, Trader } from '../../types/social.types';
import { 
  FiTrendingUp, 
  FiTrendingDown, 
  FiUsers, 
  FiEye, 
  FiUserPlus,
  FiAward,
  FiShield
} from 'react-icons/fi';

interface TraderLeaderboardProps {
  traders: TraderLeaderboardEntry[];
  onFollowTrader: (traderId: string) => void;
  onViewProfile: (trader: Trader) => void;
  isLoading?: boolean;
  className?: string;
}

export const TraderLeaderboard: React.FC<TraderLeaderboardProps> = ({
  traders,
  onFollowTrader,
  onViewProfile,
  isLoading = false,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const getRankBadgeColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-500 text-white';
    if (rank === 2) return 'bg-gray-400 text-white';
    if (rank === 3) return 'bg-amber-600 text-white';
    if (rank <= 10) return 'bg-blue-500 text-white';
    return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const getRankIcon = (rank: number) => {
    if (rank <= 3) return <FiAward className="h-3 w-3" />;
    return null;
  };

  const formatChange = (change: number) => {
    const abs = Math.abs(change);
    const sign = change >= 0 ? '+' : '-';
    return `${sign}${abs.toFixed(1)}%`;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return <FiTrendingUp className="h-3 w-3" />;
    if (change < 0) return <FiTrendingDown className="h-3 w-3" />;
    return null;
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: 6 }).map((_, index) => (
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
              <div className="w-20 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (traders.length === 0) {
    return (
      <div className="text-center py-12">
        <FiUsers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No traders found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {traders.map((entry) => (
          <div
            key={entry.trader.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200"
          >
            {/* Card Header */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src={entry.trader.avatar}
                      alt={entry.trader.name}
                      className="w-12 h-12 rounded-full"
                    />
                    {entry.trader.isVerified && (
                      <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                        <FiShield className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {entry.trader.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      @{entry.trader.username}
                    </p>
                  </div>
                </div>

                {/* Rank Badge */}
                <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getRankBadgeColor(entry.rank)}`}>
                  {getRankIcon(entry.rank)}
                  <span>#{entry.rank}</span>
                </div>
              </div>

              {/* Strategy */}
              <div className="mb-4">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                  {entry.trader.strategy}
                </span>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className={`text-lg font-bold ${
                    entry.trader.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {entry.trader.totalReturn >= 0 ? '+' : ''}{entry.trader.totalReturn.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total Return</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">
                    {entry.trader.winRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Win Rate</div>
                </div>
              </div>

              {/* Social Stats */}
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                <div className="flex items-center space-x-1">
                  <FiUsers className="h-4 w-4" />
                  <span>{entry.trader.followers.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <span>Copiers:</span>
                  <span className="font-medium">{entry.trader.copiers.toLocaleString()}</span>
                </div>
              </div>

              {/* 24h Change */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">24h Change:</span>
                <div className={`flex items-center space-x-1 text-sm font-medium ${getChangeColor(entry.change24h)}`}>
                  {getChangeIcon(entry.change24h)}
                  <span>{formatChange(entry.change24h)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => onViewProfile(entry.trader)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiEye className="h-4 w-4" />
                  <span>View</span>
                </button>
                
                <button
                  onClick={() => onFollowTrader(entry.trader.id)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <FiUserPlus className="h-4 w-4" />
                  <span>Follow</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // List view
  return (
    <div className={`space-y-4 ${className}`}>
      {traders.map((entry) => (
        <div
          key={entry.trader.id}
          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Rank */}
              <div className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium ${getRankBadgeColor(entry.rank)}`}>
                {getRankIcon(entry.rank)}
                <span>#{entry.rank}</span>
              </div>

              {/* Trader Info */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={entry.trader.avatar}
                    alt={entry.trader.name}
                    className="w-12 h-12 rounded-full"
                  />
                  {entry.trader.isVerified && (
                    <div className="absolute -top-1 -right-1 bg-blue-500 text-white rounded-full p-1">
                      <FiShield className="h-3 w-3" />
                    </div>
                  )}
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {entry.trader.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {entry.trader.strategy}
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics */}
            <div className="flex items-center space-x-8">
              <div className="text-center">
                <div className={`text-lg font-bold ${
                  entry.trader.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {entry.trader.totalReturn >= 0 ? '+' : ''}{entry.trader.totalReturn.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Total Return</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {entry.trader.winRate.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Win Rate</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {entry.trader.followers.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">Followers</div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => onViewProfile(entry.trader)}
                  className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiEye className="h-4 w-4" />
                  <span>View</span>
                </button>
                
                <button
                  onClick={() => onFollowTrader(entry.trader.id)}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  <FiUserPlus className="h-4 w-4" />
                  <span>Follow</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TraderLeaderboard;