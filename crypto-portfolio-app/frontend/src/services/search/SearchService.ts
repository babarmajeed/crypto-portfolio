import axios, { AxiosInstance } from 'axios';
import { assetService } from '../assetService';

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
  description?: string;
  categories?: string[];
}

interface SearchFilters {
  priceRange?: { min: number | null; max: number | null };
  marketCapRange?: { min: number | null; max: number | null };
  volumeRange?: { min: number | null; max: number | null };
  changeRange?: { min: number | null; max: number | null };
  categories?: string[];
  exchanges?: string[];
  hasHoldings?: boolean;
  inWatchlist?: boolean;
}

interface SearchOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'marketCap' | 'volume' | 'change' | 'name';
  sortOrder?: 'asc' | 'desc';
  includeMetadata?: boolean;
}

class SearchService {
  private api: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SUGGESTIONS_TTL = 30 * 1000; // 30 seconds

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.cache = new Map();

    // Add auth token to requests if available
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get search suggestions for auto-complete
   */
  async getSuggestions(query: string, limit: number = 10): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `suggestions:${query.toLowerCase()}:${limit}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/search/suggestions', {
        params: { q: query, limit }
      });

      const suggestions = this.transformSearchResults(response.data.suggestions || []);
      this.setCache(cacheKey, suggestions, this.SUGGESTIONS_TTL);
      
      return suggestions;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      // Fallback to fuzzy search on local data
      return this.getFuzzySearchSuggestions(query, limit);
    }
  }

  /**
   * Search assets with filters and options
   */
  async searchAssets(
    query: string, 
    filters?: SearchFilters, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `search:${query}:${JSON.stringify(filters)}:${JSON.stringify(options)}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.post('/search/assets', {
        query,
        filters,
        options: {
          limit: 100,
          offset: 0,
          sortBy: 'relevance',
          sortOrder: 'desc',
          includeMetadata: true,
          ...options
        }
      });

      const results = this.transformSearchResults(response.data.results || []);
      
      // Apply client-side filtering if needed
      const filteredResults = this.applyFilters(results, filters);
      
      this.setCache(cacheKey, filteredResults, this.DEFAULT_TTL);
      
      return filteredResults;
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback to fuzzy search on local data
      return this.getFuzzySearchResults(query, filters, options);
    }
  }

  /**
   * Get trending searches
   */
  async getTrendingSearches(limit: number = 10): Promise<SearchResult[]> {
    const cacheKey = `trending:${limit}`;
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.api.get('/search/trending', {
        params: { limit }
      });

      const trending = this.transformSearchResults(response.data.trending || []);
      this.setCache(cacheKey, trending, this.DEFAULT_TTL);
      
      return trending;
    } catch (error) {
      console.error('Failed to get trending searches:', error);
      // Fallback to popular assets
      return this.getPopularAssets(limit);
    }
  }

  /**
   * Search with advanced operators
   */
  async advancedSearch(searchExpression: string): Promise<SearchResult[]> {
    // Parse advanced search operators like:
    // price:>100 AND marketcap:<1B AND category:defi
    const parsedFilters = this.parseSearchExpression(searchExpression);
    
    return this.searchAssets(parsedFilters.query, parsedFilters.filters);
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(): Promise<{
    popularSearches: Array<{ query: string; count: number }>;
    topCategories: Array<{ category: string; searches: number }>;
    searchTrends: Array<{ date: string; searches: number }>;
  }> {
    try {
      const response = await this.api.get('/search/analytics');
      return response.data;
    } catch (error) {
      console.error('Failed to get search analytics:', error);
      return {
        popularSearches: [],
        topCategories: [],
        searchTrends: []
      };
    }
  }

  // Private methods

  private transformSearchResults(rawResults: any[]): SearchResult[] {
    return rawResults.map(result => ({
      id: result.id || result.symbol?.toLowerCase(),
      symbol: result.symbol?.toUpperCase() || '',
      name: result.name || '',
      image: result.image || result.icon || this.getDefaultIcon(result.symbol),
      currentPrice: result.current_price || result.currentPrice || 0,
      priceChangePercentage24h: result.price_change_percentage_24h || result.priceChangePercentage24h || 0,
      marketCap: result.market_cap || result.marketCap || 0,
      marketCapRank: result.market_cap_rank || result.marketCapRank || 0,
      volume24h: result.total_volume || result.volume24h || 0,
      description: result.description,
      categories: result.categories || []
    }));
  }

  private applyFilters(results: SearchResult[], filters?: SearchFilters): SearchResult[] {
    if (!filters) return results;

    return results.filter(result => {
      // Price range filter
      if (filters.priceRange) {
        const { min, max } = filters.priceRange;
        if (min !== null && result.currentPrice < min) return false;
        if (max !== null && result.currentPrice > max) return false;
      }

      // Market cap range filter
      if (filters.marketCapRange) {
        const { min, max } = filters.marketCapRange;
        if (min !== null && result.marketCap < min) return false;
        if (max !== null && result.marketCap > max) return false;
      }

      // Volume range filter
      if (filters.volumeRange) {
        const { min, max } = filters.volumeRange;
        if (min !== null && result.volume24h < min) return false;
        if (max !== null && result.volume24h > max) return false;
      }

      // Change range filter
      if (filters.changeRange) {
        const { min, max } = filters.changeRange;
        if (min !== null && result.priceChangePercentage24h < min) return false;
        if (max !== null && result.priceChangePercentage24h > max) return false;
      }

      // Categories filter
      if (filters.categories && filters.categories.length > 0) {
        if (!result.categories || !result.categories.some(cat => filters.categories!.includes(cat))) {
          return false;
        }
      }

      return true;
    });
  }

  private getFuzzySearchSuggestions(query: string, limit: number): Promise<SearchResult[]> {
    return this.getFuzzySearchResults(query, undefined, { limit });
  }

  private async getFuzzySearchResults(
    query: string, 
    filters?: SearchFilters, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      // Get popular assets as fallback data
      const assets = await assetService.getTopAssets(500);
      const searchableAssets = assets.map(asset => ({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        image: asset.image,
        currentPrice: asset.currentPrice,
        priceChangePercentage24h: asset.priceChangePercentage24h,
        marketCap: asset.marketCap,
        marketCapRank: asset.marketCapRank || asset.rank,
        volume24h: asset.volume24h,
        categories: []
      }));

      // Perform fuzzy search
      const scored = this.fuzzySearch(query, searchableAssets);
      
      // Apply filters
      const filtered = this.applyFilters(scored, filters);
      
      // Apply options
      const limited = filtered.slice(0, options.limit || 50);
      
      return limited;
    } catch (error) {
      console.error('Fuzzy search failed:', error);
      return [];
    }
  }

  private fuzzySearch(query: string, assets: SearchResult[]): SearchResult[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    if (!normalizedQuery) return assets;

    const scored = assets
      .map(asset => ({
        ...asset,
        score: this.calculateFuzzyScore(normalizedQuery, asset)
      }))
      .filter(asset => asset.score > 0)
      .sort((a, b) => (b as any).score - (a as any).score);

    return scored.map(({ score, ...asset }) => asset);
  }

  private calculateFuzzyScore(query: string, asset: SearchResult): number {
    const symbol = asset.symbol.toLowerCase();
    const name = asset.name.toLowerCase();
    
    let score = 0;
    
    // Exact matches get highest priority
    if (symbol === query) score += 1000;
    else if (name === query) score += 900;
    
    // Starts with matches
    else if (symbol.startsWith(query)) score += 800;
    else if (name.startsWith(query)) score += 700;
    
    // Contains matches
    else if (symbol.includes(query)) score += 600;
    else if (name.includes(query)) score += 500;
    
    // Substring matches with distance calculation
    else {
      const symbolDistance = this.levenshteinDistance(query, symbol);
      const nameDistance = this.levenshteinDistance(query, name);
      
      // If distance is reasonable, give some score
      if (symbolDistance <= query.length / 2) {
        score += Math.max(0, 400 - symbolDistance * 50);
      }
      if (nameDistance <= query.length / 2) {
        score += Math.max(0, 300 - nameDistance * 30);
      }
    }
    
    // Bonus for popular assets (better ranking)
    if (asset.marketCapRank > 0) {
      if (asset.marketCapRank <= 10) score += 100;
      else if (asset.marketCapRank <= 50) score += 50;
      else if (asset.marketCapRank <= 100) score += 25;
    }
    
    // Bonus for high volume (more liquid assets)
    if (asset.volume24h > 100000000) score += 20; // > $100M volume
    else if (asset.volume24h > 10000000) score += 10; // > $10M volume
    
    return score;
  }

  private levenshteinDistance(a: string, b: string): number {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  private async getPopularAssets(limit: number): Promise<SearchResult[]> {
    try {
      const assets = await assetService.getTopAssets(limit);
      return assets.map(asset => ({
        id: asset.id,
        symbol: asset.symbol,
        name: asset.name,
        image: asset.image,
        currentPrice: asset.currentPrice,
        priceChangePercentage24h: asset.priceChangePercentage24h,
        marketCap: asset.marketCap,
        marketCapRank: asset.marketCapRank || asset.rank,
        volume24h: asset.volume24h
      }));
    } catch (error) {
      console.error('Failed to get popular assets:', error);
      return [];
    }
  }

  private parseSearchExpression(expression: string): {
    query: string;
    filters: SearchFilters;
  } {
    const filters: SearchFilters = {};
    let query = expression;
    
    // Simple parsing for basic operators
    const operators = [
      { regex: /price:>(\d+(?:\.\d+)?)/gi, filter: 'priceRange', field: 'min' },
      { regex: /price:<(\d+(?:\.\d+)?)/gi, filter: 'priceRange', field: 'max' },
      { regex: /marketcap:>(\d+(?:\.\d+)?[kmbtKMBT]?)/gi, filter: 'marketCapRange', field: 'min' },
      { regex: /marketcap:<(\d+(?:\.\d+)?[kmbtKMBT]?)/gi, filter: 'marketCapRange', field: 'max' },
      { regex: /change:>(-?\d+(?:\.\d+)?)/gi, filter: 'changeRange', field: 'min' },
      { regex: /change:<(-?\d+(?:\.\d+)?)/gi, filter: 'changeRange', field: 'max' },
    ];
    
    operators.forEach(op => {
      const matches = Array.from(expression.matchAll(op.regex));
      matches.forEach(match => {
        const value = this.parseNumericValue(match[1]);
        if (!filters[op.filter as keyof SearchFilters]) {
          (filters as any)[op.filter] = {};
        }
        ((filters as any)[op.filter] as any)[op.field] = value;
        
        // Remove the operator from query
        query = query.replace(match[0], '').trim();
      });
    });
    
    // Clean up query
    query = query.replace(/\s+/g, ' ').trim();
    
    return { query, filters };
  }

  private parseNumericValue(value: string): number {
    const multipliers: { [key: string]: number } = {
      'k': 1000,
      'm': 1000000,
      'b': 1000000000,
      't': 1000000000000
    };
    
    const match = value.match(/^(\d+(?:\.\d+)?)([kmbtKMBT])?$/);
    if (match) {
      const num = parseFloat(match[1]);
      const multiplier = match[2] ? multipliers[match[2].toLowerCase()] || 1 : 1;
      return num * multiplier;
    }
    
    return parseFloat(value) || 0;
  }

  private getDefaultIcon(symbol?: string): string {
    return `https://cryptologos.cc/logos/${(symbol || 'unknown').toLowerCase()}-logo.png`;
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key); // Remove expired entry
    }
    
    return null;
  }

  private setCache(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
    
    // Clean up cache if it gets too large
    if (this.cache.size > 1000) {
      const oldestKeys = Array.from(this.cache.keys()).slice(0, 200);
      oldestKeys.forEach(key => this.cache.delete(key));
    }
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // Would need hit tracking to implement this properly
    };
  }
}

export const searchService = new SearchService();
export type { SearchResult, SearchFilters, SearchOptions };