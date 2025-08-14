import React from 'react';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface PortfolioData {
  totalValue: number;
  totalValue24hAgo: number;
  totalValueChange24h: number;
  totalValueChangePercentage24h: number;
  totalAssets: number;
  connectedExchanges: number;
  lastUpdated: string;
}

interface PortfolioSummaryProps {
  data: PortfolioData | null;
}

export const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="h-12 bg-gray-200 rounded mb-6"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const {
    totalValue,
    totalValue24hAgo,
    totalValueChange24h,
    totalValueChangePercentage24h,
    totalAssets,
    connectedExchanges,
    lastUpdated
  } = data;

  const isPositive = totalValueChange24h >= 0;
  const changeClass = isPositive ? 'text-green-600' : 'text-red-600';
  const changeIcon = isPositive ? '↗' : '↘';

  return (
    <div className="portfolio-summary">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Total Portfolio Value</h2>
        <div className="flex items-end gap-4 mb-4">
          <div className="text-4xl font-bold text-gray-900">
            {formatCurrency(totalValue)}
          </div>
          <div className={`flex items-center gap-1 ${changeClass} text-lg font-medium`}>
            <span className="text-2xl">{changeIcon}</span>
            <span>
              {isPositive ? '+' : ''}{formatCurrency(Math.abs(totalValueChange24h))}
            </span>
            <span className="text-sm">
              ({isPositive ? '+' : ''}{formatPercentage(totalValueChangePercentage24h)})
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500">24h change</p>
      </div>

      {/* Portfolio Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {totalAssets.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Total Assets</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {connectedExchanges}
          </div>
          <div className="text-sm text-gray-500">Connected Exchanges</div>
        </div>
        
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900 mb-1">
            {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
          </div>
          <div className="text-sm text-gray-500">Last Updated</div>
        </div>
      </div>

      {/* Progress Bar for 24h Performance */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">24h Performance</span>
          <span className={`text-sm font-medium ${changeClass}`}>
            {formatPercentage(totalValueChangePercentage24h)}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              isPositive ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ 
              width: `${Math.min(Math.abs(totalValueChangePercentage24h) * 2, 100)}%` 
            }}
          ></div>
        </div>
      </div>

      {/* Value Breakdown */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Value Breakdown</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Previous Value:</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(totalValue24hAgo)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Current Value:</span>
            <span className="font-medium text-gray-900">
              {formatCurrency(totalValue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Absolute Change:</span>
            <span className={`font-medium ${changeClass}`}>
              {isPositive ? '+' : ''}{formatCurrency(totalValueChange24h)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Percentage Change:</span>
            <span className={`font-medium ${changeClass}`}>
              {isPositive ? '+' : ''}{formatPercentage(totalValueChangePercentage24h)}
            </span>
          </div>
        </div>
      </div>

      {/* Sync Status Indicator */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Sync Status</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600 font-medium">Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};