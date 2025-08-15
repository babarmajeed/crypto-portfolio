import React, { useState, useCallback } from 'react';
import { useSocialTrading } from '../../hooks/useSocialTrading';
import { useCopyTrading } from '../../hooks/useCopyTrading';
import TraderLeaderboard from './TraderLeaderboard';
import TraderProfile from './TraderProfile';
import CopyTrading from './CopyTrading';
import CommunityDiscussions from './CommunityDiscussions';
import { 
  FiTrendingUp, 
  FiUsers, 
  FiCopy, 
  FiMessageCircle, 
  FiUser,
  FiSearch,
  FiFilter,
  FiRefreshCw
} from 'react-icons/fi';
import { Trader, CopyTradeSettings } from '../../types/social.types';

interface SocialTradingProps {
  userId?: string;
  className?: string;
}

export const SocialTrading: React.FC<SocialTradingProps> = ({ 
  userId = 'current_user',
  className = '' 
}) => {
  const [activeTab, setActiveTab] = useState<'discover' | 'following' | 'copying' | 'community' | 'profile'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrader, setSelectedTrader] = useState<Trader | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const {
    topTraders,
    followedTraders,
    communityInsights,
    userProfile,
    isLoading: socialLoading,
    error: socialError,
    followTrader,
    unfollowTrader,
    likeInsight,
    commentOnInsight,
    shareInsight,
    searchTraders,
    refresh: refreshSocial
  } = useSocialTrading(userId);

  const {
    activeCopyTrades,
    copyTradeHistory,
    isLoading: copyLoading,
    startCopyTrade,
    stopCopyTrade,
    pauseCopyTrade,
    resumeCopyTrade,
    getTotalAllocated,
    getTotalCurrentValue,
    getTotalReturn,
    getActiveTradesCount
  } = useCopyTrading(userId);

  const isLoading = socialLoading || copyLoading;

  const tabs = [
    { 
      id: 'discover' as const, 
      label: 'Discover Traders', 
      icon: FiTrendingUp,
      count: topTraders.length 
    },
    { 
      id: 'following' as const, 
      label: 'Following', 
      icon: FiUsers,
      count: followedTraders.length 
    },
    { 
      id: 'copying' as const, 
      label: 'Copy Trading', 
      icon: FiCopy,
      count: getActiveTradesCount() 
    },
    { 
      id: 'community' as const, 
      label: 'Community', 
      icon: FiMessageCircle,
      count: communityInsights.length 
    },
    { 
      id: 'profile' as const, 
      label: 'My Profile', 
      icon: FiUser,
      count: 0 
    }
  ];

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    searchTraders(query);
  }, [searchTraders]);

  const handleFollowTrader = useCallback(async (traderId: string) => {
    try {
      await followTrader(traderId);
    } catch (error) {
      console.error('Failed to follow trader:', error);
    }
  }, [followTrader]);

  const handleUnfollowTrader = useCallback(async (traderId: string) => {
    try {
      await unfollowTrader(traderId);
    } catch (error) {
      console.error('Failed to unfollow trader:', error);
    }
  }, [unfollowTrader]);

  const handleStartCopyTrade = useCallback(async (traderId: string, settings: CopyTradeSettings) => {
    try {
      await startCopyTrade(traderId, settings);
      setSelectedTrader(null); // Close modal after starting copy trade
    } catch (error) {
      console.error('Failed to start copy trade:', error);
      throw error;
    }
  }, [startCopyTrade]);

  const handleViewProfile = useCallback((trader: Trader) => {
    setSelectedTrader(trader);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setSelectedTrader(null);
  }, []);

  const handleRefresh = useCallback(() => {
    refreshSocial();
  }, [refreshSocial]);

  const renderDiscoverTab = () => (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search traders by name or strategy..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <FiFilter className="h-4 w-4" />
            Filters
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Trader Leaderboard */}
      <TraderLeaderboard
        traders={topTraders}
        onFollowTrader={handleFollowTrader}
        onViewProfile={handleViewProfile}
        isLoading={isLoading}
      />
    </div>
  );

  const renderFollowingTab = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">
          Following {followedTraders.length} Traders
        </h3>
        <p className="text-blue-700 dark:text-blue-400">
          Stay updated with their latest trades and insights
        </p>
      </div>

      {followedTraders.length === 0 ? (
        <div className="text-center py-12">
          <FiUsers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No traders followed yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Discover and follow successful traders to see their performance
          </p>
          <button
            onClick={() => setActiveTab('discover')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Discover Traders
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {followedTraders.map((trader) => (
            <div
              key={trader.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <img
                    src={trader.avatar}
                    alt={trader.name}
                    className="w-12 h-12 rounded-full"
                  />
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                      {trader.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {trader.strategy}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Return</div>
                    <div className={`text-lg font-semibold ${
                      trader.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {trader.totalReturn >= 0 ? '+' : ''}{trader.totalReturn.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleViewProfile(trader)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                    >
                      View Profile
                    </button>
                    
                    <button
                      onClick={() => handleUnfollowTrader(trader.id)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Unfollow
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderCopyTradingTab = () => (
    <div className="space-y-6">
      {/* Copy Trading Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <FiCopy className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
              Active Copies
            </span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">
            {getActiveTradesCount()}
          </div>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="text-sm font-medium text-green-900 dark:text-green-300 mb-2">
            Total Allocated
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-300">
            ${getTotalAllocated().toLocaleString()}
          </div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">
            Current Value
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">
            ${getTotalCurrentValue().toLocaleString()}
          </div>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <div className="text-sm font-medium text-yellow-900 dark:text-yellow-300 mb-2">
            Total Return
          </div>
          <div className={`text-2xl font-bold ${
            getTotalReturn() >= 0 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {getTotalReturn() >= 0 ? '+' : ''}{getTotalReturn().toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Copy Trading Component */}
      <CopyTrading
        copyTrades={activeCopyTrades}
        onStopCopyTrade={stopCopyTrade}
        onPauseCopyTrade={pauseCopyTrade}
        onResumeCopyTrade={resumeCopyTrade}
        isLoading={isLoading}
      />
    </div>
  );

  const renderCommunityTab = () => (
    <CommunityDiscussions
      insights={communityInsights}
      onLikeInsight={likeInsight}
      onCommentInsight={commentOnInsight}
      onShareInsight={shareInsight}
      isLoading={isLoading}
    />
  );

  const renderProfileTab = () => (
    <div className="space-y-6">
      {userProfile?.trader ? (
        <>
          {/* Profile Header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start space-x-6">
              <img
                src={userProfile.trader.avatar}
                alt={userProfile.trader.name}
                className="w-20 h-20 rounded-full"
              />
              
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {userProfile.trader.name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  @{userProfile.trader.username}
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  {userProfile.trader.bio}
                </p>
                
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {userProfile.trader.followers}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Followers
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {userProfile.trader.following}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Following
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      userProfile.trader.totalReturn >= 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      {userProfile.trader.totalReturn >= 0 ? '+' : ''}{userProfile.trader.totalReturn}%
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total Return
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Performance Overview
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userProfile.trader.winRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Win Rate
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userProfile.trader.totalTrades}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Trades
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-lg font-semibold text-red-600">
                  {userProfile.trader.maxDrawdown.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Max Drawdown
                </div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userProfile.trader.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Sharpe Ratio
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <FiUser className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Profile not available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Complete your profile setup to start social trading
          </p>
        </div>
      )}
    </div>
  );

  if (socialError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <div className="h-5 w-5 text-red-400">⚠️</div>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
              Error loading social trading data
            </h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-400">
              {socialError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Social Trading
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Discover, follow, and copy successful cryptocurrency traders
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 text-xs px-1.5 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'discover' && renderDiscoverTab()}
        {activeTab === 'following' && renderFollowingTab()}
        {activeTab === 'copying' && renderCopyTradingTab()}
        {activeTab === 'community' && renderCommunityTab()}
        {activeTab === 'profile' && renderProfileTab()}
      </div>

      {/* Trader Profile Modal */}
      {selectedTrader && (
        <TraderProfile
          trader={selectedTrader}
          onFollow={handleFollowTrader}
          onStartCopyTrade={handleStartCopyTrade}
          onClose={handleCloseProfile}
        />
      )}
    </div>
  );
};

export default SocialTrading;