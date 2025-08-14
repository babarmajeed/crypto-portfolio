import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { watchlistService } from '../../services/watchlistService';
import { toast } from 'react-hot-toast';

interface UseAssetActionsReturn {
  addToWatchlist: () => void;
  removeFromWatchlist: () => void;
  isInWatchlist: boolean;
  openBuyModal: () => void;
  openSellModal: () => void;
  isLoading: boolean;
  error: Error | null;
}

interface TradeModalData {
  symbol: string;
  type: 'buy' | 'sell';
}

// Global state for trade modals (in a real app, you might use a state management library)
let tradeModalState: {
  isOpen: boolean;
  data: TradeModalData | null;
  onOpen: ((data: TradeModalData) => void) | null;
} = {
  isOpen: false,
  data: null,
  onOpen: null
};

export const setTradeModalHandler = (handler: (data: TradeModalData) => void) => {
  tradeModalState.onOpen = handler;
};

export const useAssetActions = (symbol: string): UseAssetActionsReturn => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Query to check if asset is in watchlist
  const { data: watchlistData } = useQuery({
    queryKey: ['watchlist'],
    queryFn: () => watchlistService.getWatchlist(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isInWatchlist = watchlistData?.includes(symbol) || false;

  // Mutation to add to watchlist
  const addToWatchlistMutation = useMutation({
    mutationFn: () => watchlistService.addToWatchlist(symbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success(`${symbol} added to watchlist`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add ${symbol} to watchlist: ${error.message}`);
      setError(error);
    },
  });

  // Mutation to remove from watchlist
  const removeFromWatchlistMutation = useMutation({
    mutationFn: () => watchlistService.removeFromWatchlist(symbol),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success(`${symbol} removed from watchlist`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove ${symbol} from watchlist: ${error.message}`);
      setError(error);
    },
  });

  // Add to watchlist
  const addToWatchlist = useCallback(async () => {
    if (isInWatchlist) return;
    
    try {
      setIsLoading(true);
      setError(null);
      await addToWatchlistMutation.mutateAsync();
    } catch (err) {
      console.error('Error adding to watchlist:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInWatchlist, addToWatchlistMutation]);

  // Remove from watchlist
  const removeFromWatchlist = useCallback(async () => {
    if (!isInWatchlist) return;
    
    try {
      setIsLoading(true);
      setError(null);
      await removeFromWatchlistMutation.mutateAsync();
    } catch (err) {
      console.error('Error removing from watchlist:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isInWatchlist, removeFromWatchlistMutation]);

  // Open buy modal
  const openBuyModal = useCallback(() => {
    if (tradeModalState.onOpen) {
      tradeModalState.onOpen({
        symbol,
        type: 'buy'
      });
    } else {
      // Fallback: navigate to trading page or show notification
      console.log(`Buy ${symbol} - Trading modal not available`);
      console.log(`Opening buy modal for ${symbol}`);
    }
  }, [symbol]);

  // Open sell modal
  const openSellModal = useCallback(() => {
    if (tradeModalState.onOpen) {
      tradeModalState.onOpen({
        symbol,
        type: 'sell'
      });
    } else {
      // Fallback: navigate to trading page or show notification
      console.log(`Sell ${symbol} - Trading modal not available`);
      console.log(`Opening sell modal for ${symbol}`);
    }
  }, [symbol]);

  return {
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist,
    openBuyModal,
    openSellModal,
    isLoading: isLoading || addToWatchlistMutation.isPending || removeFromWatchlistMutation.isPending,
    error
  };
};