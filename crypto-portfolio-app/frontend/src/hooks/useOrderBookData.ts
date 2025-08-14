import { useState, useEffect, useCallback, useMemo } from 'react';
import VolumeAnalysisService, {
  OrderBook,
  MarketDepth,
  LiquidityMetrics
} from '../services/VolumeAnalysisService';

interface UseOrderBookDataProps {
  symbol?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  depthLevels?: number;
}

interface OrderBookState {
  orderBook: OrderBook | null;
  marketDepth: MarketDepth | null;
  liquidityMetrics: LiquidityMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface OrderBookAnalytics {
  spreadAnalysis: {
    absolute: number;
    percentage: number;
    trend: 'widening' | 'narrowing' | 'stable';
  };
  imbalanceAnalysis: {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    strength: 'weak' | 'moderate' | 'strong';
  };
  liquidityAnalysis: {
    score: number;
    depth: number;
    quality: 'poor' | 'fair' | 'good' | 'excellent';
  };
  marketImpact: {
    buyImpact: number;
    sellImpact: number;
    averageImpact: number;
  };
}

interface OrderBookActions {
  refresh: () => Promise<void>;
  updateSymbol: (newSymbol: string) => void;
  getHistoricalSpreads: () => Array<{ timestamp: number; spread: number; }>;
  getOrderBookSnapshot: () => OrderBook | null;
  calculateMarketImpact: (tradeSize: number) => { buyImpact: number; sellImpact: number; };
}

export const useOrderBookData = ({
  symbol = 'BTC/USD',
  autoRefresh = true,
  refreshInterval = 5000, // 5 seconds
  depthLevels = 50
}: UseOrderBookDataProps = {}): OrderBookState & OrderBookAnalytics & OrderBookActions => {
  const [state, setState] = useState<OrderBookState>({
    orderBook: null,
    marketDepth: null,
    liquidityMetrics: null,
    isLoading: false,
    error: null,
    lastUpdated: null
  });

  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [spreadHistory, setSpreadHistory] = useState<Array<{ timestamp: number; spread: number; }>>([]);
  const [imbalanceHistory, setImbalanceHistory] = useState<Array<{ timestamp: number; imbalance: number; }>>([]);

  // Initialize service
  const volumeService = useMemo(() => new VolumeAnalysisService(), []);

  // Error handler
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`Order book error in ${operation}:`, error);
    setState(prev => ({
      ...prev,
      error: `Failed to ${operation}: ${error.message || error}`,
      isLoading: false
    }));
  }, []);

  // Load order book data
  const loadOrderBook = useCallback(async () => {
    try {
      const orderBook = await volumeService.getOrderBook(currentSymbol);
      setState(prev => ({
        ...prev,
        orderBook,
        error: null
      }));

      // Update spread history
      if (orderBook) {
        setSpreadHistory(prev => {
          const newEntry = { timestamp: Date.now(), spread: orderBook.spread };
          const updated = [...prev, newEntry].slice(-100); // Keep last 100 entries
          return updated;
        });

        // Calculate and update imbalance history
        const bidQuantity = orderBook.bids.slice(0, 10).reduce((sum, bid) => sum + bid.quantity, 0);
        const askQuantity = orderBook.asks.slice(0, 10).reduce((sum, ask) => sum + ask.quantity, 0);
        const imbalance = (bidQuantity - askQuantity) / (bidQuantity + askQuantity);
        
        setImbalanceHistory(prev => {
          const newEntry = { timestamp: Date.now(), imbalance };
          const updated = [...prev, newEntry].slice(-100);
          return updated;
        });
      }

      return orderBook;
    } catch (error) {
      handleError(error, 'load order book');
      return null;
    }
  }, [currentSymbol, volumeService, handleError]);

  // Load market depth
  const loadMarketDepth = useCallback(async () => {
    try {
      const marketDepth = await volumeService.getMarketDepth(currentSymbol, depthLevels);
      setState(prev => ({
        ...prev,
        marketDepth,
        error: null
      }));
      return marketDepth;
    } catch (error) {
      handleError(error, 'load market depth');
      return null;
    }
  }, [currentSymbol, depthLevels, volumeService, handleError]);

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

  // Full refresh
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await Promise.allSettled([
        loadOrderBook(),
        loadMarketDepth(),
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
  }, [loadOrderBook, loadMarketDepth, loadLiquidityMetrics, handleError]);

  // Update symbol
  const updateSymbol = useCallback((newSymbol: string) => {
    if (newSymbol !== currentSymbol) {
      setCurrentSymbol(newSymbol);
      setSpreadHistory([]);
      setImbalanceHistory([]);
      setState(prev => ({
        ...prev,
        orderBook: null,
        marketDepth: null,
        liquidityMetrics: null,
        error: null
      }));
    }
  }, [currentSymbol]);

  // Calculate market impact for a given trade size
  const calculateMarketImpact = useCallback((tradeSize: number) => {
    if (!state.orderBook) return { buyImpact: 0, sellImpact: 0 };

    const { bids, asks, mid } = state.orderBook;

    // Calculate buy impact (market buy order)
    let remainingBuySize = tradeSize;
    let buyTotalCost = 0;
    
    for (const ask of asks) {
      if (remainingBuySize <= 0) break;
      const takeSize = Math.min(remainingBuySize, ask.quantity);
      buyTotalCost += takeSize * ask.price;
      remainingBuySize -= takeSize;
    }

    const buyAvgPrice = tradeSize > 0 ? buyTotalCost / tradeSize : mid;
    const buyImpact = ((buyAvgPrice - mid) / mid) * 100;

    // Calculate sell impact (market sell order)
    let remainingSellSize = tradeSize;
    let sellTotalValue = 0;
    
    for (const bid of bids) {
      if (remainingSellSize <= 0) break;
      const takeSize = Math.min(remainingSellSize, bid.quantity);
      sellTotalValue += takeSize * bid.price;
      remainingSellSize -= takeSize;
    }

    const sellAvgPrice = tradeSize > 0 ? sellTotalValue / tradeSize : mid;
    const sellImpact = ((mid - sellAvgPrice) / mid) * 100;

    return { buyImpact, sellImpact };
  }, [state.orderBook]);

  // Get historical spreads
  const getHistoricalSpreads = useCallback(() => {
    return spreadHistory;
  }, [spreadHistory]);

  // Get order book snapshot
  const getOrderBookSnapshot = useCallback(() => {
    return state.orderBook;
  }, [state.orderBook]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [currentSymbol]); // Only depend on symbol changes

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refresh]);

  // Analytics calculations
  const spreadAnalysis = useMemo(() => {
    if (!state.orderBook || spreadHistory.length < 2) {
      return { absolute: 0, percentage: 0, trend: 'stable' as const };
    }

    const current = state.orderBook.spread;
    const percentage = (current / state.orderBook.mid) * 100;
    
    // Analyze trend from recent spread history
    const recent = spreadHistory.slice(-10);
    if (recent.length < 3) {
      return { absolute: current, percentage, trend: 'stable' as const };
    }

    const recentAvg = recent.reduce((sum, s) => sum + s.spread, 0) / recent.length;
    const earlierAvg = spreadHistory.slice(-20, -10).reduce((sum, s) => sum + s.spread, 0) / Math.min(10, spreadHistory.length - 10);
    
    const trendThreshold = 0.05; // 5% change
    const changePct = (recentAvg - earlierAvg) / earlierAvg;
    
    let trend: 'widening' | 'narrowing' | 'stable' = 'stable';
    if (changePct > trendThreshold) trend = 'widening';
    else if (changePct < -trendThreshold) trend = 'narrowing';

    return { absolute: current, percentage, trend };
  }, [state.orderBook, spreadHistory]);

  const imbalanceAnalysis = useMemo(() => {
    if (!state.orderBook || imbalanceHistory.length < 2) {
      return { current: 0, trend: 'stable' as const, strength: 'weak' as const };
    }

    const bidQuantity = state.orderBook.bids.slice(0, 10).reduce((sum, bid) => sum + bid.quantity, 0);
    const askQuantity = state.orderBook.asks.slice(0, 10).reduce((sum, ask) => sum + ask.quantity, 0);
    const current = (bidQuantity - askQuantity) / (bidQuantity + askQuantity);

    // Analyze trend
    const recent = imbalanceHistory.slice(-5);
    const avgRecent = recent.reduce((sum, i) => sum + i.imbalance, 0) / recent.length;
    const avgEarlier = imbalanceHistory.slice(-10, -5).reduce((sum, i) => sum + i.imbalance, 0) / Math.min(5, imbalanceHistory.length - 5);
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (avgRecent > avgEarlier + 0.05) trend = 'increasing';
    else if (avgRecent < avgEarlier - 0.05) trend = 'decreasing';

    // Determine strength
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    const absImbalance = Math.abs(current);
    if (absImbalance > 0.3) strength = 'strong';
    else if (absImbalance > 0.1) strength = 'moderate';

    return { current, trend, strength };
  }, [state.orderBook, imbalanceHistory]);

  const liquidityAnalysis = useMemo(() => {
    if (!state.liquidityMetrics || !state.marketDepth) {
      return { score: 0, depth: 0, quality: 'poor' as const };
    }

    const score = state.liquidityMetrics.liquidityScore;
    const depth = state.liquidityMetrics.totalDepth;
    
    let quality: 'poor' | 'fair' | 'good' | 'excellent' = 'poor';
    if (score >= 8) quality = 'excellent';
    else if (score >= 6) quality = 'good';
    else if (score >= 4) quality = 'fair';

    return { score, depth, quality };
  }, [state.liquidityMetrics, state.marketDepth]);

  const marketImpact = useMemo(() => {
    const standardTradeSize = 1.0; // Standard trade size for impact calculation
    const impact = calculateMarketImpact(standardTradeSize);
    const averageImpact = (impact.buyImpact + impact.sellImpact) / 2;
    
    return {
      buyImpact: impact.buyImpact,
      sellImpact: impact.sellImpact,
      averageImpact
    };
  }, [calculateMarketImpact]);

  return {
    // State
    ...state,
    
    // Analytics
    spreadAnalysis,
    imbalanceAnalysis,
    liquidityAnalysis,
    marketImpact,
    
    // Actions
    refresh,
    updateSymbol,
    getHistoricalSpreads,
    getOrderBookSnapshot,
    calculateMarketImpact
  };
};

export default useOrderBookData;