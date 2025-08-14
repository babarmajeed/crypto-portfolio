interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  currentPrice?: number;
  priceChangePercentage24h?: number;
  marketCapRank?: number;
}

interface SearchSession {
  id: string;
  query: string;
  filters?: any;
  results: SearchResult[];
  timestamp: Date;
  duration: number;
}

class StorageService {
  private readonly SEARCH_HISTORY_KEY = 'crypto_search_history';
  private readonly TRENDING_SEARCHES_KEY = 'crypto_trending_searches';
  private readonly SEARCH_SESSIONS_KEY = 'crypto_search_sessions';
  private readonly SEARCH_PREFERENCES_KEY = 'crypto_search_preferences';
  private readonly MAX_HISTORY_ITEMS = 50;
  private readonly MAX_TRENDING_ITEMS = 20;
  private readonly MAX_SESSIONS = 100;
  private readonly DATA_VERSION = '1.0';

  /**
   * Get search history
   */
  getSearchHistory(): SearchResult[] {
    try {
      const stored = localStorage.getItem(this.SEARCH_HISTORY_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (this.validateStorageData(data, 'history')) {
          return data.items || [];
        }
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
      this.clearSearchHistory(); // Clear corrupted data
    }
    return [];
  }

  /**
   * Save search history
   */
  saveSearchHistory(history: SearchResult[]): void {
    try {
      const data = {
        version: this.DATA_VERSION,
        timestamp: new Date().toISOString(),
        items: history.slice(0, this.MAX_HISTORY_ITEMS)
      };
      localStorage.setItem(this.SEARCH_HISTORY_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save search history:', error);
      this.handleStorageError(error);
    }
  }

  /**
   * Add item to search history
   */
  addToSearchHistory(item: SearchResult): void {
    const history = this.getSearchHistory();
    
    // Remove existing entry if present
    const filtered = history.filter(h => h.symbol !== item.symbol);
    
    // Add to beginning
    const updated = [item, ...filtered].slice(0, this.MAX_HISTORY_ITEMS);
    
    this.saveSearchHistory(updated);
  }

  /**
   * Clear search history
   */
  clearSearchHistory(): void {
    try {
      localStorage.removeItem(this.SEARCH_HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }

  /**
   * Get trending searches
   */
  getTrendingSearches(): SearchResult[] {
    try {
      const stored = localStorage.getItem(this.TRENDING_SEARCHES_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (this.validateStorageData(data, 'trending')) {
          return data.items || [];
        }
      }
    } catch (error) {
      console.error('Failed to load trending searches:', error);
      this.clearTrendingSearches();
    }
    return [];
  }

  /**
   * Save trending searches
   */
  saveTrendingSearches(trending: SearchResult[]): void {
    try {
      const data = {
        version: this.DATA_VERSION,
        timestamp: new Date().toISOString(),
        items: trending.slice(0, this.MAX_TRENDING_ITEMS)
      };
      localStorage.setItem(this.TRENDING_SEARCHES_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save trending searches:', error);
      this.handleStorageError(error);
    }
  }

  /**
   * Clear trending searches
   */
  clearTrendingSearches(): void {
    try {
      localStorage.removeItem(this.TRENDING_SEARCHES_KEY);
    } catch (error) {
      console.error('Failed to clear trending searches:', error);
    }
  }

  /**
   * Save search session for analytics
   */
  saveSearchSession(session: Omit<SearchSession, 'id'>): void {
    try {
      const sessions = this.getSearchSessions();
      const newSession: SearchSession = {
        id: this.generateSessionId(),
        ...session
      };
      
      const updated = [newSession, ...sessions].slice(0, this.MAX_SESSIONS);
      
      const data = {
        version: this.DATA_VERSION,
        timestamp: new Date().toISOString(),
        sessions: updated
      };
      
      localStorage.setItem(this.SEARCH_SESSIONS_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save search session:', error);
      this.handleStorageError(error);
    }
  }

  /**
   * Get search sessions
   */
  getSearchSessions(): SearchSession[] {
    try {
      const stored = localStorage.getItem(this.SEARCH_SESSIONS_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (this.validateStorageData(data, 'sessions')) {
          return (data.sessions || []).map((session: any) => ({
            ...session,
            timestamp: new Date(session.timestamp)
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load search sessions:', error);
    }
    return [];
  }

  /**
   * Get search analytics
   */
  getSearchAnalytics(): {
    totalSearches: number;
    popularQueries: Array<{ query: string; count: number }>;
    averageSessionDuration: number;
    mostSearchedAssets: Array<{ symbol: string; count: number }>;
    searchTrends: Array<{ date: string; searches: number }>;
  } {
    const sessions = this.getSearchSessions();
    
    if (sessions.length === 0) {
      return {
        totalSearches: 0,
        popularQueries: [],
        averageSessionDuration: 0,
        mostSearchedAssets: [],
        searchTrends: []
      };
    }

    // Count queries
    const queryCounts = new Map<string, number>();
    sessions.forEach(session => {
      if (session.query) {
        const count = queryCounts.get(session.query) || 0;
        queryCounts.set(session.query, count + 1);
      }
    });

    const popularQueries = Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Count searched assets
    const assetCounts = new Map<string, number>();
    sessions.forEach(session => {
      session.results.forEach(result => {
        const count = assetCounts.get(result.symbol) || 0;
        assetCounts.set(result.symbol, count + 1);
      });
    });

    const mostSearchedAssets = Array.from(assetCounts.entries())
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average session duration
    const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const averageSessionDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;

    // Generate search trends (last 30 days)
    const searchTrends = this.generateSearchTrends(sessions);

    return {
      totalSearches: sessions.length,
      popularQueries,
      averageSessionDuration,
      mostSearchedAssets,
      searchTrends
    };
  }

  /**
   * Get search preferences
   */
  getSearchPreferences(): {
    defaultSortBy: string;
    defaultViewMode: 'grid' | 'list';
    showSuggestions: boolean;
    enableHistory: boolean;
    maxSuggestions: number;
  } {
    try {
      const stored = localStorage.getItem(this.SEARCH_PREFERENCES_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        return {
          defaultSortBy: preferences.defaultSortBy || 'relevance',
          defaultViewMode: preferences.defaultViewMode || 'grid',
          showSuggestions: preferences.showSuggestions !== false,
          enableHistory: preferences.enableHistory !== false,
          maxSuggestions: preferences.maxSuggestions || 10
        };
      }
    } catch (error) {
      console.error('Failed to load search preferences:', error);
    }
    
    return {
      defaultSortBy: 'relevance',
      defaultViewMode: 'grid',
      showSuggestions: true,
      enableHistory: true,
      maxSuggestions: 10
    };
  }

  /**
   * Save search preferences
   */
  saveSearchPreferences(preferences: Partial<{
    defaultSortBy: string;
    defaultViewMode: 'grid' | 'list';
    showSuggestions: boolean;
    enableHistory: boolean;
    maxSuggestions: number;
  }>): void {
    try {
      const current = this.getSearchPreferences();
      const updated = { ...current, ...preferences };
      localStorage.setItem(this.SEARCH_PREFERENCES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save search preferences:', error);
    }
  }

  /**
   * Export all search data
   */
  exportSearchData(): string {
    return JSON.stringify({
      version: this.DATA_VERSION,
      exportDate: new Date().toISOString(),
      searchHistory: this.getSearchHistory(),
      trendingSearches: this.getTrendingSearches(),
      searchSessions: this.getSearchSessions(),
      searchPreferences: this.getSearchPreferences(),
      analytics: this.getSearchAnalytics()
    }, null, 2);
  }

  /**
   * Import search data
   */
  importSearchData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.searchHistory) {
        this.saveSearchHistory(data.searchHistory);
      }
      
      if (data.trendingSearches) {
        this.saveTrendingSearches(data.trendingSearches);
      }
      
      if (data.searchPreferences) {
        this.saveSearchPreferences(data.searchPreferences);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import search data:', error);
      return false;
    }
  }

  /**
   * Clear all search data
   */
  clearAllSearchData(): void {
    this.clearSearchHistory();
    this.clearTrendingSearches();
    
    try {
      localStorage.removeItem(this.SEARCH_SESSIONS_KEY);
      localStorage.removeItem(this.SEARCH_PREFERENCES_KEY);
    } catch (error) {
      console.error('Failed to clear search data:', error);
    }
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): {
    totalSize: number;
    itemCounts: { [key: string]: number };
    lastUpdated: { [key: string]: string };
  } {
    const keys = [
      this.SEARCH_HISTORY_KEY,
      this.TRENDING_SEARCHES_KEY,
      this.SEARCH_SESSIONS_KEY,
      this.SEARCH_PREFERENCES_KEY
    ];
    
    let totalSize = 0;
    const itemCounts: { [key: string]: number } = {};
    const lastUpdated: { [key: string]: string } = {};
    
    keys.forEach(key => {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          totalSize += data.length;
          
          const parsed = JSON.parse(data);
          if (parsed.items) {
            itemCounts[key] = parsed.items.length;
          } else if (parsed.sessions) {
            itemCounts[key] = parsed.sessions.length;
          } else {
            itemCounts[key] = 1;
          }
          
          lastUpdated[key] = parsed.timestamp || 'Unknown';
        }
      } catch (error) {
        // Ignore parsing errors
      }
    });
    
    return {
      totalSize,
      itemCounts,
      lastUpdated
    };
  }

  // Private methods

  private validateStorageData(data: any, type: string): boolean {
    if (!data || typeof data !== 'object') return false;
    
    switch (type) {
      case 'history':
      case 'trending':
        return Array.isArray(data.items);
      case 'sessions':
        return Array.isArray(data.sessions);
      default:
        return true;
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSearchTrends(sessions: SearchSession[]): Array<{ date: string; searches: number }> {
    const trends = new Map<string, number>();
    const now = new Date();
    
    // Initialize last 30 days with 0
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trends.set(dateStr, 0);
    }
    
    // Count searches by date
    sessions.forEach(session => {
      const dateStr = session.timestamp.toISOString().split('T')[0];
      if (trends.has(dateStr)) {
        trends.set(dateStr, (trends.get(dateStr) || 0) + 1);
      }
    });
    
    return Array.from(trends.entries())
      .map(([date, searches]) => ({ date, searches }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private handleStorageError(error: any): void {
    // Check if storage quota exceeded
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('Storage quota exceeded, cleaning up old data...');
      this.cleanupOldData();
    }
  }

  private cleanupOldData(): void {
    try {
      // Remove oldest search sessions
      const sessions = this.getSearchSessions();
      if (sessions.length > this.MAX_SESSIONS / 2) {
        const cleaned = sessions.slice(0, Math.floor(this.MAX_SESSIONS / 2));
        const data = {
          version: this.DATA_VERSION,
          timestamp: new Date().toISOString(),
          sessions: cleaned
        };
        localStorage.setItem(this.SEARCH_SESSIONS_KEY, JSON.stringify(data));
      }
      
      // Trim search history
      const history = this.getSearchHistory();
      if (history.length > this.MAX_HISTORY_ITEMS / 2) {
        this.saveSearchHistory(history.slice(0, Math.floor(this.MAX_HISTORY_ITEMS / 2)));
      }
    } catch (error) {
      console.error('Failed to cleanup old data:', error);
    }
  }
}

export const storageService = new StorageService();
export type { SearchResult, SearchSession };