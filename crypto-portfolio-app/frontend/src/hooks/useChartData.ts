import { useState, useEffect, useCallback, useRef } from 'react';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface ChartDataHookOptions {
  symbol: string;
  timeframe: string;
  limit?: number;
  enableRealtime?: boolean;
  updateInterval?: number;
}

interface ChartDataState {
  data: CandlestickData[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
  isConnected: boolean;
}

export const useChartData = (options: ChartDataHookOptions) => {
  const {
    symbol,
    timeframe,
    limit = 1000,
    enableRealtime = true,
    updateInterval = 1000
  } = options;

  const [state, setState] = useState<ChartDataState>({
    data: [],
    isLoading: true,
    error: null,
    lastUpdate: null,
    isConnected: false
  });

  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  // Mock data generator for demonstration
  const generateMockData = useCallback((count: number, startTime?: number): CandlestickData[] => {
    const data: CandlestickData[] = [];
    const now = startTime || Math.floor(Date.now() / 1000);
    const timeframeMs = getTimeframeMs(timeframe);
    
    let currentPrice = 50000 + Math.random() * 10000; // Start around $50k-60k
    
    for (let i = count - 1; i >= 0; i--) {
      const time = now - (i * (timeframeMs / 1000));
      
      // Generate realistic price movements
      const volatility = 0.02; // 2% volatility
      const trend = (Math.random() - 0.5) * 0.001; // Slight trend bias
      
      const open = currentPrice;
      const priceChange = (Math.random() - 0.5) * currentPrice * volatility + (currentPrice * trend);
      const close = Math.max(1, open + priceChange);
      
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      const volume = Math.floor(Math.random() * 1000000) + 100000;
      
      data.push({
        time,
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume
      });
      
      currentPrice = close;
    }
    
    return data.sort((a, b) => a.time - b.time);
  }, [timeframe]);

  // Helper function to convert timeframe to milliseconds
  const getTimeframeMs = useCallback((tf: string): number => {
    const timeframes: Record<string, number> = {
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
    };
    return timeframes[tf] || 60 * 60 * 1000; // Default to 1 hour
  }, []);

  // Generate new candlestick data for real-time updates
  const generateNewCandle = useCallback((lastCandle: CandlestickData): CandlestickData => {
    const timeframeMs = getTimeframeMs(timeframe);
    const newTime = lastCandle.time + (timeframeMs / 1000);
    
    const volatility = 0.015;
    const open = lastCandle.close;
    const priceChange = (Math.random() - 0.5) * open * volatility;
    const close = Math.max(1, open + priceChange);
    
    const high = Math.max(open, close) * (1 + Math.random() * 0.008);
    const low = Math.min(open, close) * (1 - Math.random() * 0.008);
    const volume = Math.floor(Math.random() * 1000000) + 100000;
    
    return {
      time: newTime,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume
    };
  }, [timeframe, getTimeframeMs]);

  // Update current candle (real-time price updates)
  const updateCurrentCandle = useCallback((currentCandle: CandlestickData): CandlestickData => {
    const volatility = 0.001; // Smaller movements for real-time updates
    const priceChange = (Math.random() - 0.5) * currentCandle.open * volatility;
    const newClose = Math.max(1, currentCandle.close + priceChange);
    
    return {
      ...currentCandle,
      close: parseFloat(newClose.toFixed(2)),
      high: Math.max(currentCandle.high, newClose),
      low: Math.min(currentCandle.low, newClose),
      volume: currentCandle.volume || 0 + Math.floor(Math.random() * 1000)
    };
  }, []);

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In a real implementation, this would be an API call
      // const response = await fetch(`/api/charts/${symbol}/${timeframe}?limit=${limit}`);
      // const data = await response.json();
      
      const mockData = generateMockData(limit);
      
      setState(prev => ({
        ...prev,
        data: mockData,
        isLoading: false,
        lastUpdate: Date.now(),
        error: null
      }));
      
      isInitialLoad.current = false;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch chart data'
      }));
    }
  }, [symbol, timeframe, limit, generateMockData]);

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!enableRealtime || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      // In a real implementation, this would connect to a real WebSocket
      // wsRef.current = new WebSocket(`wss://api.exchange.com/ws/${symbol}/${timeframe}`);
      
      // Mock WebSocket behavior with setInterval
      setState(prev => ({ ...prev, isConnected: true }));
      
      if (intervalRef.current) clearInterval(intervalRef.current);
      
      intervalRef.current = setInterval(() => {
        setState(prev => {
          if (prev.data.length === 0) return prev;
          
          const now = Math.floor(Date.now() / 1000);
          const timeframeSeconds = getTimeframeMs(timeframe) / 1000;
          const lastCandle = prev.data[prev.data.length - 1];
          const timeSinceLastCandle = now - lastCandle.time;
          
          let newData = [...prev.data];
          
          if (timeSinceLastCandle >= timeframeSeconds) {
            // Create new candle
            const newCandle = generateNewCandle(lastCandle);
            newData.push(newCandle);
            
            // Keep only the last 'limit' candles
            if (newData.length > limit) {
              newData = newData.slice(-limit);
            }
          } else {
            // Update current candle
            const updatedCandle = updateCurrentCandle(lastCandle);
            newData[newData.length - 1] = updatedCandle;
          }
          
          return {
            ...prev,
            data: newData,
            lastUpdate: Date.now()
          };
        });
      }, updateInterval);
      
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      setState(prev => ({
        ...prev,
        error: 'Real-time connection failed',
        isConnected: false
      }));
    }
  }, [enableRealtime, symbol, timeframe, generateNewCandle, updateCurrentCandle, getTimeframeMs, limit, updateInterval]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    setState(prev => ({ ...prev, isConnected: false }));
  }, []);

  // Refresh data manually
  const refreshData = useCallback(async () => {
    await fetchInitialData();
    if (enableRealtime) {
      disconnectWebSocket();
      connectWebSocket();
    }
  }, [fetchInitialData, enableRealtime, disconnectWebSocket, connectWebSocket]);

  // Initialize and manage connections
  useEffect(() => {
    fetchInitialData();
    
    return () => {
      disconnectWebSocket();
    };
  }, [symbol, timeframe, limit]);

  useEffect(() => {
    if (!isInitialLoad.current && enableRealtime && state.data.length > 0) {
      connectWebSocket();
    }
    
    return () => {
      if (!enableRealtime) {
        disconnectWebSocket();
      }
    };
  }, [enableRealtime, connectWebSocket, disconnectWebSocket, state.data.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectWebSocket();
    };
  }, [disconnectWebSocket]);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    isConnected: state.isConnected,
    lastUpdate: state.lastUpdate,
    refreshData,
    connectWebSocket,
    disconnectWebSocket
  };
};

export default useChartData;