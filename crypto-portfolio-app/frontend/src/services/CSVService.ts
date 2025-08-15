import { ParseOptions, ParseResult, ParseError, ExportOptions } from '../types/importExport.types';

export class CSVService {
  private static readonly DEFAULT_DELIMITER = ',';
  private static readonly QUOTE_CHAR = '"';
  // private static readonly ESCAPE_CHAR = '"';
  private static readonly LINE_BREAK = '\n';

  /**
   * Parse CSV file content into structured data
   */
  static async parseCSV(content: string, options: ParseOptions = {}): Promise<ParseResult> {
    const {
      delimiter = this.DEFAULT_DELIMITER,
      hasHeader = true,
      encoding = 'utf-8',
      skipEmptyLines = true,
      trimWhitespace = true,
      maxRows
    } = options;

    const startTime = performance.now();
    const errors: ParseError[] = [];
    const warnings: string[] = [];
    let rows: string[][] = [];

    try {
      // Split content into lines
      const lines = content.split(/\r?\n/);
      
      // Process each line
      for (let i = 0; i < lines.length; i++) {
        if (maxRows && rows.length >= maxRows) break;
        
        const line = lines[i];
        
        // Skip empty lines if requested
        if (skipEmptyLines && !line.trim()) {
          continue;
        }

        try {
          const parsedRow = this.parseCSVLine(line, delimiter, trimWhitespace);
          if (parsedRow.length > 0 || !skipEmptyLines) {
            rows.push(parsedRow);
          }
        } catch (error) {
          errors.push({
            row: i + 1,
            message: `Failed to parse line: ${error instanceof Error ? error.message : 'Unknown error'}`,
            value: line,
            severity: 'error'
          });
        }
      }

      // Extract headers
      let headers: string[] = [];
      let originalHeaders: string[] = [];
      let dataRows = rows;

      if (hasHeader && rows.length > 0) {
        originalHeaders = [...rows[0]];
        headers = rows[0].map((header, index) => 
          header.trim() || `Column_${index + 1}`
        );
        dataRows = rows.slice(1);
      } else {
        // Generate default headers
        const maxColumns = Math.max(...rows.map(row => row.length));
        headers = Array.from({ length: maxColumns }, (_, i) => `Column_${i + 1}`);
      }

      // Validate data consistency
      const expectedColumns = headers.length;
      dataRows.forEach((row, index) => {
        if (row.length !== expectedColumns) {
          warnings.push(
            `Row ${hasHeader ? index + 2 : index + 1} has ${row.length} columns, expected ${expectedColumns}`
          );
          
          // Pad or trim row to match expected columns
          if (row.length < expectedColumns) {
            row.push(...Array(expectedColumns - row.length).fill(''));
          } else if (row.length > expectedColumns) {
            row.splice(expectedColumns);
          }
        }
      });

      // Convert to object format
      const data = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });

      const parseTime = performance.now() - startTime;

      return {
        data,
        headers,
        originalHeaders: hasHeader ? originalHeaders : undefined,
        rowCount: data.length,
        columns: headers.length,
        errors,
        warnings,
        metadata: {
          fileSize: content.length,
          parseTime,
          encoding,
          delimiter
        }
      };
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse a single CSV line into fields
   */
  private static parseCSVLine(line: string, delimiter: string, trimWhitespace: boolean): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === this.QUOTE_CHAR) {
        if (inQuotes && nextChar === this.QUOTE_CHAR) {
          // Escaped quote
          current += this.QUOTE_CHAR;
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        // Field delimiter
        fields.push(trimWhitespace ? current.trim() : current);
        current = '';
        i++;
      } else {
        // Regular character
        current += char;
        i++;
      }
    }

    // Add final field
    fields.push(trimWhitespace ? current.trim() : current);

    return fields;
  }

  /**
   * Generate CSV content from data
   */
  static generateCSV(data: any[], options: ExportOptions): string {
    const {
      includeHeaders = true,
      includeFields = [],
      excludeFields = [],
      sortBy,
      sortOrder = 'asc'
    } = options;

    if (!data || data.length === 0) {
      return '';
    }

    // Determine fields to include
    const allFields = Object.keys(data[0]);
    let fields = includeFields.length > 0 ? includeFields : allFields;
    
    if (excludeFields.length > 0) {
      fields = fields.filter(field => !excludeFields.includes(field));
    }

    // Sort data if requested
    let sortedData = [...data];
    if (sortBy && fields.includes(sortBy)) {
      sortedData.sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        
        let comparison = 0;
        if (aVal < bVal) comparison = -1;
        if (aVal > bVal) comparison = 1;
        
        return sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    const lines: string[] = [];

    // Add headers
    if (includeHeaders) {
      lines.push(fields.map(field => this.escapeCSVField(field)).join(','));
    }

    // Add data rows
    sortedData.forEach(item => {
      const row = fields.map(field => {
        const value = item[field];
        return this.escapeCSVField(this.formatValue(value));
      });
      lines.push(row.join(','));
    });

    return lines.join(this.LINE_BREAK);
  }

  /**
   * Escape CSV field if it contains special characters
   */
  private static escapeCSVField(value: string): string {
    const stringValue = String(value ?? '');
    
    // Check if escaping is needed
    if (
      stringValue.includes(this.DEFAULT_DELIMITER) ||
      stringValue.includes(this.QUOTE_CHAR) ||
      stringValue.includes('\n') ||
      stringValue.includes('\r')
    ) {
      // Escape quotes and wrap in quotes
      const escaped = stringValue.replace(/"/g, '""');
      return `"${escaped}"`;
    }

    return stringValue;
  }

  /**
   * Format value for CSV output
   */
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value.toString();
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    return String(value);
  }

  /**
   * Detect CSV delimiter from content sample
   */
  static detectDelimiter(content: string): string {
    const sampleSize = Math.min(content.length, 1000);
    const sample = content.substring(0, sampleSize);
    
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(delimiter => ({
      delimiter,
      count: (sample.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    }));

    // Sort by count descending
    counts.sort((a, b) => b.count - a.count);

    // Return the most frequent delimiter, default to comma
    return counts[0].count > 0 ? counts[0].delimiter : ',';
  }

  /**
   * Validate CSV format
   */
  static validateCSV(content: string, options: ParseOptions = {}): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!content || content.trim().length === 0) {
        errors.push('CSV content is empty');
        return { isValid: false, errors, warnings };
      }

      const lines = content.split(/\r?\n/).filter(line => line.trim());
      if (lines.length === 0) {
        errors.push('No valid data lines found');
        return { isValid: false, errors, warnings };
      }

      const delimiter = options.delimiter || this.detectDelimiter(content);
      
      // Check first few lines for consistency
      const sampleLines = lines.slice(0, Math.min(10, lines.length));
      const columnCounts = sampleLines.map(line => {
        try {
          return this.parseCSVLine(line, delimiter, false).length;
        } catch {
          return 0;
        }
      });

      const uniqueCounts = [...new Set(columnCounts)];
      if (uniqueCounts.length > 2) {
        warnings.push('Inconsistent column counts detected across rows');
      }

      // Check for common CSV issues
      if (content.includes('\0')) {
        errors.push('File contains null bytes, may be corrupted');
      }

      const quoteCounts = (content.match(/"/g) || []).length;
      if (quoteCounts % 2 !== 0) {
        warnings.push('Unbalanced quotes detected, parsing may be affected');
      }

    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Create CSV download
   */
  static createDownload(data: any[], options: ExportOptions, filename?: string): Blob {
    const csvContent = this.generateCSV(data, options);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    if (filename) {
      // This would trigger download in browser context
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
   * Convert array of objects to CSV format with advanced options
   */
  static toCSV(
    data: any[],
    options: {
      fields?: string[];
      headers?: { [key: string]: string };
      transforms?: { [key: string]: (value: any) => any };
      delimiter?: string;
      quote?: boolean;
      escape?: boolean;
    } = {}
  ): string {
    const {
      fields,
      headers = {},
      transforms = {},
      delimiter = ',',
      quote = false,
      escape = true
    } = options;

    if (!data || data.length === 0) {
      return '';
    }

    const allFields = fields || Object.keys(data[0]);
    const rows: string[] = [];

    // Add header row
    const headerRow = allFields.map(field => {
      const header = headers[field] || field;
      return quote || escape ? this.escapeCSVField(header) : header;
    });
    rows.push(headerRow.join(delimiter));

    // Add data rows
    data.forEach(item => {
      const row = allFields.map(field => {
        let value = item[field];
        
        // Apply transformation if available
        if (transforms[field]) {
          value = transforms[field](value);
        }
        
        const stringValue = this.formatValue(value);
        return quote || escape ? this.escapeCSVField(stringValue) : stringValue;
      });
      rows.push(row.join(delimiter));
    });

    return rows.join(this.LINE_BREAK);
  }
}