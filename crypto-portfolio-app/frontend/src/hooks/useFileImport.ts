import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ImportWorkflow,
  ImportProgress,
  ImportPreviewData,
  ValidationResult,
  ImportResult,
  ImportTemplate,
  ImportType,
  ColumnMapping,
  UseFileImportReturn,
  ParseOptions,
  FileUploadState,
  ImportSettings
} from '../types/importExport.types';
import { ImportExportService } from '../services/ImportExportService';

interface UseFileImportOptions {
  autoValidate?: boolean;
  enableDragDrop?: boolean;
  maxFileSize?: number;
  supportedFormats?: string[];
  batchSize?: number;
  onProgress?: (progress: ImportProgress) => void;
  onComplete?: (result: ImportResult) => void;
  onError?: (error: Error) => void;
}

export const useFileImport = (options: UseFileImportOptions = {}): UseFileImportReturn => {
  const {
    autoValidate = true,
    enableDragDrop = true,
    maxFileSize = 50 * 1024 * 1024, // 50MB
    supportedFormats = ['.csv', '.xlsx', '.xls', '.json'],
    batchSize = 1000,
    onProgress,
    onComplete,
    onError
  } = options;

  // State
  const [importState, setImportState] = useState<ImportWorkflow | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadState, setUploadState] = useState<FileUploadState>({
    isDragOver: false,
    isUploading: false,
    uploadProgress: 0,
    selectedFiles: [],
    rejectedFiles: [],
    errors: []
  });

  // Refs
  const importServiceRef = useRef(new ImportExportService());
  const abortControllerRef = useRef<AbortController | null>(null);
  // const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);

  // Settings
  const [importSettings] = useState<ImportSettings>({
    defaultImportType: 'generic',
    autoDetectFormat: true,
    validateOnImport: true,
    skipDuplicates: true,
    allowPartialImports: true,
    batchSize,
    backupBeforeImport: false,
    notifyOnComplete: true,
    retainImportHistory: true,
    maxHistoryEntries: 50,
    defaultDateFormat: 'YYYY-MM-DD',
    defaultCurrency: 'USD',
    priceDataSource: 'coingecko',
    customFieldMappings: {}
  });

  // Initialize workflow
  const initializeWorkflow = useCallback((file: File, importType: ImportType): ImportWorkflow => {
    const workflowId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: workflowId,
      name: `Import ${file.name}`,
      steps: [
        {
          id: 'file-select',
          name: 'File Selection',
          description: 'Select and validate file',
          type: 'file-select',
          status: 'completed',
          data: { file, importType },
          errors: [],
          warnings: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          duration: 0
        },
        {
          id: 'parse',
          name: 'File Parsing',
          description: 'Parse file content and extract data',
          type: 'parse',
          status: 'pending',
          data: null,
          errors: [],
          warnings: []
        },
        {
          id: 'map',
          name: 'Column Mapping',
          description: 'Map file columns to data fields',
          type: 'map',
          status: 'pending',
          data: null,
          errors: [],
          warnings: []
        },
        {
          id: 'validate',
          name: 'Data Validation',
          description: 'Validate parsed data',
          type: 'validate',
          status: 'pending',
          data: null,
          errors: [],
          warnings: []
        },
        {
          id: 'preview',
          name: 'Data Preview',
          description: 'Preview processed data',
          type: 'preview',
          status: 'pending',
          data: null,
          errors: [],
          warnings: []
        },
        {
          id: 'import',
          name: 'Data Import',
          description: 'Import data to portfolio',
          type: 'import',
          status: 'pending',
          data: null,
          errors: [],
          warnings: []
        }
      ],
      currentStep: 1,
      status: 'running',
      data: { file, importType },
      errors: [],
      startedAt: new Date().toISOString(),
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        importType
      }
    };
  }, []);

  // File selection
  const selectFile = useCallback(async (file: File, importType: ImportType) => {
    try {
      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Initialize workflow
      const workflow = initializeWorkflow(file, importType);
      setImportState(workflow);

      // Start parsing
      await parseFile(workflow, file);
    } catch (error) {
      console.error('File selection error:', error);
      setUploadState(prev => ({
        ...prev,
        errors: [...prev.errors, error instanceof Error ? error.message : 'File selection failed']
      }));
      onError?.(error instanceof Error ? error : new Error('File selection failed'));
    }
  }, [initializeWorkflow, onError]);

  // File validation
  const validateFile = useCallback((file: File): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (file.size > maxFileSize) {
      errors.push(`File size exceeds maximum limit of ${Math.round(maxFileSize / 1024 / 1024)}MB`);
    }

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!supportedFormats.includes(extension)) {
      errors.push(`Unsupported file format. Supported formats: ${supportedFormats.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }, [maxFileSize, supportedFormats]);

  // File parsing
  const parseFile = useCallback(async (workflow: ImportWorkflow, file: File) => {
    try {
      updateWorkflowStep(workflow.id, 'parse', { status: 'running', startedAt: new Date().toISOString() });

      const parseOptions: ParseOptions = {
        hasHeader: true,
        skipEmptyLines: true,
        trimWhitespace: true,
        maxRows: 10000, // Limit for preview
        encoding: 'utf-8'
      };

      const result = await importServiceRef.current.parseFile(file, parseOptions as any);

      // Generate preview data
      const preview: ImportPreviewData = {
        originalData: result.data.slice(0, 100), // First 100 rows for preview
        transformedData: result.data.slice(0, 100),
        sampleSize: Math.min(100, result.data.length),
        columnMapping: generateInitialMapping(result.headers),
        fieldTypes: inferFieldTypes(result.data, result.headers),
        statistics: generateStatistics(result.data, result.headers)
      };

      setPreviewData(preview);
      updateWorkflowStep(workflow.id, 'parse', {
        status: 'completed',
        completedAt: new Date().toISOString(),
        data: { parseResult: result, preview }
      });

      // Auto-advance to mapping if enabled
      if (autoValidate) {
        await setupColumnMapping(workflow.id, preview.columnMapping);
      }
    } catch (error) {
      console.error('File parsing error:', error);
      updateWorkflowStep(workflow.id, 'parse', {
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Parsing failed']
      });
      onError?.(error instanceof Error ? error : new Error('Parsing failed'));
    }
  }, [autoValidate, onError]);

  // Column mapping
  const updateColumnMapping = useCallback((mapping: ColumnMapping) => {
    if (!importState) return;

    setPreviewData(prev => {
      if (!prev) return null;

      // Apply mapping to transform data
      const transformedData = prev.originalData.map(row => {
        const transformed: any = {};
        Object.entries(mapping).forEach(([field, columnRef]) => {
          if (typeof columnRef === 'number') {
            transformed[field] = row[columnRef];
          } else if (typeof columnRef === 'string') {
            const columnIndex = prev.originalData[0]?.indexOf(columnRef);
            if (columnIndex !== -1) {
              transformed[field] = row[columnIndex];
            }
          }
        });
        return transformed;
      });

      return {
        ...prev,
        columnMapping: mapping,
        transformedData
      };
    });

    updateWorkflowStep(importState.id, 'map', {
      status: 'completed',
      data: { mapping }
    });
  }, [importState]);

  // Setup initial column mapping
  const setupColumnMapping = useCallback(async (workflowId: string, mapping: ColumnMapping) => {
    updateWorkflowStep(workflowId, 'map', {
      status: 'running',
      startedAt: new Date().toISOString()
    });

    // Auto-detect mappings based on common column names (simplified)
    const enhancedMapping = mapping; // Simplified for now

    updateColumnMapping({ ...mapping, ...enhancedMapping });
  }, [updateColumnMapping]);

  // Data validation
  const validateData = useCallback(async (): Promise<ValidationResult> => {
    if (!importState || !previewData) {
      throw new Error('No data to validate');
    }

    try {
      updateWorkflowStep(importState.id, 'validate', {
        status: 'running',
        startedAt: new Date().toISOString()
      });

      const result = { 
        isValid: true, 
        errors: [], 
        warnings: [] 
      } as ValidationResult; // Simplified for now

      setValidationResult(result);
      updateWorkflowStep(importState.id, 'validate', {
        status: result.isValid ? 'completed' : 'failed',
        completedAt: new Date().toISOString(),
        data: { validation: result },
        errors: result.errors.map((e: any) => e.message || e),
        warnings: result.warnings.map((w: any) => w.message || w)
      });

      return result;
    } catch (error) {
      console.error('Data validation error:', error);
      updateWorkflowStep(importState.id, 'validate', {
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Validation failed']
      });
      throw error;
    }
  }, [importState, previewData]);

  // Start import
  const startImport = useCallback(async (): Promise<ImportResult> => {
    if (!importState || !previewData || !validationResult) {
      throw new Error('Import prerequisites not met');
    }

    try {
      // Create abort controller
      abortControllerRef.current = new AbortController();

      updateWorkflowStep(importState.id, 'import', {
        status: 'running',
        startedAt: new Date().toISOString()
      });

      const progressCallback = (progress: ImportProgress) => {
        setProgress(progress);
        onProgress?.(progress);
      };

      const result = {
        success: true,
        imported: previewData.transformedData.length,
        skipped: 0,
        errors: [],
        warnings: [],
        summary: {},
        importId: 'mock-import-id',
        timestamp: new Date().toISOString()
      } as ImportResult; // Simplified for now

      setImportResult(result);
      updateWorkflowStep(importState.id, 'import', {
        status: result.success ? 'completed' : 'failed',
        completedAt: new Date().toISOString(),
        data: { result }
      });

      setImportState(prev => prev ? { ...prev, status: 'completed', completedAt: new Date().toISOString() } : null);

      onComplete?.(result);
      return result;
    } catch (error) {
      console.error('Import error:', error);
      updateWorkflowStep(importState.id, 'import', {
        status: 'failed',
        errors: [error instanceof Error ? error.message : 'Import failed']
      });
      
      setImportState(prev => prev ? { ...prev, status: 'failed' } : null);
      onError?.(error instanceof Error ? error : new Error('Import failed'));
      throw error;
    }
  }, [importState, previewData, validationResult, importSettings, onProgress, onComplete, onError]);

  // Cancel import
  const cancelImport = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setImportState(prev => prev ? { ...prev, status: 'cancelled' } : null);
    setProgress(null);
  }, []);

  // Reset import
  const resetImport = useCallback(() => {
    setImportState(null);
    setProgress(null);
    setPreviewData(null);
    setValidationResult(null);
    setImportResult(null);
    setUploadState({
      isDragOver: false,
      isUploading: false,
      uploadProgress: 0,
      selectedFiles: [],
      rejectedFiles: [],
      errors: []
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Get templates
  const getTemplates = useCallback((): ImportTemplate[] => {
    return []; // Simplified for now
  }, []);

  // Download template
  const downloadTemplate = useCallback((templateId: string) => {
    console.log('Download template:', templateId); // Simplified for now
  }, []);

  // Get sample data
  const getSampleData = useCallback((importType: ImportType): any[] => {
    return []; // Simplified for now
  }, []);

  // Helper functions
  const updateWorkflowStep = useCallback((workflowId: string, stepId: string, updates: any) => {
    setImportState(prev => {
      if (!prev || prev.id !== workflowId) return prev;

      const updatedSteps = prev.steps.map(step => {
        if (step.id === stepId) {
          const updatedStep = { ...step, ...updates };
          if (updates.startedAt && !step.startedAt) {
            updatedStep.startedAt = updates.startedAt;
          }
          if (updates.completedAt && step.startedAt) {
            updatedStep.duration = new Date(updates.completedAt).getTime() - new Date(step.startedAt).getTime();
          }
          return updatedStep;
        }
        return step;
      });

      let currentStep = prev.currentStep;
      if (updates.status === 'completed') {
        const stepIndex = prev.steps.findIndex(s => s.id === stepId);
        if (stepIndex < prev.steps.length - 1) {
          currentStep = stepIndex + 2; // Next step (1-indexed)
        }
      }

      return {
        ...prev,
        steps: updatedSteps,
        currentStep
      };
    });
  }, []);

  const generateInitialMapping = useCallback((headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};
    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Common field mappings
      if (normalizedHeader.includes('date') || normalizedHeader.includes('time')) {
        mapping['date'] = index;
      } else if (normalizedHeader.includes('symbol') || normalizedHeader.includes('asset')) {
        mapping['symbol'] = index;
      } else if (normalizedHeader.includes('amount') || normalizedHeader.includes('quantity')) {
        mapping['amount'] = index;
      } else if (normalizedHeader.includes('price')) {
        mapping['price'] = index;
      } else if (normalizedHeader.includes('type')) {
        mapping['type'] = index;
      } else if (normalizedHeader.includes('fee')) {
        mapping['fee'] = index;
      }
    });
    
    return mapping;
  }, []);

  const inferFieldTypes = useCallback((data: any[], headers: string[]): { [field: string]: 'string' | 'number' | 'date' | 'boolean' | 'json' } => {
    const types: { [field: string]: 'string' | 'number' | 'date' | 'boolean' | 'json' } = {};
    
    headers.forEach((header, index) => {
      const sampleValues = data.slice(0, 10).map(row => row[index]).filter(v => v != null && v !== '');
      
      if (sampleValues.length === 0) {
        types[header] = 'string';
        return;
      }

      const isNumber = sampleValues.every(v => !isNaN(Number(v)));
      const isDate = sampleValues.every(v => !isNaN(Date.parse(v)));
      const isBoolean = sampleValues.every(v => v === 'true' || v === 'false' || v === true || v === false);

      if (isBoolean) {
        types[header] = 'boolean';
      } else if (isNumber) {
        types[header] = 'number';
      } else if (isDate) {
        types[header] = 'date';
      } else {
        types[header] = 'string';
      }
    });

    return types;
  }, []);

  const generateStatistics = useCallback((data: any[], headers: string[]): any => {
    const stats = {
      nullValues: {} as { [field: string]: number },
      uniqueValues: {} as { [field: string]: number },
      dataDistribution: {} as { [field: string]: any }
    };

    headers.forEach((header, index) => {
      const values = data.map(row => row[index]);
      const nonNullValues = values.filter(v => v != null && v !== '');
      
      stats.nullValues[header] = values.length - nonNullValues.length;
      stats.uniqueValues[header] = new Set(nonNullValues).size;
      
      // Basic distribution for numeric fields
      const numericValues = nonNullValues.filter(v => !isNaN(Number(v))).map(Number);
      if (numericValues.length > 0) {
        stats.dataDistribution[header] = {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((sum, v) => sum + v, 0) / numericValues.length
        };
      }
    });

    return stats;
  }, []);

  // Drag and drop handlers
  useEffect(() => {
    if (!enableDragDrop) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current++;
      setUploadState(prev => ({ ...prev, isDragOver: true }));
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setUploadState(prev => ({ ...prev, isDragOver: false }));
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setUploadState(prev => ({ ...prev, isDragOver: false }));

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length > 0) {
        const file = files[0];
        await selectFile(file, 'generic');
      }
    };

    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [enableDragDrop, selectFile]);

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
    importState,
    progress,
    previewData,
    validationResult,
    importResult,
    
    // Actions
    selectFile,
    updateColumnMapping,
    validateData,
    startImport,
    cancelImport,
    resetImport,
    
    // Utils
    getTemplates,
    downloadTemplate,
    getSampleData
  };
};