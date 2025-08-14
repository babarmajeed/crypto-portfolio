import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchService } from '../../services/search/SearchService';
import { storageService } from '../../services/search/StorageService';
import { debounce } from '../../utils/debounce';

interface SearchResult {
  id: string;
  symbol: string;
  name: string;
  image: string;
  currentPrice: number;
  priceChangePercentage24h: number;
  marketCap: number;
  marketCapRank: number;
  volume24h: number;
}

interface SearchFilters {
  priceRange: { min: number | null; max: number | null };
  marketCapRange: { min: number | null; max: number | null };
  volumeRange: { min: number | null; max: number | null };
  changeRange: { min: number | null; max: number | null };
  categories: string[];
  exchanges: string[];
  hasHoldings: boolean;
  inWatchlist: boolean;
}

interface UseAssetSearchReturn {
  suggestions: SearchResult[];
  searchResults: SearchResult[];
  isLoading: boolean;
  error: Error | null;
  searchHistory: SearchResult[];
  trendingSearches: SearchResult[];
  addToHistory: (asset: SearchResult) => void;
  clearHistory: () => void;
  performSearch: (query: string, filters?: SearchFilters) => Promise<SearchResult[]>;
  clearCache: () => void;
}

const SEARCH_HISTORY_KEY = 'crypto_search_history';
const TRENDING_SEARCHES_KEY = 'crypto_trending_searches';
const MAX_HISTORY_ITEMS = 10;
const MAX_TRENDING_ITEMS = 5;

export const useAssetSearch = (): UseAssetSearchReturn => {
  const [searchHistory, setSearchHistory] = useState<SearchResult[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<SearchResult[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentFilters, setCurrentFilters] = useState<SearchFilters | undefined>();

  const queryClient = useQueryClient();

  // Load search history and trending searches on mount
  useEffect(() => {
    loadSearchHistory();
    loadTrendingSearches();
  }, []);

  // Query for suggestions (auto-complete)
  const {
    data: suggestions = [],
    isLoading: suggestionsLoading,
    error: suggestionsError
  } = useQuery({
    queryKey: ['search-suggestions', currentQuery],
    queryFn: () => searchService.getSuggestions(currentQuery),
    enabled: currentQuery.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: false,
    retry: 1
  });

  // Query for search results
  const {
    data: searchResults = [],
    isLoading: searchLoading,
    error: searchError,
    refetch: refetchSearch
  } = useQuery({
    queryKey: ['asset-search', currentQuery, currentFilters],
    queryFn: () => searchService.searchAssets(currentQuery, currentFilters),
    enabled: currentQuery.length >= 2,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: false,
    retry: 2
  });

  const loadSearchHistory = useCallback(() => {
    try {
      const history = storageService.getSearchHistory();
      setSearchHistory(history.slice(0, MAX_HISTORY_ITEMS));
    } catch (error) {
      console.error('Failed to load search history:', error);
      setSearchHistory([]);
    }
  }, []);

  const loadTrendingSearches = useCallback(async () => {
    try {
      // Try to get trending from API first
      const trending = await searchService.getTrendingSearches();
      setTrendingSearches(trending.slice(0, MAX_TRENDING_ITEMS));
    } catch (error) {
      console.error('Failed to load trending searches:', error);
      // Fallback to local storage
      try {
        const localTrending = storageService.getTrendingSearches();
        setTrendingSearches(localTrending.slice(0, MAX_TRENDING_ITEMS));
      } catch (localError) {
        setTrendingSearches([]);
      }
    }
  }, []);

  const addToHistory = useCallback((asset: SearchResult) => {
    try {
      setSearchHistory(prevHistory => {
        // Remove existing entry if present
        const filteredHistory = prevHistory.filter(item => item.symbol !== asset.symbol);
        // Add to beginning
        const newHistory = [asset, ...filteredHistory].slice(0, MAX_HISTORY_ITEMS);
        
        // Save to storage
        storageService.saveSearchHistory(newHistory);
        
        return newHistory;
      });

      // Update trending searches usage
      updateTrendingUsage(asset);
    } catch (error) {
      console.error('Failed to add to search history:', error);
    }
  }, []);

  const updateTrendingUsage = useCallback((asset: SearchResult) => {
    try {
      setTrendingSearches(prevTrending => {
        const existingIndex = prevTrending.findIndex(item => item.symbol === asset.symbol);
        
        let newTrending;
        if (existingIndex >= 0) {
          // Move to front
          newTrending = [
            prevTrending[existingIndex],
            ...prevTrending.slice(0, existingIndex),
            ...prevTrending.slice(existingIndex + 1)
          ];
        } else {
          // Add new entry
          newTrending = [asset, ...prevTrending].slice(0, MAX_TRENDING_ITEMS);
        }

        // Save to storage
        storageService.saveTrendingSearches(newTrending);
        
        return newTrending;
      });
    } catch (error) {
      console.error('Failed to update trending usage:', error);
    }
  }, []);

  const clearHistory = useCallback(() => {
    try {
      setSearchHistory([]);
      storageService.clearSearchHistory();
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, []);

  const performSearch = useCallback(async (query: string, filters?: SearchFilters): Promise<SearchResult[]> => {
    if (query.length < 2) {
      return [];
    }

    try {
      setCurrentQuery(query);
      setCurrentFilters(filters);
      
      // The query will automatically trigger due to the dependency change
      const result = await queryClient.fetchQuery({
        queryKey: ['asset-search', query, filters],
        queryFn: () => searchService.searchAssets(query, filters),
        staleTime: 60 * 1000,
      });

      return result;
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }, [queryClient]);

  const clearCache = useCallback(() => {
    // Clear React Query cache
    queryClient.removeQueries({ queryKey: ['search-suggestions'] });
    queryClient.removeQueries({ queryKey: ['asset-search'] });
    
    // Clear service cache
    searchService.clearCache();
  }, [queryClient]);

  // Debounced search function for real-time updates
  const debouncedPerformSearch = useCallback(
    debounce((query: string, filters?: SearchFilters) => {
      if (query.length >= 2) {
        performSearch(query, filters);
      }
    }, 300),
    [performSearch]
  );

  return {
    suggestions,
    searchResults,
    isLoading: suggestionsLoading || searchLoading,
    error: suggestionsError || searchError,
    searchHistory,
    trendingSearches,
    addToHistory,
    clearHistory,
    performSearch: debouncedPerformSearch,
    clearCache
  };
};