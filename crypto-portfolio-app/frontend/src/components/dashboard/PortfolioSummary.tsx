import React from 'react';
import { formatCurrency, formatPercentage } from '../../utils/formatters';
import { useMobileResponsive } from '../../hooks/useMobileResponsive';
import { TouchCard } from '../ui/TouchCard';

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
  const { isMobile, isTablet } = useMobileResponsive();
  
  if (!data) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="h-12 bg-gray-200 rounded mb-6"></div>
        <div className={`grid gap-4 ${
          isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3'
        }`}>
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
      {/* Main Portfolio Value - Mobile Optimized */}
      <div className={`mb-4 sm:mb-6 ${isMobile ? 'text-center' : ''}`}>
        <h2 className={`font-semibold text-gray-900 mb-2 ${
          isMobile ? 'text-lg' : 'text-xl'
        }`}>Total Portfolio Value</h2>
        
        <div className={`${
          isMobile 
            ? 'space-y-2' 
            : 'flex items-end gap-4'
        } mb-4`}>
          <div className={`font-bold text-gray-900 ${
            isMobile ? 'text-3xl' : 'text-4xl'
          }`}>
            {formatCurrency(totalValue)}
          </div>
          
          <div className={`flex items-center gap-1 ${changeClass} font-medium ${
            isMobile ? 'justify-center text-base' : 'text-lg'
          }`}>
            <span className={isMobile ? 'text-xl' : 'text-2xl'}>{changeIcon}</span>
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

      {/* Portfolio Statistics - Responsive Grid */}
      <div className={`grid gap-4 sm:gap-6 mb-6 ${
        isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3'
      }`}>
        <TouchCard>
          <div className={`p-4 bg-gray-50 rounded-lg ${
            isMobile ? 'text-center' : 'text-center'
          }`}>
            <div className={`font-bold text-gray-900 mb-1 ${
              isMobile ? 'text-xl' : 'text-2xl'
            }`}>
              {totalAssets.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Assets</div>
          </div>
        </TouchCard>
        
        <TouchCard>
          <div className={`p-4 bg-gray-50 rounded-lg ${
            isMobile ? 'text-center' : 'text-center'
          }`}>
            <div className={`font-bold text-gray-900 mb-1 ${
              isMobile ? 'text-xl' : 'text-2xl'
            }`}>
              {connectedExchanges}
            </div>
            <div className="text-sm text-gray-500">Connected Exchanges</div>
          </div>
        </TouchCard>
        
        <TouchCard className={isMobile ? '' : 'md:col-span-1'}>
          <div className={`p-4 bg-gray-50 rounded-lg ${
            isMobile ? 'text-center' : 'text-center'
          }`}>
            <div className={`font-medium text-gray-900 mb-1 ${
              isMobile ? 'text-base' : 'text-sm'
            }`}>
              {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
            </div>
            <div className="text-sm text-gray-500">Last Updated</div>
          </div>
        </TouchCard>
      </div>

      {/* 24h Performance Progress Bar */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-600">24h Performance</span>
          <span className={`text-sm font-bold ${changeClass}`}>
            {formatPercentage(totalValueChangePercentage24h)}
          </span>
        </div>
        <div className="relative">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className={`h-3 rounded-full transition-all duration-500 ease-out ${
                isPositive ? 'bg-green-500' : 'bg-red-500'
              }`}
              style={{ 
                width: `${Math.min(Math.abs(totalValueChangePercentage24h) * 2, 100)}%` 
              }}
            ></div>
          </div>
          {/* Performance indicator dot */}
          <div 
            className={`absolute top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full ${
              isPositive ? 'bg-green-700' : 'bg-red-700'
            }`}
            style={{
              left: `${Math.min(Math.abs(totalValueChangePercentage24h) * 2, 96)}%`
            }}
          ></div>
        </div>
      </div>

      {/* Value Breakdown - Mobile Optimized */}
      {!isMobile && (
        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Value Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Previous Value:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(totalValue24hAgo)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Current Value:</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(totalValue)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Absolute Change:</span>
              <span className={`font-medium ${changeClass}`}>
                {isPositive ? '+' : ''}{formatCurrency(totalValueChange24h)}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Percentage Change:</span>
              <span className={`font-medium ${changeClass}`}>
                {isPositive ? '+' : ''}{formatPercentage(totalValueChangePercentage24h)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Sync Status Indicator */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">Sync Status</span>
        <TouchCard>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-600 font-medium">Live</span>
          </div>
        </TouchCard>
      </div>
    </div>
  );
};