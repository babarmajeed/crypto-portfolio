# File Processing Service Architecture

## Overview
Scalable file processing service for handling CSV/JSON imports, exports, and batch operations for portfolio data, transaction history, and market data.

## Service Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                             │
│              (File Upload Endpoint)                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                File Processing Service                      │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Upload    │  │   Parser    │  │ Validator   │        │
│  │  Handler    │  │   Engine    │  │   Engine    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Processor  │  │  Storage    │  │ Notification│        │
│  │   Queue     │  │  Manager    │  │   Service   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│           File Storage (S3) + Database + Queue             │
└─────────────────────────────────────────────────────────────┘
```

### File Processing Service Implementation

```typescript
import multer from 'multer';
import AWS from 'aws-sdk';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

interface FileUpload {
  id: string;
  userId: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'portfolio_import' | 'transaction_import' | 'market_data_import' | 'export';
  createdAt: Date;
  processedAt?: Date;
  errorMessage?: string;
  results?: any;
}

interface ProcessingJob {
  id: string;
  fileId: string;
  userId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: ProcessingError[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface ProcessingError {
  row: number;
  field?: string;
  message: string;
  data?: any;
}

// Validation Schemas
const TransactionImportSchema = z.object({
  date: z.string().refine(date => !isNaN(Date.parse(date)), 'Invalid date format'),
  symbol: z.string().min(1, 'Symbol is required'),
  type: z.enum(['buy', 'sell', 'transfer_in', 'transfer_out', 'reward', 'stake', 'unstake']),
  quantity: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) > 0, 'Invalid quantity'),
  price: z.string().optional().refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0), 'Invalid price'),
  fee: z.string().optional().refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0), 'Invalid fee'),
  exchange: z.string().optional(),
  notes: z.string().optional()
});

const PortfolioImportSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  quantity: z.string().refine(val => !isNaN(parseFloat(val)) && parseFloat(val) >= 0, 'Invalid quantity'),
  averageCostBasis: z.string().optional().refine(val => !val || (!isNaN(parseFloat(val)) && parseFloat(val) > 0), 'Invalid average cost basis'),
  exchange: z.string().optional(),
  notes: z.string().optional()
});

class FileProcessingService {
  private s3: AWS.S3;
  private upload: multer.Multer;
  private redis: Redis;

  constructor() {
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });

    this.upload = multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
      },
      fileFilter: this.fileFilter.bind(this)
    });

    this.redis = new Redis(process.env.REDIS_URL!);
  }

  private fileFilter(req: any, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
    const allowedMimeTypes = [
      'text/csv',
      'application/json',
      'text/plain',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload CSV, JSON, or Excel files.'));
    }
  }

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
    type: string,
    options: any = {}
  ): Promise<FileUpload> {
    // Generate unique file ID and S3 key
    const fileId = uuidv4();
    const s3Key = `user-uploads/${userId}/${fileId}/${file.originalname}`;

    // Upload to S3
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256',
      Metadata: {
        userId,
        fileId,
        originalName: file.originalname,
        uploadedAt: new Date().toISOString()
      }
    };

    await this.s3.upload(uploadParams).promise();

    // Create file record
    const fileUpload: FileUpload = {
      id: fileId,
      userId,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      s3Key,
      status: 'pending',
      type: type as any,
      createdAt: new Date()
    };

    // Save to database
    await this.saveFileUpload(fileUpload);

    // Create processing job
    const processingJob: ProcessingJob = {
      id: uuidv4(),
      fileId,
      userId,
      type,
      status: 'pending',
      progress: 0,
      totalRows: 0,
      processedRows: 0,
      errorRows: 0,
      errors: [],
      createdAt: new Date()
    };

    await this.saveProcessingJob(processingJob);

    // Queue for processing
    await this.queueProcessingJob(processingJob.id, options);

    return fileUpload;
  }

  async processFile(jobId: string): Promise<void> {
    const job = await this.getProcessingJob(jobId);
    if (!job) {
      throw new Error('Processing job not found');
    }

    try {
      // Update job status
      await this.updateJobStatus(jobId, 'processing', { startedAt: new Date() });

      // Get file from S3
      const file = await this.getFileFromS3(job.fileId);
      const fileContent = await this.getFileContent(file.s3Key);

      // Process based on file type and processing type
      const result = await this.processFileContent(fileContent, file, job);

      // Update job with results
      await this.updateJobStatus(jobId, 'completed', {
        completedAt: new Date(),
        progress: 100,
        results: result
      });

      // Update file status
      await this.updateFileStatus(job.fileId, 'completed', result);

      // Send notification
      await this.sendProcessingNotification(job.userId, job.fileId, 'completed', result);

    } catch (error) {
      console.error('Error processing file:', error);

      // Update job with error
      await this.updateJobStatus(jobId, 'failed', {
        completedAt: new Date(),
        errorMessage: error.message
      });

      // Update file status
      await this.updateFileStatus(job.fileId, 'failed', { error: error.message });

      // Send error notification
      await this.sendProcessingNotification(job.userId, job.fileId, 'failed', { error: error.message });
    }
  }

  private async processFileContent(
    content: Buffer,
    file: FileUpload,
    job: ProcessingJob
  ): Promise<any> {
    switch (file.mimeType) {
      case 'text/csv':
      case 'application/vnd.ms-excel':
        return this.processCSV(content, file, job);
      
      case 'application/json':
        return this.processJSON(content, file, job);
      
      default:
        throw new Error(`Unsupported file type: ${file.mimeType}`);
    }
  }

  private async processCSV(
    content: Buffer,
    file: FileUpload,
    job: ProcessingJob
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      const errors: ProcessingError[] = [];
      let rowIndex = 0;
      let totalRows = 0;

      const stream = Readable.from(content.toString());
      
      stream
        .pipe(csv({
          skipEmptyLines: true,
          trim: true
        }))
        .on('headers', (headers) => {
          // Validate headers based on import type
          this.validateHeaders(headers, job.type);
        })
        .on('data', async (row) => {
          rowIndex++;
          
          try {
            const processedRow = await this.processRow(row, job.type, rowIndex);
            results.push(processedRow);
            
            // Update progress every 100 rows
            if (rowIndex % 100 === 0) {
              await this.updateJobProgress(job.id, rowIndex, totalRows, errors.length);
            }
          } catch (error) {
            errors.push({
              row: rowIndex,
              message: error.message,
              data: row
            });
          }
        })
        .on('end', async () => {
          totalRows = rowIndex;
          
          // Final progress update
          await this.updateJobProgress(job.id, rowIndex, totalRows, errors.length);

          // Save processed data
          const saveResult = await this.saveProcessedData(results, job);

          resolve({
            totalRows,
            processedRows: results.length,
            errorRows: errors.length,
            errors: errors.slice(0, 100), // Limit errors in response
            saveResult
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private async processJSON(
    content: Buffer,
    file: FileUpload,
    job: ProcessingJob
  ): Promise<any> {
    try {
      const jsonData = JSON.parse(content.toString());
      const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
      
      const results: any[] = [];
      const errors: ProcessingError[] = [];
      
      for (let i = 0; i < dataArray.length; i++) {
        try {
          const processedRow = await this.processRow(dataArray[i], job.type, i + 1);
          results.push(processedRow);
          
          // Update progress
          if ((i + 1) % 100 === 0) {
            await this.updateJobProgress(job.id, i + 1, dataArray.length, errors.length);
          }
        } catch (error) {
          errors.push({
            row: i + 1,
            message: error.message,
            data: dataArray[i]
          });
        }
      }

      // Save processed data
      const saveResult = await this.saveProcessedData(results, job);

      return {
        totalRows: dataArray.length,
        processedRows: results.length,
        errorRows: errors.length,
        errors: errors.slice(0, 100),
        saveResult
      };
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }

  private async processRow(row: any, type: string, rowIndex: number): Promise<any> {
    switch (type) {
      case 'transaction_import':
        return this.processTransactionRow(row, rowIndex);
      
      case 'portfolio_import':
        return this.processPortfolioRow(row, rowIndex);
      
      default:
        throw new Error(`Unsupported processing type: ${type}`);
    }
  }

  private async processTransactionRow(row: any, rowIndex: number): Promise<any> {
    try {
      // Normalize field names (handle different CSV headers)
      const normalizedRow = this.normalizeTransactionRow(row);
      
      // Validate using schema
      const validatedData = TransactionImportSchema.parse(normalizedRow);
      
      // Additional business logic validation
      await this.validateTransaction(validatedData);
      
      return {
        date: new Date(validatedData.date),
        symbol: validatedData.symbol.toUpperCase(),
        type: validatedData.type,
        quantity: parseFloat(validatedData.quantity),
        price: validatedData.price ? parseFloat(validatedData.price) : null,
        fee: validatedData.fee ? parseFloat(validatedData.fee) : 0,
        exchange: validatedData.exchange || null,
        notes: validatedData.notes || null,
        source: 'import',
        sourceRow: rowIndex
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Validation error: ${fieldErrors}`);
      }
      throw error;
    }
  }

  private async processPortfolioRow(row: any, rowIndex: number): Promise<any> {
    try {
      const normalizedRow = this.normalizePortfolioRow(row);
      const validatedData = PortfolioImportSchema.parse(normalizedRow);
      
      await this.validatePortfolioHolding(validatedData);
      
      return {
        symbol: validatedData.symbol.toUpperCase(),
        quantity: parseFloat(validatedData.quantity),
        averageCostBasis: validatedData.averageCostBasis ? parseFloat(validatedData.averageCostBasis) : null,
        exchange: validatedData.exchange || null,
        notes: validatedData.notes || null,
        source: 'import',
        sourceRow: rowIndex
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(`Validation error: ${fieldErrors}`);
      }
      throw error;
    }
  }

  private normalizeTransactionRow(row: any): any {
    const fieldMappings = {
      date: ['date', 'timestamp', 'time', 'executed_at', 'created_at'],
      symbol: ['symbol', 'coin', 'currency', 'asset', 'ticker'],
      type: ['type', 'side', 'transaction_type', 'action'],
      quantity: ['quantity', 'amount', 'size', 'volume'],
      price: ['price', 'rate', 'price_per_unit', 'unit_price'],
      fee: ['fee', 'fees', 'commission', 'cost'],
      exchange: ['exchange', 'source', 'platform', 'market'],
      notes: ['notes', 'memo', 'description', 'comment']
    };

    const normalized: any = {};
    
    for (const [standardField, possibleFields] of Object.entries(fieldMappings)) {
      for (const field of possibleFields) {
        const value = row[field] || row[field.toLowerCase()] || row[field.toUpperCase()];
        if (value !== undefined && value !== null && value !== '') {
          normalized[standardField] = value;
          break;
        }
      }
    }

    return normalized;
  }

  private normalizePortfolioRow(row: any): any {
    const fieldMappings = {
      symbol: ['symbol', 'coin', 'currency', 'asset', 'ticker'],
      quantity: ['quantity', 'amount', 'balance', 'holdings'],
      averageCostBasis: ['average_cost_basis', 'avg_cost', 'cost_basis', 'average_price'],
      exchange: ['exchange', 'source', 'platform', 'wallet'],
      notes: ['notes', 'memo', 'description', 'comment']
    };

    const normalized: any = {};
    
    for (const [standardField, possibleFields] of Object.entries(fieldMappings)) {
      for (const field of possibleFields) {
        const value = row[field] || row[field.toLowerCase()] || row[field.toUpperCase()];
        if (value !== undefined && value !== null && value !== '') {
          normalized[standardField] = value;
          break;
        }
      }
    }

    return normalized;
  }

  private validateHeaders(headers: string[], type: string): void {
    const requiredFields = this.getRequiredFields(type);
    const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    
    for (const required of requiredFields) {
      const variations = this.getFieldVariations(required);
      const found = variations.some(variation => 
        normalizedHeaders.some(header => header.includes(variation))
      );
      
      if (!found) {
        throw new Error(`Required field '${required}' not found in CSV headers`);
      }
    }
  }

  private getRequiredFields(type: string): string[] {
    switch (type) {
      case 'transaction_import':
        return ['date', 'symbol', 'type', 'quantity'];
      case 'portfolio_import':
        return ['symbol', 'quantity'];
      default:
        return [];
    }
  }

  private getFieldVariations(field: string): string[] {
    const variations: Record<string, string[]> = {
      date: ['date', 'time', 'timestamp', 'executed'],
      symbol: ['symbol', 'coin', 'currency', 'asset'],
      type: ['type', 'side', 'action', 'transaction'],
      quantity: ['quantity', 'amount', 'size', 'volume']
    };
    
    return variations[field] || [field];
  }

  private async validateTransaction(data: any): Promise<void> {
    // Validate symbol exists
    const isValidSymbol = await this.validateCryptocurrency(data.symbol);
    if (!isValidSymbol) {
      throw new Error(`Unknown cryptocurrency symbol: ${data.symbol}`);
    }

    // Validate transaction type
    const validTypes = ['buy', 'sell', 'transfer_in', 'transfer_out', 'reward', 'stake', 'unstake'];
    if (!validTypes.includes(data.type)) {
      throw new Error(`Invalid transaction type: ${data.type}`);
    }

    // Validate price is required for buy/sell transactions
    if (['buy', 'sell'].includes(data.type) && !data.price) {
      throw new Error('Price is required for buy/sell transactions');
    }
  }

  private async validatePortfolioHolding(data: any): Promise<void> {
    // Validate symbol exists
    const isValidSymbol = await this.validateCryptocurrency(data.symbol);
    if (!isValidSymbol) {
      throw new Error(`Unknown cryptocurrency symbol: ${data.symbol}`);
    }
  }

  private async validateCryptocurrency(symbol: string): Promise<boolean> {
    // Check against database or cache of valid cryptocurrencies
    // For now, return true - implement actual validation
    return true;
  }

  private async saveProcessedData(data: any[], job: ProcessingJob): Promise<any> {
    switch (job.type) {
      case 'transaction_import':
        return this.saveTransactions(data, job.userId);
      
      case 'portfolio_import':
        return this.savePortfolioHoldings(data, job.userId);
      
      default:
        throw new Error(`Unsupported save type: ${job.type}`);
    }
  }

  private async saveTransactions(transactions: any[], userId: string): Promise<any> {
    // Implement batch transaction save
    // This would interact with your transaction service/database
    return {
      saved: transactions.length,
      duplicates: 0,
      errors: 0
    };
  }

  private async savePortfolioHoldings(holdings: any[], userId: string): Promise<any> {
    // Implement batch portfolio holdings save
    // This would interact with your portfolio service/database
    return {
      saved: holdings.length,
      updated: 0,
      errors: 0
    };
  }

  async exportData(
    userId: string,
    type: string,
    format: 'csv' | 'json',
    options: any = {}
  ): Promise<FileUpload> {
    const exportId = uuidv4();
    const fileName = `${type}_export_${new Date().toISOString().split('T')[0]}.${format}`;
    const s3Key = `user-exports/${userId}/${exportId}/${fileName}`;

    // Create file record
    const fileUpload: FileUpload = {
      id: exportId,
      userId,
      originalName: fileName,
      mimeType: format === 'csv' ? 'text/csv' : 'application/json',
      size: 0,
      s3Key,
      status: 'processing',
      type: 'export',
      createdAt: new Date()
    };

    await this.saveFileUpload(fileUpload);

    // Queue export job
    await this.queueExportJob(exportId, type, format, options);

    return fileUpload;
  }

  private async queueProcessingJob(jobId: string, options: any): Promise<void> {
    await this.redis.lpush('file_processing_queue', JSON.stringify({
      jobId,
      type: 'process',
      options,
      queuedAt: new Date().toISOString()
    }));
  }

  private async queueExportJob(
    exportId: string,
    type: string,
    format: string,
    options: any
  ): Promise<void> {
    await this.redis.lpush('file_processing_queue', JSON.stringify({
      exportId,
      type: 'export',
      exportType: type,
      format,
      options,
      queuedAt: new Date().toISOString()
    }));
  }

  // Database operations (implement with your chosen database)
  private async saveFileUpload(fileUpload: FileUpload): Promise<void> {
    // Implementation depends on your database choice
  }

  private async saveProcessingJob(job: ProcessingJob): Promise<void> {
    // Implementation depends on your database choice
  }

  private async getProcessingJob(jobId: string): Promise<ProcessingJob | null> {
    // Implementation depends on your database choice
    return null;
  }

  private async updateJobStatus(jobId: string, status: string, updates: any): Promise<void> {
    // Implementation depends on your database choice
  }

  private async updateJobProgress(
    jobId: string,
    processedRows: number,
    totalRows: number,
    errorRows: number
  ): Promise<void> {
    // Implementation depends on your database choice
  }

  private async updateFileStatus(fileId: string, status: string, results?: any): Promise<void> {
    // Implementation depends on your database choice
  }

  private async getFileFromS3(fileId: string): Promise<FileUpload> {
    // Implementation depends on your database choice
    throw new Error('Not implemented');
  }

  private async getFileContent(s3Key: string): Promise<Buffer> {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: s3Key
    };

    const result = await this.s3.getObject(params).promise();
    return result.Body as Buffer;
  }

  private async sendProcessingNotification(
    userId: string,
    fileId: string,
    status: string,
    results: any
  ): Promise<void> {
    // Send notification via your notification service
  }

  getUploadMiddleware() {
    return this.upload.single('file');
  }
}
```

### Export Service Implementation

```typescript
class ExportService {
  async exportTransactions(
    userId: string,
    format: 'csv' | 'json',
    options: {
      startDate?: Date;
      endDate?: Date;
      symbols?: string[];
      exchanges?: string[];
    } = {}
  ): Promise<Buffer> {
    // Get transaction data
    const transactions = await this.getTransactionsForExport(userId, options);

    if (format === 'csv') {
      return this.generateCSV(transactions, this.getTransactionCSVHeaders());
    } else {
      return Buffer.from(JSON.stringify(transactions, null, 2));
    }
  }

  async exportPortfolio(
    userId: string,
    format: 'csv' | 'json'
  ): Promise<Buffer> {
    const portfolio = await this.getPortfolioForExport(userId);

    if (format === 'csv') {
      return this.generateCSV(portfolio, this.getPortfolioCSVHeaders());
    } else {
      return Buffer.from(JSON.stringify(portfolio, null, 2));
    }
  }

  private generateCSV(data: any[], headers: string[]): Buffer {
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => 
          JSON.stringify(row[header] || '')
        ).join(',')
      )
    ].join('\n');

    return Buffer.from(csvContent);
  }

  private getTransactionCSVHeaders(): string[] {
    return [
      'date',
      'symbol',
      'type',
      'quantity',
      'price',
      'fee',
      'total',
      'exchange',
      'notes'
    ];
  }

  private getPortfolioCSVHeaders(): string[] {
    return [
      'symbol',
      'quantity',
      'averageCostBasis',
      'currentPrice',
      'currentValue',
      'totalGainLoss',
      'percentageGainLoss',
      'exchange'
    ];
  }

  private async getTransactionsForExport(userId: string, options: any): Promise<any[]> {
    // Implementation depends on your database/service
    return [];
  }

  private async getPortfolioForExport(userId: string): Promise<any[]> {
    // Implementation depends on your database/service
    return [];
  }
}
```

This file processing service provides:
- **Scalability**: Queue-based processing for large files
- **Reliability**: Error handling and recovery mechanisms
- **Flexibility**: Support for multiple file formats and data types
- **Security**: File validation and secure storage
- **User Experience**: Progress tracking and notifications
- **Data Integrity**: Comprehensive validation and error reporting