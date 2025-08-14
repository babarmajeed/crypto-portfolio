import axios, { AxiosInstance } from 'axios';

interface WatchlistItem {
  symbol: string;
  addedAt: Date;
  notes?: string;
}

class WatchlistService {
  private api: AxiosInstance;
  private readonly STORAGE_KEY = 'crypto_watchlist';

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
      headers: {
        'Content-Type': 'application/json'
      }
    });

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
   * Get user's watchlist
   */
  async getWatchlist(): Promise<string[]> {
    try {
      const response = await this.api.get('/watchlist');
      return response.data.symbols || [];
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      // Fallback to localStorage
      return this.getLocalWatchlist();
    }
  }

  /**
   * Get detailed watchlist with metadata
   */
  async getWatchlistDetails(): Promise<WatchlistItem[]> {
    try {
      const response = await this.api.get('/watchlist/details');
      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching watchlist details:', error);
      // Fallback to localStorage
      return this.getLocalWatchlistDetails();
    }
  }

  /**
   * Add asset to watchlist
   */
  async addToWatchlist(symbol: string, notes?: string): Promise<void> {
    try {
      await this.api.post('/watchlist', { symbol, notes });
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      // Fallback to localStorage
      this.addToLocalWatchlist(symbol, notes);
      throw error; // Re-throw to handle in UI
    }
  }

  /**
   * Remove asset from watchlist
   */
  async removeFromWatchlist(symbol: string): Promise<void> {
    try {
      await this.api.delete(`/watchlist/${symbol}`);
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      // Fallback to localStorage
      this.removeFromLocalWatchlist(symbol);
      throw error; // Re-throw to handle in UI
    }
  }

  /**
   * Update watchlist item notes
   */
  async updateWatchlistNotes(symbol: string, notes: string): Promise<void> {
    try {
      await this.api.patch(`/watchlist/${symbol}`, { notes });
    } catch (error) {
      console.error('Error updating watchlist notes:', error);
      // Fallback to localStorage
      this.updateLocalWatchlistNotes(symbol, notes);
      throw error;
    }
  }

  /**
   * Clear entire watchlist
   */
  async clearWatchlist(): Promise<void> {
    try {
      await this.api.delete('/watchlist');
    } catch (error) {
      console.error('Error clearing watchlist:', error);
      // Fallback to localStorage
      this.clearLocalWatchlist();
      throw error;
    }
  }

  /**
   * Check if symbol is in watchlist
   */
  async isInWatchlist(symbol: string): Promise<boolean> {
    try {
      const watchlist = await this.getWatchlist();
      return watchlist.includes(symbol.toUpperCase());
    } catch (error) {
      console.error('Error checking watchlist:', error);
      return false;
    }
  }

  /**
   * Get watchlist count
   */
  async getWatchlistCount(): Promise<number> {
    try {
      const watchlist = await this.getWatchlist();
      return watchlist.length;
    } catch (error) {
      console.error('Error getting watchlist count:', error);
      return 0;
    }
  }

  // Local storage fallback methods
  private getLocalWatchlist(): string[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : parsed.symbols || [];
      }
    } catch (error) {
      console.error('Error reading local watchlist:', error);
    }
    return [];
  }

  private getLocalWatchlistDetails(): WatchlistItem[] {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_details`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt)
        }));
      }
    } catch (error) {
      console.error('Error reading local watchlist details:', error);
    }
    
    // If no detailed data, create from simple list
    const symbols = this.getLocalWatchlist();
    return symbols.map(symbol => ({
      symbol,
      addedAt: new Date(),
      notes: undefined
    }));
  }

  private addToLocalWatchlist(symbol: string, notes?: string): void {
    try {
      // Add to simple list
      const watchlist = this.getLocalWatchlist();
      const upperSymbol = symbol.toUpperCase();
      
      if (!watchlist.includes(upperSymbol)) {
        watchlist.push(upperSymbol);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(watchlist));
      }

      // Add to detailed list
      const details = this.getLocalWatchlistDetails();
      const existingIndex = details.findIndex(item => item.symbol === upperSymbol);
      
      if (existingIndex === -1) {
        details.push({
          symbol: upperSymbol,
          addedAt: new Date(),
          notes
        });
        localStorage.setItem(`${this.STORAGE_KEY}_details`, JSON.stringify(details));
      }
    } catch (error) {
      console.error('Error adding to local watchlist:', error);
    }
  }

  private removeFromLocalWatchlist(symbol: string): void {
    try {
      const upperSymbol = symbol.toUpperCase();
      
      // Remove from simple list
      const watchlist = this.getLocalWatchlist();
      const filtered = watchlist.filter(s => s !== upperSymbol);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));

      // Remove from detailed list
      const details = this.getLocalWatchlistDetails();
      const filteredDetails = details.filter(item => item.symbol !== upperSymbol);
      localStorage.setItem(`${this.STORAGE_KEY}_details`, JSON.stringify(filteredDetails));
    } catch (error) {
      console.error('Error removing from local watchlist:', error);
    }
  }

  private updateLocalWatchlistNotes(symbol: string, notes: string): void {
    try {
      const details = this.getLocalWatchlistDetails();
      const upperSymbol = symbol.toUpperCase();
      const index = details.findIndex(item => item.symbol === upperSymbol);
      
      if (index !== -1) {
        details[index].notes = notes;
        localStorage.setItem(`${this.STORAGE_KEY}_details`, JSON.stringify(details));
      }
    } catch (error) {
      console.error('Error updating local watchlist notes:', error);
    }
  }

  private clearLocalWatchlist(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(`${this.STORAGE_KEY}_details`);
    } catch (error) {
      console.error('Error clearing local watchlist:', error);
    }
  }
}

export const watchlistService = new WatchlistService();
export type { WatchlistItem };