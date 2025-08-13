import { useInfiniteQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { userService } from '../services/user.service';
import { AuditLogFilter } from '../types/user';

export const useAuditLogs = (initialFilter?: AuditLogFilter) => {
  const [filter, setFilter] = useState<AuditLogFilter>(initialFilter || {});
  const [searchTerm, setSearchTerm] = useState('');

  // Get audit logs with pagination
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['audit-logs', filter],
    queryFn: ({ pageParam = 0 }) => 
      userService.getAuditLogs({ 
        ...filter, 
        offset: pageParam as number,
        limit: filter.limit || 20 
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length * (filter.limit || 20);
      }
      return undefined;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  // Flatten and filter logs
  const logs = useMemo(() => {
    if (!data?.pages) return [];
    
    let allLogs = data.pages.flatMap((page: any) => page.logs || []);
    
    // Client-side search filtering
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      allLogs = allLogs.filter(log => 
        log.action.toLowerCase().includes(term) ||
        log.resource?.toLowerCase().includes(term) ||
        log.resourceId?.toLowerCase().includes(term) ||
        log.ipAddress?.toLowerCase().includes(term)
      );
    }
    
    return allLogs;
  }, [data?.pages, searchTerm]);

  // Get total count
  const totalCount = (data?.pages[0] as any)?.total || 0;

  // Update filter
  const updateFilter = (newFilter: Partial<AuditLogFilter>) => {
    setFilter(prev => ({ ...prev, ...newFilter }));
  };

  // Clear filter
  const clearFilter = () => {
    setFilter({});
    setSearchTerm('');
  };

  // Quick filter presets
  const applyQuickFilter = (preset: string) => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (preset) {
      case 'today':
        updateFilter({ 
          startDate: startOfDay,
          endDate: now 
        });
        break;
      case 'week':
        updateFilter({ 
          startDate: startOfWeek,
          endDate: now 
        });
        break;
      case 'month':
        updateFilter({ 
          startDate: startOfMonth,
          endDate: now 
        });
        break;
      case 'security':
        updateFilter({ 
          actions: ['login', 'logout', '2fa_enable', '2fa_disable', 'password_change'] 
        });
        break;
      case 'profile':
        updateFilter({ 
          actions: ['profile_update', 'avatar_upload', 'email_change'] 
        });
        break;
      case 'preferences':
        updateFilter({ 
          actions: ['preferences_update', 'theme_change', 'notification_update'] 
        });
        break;
      case 'failed':
        updateFilter({ 
          success: false 
        });
        break;
      default:
        clearFilter();
    }
  };

  // Get unique actions and resources for filter options
  const filterOptions = useMemo(() => {
    if (!logs.length) return { actions: [], resources: [] };

    const actions = [...new Set(logs.map(log => log.action))];
    const resources = [...new Set(logs.map(log => log.resource).filter(Boolean))];

    return { actions, resources };
  }, [logs]);

  // Export logs
  const exportLogs = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const exportData = {
        format,
        includeAuditLogs: true,
        includeTransactions: false,
        includePortfolio: false,
        includePreferences: false,
        dateRange: filter.startDate && filter.endDate ? {
          from: filter.startDate,
          to: filter.endDate
        } : undefined,
      };

      const blob = await userService.exportData(exportData);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
      throw error;
    }
  };

  return {
    // Data
    logs,
    totalCount,
    filterOptions,
    
    // State
    filter,
    searchTerm,
    
    // Loading states
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    
    // Error state
    error,
    
    // Actions
    setSearchTerm,
    updateFilter,
    clearFilter,
    applyQuickFilter,
    fetchNextPage,
    exportLogs,
  };
};