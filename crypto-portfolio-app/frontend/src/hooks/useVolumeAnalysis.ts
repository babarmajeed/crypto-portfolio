import { useState, useEffect, useCallback, useMemo } from 'react';
import VolumeAnalysisService, {
  VolumeData,
  VolumeProfileLevel,
  VWAPData,
  VolumeIndicators,
  VolumeTrends,
  OrderBook,
  MarketDepth,
  TimeAndSalesEntry,
  LiquidityMetrics
} from '../services/VolumeAnalysisService';

interface UseVolumeAnalysisProps {
  symbol?: string;
  timeframe?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface VolumeAnalysisData {
  volumeData: VolumeData[];
  volumeProfile: VolumeProfileLevel[];
  vwapData: VWAPData | null;
  volumeIndicators: VolumeIndicators | null;
  volumeTrends: VolumeTrends | null;
  orderBook: OrderBook | null;
  marketDepth: MarketDepth | null;
  timeAndSales: TimeAndSalesEntry[];
  liquidityMetrics: LiquidityMetrics | null;
}

interface VolumeAnalysisState extends VolumeAnalysisData {
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface VolumeAnalysisActions {
  refresh: () => Promise<void>;
  updateSymbol: (newSymbol: string) => void;
  updateTimeframe: (newTimeframe: string) => void;
  refreshOrderBook: () => Promise<void>;
  refreshMarketDepth: () => Promise<void>;
  refreshTimeAndSales: () => Promise<void>;
  calculateVolumeProfile: (periods?: number) => Promise<void>;
  analyzeVolumeTrends: () => Promise<void>;
}

export const useVolumeAnalysis = ({
  symbol = 'BTC/USD',
  timeframe = '1h',
  autoRefresh = true,
  refreshInterval = 30000 // 30 seconds
}: UseVolumeAnalysisProps = {}): VolumeAnalysisState & VolumeAnalysisActions => {
  const [state, setState] = useState<VolumeAnalysisState>({
    volumeData: [],
    volumeProfile: [],
    vwapData: null,
    volumeIndicators: null,
    volumeTrends: null,
    orderBook: null,
    marketDepth: null,
    timeAndSales: [],
    liquidityMetrics: null,
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentTimeframe, setCurrentTimeframe] = useState(timeframe);

  // Initialize volume analysis service
  const volumeService = useMemo(() => new VolumeAnalysisService(), []);

  // Error handler
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`Volume analysis error in ${operation}:`, error);
    setState(prev => ({
      ...prev,
      error: `Failed to ${operation}: ${error.message || error}`,
      isLoading: false
    }));
  }, []);

  // Load basic volume data
  const loadVolumeData = useCallback(async () => {
    try {
      const volumeData = await volumeService.getVolumeData(currentSymbol, currentTimeframe, 1000);
      
      setState(prev => ({
        ...prev,
        volumeData,
        error: null
      }));

      return volumeData;
    } catch (error) {
      handleError(error, 'load volume data');
      return [];
    }
  }, [currentSymbol, currentTimeframe, volumeService, handleError]);

  // Load volume indicators
  const loadVolumeIndicators = useCallback(async () => {
    try {
      const indicators = await volumeService.calculateVolumeIndicators(currentSymbol, currentTimeframe);
      
      setState(prev => ({
        ...prev,
        volumeIndicators: indicators,
        error: null
      }));

      return indicators;
    } catch (error) {
      handleError(error, 'calculate volume indicators');
      return null;
    }
  }, [currentSymbol, currentTimeframe, volumeService, handleError]);

  // Load VWAP data
  const loadVWAP = useCallback(async () => {
    try {
      const vwapData = await volumeService.calculateVWAP(currentSymbol, currentTimeframe);
      
      setState(prev => ({
        ...prev,
        vwapData,
        error: null
      }));

      return vwapData;
    } catch (error) {
      handleError(error, 'calculate VWAP');
      return null;
    }
  }, [currentSymbol, currentTimeframe, volumeService, handleError]);

  // Load volume profile
  const calculateVolumeProfile = useCallback(async (periods: number = 100) => {
    try {
      const volumeProfile = await volumeService.calculateVolumeProfile(currentSymbol, currentTimeframe, periods);
      
      setState(prev => ({
        ...prev,
        volumeProfile,
        error: null
      }));

      return volumeProfile;
    } catch (error) {
      handleError(error, 'calculate volume profile');
      return [];
    }
  }, [currentSymbol, currentTimeframe, volumeService, handleError]);

  // Analyze volume trends
  const analyzeVolumeTrends = useCallback(async () => {
    try {
      const volumeTrends = await volumeService.analyzeVolumeTrends(currentSymbol, currentTimeframe);
      
      setState(prev => ({
        ...prev,
        volumeTrends,
        error: null
      }));

      return volumeTrends;
    } catch (error) {
      handleError(error, 'analyze volume trends');
      return null;
    }
  }, [currentSymbol, currentTimeframe, volumeService, handleError]);

  // Load order book
  const refreshOrderBook = useCallback(async () => {
    try {
      const orderBook = await volumeService.getOrderBook(currentSymbol);
      
      setState(prev => ({
        ...prev,
        orderBook,
        error: null
      }));

      return orderBook;
    } catch (error) {
      handleError(error, 'refresh order book');
      return null;
    }
  }, [currentSymbol, volumeService, handleError]);

  // Load market depth
  const refreshMarketDepth = useCallback(async () => {
    try {
      const marketDepth = await volumeService.getMarketDepth(currentSymbol, 50);
      
      setState(prev => ({
        ...prev,
        marketDepth,
        error: null
      }));

      return marketDepth;
    } catch (error) {
      handleError(error, 'refresh market depth');
      return null;
    }
  }, [currentSymbol, volumeService, handleError]);

  // Load time and sales
  const refreshTimeAndSales = useCallback(async () => {
    try {
      const timeAndSales = await volumeService.getTimeAndSales(currentSymbol, 100);
      
      setState(prev => ({
        ...prev,
        timeAndSales,
        error: null
      }));

      return timeAndSales;
    } catch (error) {
      handleError(error, 'refresh time and sales');
      return [];
    }
  }, [currentSymbol, volumeService, handleError]);

  // Load liquidity metrics
  const loadLiquidityMetrics = useCallback(async () => {
    try {
      const liquidityMetrics = await volumeService.getLiquidityMetrics(currentSymbol);
      
      setState(prev => ({
        ...prev,
        liquidityMetrics,
        error: null
      }));

      return liquidityMetrics;
    } catch (error) {
      handleError(error, 'load liquidity metrics');
      return null;
    }
  }, [currentSymbol, volumeService, handleError]);

  // Full refresh of all data
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Load all data in parallel for better performance
      await Promise.allSettled([
        loadVolumeData(),
        loadVolumeIndicators(),
        loadVWAP(),
        calculateVolumeProfile(),
        analyzeVolumeTrends(),
        refreshOrderBook(),
        refreshMarketDepth(),
        refreshTimeAndSales(),
        loadLiquidityMetrics()
      ]);

      setState(prev => ({
        ...prev,
        isLoading: false,
        lastUpdated: new Date()
      }));
    } catch (error) {
      handleError(error, 'refresh all data');
    }
  }, [
    loadVolumeData,
    loadVolumeIndicators,
    loadVWAP,
    calculateVolumeProfile,
    analyzeVolumeTrends,
    refreshOrderBook,
    refreshMarketDepth,
    refreshTimeAndSales,
    loadLiquidityMetrics,
    handleError
  ]);

  // Update symbol
  const updateSymbol = useCallback((newSymbol: string) => {
    if (newSymbol !== currentSymbol) {
      setCurrentSymbol(newSymbol);
      setState(prev => ({
        ...prev,
        volumeData: [],
        volumeProfile: [],
        vwapData: null,
        volumeIndicators: null,
        volumeTrends: null,
        orderBook: null,
        marketDepth: null,
        timeAndSales: [],
        liquidityMetrics: null,
        error: null
      }));
    }
  }, [currentSymbol]);

  // Update timeframe
  const updateTimeframe = useCallback((newTimeframe: string) => {
    if (newTimeframe !== currentTimeframe) {
      setCurrentTimeframe(newTimeframe);
      setState(prev => ({
        ...prev,
        volumeData: [],
        volumeProfile: [],
        vwapData: null,
        volumeIndicators: null,
        volumeTrends: null,
        error: null
      }));
    }
  }, [currentTimeframe]);

  // Initial data load
  useEffect(() => {
    refresh();
  }, [currentSymbol, currentTimeframe]); // Depend on symbol and timeframe changes

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      // Only refresh market data, not chart data
      Promise.allSettled([
        refreshOrderBook(),
        refreshMarketDepth(),
        refreshTimeAndSales(),
        loadLiquidityMetrics()
      ]);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshOrderBook, refreshMarketDepth, refreshTimeAndSales, loadLiquidityMetrics]);

  // Memoized derived data
  const pointOfControl = useMemo(() => {
    if (!state.volumeProfile.length) return null;
    
    // Find the price level with highest volume (Point of Control)
    return state.volumeProfile.reduce((max, level) => 
      level.volume > max.volume ? level : max
    );
  }, [state.volumeProfile]);

  const orderBookSpread = useMemo(() => {
    if (!state.orderBook) return null;
    
    return {
      absolute: state.orderBook.spread,
      percentage: (state.orderBook.spread / state.orderBook.mid) * 100
    };
  }, [state.orderBook]);

  const volumeStrength = useMemo(() => {
    if (!state.volumeTrends) return 'unknown';
    
    if (state.volumeTrends.strength === 'strong' && state.volumeTrends.trend === 'increasing') {
      return 'bullish';
    } else if (state.volumeTrends.strength === 'strong' && state.volumeTrends.trend === 'decreasing') {
      return 'bearish';
    } else {
      return 'neutral';
    }
  }, [state.volumeTrends]);

  return {
    // State
    ...state,
    
    // Actions
    refresh,
    updateSymbol,
    updateTimeframe,
    refreshOrderBook,
    refreshMarketDepth,
    refreshTimeAndSales,
    calculateVolumeProfile,
    analyzeVolumeTrends,

    // Derived data (not part of the interface but useful)
    pointOfControl,
    orderBookSpread,
    volumeStrength,
    currentSymbol,
    currentTimeframe
  } as VolumeAnalysisState & VolumeAnalysisActions & {
    pointOfControl: VolumeProfileLevel | null;
    orderBookSpread: { absolute: number; percentage: number } | null;
    volumeStrength: 'bullish' | 'bearish' | 'neutral' | 'unknown';
    currentSymbol: string;
    currentTimeframe: string;
  };
};

export default useVolumeAnalysis;