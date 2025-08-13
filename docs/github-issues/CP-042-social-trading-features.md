# CP-042: Social Trading and Community Features

## Overview
Implement social trading features that allow users to follow successful traders, copy trades, share portfolio performance, and engage with a trading community through insights and discussions.

## Objectives
- Build trader following and portfolio sharing system
- Implement copy trading functionality with risk management
- Create community features for insights and discussions
- Add social proof and reputation system for traders

## Acceptance Criteria
- [ ] Trader profiles with performance history and statistics
- [ ] Follow/unfollow functionality for successful traders
- [ ] Copy trading with customizable allocation and risk settings
- [ ] Portfolio sharing with privacy controls
- [ ] Community discussions and insights sharing
- [ ] Trader leaderboards and rankings
- [ ] Social notifications for followed traders' activities
- [ ] Trade copying with stop-loss and take-profit settings
- [ ] Community challenges and competitions
- [ ] Social proof indicators (followers, success rate)

## Technical Implementation

### File Structure
```
src/
  components/
    Social/
      SocialTrading.jsx
      TraderProfile.jsx
      CopyTrading.jsx
      TraderLeaderboard.jsx
      CommunityDiscussions.jsx
      TradeSharing.jsx
      FollowedTraders.jsx
  hooks/
    useSocialTrading.js
    useCopyTrading.js
    useTraderProfiles.js
  services/
    SocialTradingService.js
    CopyTradingService.js
    CommunityService.js
  types/
    social.types.js
```

### Social Trading Dashboard
```jsx
// SocialTrading.jsx
import React, { useState, useEffect } from 'react';
import { useSocialTrading } from '../hooks/useSocialTrading';
import { useCopyTrading } from '../hooks/useCopyTrading';
import TraderLeaderboard from './TraderLeaderboard';
import FollowedTraders from './FollowedTraders';
import CommunityDiscussions from './CommunityDiscussions';
import TradeSharing from './TradeSharing';

const SocialTrading = ({ userId }) => {
  const [activeTab, setActiveTab] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    topTraders,
    followedTraders,
    communityInsights,
    userProfile,
    isLoading
  } = useSocialTrading(userId);

  const {
    activeCopyTrades,
    copyTradeHistory,
    manageCopyTrade,
    stopCopyTrade
  } = useCopyTrading(userId);

  const tabs = [
    { id: 'discover', label: 'Discover Traders', icon: '🔍' },
    { id: 'following', label: 'Following', icon: '👥' },
    { id: 'copying', label: 'Copy Trading', icon: '📋' },
    { id: 'community', label: 'Community', icon: '💬' },
    { id: 'profile', label: 'My Profile', icon: '👤' }
  ];

  const renderDiscoverTab = () => (
    <div className="discover-traders">
      <div className="search-traders">
        <input
          type="text"
          placeholder="Search traders by name or strategy..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="trader-search-input"
        />
      </div>

      <TraderLeaderboard
        traders={topTraders}
        searchQuery={searchQuery}
        onFollowTrader={(traderId) => console.log('Follow trader:', traderId)}
        onViewProfile={(traderId) => console.log('View profile:', traderId)}
      />
    </div>
  );

  const renderFollowingTab = () => (
    <div className="following-traders">
      <div className="following-summary">
        <h3>Following {followedTraders.length} Traders</h3>
        <p>Stay updated with their latest trades and insights</p>
      </div>

      <FollowedTraders
        traders={followedTraders}
        onUnfollow={(traderId) => console.log('Unfollow trader:', traderId)}
        onCopyTrade={(traderId) => console.log('Start copying:', traderId)}
        onViewInsights={(traderId) => console.log('View insights:', traderId)}
      />
    </div>
  );

  const renderCopyTradingTab = () => (
    <div className="copy-trading">
      <div className="copy-trading-summary">
        <div className="active-copies">
          <h4>Active Copy Trades</h4>
          <span className="count">{activeCopyTrades.length}</span>
        </div>
        <div className="total-allocated">
          <h4>Total Allocated</h4>
          <span className="amount">
            ${activeCopyTrades.reduce((sum, trade) => sum + trade.allocatedAmount, 0).toLocaleString()}
          </span>
        </div>
        <div className="monthly-performance">
          <h4>Monthly Performance</h4>
          <span className="percentage positive">+12.5%</span>
        </div>
      </div>

      <div className="copy-trades-list">
        {activeCopyTrades.map(copyTrade => (
          <div key={copyTrade.id} className="copy-trade-card">
            <div className="trader-info">
              <img src={copyTrade.trader.avatar} alt={copyTrade.trader.name} />
              <div className="trader-details">
                <h4>{copyTrade.trader.name}</h4>
                <p>{copyTrade.trader.strategy}</p>
              </div>
            </div>

            <div className="copy-trade-stats">
              <div className="stat">
                <label>Allocated</label>
                <span>${copyTrade.allocatedAmount.toLocaleString()}</span>
              </div>
              <div className="stat">
                <label>Performance</label>
                <span className={copyTrade.performance >= 0 ? 'positive' : 'negative'}>
                  {copyTrade.performance >= 0 ? '+' : ''}{copyTrade.performance.toFixed(2)}%
                </span>
              </div>
              <div className="stat">
                <label>Duration</label>
                <span>{copyTrade.duration}</span>
              </div>
            </div>

            <div className="copy-trade-actions">
              <button
                onClick={() => manageCopyTrade(copyTrade.id)}
                className="manage-btn"
              >
                Manage
              </button>
              <button
                onClick={() => stopCopyTrade(copyTrade.id)}
                className="stop-btn"
              >
                Stop Copying
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCommunityTab = () => (
    <div className="community-section">
      <CommunityDiscussions
        insights={communityInsights}
        onLikeInsight={(insightId) => console.log('Like insight:', insightId)}
        onCommentInsight={(insightId) => console.log('Comment on insight:', insightId)}
        onShareInsight={(insightId) => console.log('Share insight:', insightId)}
      />
    </div>
  );

  const renderProfileTab = () => (
    <div className="user-profile-section">
      <div className="profile-header">
        <img src={userProfile?.avatar} alt="Profile" className="profile-avatar" />
        <div className="profile-info">
          <h3>{userProfile?.name}</h3>
          <p className="profile-bio">{userProfile?.bio}</p>
          <div className="profile-stats">
            <div className="stat">
              <span className="value">{userProfile?.followers}</span>
              <span className="label">Followers</span>
            </div>
            <div className="stat">
              <span className="value">{userProfile?.following}</span>
              <span className="label">Following</span>
            </div>
            <div className="stat">
              <span className="value">{userProfile?.successRate}%</span>
              <span className="label">Success Rate</span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-content">
        <div className="performance-overview">
          <h4>Performance Overview</h4>
          <div className="performance-metrics">
            <div className="metric">
              <label>Total Return</label>
              <span className={userProfile?.totalReturn >= 0 ? 'positive' : 'negative'}>
                {userProfile?.totalReturn >= 0 ? '+' : ''}{userProfile?.totalReturn}%
              </span>
            </div>
            <div className="metric">
              <label>Best Month</label>
              <span className="positive">+{userProfile?.bestMonth}%</span>
            </div>
            <div className="metric">
              <label>Max Drawdown</label>
              <span className="negative">-{userProfile?.maxDrawdown}%</span>
            </div>
          </div>
        </div>

        <TradeSharing
          userId={userId}
          onShareTrade={(trade) => console.log('Share trade:', trade)}
          onDeleteSharedTrade={(tradeId) => console.log('Delete shared trade:', tradeId)}
        />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="social-trading-loading">
        <div className="loading-spinner"></div>
        <p>Loading social trading data...</p>
      </div>
    );
  }

  return (
    <div className="social-trading">
      <div className="social-trading-header">
        <h1>Social Trading</h1>
        <p>Discover, follow, and copy successful cryptocurrency traders</p>
      </div>

      <div className="social-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="social-content">
        {activeTab === 'discover' && renderDiscoverTab()}
        {activeTab === 'following' && renderFollowingTab()}
        {activeTab === 'copying' && renderCopyTradingTab()}
        {activeTab === 'community' && renderCommunityTab()}
        {activeTab === 'profile' && renderProfileTab()}
      </div>
    </div>
  );
};

export default SocialTrading;
```

### Trader Profile Component
```jsx
// TraderProfile.jsx
import React, { useState } from 'react';
import { useTraderProfiles } from '../hooks/useTraderProfiles';

const TraderProfile = ({ traderId, onFollow, onCopyTrade, onClose }) => {
  const [copyTradeSettings, setCopyTradeSettings] = useState({
    amount: 1000,
    stopLoss: 10,
    takeProfit: 20,
    maxOpenTrades: 5
  });

  const {
    trader,
    tradeHistory,
    performance,
    insights,
    isLoading
  } = useTraderProfiles(traderId);

  const [showCopyTradeModal, setShowCopyTradeModal] = useState(false);

  const handleCopyTradeSetup = () => {
    setShowCopyTradeModal(true);
  };

  const handleStartCopyTrade = () => {
    onCopyTrade({
      traderId,
      settings: copyTradeSettings
    });
    setShowCopyTradeModal(false);
  };

  if (isLoading) {
    return (
      <div className="trader-profile-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="trader-profile-modal">
      <div className="profile-modal-overlay" onClick={onClose}>
        <div className="profile-modal-content" onClick={e => e.stopPropagation()}>
          <div className="profile-header">
            <button className="close-btn" onClick={onClose}>×</button>
            
            <div className="trader-info">
              <img src={trader.avatar} alt={trader.name} className="trader-avatar" />
              <div className="trader-details">
                <h2>{trader.name}</h2>
                <p className="trader-strategy">{trader.strategy}</p>
                <div className="trader-badges">
                  {trader.badges?.map(badge => (
                    <span key={badge} className={`badge ${badge}`}>
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="profile-actions">
              <button
                onClick={() => onFollow(traderId)}
                className="follow-btn"
              >
                {trader.isFollowing ? 'Unfollow' : 'Follow'}
              </button>
              <button
                onClick={handleCopyTradeSetup}
                className="copy-trade-btn"
              >
                Copy Trades
              </button>
            </div>
          </div>

          <div className="profile-stats">
            <div className="stat-card">
              <h4>Total Return</h4>
              <span className={`value ${performance.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                {performance.totalReturn >= 0 ? '+' : ''}{performance.totalReturn}%
              </span>
            </div>
            <div className="stat-card">
              <h4>Win Rate</h4>
              <span className="value">{performance.winRate}%</span>
            </div>
            <div className="stat-card">
              <h4>Avg Monthly Return</h4>
              <span className={`value ${performance.avgMonthlyReturn >= 0 ? 'positive' : 'negative'}`}>
                {performance.avgMonthlyReturn >= 0 ? '+' : ''}{performance.avgMonthlyReturn}%
              </span>
            </div>
            <div className="stat-card">
              <h4>Max Drawdown</h4>
              <span className="value negative">-{performance.maxDrawdown}%</span>
            </div>
            <div className="stat-card">
              <h4>Followers</h4>
              <span className="value">{trader.followers?.toLocaleString()}</span>
            </div>
            <div className="stat-card">
              <h4>Copiers</h4>
              <span className="value">{trader.copiers?.toLocaleString()}</span>
            </div>
          </div>

          <div className="profile-content">
            <div className="content-tabs">
              <button className="tab active">Trade History</button>
              <button className="tab">Performance Chart</button>
              <button className="tab">Insights</button>
              <button className="tab">About</button>
            </div>

            <div className="trade-history">
              <h3>Recent Trades</h3>
              <div className="trades-list">
                {tradeHistory.slice(0, 10).map(trade => (
                  <div key={trade.id} className="trade-item">
                    <div className="trade-asset">
                      <img src={trade.assetIcon} alt={trade.asset} />
                      <span>{trade.asset}</span>
                    </div>
                    <div className="trade-type">
                      <span className={`type ${trade.type}`}>{trade.type}</span>
                    </div>
                    <div className="trade-amount">
                      <span>${trade.amount.toLocaleString()}</span>
                    </div>
                    <div className="trade-pnl">
                      <span className={trade.pnl >= 0 ? 'positive' : 'negative'}>
                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}%
                      </span>
                    </div>
                    <div className="trade-date">
                      <span>{new Date(trade.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showCopyTradeModal && (
            <div className="copy-trade-modal">
              <div className="modal-header">
                <h3>Copy Trade Settings</h3>
                <button onClick={() => setShowCopyTradeModal(false)}>×</button>
              </div>
              
              <div className="modal-content">
                <div className="setting-group">
                  <label>Investment Amount</label>
                  <input
                    type="number"
                    value={copyTradeSettings.amount}
                    onChange={(e) => setCopyTradeSettings(prev => ({
                      ...prev,
                      amount: parseFloat(e.target.value)
                    }))}
                    min="100"
                    step="100"
                  />
                </div>

                <div className="setting-group">
                  <label>Stop Loss (%)</label>
                  <input
                    type="number"
                    value={copyTradeSettings.stopLoss}
                    onChange={(e) => setCopyTradeSettings(prev => ({
                      ...prev,
                      stopLoss: parseFloat(e.target.value)
                    }))}
                    min="1"
                    max="50"
                  />
                </div>

                <div className="setting-group">
                  <label>Take Profit (%)</label>
                  <input
                    type="number"
                    value={copyTradeSettings.takeProfit}
                    onChange={(e) => setCopyTradeSettings(prev => ({
                      ...prev,
                      takeProfit: parseFloat(e.target.value)
                    }))}
                    min="5"
                    max="100"
                  />
                </div>

                <div className="setting-group">
                  <label>Max Open Trades</label>
                  <input
                    type="number"
                    value={copyTradeSettings.maxOpenTrades}
                    onChange={(e) => setCopyTradeSettings(prev => ({
                      ...prev,
                      maxOpenTrades: parseInt(e.target.value)
                    }))}
                    min="1"
                    max="20"
                  />
                </div>

                <div className="risk-warning">
                  <p>⚠️ Copy trading involves risk. Past performance does not guarantee future results.</p>
                </div>

                <div className="modal-actions">
                  <button
                    onClick={handleStartCopyTrade}
                    className="start-copy-btn"
                  >
                    Start Copy Trading
                  </button>
                  <button
                    onClick={() => setShowCopyTradeModal(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TraderProfile;
```

### Social Trading Service
```javascript
// SocialTradingService.js
class SocialTradingService {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async getTopTraders(filters = {}) {
    try {
      const response = await this.apiClient.get('/social/traders/top', {
        params: {
          timeframe: filters.timeframe || '30d',
          strategy: filters.strategy || 'all',
          minFollowers: filters.minFollowers || 0,
          limit: filters.limit || 50
        }
      });

      return response.data.map(trader => ({
        id: trader.id,
        name: trader.name,
        username: trader.username,
        avatar: trader.avatar,
        strategy: trader.strategy,
        followers: trader.followers,
        copiers: trader.copiers,
        totalReturn: trader.totalReturn,
        monthlyReturn: trader.monthlyReturn,
        winRate: trader.winRate,
        maxDrawdown: trader.maxDrawdown,
        riskScore: trader.riskScore,
        badges: trader.badges,
        isVerified: trader.isVerified,
        joinedDate: trader.joinedDate,
        lastActive: trader.lastActive
      }));
    } catch (error) {
      console.error('Error fetching top traders:', error);
      throw error;
    }
  }

  async getTraderProfile(traderId) {
    try {
      const response = await this.apiClient.get(`/social/traders/${traderId}`);
      
      return {
        ...response.data,
        tradeHistory: response.data.tradeHistory?.map(trade => ({
          id: trade.id,
          asset: trade.asset,
          type: trade.type,
          amount: trade.amount,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          pnl: trade.pnl,
          pnlPercentage: trade.pnlPercentage,
          openDate: trade.openDate,
          closeDate: trade.closeDate,
          status: trade.status
        }))
      };
    } catch (error) {
      console.error('Error fetching trader profile:', error);
      throw error;
    }
  }

  async followTrader(traderId) {
    try {
      const response = await this.apiClient.post(`/social/traders/${traderId}/follow`);
      return response.data;
    } catch (error) {
      console.error('Error following trader:', error);
      throw error;
    }
  }

  async unfollowTrader(traderId) {
    try {
      const response = await this.apiClient.delete(`/social/traders/${traderId}/follow`);
      return response.data;
    } catch (error) {
      console.error('Error unfollowing trader:', error);
      throw error;
    }
  }

  async getFollowedTraders(userId) {
    try {
      const response = await this.apiClient.get(`/social/users/${userId}/following`);
      return response.data;
    } catch (error) {
      console.error('Error fetching followed traders:', error);
      throw error;
    }
  }

  async startCopyTrade(traderId, settings) {
    try {
      const response = await this.apiClient.post(`/social/copy-trade/start`, {
        traderId,
        allocatedAmount: settings.amount,
        stopLossPercentage: settings.stopLoss,
        takeProfitPercentage: settings.takeProfit,
        maxOpenTrades: settings.maxOpenTrades,
        copyMode: settings.copyMode || 'percentage'
      });

      return response.data;
    } catch (error) {
      console.error('Error starting copy trade:', error);
      throw error;
    }
  }

  async stopCopyTrade(copyTradeId) {
    try {
      const response = await this.apiClient.post(`/social/copy-trade/${copyTradeId}/stop`);
      return response.data;
    } catch (error) {
      console.error('Error stopping copy trade:', error);
      throw error;
    }
  }

  async getCopyTrades(userId) {
    try {
      const response = await this.apiClient.get(`/social/users/${userId}/copy-trades`);
      return response.data;
    } catch (error) {
      console.error('Error fetching copy trades:', error);
      throw error;
    }
  }

  async getCommunityInsights(filters = {}) {
    try {
      const response = await this.apiClient.get('/social/insights', {
        params: {
          category: filters.category || 'all',
          timeframe: filters.timeframe || '7d',
          sortBy: filters.sortBy || 'popularity',
          limit: filters.limit || 20
        }
      });

      return response.data.map(insight => ({
        id: insight.id,
        title: insight.title,
        content: insight.content,
        author: insight.author,
        category: insight.category,
        tags: insight.tags,
        likes: insight.likes,
        comments: insight.comments,
        shares: insight.shares,
        createdAt: insight.createdAt,
        updatedAt: insight.updatedAt
      }));
    } catch (error) {
      console.error('Error fetching community insights:', error);
      throw error;
    }
  }

  async shareTradeInsight(tradeData, insight) {
    try {
      const response = await this.apiClient.post('/social/insights/trade', {
        tradeId: tradeData.id,
        title: insight.title,
        content: insight.content,
        tags: insight.tags,
        visibility: insight.visibility || 'public'
      });

      return response.data;
    } catch (error) {
      console.error('Error sharing trade insight:', error);
      throw error;
    }
  }

  async likeInsight(insightId) {
    try {
      const response = await this.apiClient.post(`/social/insights/${insightId}/like`);
      return response.data;
    } catch (error) {
      console.error('Error liking insight:', error);
      throw error;
    }
  }

  async commentOnInsight(insightId, comment) {
    try {
      const response = await this.apiClient.post(`/social/insights/${insightId}/comments`, {
        content: comment
      });
      return response.data;
    } catch (error) {
      console.error('Error commenting on insight:', error);
      throw error;
    }
  }

  async getUserSocialProfile(userId) {
    try {
      const response = await this.apiClient.get(`/social/users/${userId}/profile`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user social profile:', error);
      throw error;
    }
  }

  async updateSocialProfile(userId, profileData) {
    try {
      const response = await this.apiClient.put(`/social/users/${userId}/profile`, profileData);
      return response.data;
    } catch (error) {
      console.error('Error updating social profile:', error);
      throw error;
    }
  }
}

export const socialTradingService = new SocialTradingService();
```

## Testing Requirements
- Social features integration testing
- Copy trading accuracy validation
- User profile and permissions testing
- Community feature functionality testing
- Real-time social notifications testing

## Dependencies
- Depends on: CP-022 (Exchange Order Execution)
- Depends on: CP-033 (Notification System)
- Blocks: CP-054 (Automated Trading Strategies)

## Time Estimate
**Beginner**: 12-14 days
**Intermediate**: 8-10 days
**Advanced**: 5-7 days

## Required Skills
- Social platform development concepts
- Real-time communication features
- User permission and privacy systems
- Copy trading risk management
- Community moderation features