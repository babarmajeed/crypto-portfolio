import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { assetService } from '../../services/assetService';
import { portfolioService } from '../../services/portfolioService';

interface AssetData {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  priceChange7d?: number;
  priceChangePercentage7d?: number;
  priceChange30d?: number;
  priceChangePercentage30d?: number;
  marketCap: number;
  marketCapRank: number;
  fullyDilutedValuation?: number;
  totalVolume: number;
  high24h: number;
  low24h: number;
  totalSupply?: number;
  maxSupply?: number;
  circulatingSupply?: number;
  ath: number;
  athChangePercentage: number;
  athDate: string;
  atl: number;
  atlChangePercentage: number;
  atlDate: string;
  image: string;
  lastUpdated: string;
  rank: number;
  volume24h: number;
}

interface HoldingData {
  symbol: string;
  quantity: number;
  value: number;
  averageCostBasis: number;
  unrealizedPnL: number;
  unrealizedPnLPercentage: number;
  totalCost: number;
  lastUpdated: Date;
}

interface PricePoint {
  timestamp: number;
  price: number;
}

interface UseAssetDataReturn {
  assetData: AssetData | null;
  holdingData: HoldingData | null;
  priceHistory: PricePoint[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export const useAssetData = (symbol: string): UseAssetDataReturn => {
  const queryClient = useQueryClient();
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);

  // Query for asset market data
  const {
    data: assetData,
    isLoading: assetLoading,
    error: assetError,
    refetch: refetchAsset
  } = useQuery({
    queryKey: ['asset', symbol],
    queryFn: () => assetService.getAssetData(symbol),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // 1 minute
    enabled: !!symbol
  });

  // Query for user holdings
  const {
    data: holdingData,
    isLoading: holdingLoading,
    error: holdingError,
    refetch: refetchHolding
  } = useQuery({
    queryKey: ['holding', symbol],
    queryFn: () => portfolioService.getHolding(symbol),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    enabled: !!symbol
  });

  // Query for price history
  const {
    data: priceHistoryData,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory
  } = useQuery({
    queryKey: ['priceHistory', symbol, '24h'],
    queryFn: () => assetService.getPriceHistory(symbol, '24h', '1h'),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
    enabled: !!symbol
  });

  // Update price history state
  useEffect(() => {
    if (priceHistoryData) {
      setPriceHistory(priceHistoryData);
    }
  }, [priceHistoryData]);

  // Subscribe to real-time price updates
  useEffect(() => {
    if (!assetData || !symbol) return;

    let ws: WebSocket | null = null;
    
    const connectWebSocket = () => {
      try {
        // Connect to WebSocket for real-time updates
        const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001/ws';
        ws = new WebSocket(`${wsUrl}/prices/${symbol.toLowerCase()}`);

        ws.onopen = () => {
          console.log(`WebSocket connected for ${symbol}`);
        };

        ws.onmessage = (event) => {
          try {
            const priceUpdate = JSON.parse(event.data);
            
            // Update asset data in cache
            queryClient.setQueryData(['asset', symbol], (oldData: AssetData | undefined) => {
              if (!oldData) return oldData;
              
              return {
                ...oldData,
                currentPrice: priceUpdate.price,
                priceChange24h: priceUpdate.change24h,
                priceChangePercentage24h: priceUpdate.changePercentage24h,
                volume24h: priceUpdate.volume24h,
                high24h: priceUpdate.high24h,
                low24h: priceUpdate.low24h,
                lastUpdated: priceUpdate.timestamp
              };
            });

            // Update holding data if user has holdings
            if (holdingData && holdingData.quantity > 0) {
              queryClient.setQueryData(['holding', symbol], (oldData: HoldingData | undefined) => {
                if (!oldData) return oldData;
                
                const newValue = oldData.quantity * priceUpdate.price;
                const costBasis = oldData.averageCostBasis * oldData.quantity;
                
                return {
                  ...oldData,
                  value: newValue,
                  unrealizedPnL: newValue - costBasis,
                  unrealizedPnLPercentage: ((newValue - costBasis) / costBasis) * 100,
                  lastUpdated: new Date()
                };
              });
            }

            // Update price history with new data point
            setPriceHistory(prev => {
              const newPoint: PricePoint = {
                timestamp: priceUpdate.timestamp,
                price: priceUpdate.price
              };
              
              // Keep only last 24 hours of data (assuming 1-hour intervals)
              const maxPoints = 24;
              const updated = [...prev, newPoint];
              
              return updated.slice(-maxPoints);
            });

          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error(`WebSocket error for ${symbol}:`, error);
        };

        ws.onclose = () => {
          console.log(`WebSocket closed for ${symbol}`);
          // Attempt to reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
        
      } catch (error) {
        console.error(`Failed to connect WebSocket for ${symbol}:`, error);
        // Fallback: use polling instead of WebSocket
        const interval = setInterval(() => {
          refetchAsset();
        }, 30000); // Poll every 30 seconds
        
        return () => clearInterval(interval);
      }
    };

    // Only connect WebSocket in production or when explicitly enabled
    if (process.env.NODE_ENV === 'production' || process.env.REACT_APP_ENABLE_WS === 'true') {
      connectWebSocket();
    }

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [symbol, assetData, holdingData, queryClient, refetchAsset]);

  const refresh = useCallback(() => {
    refetchAsset();
    refetchHolding();
    refetchHistory();
  }, [refetchAsset, refetchHolding, refetchHistory]);

  return {
    assetData: assetData || null,
    holdingData: holdingData || null,
    priceHistory,
    isLoading: assetLoading || holdingLoading || historyLoading,
    error: assetError || holdingError || historyError,
    refresh
  };
};