import React, { useState, useMemo } from 'react';
import {
  Download,
  FileText,
  Table,
  BarChart3,
  Calendar,
  Filter,
  Settings,
  Check,
  X,
  Info
} from 'lucide-react';
import {
  VolumeData,
  VolumeIndicators,
  VolumeProfileLevel,
  VWAPData,
  OrderBook,
  MarketDepth,
  TimeAndSalesEntry,
  LiquidityMetrics
} from '../../services/VolumeAnalysisService';

interface VolumeDataExportProps {
  volumeData: VolumeData[];
  volumeIndicators: VolumeIndicators | null;
  volumeProfile: VolumeProfileLevel[];
  vwapData: VWAPData | null;
  orderBook: OrderBook | null;
  marketDepth: MarketDepth | null;
  timeAndSales: TimeAndSalesEntry[];
  liquidityMetrics: LiquidityMetrics | null;
  symbol?: string;
  timeframe?: string;
  className?: string;
}

interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  dataTypes: {
    volumeData: boolean;
    volumeIndicators: boolean;
    volumeProfile: boolean;
    vwap: boolean;
    orderBook: boolean;
    marketDepth: boolean;
    timeAndSales: boolean;
    liquidityMetrics: boolean;
  };
  includeHeaders: boolean;
  includeMetadata: boolean;
  aggregationLevel: 'raw' | 'hourly' | 'daily';
}

const VolumeDataExport: React.FC<VolumeDataExportProps> = ({
  volumeData,
  volumeIndicators,
  volumeProfile,
  vwapData,
  orderBook,
  marketDepth,
  timeAndSales,
  liquidityMetrics,
  symbol = 'BTC/USD',
  timeframe = '1h',
  className = ''
}) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    dateRange: {
      start: null,
      end: null
    },
    dataTypes: {
      volumeData: true,
      volumeIndicators: true,
      volumeProfile: false,
      vwap: true,
      orderBook: false,
      marketDepth: false,
      timeAndSales: false,
      liquidityMetrics: false
    },
    includeHeaders: true,
    includeMetadata: true,
    aggregationLevel: 'raw'
  });
  const [isExporting, setIsExporting] = useState(false);

  // Calculate export statistics
  const exportStats = useMemo(() => {
    let totalRecords = 0;
    let estimatedSize = 0;

    if (exportOptions.dataTypes.volumeData) {
      totalRecords += volumeData.length;
      estimatedSize += volumeData.length * 8 * 10; // 8 fields * 10 bytes avg
    }

    if (exportOptions.dataTypes.volumeIndicators && volumeIndicators) {
      const indicatorCount = Object.values(volumeIndicators).reduce((sum, arr) => sum + arr.length, 0);
      totalRecords += indicatorCount;
      estimatedSize += indicatorCount * 3 * 8; // 3 fields * 8 bytes avg
    }

    if (exportOptions.dataTypes.volumeProfile) {
      totalRecords += volumeProfile.length;
      estimatedSize += volumeProfile.length * 4 * 8;
    }

    if (exportOptions.dataTypes.vwap && vwapData) {
      totalRecords += vwapData.series.length;
      estimatedSize += vwapData.series.length * 4 * 8;
    }

    if (exportOptions.dataTypes.timeAndSales) {
      totalRecords += timeAndSales.length;
      estimatedSize += timeAndSales.length * 5 * 8;
    }

    return {
      totalRecords,
      estimatedSize: Math.round(estimatedSize / 1024), // KB
      selectedTypes: Object.values(exportOptions.dataTypes).filter(Boolean).length
    };
  }, [exportOptions, volumeData, volumeIndicators, volumeProfile, vwapData, timeAndSales]);

  // Filter data by date range
  const filterByDateRange = (data: Array<{ timestamp: number }>) => {
    if (!exportOptions.dateRange.start && !exportOptions.dateRange.end) return data;
    
    return data.filter(item => {
      const itemDate = new Date(item.timestamp);
      if (exportOptions.dateRange.start && itemDate < exportOptions.dateRange.start) return false;
      if (exportOptions.dateRange.end && itemDate > exportOptions.dateRange.end) return false;
      return true;
    });
  };

  // Convert data to CSV
  const convertToCSV = (data: any[], headers: string[]): string => {
    if (!exportOptions.includeHeaders) {
      return data.map(row => headers.map(header => row[header] || '').join(',')).join('\n');
    }
    
    const csvHeaders = headers.join(',');
    const csvRows = data.map(row => headers.map(header => {
      const value = row[header];
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value || '';
    }).join(','));
    
    return [csvHeaders, ...csvRows].join('\n');
  };

  // Generate export data
  const generateExportData = () => {
    const exportData: { [key: string]: any } = {};

    // Volume Data
    if (exportOptions.dataTypes.volumeData) {
      const filteredData = filterByDateRange(volumeData);
      exportData.volumeData = filteredData.map(d => ({
        timestamp: new Date(d.timestamp).toISOString(),
        volume: d.volume,
        price: d.price,
        high: d.high,
        low: d.low,
        open: d.open,
        buyVolume: d.buyVolume,
        sellVolume: d.sellVolume
      }));
    }

    // Volume Indicators
    if (exportOptions.dataTypes.volumeIndicators && volumeIndicators) {
      exportData.volumeIndicators = {};
      Object.entries(volumeIndicators).forEach(([key, values]) => {
        const filteredData = filterByDateRange(values);
        exportData.volumeIndicators[key] = filteredData.map(v => ({
          timestamp: new Date(v.timestamp).toISOString(),
          value: v.value
        }));
      });
    }

    // Volume Profile
    if (exportOptions.dataTypes.volumeProfile) {
      exportData.volumeProfile = volumeProfile.map(p => ({
        price: p.price,
        priceRange: p.priceRange,
        volume: p.volume,
        count: p.count
      }));
    }

    // VWAP Data
    if (exportOptions.dataTypes.vwap && vwapData) {
      const filteredData = filterByDateRange(vwapData.series);
      exportData.vwap = {
        current: vwapData.current,
        deviation: vwapData.deviation,
        series: filteredData.map(s => ({
          timestamp: new Date(s.timestamp).toISOString(),
          vwap: s.vwap,
          price: s.price,
          deviation: s.deviation
        }))
      };
    }

    // Order Book
    if (exportOptions.dataTypes.orderBook && orderBook) {
      exportData.orderBook = {
        timestamp: new Date(orderBook.timestamp).toISOString(),
        spread: orderBook.spread,
        mid: orderBook.mid,
        bids: orderBook.bids.slice(0, 20).map(b => ({
          price: b.price,
          quantity: b.quantity,
          total: b.total
        })),
        asks: orderBook.asks.slice(0, 20).map(a => ({
          price: a.price,
          quantity: a.quantity,
          total: a.total
        }))
      };
    }

    // Market Depth
    if (exportOptions.dataTypes.marketDepth && marketDepth) {
      exportData.marketDepth = {
        liquidityScore: marketDepth.liquidityScore,
        maxQuantity: marketDepth.maxQuantity,
        levels: marketDepth.levels.map(l => ({
          price: l.price,
          bidQuantity: l.bidQuantity,
          askQuantity: l.askQuantity,
          bidTotal: l.bidTotal,
          askTotal: l.askTotal
        }))
      };
    }

    // Time and Sales
    if (exportOptions.dataTypes.timeAndSales) {
      const filteredData = filterByDateRange(timeAndSales);
      exportData.timeAndSales = filteredData.map(t => ({
        timestamp: new Date(t.timestamp).toISOString(),
        price: t.price,
        quantity: t.quantity,
        side: t.side,
        id: t.id
      }));
    }

    // Liquidity Metrics
    if (exportOptions.dataTypes.liquidityMetrics && liquidityMetrics) {
      exportData.liquidityMetrics = {
        spread: liquidityMetrics.spread,
        spreadPercentage: liquidityMetrics.spreadPercentage,
        marketImpact: liquidityMetrics.marketImpact,
        liquidityScore: liquidityMetrics.liquidityScore,
        totalDepth: liquidityMetrics.totalDepth,
        imbalance: liquidityMetrics.imbalance
      };
    }

    // Add metadata if requested
    if (exportOptions.includeMetadata) {
      exportData.metadata = {
        symbol,
        timeframe,
        exportedAt: new Date().toISOString(),
        dateRange: {
          start: exportOptions.dateRange.start?.toISOString() || null,
          end: exportOptions.dateRange.end?.toISOString() || null
        },
        format: exportOptions.format,
        aggregationLevel: exportOptions.aggregationLevel,
        totalRecords: exportStats.totalRecords
      };
    }

    return exportData;
  };

  // Download file
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);

    try {
      const exportData = generateExportData();
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${symbol.replace('/', '-')}_volume_analysis_${timestamp}`;

      switch (exportOptions.format) {
        case 'json':
          const jsonContent = JSON.stringify(exportData, null, 2);
          downloadFile(jsonContent, `${filename}.json`, 'application/json');
          break;

        case 'csv':
          // Export each data type as separate CSV files in a zip-like structure
          let csvContent = '';
          
          if (exportData.volumeData) {
            const headers = ['timestamp', 'volume', 'price', 'high', 'low', 'open', 'buyVolume', 'sellVolume'];
            csvContent += `# Volume Data\n${convertToCSV(exportData.volumeData, headers)}\n\n`;
          }

          if (exportData.volumeIndicators) {
            Object.entries(exportData.volumeIndicators).forEach(([indicator, data]: [string, any]) => {
              const headers = ['timestamp', 'value'];
              csvContent += `# ${indicator.toUpperCase()} Indicator\n${convertToCSV(data, headers)}\n\n`;
            });
          }

          if (exportData.vwap?.series) {
            const headers = ['timestamp', 'vwap', 'price', 'deviation'];
            csvContent += `# VWAP Data\n${convertToCSV(exportData.vwap.series, headers)}\n\n`;
          }

          if (exportData.timeAndSales) {
            const headers = ['timestamp', 'price', 'quantity', 'side', 'id'];
            csvContent += `# Time and Sales\n${convertToCSV(exportData.timeAndSales, headers)}\n\n`;
          }

          downloadFile(csvContent, `${filename}.csv`, 'text/csv');
          break;

        case 'xlsx':
          // For XLSX, we'll export as JSON with a note about Excel compatibility
          const xlsxContent = JSON.stringify(exportData, null, 2);
          downloadFile(xlsxContent, `${filename}_excel_import.json`, 'application/json');
          break;
      }

      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Render export modal
  const renderExportModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Export Volume Data
          </h3>
          <button
            onClick={() => setShowExportModal(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Format
            </label>
            <div className="flex space-x-4">
              {['csv', 'json', 'xlsx'].map(format => (
                <label key={format} className="flex items-center">
                  <input
                    type="radio"
                    value={format}
                    checked={exportOptions.format === format}
                    onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as any }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 uppercase">{format}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Data Types Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Data Types to Export
            </label>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(exportOptions.dataTypes).map(([key, value]) => (
                <label key={key} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setExportOptions(prev => ({
                      ...prev,
                      dataTypes: { ...prev.dataTypes, [key]: e.target.checked }
                    }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Range (Optional)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="date"
                  value={exportOptions.dateRange.start?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, start: e.target.value ? new Date(e.target.value) : null }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  placeholder="Start Date"
                />
              </div>
              <div>
                <input
                  type="date"
                  value={exportOptions.dateRange.end?.toISOString().split('T')[0] || ''}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, end: e.target.value ? new Date(e.target.value) : null }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  placeholder="End Date"
                />
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Export Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeHeaders}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeHeaders: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include column headers</span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={exportOptions.includeMetadata}
                  onChange={(e) => setExportOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Include metadata</span>
              </label>
            </div>
          </div>

          {/* Export Statistics */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Export Summary</h4>
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <p>• Total records: {exportStats.totalRecords.toLocaleString()}</p>
              <p>• Estimated size: {exportStats.estimatedSize} KB</p>
              <p>• Data types selected: {exportStats.selectedTypes}</p>
              <p>• Symbol: {symbol} • Timeframe: {timeframe}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => setShowExportModal(false)}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting || exportStats.selectedTypes === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Data</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`volume-data-export ${className}`}>
      <button
        onClick={() => setShowExportModal(true)}
        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
      >
        <Download className="w-4 h-4" />
        <span>Export Data</span>
      </button>

      {showExportModal && renderExportModal()}
    </div>
  );
};

export default VolumeDataExport;