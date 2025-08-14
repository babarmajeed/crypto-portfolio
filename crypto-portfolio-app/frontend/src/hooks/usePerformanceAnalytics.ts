import { useState, useEffect, useCallback, useMemo } from 'react';
import { performanceAnalyticsService, PerformanceMetrics, RiskMetrics, DrawdownAnalysis, PerformanceReturn } from '../services/PerformanceAnalyticsService';

interface PortfolioHistoryPoint {
  date: string;
  value: number;
  timestamp: number;
}

interface CashFlow {
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  timestamp: number;
}

interface PerformanceAnalyticsData {
  performanceMetrics: PerformanceMetrics | null;
  riskMetrics: RiskMetrics | null;
  drawdownAnalysis: DrawdownAnalysis[];
  returnsTimeSeries: PerformanceReturn[];
  portfolioHistory: PortfolioHistoryPoint[];
  cashFlows: CashFlow[];
  benchmarkData: PerformanceReturn[];
}

interface UsePerformanceAnalyticsProps {
  portfolioId: string;
  timeRange: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL';
  benchmarkSymbol?: string;
  refreshInterval?: number; // in milliseconds
}

interface UsePerformanceAnalyticsReturn {
  data: PerformanceAnalyticsData;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateTimeRange: (newTimeRange: string) => void;
  updateBenchmark: (newBenchmark: string) => void;
}

// Mock data generator for demonstration
const generateMockPortfolioHistory = (timeRange: string): PortfolioHistoryPoint[] => {
  const now = new Date();
  const points: PortfolioHistoryPoint[] = [];
  
  let days: number;
  switch (timeRange) {
    case '1M': days = 30; break;
    case '3M': days = 90; break;
    case '6M': days = 180; break;
    case '1Y': days = 365; break;
    case '2Y': days = 730; break;
    case 'ALL': days = 1095; break; // 3 years
    default: days = 365;
  }
  
  let value = 10000; // Starting portfolio value
  
  for (let i = 0; i <= days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i));
    
    // Simulate realistic crypto portfolio volatility
    const dailyReturn = (Math.random() - 0.5) * 0.08; // ±4% daily volatility
    const trendComponent = Math.sin((i / days) * Math.PI * 2) * 0.001; // Long-term trend
    const momentum = Math.random() > 0.5 ? 1.002 : 0.998; // Slight upward bias
    
    value = value * (1 + dailyReturn + trendComponent) * momentum;
    
    points.push({
      date: date.toISOString().split('T')[0],
      value: Math.max(value, 1000), // Minimum value
      timestamp: date.getTime()
    });
  }
  
  return points;
};

const generateMockCashFlows = (portfolioHistory: PortfolioHistoryPoint[]): CashFlow[] => {
  const flows: CashFlow[] = [];
  const numFlows = Math.floor(portfolioHistory.length / 30); // Monthly cash flows
  
  for (let i = 0; i < numFlows; i++) {
    const historyIndex = Math.floor((i + 1) * portfolioHistory.length / numFlows);
    const point = portfolioHistory[historyIndex];
    
    if (point) {
      const isDeposit = Math.random() > 0.3; // 70% deposits, 30% withdrawals
      const amount = isDeposit 
        ? Math.random() * 2000 + 500  // $500-$2500 deposits
        : Math.random() * 1000 + 200; // $200-$1200 withdrawals
      
      flows.push({
        date: point.date,
        amount,
        type: isDeposit ? 'deposit' : 'withdrawal',
        timestamp: point.timestamp
      });
    }
  }
  
  return flows;
};

const generateMockBenchmarkData = (portfolioHistory: PortfolioHistoryPoint[]): PerformanceReturn[] => {
  const benchmarkReturns: PerformanceReturn[] = [];
  let cumulativeReturn = 0;
  
  for (let i = 1; i < portfolioHistory.length; i++) {
    // Simulate benchmark (e.g., BTC) with different volatility characteristics
    const dailyReturn = (Math.random() - 0.5) * 0.06; // ±3% daily volatility for benchmark
    const trendComponent = Math.sin((i / portfolioHistory.length) * Math.PI) * 0.0005;
    
    const benchmarkReturn = dailyReturn + trendComponent;
    cumulativeReturn = (1 + cumulativeReturn) * (1 + benchmarkReturn) - 1;
    
    benchmarkReturns.push({
      date: portfolioHistory[i].date,
      return: benchmarkReturn,
      cumulativeReturn,
      timestamp: portfolioHistory[i].timestamp
    });
  }
  
  return benchmarkReturns;
};

export const usePerformanceAnalytics = ({
  portfolioId,
  timeRange,
  benchmarkSymbol = 'BTC',
  refreshInterval
}: UsePerformanceAnalyticsProps): UsePerformanceAnalyticsReturn => {
  const [data, setData] = useState<PerformanceAnalyticsData>({
    performanceMetrics: null,
    riskMetrics: null,
    drawdownAnalysis: [],
    returnsTimeSeries: [],
    portfolioHistory: [],
    cashFlows: [],
    benchmarkData: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTimeRange, setCurrentTimeRange] = useState(timeRange);
  const [currentBenchmark, setCurrentBenchmark] = useState(benchmarkSymbol);

  // Memoize expensive calculations
  const calculatedMetrics = useMemo(() => {
    if (data.portfolioHistory.length < 2) return null;
    
    try {
      const returns = performanceAnalyticsService.calculateReturns(data.portfolioHistory);
      const performanceMetrics = performanceAnalyticsService.calculatePerformanceMetrics(
        data.portfolioHistory,
        data.cashFlows,
        data.benchmarkData
      );
      const riskMetrics = performanceAnalyticsService.calculateRiskMetrics(returns);
      const drawdownAnalysis = performanceAnalyticsService.calculateDrawdownAnalysis(data.portfolioHistory);
      
      return {
        performanceMetrics,
        riskMetrics,
        drawdownAnalysis,
        returnsTimeSeries: returns
      };
    } catch (err) {
      console.error('Error calculating performance metrics:', err);
      return null;
    }
  }, [data.portfolioHistory, data.cashFlows, data.benchmarkData]);

  // Load portfolio data
  const loadPortfolioData = useCallback(async () => {
    if (!portfolioId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // In a real implementation, these would be API calls
      // For now, generate mock data
      const portfolioHistory = generateMockPortfolioHistory(currentTimeRange);
      const cashFlows = generateMockCashFlows(portfolioHistory);
      const benchmarkData = generateMockBenchmarkData(portfolioHistory);
      
      setData(prevData => ({
        ...prevData,
        portfolioHistory,
        cashFlows,
        benchmarkData
      }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load portfolio data';
      setError(errorMessage);
      console.error('Error loading portfolio data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId, currentTimeRange, currentBenchmark]);

  // Update calculated metrics when base data changes
  useEffect(() => {
    if (calculatedMetrics) {
      setData(prevData => ({
        ...prevData,
        performanceMetrics: calculatedMetrics.performanceMetrics,
        riskMetrics: calculatedMetrics.riskMetrics,
        drawdownAnalysis: calculatedMetrics.drawdownAnalysis,
        returnsTimeSeries: calculatedMetrics.returnsTimeSeries
      }));
    }
  }, [calculatedMetrics]);

  // Load data when dependencies change
  useEffect(() => {
    loadPortfolioData();
  }, [loadPortfolioData]);

  // Set up refresh interval
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;
    
    const interval = setInterval(() => {
      loadPortfolioData();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval, loadPortfolioData]);

  // Update time range
  const updateTimeRange = useCallback((newTimeRange: string) => {
    if (newTimeRange !== currentTimeRange) {
      setCurrentTimeRange(newTimeRange as any);
    }
  }, [currentTimeRange]);

  // Update benchmark
  const updateBenchmark = useCallback((newBenchmark: string) => {
    if (newBenchmark !== currentBenchmark) {
      setCurrentBenchmark(newBenchmark);
    }
  }, [currentBenchmark]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await loadPortfolioData();
  }, [loadPortfolioData]);

  return {
    data,
    isLoading,
    error,
    refresh,
    updateTimeRange,
    updateBenchmark
  };
};

// Hook for risk analysis specifically
export const useRiskAnalysis = (portfolioId: string, timeRange: string) => {
  const { data, isLoading, error } = usePerformanceAnalytics({
    portfolioId,
    timeRange: timeRange as any
  });

  return {
    riskMetrics: data.riskMetrics,
    drawdownAnalysis: data.drawdownAnalysis,
    valueAtRisk: data.riskMetrics?.valueAtRisk,
    expectedShortfall: data.riskMetrics?.expectedShortfall,
    isLoading,
    error
  };
};

// Hook for benchmark comparison
export const useBenchmarkComparison = (portfolioId: string, timeRange: string, benchmarkSymbol: string = 'BTC') => {
  const { data, isLoading, error } = usePerformanceAnalytics({
    portfolioId,
    timeRange: timeRange as any,
    benchmarkSymbol
  });

  const benchmarkComparison = useMemo(() => {
    if (!data.performanceMetrics || !data.benchmarkData.length) return null;
    
    return {
      benchmark: benchmarkSymbol,
      correlation: data.performanceMetrics.betaToMarket || 0,
      beta: data.performanceMetrics.betaToMarket,
      alpha: data.performanceMetrics.alphaToMarket,
      trackingError: data.performanceMetrics.trackingError,
      informationRatio: data.performanceMetrics.informationRatio,
      relativeReturn: data.performanceMetrics.annualizedReturn - 
        (data.benchmarkData.length > 0 ? 
          performanceAnalyticsService.calculateAnnualizedReturn(data.benchmarkData) : 0),
      upCapture: 0.95, // Placeholder
      downCapture: 1.05  // Placeholder
    };
  }, [data.performanceMetrics, data.benchmarkData, benchmarkSymbol]);

  return {
    benchmarkData: data.benchmarkData,
    benchmarkComparison,
    portfolioReturns: data.returnsTimeSeries,
    isLoading,
    error
  };
};

export default usePerformanceAnalytics;