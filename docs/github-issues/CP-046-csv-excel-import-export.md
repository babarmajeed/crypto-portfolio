# CP-046: CSV/Excel Portfolio Import and Export System

## Overview
Implement comprehensive CSV and Excel import/export functionality that allows users to import portfolio data from various sources and export their portfolio information for analysis, backup, or sharing with external tools.

## Objectives
- Build robust CSV/Excel import system with validation and error handling
- Create flexible export functionality with customizable formats
- Implement template generation for standardized imports
- Add data mapping and transformation capabilities

## Acceptance Criteria
- [ ] CSV file import with automatic column detection and mapping
- [ ] Excel (.xlsx) file import and export support
- [ ] Template download for standardized portfolio imports
- [ ] Import validation with error reporting and data preview
- [ ] Export customization (date ranges, assets, format options)
- [ ] Batch import for large datasets with progress tracking
- [ ] Import from popular platforms (Coinbase, Binance, etc.)
- [ ] Data transformation and normalization during import
- [ ] Export scheduling and automation
- [ ] Import history and rollback capabilities

## Technical Implementation

### File Structure
```
src/
  components/
    ImportExport/
      ImportExportManager.jsx
      CSVImporter.jsx
      ExcelImporter.jsx
      DataValidator.jsx
      ImportPreview.jsx
      ExportCustomizer.jsx
      TemplateGenerator.jsx
      ImportHistory.jsx
  hooks/
    useFileImport.js
    useDataExport.js
    useImportValidation.js
  services/
    ImportExportService.js
    FileParserService.js
    DataValidationService.js
  utils/
    csvUtils.js
    excelUtils.js
    dataTransformers.js
```

### Import/Export Manager Component
```jsx
// ImportExportManager.jsx
import React, { useState, useRef } from 'react';
import { useFileImport } from '../hooks/useFileImport';
import { useDataExport } from '../hooks/useDataExport';
import CSVImporter from './CSVImporter';
import ExcelImporter from './ExcelImporter';
import ExportCustomizer from './ExportCustomizer';
import TemplateGenerator from './TemplateGenerator';
import ImportHistory from './ImportHistory';

const ImportExportManager = ({ portfolioData, onDataImported }) => {
  const [activeTab, setActiveTab] = useState('import');
  const [importType, setImportType] = useState('csv');
  const [exportFormat, setExportFormat] = useState('csv');
  const fileInputRef = useRef(null);

  const {
    importedData,
    validationResults,
    importProgress,
    isImporting,
    importFile,
    validateImportData,
    confirmImport,
    cancelImport
  } = useFileImport();

  const {
    exportData,
    exportProgress,
    isExporting,
    exportOptions,
    updateExportOptions,
    downloadExport
  } = useDataExport();

  const tabs = [
    { id: 'import', label: 'Import Data', icon: '📥' },
    { id: 'export', label: 'Export Data', icon: '📤' },
    { id: 'templates', label: 'Templates', icon: '📋' },
    { id: 'history', label: 'History', icon: '📚' }
  ];

  const importTypes = [
    { id: 'csv', label: 'CSV File', description: 'Comma-separated values format' },
    { id: 'excel', label: 'Excel File', description: 'Microsoft Excel format (.xlsx)' },
    { id: 'coinbase', label: 'Coinbase Export', description: 'Coinbase transaction export' },
    { id: 'binance', label: 'Binance Export', description: 'Binance transaction history' },
    { id: 'kraken', label: 'Kraken Export', description: 'Kraken ledger export' }
  ];

  const exportFormats = [
    { id: 'csv', label: 'CSV', description: 'Comma-separated values' },
    { id: 'excel', label: 'Excel', description: 'Microsoft Excel format' },
    { id: 'json', label: 'JSON', description: 'JavaScript Object Notation' },
    { id: 'pdf', label: 'PDF Report', description: 'Formatted portfolio report' }
  ];

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      importFile(file, importType);
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      importFile(files[0], importType);
    }
  };

  const renderImportTab = () => (
    <div className="import-section">
      <div className="import-type-selector">
        <h3>Select Import Format</h3>
        <div className="format-grid">
          {importTypes.map(type => (
            <div
              key={type.id}
              className={`format-card ${importType === type.id ? 'selected' : ''}`}
              onClick={() => setImportType(type.id)}
            >
              <h4>{type.label}</h4>
              <p>{type.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="file-upload-area">
        <div
          className="drop-zone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="drop-zone-content">
            <div className="upload-icon">📁</div>
            <h3>Drop your file here or click to browse</h3>
            <p>Supported formats: .csv, .xlsx, .json</p>
            <p>Maximum file size: 10MB</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.json"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      {isImporting && (
        <div className="import-progress">
          <h4>Importing Data...</h4>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${importProgress}%` }}
            ></div>
          </div>
          <p>{importProgress}% complete</p>
        </div>
      )}

      {importedData && !isImporting && (
        <div className="import-preview">
          <h4>Import Preview</h4>
          <div className="preview-stats">
            <div className="stat">
              <label>Total Records:</label>
              <span>{importedData.length}</span>
            </div>
            <div className="stat">
              <label>Valid Records:</label>
              <span>{validationResults?.validCount || 0}</span>
            </div>
            <div className="stat">
              <label>Errors:</label>
              <span className="error-count">{validationResults?.errorCount || 0}</span>
            </div>
          </div>

          {validationResults?.errors?.length > 0 && (
            <div className="validation-errors">
              <h5>Validation Errors:</h5>
              <ul>
                {validationResults.errors.slice(0, 10).map((error, index) => (
                  <li key={index} className="error-item">
                    <strong>Row {error.row}:</strong> {error.message}
                  </li>
                ))}
              </ul>
              {validationResults.errors.length > 10 && (
                <p>...and {validationResults.errors.length - 10} more errors</p>
              )}
            </div>
          )}

          <div className="preview-table">
            <table>
              <thead>
                <tr>
                  {Object.keys(importedData[0] || {}).map(key => (
                    <th key={key}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importedData.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    {Object.values(row).map((value, cellIndex) => (
                      <td key={cellIndex}>{String(value)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {importedData.length > 5 && (
              <p>...and {importedData.length - 5} more rows</p>
            )}
          </div>

          <div className="import-actions">
            <button
              onClick={() => confirmImport(importedData)}
              className="confirm-btn"
              disabled={validationResults?.errorCount > 0}
            >
              Import {validationResults?.validCount || 0} Records
            </button>
            <button
              onClick={cancelImport}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderExportTab = () => (
    <div className="export-section">
      <ExportCustomizer
        portfolioData={portfolioData}
        exportOptions={exportOptions}
        onOptionsChange={updateExportOptions}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onExport={downloadExport}
      />
    </div>
  );

  const renderTemplatesTab = () => (
    <div className="templates-section">
      <TemplateGenerator
        onTemplateDownload={(template) => console.log('Download template:', template)}
      />
    </div>
  );

  const renderHistoryTab = () => (
    <div className="history-section">
      <ImportHistory
        onRollback={(historyId) => console.log('Rollback to:', historyId)}
        onViewDetails={(historyId) => console.log('View details:', historyId)}
      />
    </div>
  );

  return (
    <div className="import-export-manager">
      <div className="manager-header">
        <h2>Portfolio Data Import/Export</h2>
        <p>Import data from exchanges or export your portfolio for analysis</p>
      </div>

      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'import' && renderImportTab()}
        {activeTab === 'export' && renderExportTab()}
        {activeTab === 'templates' && renderTemplatesTab()}
        {activeTab === 'history' && renderHistoryTab()}
      </div>
    </div>
  );
};

export default ImportExportManager;
```

### CSV Importer Component
```jsx
// CSVImporter.jsx
import React, { useState, useEffect } from 'react';
import { csvUtils } from '../utils/csvUtils';
import DataValidator from './DataValidator';
import ImportPreview from './ImportPreview';

const CSVImporter = ({ 
  file, 
  onDataParsed, 
  onValidationComplete,
  importType = 'generic'
}) => {
  const [parseResult, setParseResult] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [parseOptions, setParseOptions] = useState({
    delimiter: ',',
    hasHeader: true,
    encoding: 'utf-8',
    skipEmptyLines: true
  });

  useEffect(() => {
    if (file) {
      parseCSVFile();
    }
  }, [file, parseOptions]);

  const parseCSVFile = async () => {
    try {
      const result = await csvUtils.parseCSV(file, parseOptions);
      setParseResult(result);
      
      // Auto-detect column mapping based on import type
      const mapping = autoDetectColumns(result.headers, importType);
      setColumnMapping(mapping);
      
      onDataParsed?.(result);
    } catch (error) {
      console.error('Error parsing CSV:', error);
    }
  };

  const autoDetectColumns = (headers, type) => {
    const mapping = {};
    const lowerHeaders = headers.map(h => h.toLowerCase());

    switch (type) {
      case 'coinbase':
        mapping.timestamp = findColumn(lowerHeaders, ['timestamp', 'time', 'date']);
        mapping.type = findColumn(lowerHeaders, ['transaction type', 'type']);
        mapping.asset = findColumn(lowerHeaders, ['asset', 'currency', 'coin']);
        mapping.quantity = findColumn(lowerHeaders, ['quantity', 'amount']);
        mapping.price = findColumn(lowerHeaders, ['spot price', 'price']);
        mapping.total = findColumn(lowerHeaders, ['total', 'subtotal']);
        mapping.fees = findColumn(lowerHeaders, ['fees', 'fee']);
        break;

      case 'binance':
        mapping.timestamp = findColumn(lowerHeaders, ['date', 'time']);
        mapping.pair = findColumn(lowerHeaders, ['pair', 'symbol']);
        mapping.type = findColumn(lowerHeaders, ['type', 'side']);
        mapping.price = findColumn(lowerHeaders, ['price']);
        mapping.quantity = findColumn(lowerHeaders, ['quantity', 'amount', 'executed']);
        mapping.fee = findColumn(lowerHeaders, ['fee', 'commission']);
        break;

      case 'generic':
      default:
        mapping.date = findColumn(lowerHeaders, ['date', 'timestamp', 'time']);
        mapping.asset = findColumn(lowerHeaders, ['asset', 'symbol', 'coin', 'currency']);
        mapping.type = findColumn(lowerHeaders, ['type', 'action', 'transaction']);
        mapping.quantity = findColumn(lowerHeaders, ['quantity', 'amount']);
        mapping.price = findColumn(lowerHeaders, ['price', 'rate']);
        mapping.total = findColumn(lowerHeaders, ['total', 'value']);
        break;
    }

    return mapping;
  };

  const findColumn = (headers, searchTerms) => {
    for (const term of searchTerms) {
      const index = headers.findIndex(h => h.includes(term));
      if (index !== -1) return index;
    }
    return -1;
  };

  const handleColumnMapping = (field, columnIndex) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: columnIndex
    }));
  };

  const handleParseOptionsChange = (options) => {
    setParseOptions(prev => ({ ...prev, ...options }));
  };

  const requiredFields = {
    generic: ['date', 'asset', 'type', 'quantity'],
    coinbase: ['timestamp', 'asset', 'type', 'quantity'],
    binance: ['timestamp', 'pair', 'type', 'quantity', 'price']
  };

  const validateMapping = () => {
    const required = requiredFields[importType] || requiredFields.generic;
    return required.every(field => 
      columnMapping[field] !== undefined && columnMapping[field] !== -1
    );
  };

  if (!parseResult) {
    return (
      <div className="csv-importer-loading">
        <div className="loading-spinner"></div>
        <p>Parsing CSV file...</p>
      </div>
    );
  }

  return (
    <div className="csv-importer">
      <div className="parse-options">
        <h4>Parse Options</h4>
        <div className="options-grid">
          <div className="option">
            <label>Delimiter:</label>
            <select
              value={parseOptions.delimiter}
              onChange={(e) => handleParseOptionsChange({ delimiter: e.target.value })}
            >
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value="\t">Tab</option>
              <option value="|">Pipe (|)</option>
            </select>
          </div>
          
          <div className="option">
            <label>
              <input
                type="checkbox"
                checked={parseOptions.hasHeader}
                onChange={(e) => handleParseOptionsChange({ hasHeader: e.target.checked })}
              />
              First row contains headers
            </label>
          </div>

          <div className="option">
            <label>Encoding:</label>
            <select
              value={parseOptions.encoding}
              onChange={(e) => handleParseOptionsChange({ encoding: e.target.value })}
            >
              <option value="utf-8">UTF-8</option>
              <option value="utf-16">UTF-16</option>
              <option value="iso-8859-1">ISO-8859-1</option>
            </select>
          </div>
        </div>
      </div>

      <div className="column-mapping">
        <h4>Column Mapping</h4>
        <p>Map your CSV columns to portfolio fields:</p>
        
        <div className="mapping-grid">
          {Object.keys(requiredFields[importType] || requiredFields.generic).map(field => (
            <div key={field} className="mapping-row">
              <label className="field-label">
                {field.charAt(0).toUpperCase() + field.slice(1)}:
                <span className="required">*</span>
              </label>
              <select
                value={columnMapping[field] || -1}
                onChange={(e) => handleColumnMapping(field, parseInt(e.target.value))}
                className={columnMapping[field] === -1 ? 'unmapped' : 'mapped'}
              >
                <option value={-1}>-- Select Column --</option>
                {parseResult.headers.map((header, index) => (
                  <option key={index} value={index}>
                    {header} (Column {index + 1})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {!validateMapping() && (
          <div className="mapping-warning">
            ⚠️ Please map all required fields before proceeding
          </div>
        )}
      </div>

      <ImportPreview
        data={parseResult.rows.slice(0, 10)}
        headers={parseResult.headers}
        columnMapping={columnMapping}
        onValidationComplete={onValidationComplete}
      />
    </div>
  );
};

export default CSVImporter;
```

### File Import Hook
```javascript
// useFileImport.js
import { useState, useCallback } from 'react';
import { importExportService } from '../services/ImportExportService';

export const useFileImport = () => {
  const [importedData, setImportedData] = useState(null);
  const [validationResults, setValidationResults] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);

  const importFile = useCallback(async (file, importType) => {
    try {
      setIsImporting(true);
      setError(null);
      setImportProgress(0);

      // Parse file based on type
      const parseResult = await importExportService.parseFile(file, importType, {
        onProgress: setImportProgress
      });

      setImportedData(parseResult.data);
      
      // Validate imported data
      const validation = await importExportService.validateImportData(
        parseResult.data, 
        importType
      );
      
      setValidationResults(validation);
      setImportProgress(100);

    } catch (err) {
      setError(err);
    } finally {
      setIsImporting(false);
    }
  }, []);

  const validateImportData = useCallback(async (data, type) => {
    const validation = await importExportService.validateImportData(data, type);
    setValidationResults(validation);
    return validation;
  }, []);

  const confirmImport = useCallback(async (data) => {
    try {
      setIsImporting(true);
      
      const result = await importExportService.importPortfolioData(data, {
        onProgress: setImportProgress
      });

      // Record import in history
      await importExportService.recordImportHistory({
        timestamp: new Date().toISOString(),
        recordCount: data.length,
        status: 'success'
      });

      setImportedData(null);
      setValidationResults(null);
      return result;

    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, []);

  const cancelImport = useCallback(() => {
    setImportedData(null);
    setValidationResults(null);
    setImportProgress(0);
    setError(null);
  }, []);

  return {
    importedData,
    validationResults,
    importProgress,
    isImporting,
    error,
    importFile,
    validateImportData,
    confirmImport,
    cancelImport
  };
};
```

### Import/Export Service
```javascript
// ImportExportService.js
import { csvUtils } from '../utils/csvUtils';
import { excelUtils } from '../utils/excelUtils';
import { dataTransformers } from '../utils/dataTransformers';

class ImportExportService {
  constructor() {
    this.supportedFormats = ['csv', 'xlsx', 'json'];
    this.maxFileSize = 10 * 1024 * 1024; // 10MB
  }

  async parseFile(file, importType, options = {}) {
    if (file.size > this.maxFileSize) {
      throw new Error('File size exceeds maximum limit of 10MB');
    }

    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    switch (fileExtension) {
      case 'csv':
        return await this.parseCSVFile(file, importType, options);
      case 'xlsx':
        return await this.parseExcelFile(file, importType, options);
      case 'json':
        return await this.parseJSONFile(file, importType, options);
      default:
        throw new Error(`Unsupported file format: ${fileExtension}`);
    }
  }

  async parseCSVFile(file, importType, options) {
    const { onProgress } = options;
    
    onProgress?.(10);
    const csvData = await csvUtils.parseCSV(file, {
      delimiter: options.delimiter || ',',
      hasHeader: options.hasHeader !== false
    });

    onProgress?.(50);
    const transformedData = await dataTransformers.transformImportData(
      csvData.rows,
      csvData.headers,
      importType
    );

    onProgress?.(90);
    return {
      data: transformedData,
      originalHeaders: csvData.headers,
      rowCount: csvData.rows.length
    };
  }

  async parseExcelFile(file, importType, options) {
    const { onProgress } = options;
    
    onProgress?.(20);
    const excelData = await excelUtils.parseExcel(file, {
      sheetName: options.sheetName,
      hasHeader: options.hasHeader !== false
    });

    onProgress?.(60);
    const transformedData = await dataTransformers.transformImportData(
      excelData.rows,
      excelData.headers,
      importType
    );

    onProgress?.(90);
    return {
      data: transformedData,
      originalHeaders: excelData.headers,
      rowCount: excelData.rows.length,
      sheets: excelData.sheets
    };
  }

  async parseJSONFile(file, importType, options) {
    const { onProgress } = options;
    
    onProgress?.(30);
    const text = await file.text();
    const jsonData = JSON.parse(text);

    onProgress?.(70);
    const transformedData = await dataTransformers.transformJSONImport(jsonData, importType);

    onProgress?.(90);
    return {
      data: transformedData,
      originalData: jsonData
    };
  }

  async validateImportData(data, importType) {
    const errors = [];
    const warnings = [];
    let validCount = 0;

    const validationRules = this.getValidationRules(importType);

    data.forEach((row, index) => {
      const rowErrors = [];
      
      // Required field validation
      validationRules.required.forEach(field => {
        if (!row[field] || row[field] === '') {
          rowErrors.push(`Missing required field: ${field}`);
        }
      });

      // Data type validation
      Object.entries(validationRules.types).forEach(([field, type]) => {
        if (row[field] && !this.validateDataType(row[field], type)) {
          rowErrors.push(`Invalid ${type} format for field: ${field}`);
        }
      });

      // Custom validation rules
      const customErrors = this.applyCustomValidation(row, importType);
      rowErrors.push(...customErrors);

      if (rowErrors.length > 0) {
        errors.push({
          row: index + 1,
          message: rowErrors.join(', '),
          data: row
        });
      } else {
        validCount++;
      }
    });

    return {
      validCount,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      isValid: errors.length === 0
    };
  }

  getValidationRules(importType) {
    const rules = {
      generic: {
        required: ['date', 'asset', 'type', 'quantity'],
        types: {
          date: 'date',
          quantity: 'number',
          price: 'number',
          total: 'number'
        }
      },
      coinbase: {
        required: ['timestamp', 'asset', 'type', 'quantity'],
        types: {
          timestamp: 'date',
          quantity: 'number',
          price: 'number',
          total: 'number',
          fees: 'number'
        }
      },
      binance: {
        required: ['timestamp', 'pair', 'type', 'quantity', 'price'],
        types: {
          timestamp: 'date',
          quantity: 'number',
          price: 'number',
          fee: 'number'
        }
      }
    };

    return rules[importType] || rules.generic;
  }

  validateDataType(value, type) {
    switch (type) {
      case 'number':
        return !isNaN(parseFloat(value)) && isFinite(value);
      case 'date':
        return !isNaN(Date.parse(value));
      case 'string':
        return typeof value === 'string';
      default:
        return true;
    }
  }

  applyCustomValidation(row, importType) {
    const errors = [];

    // Check for negative quantities in buy/receive transactions
    if (['buy', 'receive'].includes(row.type?.toLowerCase()) && row.quantity < 0) {
      errors.push('Buy/receive transactions should have positive quantities');
    }

    // Check for positive quantities in sell/send transactions
    if (['sell', 'send'].includes(row.type?.toLowerCase()) && row.quantity > 0) {
      errors.push('Sell/send transactions should have negative quantities');
    }

    // Validate price consistency
    if (row.quantity && row.price && row.total) {
      const calculatedTotal = Math.abs(row.quantity * row.price);
      const tolerance = 0.01; // 1 cent tolerance
      
      if (Math.abs(calculatedTotal - Math.abs(row.total)) > tolerance) {
        errors.push('Total amount does not match quantity × price');
      }
    }

    return errors;
  }

  async importPortfolioData(data, options = {}) {
    const { onProgress } = options;
    const batchSize = 100;
    const totalBatches = Math.ceil(data.length / batchSize);
    
    const results = [];
    
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, data.length);
      const batch = data.slice(start, end);
      
      // Process batch
      const batchResults = await this.processBatch(batch);
      results.push(...batchResults);
      
      // Update progress
      const progress = ((i + 1) / totalBatches) * 100;
      onProgress?.(progress);
    }

    return {
      imported: results.length,
      errors: results.filter(r => r.error),
      success: results.filter(r => !r.error)
    };
  }

  async processBatch(batch) {
    return batch.map(row => {
      try {
        // Transform and save to portfolio
        const transaction = this.transformToTransaction(row);
        // Here you would save to your portfolio service
        return { success: true, transaction };
      } catch (error) {
        return { error: error.message, data: row };
      }
    });
  }

  transformToTransaction(row) {
    return {
      id: `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date(row.date || row.timestamp).toISOString(),
      asset: row.asset?.toUpperCase(),
      type: row.type?.toLowerCase(),
      quantity: parseFloat(row.quantity),
      price: parseFloat(row.price || 0),
      total: parseFloat(row.total || (row.quantity * row.price)),
      fees: parseFloat(row.fees || row.fee || 0),
      exchange: row.exchange || 'imported',
      notes: row.notes || `Imported from ${row.source || 'file'}`,
      importedAt: new Date().toISOString()
    };
  }

  async recordImportHistory(importRecord) {
    const history = JSON.parse(localStorage.getItem('importHistory') || '[]');
    history.unshift({
      ...importRecord,
      id: `import_${Date.now()}`
    });
    
    // Keep only last 50 imports
    history.splice(50);
    
    localStorage.setItem('importHistory', JSON.stringify(history));
  }

  async getImportHistory() {
    return JSON.parse(localStorage.getItem('importHistory') || '[]');
  }
}

export const importExportService = new ImportExportService();
```

## Testing Requirements
- File parsing accuracy with various formats and encodings
- Data validation and error handling testing
- Large file import performance testing
- Import rollback functionality testing
- Export format verification and data integrity testing

## Dependencies
- Depends on: CP-001 (Portfolio Dashboard)
- Depends on: CP-003 (Transaction History)
- Blocks: CP-047 (Automated Data Sync)

## Time Estimate
**Beginner**: 10-12 days
**Intermediate**: 7-9 days
**Advanced**: 5-7 days

## Required Skills
- File parsing and data transformation
- CSV and Excel file handling
- Data validation and error handling
- Batch processing and progress tracking
- Import/export UX design patterns