import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  Image, 
  FileSpreadsheet, 
  Settings,
  Calendar,
  Filter,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv' | 'png' | 'json';
  timeRange: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL';
  includeCharts: boolean;
  includeBenchmark: boolean;
  includeAttribution: boolean;
  includeRiskMetrics: boolean;
  includeTransactions: boolean;
  customDateRange?: {
    start: string;
    end: string;
  };
  chartTypes: string[];
  reportSections: string[];
}

interface PerformanceExportProps {
  portfolioId: string;
  onExport?: (options: ExportOptions) => Promise<void>;
  className?: string;
}

const PerformanceExport: React.FC<PerformanceExportProps> = ({
  portfolioId,
  onExport,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    timeRange: '1Y',
    includeCharts: true,
    includeBenchmark: true,
    includeAttribution: true,
    includeRiskMetrics: true,
    includeTransactions: false,
    chartTypes: ['cumulative', 'drawdown', 'attribution'],
    reportSections: ['summary', 'performance', 'risk', 'attribution']
  });

  const formatOptions = [
    { value: 'pdf', label: 'PDF Report', icon: FileText, description: 'Comprehensive report with charts and analysis' },
    { value: 'excel', label: 'Excel Workbook', icon: FileSpreadsheet, description: 'Detailed data in spreadsheet format' },
    { value: 'csv', label: 'CSV Data', icon: FileSpreadsheet, description: 'Raw performance data only' },
    { value: 'png', label: 'Chart Images', icon: Image, description: 'High-resolution chart images' },
    { value: 'json', label: 'JSON Data', icon: FileText, description: 'Machine-readable data format' }
  ];

  const timeRangeOptions = [
    { value: '1M', label: '1 Month' },
    { value: '3M', label: '3 Months' },
    { value: '6M', label: '6 Months' },
    { value: '1Y', label: '1 Year' },
    { value: '2Y', label: '2 Years' },
    { value: 'ALL', label: 'All Time' },
    { value: 'custom', label: 'Custom Range' }
  ];

  const chartTypeOptions = [
    { value: 'cumulative', label: 'Cumulative Returns', description: 'Portfolio value over time' },
    { value: 'drawdown', label: 'Drawdown Analysis', description: 'Peak-to-trough declines' },
    { value: 'attribution', label: 'Performance Attribution', description: 'Asset contribution breakdown' },
    { value: 'correlation', label: 'Correlation Matrix', description: 'Asset correlation heatmap' },
    { value: 'montecarlo', label: 'Monte Carlo Simulation', description: 'Future projection scenarios' },
    { value: 'returns', label: 'Returns Distribution', description: 'Histogram of periodic returns' }
  ];

  const reportSectionOptions = [
    { value: 'summary', label: 'Executive Summary', description: 'Key metrics and insights' },
    { value: 'performance', label: 'Performance Analysis', description: 'Detailed return analysis' },
    { value: 'risk', label: 'Risk Analysis', description: 'Risk metrics and VaR analysis' },
    { value: 'attribution', label: 'Performance Attribution', description: 'Factor and asset attribution' },
    { value: 'benchmark', label: 'Benchmark Comparison', description: 'Relative performance analysis' },
    { value: 'transactions', label: 'Transaction History', description: 'Trade history and timing' },
    { value: 'methodology', label: 'Methodology', description: 'Calculation methods and assumptions' }
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('idle');

    try {
      // Validate options
      if (exportOptions.chartTypes.length === 0 && exportOptions.includeCharts) {
        throw new Error('Please select at least one chart type');
      }

      if (exportOptions.reportSections.length === 0) {
        throw new Error('Please select at least one report section');
      }

      // Mock export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (onExport) {
        await onExport(exportOptions);
      } else {
        // Default export behavior
        await mockExport();
      }

      setExportStatus('success');
      
      // Auto-close after success
      setTimeout(() => {
        setIsOpen(false);
        setExportStatus('idle');
      }, 2000);

    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus('error');
    } finally {
      setIsExporting(false);
    }
  };

  const mockExport = async () => {
    // Simulate file generation based on format
    const { format } = exportOptions;
    let mimeType = '';
    let filename = '';

    switch (format) {
      case 'pdf':
        mimeType = 'application/pdf';
        filename = `portfolio-report-${portfolioId}-${Date.now()}.pdf`;
        break;
      case 'excel':
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `portfolio-data-${portfolioId}-${Date.now()}.xlsx`;
        break;
      case 'csv':
        mimeType = 'text/csv';
        filename = `portfolio-data-${portfolioId}-${Date.now()}.csv`;
        break;
      case 'png':
        mimeType = 'image/png';
        filename = `portfolio-charts-${portfolioId}-${Date.now()}.zip`;
        break;
      case 'json':
        mimeType = 'application/json';
        filename = `portfolio-data-${portfolioId}-${Date.now()}.json`;
        break;
    }

    // Create mock download
    const blob = new Blob(['Mock export data'], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateOption = <K extends keyof ExportOptions>(
    key: K, 
    value: ExportOptions[K]
  ) => {
    setExportOptions(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayOption = (key: 'chartTypes' | 'reportSections', value: string) => {
    setExportOptions(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value]
    }));
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ${className}`}
      >
        <Download className="w-4 h-4" />
        <span>Export Report</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Export Performance Report
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Customize and export your portfolio performance analysis
            </p>
          </div>
          
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Export Format */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Export Format
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {formatOptions.map(option => {
                const IconComponent = option.icon;
                return (
                  <label
                    key={option.value}
                    className={`relative flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      exportOptions.format === option.value
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={option.value}
                      checked={exportOptions.format === option.value}
                      onChange={(e) => updateOption('format', e.target.value as any)}
                      className="sr-only"
                    />
                    <div className="flex items-start space-x-3">
                      <IconComponent className="w-5 h-5 text-gray-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Time Range */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Time Range
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {timeRangeOptions.map(option => (
                <label
                  key={option.value}
                  className={`flex items-center justify-center p-3 border rounded-md cursor-pointer transition-colors ${
                    exportOptions.timeRange === option.value
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="timeRange"
                    value={option.value}
                    checked={exportOptions.timeRange === option.value}
                    onChange={(e) => updateOption('timeRange', e.target.value as any)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>

            {exportOptions.timeRange === 'custom' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={exportOptions.customDateRange?.start || ''}
                    onChange={(e) => updateOption('customDateRange', {
                      ...exportOptions.customDateRange,
                      start: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={exportOptions.customDateRange?.end || ''}
                    onChange={(e) => updateOption('customDateRange', {
                      ...exportOptions.customDateRange,
                      end: e.target.value
                    })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Include Options */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Include in Report
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'includeCharts', label: 'Charts and Visualizations', description: 'Include performance charts' },
                { key: 'includeBenchmark', label: 'Benchmark Comparison', description: 'Compare against benchmarks' },
                { key: 'includeAttribution', label: 'Performance Attribution', description: 'Factor and asset attribution' },
                { key: 'includeRiskMetrics', label: 'Risk Analysis', description: 'VaR, volatility, and risk metrics' },
                { key: 'includeTransactions', label: 'Transaction History', description: 'Trade history and timing' }
              ].map(option => (
                <label
                  key={option.key}
                  className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={exportOptions[option.key as keyof ExportOptions] as boolean}
                    onChange={(e) => updateOption(option.key as keyof ExportOptions, e.target.checked as any)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Chart Types */}
          {exportOptions.includeCharts && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                Chart Types
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {chartTypeOptions.map(option => (
                  <label
                    key={option.value}
                    className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={exportOptions.chartTypes.includes(option.value)}
                      onChange={() => toggleArrayOption('chartTypes', option.value)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {option.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Report Sections */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Report Sections
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reportSectionOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={exportOptions.reportSections.includes(option.value)}
                    onChange={() => toggleArrayOption('reportSections', option.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            {exportStatus === 'success' && (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Export completed successfully!</span>
              </div>
            )}
            
            {exportStatus === 'error' && (
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm">Export failed. Please try again.</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsOpen(false)}
              disabled={isExporting}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Export Report</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceExport;