import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

interface Transaction {
  id: string;
  timestamp: Date;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'deposit' | 'withdrawal';
  asset: string;
  assetIcon?: string;
  quantity: number;
  price: number;
  total: number;
  fee?: number;
  feeCurrency?: string;
  feeRate?: number;
  exchange: string;
  exchangeIcon?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  orderId?: string;
  tradeId?: string;
  txHash?: string;
  notes?: string;
}

interface TransactionRowProps {
  transaction: Transaction;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string, isSelected: boolean) => void;
  onExpand: (id: string) => void;
  columns: Array<{ key: string; label: string; width: number }>;
}

const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  isSelected,
  isExpanded,
  onSelect,
  onExpand,
  columns
}) => {
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect(transaction.id, e.target.checked);
  };

  const handleRowClick = () => {
    onExpand(transaction.id);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'buy':
        return 'text-green-600 bg-green-50';
      case 'sell':
        return 'text-red-600 bg-red-50';
      case 'transfer_in':
      case 'deposit':
        return 'text-blue-600 bg-blue-50';
      case 'transfer_out':
      case 'withdrawal':
        return 'text-orange-600 bg-orange-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status as keyof typeof colors]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatQuantity = (quantity: number, asset: string) => {
    const formatted = quantity < 0.01 
      ? quantity.toExponential(4) 
      : quantity.toLocaleString(undefined, { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 8 
        });
    return `${formatted} ${asset}`;
  };

  const getColumnValue = (key: string) => {
    switch (key) {
      case 'timestamp':
        return (
          <div className="text-sm">
            <div>{format(new Date(transaction.timestamp), 'MMM dd, yyyy')}</div>
            <div className="text-gray-500 text-xs">{format(new Date(transaction.timestamp), 'HH:mm:ss')}</div>
          </div>
        );
      case 'type':
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded ${getTypeColor(transaction.type)}`}>
            {transaction.type.replace('_', ' ').toUpperCase()}
          </span>
        );
      case 'asset':
        return (
          <div className="flex items-center gap-2">
            {transaction.assetIcon && (
              <img
                src={transaction.assetIcon}
                alt={transaction.asset}
                className="w-6 h-6 rounded-full"
              />
            )}
            <span className="font-medium">{transaction.asset}</span>
          </div>
        );
      case 'quantity':
        return (
          <div className="text-sm">
            {formatQuantity(transaction.quantity, transaction.asset)}
          </div>
        );
      case 'price':
        return <div className="text-sm">{formatCurrency(transaction.price)}</div>;
      case 'total':
        return (
          <div className="text-sm font-medium">
            {formatCurrency(transaction.total)}
          </div>
        );
      case 'fee':
        return (
          <div className="text-sm text-gray-600">
            {transaction.fee ? formatCurrency(transaction.fee) : '-'}
          </div>
        );
      case 'exchange':
        return (
          <div className="flex items-center gap-2">
            {transaction.exchangeIcon && (
              <img
                src={transaction.exchangeIcon}
                alt={transaction.exchange}
                className="w-5 h-5"
              />
            )}
            <span className="text-sm capitalize">{transaction.exchange}</span>
          </div>
        );
      case 'status':
        return getStatusBadge(transaction.status);
      case 'actions':
        return (
          <button
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            onClick={(e) => {
              e.stopPropagation();
              // Handle view details
            }}
          >
            View
          </button>
        );
      default:
        return transaction[key as keyof Transaction];
    }
  };

  return (
    <>
      <div 
        className={`flex items-center border-b hover:bg-gray-50 cursor-pointer transition-colors ${
          isSelected ? 'bg-blue-50' : ''
        }`}
        onClick={handleRowClick}
      >
        <div className="w-12 p-3 flex items-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
        
        {columns.map(column => (
          <div
            key={column.key}
            className="p-3"
            style={{ width: column.width }}
          >
            {getColumnValue(column.key)}
          </div>
        ))}
        
        <div className="p-3 text-gray-400">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="bg-gray-50 border-b">
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Transaction Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-mono text-xs">{transaction.id}</span>
                </div>
                {transaction.orderId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Order ID:</span>
                    <span className="font-mono text-xs">{transaction.orderId}</span>
                  </div>
                )}
                {transaction.tradeId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trade ID:</span>
                    <span className="font-mono text-xs">{transaction.tradeId}</span>
                  </div>
                )}
                {transaction.txHash && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">TX Hash:</span>
                    <a 
                      href={`https://etherscan.io/tx/${transaction.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                    >
                      <span className="font-mono text-xs">{transaction.txHash.slice(0, 8)}...</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Financial Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{formatCurrency(transaction.total - (transaction.fee || 0))}</span>
                </div>
                {transaction.fee && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Fee:</span>
                      <span>{formatCurrency(transaction.fee)}</span>
                    </div>
                    {transaction.feeRate && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fee Rate:</span>
                        <span>{transaction.feeRate}%</span>
                      </div>
                    )}
                    {transaction.feeCurrency && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Fee Currency:</span>
                        <span>{transaction.feeCurrency}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span className="text-gray-900">Total:</span>
                  <span>{formatCurrency(transaction.total)}</span>
                </div>
              </div>
            </div>

            {transaction.notes && (
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900">Notes</h4>
                <p className="text-sm text-gray-600">{transaction.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default TransactionRow;