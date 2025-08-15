import { 
  ValidationRule, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  ValidationSummary,
  ImportType 
} from '../types/importExport.types';

export class DataValidationUtils {
  private static readonly CRYPTO_SYMBOLS = [
    'BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE', 'AVAX', 'LUNA',
    'LINK', 'MATIC', 'ATOM', 'LTC', 'UNI', 'ALGO', 'VET', 'FIL', 'TRX', 'ETC'
  ];

  private static readonly TRANSACTION_TYPES = [
    'buy', 'sell', 'trade', 'swap', 'send', 'receive', 'stake', 'unstake',
    'mine', 'airdrop', 'fork', 'dividend', 'interest', 'cashback', 'reward'
  ];


  /**
   * Validate dataset according to import type and rules
   */
  static validateData(data: any[], importType: ImportType, customRules: ValidationRule[] = []): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let validCount = 0;

    if (!data || data.length === 0) {
      errors.push({
        row: 0,
        message: 'Dataset is empty',
        code: 'EMPTY_DATASET'
      });
      
      return {
        isValid: false,
        validCount: 0,
        errorCount: 1,
        warningCount: 0,
        errors,
        warnings,
        summary: this.generateSummary(data, errors, warnings)
      };
    }

    // Get validation rules for import type
    const typeRules = this.getValidationRules(importType);
    const allRules = [...typeRules, ...customRules];

    // Validate each row
    data.forEach((row, index) => {
      const rowErrors: ValidationError[] = [];
      const rowWarnings: ValidationWarning[] = [];

      // Apply all validation rules
      allRules.forEach(rule => {
        const result = this.validateField(row, rule, index + 1);
        if (result.errors.length > 0) {
          rowErrors.push(...result.errors);
        }
        if (result.warnings.length > 0) {
          rowWarnings.push(...result.warnings);
        }
      });

      // Additional row-level validations
      const additionalValidation = this.validateRowIntegrity(row, index + 1, importType);
      rowErrors.push(...additionalValidation.errors);
      rowWarnings.push(...additionalValidation.warnings);

      if (rowErrors.length === 0) {
        validCount++;
      }

      errors.push(...rowErrors);
      warnings.push(...rowWarnings);
    });

    // Dataset-level validations
    const datasetValidation = this.validateDatasetIntegrity(data, importType);
    errors.push(...datasetValidation.errors);
    warnings.push(...datasetValidation.warnings);

    return {
      isValid: errors.length === 0,
      validCount,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      summary: this.generateSummary(data, errors, warnings)
    };
  }

  /**
   * Get validation rules for specific import type
   */
  private static getValidationRules(importType: ImportType): ValidationRule[] {
    const baseRules: ValidationRule[] = [
      {
        field: 'date',
        type: 'required',
        message: 'Date is required',
        severity: 'error'
      },
      {
        field: 'date',
        type: 'type',
        constraint: 'date',
        message: 'Date must be a valid date format',
        severity: 'error'
      }
    ];

    switch (importType) {
      case 'generic':
      case 'coinbase':
      case 'coinbase-pro':
      case 'binance':
      case 'binance-us':
      case 'kraken':
      case 'kucoin':
      case 'bittrex':
      case 'huobi':
      case 'okx':
      case 'gate-io':
      case 'bybit':
      case 'ftx':
      case 'gemini':
      case 'crypto-com':
        return [
          ...baseRules,
          {
            field: 'symbol',
            type: 'required',
            message: 'Symbol/Asset is required',
            severity: 'error'
          },
          {
            field: 'type',
            type: 'required',
            message: 'Transaction type is required',
            severity: 'error'
          },
          {
            field: 'amount',
            type: 'required',
            message: 'Amount is required',
            severity: 'error'
          },
          {
            field: 'amount',
            type: 'range',
            constraint: { min: 0 },
            message: 'Amount must be positive',
            severity: 'error'
          },
          {
            field: 'price',
            type: 'range',
            constraint: { min: 0 },
            message: 'Price must be positive',
            severity: 'warning'
          }
        ];

      case 'metamask':
      case 'trust-wallet':
      case 'ledger':
      case 'trezor':
        return [
          ...baseRules,
          {
            field: 'from',
            type: 'pattern',
            constraint: /^0x[a-fA-F0-9]{40}$/,
            message: 'From address must be a valid Ethereum address',
            severity: 'warning'
          },
          {
            field: 'to',
            type: 'pattern',
            constraint: /^0x[a-fA-F0-9]{40}$/,
            message: 'To address must be a valid Ethereum address',
            severity: 'warning'
          }
        ];

      case 'blockfi':
      case 'celsius':
      case 'nexo':
        return [
          ...baseRules,
          {
            field: 'symbol',
            type: 'required',
            message: 'Asset symbol is required',
            severity: 'error'
          },
          {
            field: 'type',
            type: 'custom',
            constraint: (value: any) => ['interest', 'deposit', 'withdrawal', 'bonus'].includes(value?.toLowerCase()),
            message: 'Type must be one of: interest, deposit, withdrawal, bonus',
            severity: 'error'
          }
        ];

      default:
        return baseRules;
    }
  }

  /**
   * Validate individual field against rule
   */
  private static validateField(row: any, rule: ValidationRule, rowNumber: number): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const value = row[rule.field];

    const addIssue = (message: string, suggestedFix?: string) => {
      const issue = {
        row: rowNumber,
        field: rule.field,
        message,
        value,
        code: `${rule.type.toUpperCase()}_${rule.field.toUpperCase()}`,
        suggestedFix
      };

      if (rule.severity === 'error') {
        errors.push(issue);
      } else {
        warnings.push(issue);
      }
    };

    switch (rule.type) {
      case 'required':
        if (value === null || value === undefined || value === '') {
          addIssue(rule.message);
        }
        break;

      case 'type':
        if (value !== null && value !== undefined && value !== '') {
          const isValid = this.validateType(value, rule.constraint);
          if (!isValid) {
            addIssue(rule.message, this.suggestTypeConversion(value, rule.constraint));
          }
        }
        break;

      case 'range':
        if (value !== null && value !== undefined && value !== '') {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            const { min, max } = rule.constraint as { min?: number; max?: number };
            if (min !== undefined && numValue < min) {
              addIssue(`${rule.message} (minimum: ${min})`, `Set to minimum value: ${min}`);
            }
            if (max !== undefined && numValue > max) {
              addIssue(`${rule.message} (maximum: ${max})`, `Set to maximum value: ${max}`);
            }
          }
        }
        break;

      case 'pattern':
        if (value !== null && value !== undefined && value !== '') {
          const pattern = rule.constraint as RegExp;
          if (!pattern.test(String(value))) {
            addIssue(rule.message);
          }
        }
        break;

      case 'custom':
        if (value !== null && value !== undefined && value !== '') {
          const customValidator = rule.constraint as (value: any) => boolean;
          if (!customValidator(value)) {
            addIssue(rule.message);
          }
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Validate row integrity (cross-field validation)
   */
  private static validateRowIntegrity(row: any, rowNumber: number, importType: ImportType): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate symbol format
    if (row.symbol) {
      const symbol = String(row.symbol).toUpperCase();
      if (!this.isValidCryptoSymbol(symbol)) {
        warnings.push({
          row: rowNumber,
          field: 'symbol',
          message: `Unknown cryptocurrency symbol: ${symbol}`,
          value: row.symbol,
          code: 'UNKNOWN_SYMBOL',
          suggestion: this.suggestSimilarSymbol(symbol)
        });
      }
    }

    // Validate transaction type
    if (row.type) {
      const type = String(row.type).toLowerCase();
      if (!this.TRANSACTION_TYPES.includes(type)) {
        warnings.push({
          row: rowNumber,
          field: 'type',
          message: `Unknown transaction type: ${row.type}`,
          value: row.type,
          code: 'UNKNOWN_TYPE',
          suggestion: this.suggestSimilarTransactionType(type)
        });
      }
    }

    // Validate price-amount relationship
    if (row.price && row.amount && row.total) {
      const expectedTotal = Number(row.price) * Number(row.amount);
      const actualTotal = Number(row.total);
      const tolerance = 0.01; // 1 cent tolerance

      if (Math.abs(expectedTotal - actualTotal) > tolerance) {
        warnings.push({
          row: rowNumber,
          message: `Total (${actualTotal}) doesn't match price × amount (${expectedTotal})`,
          code: 'CALCULATION_MISMATCH',
          suggestion: `Expected total: ${expectedTotal.toFixed(2)}`
        });
      }
    }

    // Validate date is not in the future
    if (row.date) {
      const date = new Date(row.date);
      if (date > new Date()) {
        warnings.push({
          row: rowNumber,
          field: 'date',
          message: 'Transaction date is in the future',
          value: row.date,
          code: 'FUTURE_DATE'
        });
      }
    }

    // Validate exchange-specific formats
    if (importType !== 'generic') {
      const exchangeValidation = this.validateExchangeFormat(row, rowNumber, importType);
      errors.push(...exchangeValidation.errors);
      warnings.push(...exchangeValidation.warnings);
    }

    return { errors, warnings };
  }

  /**
   * Validate dataset integrity (dataset-level validation)
   */
  private static validateDatasetIntegrity(data: any[], importType: ImportType): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for duplicate transactions
    const transactions = new Map<string, number[]>();
    data.forEach((row, index) => {
      const key = `${row.date}-${row.symbol}-${row.type}-${row.amount}`;
      if (!transactions.has(key)) {
        transactions.set(key, []);
      }
      transactions.get(key)!.push(index + 1);
    });

    transactions.forEach((rows) => {
      if (rows.length > 1) {
        warnings.push({
          row: 0,
          message: `Potential duplicate transactions found at rows: ${rows.join(', ')}`,
          code: 'DUPLICATE_TRANSACTIONS'
        });
      }
    });

    // Check date range
    const dates = data
      .map(row => new Date(row.date))
      .filter(date => !isNaN(date.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length > 0) {
      const span = dates[dates.length - 1].getTime() - dates[0].getTime();
      const years = span / (365 * 24 * 60 * 60 * 1000);
      
      if (years > 10) {
        warnings.push({
          row: 0,
          message: `Data spans ${years.toFixed(1)} years, which seems unusually long`,
          code: 'LARGE_DATE_RANGE'
        });
      }
    }

    // Check for missing required columns
    if (data.length > 0) {
      const requiredFields = this.getRequiredFields(importType);
      const availableFields = Object.keys(data[0]);
      
      requiredFields.forEach(field => {
        if (!availableFields.includes(field)) {
          errors.push({
            row: 0,
            field,
            message: `Required field '${field}' is missing from dataset`,
            code: 'MISSING_REQUIRED_FIELD'
          });
        }
      });
    }

    return { errors, warnings };
  }

  /**
   * Validate exchange-specific format requirements
   */
  private static validateExchangeFormat(row: any, rowNumber: number, importType: ImportType): {
    errors: ValidationError[];
    warnings: ValidationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    switch (importType) {
      case 'coinbase':
        // Coinbase-specific validations
        if (row.type && !['Buy', 'Sell', 'Send', 'Receive', 'Convert'].includes(row.type)) {
          warnings.push({
            row: rowNumber,
            field: 'type',
            message: `Unexpected Coinbase transaction type: ${row.type}`,
            code: 'UNEXPECTED_COINBASE_TYPE'
          });
        }
        break;

      case 'binance':
        // Binance-specific validations
        if (row.symbol && !row.symbol.includes('/') && row.type === 'trade') {
          warnings.push({
            row: rowNumber,
            field: 'symbol',
            message: 'Binance trading pairs should be in format BTC/USDT',
            code: 'BINANCE_SYMBOL_FORMAT'
          });
        }
        break;

      case 'metamask':
        // MetaMask-specific validations
        if (row.from && !row.from.startsWith('0x')) {
          errors.push({
            row: rowNumber,
            field: 'from',
            message: 'Ethereum addresses should start with 0x',
            code: 'INVALID_ETH_ADDRESS'
          });
        }
        break;
    }

    return { errors, warnings };
  }

  /**
   * Validate data type
   */
  private static validateType(value: any, expectedType: any): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      
      case 'number':
        return typeof value === 'number' || !isNaN(Number(value));
      
      case 'date':
        return !isNaN(new Date(value).getTime());
      
      case 'boolean':
        return typeof value === 'boolean' || 
               value === 'true' || value === 'false' ||
               value === 1 || value === 0;
      
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value));
      
      case 'url':
        try {
          new URL(String(value));
          return true;
        } catch {
          return false;
        }
      
      default:
        return true;
    }
  }

  /**
   * Suggest type conversion
   */
  private static suggestTypeConversion(value: any, expectedType: any): string {
    switch (expectedType) {
      case 'number':
        if (typeof value === 'string') {
          const cleaned = value.replace(/[^0-9.-]/g, '');
          return `Convert to number: ${cleaned}`;
        }
        break;
      
      case 'date':
        if (typeof value === 'string') {
          return `Try parsing as date: ${value}`;
        }
        break;
      
      case 'boolean':
        return `Convert to boolean: ${value ? 'true' : 'false'}`;
    }
    
    return `Convert to ${expectedType}`;
  }

  /**
   * Check if crypto symbol is valid
   */
  private static isValidCryptoSymbol(symbol: string): boolean {
    return this.CRYPTO_SYMBOLS.includes(symbol.toUpperCase()) ||
           symbol.length >= 2 && symbol.length <= 10; // Basic symbol format check
  }

  /**
   * Suggest similar crypto symbol
   */
  private static suggestSimilarSymbol(symbol: string): string {
    const upper = symbol.toUpperCase();
    
    // Find closest match using simple string similarity
    let bestMatch = '';
    let bestScore = 0;
    
    this.CRYPTO_SYMBOLS.forEach(validSymbol => {
      const score = this.calculateSimilarity(upper, validSymbol);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = validSymbol;
      }
    });
    
    return bestScore > 0.5 ? `Did you mean: ${bestMatch}` : 'Check symbol spelling';
  }

  /**
   * Suggest similar transaction type
   */
  private static suggestSimilarTransactionType(type: string): string {
    const lower = type.toLowerCase();
    
    // Common mappings
    const mappings: { [key: string]: string } = {
      'purchase': 'buy',
      'bought': 'buy',
      'sale': 'sell',
      'sold': 'sell',
      'exchange': 'trade',
      'swap': 'trade',
      'deposit': 'receive',
      'withdrawal': 'send',
      'withdraw': 'send'
    };
    
    if (mappings[lower]) {
      return `Did you mean: ${mappings[lower]}`;
    }
    
    // Find closest match
    let bestMatch = '';
    let bestScore = 0;
    
    this.TRANSACTION_TYPES.forEach(validType => {
      const score = this.calculateSimilarity(lower, validType);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = validType;
      }
    });
    
    return bestScore > 0.5 ? `Did you mean: ${bestMatch}` : 'Check transaction type';
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1;
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / maxLen;
  }

  /**
   * Get required fields for import type
   */
  private static getRequiredFields(importType: ImportType): string[] {
    const baseFields = ['date'];
    
    switch (importType) {
      case 'generic':
      case 'coinbase':
      case 'binance':
      case 'kraken':
        return [...baseFields, 'symbol', 'type', 'amount'];
      
      case 'metamask':
      case 'trust-wallet':
        return [...baseFields, 'from', 'to', 'value'];
      
      case 'blockfi':
      case 'celsius':
      case 'nexo':
        return [...baseFields, 'symbol', 'type', 'amount'];
      
      default:
        return baseFields;
    }
  }

  /**
   * Generate validation summary
   */
  private static generateSummary(
    data: any[], 
    errors: ValidationError[], 
    warnings: ValidationWarning[]
  ): ValidationSummary {
    const totalRows = data.length;
    const processedRows = totalRows;
    const skippedRows = 0;
    
    // Unused variable fix
    void errors;
    void warnings;
    
    // Count duplicates
    const duplicateRows = this.countDuplicates(data);
    
    // Count empty rows
    const emptyRows = data.filter(row => 
      Object.values(row).every(value => value === null || value === undefined || value === '')
    ).length;

    // Field coverage
    const fieldCoverage: { [field: string]: number } = {};
    if (data.length > 0) {
      Object.keys(data[0]).forEach(field => {
        const nonEmptyCount = data.filter(row => 
          row[field] !== null && row[field] !== undefined && row[field] !== ''
        ).length;
        fieldCoverage[field] = (nonEmptyCount / totalRows) * 100;
      });
    }

    // Data types
    const dataTypes: { [field: string]: string } = {};
    if (data.length > 0) {
      Object.keys(data[0]).forEach(field => {
        const types = new Set(data.map(row => typeof row[field]));
        dataTypes[field] = Array.from(types).join(' | ');
      });
    }

    // Date range
    let dateRange: { earliest: string; latest: string } | undefined;
    const dates = data
      .map(row => row.date)
      .filter(date => date && !isNaN(new Date(date).getTime()))
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (dates.length > 0) {
      dateRange = {
        earliest: dates[0].toISOString(),
        latest: dates[dates.length - 1].toISOString()
      };
    }

    // Asset count
    const assetCount = data.length > 0 
      ? new Set(data.map(row => row.symbol).filter(Boolean)).size
      : 0;

    // Total value (if available)
    const totalValue = data
      .map(row => Number(row.total || row.amount || 0))
      .filter(val => !isNaN(val))
      .reduce((sum, val) => sum + val, 0);

    return {
      totalRows,
      processedRows,
      skippedRows,
      duplicateRows,
      emptyRows,
      fieldCoverage,
      dataTypes,
      dateRange,
      assetCount,
      totalValue
    };
  }

  /**
   * Count duplicate rows
   */
  private static countDuplicates(data: any[]): number {
    const seen = new Set<string>();
    let duplicates = 0;
    
    data.forEach(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        duplicates++;
      } else {
        seen.add(key);
      }
    });
    
    return duplicates;
  }

  /**
   * Validate specific field formats
   */
  static validateSpecificFormats = {
    ethereumAddress: (address: string): boolean => {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    },

    bitcoinAddress: (address: string): boolean => {
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || // Legacy
             /^bc1[a-z0-9]{39,59}$/.test(address); // Bech32
    },

    transactionHash: (hash: string): boolean => {
      return /^0x[a-fA-F0-9]{64}$/.test(hash);
    },

    email: (email: string): boolean => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    url: (url: string): boolean => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }
  };
}