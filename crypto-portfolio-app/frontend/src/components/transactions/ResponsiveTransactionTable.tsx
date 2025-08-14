import React, { useState, useCallback, useMemo } from 'react';
import { Search, Filter, Calendar, Download, MoreVertical, ArrowUpDown, ChevronDown, Eye, Edit, Trash2 } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useTouch } from '../../hooks/useTouch';
import { useSwipe } from '../../hooks/useSwipe';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'transfer' | 'fee';
  symbol: string;
  asset: string;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  timestamp: number;
  exchange: string;
  status: 'completed' | 'pending' | 'failed';
  notes?: string;
}

interface ResponsiveTransactionTableProps {
  transactions: Transaction[];
  loading?: boolean;
  error?: string;
  onTransactionClick?: (transaction: Transaction) => void;
  onTransactionEdit?: (transaction: Transaction) => void;
  onTransactionDelete?: (transactionId: string) => void;
  onExport?: () => void;
  showSearch?: boolean;
  showFilters?: boolean;
  enableSwipeActions?: boolean;
  className?: string;
}

type SortField = 'timestamp' | 'symbol' | 'type' | 'quantity' | 'price' | 'total';
type SortDirection = 'asc' | 'desc';

interface FilterState {
  dateRange: { start: Date | null; end: Date | null };
  types: string[];
  symbols: string[];
  exchanges: string[];
  status: string[];
  amountRange: { min: number; max: number };
}

const ResponsiveTransactionTable: React.FC<ResponsiveTransactionTableProps> = ({
  transactions,
  loading = false,
  error,
  onTransactionClick,
  onTransactionEdit,
  onTransactionDelete,
  onExport,
  showSearch = true,
  showFilters = true,
  enableSwipeActions = true,
  className = ''
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedMobileRows, setExpandedMobileRows] = useState<Set<string>>(new Set());
  const [swipeActions, setSwipeActions] = useState<{ [key: string]: boolean }>({});
  
  const [filters, setFilters] = useState<FilterState>({
    dateRange: { start: null, end: null },
    types: [],
    symbols: [],
    exchanges: [],
    status: [],
    amountRange: { min: 0, max: Infinity }
  });

  const { isMobile, isTablet, isSmallMobile } = useResponsive();
  const isTouchDevice = isMobile || isTablet;

  // Touch handlers for swipe actions on mobile
  const createSwipeHandlers = useCallback((transactionId: string) => {
    if (!enableSwipeActions || !isTouchDevice) return {};

    return useSwipe({
      threshold: 50,
      onSwipe: (direction) => {
        if (direction === 'left') {
          setSwipeActions(prev => ({ ...prev, [transactionId]: true }));
        } else if (direction === 'right') {
          setSwipeActions(prev => ({ ...prev, [transactionId]: false }));
        }
      }
    });
  }, [enableSwipeActions, isTouchDevice]);

  // Filter and sort transactions
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = transactions;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx => 
        tx.symbol.toLowerCase().includes(query) ||
        tx.asset.toLowerCase().includes(query) ||
        tx.exchange.toLowerCase().includes(query) ||
        tx.type.toLowerCase().includes(query)
      );
    }

    // Apply filters
    if (filters.types.length > 0) {
      filtered = filtered.filter(tx => filters.types.includes(tx.type));
    }

    if (filters.symbols.length > 0) {
      filtered = filtered.filter(tx => filters.symbols.includes(tx.symbol));
    }

    if (filters.exchanges.length > 0) {
      filtered = filtered.filter(tx => filters.exchanges.includes(tx.exchange));
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(tx => filters.status.includes(tx.status));
    }

    if (filters.dateRange.start) {
      filtered = filtered.filter(tx => tx.timestamp >= (filters.dateRange.start?.getTime() || 0));
    }

    if (filters.dateRange.end) {
      filtered = filtered.filter(tx => tx.timestamp <= (filters.dateRange.end?.getTime() || Infinity));
    }

    filtered = filtered.filter(tx => 
      tx.total >= filters.amountRange.min && 
      tx.total <= filters.amountRange.max
    );

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'timestamp':
          aValue = a.timestamp;
          bValue = b.timestamp;
          break;
        case 'symbol':
          aValue = a.symbol;
          bValue = b.symbol;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'quantity':
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'total':
          aValue = a.total;
          bValue = b.total;
          break;
        default:
          aValue = a.timestamp;
          bValue = b.timestamp;
      }
      
      if (typeof aValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      const comparison = aValue - bValue;
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [transactions, searchQuery, sortField, sortDirection, filters]);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const handleSelectRow = useCallback((transactionId: string) => {
    setSelectedRows(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(transactionId)) {
        newSelected.delete(transactionId);
      } else {
        newSelected.add(transactionId);
      }
      return newSelected;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === filteredAndSortedTransactions.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredAndSortedTransactions.map(tx => tx.id)));
    }
  }, [selectedRows.size, filteredAndSortedTransactions]);

  const toggleMobileRow = useCallback((transactionId: string) => {
    setExpandedMobileRows(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(transactionId)) {
        newExpanded.delete(transactionId);
      } else {
        newExpanded.add(transactionId);
      }
      return newExpanded;
    });
  }, []);

  const getTypeColor = (type: Transaction['type']) => {
    switch (type) {
      case 'buy': return 'text-green-600 bg-green-50';
      case 'sell': return 'text-red-600 bg-red-50';
      case 'transfer': return 'text-blue-600 bg-blue-50';
      case 'fee': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusColor = (status: Transaction['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      case 'failed': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <div className={`responsive-transaction-table loading ${className}`}>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`responsive-transaction-table error ${className}`}>
        <div className="bg-white rounded-xl shadow-sm p-6 text-center">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load transactions</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors touch-target">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Mobile card view
  if (isMobile) {
    return (
      <div className={`responsive-transaction-table mobile ${className}`}>
        {/* Search and filters */}
        {(showSearch || showFilters) && (
          <div className="bg-white rounded-t-xl shadow-sm px-4 py-3 border-b border-gray-200">
            {showSearch && (
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent touch-target"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {showFilters && (
                  <button
                    onClick={() => setShowFilterModal(true)}
                    className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target"
                  >
                    <Filter size={16} />
                    <span className="text-sm font-medium">Filter</span>
                  </button>
                )}

                {onExport && (
                  <button
                    onClick={onExport}
                    className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target"
                  >
                    <Download size={16} />
                    <span className="text-sm font-medium">Export</span>
                  </button>
                )}
              </div>

              <div className="text-sm text-gray-600">
                {filteredAndSortedTransactions.length} of {transactions.length}
              </div>
            </div>
          </div>
        )}

        {/* Transaction list */}
        <div className="bg-white rounded-b-xl shadow-sm">
          {filteredAndSortedTransactions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions found</h3>
              <p className="text-gray-600">
                {searchQuery ? 'Try adjusting your search or filters' : 'No transactions available'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredAndSortedTransactions.map((transaction) => {
                const isExpanded = expandedMobileRows.has(transaction.id);
                const showSwipeActions = swipeActions[transaction.id];
                const swipeHandlers = createSwipeHandlers(transaction.id);

                return (
                  <div
                    key={transaction.id}
                    className="relative overflow-hidden"
                    {...swipeHandlers}
                  >
                    {/* Swipe actions background */}
                    {showSwipeActions && (
                      <div className="absolute inset-0 flex">
                        <div className="flex items-center justify-center w-20 bg-blue-500">
                          <button
                            onClick={() => onTransactionClick?.(transaction)}
                            className="flex flex-col items-center justify-center text-white touch-target"
                          >
                            <Eye size={16} />
                            <span className="text-xs">View</span>
                          </button>
                        </div>
                        <div className="flex ml-auto">
                          {onTransactionEdit && (
                            <div className="flex items-center justify-center w-20 bg-green-500">
                              <button
                                onClick={() => onTransactionEdit(transaction)}
                                className="flex flex-col items-center justify-center text-white touch-target"
                              >
                                <Edit size={16} />
                                <span className="text-xs">Edit</span>
                              </button>
                            </div>
                          )}
                          {onTransactionDelete && (
                            <div className="flex items-center justify-center w-20 bg-red-500">
                              <button
                                onClick={() => onTransactionDelete(transaction.id)}
                                className="flex flex-col items-center justify-center text-white touch-target"
                              >
                                <Trash2 size={16} />
                                <span className="text-xs">Delete</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Transaction card */}
                    <div
                      className={`relative bg-white p-4 transition-transform duration-200 ${
                        showSwipeActions ? 'transform translate-x-4' : ''
                      }`}
                      onClick={() => toggleMobileRow(transaction.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${getTypeColor(transaction.type)}`}>
                            {transaction.type}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {formatNumber(transaction.quantity)} {transaction.symbol}
                              </h4>
                              <div className="text-right">
                                <div className="font-semibold text-gray-900">
                                  {formatCurrency(transaction.total)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  @ {formatCurrency(transaction.price)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm text-gray-600 truncate">
                                {transaction.exchange}
                              </span>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                                  {transaction.status}
                                </span>
                                <ChevronDown 
                                  size={16} 
                                  className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Date:</span>
                              <span className="ml-2 font-medium">{formatDate(transaction.timestamp)}</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Fee:</span>
                              <span className="ml-2 font-medium">{formatCurrency(transaction.fee)}</span>
                            </div>
                          </div>
                          {transaction.notes && (
                            <div className="text-sm">
                              <span className="text-gray-600">Notes:</span>
                              <p className="mt-1 text-gray-900">{transaction.notes}</p>
                            </div>
                          )}
                          
                          {/* Action buttons */}
                          <div className="flex space-x-2 pt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onTransactionClick?.(transaction);
                              }}
                              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold text-sm hover:bg-blue-700 active:bg-blue-800 transition-colors touch-target"
                            >
                              View Details
                            </button>
                            {onTransactionEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onTransactionEdit(transaction);
                                }}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold text-sm hover:bg-gray-50 active:bg-gray-100 transition-colors touch-target"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop table view
  return (
    <div className={`responsive-transaction-table desktop ${className}`}>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header with controls */}
        {(showSearch || showFilters) && (
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
              <div className="flex items-center space-x-3">
                {onExport && (
                  <button
                    onClick={onExport}
                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Download size={16} />
                    <span>Export</span>
                  </button>
                )}
                {selectedRows.size > 0 && (
                  <div className="text-sm text-gray-600">
                    {selectedRows.size} selected
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {showSearch && (
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {showFilters && (
                <button
                  onClick={() => setShowFilterModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Filter size={16} />
                  <span>Filter</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredAndSortedTransactions.length && filteredAndSortedTransactions.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                {[
                  { field: 'timestamp' as SortField, label: 'Date' },
                  { field: 'type' as SortField, label: 'Type' },
                  { field: 'symbol' as SortField, label: 'Asset' },
                  { field: 'quantity' as SortField, label: 'Quantity' },
                  { field: 'price' as SortField, label: 'Price' },
                  { field: 'total' as SortField, label: 'Total' },
                  { field: null, label: 'Status' },
                  { field: null, label: 'Actions' }
                ].map(({ field, label }) => (
                  <th
                    key={label}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      field ? 'cursor-pointer hover:bg-gray-100' : ''
                    }`}
                    onClick={field ? () => handleSort(field) : undefined}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{label}</span>
                      {field && (
                        <ArrowUpDown 
                          size={12} 
                          className={sortField === field ? 'text-blue-600' : 'text-gray-400'}
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedTransactions.map((transaction) => (
                <tr 
                  key={transaction.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onTransactionClick?.(transaction)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(transaction.id)}
                      onChange={() => handleSelectRow(transaction.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(transaction.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${getTypeColor(transaction.type)}`}>
                      {transaction.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{transaction.symbol}</div>
                        <div className="text-sm text-gray-500">{transaction.asset}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(transaction.quantity)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(transaction.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(transaction.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredAndSortedTransactions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No transactions found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try adjusting your search or filters' : 'No transactions available'}
            </p>
          </div>
        )}
      </div>

      {/* Filter Modal (shared between mobile and desktop) */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-96 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Filter Transactions</h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
                <div className="flex space-x-2">
                  <input
                    type="date"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, start: e.target.value ? new Date(e.target.value) : null }
                    }))}
                  />
                  <input
                    type="date"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      dateRange: { ...prev.dateRange, end: e.target.value ? new Date(e.target.value) : null }
                    }))}
                  />
                </div>
              </div>

              {/* Transaction Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Types</label>
                <div className="space-y-2">
                  {['buy', 'sell', 'transfer', 'fee'].map(type => (
                    <label key={type} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.types.includes(type)}
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            types: e.target.checked 
                              ? [...prev.types, type]
                              : prev.types.filter(t => t !== type)
                          }));
                        }}
                        className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className="space-y-2">
                  {['completed', 'pending', 'failed'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            status: e.target.checked 
                              ? [...prev.status, status]
                              : prev.status.filter(s => s !== status)
                          }));
                        }}
                        className="mr-3 w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex space-x-3">
              <button
                onClick={() => {
                  setFilters({
                    dateRange: { start: null, end: null },
                    types: [],
                    symbols: [],
                    exchanges: [],
                    status: [],
                    amountRange: { min: 0, max: Infinity }
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsiveTransactionTable;