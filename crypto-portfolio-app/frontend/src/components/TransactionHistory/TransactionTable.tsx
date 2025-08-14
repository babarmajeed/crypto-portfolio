import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useTransactionData } from '../../hooks/useTransactionData';
import { useTableVirtualization } from '../../hooks/useTableVirtualization';
import TransactionRow from './TransactionRow';
import TransactionFilters from './TransactionFilters';
import TransactionSearch from './TransactionSearch';
import ExportMenu from './ExportMenu';
import PaginationControls from './PaginationControls';
import { ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface FilterConfig {
  dateRange: { start: Date | null; end: Date | null };
  type: string;
  exchange: string;
  asset: string;
  minAmount: number | null;
  maxAmount: number | null;
}

const TransactionTable: React.FC = () => {
  const [filters, setFilters] = useState<FilterConfig>({
    dateRange: { start: null, end: null },
    type: 'all',
    exchange: 'all',
    asset: 'all',
    minAmount: null,
    maxAmount: null
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'timestamp',
    direction: 'desc'
  });
  
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const {
    transactions,
    totalCount,
    isLoading,
    error,
    refresh
  } = useTransactionData(filters, searchTerm, sortConfig);

  const {
    visibleTransactions,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    setItemsPerPage
  } = useTableVirtualization(transactions, 50);

  const columns = [
    { key: 'timestamp', label: 'Date', sortable: true, width: 120 },
    { key: 'type', label: 'Type', sortable: true, width: 80 },
    { key: 'asset', label: 'Asset', sortable: true, width: 100 },
    { key: 'quantity', label: 'Quantity', sortable: true, width: 120 },
    { key: 'price', label: 'Price', sortable: true, width: 100 },
    { key: 'total', label: 'Total', sortable: true, width: 120 },
    { key: 'fee', label: 'Fee', sortable: true, width: 80 },
    { key: 'exchange', label: 'Exchange', sortable: true, width: 100 },
    { key: 'status', label: 'Status', sortable: true, width: 80 },
    { key: 'actions', label: 'Actions', sortable: false, width: 100 }
  ];

  const handleSort = useCallback((key: string) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleRowSelection = useCallback((transactionId: string, isSelected: boolean) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(transactionId);
      } else {
        newSet.delete(transactionId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((isSelected: boolean) => {
    if (isSelected) {
      setSelectedRows(new Set(visibleTransactions.map(t => t.id)));
    } else {
      setSelectedRows(new Set());
    }
  }, [visibleTransactions]);

  const handleRowExpand = useCallback((transactionId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  }, []);

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const transaction = visibleTransactions[index];
    return (
      <div style={style}>
        <TransactionRow
          transaction={transaction}
          isSelected={selectedRows.has(transaction.id)}
          isExpanded={expandedRows.has(transaction.id)}
          onSelect={handleRowSelection}
          onExpand={handleRowExpand}
          columns={columns}
        />
      </div>
    );
  }, [visibleTransactions, selectedRows, expandedRows, handleRowSelection, handleRowExpand, columns]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-red-50 rounded-lg border border-red-200">
        <p className="text-red-600 mb-4">Error loading transactions: {error.message}</p>
        <button 
          onClick={refresh}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="transaction-table bg-white rounded-lg shadow-lg">
      <div className="table-controls p-6 border-b">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Transaction History</h2>
          <div className="flex gap-2">
            <ExportMenu
              selectedTransactions={Array.from(selectedRows)}
              allTransactions={transactions}
            />
            <button 
              onClick={refresh} 
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <TransactionSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search transactions..."
          />
          <TransactionFilters
            filters={filters}
            onChange={setFilters}
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {selectedRows.size > 0 && `${selectedRows.size} selected • `}
            {totalCount.toLocaleString()} total transactions
          </span>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </div>
      </div>

      <div className="table-container">
        <div className="flex items-center bg-gray-50 border-b font-medium text-sm text-gray-700">
          <div className="w-12 p-3">
            <input
              type="checkbox"
              checked={selectedRows.size === visibleTransactions.length && visibleTransactions.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
          {columns.map(column => (
            <div
              key={column.key}
              className={`flex items-center gap-1 p-3 ${column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''}`}
              style={{ width: column.width }}
              onClick={column.sortable ? () => handleSort(column.key) : undefined}
            >
              {column.label}
              {column.sortable && sortConfig.key === column.key && (
                <span className="text-blue-600">
                  {sortConfig.direction === 'asc' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              )}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8">
            <div className="space-y-3">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="h-12 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        ) : visibleTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <p className="text-lg font-medium">No transactions found</p>
            <p className="text-sm mt-2">Try adjusting your filters or search criteria</p>
          </div>
        ) : (
          <List
            height={600}
            itemCount={visibleTransactions.length}
            itemSize={60}
            className="transaction-list"
          >
            {Row}
          </List>
        )}
      </div>
    </div>
  );
};

export default TransactionTable;