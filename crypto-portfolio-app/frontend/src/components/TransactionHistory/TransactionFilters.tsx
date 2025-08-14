import React from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { format } from 'date-fns';

interface FilterConfig {
  dateRange: { start: Date | null; end: Date | null };
  type: string;
  exchange: string;
  asset: string;
  minAmount: number | null;
  maxAmount: number | null;
}

interface TransactionFiltersProps {
  filters: FilterConfig;
  onChange: (filters: FilterConfig) => void;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({ filters, onChange }) => {
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
    { value: 'kraken', label: 'Kraken' },
    { value: 'kucoin', label: 'KuCoin' }
  ];

  const handleFilterChange = (key: keyof FilterConfig, value: any) => {
    onChange({
      ...filters,
      [key]: value
    });
  };

  const handleDateRangeChange = (type: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : null;
    onChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [type]: date
      }
    });
  };

  const clearFilters = () => {
    onChange({
      dateRange: { start: null, end: null },
      type: 'all',
      exchange: 'all',
      asset: 'all',
      minAmount: null,
      maxAmount: null
    });
  };

  const hasActiveFilters = 
    filters.dateRange.start !== null ||
    filters.dateRange.end !== null ||
    filters.type !== 'all' ||
    filters.exchange !== 'all' ||
    filters.asset !== 'all' ||
    filters.minAmount !== null ||
    filters.maxAmount !== null;

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Date Range */}
      <div className="flex gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">From Date</label>
          <div className="relative">
            <input
              type="date"
              value={filters.dateRange.start ? format(filters.dateRange.start, 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Start date"
            />
            <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">To Date</label>
          <div className="relative">
            <input
              type="date"
              value={filters.dateRange.end ? format(filters.dateRange.end, 'yyyy-MM-dd') : ''}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              min={filters.dateRange.start ? format(filters.dateRange.start, 'yyyy-MM-dd') : undefined}
              className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="End date"
            />
            <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Transaction Type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
        <select
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {transactionTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Exchange */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Exchange</label>
        <select
          value={filters.exchange}
          onChange={(e) => handleFilterChange('exchange', e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {exchanges.map(exchange => (
            <option key={exchange.value} value={exchange.value}>
              {exchange.label}
            </option>
          ))}
        </select>
      </div>

      {/* Asset */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Asset</label>
        <input
          type="text"
          value={filters.asset === 'all' ? '' : filters.asset}
          onChange={(e) => handleFilterChange('asset', e.target.value || 'all')}
          placeholder="BTC, ETH..."
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
        />
      </div>

      {/* Amount Range */}
      <div className="flex gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Min Amount</label>
          <input
            type="number"
            value={filters.minAmount || ''}
            onChange={(e) => handleFilterChange('minAmount', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="0.00"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
            min="0"
            step="0.01"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Amount</label>
          <input
            type="number"
            value={filters.maxAmount || ''}
            onChange={(e) => handleFilterChange('maxAmount', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="0.00"
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-32"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}

      <div className="flex items-center gap-1 text-gray-500">
        <Filter className="w-4 h-4" />
      </div>
    </div>
  );
};

export default TransactionFilters;