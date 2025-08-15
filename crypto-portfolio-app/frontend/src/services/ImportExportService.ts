import {
  ImportFile,
  ParseOptions,
  ParseResult,
  ImportType,
  ImportTemplate,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ImportResult,
  ImportHistoryEntry,
  ExportOptions,
  ExportResult,
  ExportFormat,
  ImportProgress,
  ExportProgress,
  BatchImportConfig,
  ImportPerformanceMetrics,
  DataQualityReport,
  FileFormatDetection,
  ColumnMapping,
  ImportExportConfig
} from '../types/importExport.types';

export class ImportExportService {
  private config: ImportExportConfig;
  private performanceMetrics = new Map<string, ImportPerformanceMetrics>();
  private importHistory: ImportHistoryEntry[] = [];

  constructor(config?: Partial<ImportExportConfig>) {
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      supportedFormats: ['csv', 'xlsx', 'json', 'txt'],
      batchSizes: {
        csv: 1000,
        xlsx: 500,
        json: 2000
      },
      timeouts: {
        parse: 30000,
        validate: 15000,
        import: 60000,
        export: 45000
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000
      },
      caching: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 100
      },
      security: {
        allowedMimeTypes: [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/json',
          'text/plain'
        ],
        scanForMalware: false,
        encryptionRequired: false
      },
      ...config
    };

    this.loadImportHistory();
  }

  // File parsing methods
  async parseFile(
    file: File, 
    importType: ImportType, 
    options: ParseOptions = {},
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ParseResult> {
    const startTime = performance.now();
    
    try {
      // Validate file
      await this.validateFile(file);
      
      // Detect file format if not specified
      const formatDetection = await this.detectFileFormat(file);
      
      onProgress?.({
        stage: 'parsing',
        progress: 10,
        message: 'Starting file parsing...',
        details: `Detected format: ${formatDetection.detectedFormat}`,
        startTime: new Date().toISOString(),
        processedRows: 0,
        totalRows: 0,
        errors: 0,
        warnings: 0
      });

      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      let parseResult: ParseResult;

      switch (extension) {
        case 'csv':
        case 'txt':
          parseResult = await this.parseCSV(file, options, onProgress);
          break;
        case 'xlsx':
        case 'xls':
          parseResult = await this.parseExcel(file, options, onProgress);
          break;
        case 'json':
          parseResult = await this.parseJSON(file, options, onProgress);
          break;
        default:
          throw new Error(`Unsupported file format: ${extension}`);
      }

      // Apply import type specific transformations
      const transformedResult = await this.applyImportTypeTransformations(
        parseResult, 
        importType, 
        onProgress
      );

      // Record performance metrics
      const endTime = performance.now();
      this.recordPerformanceMetrics({
        importId: this.generateId(),
        fileSize: file.size,
        recordCount: transformedResult.rowCount,
        parseTime: endTime - startTime,
        validationTime: 0,
        transformationTime: 0,
        importTime: 0,
        totalTime: endTime - startTime,
        memoryUsage: { peak: 0, average: 0 },
        cpuUsage: { peak: 0, average: 0 },
        throughput: {
          recordsPerSecond: transformedResult.rowCount / ((endTime - startTime) / 1000),
          bytesPerSecond: file.size / ((endTime - startTime) / 1000)
        }
      });

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'File parsing completed successfully',
        details: `Parsed ${transformedResult.rowCount} rows`,
        startTime: new Date().toISOString(),
        processedRows: transformedResult.rowCount,
        totalRows: transformedResult.rowCount,
        errors: transformedResult.errors?.length || 0,
        warnings: transformedResult.warnings?.length || 0
      });

      return transformedResult;

    } catch (error) {
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'File parsing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        startTime: new Date().toISOString(),
        processedRows: 0,
        totalRows: 0,
        errors: 1,
        warnings: 0
      });

      throw error;
    }
  }

  private async parseCSV(
    file: File, 
    options: ParseOptions, 
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ParseResult> {
    const text = await file.text();
    const lines = text.split('\n').filter(line => 
      options.skipEmptyLines ? line.trim().length > 0 : true
    );

    const delimiter = options.delimiter || this.detectDelimiter(text);
    const headers: string[] = [];
    const data: any[] = [];
    const errors: any[] = [];
    
    let headerRow = 0;
    if (options.hasHeader !== false) {
      const headerLine = lines[0];
      headers.push(...headerLine.split(delimiter).map(h => 
        options.trimWhitespace ? h.trim().replace(/^"|"$/g, '') : h.replace(/^"|"$/g, '')
      ));
      headerRow = 1;
    }

    // Parse data rows
    for (let i = headerRow; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line && options.skipEmptyLines) continue;

        const values = this.parseCSVLine(line, delimiter);
        
        if (options.trimWhitespace) {
          values.forEach((value, index) => {
            values[index] = typeof value === 'string' ? value.trim() : value;
          });
        }

        const row: any = {};
        if (headers.length > 0) {
          headers.forEach((header, index) => {
            row[header] = values[index] || null;
          });
        } else {
          values.forEach((value, index) => {
            row[`column_${index + 1}`] = value;
          });
        }

        data.push(row);

        // Update progress
        if (i % 1000 === 0) {
          onProgress?.({
            stage: 'parsing',
            progress: Math.min(95, (i / lines.length) * 100),
            message: `Parsing CSV... ${i} of ${lines.length} rows`,
            startTime: new Date().toISOString(),
            processedRows: i - headerRow,
            totalRows: lines.length - headerRow,
            errors: errors.length,
            warnings: 0
          });
        }

      } catch (error) {
        errors.push({
          row: i + 1,
          message: `Failed to parse row: ${error}`,
          severity: 'error'
        });
      }
    }

    return {
      data,
      headers: headers.length > 0 ? headers : data[0] ? Object.keys(data[0]) : [],
      rowCount: data.length,
      columns: headers.length || (data[0] ? Object.keys(data[0]).length : 0),
      errors,
      metadata: {
        fileSize: file.size,
        parseTime: performance.now(),
        delimiter,
        encoding: options.encoding || 'utf-8'
      }
    };
  }

  private async parseExcel(
    file: File, 
    options: ParseOptions,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ParseResult> {
    // This would require a library like xlsx or exceljs
    // For now, we'll provide a mock implementation
    
    onProgress?.({
      stage: 'parsing',
      progress: 50,
      message: 'Parsing Excel file...',
      startTime: new Date().toISOString(),
      processedRows: 0,
      totalRows: 0,
      errors: 0,
      warnings: 0
    });

    // Mock Excel parsing - in reality you'd use xlsx library
    throw new Error('Excel parsing not implemented - requires xlsx library');
  }

  private async parseJSON(
    file: File, 
    options: ParseOptions,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ParseResult> {
    const text = await file.text();
    
    try {
      const jsonData = JSON.parse(text);
      let data: any[] = [];

      // Handle different JSON structures
      if (Array.isArray(jsonData)) {
        data = jsonData;
      } else if (jsonData.data && Array.isArray(jsonData.data)) {
        data = jsonData.data;
      } else if (jsonData.transactions && Array.isArray(jsonData.transactions)) {
        data = jsonData.transactions;
      } else {
        // Single object - wrap in array
        data = [jsonData];
      }

      const headers = data.length > 0 ? Object.keys(data[0]) : [];

      onProgress?.({
        stage: 'parsing',
        progress: 100,
        message: 'JSON parsing completed',
        startTime: new Date().toISOString(),
        processedRows: data.length,
        totalRows: data.length,
        errors: 0,
        warnings: 0
      });

      return {
        data,
        headers,
        rowCount: data.length,
        columns: headers.length,
        metadata: {
          fileSize: file.size,
          parseTime: performance.now(),
          encoding: 'utf-8'
        }
      };

    } catch (error) {
      throw new Error(`Invalid JSON format: ${error}`);
    }
  }

  // Data validation
  async validateImportData(
    data: any[], 
    importType: ImportType,
    columnMapping?: ColumnMapping
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let validCount = 0;

    const template = this.getImportTemplate(importType);
    if (!template) {
      throw new Error(`Unknown import type: ${importType}`);
    }

    // Validate each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowErrors: ValidationError[] = [];
      const rowWarnings: ValidationWarning[] = [];

      // Check required fields
      for (const requiredField of template.requiredFields) {
        const mappedField = columnMapping?.[requiredField] || requiredField;
        const value = typeof mappedField === 'number' ? 
          Object.values(row)[mappedField] : row[mappedField];

        if (value === undefined || value === null || value === '') {
          rowErrors.push({
            row: i + 1,
            field: requiredField,
            message: `Missing required field: ${requiredField}`,
            value: value,
            code: 'MISSING_REQUIRED_FIELD'
          });
        }
      }

      // Apply validation rules
      for (const rule of template.validationRules) {
        const mappedField = columnMapping?.[rule.field] || rule.field;
        const value = typeof mappedField === 'number' ? 
          Object.values(row)[mappedField] : row[mappedField];

        const validationError = this.applyValidationRule(rule, value, i + 1);
        if (validationError) {
          if (rule.severity === 'error') {
            rowErrors.push(validationError);
          } else {
            rowWarnings.push({
              row: i + 1,
              field: rule.field,
              message: validationError.message,
              value: value,
              code: validationError.code
            });
          }
        }
      }

      if (rowErrors.length === 0) {
        validCount++;
      }

      errors.push(...rowErrors);
      warnings.push(...rowWarnings);
    }

    // Generate summary statistics
    const summary = this.generateValidationSummary(data, errors, warnings);

    return {
      isValid: errors.length === 0,
      validCount,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      summary
    };
  }

  // Data transformation
  private async applyImportTypeTransformations(
    parseResult: ParseResult,
    importType: ImportType,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ParseResult> {
    const template = this.getImportTemplate(importType);
    if (!template) return parseResult;

    onProgress?.({
      stage: 'transforming',
      progress: 0,
      message: 'Applying transformations...',
      startTime: new Date().toISOString(),
      processedRows: 0,
      totalRows: parseResult.data.length,
      errors: 0,
      warnings: 0
    });

    const transformedData = parseResult.data.map((row, index) => {
      const transformedRow = { ...row };

      // Apply transformation rules
      for (const rule of template.transformationRules) {
        try {
          transformedRow[rule.field] = this.applyTransformationRule(rule, row);
        } catch (error) {
          console.warn(`Transformation failed for row ${index + 1}, field ${rule.field}:`, error);
        }
      }

      return transformedRow;
    });

    onProgress?.({
      stage: 'transforming',
      progress: 100,
      message: 'Transformations completed',
      startTime: new Date().toISOString(),
      processedRows: transformedData.length,
      totalRows: parseResult.data.length,
      errors: 0,
      warnings: 0
    });

    return {
      ...parseResult,
      data: transformedData
    };
  }

  // Import execution
  async importPortfolioData(
    data: any[], 
    importType: ImportType,
    config?: BatchImportConfig
  ): Promise<ImportResult> {
    const importId = this.generateId();
    const startTime = new Date().toISOString();

    try {
      const batchSize = config?.batchSize || this.config.batchSizes[importType] || 1000;
      const batches = this.createBatches(data, batchSize);
      
      let importedCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          const batchResult = await this.processBatch(batch, importType, i);
          importedCount += batchResult.imported;
          skippedCount += batchResult.skipped;
          errors.push(...batchResult.errors);

          config?.onProgress?.({
            stage: 'importing',
            progress: ((i + 1) / batches.length) * 100,
            message: `Processing batch ${i + 1} of ${batches.length}`,
            startTime,
            processedRows: importedCount + skippedCount,
            totalRows: data.length,
            errors: errors.length,
            warnings: 0
          });

          config?.onBatchComplete?.(i, batchResult);

        } catch (error) {
          const errorObj = {
            batch: i,
            message: error instanceof Error ? error.message : 'Unknown error',
            code: 'BATCH_PROCESSING_ERROR',
            severity: 'critical' as const
          };
          
          errors.push(errorObj);
          config?.onError?.(error as Error, i);
          
          if (config?.stopOnError) {
            throw error;
          }
        }
      }

      // Record import in history
      const historyEntry: ImportHistoryEntry = {
        id: importId,
        fileName: `import_${importId}`,
        fileSize: 0, // Would be set from original file
        importType,
        timestamp: startTime,
        status: errors.length === 0 ? 'success' : errors.length < data.length ? 'partial' : 'failed',
        recordCount: data.length,
        successfulImports: importedCount,
        errors: errors.length,
        warnings: 0
      };

      this.addToImportHistory(historyEntry);

      const summary = {
        totalRecords: data.length,
        successfulImports: importedCount,
        failedImports: errors.length,
        duplicatesSkipped: skippedCount,
        assetsAdded: [...new Set(data.map(d => d.asset).filter(Boolean))],
        transactionTypes: this.countTransactionTypes(data),
        dateRange: this.getDateRange(data),
        portfolioImpact: {
          totalValue: data.reduce((sum, d) => sum + (parseFloat(d.total) || 0), 0),
          newAssets: 0,
          updatedAssets: 0
        }
      };

      return {
        success: errors.length === 0,
        imported: importedCount,
        skipped: skippedCount,
        errors,
        warnings: [],
        summary,
        importId,
        timestamp: startTime
      };

    } catch (error) {
      throw new Error(`Import failed: ${error}`);
    }
  }

  // Export functionality
  async exportData(
    data: any[], 
    options: ExportOptions,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const startTime = performance.now();
    
    try {
      onProgress?.({
        stage: 'preparing',
        progress: 0,
        message: 'Preparing export...',
        recordsProcessed: 0,
        totalRecords: data.length,
        startTime: new Date().toISOString()
      });

      // Apply filters
      let filteredData = this.applyExportFilters(data, options);
      
      onProgress?.({
        stage: 'filtering',
        progress: 25,
        message: 'Filtering data...',
        recordsProcessed: filteredData.length,
        totalRecords: data.length,
        startTime: new Date().toISOString()
      });

      // Sort data
      if (options.sortBy) {
        filteredData = this.sortData(filteredData, options.sortBy, options.sortOrder);
      }

      onProgress?.({
        stage: 'formatting',
        progress: 50,
        message: 'Formatting data...',
        recordsProcessed: filteredData.length,
        totalRecords: data.length,
        startTime: new Date().toISOString()
      });

      // Generate export based on format
      let result: ExportResult;
      
      switch (options.format) {
        case 'csv':
          result = await this.exportToCSV(filteredData, options);
          break;
        case 'excel':
          result = await this.exportToExcel(filteredData, options);
          break;
        case 'json':
          result = await this.exportToJSON(filteredData, options);
          break;
        case 'pdf':
          result = await this.exportToPDF(filteredData, options);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      onProgress?.({
        stage: 'complete',
        progress: 100,
        message: 'Export completed successfully',
        recordsProcessed: filteredData.length,
        totalRecords: data.length,
        startTime: new Date().toISOString()
      });

      const endTime = performance.now();
      result.metadata.generatedAt = new Date().toISOString();

      return result;

    } catch (error) {
      onProgress?.({
        stage: 'error',
        progress: 0,
        message: 'Export failed',
        recordsProcessed: 0,
        totalRecords: data.length,
        startTime: new Date().toISOString()
      });

      throw error;
    }
  }

  // Template management
  getImportTemplates(): ImportTemplate[] {
    return [
      {
        id: 'generic',
        name: 'Generic Portfolio',
        description: 'Standard portfolio import format',
        type: 'generic',
        requiredFields: ['date', 'asset', 'type', 'quantity'],
        optionalFields: ['price', 'total', 'fees', 'exchange'],
        fieldMappings: {
          date: ['date', 'timestamp', 'time'],
          asset: ['asset', 'symbol', 'coin', 'currency'],
          type: ['type', 'action', 'transaction_type'],
          quantity: ['quantity', 'amount', 'size'],
          price: ['price', 'rate', 'unit_price'],
          total: ['total', 'value', 'amount_total'],
          fees: ['fees', 'fee', 'commission']
        },
        sampleData: [
          {
            date: '2023-01-01',
            asset: 'BTC',
            type: 'buy',
            quantity: '0.1',
            price: '45000',
            total: '4500',
            fees: '15'
          }
        ],
        validationRules: [
          {
            field: 'date',
            type: 'type',
            constraint: 'date',
            message: 'Date must be in valid date format',
            severity: 'error'
          },
          {
            field: 'quantity',
            type: 'type',
            constraint: 'number',
            message: 'Quantity must be a number',
            severity: 'error'
          }
        ],
        transformationRules: [
          {
            field: 'asset',
            operation: 'convert',
            parameters: { case: 'upper' }
          },
          {
            field: 'date',
            operation: 'format',
            parameters: { format: 'ISO' }
          }
        ],
        category: 'generic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'coinbase',
        name: 'Coinbase Export',
        description: 'Import from Coinbase transaction export',
        type: 'coinbase',
        requiredFields: ['Timestamp', 'Transaction Type', 'Asset', 'Quantity Transacted'],
        optionalFields: ['Spot Price Currency', 'Spot Price at Transaction', 'Subtotal', 'Total (inclusive of fees)', 'Fees'],
        fieldMappings: {
          timestamp: ['Timestamp'],
          type: ['Transaction Type'],
          asset: ['Asset'],
          quantity: ['Quantity Transacted'],
          price: ['Spot Price at Transaction'],
          subtotal: ['Subtotal'],
          total: ['Total (inclusive of fees)'],
          fees: ['Fees']
        },
        sampleData: [
          {
            'Timestamp': '2023-01-01T10:00:00Z',
            'Transaction Type': 'Buy',
            'Asset': 'BTC',
            'Quantity Transacted': '0.001',
            'Spot Price Currency': 'USD',
            'Spot Price at Transaction': '45000.00',
            'Subtotal': '45.00',
            'Total (inclusive of fees)': '46.99',
            'Fees': '1.99'
          }
        ],
        validationRules: [],
        transformationRules: [
          {
            field: 'type',
            operation: 'convert',
            parameters: { 
              mapping: {
                'Buy': 'buy',
                'Sell': 'sell',
                'Receive': 'receive',
                'Send': 'send'
              }
            }
          }
        ],
        category: 'exchange',
        icon: '🏦',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      // Additional templates would be added here
    ];
  }

  getImportTemplate(type: ImportType): ImportTemplate | null {
    return this.getImportTemplates().find(t => t.type === type) || null;
  }

  // Utility methods
  private async validateFile(file: File): Promise<void> {
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File size ${file.size} exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    if (!this.config.security.allowedMimeTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }
  }

  private async detectFileFormat(file: File): Promise<FileFormatDetection> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const firstChunk = await this.readFileChunk(file, 0, 1024);
    
    let detectedFormat = extension || 'unknown';
    let confidence = 0.5;
    const reasons: string[] = [];

    // CSV detection
    if (firstChunk.includes(',') || firstChunk.includes(';')) {
      detectedFormat = 'csv';
      confidence = 0.8;
      reasons.push('Contains comma or semicolon delimiters');
    }

    // JSON detection
    if (firstChunk.trim().startsWith('{') || firstChunk.trim().startsWith('[')) {
      detectedFormat = 'json';
      confidence = 0.9;
      reasons.push('Starts with JSON structure');
    }

    return {
      detectedFormat,
      confidence,
      reasons,
      suggestedOptions: {
        delimiter: this.detectDelimiter(firstChunk),
        hasHeader: true,
        encoding: 'utf-8'
      },
      alternativeFormats: []
    };
  }

  private async readFileChunk(file: File, start: number, length: number): Promise<string> {
    const slice = file.slice(start, start + length);
    const arrayBuffer = await slice.arrayBuffer();
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(arrayBuffer);
  }

  private detectDelimiter(text: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(delimiter => ({
      delimiter,
      count: text.split(delimiter).length - 1
    }));

    return counts.reduce((max, current) => 
      current.count > max.count ? current : max
    ).delimiter;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  private applyValidationRule(rule: any, value: any, row: number): ValidationError | null {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return {
            row,
            field: rule.field,
            message: rule.message,
            value,
            code: 'REQUIRED_FIELD_MISSING'
          };
        }
        break;

      case 'type':
        if (!this.validateType(value, rule.constraint)) {
          return {
            row,
            field: rule.field,
            message: rule.message,
            value,
            code: 'INVALID_TYPE'
          };
        }
        break;

      case 'range':
        if (typeof value === 'number') {
          if (rule.constraint.min !== undefined && value < rule.constraint.min) {
            return {
              row,
              field: rule.field,
              message: `Value ${value} is below minimum ${rule.constraint.min}`,
              value,
              code: 'VALUE_BELOW_MINIMUM'
            };
          }
          if (rule.constraint.max !== undefined && value > rule.constraint.max) {
            return {
              row,
              field: rule.field,
              message: `Value ${value} is above maximum ${rule.constraint.max}`,
              value,
              code: 'VALUE_ABOVE_MAXIMUM'
            };
          }
        }
        break;

      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.constraint).test(value)) {
          return {
            row,
            field: rule.field,
            message: rule.message,
            value,
            code: 'PATTERN_MISMATCH'
          };
        }
        break;
    }

    return null;
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'number':
        return !isNaN(parseFloat(value)) && isFinite(value);
      case 'date':
        return !isNaN(Date.parse(value));
      case 'string':
        return typeof value === 'string' || value?.toString;
      case 'boolean':
        return typeof value === 'boolean' || 
               ['true', 'false', '1', '0', 'yes', 'no'].includes(String(value).toLowerCase());
      default:
        return true;
    }
  }

  private generateValidationSummary(data: any[], errors: ValidationError[], warnings: ValidationWarning[]): any {
    const fieldCoverage: { [field: string]: number } = {};
    const dataTypes: { [field: string]: string } = {};
    
    if (data.length > 0) {
      const firstRow = data[0];
      Object.keys(firstRow).forEach(field => {
        const nonNullCount = data.filter(row => row[field] != null && row[field] !== '').length;
        fieldCoverage[field] = (nonNullCount / data.length) * 100;
        
        // Determine data type
        const sample = data.find(row => row[field] != null && row[field] !== '');
        if (sample) {
          dataTypes[field] = this.inferDataType(sample[field]);
        }
      });
    }

    return {
      totalRows: data.length,
      processedRows: data.length - errors.filter(e => e.code === 'ROW_PROCESSING_ERROR').length,
      skippedRows: 0,
      duplicateRows: 0,
      emptyRows: 0,
      fieldCoverage,
      dataTypes
    };
  }

  private inferDataType(value: any): string {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'string') {
      if (!isNaN(parseFloat(value))) return 'number';
      if (!isNaN(Date.parse(value))) return 'date';
      return 'string';
    }
    return 'unknown';
  }

  private applyTransformationRule(rule: any, row: any): any {
    const value = row[rule.field];

    switch (rule.operation) {
      case 'convert':
        if (rule.parameters.case === 'upper') {
          return String(value).toUpperCase();
        } else if (rule.parameters.case === 'lower') {
          return String(value).toLowerCase();
        } else if (rule.parameters.mapping) {
          return rule.parameters.mapping[value] || value;
        }
        break;

      case 'format':
        if (rule.parameters.format === 'ISO' && value) {
          return new Date(value).toISOString();
        }
        break;

      case 'calculate':
        // Implement calculation logic
        break;
    }

    return value;
  }

  private createBatches<T>(data: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  private async processBatch(batch: any[], importType: ImportType, batchIndex: number): Promise<any> {
    // Mock batch processing
    return {
      imported: batch.length,
      skipped: 0,
      errors: []
    };
  }

  // Export methods
  private async exportToCSV(data: any[], options: ExportOptions): Promise<ExportResult> {
    const fields = options.includeFields.length > 0 ? options.includeFields : Object.keys(data[0] || {});
    const excludeFields = options.excludeFields || [];
    const exportFields = fields.filter(field => !excludeFields.includes(field));

    let csvContent = '';

    // Add headers
    if (options.includeHeaders) {
      csvContent += exportFields.join(',') + '\n';
    }

    // Add data rows
    for (const row of data) {
      const values = exportFields.map(field => {
        const value = row[field];
        if (value === null || value === undefined) return '';
        
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvContent += values.join(',') + '\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const fileName = `export_${new Date().toISOString().split('T')[0]}.csv`;

    return {
      success: true,
      fileName,
      fileSize: blob.size,
      blob,
      recordCount: data.length,
      format: 'csv',
      timestamp: new Date().toISOString(),
      metadata: {
        generatedAt: new Date().toISOString(),
        recordCount: data.length,
        format: 'csv',
        assets: [...new Set(data.map(d => d.asset).filter(Boolean))],
        totalValue: data.reduce((sum, d) => sum + (parseFloat(d.total) || 0), 0),
        fields: exportFields,
        filters: options.customFilters || [],
        version: '1.0'
      }
    };
  }

  private async exportToExcel(data: any[], options: ExportOptions): Promise<ExportResult> {
    // Mock Excel export - would need xlsx library
    throw new Error('Excel export not implemented - requires xlsx library');
  }

  private async exportToJSON(data: any[], options: ExportOptions): Promise<ExportResult> {
    const fields = options.includeFields.length > 0 ? options.includeFields : Object.keys(data[0] || {});
    const excludeFields = options.excludeFields || [];
    const exportFields = fields.filter(field => !excludeFields.includes(field));

    const exportData = data.map(row => {
      const filteredRow: any = {};
      exportFields.forEach(field => {
        filteredRow[field] = row[field];
      });
      return filteredRow;
    });

    const jsonContent = JSON.stringify({
      metadata: {
        generatedAt: new Date().toISOString(),
        recordCount: exportData.length,
        format: 'json',
        version: '1.0'
      },
      data: exportData
    }, null, 2);

    const blob = new Blob([jsonContent], { type: 'application/json' });
    const fileName = `export_${new Date().toISOString().split('T')[0]}.json`;

    return {
      success: true,
      fileName,
      fileSize: blob.size,
      blob,
      recordCount: data.length,
      format: 'json',
      timestamp: new Date().toISOString(),
      metadata: {
        generatedAt: new Date().toISOString(),
        recordCount: data.length,
        format: 'json',
        assets: [...new Set(data.map(d => d.asset).filter(Boolean))],
        totalValue: data.reduce((sum, d) => sum + (parseFloat(d.total) || 0), 0),
        fields: exportFields,
        filters: options.customFilters || [],
        version: '1.0'
      }
    };
  }

  private async exportToPDF(data: any[], options: ExportOptions): Promise<ExportResult> {
    // Mock PDF export - would need jsPDF or similar
    throw new Error('PDF export not implemented - requires PDF library');
  }

  private applyExportFilters(data: any[], options: ExportOptions): any[] {
    let filtered = [...data];

    // Date range filter
    if (options.dateRange) {
      filtered = filtered.filter(row => {
        const date = new Date(row.date || row.timestamp);
        return date >= new Date(options.dateRange!.start) && 
               date <= new Date(options.dateRange!.end);
      });
    }

    // Assets filter
    if (options.assets && options.assets.length > 0) {
      filtered = filtered.filter(row => 
        options.assets!.includes(row.asset || row.symbol)
      );
    }

    // Transaction types filter
    if (options.transactionTypes && options.transactionTypes.length > 0) {
      filtered = filtered.filter(row =>
        options.transactionTypes!.includes(row.type || row.transaction_type)
      );
    }

    // Custom filters
    if (options.customFilters) {
      for (const filter of options.customFilters) {
        filtered = this.applyCustomFilter(filtered, filter);
      }
    }

    return filtered;
  }

  private applyCustomFilter(data: any[], filter: any): any[] {
    return data.filter(row => {
      const value = row[filter.field];
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'contains':
          return String(value).includes(filter.value);
        case 'greater':
          return parseFloat(value) > parseFloat(filter.value);
        case 'less':
          return parseFloat(value) < parseFloat(filter.value);
        case 'between':
          const numValue = parseFloat(value);
          return numValue >= filter.value[0] && numValue <= filter.value[1];
        case 'in':
          return Array.isArray(filter.value) && filter.value.includes(value);
        default:
          return true;
      }
    });
  }

  private sortData(data: any[], sortBy: string, sortOrder: 'asc' | 'desc' = 'asc'): any[] {
    return [...data].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      else if (aValue > bValue) comparison = 1;
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  // Helper methods
  private countTransactionTypes(data: any[]): { [type: string]: number } {
    return data.reduce((counts, row) => {
      const type = row.type || row.transaction_type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
  }

  private getDateRange(data: any[]): { earliest: string; latest: string } {
    const dates = data.map(row => new Date(row.date || row.timestamp)).filter(date => !isNaN(date.getTime()));
    if (dates.length === 0) {
      return { earliest: '', latest: '' };
    }
    
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    
    return {
      earliest: earliest.toISOString(),
      latest: latest.toISOString()
    };
  }

  private recordPerformanceMetrics(metrics: ImportPerformanceMetrics): void {
    this.performanceMetrics.set(metrics.importId, metrics);
  }

  private addToImportHistory(entry: ImportHistoryEntry): void {
    this.importHistory.unshift(entry);
    if (this.importHistory.length > 100) {
      this.importHistory = this.importHistory.slice(0, 100);
    }
    this.saveImportHistory();
  }

  private loadImportHistory(): void {
    try {
      const stored = localStorage.getItem('import_history');
      if (stored) {
        this.importHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load import history:', error);
      this.importHistory = [];
    }
  }

  private saveImportHistory(): void {
    try {
      localStorage.setItem('import_history', JSON.stringify(this.importHistory));
    } catch (error) {
      console.warn('Failed to save import history:', error);
    }
  }

  private generateId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getImportHistory(): ImportHistoryEntry[] {
    return [...this.importHistory];
  }

  getPerformanceMetrics(importId?: string): ImportPerformanceMetrics | ImportPerformanceMetrics[] {
    if (importId) {
      return this.performanceMetrics.get(importId) || {} as ImportPerformanceMetrics;
    }
    return Array.from(this.performanceMetrics.values());
  }

  async rollbackImport(importId: string): Promise<boolean> {
    // Implementation for rollback functionality
    console.log(`Rolling back import ${importId}`);
    return true;
  }
}

export const importExportService = new ImportExportService();