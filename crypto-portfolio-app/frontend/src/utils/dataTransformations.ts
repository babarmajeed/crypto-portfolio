import { DataTransformation, ConversionRate } from '../types/importExport.types';

export class DataTransformationUtils {
  private static readonly DATE_FORMATS = [
    'YYYY-MM-DD',
    'MM/DD/YYYY',
    'DD/MM/YYYY',
    'YYYY-MM-DD HH:mm:ss',
    'MM/DD/YYYY HH:mm:ss',
    'DD/MM/YYYY HH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss.sssZ',
    'YYYY-MM-DDTHH:mm:ssZ'
  ];

  private static readonly CURRENCY_SYMBOLS = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    '₿': 'BTC',
    'Ξ': 'ETH'
  };

  /**
   * Apply data transformations to a dataset
   */
  static applyTransformations(data: any[], transformations: DataTransformation[]): any[] {
    let transformedData = [...data];

    // Sort transformations by order
    const sortedTransformations = [...transformations].sort((a, b) => a.order - b.order);

    for (const transformation of sortedTransformations) {
      if (!transformation.enabled) continue;

      try {
        transformedData = this.applyTransformation(transformedData, transformation);
      } catch (error) {
        console.error(`Failed to apply transformation ${transformation.name}:`, error);
        // Continue with other transformations
      }
    }

    return transformedData;
  }

  /**
   * Apply a single transformation to the dataset
   */
  private static applyTransformation(data: any[], transformation: DataTransformation): any[] {
    switch (transformation.type) {
      case 'field-mapping':
        return this.applyFieldMapping(data, transformation.configuration);
      
      case 'value-conversion':
        return this.applyValueConversion(data, transformation.configuration);
      
      case 'data-cleaning':
        return this.applyDataCleaning(data, transformation.configuration);
      
      case 'aggregation':
        return this.applyAggregation(data, transformation.configuration);
      
      case 'filtering':
        return this.applyFiltering(data, transformation.configuration);
      
      default:
        console.warn(`Unknown transformation type: ${transformation.type}`);
        return data;
    }
  }

  /**
   * Apply field mapping transformation
   */
  private static applyFieldMapping(data: any[], config: any): any[] {
    const { mappings, removeOriginal = false } = config;

    return data.map(row => {
      const newRow = { ...row };

      Object.entries(mappings).forEach(([oldField, newField]) => {
        if (row.hasOwnProperty(oldField)) {
          newRow[newField as string] = row[oldField];
          if (removeOriginal && oldField !== newField) {
            delete newRow[oldField];
          }
        }
      });

      return newRow;
    });
  }

  /**
   * Apply value conversion transformation
   */
  private static applyValueConversion(data: any[], config: any): any[] {
    const { field, fromType, toType, format, multiplier = 1, offset = 0 } = config;

    return data.map(row => {
      if (!row.hasOwnProperty(field)) return row;

      let value = row[field];
      
      try {
        switch (`${fromType}->${toType}`) {
          case 'string->number':
            value = this.convertStringToNumber(value);
            break;
          
          case 'string->date':
            value = this.convertStringToDate(value, format);
            break;
          
          case 'number->string':
            value = this.convertNumberToString(value, format);
            break;
          
          case 'date->string':
            value = this.convertDateToString(value, format);
            break;
          
          case 'number->number':
            value = (Number(value) * multiplier) + offset;
            break;
          
          default:
            console.warn(`Unsupported conversion: ${fromType} -> ${toType}`);
        }

        return { ...row, [field]: value };
      } catch (error) {
        console.warn(`Failed to convert value in field ${field}:`, error);
        return row;
      }
    });
  }

  /**
   * Apply data cleaning transformation
   */
  private static applyDataCleaning(data: any[], config: any): any[] {
    const {
      removeEmptyRows = false,
      removeEmptyFields = false,
      trimWhitespace = true,
      removeNulls = false,
      removeDuplicates = false,
      normalizeText = false
    } = config;

    let cleanedData = [...data];

    // Remove empty rows
    if (removeEmptyRows) {
      cleanedData = cleanedData.filter(row => 
        Object.values(row).some(value => value !== null && value !== undefined && value !== '')
      );
    }

    // Clean individual rows
    cleanedData = cleanedData.map(row => {
      const cleanedRow: any = {};

      Object.entries(row).forEach(([key, value]) => {
        let cleanedValue = value;

        // Trim whitespace
        if (trimWhitespace && typeof cleanedValue === 'string') {
          cleanedValue = cleanedValue.trim();
        }

        // Remove nulls/undefined
        if (removeNulls && (cleanedValue === null || cleanedValue === undefined)) {
          return; // Skip this field
        }

        // Remove empty fields
        if (removeEmptyFields && cleanedValue === '') {
          return; // Skip this field
        }

        // Normalize text
        if (normalizeText && typeof cleanedValue === 'string') {
          cleanedValue = this.normalizeText(cleanedValue);
        }

        cleanedRow[key] = cleanedValue;
      });

      return cleanedRow;
    });

    // Remove duplicates
    if (removeDuplicates) {
      const seen = new Set();
      cleanedData = cleanedData.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    return cleanedData;
  }

  /**
   * Apply aggregation transformation
   */
  private static applyAggregation(data: any[], config: any): any[] {
    const { groupBy, aggregations } = config;

    if (!groupBy || !aggregations) {
      return data;
    }

    const grouped = data.reduce((acc, row) => {
      const key = Array.isArray(groupBy) 
        ? groupBy.map(field => row[field]).join('|')
        : row[groupBy];
      
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(row);
      return acc;
    }, {} as { [key: string]: any[] });

    return Object.entries(grouped).map(([key, rows]) => {
      const aggregatedRow: any = {};

      // Include group by fields
      if (Array.isArray(groupBy)) {
        groupBy.forEach((field, index) => {
          aggregatedRow[field] = key.split('|')[index];
        });
      } else {
        aggregatedRow[groupBy] = key;
      }

      // Apply aggregations
      Object.entries(aggregations).forEach(([field, operation]) => {
        const values = (rows as any[]).map((row: any) => Number(row[field])).filter((v: number) => !isNaN(v));
        
        switch (operation) {
          case 'sum':
            aggregatedRow[field] = values.reduce((sum: number, val: number) => sum + val, 0);
            break;
          case 'avg':
            aggregatedRow[field] = values.reduce((sum: number, val: number) => sum + val, 0) / values.length;
            break;
          case 'min':
            aggregatedRow[field] = Math.min(...values);
            break;
          case 'max':
            aggregatedRow[field] = Math.max(...values);
            break;
          case 'count':
            aggregatedRow[field] = (rows as any[]).length;
            break;
          case 'first':
            aggregatedRow[field] = (rows as any[])[0][field];
            break;
          case 'last':
            aggregatedRow[field] = (rows as any[])[(rows as any[]).length - 1][field];
            break;
        }
      });

      return aggregatedRow;
    });
  }

  /**
   * Apply filtering transformation
   */
  private static applyFiltering(data: any[], config: any): any[] {
    const { conditions, operator = 'and' } = config;

    if (!conditions || conditions.length === 0) {
      return data;
    }

    return data.filter(row => {
      const results = conditions.map((condition: any) => {
        const { field, operator: op, value } = condition;
        const rowValue = row[field];

        switch (op) {
          case 'equals':
            return rowValue === value;
          case 'not-equals':
            return rowValue !== value;
          case 'contains':
            return String(rowValue).toLowerCase().includes(String(value).toLowerCase());
          case 'starts-with':
            return String(rowValue).toLowerCase().startsWith(String(value).toLowerCase());
          case 'ends-with':
            return String(rowValue).toLowerCase().endsWith(String(value).toLowerCase());
          case 'greater':
            return Number(rowValue) > Number(value);
          case 'less':
            return Number(rowValue) < Number(value);
          case 'greater-equal':
            return Number(rowValue) >= Number(value);
          case 'less-equal':
            return Number(rowValue) <= Number(value);
          case 'between':
            const [min, max] = Array.isArray(value) ? value : [value, value];
            return Number(rowValue) >= Number(min) && Number(rowValue) <= Number(max);
          case 'in':
            return Array.isArray(value) ? value.includes(rowValue) : rowValue === value;
          case 'not-in':
            return Array.isArray(value) ? !value.includes(rowValue) : rowValue !== value;
          case 'is-null':
            return rowValue === null || rowValue === undefined;
          case 'is-not-null':
            return rowValue !== null && rowValue !== undefined;
          case 'is-empty':
            return rowValue === '';
          case 'is-not-empty':
            return rowValue !== '';
          default:
            return true;
        }
      });

      return operator === 'and' 
        ? results.every(Boolean)
        : results.some(Boolean);
    });
  }

  /**
   * Convert string to number with various formats
   */
  private static convertStringToNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;

    // Remove currency symbols and formatting
    let cleaned = value
      .replace(/[$€£¥₹₿Ξ,\s]/g, '')
      .replace(/[()]/g, ''); // Handle negative numbers in parentheses

    // Handle percentage
    if (cleaned.includes('%')) {
      cleaned = cleaned.replace('%', '');
      return Number(cleaned) / 100;
    }

    return Number(cleaned);
  }

  /**
   * Convert string to date with format detection
   */
  private static convertStringToDate(value: any, format?: string): Date {
    if (value instanceof Date) return value;
    if (typeof value !== 'string') throw new Error('Value must be a string');

    if (format) {
      // Use specific format parsing if provided
      return this.parseDate(value, format);
    }

    // Try common formats
    for (const fmt of this.DATE_FORMATS) {
      try {
        const date = this.parseDate(value, fmt);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch {
        continue;
      }
    }

    // Fallback to native parsing
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Unable to parse date: ${value}`);
    }

    return date;
  }

  /**
   * Parse date with specific format
   */
  private static parseDate(value: string, format: string): Date {
    // Simple format parsing - in real implementation, use a proper date library
    const formats: { [key: string]: RegExp } = {
      'YYYY-MM-DD': /^(\d{4})-(\d{2})-(\d{2})$/,
      'MM/DD/YYYY': /^(\d{2})\/(\d{2})\/(\d{4})$/,
      'DD/MM/YYYY': /^(\d{2})\/(\d{2})\/(\d{4})$/,
      'YYYY-MM-DD HH:mm:ss': /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      'MM/DD/YYYY HH:mm:ss': /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/
    };

    const regex = formats[format];
    if (!regex) {
      return new Date(value);
    }

    const match = value.match(regex);
    if (!match) {
      throw new Error(`Date format mismatch: ${value} does not match ${format}`);
    }

    // Extract date parts based on format
    switch (format) {
      case 'YYYY-MM-DD':
        return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      case 'MM/DD/YYYY':
        return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
      case 'DD/MM/YYYY':
        return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      default:
        return new Date(value);
    }
  }

  /**
   * Convert number to formatted string
   */
  private static convertNumberToString(value: any, format?: string): string {
    const num = Number(value);
    if (isNaN(num)) return String(value);

    if (!format) return String(num);

    // Apply formatting
    if (format.includes('$')) {
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD' 
      }).format(num);
    }

    if (format.includes('%')) {
      return `${(num * 100).toFixed(2)}%`;
    }

    if (format.includes('.')) {
      const decimals = (format.match(/\.(\d+)/) || ['', '2'])[1].length;
      return num.toFixed(decimals);
    }

    return String(num);
  }

  /**
   * Convert date to formatted string
   */
  private static convertDateToString(value: any, format?: string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return String(value);

    if (!format) return date.toISOString();

    // Simple date formatting
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * Normalize text (remove diacritics, standardize case, etc.)
   */
  private static normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .trim();
  }

  /**
   * Detect and convert currency values
   */
  static detectAndConvertCurrency(value: any): { amount: number; currency: string } {
    if (typeof value !== 'string') {
      return { amount: Number(value), currency: 'USD' };
    }

    // Check for currency symbols
    for (const [symbol, currency] of Object.entries(this.CURRENCY_SYMBOLS)) {
      if (value.includes(symbol)) {
        const amount = this.convertStringToNumber(value);
        return { amount, currency };
      }
    }

    // Check for currency codes
    const currencyCodes = ['USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH'];
    for (const code of currencyCodes) {
      if (value.toUpperCase().includes(code)) {
        const amount = this.convertStringToNumber(value.replace(new RegExp(code, 'gi'), ''));
        return { amount, currency: code };
      }
    }

    return { amount: this.convertStringToNumber(value), currency: 'USD' };
  }

  /**
   * Standardize asset symbols
   */
  static standardizeAssetSymbol(symbol: string): string {
    const standardMappings: { [key: string]: string } = {
      'BITCOIN': 'BTC',
      'ETHEREUM': 'ETH',
      'BINANCE COIN': 'BNB',
      'CARDANO': 'ADA',
      'SOLANA': 'SOL',
      'XRP': 'XRP',
      'POLKADOT': 'DOT',
      'DOGECOIN': 'DOGE',
      'AVALANCHE': 'AVAX',
      'TERRA': 'LUNA',
      'CHAINLINK': 'LINK',
      'POLYGON': 'MATIC'
    };

    const upperSymbol = symbol.toUpperCase();
    return standardMappings[upperSymbol] || upperSymbol;
  }

  /**
   * Validate and clean transaction type
   */
  static standardizeTransactionType(type: string): string {
    const typeMapping: { [key: string]: string } = {
      'BUY': 'buy',
      'PURCHASE': 'buy',
      'BOUGHT': 'buy',
      'SELL': 'sell',
      'SOLD': 'sell',
      'SALE': 'sell',
      'TRADE': 'trade',
      'SWAP': 'trade',
      'EXCHANGE': 'trade',
      'TRANSFER IN': 'receive',
      'DEPOSIT': 'receive',
      'RECEIVE': 'receive',
      'TRANSFER OUT': 'send',
      'WITHDRAWAL': 'send',
      'WITHDRAW': 'send',
      'SEND': 'send',
      'STAKING': 'stake',
      'STAKE': 'stake',
      'UNSTAKING': 'unstake',
      'UNSTAKE': 'unstake',
      'MINING': 'mine',
      'MINED': 'mine',
      'AIRDROP': 'airdrop',
      'FORK': 'fork',
      'DIVIDEND': 'dividend',
      'INTEREST': 'interest',
      'CASHBACK': 'cashback',
      'REWARD': 'reward'
    };

    return typeMapping[type.toUpperCase()] || type.toLowerCase();
  }

  /**
   * Apply currency conversion using historical rates
   */
  static async applyCurrencyConversion(
    data: any[],
    targetCurrency: string,
    conversionRates: ConversionRate[]
  ): Promise<any[]> {
    return data.map(row => {
      if (!row.price || !row.currency || row.currency === targetCurrency) {
        return row;
      }

      // Find conversion rate for the date
      const rate = this.findConversionRate(conversionRates, row.currency, targetCurrency, row.date);
      
      if (rate) {
        return {
          ...row,
          price: row.price * rate.rate,
          currency: targetCurrency,
          originalPrice: row.price,
          originalCurrency: row.currency,
          conversionRate: rate.rate
        };
      }

      return row;
    });
  }

  /**
   * Find conversion rate for specific date
   */
  private static findConversionRate(
    rates: ConversionRate[],
    fromCurrency: string,
    toCurrency: string,
    date: string
  ): ConversionRate | null {
    const targetDate = new Date(date);
    
    // Find exact match first
    let exactMatch = rates.find(rate => 
      rate.from === fromCurrency && 
      rate.to === toCurrency && 
      new Date(rate.timestamp).toDateString() === targetDate.toDateString()
    );

    if (exactMatch) return exactMatch;

    // Find closest date
    const sortedRates = rates
      .filter(rate => rate.from === fromCurrency && rate.to === toCurrency)
      .sort((a, b) => 
        Math.abs(new Date(a.timestamp).getTime() - targetDate.getTime()) -
        Math.abs(new Date(b.timestamp).getTime() - targetDate.getTime())
      );

    return sortedRates[0] || null;
  }

  /**
   * Generate data quality report
   */
  static generateQualityReport(data: any[]): {
    completeness: number;
    consistency: number;
    validity: number;
    issues: string[];
    recommendations: string[];
  } {
    if (!data || data.length === 0) {
      return {
        completeness: 0,
        consistency: 0,
        validity: 0,
        issues: ['Dataset is empty'],
        recommendations: ['Provide data to analyze']
      };
    }

    const issues: string[] = [];
    const recommendations: string[] = [];
    const totalFields = Object.keys(data[0]).length;
    const totalRecords = data.length;

    // Check completeness
    let nullCount = 0;
    data.forEach(row => {
      Object.values(row).forEach(value => {
        if (value === null || value === undefined || value === '') {
          nullCount++;
        }
      });
    });

    const completeness = ((totalFields * totalRecords - nullCount) / (totalFields * totalRecords)) * 100;

    // Check consistency
    const fieldTypes: { [key: string]: Set<string> } = {};
    data.forEach(row => {
      Object.entries(row).forEach(([key, value]) => {
        if (!fieldTypes[key]) fieldTypes[key] = new Set();
        fieldTypes[key].add(typeof value);
      });
    });

    let consistentFields = 0;
    Object.entries(fieldTypes).forEach(([field, types]) => {
      if (types.size === 1) {
        consistentFields++;
      } else {
        issues.push(`Field '${field}' has inconsistent data types`);
        recommendations.push(`Standardize data type for field '${field}'`);
      }
    });

    const consistency = (consistentFields / totalFields) * 100;

    // Check validity (basic checks)
    let validValues = 0;
    let totalValues = 0;

    data.forEach(row => {
      Object.entries(row).forEach(([key, value]) => {
        totalValues++;
        
        // Basic validity checks
        if (key.toLowerCase().includes('date')) {
          if (value && !isNaN(new Date(value as string).getTime())) {
            validValues++;
          }
        } else if (key.toLowerCase().includes('price') || key.toLowerCase().includes('amount')) {
          if (!isNaN(Number(value))) {
            validValues++;
          }
        } else {
          validValues++; // Assume valid if no specific rules
        }
      });
    });

    const validity = (validValues / totalValues) * 100;

    // Add general recommendations
    if (completeness < 90) {
      recommendations.push('Consider cleaning data to improve completeness');
    }
    if (consistency < 90) {
      recommendations.push('Standardize data formats for better consistency');
    }
    if (validity < 90) {
      recommendations.push('Validate and correct invalid data values');
    }

    return {
      completeness,
      consistency,
      validity,
      issues,
      recommendations
    };
  }
}