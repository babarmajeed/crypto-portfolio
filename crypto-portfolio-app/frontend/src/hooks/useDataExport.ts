import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ExportOptions,
  ExportProgress,
  ExportResult,
  ExportTemplate,
  ExportFormat,
  ScheduledExport,
  UseDataExportReturn,
  ExportFilter,
  ExportSettings
} from '../types/importExport.types';
import { ImportExportService } from '../services/ImportExportService';

interface UseDataExportOptions {
  defaultFormat?: ExportFormat;
  autoDownload?: boolean;
  enableScheduling?: boolean;
  maxFileSize?: number;
  compressionEnabled?: boolean;
  onProgress?: (progress: ExportProgress) => void;
  onComplete?: (result: ExportResult) => void;
  onError?: (error: Error) => void;
}

export const useDataExport = (options: UseDataExportOptions = {}): UseDataExportReturn => {
  const {
    defaultFormat = 'csv',
    autoDownload = true,
    enableScheduling = false,
    maxFileSize = 100 * 1024 * 1024, // 100MB
    compressionEnabled = true,
    onProgress,
    onComplete,
    onError
  } = options;

  // State
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: defaultFormat,
    includeFields: ['date', 'symbol', 'type', 'amount', 'price', 'fee', 'total'],
    includeHeaders: true,
    includeMetadata: true,
    compression: compressionEnabled,
    sortBy: 'date',
    sortOrder: 'desc'
  });

  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [scheduledExports, setScheduledExports] = useState<ScheduledExport[]>([]);

  // Refs
  const exportServiceRef = useRef(new ImportExportService());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Settings
  const [exportSettings] = useState<ExportSettings>({
    defaultFormat: defaultFormat,
    includeHeadersByDefault: true,
    includeMetadataByDefault: true,
    defaultDateFormat: 'YYYY-MM-DD HH:mm:ss',
    defaultCurrency: 'USD',
    compressionLevel: 6,
    maxFileSize,
    autoDownload,
    retainExportHistory: true,
    maxHistoryEntries: 100
  });

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    if (enableScheduling) {
      loadScheduledExports();
    }
  }, [enableScheduling]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      const savedTemplates = localStorage.getItem('export-templates');
      if (savedTemplates) {
        const parsed = JSON.parse(savedTemplates);
        setTemplates(parsed);
      } else {
        // Initialize with default templates
        const defaultTemplates: ExportTemplate[] = [
          {
            id: 'basic-csv',
            name: 'Basic CSV Export',
            description: 'Basic transaction export in CSV format',
            format: 'csv',
            options: {
              format: 'csv',
              includeFields: ['date', 'symbol', 'type', 'amount', 'price', 'total'],
              includeHeaders: true,
              includeMetadata: false,
              sortBy: 'date',
              sortOrder: 'desc'
            },
            isDefault: true,
            category: 'custom',
            tags: ['csv', 'basic'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usage: 0
          },
          {
            id: 'tax-report',
            name: 'Tax Report',
            description: 'Comprehensive export for tax reporting',
            format: 'excel',
            options: {
              format: 'excel',
              includeFields: ['date', 'symbol', 'type', 'amount', 'price', 'fee', 'total', 'exchange'],
              includeHeaders: true,
              includeMetadata: true,
              groupBy: 'date',
              sortBy: 'date',
              sortOrder: 'asc'
            },
            isDefault: true,
            category: 'tax',
            tags: ['excel', 'tax', 'comprehensive'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usage: 0
          },
          {
            id: 'analysis-json',
            name: 'Analysis Export (JSON)',
            description: 'Detailed JSON export for analysis tools',
            format: 'json',
            options: {
              format: 'json',
              includeFields: ['date', 'symbol', 'type', 'amount', 'price', 'fee', 'total', 'metadata'],
              includeHeaders: false,
              includeMetadata: true,
              compression: true
            },
            isDefault: true,
            category: 'analysis',
            tags: ['json', 'analysis', 'detailed'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usage: 0
          }
        ];
        setTemplates(defaultTemplates);
        localStorage.setItem('export-templates', JSON.stringify(defaultTemplates));
      }
    } catch (error) {
      console.error('Failed to load export templates:', error);
    }
  }, []);

  // Load scheduled exports
  const loadScheduledExports = useCallback(async () => {
    try {
      const savedSchedules = localStorage.getItem('scheduled-exports');
      if (savedSchedules) {
        setScheduledExports(JSON.parse(savedSchedules));
      }
    } catch (error) {
      console.error('Failed to load scheduled exports:', error);
    }
  }, []);

  // Update export options
  const updateExportOptions = useCallback((options: Partial<ExportOptions>) => {
    setExportOptions(prev => ({ ...prev, ...options }));
  }, []);

  // Apply template
  const applyTemplate = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setExportOptions(template.options);
      // Update usage count
      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, usage: t.usage + 1, updatedAt: new Date().toISOString() } : t
      ));
    }
  }, [templates]);

  // Start export
  const startExport = useCallback(async (data: any[]): Promise<ExportResult> => {
    if (isExporting) {
      throw new Error('Export already in progress');
    }

    try {
      setIsExporting(true);
      setExportResult(null);
      
      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Initialize progress
      const initialProgress: ExportProgress = {
        stage: 'preparing',
        progress: 0,
        message: 'Preparing export...',
        recordsProcessed: 0,
        totalRecords: data.length,
        startTime: new Date().toISOString()
      };
      
      setExportProgress(initialProgress);
      onProgress?.(initialProgress);

      // Apply filters if specified
      let filteredData = data;
      if (exportOptions.customFilters && exportOptions.customFilters.length > 0) {
        setExportProgress(prev => prev ? {
          ...prev,
          stage: 'filtering',
          progress: 10,
          message: 'Filtering data...'
        } : null);
        
        filteredData = applyFilters(data, exportOptions.customFilters);
      }

      // Apply date range filter
      if (exportOptions.dateRange) {
        filteredData = filteredData.filter(item => {
          if (!item.date) return true;
          const itemDate = new Date(item.date);
          const startDate = new Date(exportOptions.dateRange!.start);
          const endDate = new Date(exportOptions.dateRange!.end);
          return itemDate >= startDate && itemDate <= endDate;
        });
      }

      // Apply asset filter
      if (exportOptions.assets && exportOptions.assets.length > 0) {
        filteredData = filteredData.filter(item => 
          exportOptions.assets!.includes(item.symbol || item.asset)
        );
      }

      // Apply transaction type filter
      if (exportOptions.transactionTypes && exportOptions.transactionTypes.length > 0) {
        filteredData = filteredData.filter(item => 
          exportOptions.transactionTypes!.includes(item.type)
        );
      }

      // Sort data
      setExportProgress(prev => prev ? {
        ...prev,
        stage: 'formatting',
        progress: 30,
        message: 'Sorting and formatting data...'
      } : null);

      if (exportOptions.sortBy) {
        filteredData.sort((a, b) => {
          const aVal = a[exportOptions.sortBy!];
          const bVal = b[exportOptions.sortBy!];
          
          let comparison = 0;
          if (aVal < bVal) comparison = -1;
          if (aVal > bVal) comparison = 1;
          
          return exportOptions.sortOrder === 'desc' ? -comparison : comparison;
        });
      }

      // Group data if specified
      if (exportOptions.groupBy) {
        filteredData = groupData(filteredData as any[], exportOptions.groupBy);
      }

      // Select fields
      const processedData = filteredData.map(item => {
        const processed: any = {};
        exportOptions.includeFields.forEach(field => {
          if (exportOptions.excludeFields?.includes(field)) return;
          processed[field] = item[field];
        });
        return processed;
      });

      // Generate export
      setExportProgress(prev => prev ? {
        ...prev,
        stage: 'generating',
        progress: 70,
        message: 'Generating export file...',
        recordsProcessed: processedData.length
      } : null);

      const result = await exportServiceRef.current.exportData(
        processedData,
        exportOptions,
        (progress) => {
          const updatedProgress = (prev: any) => prev ? {
            ...prev,
            progress: 70 + (progress * 0.3),
            recordsProcessed: Math.round(processedData.length * progress)
          } : null;
          setExportProgress(updatedProgress);
        },
        abortControllerRef.current.signal
      );

      // Complete
      setExportProgress(prev => prev ? {
        ...prev,
        stage: 'complete',
        progress: 100,
        message: 'Export completed successfully!',
        recordsProcessed: processedData.length,
        estimatedTime: 0
      } : null);

      setExportResult(result);
      setIsExporting(false);

      // Auto-download if enabled
      if (autoDownload && result.blob) {
        downloadBlob(result.blob, result.fileName);
      }

      // Save to export history
      saveToExportHistory(result);

      onComplete?.(result);
      return result;
    } catch (error) {
      console.error('Export error:', error);
      setIsExporting(false);
      setExportProgress(prev => prev ? {
        ...prev,
        stage: 'error',
        message: error instanceof Error ? error.message : 'Export failed'
      } : null);
      
      onError?.(error instanceof Error ? error : new Error('Export failed'));
      throw error;
    }
  }, [isExporting, exportOptions, autoDownload, onProgress, onComplete, onError]);

  // Cancel export
  const cancelExport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsExporting(false);
    setExportProgress(null);
  }, []);

  // Download export
  const downloadExport = useCallback(() => {
    if (exportResult && exportResult.blob) {
      downloadBlob(exportResult.blob, exportResult.fileName);
    } else if (exportResult?.downloadUrl) {
      const link = document.createElement('a');
      link.href = exportResult.downloadUrl;
      link.download = exportResult.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [exportResult]);

  // Get templates
  const getTemplates = useCallback((): ExportTemplate[] => {
    return templates.sort((a, b) => b.usage - a.usage);
  }, [templates]);

  // Save template
  const saveTemplate = useCallback((template: Omit<ExportTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newTemplate: ExportTemplate = {
      ...template,
      id: `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem('export-templates', JSON.stringify(updatedTemplates));
  }, [templates]);

  // Delete template
  const deleteTemplate = useCallback((templateId: string) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem('export-templates', JSON.stringify(updatedTemplates));
  }, [templates]);

  // Schedule export
  const scheduleExport = useCallback((schedule: Omit<ScheduledExport, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!enableScheduling) {
      throw new Error('Scheduling is not enabled');
    }

    const newSchedule: ScheduledExport = {
      ...schedule,
      id: `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runCount: 0,
      successCount: 0,
      failureCount: 0
    };

    const updatedSchedules = [...scheduledExports, newSchedule];
    setScheduledExports(updatedSchedules);
    localStorage.setItem('scheduled-exports', JSON.stringify(updatedSchedules));
  }, [enableScheduling, scheduledExports]);

  // Helper functions
  const applyFilters = useCallback((data: any[], filters: ExportFilter[]): any[] => {
    return data.filter(item => {
      return filters.every(filter => {
        const value = item[filter.field];
        
        switch (filter.operator) {
          case 'equals':
            return value === filter.value;
          case 'contains':
            return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'greater':
            return Number(value) > Number(filter.value);
          case 'less':
            return Number(value) < Number(filter.value);
          case 'between':
            const [min, max] = Array.isArray(filter.value) ? filter.value : [filter.value, filter.value];
            return Number(value) >= Number(min) && Number(value) <= Number(max);
          case 'in':
            return Array.isArray(filter.value) ? filter.value.includes(value) : value === filter.value;
          default:
            return true;
        }
      });
    });
  }, []);

  const groupData = useCallback((data: any[], groupBy: string): any[] => {
    const grouped = data.reduce((acc, item) => {
      const key = item[groupBy];
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as { [key: string]: any[] });

    // Flatten back to array with group separators
    const result: any[] = [];
    Object.entries(grouped).forEach(([key, items]) => {
      result.push({ 
        [groupBy]: key, 
        _isGroupHeader: true, 
        _groupCount: items.length 
      });
      result.push(...items);
    });

    return result;
  }, []);

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const saveToExportHistory = useCallback((result: ExportResult) => {
    try {
      const history = JSON.parse(localStorage.getItem('export-history') || '[]');
      const entry = {
        id: `export_${Date.now()}`,
        fileName: result.fileName,
        format: result.format,
        recordCount: result.recordCount,
        fileSize: result.fileSize,
        timestamp: result.timestamp,
        success: result.success
      };

      const updatedHistory = [entry, ...history].slice(0, exportSettings.maxHistoryEntries);
      localStorage.setItem('export-history', JSON.stringify(updatedHistory));
    } catch (error) {
      console.warn('Failed to save export history:', error);
    }
  }, [exportSettings.maxHistoryEntries]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // State
    exportOptions,
    exportProgress,
    exportResult,
    isExporting,
    
    // Actions
    updateExportOptions,
    startExport,
    cancelExport,
    downloadExport,
    applyTemplate,
    
    // Utils
    getTemplates,
    saveTemplate,
    deleteTemplate,
    scheduleExport
  };
};