import { useState, useEffect, useCallback } from 'react';
import { socialTradingService } from '../services/SocialTradingService';
import { 
  Trader, 
  TraderLeaderboardEntry, 
  SocialTradingFilters, 
  UserSocialProfile,
  CommunityInsight,
  InsightFilters
} from '../types/social.types';

export const useSocialTrading = (userId?: string) => {
  const [topTraders, setTopTraders] = useState<TraderLeaderboardEntry[]>([]);
  const [followedTraders, setFollowedTraders] = useState<Trader[]>([]);
  const [communityInsights, setCommunityInsights] = useState<CommunityInsight[]>([]);
  const [userProfile, setUserProfile] = useState<UserSocialProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<SocialTradingFilters>({
    timeframe: '30d',
    sortBy: 'return',
    sortOrder: 'desc'
  });

  const [insightFilters, setInsightFilters] = useState<InsightFilters>({
    timeframe: '7d',
    sortBy: 'popular'
  });

  const loadTopTraders = useCallback(async (customFilters?: SocialTradingFilters) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const traders = await socialTradingService.getTopTraders(customFilters || filters);
      setTopTraders(traders);
      
    } catch (err) {
      console.error('Error loading top traders:', err);
      setError('Failed to load top traders');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const loadFollowedTraders = useCallback(async () => {
    if (!userId) return;

    try {
      const traders = await socialTradingService.getFollowedTraders(userId);
      setFollowedTraders(traders);
    } catch (err) {
      console.error('Error loading followed traders:', err);
    }
  }, [userId]);

  const loadCommunityInsights = useCallback(async (customFilters?: InsightFilters) => {
    try {
      const insights = await socialTradingService.getCommunityInsights(customFilters || insightFilters);
      setCommunityInsights(insights);
    } catch (err) {
      console.error('Error loading community insights:', err);
    }
  }, [insightFilters]);

  const loadUserProfile = useCallback(async () => {
    if (!userId) return;

    try {
      const profile = await socialTradingService.getUserSocialProfile(userId);
      setUserProfile(profile);
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  }, [userId]);

  const followTrader = useCallback(async (traderId: string) => {
    try {
      await socialTradingService.followTrader(traderId);
      
      // Update local state
      setTopTraders(prev => 
        prev.map(entry => 
          entry.trader.id === traderId
            ? {
                ...entry,
                trader: {
                  ...entry.trader,
                  followers: entry.trader.followers + 1
                }
              }
            : entry
        )
      );

      // Reload followed traders
      await loadFollowedTraders();

    } catch (err) {
      console.error('Error following trader:', err);
      throw err;
    }
  }, [loadFollowedTraders]);

  const unfollowTrader = useCallback(async (traderId: string) => {
    try {
      await socialTradingService.unfollowTrader(traderId);
      
      // Update local state
      setTopTraders(prev => 
        prev.map(entry => 
          entry.trader.id === traderId
            ? {
                ...entry,
                trader: {
                  ...entry.trader,
                  followers: Math.max(0, entry.trader.followers - 1)
                }
              }
            : entry
        )
      );

      setFollowedTraders(prev => 
        prev.filter(trader => trader.id !== traderId)
      );

    } catch (err) {
      console.error('Error unfollowing trader:', err);
      throw err;
    }
  }, []);

  const likeInsight = useCallback(async (insightId: string) => {
    try {
      await socialTradingService.likeInsight(insightId);
      
      // Update local state
      setCommunityInsights(prev =>
        prev.map(insight =>
          insight.id === insightId
            ? {
                ...insight,
                likes: insight.isLiked ? insight.likes - 1 : insight.likes + 1,
                isLiked: !insight.isLiked
              }
            : insight
        )
      );

    } catch (err) {
      console.error('Error liking insight:', err);
      throw err;
    }
  }, []);

  const commentOnInsight = useCallback(async (insightId: string, comment: string) => {
    try {
      await socialTradingService.commentOnInsight(insightId, comment);
      
      // Update local state
      setCommunityInsights(prev =>
        prev.map(insight =>
          insight.id === insightId
            ? { ...insight, comments: insight.comments + 1 }
            : insight
        )
      );

      // Reload insights to get the new comment
      await loadCommunityInsights();

    } catch (err) {
      console.error('Error commenting on insight:', err);
      throw err;
    }
  }, [loadCommunityInsights]);

  const shareInsight = useCallback(async (insightId: string) => {
    try {
      await socialTradingService.shareInsight(insightId);
      
      // Update local state
      setCommunityInsights(prev =>
        prev.map(insight =>
          insight.id === insightId
            ? { ...insight, shares: insight.shares + 1 }
            : insight
        )
      );

    } catch (err) {
      console.error('Error sharing insight:', err);
      throw err;
    }
  }, []);

  const searchTraders = useCallback(async (query: string) => {
    if (!query.trim()) {
      await loadTopTraders();
      return;
    }

    const searchFilters: SocialTradingFilters = {
      ...filters,
      // Add search functionality here
      // In a real implementation, this would be a search query parameter
    };

    await loadTopTraders(searchFilters);
  }, [filters, loadTopTraders]);

  const updateFilters = useCallback(async (newFilters: Partial<SocialTradingFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    await loadTopTraders(updatedFilters);
  }, [filters, loadTopTraders]);

  const updateInsightFilters = useCallback(async (newFilters: Partial<InsightFilters>) => {
    const updatedFilters = { ...insightFilters, ...newFilters };
    setInsightFilters(updatedFilters);
    await loadCommunityInsights(updatedFilters);
  }, [insightFilters, loadCommunityInsights]);

  const refresh = useCallback(async () => {
    await Promise.all([
      loadTopTraders(),
      loadFollowedTraders(),
      loadCommunityInsights(),
      loadUserProfile()
    ]);
  }, [loadTopTraders, loadFollowedTraders, loadCommunityInsights, loadUserProfile]);

  // Initial load
  useEffect(() => {
    loadTopTraders();
  }, []);

  useEffect(() => {
    loadFollowedTraders();
  }, [loadFollowedTraders]);

  useEffect(() => {
    loadCommunityInsights();
  }, []);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // Auto-refresh data every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        refresh();
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [refresh, isLoading]);

  return {
    // Data
    topTraders,
    followedTraders,
    communityInsights,
    userProfile,
    
    // State
    isLoading,
    error,
    filters,
    insightFilters,
    
    // Actions
    followTrader,
    unfollowTrader,
    likeInsight,
    commentOnInsight,
    shareInsight,
    searchTraders,
    updateFilters,
    updateInsightFilters,
    refresh,
    
    // Loaders
    loadTopTraders,
    loadFollowedTraders,
    loadCommunityInsights,
    loadUserProfile
  };
};

export default useSocialTrading;