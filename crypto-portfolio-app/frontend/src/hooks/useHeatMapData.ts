import { useState, useEffect, useCallback, useRef } from 'react';
import { heatMapDataService, MarketAsset, PortfolioHolding, SectorData, CategoryData, HeatMapFilters, CorrelationMatrix } from '../services/HeatMapDataService';
import { HeatMapNode, HeatMapCalculations } from '../utils/heatMapCalculations';

export interface UseHeatMapDataOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  initialFilters?: HeatMapFilters;
  maxRetries?: number;
}

export interface HeatMapDataState {
  // Raw data
  marketData: MarketAsset[];
  portfolioData: PortfolioHolding[];
  sectorData: SectorData[];
  categories: CategoryData[];
  correlationMatrix: CorrelationMatrix;

  // Processed data
  processedNodes: HeatMapNode[];
  filteredNodes: HeatMapNode[];
  hierarchicalData: any;

  // Statistics
  stats: {
    totalValue: number;
    avgChange: number;
    positiveCount: number;
    negativeCount: number;
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
  };

  // State
  filters: HeatMapFilters;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  currentDataType: 'market' | 'portfolio' | 'sector';
}

export const useHeatMapData = (options: UseHeatMapDataOptions = {}) => {
  const {
    autoRefresh = false,
    refreshInterval = 30000,
    initialFilters = {},
    maxRetries = 3
  } = options;

  // State
  const [state, setState] = useState<HeatMapDataState>({
    marketData: [],
    portfolioData: [],
    sectorData: [],
    categories: [],
    correlationMatrix: {},
    processedNodes: [],
    filteredNodes: [],
    hierarchicalData: null,
    stats: {
      totalValue: 0,
      avgChange: 0,
      positiveCount: 0,
      negativeCount: 0,
      marketSentiment: 'neutral'
    },
    filters: {
      category: 'all',
      maxAssets: 100,
      minMarketCap: 0,
      timeframe: '24h',
      ...initialFilters
    },
    isLoading: true,
    error: null,
    lastUpdated: null,
    currentDataType: 'market'
  });

  // Refs
  const retryCountRef = useRef(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realTimeUnsubscribeRef = useRef<(() => void) | null>(null);

  // Load market data
  const loadMarketData = useCallback(async (filters?: HeatMapFilters) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const activeFilters = filters || state.filters;
      const [marketData, categories] = await Promise.all([
        heatMapDataService.getMarketData(activeFilters),
        heatMapDataService.getCategories()
      ]);

      // Process data into nodes
      const processedNodes = HeatMapCalculations.marketDataToNodes(
        marketData,
        'marketCap',
        'priceChangePercentage24h'
      );

      // Apply additional filtering
      const filteredNodes = HeatMapCalculations.filterNodes(processedNodes, {
        minSize: activeFilters.minMarketCap,
        categories: activeFilters.category !== 'all' ? [activeFilters.category].filter(Boolean) : undefined
      });

      // Create hierarchical data
      const hierarchicalData = HeatMapCalculations.createHierarchicalData(
        filteredNodes,
        activeFilters.category === 'all' ? 'category' : undefined
      );

      // Calculate statistics
      const stats = HeatMapCalculations.calculateHeatMapStats(filteredNodes);
      const marketSentiment = stats.avgChange > 1 ? 'bullish' : 
                             stats.avgChange < -1 ? 'bearish' : 'neutral';

      setState(prev => ({
        ...prev,
        marketData,
        categories,
        processedNodes,
        filteredNodes,
        hierarchicalData,
        stats: {
          ...stats,
          marketSentiment
        },
        filters: activeFilters,
        isLoading: false,
        lastUpdated: new Date(),
        currentDataType: 'market'
      }));

      retryCountRef.current = 0;

    } catch (error) {
      console.error('Error loading market data:', error);
      
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setTimeout(() => loadMarketData(filters), 1000 * retryCountRef.current);
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load market data'
        }));
      }
    }
  }, [state.filters, maxRetries]);

  // Load portfolio data
  const loadPortfolioData = useCallback(async (portfolioId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const portfolioData = await heatMapDataService.getPortfolioHeatMapData(portfolioId);

      // Process data into nodes
      const processedNodes = HeatMapCalculations.portfolioDataToNodes(
        portfolioData,
        'value',
        'profitPercentage'
      );

      // Create hierarchical data grouped by exchange or category
      const hierarchicalData = HeatMapCalculations.createHierarchicalData(
        processedNodes,
        'category'
      );

      // Calculate statistics
      const stats = HeatMapCalculations.calculateHeatMapStats(processedNodes);
      const marketSentiment = stats.avgChange > 0 ? 'bullish' : 
                             stats.avgChange < 0 ? 'bearish' : 'neutral';

      setState(prev => ({
        ...prev,
        portfolioData,
        processedNodes,
        filteredNodes: processedNodes,
        hierarchicalData,
        stats: {
          ...stats,
          marketSentiment
        },
        isLoading: false,
        lastUpdated: new Date(),
        currentDataType: 'portfolio'
      }));

      retryCountRef.current = 0;

    } catch (error) {
      console.error('Error loading portfolio data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load portfolio data'
      }));
    }
  }, []);

  // Load sector data
  const loadSectorData = useCallback(async (timeframe: string = '24h') => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const sectorData = await heatMapDataService.getSectorPerformanceData(timeframe);

      // Process data into nodes
      const processedNodes = HeatMapCalculations.sectorDataToNodes(
        sectorData,
        'marketCap',
        'change24h'
      );

      // Calculate statistics
      const stats = HeatMapCalculations.calculateHeatMapStats(processedNodes);
      const marketSentiment = stats.avgChange > 0 ? 'bullish' : 
                             stats.avgChange < 0 ? 'bearish' : 'neutral';

      setState(prev => ({
        ...prev,
        sectorData,
        processedNodes,
        filteredNodes: processedNodes,
        hierarchicalData: {
          name: 'sectors',
          children: processedNodes
        },
        stats: {
          ...stats,
          marketSentiment
        },
        filters: { ...prev.filters, timeframe },
        isLoading: false,
        lastUpdated: new Date(),
        currentDataType: 'sector'
      }));

      retryCountRef.current = 0;

    } catch (error) {
      console.error('Error loading sector data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load sector data'
      }));
    }
  }, []);

  // Load correlation matrix
  const loadCorrelationMatrix = useCallback(async (assets: MarketAsset[], timeframe: string = '30d') => {
    try {
      const correlationMatrix = await heatMapDataService.calculateCorrelationMatrix(assets, timeframe);
      
      setState(prev => ({
        ...prev,
        correlationMatrix
      }));

    } catch (error) {
      console.error('Error loading correlation matrix:', error);
    }
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<HeatMapFilters>) => {
    const updatedFilters = { ...state.filters, ...newFilters };
    
    setState(prev => ({ ...prev, filters: updatedFilters }));
    
    if (state.currentDataType === 'market') {
      loadMarketData(updatedFilters);
    } else if (state.currentDataType === 'sector') {
      loadSectorData(updatedFilters.timeframe);
    }
  }, [state.filters, state.currentDataType, loadMarketData, loadSectorData]);

  // Filter nodes locally
  const filterNodes = useCallback((filterOptions: {
    searchTerm?: string;
    minSize?: number;
    maxSize?: number;
    minColor?: number;
    maxColor?: number;
  }) => {
    const filtered = HeatMapCalculations.filterNodes(state.processedNodes, filterOptions);
    
    setState(prev => ({ ...prev, filteredNodes: filtered }));
  }, [state.processedNodes]);

  // Sort nodes
  const sortNodes = useCallback((sortBy: 'size' | 'color' | 'name' | 'symbol', direction: 'asc' | 'desc' = 'desc') => {
    const sorted = HeatMapCalculations.sortNodes(state.filteredNodes, sortBy, direction);
    
    setState(prev => ({ ...prev, filteredNodes: sorted }));
  }, [state.filteredNodes]);

  // Refresh current data
  const refresh = useCallback(() => {
    if (state.currentDataType === 'market') {
      loadMarketData();
    } else if (state.currentDataType === 'sector') {
      loadSectorData(state.filters.timeframe);
    }
  }, [state.currentDataType, state.filters.timeframe, loadMarketData, loadSectorData]);

  // Switch data type
  const switchDataType = useCallback((dataType: 'market' | 'portfolio' | 'sector', additionalParams?: any) => {
    switch (dataType) {
      case 'market':
        loadMarketData();
        break;
      case 'portfolio':
        if (additionalParams?.portfolioId) {
          loadPortfolioData(additionalParams.portfolioId);
        }
        break;
      case 'sector':
        loadSectorData(additionalParams?.timeframe || '24h');
        break;
    }
  }, [loadMarketData, loadPortfolioData, loadSectorData]);

  // Setup auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        refresh();
      }, refreshInterval);

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refresh]);

  // Setup real-time updates for market data
  useEffect(() => {
    if (state.currentDataType === 'market' && state.marketData.length > 0) {
      const setupRealTime = async () => {
        try {
          const unsubscribe = await heatMapDataService.subscribeToRealTimeUpdates((updatedData) => {
            // Process updated data
            const processedNodes = HeatMapCalculations.marketDataToNodes(
              updatedData,
              'marketCap',
              'priceChangePercentage24h'
            );

            const filteredNodes = HeatMapCalculations.filterNodes(processedNodes, {
              minSize: state.filters.minMarketCap,
              categories: state.filters.category !== 'all' ? [state.filters.category].filter(Boolean) : undefined
            });

            const stats = HeatMapCalculations.calculateHeatMapStats(filteredNodes);
            const marketSentiment = stats.avgChange > 1 ? 'bullish' : 
                                   stats.avgChange < -1 ? 'bearish' : 'neutral';

            setState(prev => ({
              ...prev,
              marketData: updatedData,
              processedNodes,
              filteredNodes,
              stats: {
                ...stats,
                marketSentiment
              },
              lastUpdated: new Date()
            }));
          });

          realTimeUnsubscribeRef.current = unsubscribe;

        } catch (error) {
          console.error('Error setting up real-time updates:', error);
        }
      };

      setupRealTime();

      return () => {
        if (realTimeUnsubscribeRef.current) {
          realTimeUnsubscribeRef.current();
        }
      };
    }
  }, [state.currentDataType, state.marketData.length, state.filters]);

  // Initialize data loading
  useEffect(() => {
    loadMarketData();
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      if (realTimeUnsubscribeRef.current) {
        realTimeUnsubscribeRef.current();
      }
    };
  }, []);

  return {
    // Data
    marketData: state.marketData,
    portfolioData: state.portfolioData,
    sectorData: state.sectorData,
    categories: state.categories,
    correlationMatrix: state.correlationMatrix,
    processedNodes: state.processedNodes,
    filteredNodes: state.filteredNodes,
    hierarchicalData: state.hierarchicalData,
    
    // Statistics
    stats: state.stats,
    
    // State
    filters: state.filters,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    currentDataType: state.currentDataType,
    
    // Actions
    loadMarketData,
    loadPortfolioData,
    loadSectorData,
    loadCorrelationMatrix,
    updateFilters,
    filterNodes,
    sortNodes,
    refresh,
    switchDataType
  };
};

export default useHeatMapData;