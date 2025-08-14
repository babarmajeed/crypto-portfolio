import React, { useState } from 'react';
import { formatPercentage, formatCurrency } from '../../utils/formatters';

type TimePeriod = '24h' | '7d' | '30d' | '1y';

interface PerformanceData {
  '24h': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
  '7d': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
  '30d': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
  '1y': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
}

interface PerformanceMetricsProps {
  data: PerformanceData | null;
}

export const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ data }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('24h');
  
  if (!data) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="flex gap-2 mb-6">
          <div className="h-8 w-12 bg-gray-200 rounded"></div>
          <div className="h-8 w-12 bg-gray-200 rounded"></div>
          <div className="h-8 w-12 bg-gray-200 rounded"></div>
          <div className="h-8 w-12 bg-gray-200 rounded"></div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const periods: TimePeriod[] = ['24h', '7d', '30d', '1y'];
  const currentData = data[selectedPeriod];

  return (
    <div className="performance-metrics">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Performance</h3>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {periods.map(period => (
            <button
              key={period}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                selectedPeriod === period
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setSelectedPeriod(period)}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Profit/Loss Card */}
        <div className="bg-gray-50 rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Profit/Loss</span>
            <div className="flex items-center gap-1">
              {currentData.pnl >= 0 ? (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
              )}
            </div>
          </div>
          <div className={`text-2xl font-bold mb-1 ${
            currentData.pnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {currentData.pnl >= 0 ? '+' : ''}{formatCurrency(currentData.pnl)}
          </div>
          <div className={`text-sm ${
            currentData.pnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatPercentage(currentData.pnlPercentage)}
          </div>
        </div>

        {/* Best Performer Card */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Best Performer</span>
            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </div>
          <div className="text-xl font-bold text-gray-900 mb-1">
            {currentData.bestPerformer.symbol}
          </div>
          <div className="text-sm text-green-600 font-medium">
            +{formatPercentage(currentData.bestPerformer.change)}
          </div>
        </div>

        {/* Worst Performer Card */}
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Worst Performer</span>
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="text-xl font-bold text-gray-900 mb-1">
            {currentData.worstPerformer.symbol}
          </div>
          <div className="text-sm text-red-600 font-medium">
            {formatPercentage(currentData.worstPerformer.change)}
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Period Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Period:</span>
            <span className="ml-2 font-medium text-gray-900">
              {selectedPeriod === '24h' ? 'Last 24 hours' :
               selectedPeriod === '7d' ? 'Last 7 days' :
               selectedPeriod === '30d' ? 'Last 30 days' :
               'Last year'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Total Change:</span>
            <span className={`ml-2 font-medium ${
              currentData.pnl >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercentage(currentData.pnlPercentage)}
            </span>
          </div>
        </div>
      </div>

      {/* Performance Indicator */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">Portfolio Performance</span>
          <span className={`text-xs font-medium ${
            currentData.pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {currentData.pnlPercentage >= 0 ? 'Outperforming' : 'Underperforming'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all duration-500 ${
              currentData.pnlPercentage >= 0 ? 'bg-green-500' : 'bg-red-500'
            }`}
            style={{ 
              width: `${Math.min(Math.abs(currentData.pnlPercentage) * 2, 100)}%` 
            }}
          ></div>
        </div>
      </div>
    </div>
  );
};