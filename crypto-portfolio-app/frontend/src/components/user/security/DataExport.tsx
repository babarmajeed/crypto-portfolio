import React, { useState } from 'react';
import { Download, FileText, Database, Calendar, Check, Loader2 } from 'lucide-react';
import { format, subDays, subMonths, subYears } from 'date-fns';
import { userService } from '../../../services/user.service';
import { ExportDataRequest } from '../../../types/user';
import { toast } from 'react-hot-toast';

interface DataExportProps {
  className?: string;
}

export const DataExport: React.FC<DataExportProps> = ({ className = '' }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportDataRequest>({
    format: 'json',
    includeTransactions: true,
    includePortfolio: true,
    includePreferences: true,
    includeAuditLogs: false,
    dateRange: undefined,
  });
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [customDateRange, setCustomDateRange] = useState({
    from: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd'),
  });

  const dataTypes = [
    {
      key: 'includePortfolio' as const,
      label: 'Portfolio Data',
      description: 'Your current holdings, asset allocations, and portfolio history',
      icon: Database,
    },
    {
      key: 'includeTransactions' as const,
      label: 'Transaction History',
      description: 'All buy/sell transactions, deposits, and withdrawals',
      icon: FileText,
    },
    {
      key: 'includePreferences' as const,
      label: 'Account Preferences',
      description: 'Your settings, notifications, and personalization options',
      icon: Check,
    },
    {
      key: 'includeAuditLogs' as const,
      label: 'Activity Logs',
      description: 'Security events, login history, and account changes',
      icon: Calendar,
    },
  ];

  const formatOptions = [
    {
      value: 'json' as const,
      label: 'JSON',
      description: 'Structured data format, good for developers',
      extension: '.json',
    },
    {
      value: 'csv' as const,
      label: 'CSV',
      description: 'Spreadsheet format, easy to open in Excel',
      extension: '.csv',
    },
    {
      value: 'pdf' as const,
      label: 'PDF',
      description: 'Human-readable report format',
      extension: '.pdf',
    },
  ];

  const quickDateRanges = [
    {
      label: 'Last 30 days',
      getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    },
    {
      label: 'Last 6 months',
      getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }),
    },
    {
      label: 'Last year',
      getValue: () => ({ from: subYears(new Date(), 1), to: new Date() }),
    },
    {
      label: 'All time',
      getValue: () => ({ from: new Date(2020, 0, 1), to: new Date() }),
    },
  ];

  const handleDataTypeToggle = (key: keyof ExportDataRequest) => {
    if (typeof exportConfig[key] === 'boolean') {
      setExportConfig(prev => ({
        ...prev,
        [key]: !prev[key],
      }));
    }
  };

  const handleFormatChange = (format: ExportDataRequest['format']) => {
    setExportConfig(prev => ({ ...prev, format }));
  };

  const handleQuickDateRange = (range: { from: Date; to: Date }) => {
    setCustomDateRange({
      from: format(range.from, 'yyyy-MM-dd'),
      to: format(range.to, 'yyyy-MM-dd'),
    });
    setExportConfig(prev => ({
      ...prev,
      dateRange: range,
    }));
    setUseCustomDateRange(true);
  };

  const handleCustomDateChange = (field: 'from' | 'to', value: string) => {
    const newRange = { ...customDateRange, [field]: value };
    setCustomDateRange(newRange);
    
    if (useCustomDateRange && newRange.from && newRange.to) {
      setExportConfig(prev => ({
        ...prev,
        dateRange: {
          from: new Date(newRange.from),
          to: new Date(newRange.to),
        },
      }));
    }
  };

  const handleDateRangeToggle = (enabled: boolean) => {
    setUseCustomDateRange(enabled);
    if (enabled && customDateRange.from && customDateRange.to) {
      setExportConfig(prev => ({
        ...prev,
        dateRange: {
          from: new Date(customDateRange.from),
          to: new Date(customDateRange.to),
        },
      }));
    } else {
      setExportConfig(prev => ({
        ...prev,
        dateRange: undefined,
      }));
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);

      // Validate that at least one data type is selected
      const hasDataSelected = exportConfig.includePortfolio || 
                              exportConfig.includeTransactions || 
                              exportConfig.includePreferences || 
                              exportConfig.includeAuditLogs;

      if (!hasDataSelected) {
        toast.error('Please select at least one data type to export');
        return;
      }

      const blob = await userService.exportData(exportConfig);
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = format(new Date(), 'yyyy-MM-dd-HHmm');
      const extension = formatOptions.find(f => f.value === exportConfig.format)?.extension || '.zip';
      link.download = `crypto-portfolio-data-${timestamp}${extension}`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Data export completed successfully!');
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error.response?.data?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedFormat = formatOptions.find(f => f.value === exportConfig.format);

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Export Your Data
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Download a copy of your account data for backup or analysis purposes.
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Data Types Selection */}
        <div>
          <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
            What to Export
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataTypes.map((dataType) => {
              const Icon = dataType.icon;
              const isSelected = exportConfig[dataType.key] as boolean;
              
              return (
                <label
                  key={dataType.key}
                  className={`
                    flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleDataTypeToggle(dataType.key)}
                    className="sr-only"
                  />
                  <Icon className={`h-5 w-5 mt-0.5 ${
                    isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                  }`} />
                  <div>
                    <h5 className={`font-medium ${
                      isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-white'
                    }`}>
                      {dataType.label}
                    </h5>
                    <p className={`text-sm mt-1 ${
                      isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {dataType.description}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-blue-500 ml-auto" />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Format Selection */}
        <div>
          <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
            Export Format
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {formatOptions.map((format) => (
              <label
                key={format.value}
                className={`
                  flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all
                  ${exportConfig.format === format.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }
                `}
              >
                <input
                  type="radio"
                  name="format"
                  value={format.value}
                  checked={exportConfig.format === format.value}
                  onChange={() => handleFormatChange(format.value)}
                  className="sr-only"
                />
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${
                    exportConfig.format === format.value 
                      ? 'text-blue-900 dark:text-blue-100' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {format.label}
                  </span>
                  {exportConfig.format === format.value && (
                    <Check className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <p className={`text-sm ${
                  exportConfig.format === format.value 
                    ? 'text-blue-700 dark:text-blue-300' 
                    : 'text-gray-600 dark:text-gray-400'
                }`}>
                  {format.description}
                </p>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range Selection */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-medium text-gray-900 dark:text-white">
              Date Range (Optional)
            </h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useCustomDateRange}
                onChange={(e) => handleDateRangeToggle(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Use date range
              </span>
            </label>
          </div>

          {useCustomDateRange && (
            <div className="space-y-4">
              {/* Quick Ranges */}
              <div className="flex flex-wrap gap-2">
                {quickDateRanges.map((range) => (
                  <button
                    key={range.label}
                    onClick={() => handleQuickDateRange(range.getValue())}
                    className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
                  >
                    {range.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={customDateRange.from}
                    onChange={(e) => handleCustomDateChange('from', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={customDateRange.to}
                    onChange={(e) => handleCustomDateChange('to', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export Summary */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h5 className="font-medium text-gray-900 dark:text-white mb-2">
            Export Summary
          </h5>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <p>Format: {selectedFormat?.label} ({selectedFormat?.extension})</p>
            <p>
              Data types: {dataTypes.filter(dt => exportConfig[dt.key] as boolean).map(dt => dt.label).join(', ') || 'None selected'}
            </p>
            <p>
              Date range: {useCustomDateRange && exportConfig.dateRange 
                ? `${format(exportConfig.dateRange.from, 'MMM dd, yyyy')} - ${format(exportConfig.dateRange.to, 'MMM dd, yyyy')}`
                : 'All time'
              }
            </p>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleExport}
            disabled={isExporting || !(exportConfig.includePortfolio || exportConfig.includeTransactions || exportConfig.includePreferences || exportConfig.includeAuditLogs)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isExporting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {isExporting ? 'Exporting...' : 'Export Data'}
          </button>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Privacy & Security Notice
          </h5>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <p>• Your exported data contains sensitive financial information</p>
            <p>• Store the exported files in a secure location</p>
            <p>• Consider encrypting the files if sharing or storing in cloud services</p>
            <p>• Delete exported files when no longer needed</p>
          </div>
        </div>
      </div>
    </div>
  );
};