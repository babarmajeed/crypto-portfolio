import { ParseOptions, ParseResult, ParseError, ExportOptions } from '../types/importExport.types';

export class ExcelService {
  private static readonly MAX_SHEET_NAME_LENGTH = 31;
  private static readonly INVALID_SHEET_CHARS = /[\\\/\*\[\]:?]/g;

  /**
   * Parse Excel file (requires xlsx library in actual implementation)
   * This is a mock implementation for the type system
   */
  static async parseExcel(file: File, options: ParseOptions = {}): Promise<ParseResult> {
    const {
      sheetName,
      sheetIndex = 0,
      hasHeader = true,
      skipEmptyLines = true,
      trimWhitespace = true,
      maxRows
    } = options;

    const startTime = performance.now();
    const errors: ParseError[] = [];
    const warnings: string[] = [];

    try {
      // In a real implementation, this would use a library like xlsx or exceljs
      // For now, we'll simulate Excel parsing
      
      const arrayBuffer = await file.arrayBuffer();
      const mockData = this.simulateExcelParsing(arrayBuffer, options);
      
      const parseTime = performance.now() - startTime;

      return {
        data: mockData.data,
        headers: mockData.headers,
        originalHeaders: mockData.originalHeaders,
        rowCount: mockData.data.length,
        columns: mockData.headers.length,
        sheets: mockData.sheets,
        errors,
        warnings,
        metadata: {
          fileSize: file.size,
          parseTime,
          encoding: 'binary'
        }
      };
    } catch (error) {
      throw new Error(`Excel parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simulate Excel parsing (replace with actual xlsx library implementation)
   */
  private static simulateExcelParsing(arrayBuffer: ArrayBuffer, options: ParseOptions): {
    data: any[];
    headers: string[];
    originalHeaders?: string[];
    sheets: string[];
  } {
    // This is a mock implementation
    // In reality, you would use a library like xlsx:
    // import * as XLSX from 'xlsx';
    // const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    const mockSheets = ['Sheet1', 'Summary', 'Data'];
    const targetSheet = options.sheetName || mockSheets[options.sheetIndex || 0];
    
    // Mock data structure that would come from actual Excel parsing
    const mockHeaders = ['Date', 'Symbol', 'Type', 'Amount', 'Price', 'Fee', 'Total'];
    const mockData = [
      {
        'Date': '2024-01-15',
        'Symbol': 'BTC',
        'Type': 'Buy',
        'Amount': 0.1,
        'Price': 42000,
        'Fee': 5.00,
        'Total': 4205.00
      },
      {
        'Date': '2024-01-16',
        'Symbol': 'ETH',
        'Type': 'Buy',
        'Amount': 2.5,
        'Price': 2500,
        'Fee': 8.50,
        'Total': 6258.50
      }
    ];

    return {
      data: mockData,
      headers: mockHeaders,
      originalHeaders: mockHeaders,
      sheets: mockSheets
    };
  }

  /**
   * Generate Excel file content
   */
  static generateExcel(data: any[], options: ExportOptions): ArrayBuffer {
    const {
      includeHeaders = true,
      includeFields = [],
      excludeFields = [],
      sortBy,
      sortOrder = 'asc',
      groupBy
    } = options;

    if (!data || data.length === 0) {
      return new ArrayBuffer(0);
    }

    // In a real implementation, this would use xlsx library
    // For now, we'll create a mock Excel file structure
    return this.createMockExcelFile(data, options);
  }

  /**
   * Create mock Excel file (replace with actual xlsx library implementation)
   */
  private static createMockExcelFile(data: any[], options: ExportOptions): ArrayBuffer {
    // This would use a library like xlsx:
    // import * as XLSX from 'xlsx';
    // 
    // const worksheet = XLSX.utils.json_to_sheet(data);
    // const workbook = XLSX.utils.book_new();
    // XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    // return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    // Mock implementation - returns empty ArrayBuffer
    // In real implementation, this would return actual Excel file bytes
    const mockExcelData = new ArrayBuffer(1024);
    return mockExcelData;
  }

  /**
   * Get worksheet names from Excel file
   */
  static async getWorksheetNames(file: File): Promise<string[]> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Mock implementation
      // In real implementation:
      // const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      // return workbook.SheetNames;
      
      return ['Sheet1', 'Summary', 'Transactions', 'Assets'];
    } catch (error) {
      throw new Error(`Failed to read Excel worksheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate Excel file format
   */
  static async validateExcel(file: File): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (file.size === 0) {
        errors.push('Excel file is empty');
        return { isValid: false, errors, warnings };
      }

      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        warnings.push('Excel file is very large and may take time to process');
      }

      // Check file extension
      const validExtensions = ['.xlsx', '.xls', '.xlsm'];
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validExtensions.includes(extension)) {
        errors.push(`Invalid file extension. Supported formats: ${validExtensions.join(', ')}`);
      }

      // Basic file header validation
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check for Excel file signatures
      const isXLSX = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B; // ZIP signature (XLSX)
      const isXLS = uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF; // OLE signature (XLS)
      
      if (!isXLSX && !isXLS && extension !== '.csv') {
        errors.push('File does not appear to be a valid Excel file');
      }

    } catch (error) {
      errors.push(`Excel validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create Excel download blob
   */
  static createExcelDownload(data: any[], options: ExportOptions, filename?: string): Blob {
    const excelBuffer = this.generateExcel(data, options);
    const blob = new Blob([excelBuffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    if (filename) {
      // Trigger download in browser context
      const link = document.createElement('a');
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }

    return blob;
  }

  /**
   * Convert array of objects to Excel format with multiple sheets
   */
  static toExcel(
    data: { [sheetName: string]: any[] } | any[],
    options: {
      filename?: string;
      sheetNames?: string[];
      headers?: { [key: string]: string };
      columnWidths?: { [key: string]: number };
      styles?: { [key: string]: any };
    } = {}
  ): ArrayBuffer {
    const {
      sheetNames = ['Sheet1'],
      headers = {},
      columnWidths = {},
      styles = {}
    } = options;

    // Normalize data to multi-sheet format
    let sheets: { [sheetName: string]: any[] };
    
    if (Array.isArray(data)) {
      sheets = { [sheetNames[0]]: data };
    } else {
      sheets = data;
    }

    // In real implementation, this would create actual Excel file with multiple sheets
    // For now, return mock ArrayBuffer
    return new ArrayBuffer(2048);
  }

  /**
   * Apply Excel formatting to data
   */
  static formatForExcel(data: any[], options: {
    dateFormat?: string;
    numberFormat?: string;
    currencyFormat?: string;
    percentFormat?: string;
  } = {}): any[] {
    const {
      dateFormat = 'YYYY-MM-DD',
      numberFormat = '0.00',
      currencyFormat = '$0.00',
      percentFormat = '0.00%'
    } = options;

    return data.map(row => {
      const formatted: any = {};
      
      Object.entries(row).forEach(([key, value]) => {
        if (value instanceof Date) {
          formatted[key] = this.formatDate(value, dateFormat);
        } else if (typeof value === 'number') {
          if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('%')) {
            formatted[key] = this.formatPercent(value, percentFormat);
          } else if (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('fee')) {
            formatted[key] = this.formatCurrency(value, currencyFormat);
          } else {
            formatted[key] = this.formatNumber(value, numberFormat);
          }
        } else {
          formatted[key] = value;
        }
      });
      
      return formatted;
    });
  }

  /**
   * Format date value
   */
  private static formatDate(date: Date, format: string): string {
    // Simple date formatting - in real implementation, use proper date library
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes);
  }

  /**
   * Format number value
   */
  private static formatNumber(num: number, format: string): string {
    const decimals = (format.match(/\.(\d+)/) || ['', '2'])[1].length;
    return num.toFixed(decimals);
  }

  /**
   * Format currency value
   */
  private static formatCurrency(num: number, format: string): string {
    const decimals = (format.match(/\.(\d+)/) || ['', '2'])[1].length;
    const symbol = format.charAt(0);
    return `${symbol}${num.toFixed(decimals)}`;
  }

  /**
   * Format percentage value
   */
  private static formatPercent(num: number, format: string): string {
    const decimals = (format.match(/\.(\d+)/) || ['', '2'])[1].length;
    return `${(num * 100).toFixed(decimals)}%`;
  }

  /**
   * Sanitize sheet name for Excel compatibility
   */
  static sanitizeSheetName(name: string): string {
    let sanitized = name
      .replace(this.INVALID_SHEET_CHARS, '_')
      .substring(0, this.MAX_SHEET_NAME_LENGTH);
    
    // Sheet names cannot be empty
    if (!sanitized.trim()) {
      sanitized = 'Sheet1';
    }
    
    return sanitized;
  }

  /**
   * Create Excel template with sample data
   */
  static createTemplate(templateType: 'portfolio' | 'transactions' | 'assets' | 'generic'): ArrayBuffer {
    const templates = {
      portfolio: [
        { Date: '2024-01-01', Symbol: 'BTC', Amount: 0.5, Price: 40000, Value: 20000 },
        { Date: '2024-01-02', Symbol: 'ETH', Amount: 10, Price: 2500, Value: 25000 }
      ],
      transactions: [
        { Date: '2024-01-01', Symbol: 'BTC', Type: 'Buy', Amount: 0.1, Price: 42000, Fee: 5, Total: 4205 },
        { Date: '2024-01-02', Symbol: 'ETH', Type: 'Sell', Amount: 2, Price: 2600, Fee: 8, Total: 5192 }
      ],
      assets: [
        { Symbol: 'BTC', Name: 'Bitcoin', Amount: 0.5, AvgPrice: 41000, CurrentPrice: 45000, PnL: 2000 },
        { Symbol: 'ETH', Name: 'Ethereum', Amount: 10, AvgPrice: 2400, CurrentPrice: 2700, PnL: 3000 }
      ],
      generic: [
        { Column1: 'Value1', Column2: 'Value2', Column3: 'Value3' },
        { Column1: 'Value4', Column2: 'Value5', Column3: 'Value6' }
      ]
    };

    return this.generateExcel(templates[templateType], {
      format: 'excel',
      includeFields: Object.keys(templates[templateType][0]),
      includeHeaders: true,
      includeMetadata: false
    });
  }
}