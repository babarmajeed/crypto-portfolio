import axios, { AxiosInstance } from 'axios';

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

interface FilterPreset {
  id: string;
  name: string;
  filters: SearchFilters;
  isDefault?: boolean;
  createdAt: Date;
  updatedAt?: Date;
  usageCount: number;
  isPublic?: boolean;
  tags?: string[];
}

class FilterService {
  private api: AxiosInstance;
  private readonly STORAGE_KEY = 'crypto_filter_presets';
  private readonly USAGE_KEY = 'crypto_preset_usage';

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
   * Get all filter presets for the current user
   */
  async getPresets(): Promise<FilterPreset[]> {
    try {
      const response = await this.api.get('/filters/presets');
      return response.data.presets.map(this.transformPreset);
    } catch (error) {
      console.error('Failed to fetch presets from server:', error);
      // Fallback to local storage
      return this.getLocalPresets();
    }
  }

  /**
   * Get public/community presets
   */
  async getPublicPresets(limit: number = 50): Promise<FilterPreset[]> {
    try {
      const response = await this.api.get('/filters/presets/public', {
        params: { limit }
      });
      return response.data.presets.map(this.transformPreset);
    } catch (error) {
      console.error('Failed to fetch public presets:', error);
      return [];
    }
  }

  /**
   * Save a new filter preset
   */
  async savePreset(name: string, filters: SearchFilters, isPublic: boolean = false): Promise<FilterPreset> {
    const preset: Omit<FilterPreset, 'id'> = {
      name: name.trim(),
      filters,
      createdAt: new Date(),
      usageCount: 0,
      isPublic,
      tags: this.extractTagsFromFilters(filters)
    };

    try {
      const response = await this.api.post('/filters/presets', preset);
      const savedPreset = this.transformPreset(response.data);
      
      // Also save locally as backup
      this.saveLocalPreset(savedPreset);
      
      return savedPreset;
    } catch (error) {
      console.error('Failed to save preset to server:', error);
      
      // Fallback to local storage
      const localPreset: FilterPreset = {
        id: this.generateId(),
        ...preset
      };
      
      this.saveLocalPreset(localPreset);
      return localPreset;
    }
  }

  /**
   * Update an existing preset
   */
  async updatePreset(presetId: string, updates: Partial<FilterPreset>): Promise<FilterPreset> {
    try {
      const response = await this.api.patch(`/filters/presets/${presetId}`, {
        ...updates,
        updatedAt: new Date()
      });
      
      const updatedPreset = this.transformPreset(response.data);
      
      // Update local storage
      this.updateLocalPreset(presetId, updatedPreset);
      
      return updatedPreset;
    } catch (error) {
      console.error('Failed to update preset on server:', error);
      
      // Fallback to local storage
      const localPresets = this.getLocalPresets();
      const presetIndex = localPresets.findIndex(p => p.id === presetId);
      
      if (presetIndex >= 0) {
        const updatedPreset = {
          ...localPresets[presetIndex],
          ...updates,
          updatedAt: new Date()
        };
        
        localPresets[presetIndex] = updatedPreset;
        this.saveLocalPresets(localPresets);
        
        return updatedPreset;
      }
      
      throw new Error('Preset not found');
    }
  }

  /**
   * Rename a preset
   */
  async renamePreset(presetId: string, newName: string): Promise<FilterPreset> {
    return this.updatePreset(presetId, { name: newName.trim() });
  }

  /**
   * Delete a preset
   */
  async deletePreset(presetId: string): Promise<void> {
    try {
      await this.api.delete(`/filters/presets/${presetId}`);
    } catch (error) {
      console.error('Failed to delete preset from server:', error);
    }
    
    // Always remove from local storage
    this.deleteLocalPreset(presetId);
  }

  /**
   * Increment usage count for a preset
   */
  async incrementUsageCount(presetId: string): Promise<void> {
    try {
      await this.api.post(`/filters/presets/${presetId}/use`);
    } catch (error) {
      console.error('Failed to increment usage count on server:', error);
    }
    
    // Update local usage count
    this.incrementLocalUsage(presetId);
  }

  /**
   * Get preset usage statistics
   */
  async getUsageStats(): Promise<{
    totalPresets: number;
    totalUsage: number;
    mostUsedPresets: Array<{ preset: FilterPreset; usageCount: number }>;
    recentActivity: Array<{ presetId: string; usedAt: Date }>;
  }> {
    try {
      const response = await this.api.get('/filters/presets/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to get usage stats from server:', error);
      return this.getLocalUsageStats();
    }
  }

  /**
   * Search presets by name or tags
   */
  async searchPresets(query: string): Promise<FilterPreset[]> {
    try {
      const response = await this.api.get('/filters/presets/search', {
        params: { q: query }
      });
      return response.data.presets.map(this.transformPreset);
    } catch (error) {
      console.error('Failed to search presets on server:', error);
      return this.searchLocalPresets(query);
    }
  }

  /**
   * Export presets to JSON
   */
  async exportPresets(): Promise<string> {
    const presets = await this.getPresets();
    return JSON.stringify(presets, null, 2);
  }

  /**
   * Import presets from JSON
   */
  async importPresets(jsonData: string): Promise<FilterPreset[]> {
    try {
      const presets: FilterPreset[] = JSON.parse(jsonData);
      const importedPresets: FilterPreset[] = [];
      
      for (const preset of presets) {
        // Validate preset structure
        if (this.validatePreset(preset)) {
          try {
            const imported = await this.savePreset(
              `${preset.name} (Imported)`,
              preset.filters,
              false
            );
            importedPresets.push(imported);
          } catch (error) {
            console.error(`Failed to import preset "${preset.name}":`, error);
          }
        }
      }
      
      return importedPresets;
    } catch (error) {
      console.error('Failed to parse preset data:', error);
      throw new Error('Invalid preset data format');
    }
  }

  // Private methods

  private transformPreset(rawPreset: any): FilterPreset {
    return {
      id: rawPreset.id,
      name: rawPreset.name,
      filters: rawPreset.filters,
      isDefault: rawPreset.isDefault || false,
      createdAt: new Date(rawPreset.createdAt || rawPreset.created_at),
      updatedAt: rawPreset.updatedAt ? new Date(rawPreset.updatedAt) : undefined,
      usageCount: rawPreset.usageCount || rawPreset.usage_count || 0,
      isPublic: rawPreset.isPublic || rawPreset.is_public || false,
      tags: rawPreset.tags || []
    };
  }

  private extractTagsFromFilters(filters: SearchFilters): string[] {
    const tags: string[] = [];
    
    if (filters.priceRange.min !== null || filters.priceRange.max !== null) {
      tags.push('price');
    }
    
    if (filters.marketCapRange.min !== null || filters.marketCapRange.max !== null) {
      tags.push('marketcap');
    }
    
    if (filters.changeRange.min !== null || filters.changeRange.max !== null) {
      if (filters.changeRange.min && filters.changeRange.min > 0) {
        tags.push('gainers');
      }
      if (filters.changeRange.max && filters.changeRange.max < 0) {
        tags.push('losers');
      }
      tags.push('performance');
    }
    
    if (filters.categories.length > 0) {
      tags.push('category', ...filters.categories);
    }
    
    if (filters.exchanges.length > 0) {
      tags.push('exchange');
    }
    
    if (filters.hasHoldings) {
      tags.push('portfolio', 'holdings');
    }
    
    if (filters.inWatchlist) {
      tags.push('watchlist');
    }
    
    return [...new Set(tags)]; // Remove duplicates
  }

  private validatePreset(preset: any): boolean {
    return (
      preset &&
      typeof preset.name === 'string' &&
      preset.name.trim().length > 0 &&
      preset.filters &&
      typeof preset.filters === 'object' &&
      preset.filters.priceRange &&
      preset.filters.marketCapRange &&
      preset.filters.changeRange &&
      Array.isArray(preset.filters.categories) &&
      Array.isArray(preset.filters.exchanges)
    );
  }

  private generateId(): string {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Local storage methods

  private getLocalPresets(): FilterPreset[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const presets = JSON.parse(stored);
        return presets.map((preset: any) => ({
          ...preset,
          createdAt: new Date(preset.createdAt),
          updatedAt: preset.updatedAt ? new Date(preset.updatedAt) : undefined
        }));
      }
    } catch (error) {
      console.error('Failed to load local presets:', error);
    }
    return [];
  }

  private saveLocalPresets(presets: FilterPreset[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
    } catch (error) {
      console.error('Failed to save local presets:', error);
    }
  }

  private saveLocalPreset(preset: FilterPreset): void {
    const presets = this.getLocalPresets();
    const existingIndex = presets.findIndex(p => p.id === preset.id);
    
    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }
    
    this.saveLocalPresets(presets);
  }

  private updateLocalPreset(presetId: string, updatedPreset: FilterPreset): void {
    const presets = this.getLocalPresets();
    const index = presets.findIndex(p => p.id === presetId);
    
    if (index >= 0) {
      presets[index] = updatedPreset;
      this.saveLocalPresets(presets);
    }
  }

  private deleteLocalPreset(presetId: string): void {
    const presets = this.getLocalPresets();
    const filtered = presets.filter(p => p.id !== presetId);
    this.saveLocalPresets(filtered);
  }

  private incrementLocalUsage(presetId: string): void {
    try {
      const usage = JSON.parse(localStorage.getItem(this.USAGE_KEY) || '{}');
      usage[presetId] = (usage[presetId] || 0) + 1;
      localStorage.setItem(this.USAGE_KEY, JSON.stringify(usage));
      
      // Also update the preset's usage count
      const presets = this.getLocalPresets();
      const preset = presets.find(p => p.id === presetId);
      if (preset) {
        preset.usageCount = usage[presetId];
        this.saveLocalPresets(presets);
      }
    } catch (error) {
      console.error('Failed to increment local usage:', error);
    }
  }

  private getLocalUsageStats(): {
    totalPresets: number;
    totalUsage: number;
    mostUsedPresets: Array<{ preset: FilterPreset; usageCount: number }>;
    recentActivity: Array<{ presetId: string; usedAt: Date }>;
  } {
    const presets = this.getLocalPresets();
    const totalUsage = presets.reduce((sum, preset) => sum + preset.usageCount, 0);
    
    const mostUsedPresets = presets
      .filter(preset => preset.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10)
      .map(preset => ({ preset, usageCount: preset.usageCount }));

    return {
      totalPresets: presets.length,
      totalUsage,
      mostUsedPresets,
      recentActivity: [] // Would need activity tracking to implement this
    };
  }

  private searchLocalPresets(query: string): FilterPreset[] {
    const presets = this.getLocalPresets();
    const queryLower = query.toLowerCase().trim();
    
    if (!queryLower) return presets;
    
    return presets.filter(preset => 
      preset.name.toLowerCase().includes(queryLower) ||
      preset.tags?.some(tag => tag.toLowerCase().includes(queryLower))
    );
  }
}

export const filterService = new FilterService();
export type { FilterPreset, SearchFilters };