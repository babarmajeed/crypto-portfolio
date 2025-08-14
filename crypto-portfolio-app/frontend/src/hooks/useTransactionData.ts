import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transactionApi } from '../api/transactionApi';

interface FilterConfig {
  dateRange: { start: Date | null; end: Date | null };
  type: string;
  exchange: string;
  asset: string;
  minAmount: number | null;
  maxAmount: number | null;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

export const useTransactionData = (
  filters: FilterConfig,
  searchTerm: string,
  sortConfig: SortConfig
) => {
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Debounce search term
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchTerm]);

  // Build query parameters
  const queryParams = useMemo(() => {
    const params: any = {
      sortBy: sortConfig.key,
      sortOrder: sortConfig.direction,
      limit: 1000 // Load more for client-side operations
    };

    // Add filters
    if (filters.dateRange.start) {
      params.startDate = filters.dateRange.start.toISOString();
    }
    if (filters.dateRange.end) {
      params.endDate = filters.dateRange.end.toISOString();
    }
    if (filters.type !== 'all') {
      params.type = filters.type;
    }
    if (filters.exchange !== 'all') {
      params.exchange = filters.exchange;
    }
    if (filters.asset !== 'all') {
      params.asset = filters.asset;
    }
    if (filters.minAmount !== null) {
      params.minAmount = filters.minAmount;
    }
    if (filters.maxAmount !== null) {
      params.maxAmount = filters.maxAmount;
    }
    if (debouncedSearchTerm) {
      params.search = debouncedSearchTerm;
    }

    return params;
  }, [filters, debouncedSearchTerm, sortConfig]);

  // Fetch transactions using React Query
  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['transactions', queryParams],
    queryFn: () => transactionApi.getTransactions(queryParams),
    staleTime: 30000, // Consider data stale after 30 seconds
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2
  });

  // Process transaction data
  const processedData = useMemo(() => {
    if (!data) return { transactions: [], totalCount: 0 };

    const transactions = data.transactions || [];
    const totalCount = data.totalCount || transactions.length;

    // Additional client-side filtering if needed
    let filteredTransactions = [...transactions];

    // Client-side search on additional fields
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      filteredTransactions = filteredTransactions.filter(tx => 
        tx.id?.toLowerCase().includes(searchLower) ||
        tx.orderId?.toLowerCase().includes(searchLower) ||
        tx.tradeId?.toLowerCase().includes(searchLower) ||
        tx.notes?.toLowerCase().includes(searchLower)
      );
    }

    return {
      transactions: filteredTransactions,
      totalCount: filteredTransactions.length
    };
  }, [data, debouncedSearchTerm]);

  return {
    transactions: processedData.transactions,
    totalCount: processedData.totalCount,
    isLoading,
    error,
    refresh: refetch
  };
};