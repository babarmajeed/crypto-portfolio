import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  CheckCircle,
  XCircle,
  Eye,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuditLogs } from '../../../hooks/useAuditLogs';
import { AuditLogFilter } from '../../../types/user';

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  password_change: 'Password Changed',
  profile_update: 'Profile Updated',
  preferences_update: 'Preferences Updated',
  '2fa_enable': '2FA Enabled',
  '2fa_disable': '2FA Disabled',
  avatar_upload: 'Avatar Uploaded',
  email_change: 'Email Changed',
  account_delete: 'Account Deleted',
  session_revoked: 'Session Revoked',
  device_trusted: 'Device Trusted',
  device_untrusted: 'Device Untrusted',
};

const QUICK_FILTERS = [
  { key: 'all', label: 'All Activity', icon: Activity },
  { key: 'today', label: 'Today', icon: Calendar },
  { key: 'week', label: 'This Week', icon: Calendar },
  { key: 'month', label: 'This Month', icon: Calendar },
  { key: 'security', label: 'Security', icon: CheckCircle },
  { key: 'profile', label: 'Profile', icon: Eye },
  { key: 'failed', label: 'Failed', icon: XCircle },
];

export const AuditLogViewer: React.FC = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  });
  const [successFilter, setSuccessFilter] = useState<boolean | undefined>(undefined);

  const {
    logs,
    totalCount,
    filterOptions,
    searchTerm,
    setSearchTerm,
    updateFilter,
    clearFilter,
    applyQuickFilter,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    exportLogs,
  } = useAuditLogs();

  const handleQuickFilter = (filterKey: string) => {
    clearFilter();
    setSelectedActions([]);
    setSelectedResources([]);
    setDateRange({ start: '', end: '' });
    setSuccessFilter(undefined);
    applyQuickFilter(filterKey);
  };

  const handleAdvancedFilter = () => {
    const filter: AuditLogFilter = {};
    
    if (selectedActions.length > 0) filter.actions = selectedActions;
    if (selectedResources.length > 0) filter.resources = selectedResources;
    if (dateRange.start) filter.startDate = new Date(dateRange.start);
    if (dateRange.end) filter.endDate = new Date(dateRange.end);
    if (successFilter !== undefined) filter.success = successFilter;
    
    updateFilter(filter);
  };

  const handleClearFilters = () => {
    clearFilter();
    setSelectedActions([]);
    setSelectedResources([]);
    setDateRange({ start: '', end: '' });
    setSuccessFilter(undefined);
    setSearchTerm('');
  };

  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      await exportLogs(format);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const formatActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-500" />
            Activity Log
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Track all account activity and security events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((filter) => {
          const Icon = filter.icon;
          return (
            <button
              key={filter.key}
              onClick={() => handleQuickFilter(filter.key)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
            >
              <Icon className="h-3 w-3" />
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search activity logs..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          {(selectedActions.length > 0 || selectedResources.length > 0 || dateRange.start || searchTerm) && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Actions Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Actions
                </label>
                <select
                  multiple
                  value={selectedActions}
                  onChange={(e) => setSelectedActions(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {filterOptions.actions.map(action => (
                    <option key={action} value={action}>
                      {formatActionLabel(action)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Resources Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Resources
                </label>
                <select
                  multiple
                  value={selectedResources}
                  onChange={(e) => setSelectedResources(Array.from(e.target.selectedOptions, option => option.value))}
                  className="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {filterOptions.resources.map(resource => (
                    <option key={resource} value={resource}>
                      {resource}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white mt-2"
                />
              </div>

              {/* Success Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  value={successFilter === undefined ? '' : successFilter.toString()}
                  onChange={(e) => setSuccessFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">All</option>
                  <option value="true">Successful</option>
                  <option value="false">Failed</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAdvancedFilter}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Showing {logs.length} of {totalCount} activities
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              No activity found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Try adjusting your search or filters
            </p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`
                    w-2 h-2 rounded-full mt-2
                    ${log.success ? 'bg-green-500' : 'bg-red-500'}
                  `} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {formatActionLabel(log.action)}
                      </h4>
                      {log.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      <p>{format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm:ss')}</p>
                      {log.ipAddress && (
                        <p className="flex items-center gap-1 mt-1">
                          <Eye className="h-3 w-3" />
                          {log.ipAddress}
                        </p>
                      )}
                      {log.resource && (
                        <p className="mt-1">
                          Resource: <span className="font-medium">{log.resource}</span>
                          {log.resourceId && ` (${log.resourceId})`}
                        </p>
                      )}
                      {!log.success && log.errorMessage && (
                        <p className="text-red-600 dark:text-red-400 mt-1">
                          Error: {log.errorMessage}
                        </p>
                      )}
                    </div>

                    {/* Show changes if available */}
                    {(log.oldValues || log.newValues) && (
                      <details className="mt-2">
                        <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                          View Changes
                        </summary>
                        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
                          {log.oldValues && (
                            <div>
                              <strong>Before:</strong>
                              <pre className="mt-1 text-gray-600 dark:text-gray-400">
                                {JSON.stringify(log.oldValues, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.newValues && (
                            <div className={log.oldValues ? 'mt-2' : ''}>
                              <strong>After:</strong>
                              <pre className="mt-1 text-gray-600 dark:text-gray-400">
                                {JSON.stringify(log.newValues, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Load More */}
      {hasNextPage && (
        <div className="text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingNextPage ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {isFetchingNextPage ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
};