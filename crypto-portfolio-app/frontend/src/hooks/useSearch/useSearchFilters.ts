import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { filterService } from '../../services/search/FilterService';
import { assetService } from '../../services/assetService';

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
  usageCount: number;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  description?: string;
}

interface Exchange {
  id: string;
  name: string;
  icon?: string;
  isActive?: boolean;
}

interface UseSearchFiltersReturn {
  categories: Category[];
  exchanges: Exchange[];
  presets: FilterPreset[];
  isLoading: boolean;
  error: Error | null;
  applyPreset: (preset: FilterPreset) => void;
  savePreset: (name: string, filters: SearchFilters) => Promise<FilterPreset>;
  deletePreset: (presetId: string) => Promise<void>;
  renamePreset: (presetId: string, newName: string) => Promise<void>;
  validateFilters: (filters: SearchFilters) => { isValid: boolean; errors: string[] };
  getFilterSummary: (filters: SearchFilters) => string;
}

export const useSearchFilters = (): UseSearchFiltersReturn => {
  const [appliedPreset, setAppliedPreset] = useState<FilterPreset | null>(null);
  const queryClient = useQueryClient();

  // Load categories
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    error: categoriesError
  } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => assetService.getCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    placeholderData: getDefaultCategories()
  });

  // Load exchanges
  const {
    data: exchanges = [],
    isLoading: exchangesLoading,
    error: exchangesError
  } = useQuery({
    queryKey: ['exchanges'],
    queryFn: () => assetService.getExchanges(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    placeholderData: getDefaultExchanges()
  });

  // Load filter presets
  const {
    data: presets = [],
    isLoading: presetsLoading,
    error: presetsError
  } = useQuery({
    queryKey: ['filter-presets'],
    queryFn: () => filterService.getPresets(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  });

  // Save preset mutation
  const savePresetMutation = useMutation({
    mutationFn: ({ name, filters }: { name: string; filters: SearchFilters }) =>
      filterService.savePreset(name, filters),
    onSuccess: (newPreset) => {
      // Update cache
      queryClient.setQueryData(['filter-presets'], (oldPresets: FilterPreset[] = []) => [
        ...oldPresets,
        newPreset
      ]);
    },
    onError: (error) => {
      console.error('Failed to save preset:', error);
    }
  });

  // Delete preset mutation
  const deletePresetMutation = useMutation({
    mutationFn: (presetId: string) => filterService.deletePreset(presetId),
    onSuccess: (_, presetId) => {
      // Update cache
      queryClient.setQueryData(['filter-presets'], (oldPresets: FilterPreset[] = []) =>
        oldPresets.filter(preset => preset.id !== presetId)
      );
    },
    onError: (error) => {
      console.error('Failed to delete preset:', error);
    }
  });

  // Rename preset mutation
  const renamePresetMutation = useMutation({
    mutationFn: ({ presetId, newName }: { presetId: string; newName: string }) =>
      filterService.renamePreset(presetId, newName),
    onSuccess: (updatedPreset) => {
      // Update cache
      queryClient.setQueryData(['filter-presets'], (oldPresets: FilterPreset[] = []) =>
        oldPresets.map(preset =>
          preset.id === updatedPreset.id ? updatedPreset : preset
        )
      );
    },
    onError: (error) => {
      console.error('Failed to rename preset:', error);
    }
  });

  const applyPreset = useCallback((preset: FilterPreset) => {
    setAppliedPreset(preset);
    
    // Update usage count
    filterService.incrementUsageCount(preset.id).catch(error => {
      console.error('Failed to update usage count:', error);
    });
  }, []);

  const savePreset = useCallback(async (name: string, filters: SearchFilters): Promise<FilterPreset> => {
    const validation = validateFilters(filters);
    if (!validation.isValid) {
      throw new Error(`Invalid filters: ${validation.errors.join(', ')}`);
    }

    return await savePresetMutation.mutateAsync({ name, filters });
  }, [savePresetMutation]);

  const deletePreset = useCallback(async (presetId: string): Promise<void> => {
    await deletePresetMutation.mutateAsync(presetId);
  }, [deletePresetMutation]);

  const renamePreset = useCallback(async (presetId: string, newName: string): Promise<void> => {
    if (!newName.trim()) {
      throw new Error('Preset name cannot be empty');
    }
    
    await renamePresetMutation.mutateAsync({ presetId, newName: newName.trim() });
  }, [renamePresetMutation]);

  const validateFilters = useCallback((filters: SearchFilters): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validate price range
    if (filters.priceRange.min !== null && filters.priceRange.max !== null) {
      if (filters.priceRange.min < 0) {
        errors.push('Minimum price cannot be negative');
      }
      if (filters.priceRange.max < 0) {
        errors.push('Maximum price cannot be negative');
      }
      if (filters.priceRange.min > filters.priceRange.max) {
        errors.push('Minimum price cannot be greater than maximum price');
      }
    }

    // Validate market cap range
    if (filters.marketCapRange.min !== null && filters.marketCapRange.max !== null) {
      if (filters.marketCapRange.min < 0) {
        errors.push('Minimum market cap cannot be negative');
      }
      if (filters.marketCapRange.max < 0) {
        errors.push('Maximum market cap cannot be negative');
      }
      if (filters.marketCapRange.min > filters.marketCapRange.max) {
        errors.push('Minimum market cap cannot be greater than maximum market cap');
      }
    }

    // Validate volume range
    if (filters.volumeRange.min !== null && filters.volumeRange.max !== null) {
      if (filters.volumeRange.min < 0) {
        errors.push('Minimum volume cannot be negative');
      }
      if (filters.volumeRange.max < 0) {
        errors.push('Maximum volume cannot be negative');
      }
      if (filters.volumeRange.min > filters.volumeRange.max) {
        errors.push('Minimum volume cannot be greater than maximum volume');
      }
    }

    // Validate change range
    if (filters.changeRange.min !== null && filters.changeRange.max !== null) {
      if (filters.changeRange.min > filters.changeRange.max) {
        errors.push('Minimum change cannot be greater than maximum change');
      }
      if (Math.abs(filters.changeRange.min) > 1000) {
        errors.push('Change values seem unrealistic (>1000%)');
      }
      if (Math.abs(filters.changeRange.max) > 1000) {
        errors.push('Change values seem unrealistic (>1000%)');
      }
    }

    // Validate categories
    const validCategoryIds = categories.map(cat => cat.id);
    const invalidCategories = filters.categories.filter(catId => !validCategoryIds.includes(catId));
    if (invalidCategories.length > 0) {
      errors.push(`Invalid categories: ${invalidCategories.join(', ')}`);
    }

    // Validate exchanges
    const validExchangeIds = exchanges.map(ex => ex.id);
    const invalidExchanges = filters.exchanges.filter(exId => !validExchangeIds.includes(exId));
    if (invalidExchanges.length > 0) {
      errors.push(`Invalid exchanges: ${invalidExchanges.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [categories, exchanges]);

  const getFilterSummary = useCallback((filters: SearchFilters): string => {
    const parts: string[] = [];

    // Price range
    if (filters.priceRange.min !== null || filters.priceRange.max !== null) {
      if (filters.priceRange.min !== null && filters.priceRange.max !== null) {
        parts.push(`Price: $${filters.priceRange.min} - $${filters.priceRange.max}`);
      } else if (filters.priceRange.min !== null) {
        parts.push(`Price: >$${filters.priceRange.min}`);
      } else if (filters.priceRange.max !== null) {
        parts.push(`Price: <$${filters.priceRange.max}`);
      }
    }

    // Market cap range
    if (filters.marketCapRange.min !== null || filters.marketCapRange.max !== null) {
      if (filters.marketCapRange.min !== null && filters.marketCapRange.max !== null) {
        parts.push(`Market Cap: $${formatLargeNumber(filters.marketCapRange.min)} - $${formatLargeNumber(filters.marketCapRange.max)}`);
      } else if (filters.marketCapRange.min !== null) {
        parts.push(`Market Cap: >$${formatLargeNumber(filters.marketCapRange.min)}`);
      } else if (filters.marketCapRange.max !== null) {
        parts.push(`Market Cap: <$${formatLargeNumber(filters.marketCapRange.max)}`);
      }
    }

    // Change range
    if (filters.changeRange.min !== null || filters.changeRange.max !== null) {
      if (filters.changeRange.min !== null && filters.changeRange.max !== null) {
        parts.push(`Change: ${filters.changeRange.min}% - ${filters.changeRange.max}%`);
      } else if (filters.changeRange.min !== null) {
        parts.push(`Change: >${filters.changeRange.min}%`);
      } else if (filters.changeRange.max !== null) {
        parts.push(`Change: <${filters.changeRange.max}%`);
      }
    }

    // Categories
    if (filters.categories.length > 0) {
      const categoryNames = filters.categories
        .map(catId => categories.find(cat => cat.id === catId)?.name || catId)
        .slice(0, 3);
      
      if (filters.categories.length <= 3) {
        parts.push(`Categories: ${categoryNames.join(', ')}`);
      } else {
        parts.push(`Categories: ${categoryNames.join(', ')} + ${filters.categories.length - 3} more`);
      }
    }

    // Exchanges
    if (filters.exchanges.length > 0) {
      const exchangeNames = filters.exchanges
        .map(exId => exchanges.find(ex => ex.id === exId)?.name || exId)
        .slice(0, 2);
      
      if (filters.exchanges.length <= 2) {
        parts.push(`Exchanges: ${exchangeNames.join(', ')}`);
      } else {
        parts.push(`Exchanges: ${exchangeNames.join(', ')} + ${filters.exchanges.length - 2} more`);
      }
    }

    // Portfolio filters
    if (filters.hasHoldings) {
      parts.push('My Holdings');
    }
    if (filters.inWatchlist) {
      parts.push('Watchlist');
    }

    return parts.length > 0 ? parts.join(' • ') : 'No filters applied';
  }, [categories, exchanges]);

  const isLoading = categoriesLoading || exchangesLoading || presetsLoading ||
    savePresetMutation.isPending || deletePresetMutation.isPending || renamePresetMutation.isPending;

  const error = categoriesError || exchangesError || presetsError;

  return {
    categories,
    exchanges,
    presets,
    isLoading,
    error,
    applyPreset,
    savePreset,
    deletePreset,
    renamePreset,
    validateFilters,
    getFilterSummary
  };
};

// Helper functions
function getDefaultCategories(): Category[] {
  return [
    { id: 'defi', name: 'DeFi', icon: '🏦', description: 'Decentralized Finance' },
    { id: 'layer1', name: 'Layer 1', icon: '🏗️', description: 'Blockchain platforms' },
    { id: 'layer2', name: 'Layer 2', icon: '⚡', description: 'Scaling solutions' },
    { id: 'gaming', name: 'Gaming', icon: '🎮', description: 'Gaming & NFT platforms' },
    { id: 'meme', name: 'Meme', icon: '😂', description: 'Meme coins' },
    { id: 'metaverse', name: 'Metaverse', icon: '🌐', description: 'Virtual worlds' },
    { id: 'privacy', name: 'Privacy', icon: '🔒', description: 'Privacy coins' },
    { id: 'stablecoin', name: 'Stablecoin', icon: '💰', description: 'Price-stable tokens' }
  ];
}

function getDefaultExchanges(): Exchange[] {
  return [
    { id: 'binance', name: 'Binance', isActive: true },
    { id: 'coinbase', name: 'Coinbase Pro', isActive: true },
    { id: 'kraken', name: 'Kraken', isActive: true },
    { id: 'huobi', name: 'Huobi', isActive: true },
    { id: 'kucoin', name: 'KuCoin', isActive: true },
    { id: 'bybit', name: 'Bybit', isActive: true },
    { id: 'gate', name: 'Gate.io', isActive: true },
    { id: 'okx', name: 'OKX', isActive: true }
  ];
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}