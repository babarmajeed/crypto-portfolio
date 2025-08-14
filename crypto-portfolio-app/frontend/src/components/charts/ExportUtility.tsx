import React, { useState } from 'react';
import { Download, FileText, Image, BarChart3, Table, X } from 'lucide-react';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CorrelationPair {
  asset1: string;
  asset2: string;
  correlation: number;
  strength: string;
  direction: string;
  significance: number;
}

interface ExportUtilityProps {
  multiAssetData: Record<string, CandlestickData[]>;
  selectedAssets: string[];
  correlationMatrix: Record<string, Record<string, number>>;
  pairCorrelations: CorrelationPair[];
  onClose: () => void;
  chartMode: 'overlay' | 'sideBySide' | 'percentage' | 'normalized';
}

interface ExportFormat {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  fileExtension: string;
}

const ExportUtility: React.FC<ExportUtilityProps> = ({
  multiAssetData,
  selectedAssets,
  correlationMatrix,
  pairCorrelations,
  onClose,
  chartMode
}) => {
  const [selectedFormat, setSelectedFormat] = useState<string>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [includeCorrelations, setIncludeCorrelations] = useState(true);
  const [includeStatistics, setIncludeStatistics] = useState(true);
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');

  const exportFormats: ExportFormat[] = [
    {
      id: 'csv',
      name: 'CSV',
      description: 'Comma-separated values for spreadsheets',
      icon: <Table className="w-4 h-4" />,
      fileExtension: '.csv'
    },
    {
      id: 'json',
      name: 'JSON',
      description: 'JavaScript Object Notation for data processing',
      icon: <FileText className="w-4 h-4" />,
      fileExtension: '.json'
    },
    {
      id: 'png',
      name: 'PNG Image',
      description: 'High-resolution chart image',
      icon: <Image className="w-4 h-4" />,
      fileExtension: '.png'
    },
    {
      id: 'pdf',
      name: 'PDF Report',
      description: 'Comprehensive analysis report',
      icon: <FileText className="w-4 h-4" />,
      fileExtension: '.pdf'
    }
  ];

  // Filter data by date range
  const getFilteredData = () => {
    if (dateRange === 'all') return multiAssetData;

    const now = Date.now() / 1000;
    const daysBack = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    }[dateRange] || 0;
    
    const cutoffTime = now - (daysBack * 24 * 60 * 60);

    const filtered: Record<string, CandlestickData[]> = {};
    Object.entries(multiAssetData).forEach(([asset, data]) => {
      filtered[asset] = data.filter(candle => candle.time >= cutoffTime);
    });

    return filtered;
  };

  // Export as CSV
  const exportToCSV = () => {
    const filteredData = getFilteredData();
    let csvContent = '';

    if (selectedAssets.length === 1) {
      // Single asset export
      const asset = selectedAssets[0];
      const data = filteredData[asset] || [];
      
      csvContent = 'Timestamp,Date,Open,High,Low,Close,Volume\n';
      data.forEach(candle => {
        const date = new Date(candle.time * 1000).toISOString();
        csvContent += `${candle.time},${date},${candle.open},${candle.high},${candle.low},${candle.close},${candle.volume || ''}\n`;
      });
    } else {
      // Multi-asset comparison export
      const allTimestamps = new Set<number>();
      selectedAssets.forEach(asset => {
        const data = filteredData[asset] || [];
        data.forEach(candle => allTimestamps.add(candle.time));
      });

      const sortedTimestamps = Array.from(allTimestamps).sort();
      
      // Header
      csvContent = 'Timestamp,Date';
      selectedAssets.forEach(asset => {
        csvContent += `,${asset}_Open,${asset}_High,${asset}_Low,${asset}_Close,${asset}_Volume`;
      });
      csvContent += '\n';

      // Data rows
      sortedTimestamps.forEach(timestamp => {
        const date = new Date(timestamp * 1000).toISOString();
        csvContent += `${timestamp},${date}`;
        
        selectedAssets.forEach(asset => {
          const data = filteredData[asset] || [];
          const candle = data.find(c => c.time === timestamp);
          if (candle) {
            csvContent += `,${candle.open},${candle.high},${candle.low},${candle.close},${candle.volume || ''}`;
          } else {
            csvContent += ',,,,';
          }
        });
        csvContent += '\n';
      });
    }

    // Add correlation data if requested
    if (includeCorrelations && selectedAssets.length > 1) {
      csvContent += '\n\nCorrelation Matrix\n';
      csvContent += 'Asset,' + selectedAssets.join(',') + '\n';
      
      selectedAssets.forEach(asset1 => {
        csvContent += asset1;
        selectedAssets.forEach(asset2 => {
          const correlation = correlationMatrix[asset1]?.[asset2] || 0;
          csvContent += `,${correlation.toFixed(4)}`;
        });
        csvContent += '\n';
      });
    }

    // Add statistical summary if requested
    if (includeStatistics) {
      csvContent += '\n\nAsset Statistics\n';
      csvContent += 'Asset,Mean_Return,Volatility,Sharpe_Ratio,Max_Drawdown\n';
      
      selectedAssets.forEach(asset => {
        const data = filteredData[asset] || [];
        if (data.length > 1) {
          const returns = calculateReturns(data);
          const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const volatility = calculateVolatility(returns, meanReturn);
          const sharpeRatio = volatility > 0 ? (meanReturn * 252 - 0.02) / (volatility * Math.sqrt(252)) : 0;
          const maxDrawdown = calculateMaxDrawdown(data);
          
          csvContent += `${asset},${meanReturn.toFixed(6)},${volatility.toFixed(6)},${sharpeRatio.toFixed(4)},${maxDrawdown.toFixed(4)}\n`;
        }
      });
    }

    return csvContent;
  };

  // Export as JSON
  const exportToJSON = () => {
    const filteredData = getFilteredData();
    
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        assets: selectedAssets,
        chartMode,
        dateRange,
        totalDataPoints: Object.values(filteredData).reduce((sum, data) => sum + data.length, 0)
      },
      priceData: filteredData,
      ...(includeCorrelations && selectedAssets.length > 1 && {
        correlations: {
          matrix: correlationMatrix,
          pairs: pairCorrelations
        }
      }),
      ...(includeStatistics && {
        statistics: selectedAssets.map(asset => {
          const data = filteredData[asset] || [];
          if (data.length < 2) return { asset, error: 'Insufficient data' };
          
          const returns = calculateReturns(data);
          const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
          const volatility = calculateVolatility(returns, meanReturn);
          
          return {
            asset,
            meanReturn,
            volatility,
            sharpeRatio: volatility > 0 ? (meanReturn * 252 - 0.02) / (volatility * Math.sqrt(252)) : 0,
            maxDrawdown: calculateMaxDrawdown(data),
            totalReturns: (data[data.length - 1].close - data[0].close) / data[0].close,
            dataPoints: data.length
          };
        })
      })
    };

    return JSON.stringify(exportData, null, 2);
  };

  // Helper functions
  const calculateReturns = (data: CandlestickData[]): number[] => {
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prevPrice = data[i - 1].close;
      const currentPrice = data[i].close;
      returns.push((currentPrice - prevPrice) / prevPrice);
    }
    return returns;
  };

  const calculateVolatility = (returns: number[], mean: number): number => {
    if (returns.length < 2) return 0;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance);
  };

  const calculateMaxDrawdown = (data: CandlestickData[]): number => {
    let maxDrawdown = 0;
    let peak = data[0]?.close || 0;

    for (const candle of data) {
      if (candle.close > peak) {
        peak = candle.close;
      }
      const drawdown = (peak - candle.close) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      const timestamp = new Date().toISOString().split('T')[0];
      const assetsString = selectedAssets.join('-');

      switch (selectedFormat) {
        case 'csv':
          content = exportToCSV();
          filename = `crypto-comparison-${assetsString}-${timestamp}.csv`;
          mimeType = 'text/csv';
          break;
        
        case 'json':
          content = exportToJSON();
          filename = `crypto-comparison-${assetsString}-${timestamp}.json`;
          mimeType = 'application/json';
          break;
        
        case 'png':
          // For PNG export, we would need to capture the canvas/chart
          alert('PNG export coming soon!');
          setIsExporting(false);
          return;
        
        case 'pdf':
          // For PDF export, we would need to generate a comprehensive report
          alert('PDF export coming soon!');
          setIsExporting(false);
          return;
        
        default:
          throw new Error('Unsupported export format');
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Export Data & Charts
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Export comparison data for {selectedAssets.join(', ')}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Export Format Selection */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Export Format
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {exportFormats.map(format => (
                <button
                  key={format.id}
                  onClick={() => setSelectedFormat(format.id)}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    selectedFormat === format.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`${
                      selectedFormat === format.id ? 'text-blue-600' : 'text-gray-400'
                    }`}>
                      {format.icon}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {format.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {format.description}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Selection */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Date Range
            </h4>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All Data' },
                { key: '7d', label: 'Last 7 Days' },
                { key: '30d', label: 'Last 30 Days' },
                { key: '90d', label: 'Last 90 Days' }
              ].map(range => (
                <button
                  key={range.key}
                  onClick={() => setDateRange(range.key as typeof dateRange)}
                  className={`px-3 py-2 text-sm rounded-md transition-colors ${
                    dateRange === range.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export Options */}
          {(selectedFormat === 'csv' || selectedFormat === 'json') && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Include Additional Data
              </h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeCorrelations}
                    onChange={(e) => setIncludeCorrelations(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={selectedAssets.length < 2}
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Correlation matrix and pair analysis
                  </span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={includeStatistics}
                    onChange={(e) => setIncludeStatistics(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Statistical metrics (returns, volatility, Sharpe ratio)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Export Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <h5 className="font-medium text-gray-900 dark:text-white mb-2">
              Export Summary
            </h5>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div>Assets: {selectedAssets.join(', ')}</div>
              <div>Format: {exportFormats.find(f => f.id === selectedFormat)?.name}</div>
              <div>Date Range: {dateRange === 'all' ? 'All available data' : `Last ${dateRange.replace('d', ' days')}`}</div>
              {includeCorrelations && selectedAssets.length > 1 && (
                <div>✓ Includes correlation analysis</div>
              )}
              {includeStatistics && (
                <div>✓ Includes statistical metrics</div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportUtility;