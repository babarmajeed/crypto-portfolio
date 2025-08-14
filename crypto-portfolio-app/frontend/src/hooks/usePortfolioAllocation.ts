import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { portfolioApi } from '../api/portfolio';

interface AllocationData {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  color?: string;
  change24h?: number;
  changePercentage24h?: number;
  exchange?: string;
  lastUpdated?: Date;
  isStale?: boolean;
}

interface PortfolioAllocationData {
  allocations: AllocationData[];
  totalValue: number;
  lastUpdated: Date;
  isRealTime: boolean;
}

interface UsePortfolioAllocationOptions {
  portfolioId: string;
  enableRealTime?: boolean;
  refreshInterval?: number;
  staleThreshold?: number; // milliseconds
}

interface UsePortfolioAllocationReturn {
  data: PortfolioAllocationData | undefined;
  allocations: AllocationData[];
  totalValue: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  lastUpdated: Date | null;
  refetch: () => Promise<void>;
  enableRealTime: () => void;
  disableRealTime: () => void;
}

export const usePortfolioAllocation = ({
  portfolioId,
  enableRealTime = false,
  refreshInterval = 30000,
  staleThreshold = 60000
}: UsePortfolioAllocationOptions): UsePortfolioAllocationReturn => {
  const queryClient = useQueryClient();
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(enableRealTime);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Query for portfolio allocation data
  const {
    data,
    isLoading,
    isError,
    error,
    refetch: queryRefetch
  } = useQuery({
    queryKey: ['portfolioAllocation', portfolioId],
    queryFn: async () => {
      const response = await portfolioApi.getPortfolioAllocation(portfolioId);
      return {
        ...response.data,
        lastUpdated: new Date(response.data.lastUpdated || Date.now()),
        isRealTime: wsConnected
      } as PortfolioAllocationData;
    },
    refetchInterval: isRealTimeEnabled ? refreshInterval : false,
    staleTime: staleThreshold,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    if (!isRealTimeEnabled || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsUrl = `${process.env.VITE_WS_URL || 'ws://localhost:3001'}/portfolio/${portfolioId}/allocation`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Portfolio allocation WebSocket connected');
        setWsConnected(true);
        reconnectAttempts.current = 0;
        
        // Send initial subscription message
        wsRef.current?.send(JSON.stringify({
          type: 'subscribe',
          portfolioId,
          dataTypes: ['allocation', 'prices', 'values']
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'allocationUpdate') {
            // Update the query cache with new data
            queryClient.setQueryData(['portfolioAllocation', portfolioId], (oldData: PortfolioAllocationData | undefined) => {
              if (!oldData) return oldData;
              
              return {
                ...oldData,
                ...message.data,
                lastUpdated: new Date(),
                isRealTime: true
              };
            });
          } else if (message.type === 'priceUpdate') {
            // Update individual asset prices
            queryClient.setQueryData(['portfolioAllocation', portfolioId], (oldData: PortfolioAllocationData | undefined) => {
              if (!oldData) return oldData;
              
              const updatedAllocations = oldData.allocations.map(allocation => {
                const priceUpdate = message.data.prices?.[allocation.symbol];
                if (priceUpdate) {
                  const newValue = allocation.value * (priceUpdate.price / (allocation.value / allocation.percentage * 100 / oldData.totalValue));
                  const newPercentage = (newValue / oldData.totalValue) * 100;
                  
                  return {
                    ...allocation,
                    value: newValue,
                    percentage: newPercentage,
                    changePercentage24h: priceUpdate.changePercentage24h,
                    lastUpdated: new Date(priceUpdate.timestamp),
                    isStale: false
                  };
                }
                return allocation;
              });
              
              const newTotalValue = updatedAllocations.reduce((sum, alloc) => sum + alloc.value, 0);
              
              return {
                ...oldData,
                allocations: updatedAllocations,
                totalValue: newTotalValue,
                lastUpdated: new Date(),
                isRealTime: true
              };
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('Portfolio allocation WebSocket closed:', event.code, event.reason);
        setWsConnected(false);
        
        // Attempt to reconnect if it wasn't a manual close
        if (event.code !== 1000 && isRealTimeEnabled && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connectWebSocket();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Portfolio allocation WebSocket error:', error);
        setWsConnected(false);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setWsConnected(false);
    }
  }, [isRealTimeEnabled, portfolioId, queryClient]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setWsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  // Effect to manage WebSocket connection
  useEffect(() => {
    if (isRealTimeEnabled) {
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }

    return disconnectWebSocket;
  }, [isRealTimeEnabled, connectWebSocket, disconnectWebSocket]);

  // Manual refetch function
  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  // Enable real-time updates
  const enableRealTimeUpdates = useCallback(() => {
    setIsRealTimeEnabled(true);
  }, []);

  // Disable real-time updates
  const disableRealTimeUpdates = useCallback(() => {
    setIsRealTimeEnabled(false);
  }, []);

  // Check if data is stale
  const isStale = useMemo(() => {
    if (!data?.lastUpdated) return true;
    return Date.now() - data.lastUpdated.getTime() > staleThreshold;
  }, [data?.lastUpdated, staleThreshold]);

  // Mark individual allocations as stale if needed
  const processedAllocations = useMemo(() => {
    if (!data?.allocations) return [];
    
    return data.allocations.map(allocation => ({
      ...allocation,
      isStale: allocation.lastUpdated ? 
        Date.now() - allocation.lastUpdated.getTime() > staleThreshold : 
        true
    }));
  }, [data?.allocations, staleThreshold]);

  return {
    data,
    allocations: processedAllocations,
    totalValue: data?.totalValue || 0,
    isLoading,
    isError,
    error,
    isStale,
    lastUpdated: data?.lastUpdated || null,
    refetch,
    enableRealTime: enableRealTimeUpdates,
    disableRealTime: disableRealTimeUpdates
  };
};

export default usePortfolioAllocation;