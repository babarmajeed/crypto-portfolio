import { useState, useEffect, useCallback, useRef } from 'react';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface MultiAssetDataState {
  multiAssetData: Record<string, CandlestickData[]>;
  normalizedData: Record<string, CandlestickData[]>;
  percentageData: Record<string, CandlestickData[]>;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
  isRealTimeEnabled: boolean;
}

interface UseMultiAssetDataOptions {
  assets: string[];
  timeframe: string;
  limit?: number;
  enableRealTime?: boolean;
  updateInterval?: number;
  baseAsset?: string;
}

export const useMultiAssetData = (options: UseMultiAssetDataOptions) => {
  const {
    assets,
    timeframe,
    limit = 1000,
    enableRealTime = true,
    updateInterval = 2000,
    baseAsset
  } = options;

  const [state, setState] = useState<MultiAssetDataState>({
    multiAssetData: {},
    normalizedData: {},
    percentageData: {},
    isLoading: true,
    error: null,
    lastUpdate: null,
    isRealTimeEnabled: enableRealTime
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Mock data generator for demonstration
  const generateMockData = useCallback((asset: string, count: number, startTime?: number): CandlestickData[] => {
    const data: CandlestickData[] = [];
    const now = startTime || Math.floor(Date.now() / 1000);
    const timeframeMs = getTimeframeMs(timeframe);
    
    // Different base prices for different assets
    const basePrices: Record<string, number> = {
      'BTC': 45000 + Math.random() * 20000,
      'ETH': 2500 + Math.random() * 1500,
      'ADA': 0.5 + Math.random() * 1.5,
      'DOT': 15 + Math.random() * 25,
      'LINK': 20 + Math.random() * 30,
      'UNI': 8 + Math.random() * 15,
      'AVAX': 25 + Math.random() * 35,
      'SOL': 80 + Math.random() * 120
    };
    
    let currentPrice = basePrices[asset] || (100 + Math.random() * 500);
    
    // Asset-specific volatility
    const volatilities: Record<string, number> = {
      'BTC': 0.015,
      'ETH': 0.020,
      'ADA': 0.035,
      'DOT': 0.030,
      'LINK': 0.025,
      'UNI': 0.040,
      'AVAX': 0.045,
      'SOL': 0.035
    };
    
    const volatility = volatilities[asset] || 0.025;
    
    for (let i = count - 1; i >= 0; i--) {
      const time = now - (i * (timeframeMs / 1000));
      
      // Generate realistic price movements with some correlation patterns
      const trend = Math.sin(i * 0.1) * 0.001; // Slight cyclical trend
      const randomWalk = (Math.random() - 0.5) * volatility;
      
      const open = currentPrice;
      const priceChange = currentPrice * (trend + randomWalk);
      const close = Math.max(1, open + priceChange);
      
      const high = Math.max(open, close) * (1 + Math.random() * 0.01);
      const low = Math.min(open, close) * (1 - Math.random() * 0.01);
      
      const volume = Math.floor(Math.random() * 1000000) + 100000;
      
      data.push({
        time,
        open: parseFloat(open.toFixed(8)),
        high: parseFloat(high.toFixed(8)),
        low: parseFloat(low.toFixed(8)),
        close: parseFloat(close.toFixed(8)),
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

  // Calculate normalized data (first data point = 100)
  const calculateNormalizedData = useCallback((data: Record<string, CandlestickData[]>) => {
    const normalized: Record<string, CandlestickData[]> = {};

    Object.keys(data).forEach(asset => {
      const assetData = data[asset];
      if (!assetData || assetData.length === 0) return;

      const firstPrice = assetData[0].close;
      
      normalized[asset] = assetData.map(candle => ({
        ...candle,
        open: (candle.open / firstPrice) * 100,
        high: (candle.high / firstPrice) * 100,
        low: (candle.low / firstPrice) * 100,
        close: (candle.close / firstPrice) * 100
      }));
    });

    return normalized;
  }, []);

  // Calculate percentage change data
  const calculatePercentageData = useCallback((data: Record<string, CandlestickData[]>) => {
    const percentage: Record<string, CandlestickData[]> = {};

    Object.keys(data).forEach(asset => {
      const assetData = data[asset];
      if (!assetData || assetData.length === 0) return;

      const firstPrice = assetData[0].close;
      
      percentage[asset] = assetData.map(candle => ({
        ...candle,
        open: ((candle.open - firstPrice) / firstPrice) * 100,
        high: ((candle.high - firstPrice) / firstPrice) * 100,
        low: ((candle.low - firstPrice) / firstPrice) * 100,
        close: ((candle.close - firstPrice) / firstPrice) * 100
      }));
    });

    return percentage;
  }, []);

  // Calculate relative performance to base asset
  const calculateRelativeData = useCallback((
    data: Record<string, CandlestickData[]>, 
    baseAssetSymbol: string
  ) => {
    const relative: Record<string, CandlestickData[]> = {};
    const baseData = data[baseAssetSymbol];
    
    if (!baseData || baseData.length === 0) return data;

    Object.keys(data).forEach(asset => {
      if (asset === baseAssetSymbol) {
        // Base asset relative to itself is always 100
        relative[asset] = data[asset].map(candle => ({
          ...candle,
          open: 100,
          high: 100,
          low: 100,
          close: 100
        }));
        return;
      }

      const assetData = data[asset];
      if (!assetData || assetData.length === 0) return;

      // Align data by time and calculate relative performance
      const alignedData = alignDataByTime(baseData, assetData);
      
      if (alignedData.length === 0) return;

      const firstBasePrice = alignedData[0].base.close;
      const firstAssetPrice = alignedData[0].asset.close;

      relative[asset] = alignedData.map(({ asset: assetCandle, base: baseCandle }) => ({
        ...assetCandle,
        open: ((assetCandle.open / firstAssetPrice) / (baseCandle.open / firstBasePrice)) * 100,
        high: ((assetCandle.high / firstAssetPrice) / (baseCandle.high / firstBasePrice)) * 100,
        low: ((assetCandle.low / firstAssetPrice) / (baseCandle.low / firstBasePrice)) * 100,
        close: ((assetCandle.close / firstAssetPrice) / (baseCandle.close / firstBasePrice)) * 100
      }));
    });

    return relative;
  }, []);

  // Helper function to align data by timestamp
  const alignDataByTime = (baseData: CandlestickData[], assetData: CandlestickData[]) => {
    const baseTimeMap = new Map(baseData.map(item => [item.time, item]));
    const aligned: Array<{ base: CandlestickData; asset: CandlestickData }> = [];

    assetData.forEach(assetCandle => {
      const baseCandle = baseTimeMap.get(assetCandle.time);
      if (baseCandle) {
        aligned.push({ base: baseCandle, asset: assetCandle });
      }
    });

    return aligned.sort((a, b) => a.asset.time - b.asset.time);
  };

  // Fetch initial data for all assets
  const fetchMultiAssetData = useCallback(async () => {
    if (assets.length === 0) return;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Abort previous request if still pending
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // Simulate API calls with slight delays for realism
      const dataPromises = assets.map(async (asset, index) => {
        // Stagger requests slightly to simulate real API behavior
        await new Promise(resolve => setTimeout(resolve, index * 100));
        
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Request aborted');
        }

        // In real implementation, this would be:
        // const response = await fetch(`/api/charts/${asset}/${timeframe}?limit=${limit}`);
        // return response.json();
        
        return {
          asset,
          data: generateMockData(asset, limit)
        };
      });

      const results = await Promise.all(dataPromises);
      
      const newMultiAssetData: Record<string, CandlestickData[]> = {};
      
      results.forEach(result => {
        newMultiAssetData[result.asset] = result.data;
      });

      const normalizedData = calculateNormalizedData(newMultiAssetData);
      const percentageData = calculatePercentageData(newMultiAssetData);

      setState(prev => ({
        ...prev,
        multiAssetData: newMultiAssetData,
        normalizedData: baseAsset ? calculateRelativeData(normalizedData, baseAsset) : normalizedData,
        percentageData,
        isLoading: false,
        lastUpdate: Date.now(),
        error: null
      }));

    } catch (error) {
      if (error instanceof Error && error.message !== 'Request aborted') {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message
        }));
      }
    }
  }, [assets, timeframe, limit, generateMockData, calculateNormalizedData, calculatePercentageData, calculateRelativeData, baseAsset]);

  // Update existing data with new candles (real-time simulation)
  const updateRealTimeData = useCallback(() => {
    setState(prev => {
      if (Object.keys(prev.multiAssetData).length === 0) return prev;

      const updatedMultiAssetData = { ...prev.multiAssetData };
      const now = Math.floor(Date.now() / 1000);
      const timeframeSeconds = getTimeframeMs(timeframe) / 1000;

      Object.keys(updatedMultiAssetData).forEach(asset => {
        const assetData = [...updatedMultiAssetData[asset]];
        if (assetData.length === 0) return;

        const lastCandle = assetData[assetData.length - 1];
        const timeSinceLastCandle = now - lastCandle.time;

        if (timeSinceLastCandle >= timeframeSeconds) {
          // Create new candle
          const volatility = Math.random() * 0.02 - 0.01; // ±1%
          const newClose = lastCandle.close * (1 + volatility);
          
          const newCandle: CandlestickData = {
            time: now,
            open: lastCandle.close,
            high: Math.max(lastCandle.close, newClose) * (1 + Math.random() * 0.005),
            low: Math.min(lastCandle.close, newClose) * (1 - Math.random() * 0.005),
            close: newClose,
            volume: Math.floor(Math.random() * 1000000) + 100000
          };

          assetData.push(newCandle);

          // Keep only the last 'limit' candles
          if (assetData.length > limit) {
            assetData.splice(0, assetData.length - limit);
          }
        } else {
          // Update current candle
          const volatility = Math.random() * 0.005 - 0.0025; // ±0.25%
          const updatedClose = lastCandle.close * (1 + volatility);
          
          assetData[assetData.length - 1] = {
            ...lastCandle,
            close: updatedClose,
            high: Math.max(lastCandle.high, updatedClose),
            low: Math.min(lastCandle.low, updatedClose),
            volume: (lastCandle.volume || 0) + Math.floor(Math.random() * 10000)
          };
        }

        updatedMultiAssetData[asset] = assetData;
      });

      const normalizedData = calculateNormalizedData(updatedMultiAssetData);
      const percentageData = calculatePercentageData(updatedMultiAssetData);

      return {
        ...prev,
        multiAssetData: updatedMultiAssetData,
        normalizedData: baseAsset ? calculateRelativeData(normalizedData, baseAsset) : normalizedData,
        percentageData,
        lastUpdate: Date.now()
      };
    });
  }, [timeframe, limit, getTimeframeMs, calculateNormalizedData, calculatePercentageData, calculateRelativeData, baseAsset]);

  // Start/stop real-time updates
  const toggleRealTime = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, isRealTimeEnabled: enabled }));
  }, []);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await fetchMultiAssetData();
  }, [fetchMultiAssetData]);

  // Add new asset to tracking
  const addAsset = useCallback(async (asset: string) => {
    if (assets.includes(asset)) return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Generate data for new asset
      const newAssetData = generateMockData(asset, limit);
      
      setState(prev => {
        const updatedMultiAssetData = {
          ...prev.multiAssetData,
          [asset]: newAssetData
        };

        const normalizedData = calculateNormalizedData(updatedMultiAssetData);
        const percentageData = calculatePercentageData(updatedMultiAssetData);

        return {
          ...prev,
          multiAssetData: updatedMultiAssetData,
          normalizedData: baseAsset ? calculateRelativeData(normalizedData, baseAsset) : normalizedData,
          percentageData,
          isLoading: false,
          lastUpdate: Date.now()
        };
      });

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to add asset'
      }));
    }
  }, [assets, generateMockData, limit, calculateNormalizedData, calculatePercentageData, calculateRelativeData, baseAsset]);

  // Remove asset from tracking
  const removeAsset = useCallback((asset: string) => {
    setState(prev => {
      const { [asset]: removed, ...remainingData } = prev.multiAssetData;
      const { [asset]: removedNorm, ...remainingNormalized } = prev.normalizedData;
      const { [asset]: removedPerc, ...remainingPercentage } = prev.percentageData;

      return {
        ...prev,
        multiAssetData: remainingData,
        normalizedData: remainingNormalized,
        percentageData: remainingPercentage,
        lastUpdate: Date.now()
      };
    });
  }, []);

  // Initialize data on mount or when dependencies change
  useEffect(() => {
    fetchMultiAssetData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMultiAssetData]);

  // Handle real-time updates
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (state.isRealTimeEnabled && Object.keys(state.multiAssetData).length > 0) {
      intervalRef.current = setInterval(updateRealTimeData, updateInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.isRealTimeEnabled, state.multiAssetData, updateRealTimeData, updateInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    refreshData,
    toggleRealTime,
    addAsset,
    removeAsset
  };
};