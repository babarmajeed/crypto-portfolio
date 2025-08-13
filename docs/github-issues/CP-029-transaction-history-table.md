# CP-029: Advanced Transaction History Table

## Overview
Create a comprehensive transaction history table with advanced filtering, sorting, pagination, and export capabilities to help users track and analyze their trading activity.

## Objectives
- Build feature-rich transaction history table
- Implement advanced filtering and search functionality
- Add sorting, pagination, and virtualization for performance
- Create export functionality for financial records

## Acceptance Criteria
- [ ] Paginated transaction table with virtualization
- [ ] Multi-column sorting capabilities
- [ ] Advanced filtering (date range, type, exchange, asset)
- [ ] Real-time search functionality
- [ ] Transaction type categorization (buy, sell, transfer, etc.)
- [ ] Export to CSV, Excel, and PDF formats
- [ ] Mobile-responsive design with horizontal scrolling
- [ ] Row selection for batch operations
- [ ] Expandable rows for transaction details
- [ ] Performance optimization for 10,000+ transactions

## Technical Implementation

### File Structure
```
src/
  components/
    TransactionHistory/
      TransactionTable.jsx
      TransactionRow.jsx
      TransactionFilters.jsx
      TransactionSearch.jsx
      ExportMenu.jsx
      PaginationControls.jsx
  hooks/
    useTransactionData.js
    useTableVirtualization.js
  utils/
    transactionUtils.js
    exportUtils.js
```

### Core Table Component
```jsx
// TransactionTable.jsx
import React, { useState, useMemo, useCallback } from 'react';
import { FixedSizeList as List } from 'react-window';
import { useTransactionData } from '../hooks/useTransactionData';
import { useTableVirtualization } from '../hooks/useTableVirtualization';
import TransactionRow from './TransactionRow';
import TransactionFilters from './TransactionFilters';
import TransactionSearch from './TransactionSearch';
import ExportMenu from './ExportMenu';
import PaginationControls from './PaginationControls';

const TransactionTable = () => {
  const [filters, setFilters] = useState({
    dateRange: { start: null, end: null },
    type: 'all',
    exchange: 'all',
    asset: 'all',
    minAmount: null,
    maxAmount: null
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({
    key: 'timestamp',
    direction: 'desc'
  });
  
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [expandedRows, setExpandedRows] = useState(new Set());

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

  const handleSort = useCallback((key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleRowSelection = useCallback((transactionId, isSelected) => {
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

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      setSelectedRows(new Set(visibleTransactions.map(t => t.id)));
    } else {
      setSelectedRows(new Set());
    }
  }, [visibleTransactions]);

  const handleRowExpand = useCallback((transactionId) => {
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

  const Row = useCallback(({ index, style }) => {
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
      <div className="transaction-table-error">
        <p>Error loading transactions: {error.message}</p>
        <button onClick={refresh}>Retry</button>
      </div>
    );
  }

  return (
    <div className="transaction-table">
      <div className="table-controls">
        <div className="table-header">
          <h2>Transaction History</h2>
          <div className="header-actions">
            <ExportMenu
              selectedTransactions={Array.from(selectedRows)}
              allTransactions={transactions}
            />
            <button onClick={refresh} className="refresh-btn">
              Refresh
            </button>
          </div>
        </div>

        <div className="filters-section">
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

        <div className="table-info">
          <span>
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
        <div className="table-header-row">
          <div className="checkbox-cell">
            <input
              type="checkbox"
              checked={selectedRows.size === visibleTransactions.length && visibleTransactions.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
          </div>
          {columns.map(column => (
            <div
              key={column.key}
              className={`header-cell ${column.sortable ? 'sortable' : ''}`}
              style={{ width: column.width }}
              onClick={column.sortable ? () => handleSort(column.key) : undefined}
            >
              {column.label}
              {column.sortable && sortConfig.key === column.key && (
                <span className={`sort-indicator ${sortConfig.direction}`}>
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="table-loading">
            <div className="loading-rows">
              {Array.from({ length: 10 }).map((_, index) => (
                <div key={index} className="skeleton-row" />
              ))}
            </div>
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
```

### Transaction Data Hook
```javascript
// useTransactionData.js
import { useState, useEffect, useMemo } from 'react';
import { transactionService } from '../services/TransactionService';
import { debounce } from '../utils/debounce';

export const useTransactionData = (filters, searchTerm, sortConfig) => {
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debounced search to avoid excessive API calls
  const debouncedSearchTerm = useMemo(
    () => debounce(searchTerm, 300),
    [searchTerm]
  );

  useEffect(() => {
    loadTransactions();
  }, [filters, debouncedSearchTerm, sortConfig]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const query = {
        ...filters,
        search: debouncedSearchTerm,
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction,
        limit: 1000 // Load more for client-side operations
      };

      const result = await transactionService.getTransactions(query);
      
      setTransactions(result.transactions);
      setTotalCount(result.totalCount);
    } catch (err) {
      setError(err);
      setTransactions([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = () => {
    loadTransactions();
  };

  return {
    transactions,
    totalCount,
    isLoading,
    error,
    refresh
  };
};
```

### Transaction Row Component
```jsx
// TransactionRow.jsx
import React from 'react';
import { formatCurrency, formatDate, formatQuantity } from '../utils/formatters';
import { getTransactionTypeColor, getStatusBadge } from '../utils/transactionUtils';

const TransactionRow = ({
  transaction,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  columns
}) => {
  const handleCheckboxChange = (e) => {
    onSelect(transaction.id, e.target.checked);
  };

  const handleRowClick = () => {
    onExpand(transaction.id);
  };

  const getColumnValue = (key) => {
    switch (key) {
      case 'timestamp':
        return formatDate(transaction.timestamp);
      case 'type':
        return (
          <span
            className={`transaction-type ${transaction.type}`}
            style={{ color: getTransactionTypeColor(transaction.type) }}
          >
            {transaction.type.toUpperCase()}
          </span>
        );
      case 'asset':
        return (
          <div className="asset-cell">
            <img
              src={transaction.assetIcon}
              alt={transaction.asset}
              className="asset-icon"
            />
            {transaction.asset}
          </div>
        );
      case 'quantity':
        return formatQuantity(transaction.quantity, transaction.asset);
      case 'price':
        return formatCurrency(transaction.price);
      case 'total':
        return formatCurrency(transaction.total);
      case 'fee':
        return formatCurrency(transaction.fee || 0);
      case 'exchange':
        return (
          <div className="exchange-cell">
            <img
              src={transaction.exchangeIcon}
              alt={transaction.exchange}
              className="exchange-icon"
            />
            {transaction.exchange}
          </div>
        );
      case 'status':
        return getStatusBadge(transaction.status);
      case 'actions':
        return (
          <div className="actions-cell">
            <button
              className="action-btn"
              onClick={(e) => {
                e.stopPropagation();
                // Handle view details
              }}
            >
              View
            </button>
          </div>
        );
      default:
        return transaction[key];
    }
  };

  return (
    <div className={`transaction-row ${isExpanded ? 'expanded' : ''}`}>
      <div className="row-main" onClick={handleRowClick}>
        <div className="checkbox-cell">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        
        {columns.map(column => (
          <div
            key={column.key}
            className={`cell ${column.key}-cell`}
            style={{ width: column.width }}
          >
            {getColumnValue(column.key)}
          </div>
        ))}
        
        <div className="expand-indicator">
          {isExpanded ? '−' : '+'}
        </div>
      </div>

      {isExpanded && (
        <div className="row-details">
          <div className="details-content">
            <div className="detail-group">
              <h4>Transaction Details</h4>
              <div className="detail-row">
                <span>Transaction ID:</span>
                <span>{transaction.id}</span>
              </div>
              <div className="detail-row">
                <span>Order ID:</span>
                <span>{transaction.orderId || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span>Trade ID:</span>
                <span>{transaction.tradeId || 'N/A'}</span>
              </div>
            </div>

            <div className="detail-group">
              <h4>Financial Details</h4>
              <div className="detail-row">
                <span>Fee Rate:</span>
                <span>{transaction.feeRate ? `${transaction.feeRate}%` : 'N/A'}</span>
              </div>
              <div className="detail-row">
                <span>Fee Currency:</span>
                <span>{transaction.feeCurrency || transaction.asset}</span>
              </div>
              <div className="detail-row">
                <span>Net Amount:</span>
                <span>{formatCurrency(transaction.total - (transaction.fee || 0))}</span>
              </div>
            </div>

            {transaction.notes && (
              <div className="detail-group">
                <h4>Notes</h4>
                <p>{transaction.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionRow;
```

### Advanced Filters Component
```jsx
// TransactionFilters.jsx
import React from 'react';
import DatePicker from 'react-datepicker';
import Select from 'react-select';

const TransactionFilters = ({ filters, onChange }) => {
  const transactionTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'buy', label: 'Buy' },
    { value: 'sell', label: 'Sell' },
    { value: 'transfer_in', label: 'Transfer In' },
    { value: 'transfer_out', label: 'Transfer Out' },
    { value: 'deposit', label: 'Deposit' },
    { value: 'withdrawal', label: 'Withdrawal' }
  ];

  const exchanges = [
    { value: 'all', label: 'All Exchanges' },
    { value: 'binance', label: 'Binance' },
    { value: 'coinbase', label: 'Coinbase' },
    { value: 'kraken', label: 'Kraken' }
  ];

  const handleFilterChange = (key, value) => {
    onChange({
      ...filters,
      [key]: value
    });
  };

  const handleDateRangeChange = (start, end) => {
    onChange({
      ...filters,
      dateRange: { start, end }
    });
  };

  return (
    <div className="transaction-filters">
      <div className="filter-group">
        <label>Date Range</label>
        <div className="date-range-picker">
          <DatePicker
            selected={filters.dateRange.start}
            onChange={(date) => handleDateRangeChange(date, filters.dateRange.end)}
            selectsStart
            startDate={filters.dateRange.start}
            endDate={filters.dateRange.end}
            placeholderText="Start date"
            className="date-input"
          />
          <DatePicker
            selected={filters.dateRange.end}
            onChange={(date) => handleDateRangeChange(filters.dateRange.start, date)}
            selectsEnd
            startDate={filters.dateRange.start}
            endDate={filters.dateRange.end}
            minDate={filters.dateRange.start}
            placeholderText="End date"
            className="date-input"
          />
        </div>
      </div>

      <div className="filter-group">
        <label>Transaction Type</label>
        <Select
          value={transactionTypes.find(t => t.value === filters.type)}
          onChange={(option) => handleFilterChange('type', option.value)}
          options={transactionTypes}
          className="filter-select"
        />
      </div>

      <div className="filter-group">
        <label>Exchange</label>
        <Select
          value={exchanges.find(e => e.value === filters.exchange)}
          onChange={(option) => handleFilterChange('exchange', option.value)}
          options={exchanges}
          className="filter-select"
        />
      </div>

      <div className="filter-group">
        <label>Amount Range</label>
        <div className="amount-range">
          <input
            type="number"
            placeholder="Min amount"
            value={filters.minAmount || ''}
            onChange={(e) => handleFilterChange('minAmount', e.target.value ? parseFloat(e.target.value) : null)}
            className="amount-input"
          />
          <input
            type="number"
            placeholder="Max amount"
            value={filters.maxAmount || ''}
            onChange={(e) => handleFilterChange('maxAmount', e.target.value ? parseFloat(e.target.value) : null)}
            className="amount-input"
          />
        </div>
      </div>

      <div className="filter-actions">
        <button
          onClick={() => onChange({
            dateRange: { start: null, end: null },
            type: 'all',
            exchange: 'all',
            asset: 'all',
            minAmount: null,
            maxAmount: null
          })}
          className="clear-filters-btn"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
};

export default TransactionFilters;
```

## Testing Requirements
- Component rendering tests with large datasets
- Filter and search functionality testing
- Virtual scrolling performance testing
- Export functionality testing
- Mobile responsiveness testing

## Dependencies
- Depends on: CP-006 (Transaction Management)
- Depends on: CP-004 (Portfolio Management)
- Blocks: CP-032 (Settings and Preferences)

## Time Estimate
**Beginner**: 7-8 days
**Intermediate**: 4-5 days
**Advanced**: 3-4 days

## Required Skills
- React and advanced component patterns
- Virtual scrolling and performance optimization
- Advanced filtering and search algorithms
- Data export functionality
- Responsive table design