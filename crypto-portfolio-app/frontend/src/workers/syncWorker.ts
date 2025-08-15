/**
 * Web Worker for background synchronization operations
 * Handles CPU-intensive sync tasks without blocking the main thread
 */

import {
  SyncOperation,
  SyncProgress,
  SyncError,
  ConflictData,
  ExchangeConnection,
  SyncOptions,
  TransactionData
} from '../types/sync.types';

// Worker message types
interface WorkerMessage {
  type: 'START_SYNC' | 'STOP_SYNC' | 'PROGRESS_UPDATE' | 'SYNC_COMPLETE' | 'SYNC_ERROR' | 'CONFLICT_DETECTED';
  payload?: any;
}

interface SyncRequest {
  operationId: string;
  exchanges: ExchangeConnection[];
  options: SyncOptions;
}

interface SyncResponse {
  operationId: string;
  operation: SyncOperation;
}

interface ProgressUpdate {
  operationId: string;
  progress: SyncProgress;
}

interface ErrorUpdate {
  operationId: string;
  error: SyncError;
}

interface ConflictUpdate {
  operationId: string;
  conflict: ConflictData;
}

// Worker state
let currentOperation: SyncOperation | null = null;
let isRunning = false;
let shouldStop = false;

// Mock data generators for background processing
class MockDataGenerator {
  static generateTransactions(
    exchangeId: string,
    count: number,
    type: 'trades' | 'deposits' | 'withdrawals' | 'orders'
  ): TransactionData[] {
    const transactions: TransactionData[] = [];
    const assets = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE'];
    
    for (let i = 0; i < count; i++) {
      const asset = assets[Math.floor(Math.random() * assets.length)];
      const amount = Math.random() * 10;
      const price = Math.random() * 50000;
      
      transactions.push({
        id: `${exchangeId}_${type}_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        exchangeId,
        exchangeTransactionId: `ext_${type}_${i}_${Date.now()}`,
        type: this.getTransactionType(type),
        asset,
        amount,
        price,
        total: amount * price,
        fees: Math.random() * 10,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      });
    }
    
    return transactions;
  }

  static getTransactionType(type: string): any {
    const typeMap: { [key: string]: any } = {
      'trades': 'trade',
      'deposits': 'deposit',
      'withdrawals': 'withdrawal',
      'orders': 'buy'
    };
    return typeMap[type] || 'trade';
  }

  static async simulateApiCall(delayMs: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

// Background sync processor
class BackgroundSyncProcessor {
  static async processSync(request: SyncRequest): Promise<void> {
    const { operationId, exchanges, options } = request;
    
    try {
      // Initialize operation
      currentOperation = {
        id: operationId,
        configurationId: 'worker-config',
        exchanges: exchanges.map(e => e.id),
        status: 'syncing',
        type: options.syncType,
        startedAt: new Date().toISOString(),
        progress: {
          stage: 'initializing',
          overall: 0,
          exchanges: {},
          message: 'Initializing background sync...'
        },
        results: {
          totalRecords: 0,
          processedRecords: 0,
          skippedRecords: 0,
          errorRecords: 0,
          newRecords: 0,
          updatedRecords: 0,
          duplicateRecords: 0,
          conflictRecords: 0,
          exchangeResults: {},
          summary: {
            success: false,
            exchangesProcessed: 0,
            exchangesFailed: 0,
            totalTransactions: 0,
            newTransactions: 0,
            portfolioValue: 0,
            assetsUpdated: [],
            performanceImpact: {
              executionTime: 0,
              memoryUsage: 0,
              networkUsage: 0,
              storageImpact: 0,
              cpuUsage: 0
            }
          }
        },
        errors: [],
        conflicts: [],
        metadata: {
          version: '1.0.0',
          environment: 'worker',
          timezone: 'UTC',
          features: ['background-sync', 'conflict-resolution']
        }
      };

      isRunning = true;
      shouldStop = false;

      // Initialize exchange progress
      exchanges.forEach(exchange => {
        currentOperation!.progress.exchanges[exchange.id] = {
          exchangeId: exchange.id,
          stage: 'initializing',
          progress: 0,
          message: 'Initializing...',
          fetchedRecords: 0,
          processedRecords: 0,
          errors: 0,
          warnings: 0,
          lastActivity: new Date().toISOString()
        };
      });

      this.sendProgress();

      // Process each exchange
      let exchangesProcessed = 0;
      
      for (const exchange of exchanges) {
        if (shouldStop) break;

        try {
          await this.processExchange(exchange, options);
          exchangesProcessed++;
        } catch (error) {
          console.error(`Failed to process exchange ${exchange.id}:`, error);
          currentOperation.errors.push({
            id: `error_${Date.now()}`,
            type: 'api_error',
            severity: 'high',
            exchangeId: exchange.id,
            message: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
            retryable: true,
            retryCount: 0
          });
        }

        // Update overall progress
        const overallProgress = ((exchangesProcessed + 1) / exchanges.length) * 100;
        currentOperation.progress.overall = overallProgress;
        this.sendProgress();
      }

      // Finalize operation
      if (!shouldStop) {
        currentOperation.status = 'completed';
        currentOperation.completedAt = new Date().toISOString();
        currentOperation.duration = Date.now() - new Date(currentOperation.startedAt).getTime();
        
        currentOperation.progress.stage = 'complete';
        currentOperation.progress.overall = 100;
        currentOperation.progress.message = 'Background sync completed successfully';

        currentOperation.results.summary.success = true;
        currentOperation.results.summary.exchangesProcessed = exchangesProcessed;
        
        this.sendProgress();
        this.sendComplete();
      } else {
        currentOperation.status = 'stopped';
        currentOperation.completedAt = new Date().toISOString();
      }

    } catch (error) {
      console.error('Background sync failed:', error);
      
      if (currentOperation) {
        currentOperation.status = 'error';
        currentOperation.errors.push({
          id: `error_${Date.now()}`,
          type: 'sync_timeout',
          severity: 'critical',
          message: error instanceof Error ? error.message : 'Background sync failed',
          timestamp: new Date().toISOString(),
          retryable: true,
          retryCount: 0
        });
        
        this.sendError(currentOperation.errors[currentOperation.errors.length - 1]);
      }
    } finally {
      isRunning = false;
    }
  }

  static async processExchange(exchange: ExchangeConnection, options: SyncOptions): Promise<void> {
    const exchangeProgress = currentOperation!.progress.exchanges[exchange.id];
    
    // Update progress: Connecting
    exchangeProgress.stage = 'connecting';
    exchangeProgress.progress = 10;
    exchangeProgress.message = `Connecting to ${exchange.name}...`;
    this.sendProgress();

    // Simulate connection
    await MockDataGenerator.simulateApiCall(500 + Math.random() * 1000);
    
    if (shouldStop) return;

    // Update progress: Fetching
    exchangeProgress.stage = 'fetching';
    exchangeProgress.progress = 30;
    exchangeProgress.message = 'Fetching transaction data...';
    this.sendProgress();

    // Fetch data in batches
    const allTransactions: TransactionData[] = [];
    const dataTypes = [
      { type: 'trades', enabled: options.includeTrades },
      { type: 'deposits', enabled: options.includeDeposits },
      { type: 'withdrawals', enabled: options.includeWithdrawals },
      { type: 'orders', enabled: options.includeOrderHistory }
    ];

    let fetchProgress = 30;
    const progressIncrement = 40 / dataTypes.filter(dt => dt.enabled).length;

    for (const dataType of dataTypes) {
      if (!dataType.enabled || shouldStop) continue;

      // Simulate fetching different transaction types
      const count = Math.floor(Math.random() * 50) + 10;
      const transactions = MockDataGenerator.generateTransactions(
        exchange.id,
        count,
        dataType.type as any
      );

      allTransactions.push(...transactions);
      exchangeProgress.fetchedRecords += count;
      
      fetchProgress += progressIncrement;
      exchangeProgress.progress = fetchProgress;
      exchangeProgress.message = `Fetched ${exchangeProgress.fetchedRecords} ${dataType.type}...`;
      this.sendProgress();

      // Simulate API delay
      await MockDataGenerator.simulateApiCall(200 + Math.random() * 300);
    }

    if (shouldStop) return;

    // Update progress: Processing
    exchangeProgress.stage = 'processing';
    exchangeProgress.progress = 70;
    exchangeProgress.message = 'Processing transactions...';
    this.sendProgress();

    // Process transactions in batches
    const batchSize = options.batchSize;
    let processedCount = 0;

    for (let i = 0; i < allTransactions.length; i += batchSize) {
      if (shouldStop) break;

      const batch = allTransactions.slice(i, i + batchSize);
      
      // Simulate processing
      await MockDataGenerator.simulateApiCall(100 + Math.random() * 200);
      
      processedCount += batch.length;
      exchangeProgress.processedRecords = processedCount;
      
      const processingProgress = 70 + (processedCount / allTransactions.length) * 20;
      exchangeProgress.progress = processingProgress;
      exchangeProgress.message = `Processed ${processedCount}/${allTransactions.length} transactions...`;
      this.sendProgress();

      // Simulate conflict detection
      if (Math.random() < 0.1) { // 10% chance of conflict per batch
        this.generateConflict(exchange.id, batch[0]);
      }
    }

    // Update progress: Complete
    exchangeProgress.stage = 'complete';
    exchangeProgress.progress = 100;
    exchangeProgress.message = `Completed - ${processedCount} transactions processed`;
    exchangeProgress.lastActivity = new Date().toISOString();

    // Update operation results
    currentOperation!.results.totalRecords += allTransactions.length;
    currentOperation!.results.processedRecords += processedCount;
    currentOperation!.results.newRecords += Math.floor(processedCount * 0.8);
    currentOperation!.results.updatedRecords += Math.floor(processedCount * 0.2);

    // Create exchange result
    currentOperation!.results.exchangeResults[exchange.id] = {
      exchangeId: exchange.id,
      status: 'success',
      records: {
        fetched: allTransactions.length,
        processed: processedCount,
        skipped: 0,
        errors: 0,
        trades: allTransactions.filter(t => t.type === 'trade').length,
        deposits: allTransactions.filter(t => t.type === 'deposit').length,
        withdrawals: allTransactions.filter(t => t.type === 'withdrawal').length,
        orders: allTransactions.filter(t => t.type === 'buy').length
      },
      performance: {
        fetchTime: 2000 + Math.random() * 3000,
        processTime: 1000 + Math.random() * 2000,
        avgRequestTime: 200 + Math.random() * 300,
        rateLimitHits: Math.floor(Math.random() * 3),
        retries: Math.floor(Math.random() * 2),
        dataTransferred: allTransactions.length * 1024 // Approximate bytes
      },
      errors: [],
      warnings: []
    };

    this.sendProgress();
  }

  static generateConflict(exchangeId: string, transaction: TransactionData): void {
    const conflict: ConflictData = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'amount_mismatch',
      severity: 'medium',
      status: 'detected',
      exchangeIds: [exchangeId],
      transactions: [
        {
          source: 'portfolio',
          data: transaction,
          confidence: 0.9
        },
        {
          source: 'exchange',
          exchangeId,
          data: {
            ...transaction,
            amount: transaction.amount * 1.01, // Slight difference
            total: transaction.amount * 1.01 * (transaction.price || 0)
          },
          confidence: 0.8
        }
      ],
      differences: [
        {
          field: 'amount',
          values: {
            portfolio: transaction.amount,
            exchange: transaction.amount * 1.01
          },
          severity: 'medium',
          confidence: 0.9
        }
      ],
      detectedAt: new Date().toISOString(),
      metadata: {
        algorithmVersion: '1.0.0',
        processingTime: 50,
        riskLevel: 'medium',
        recommendedAction: 'Review and resolve manually'
      }
    };

    currentOperation!.conflicts.push(conflict);
    currentOperation!.results.conflictRecords++;

    // Send conflict notification
    this.sendConflict(conflict);
  }

  static sendProgress(): void {
    if (currentOperation) {
      self.postMessage({
        type: 'PROGRESS_UPDATE',
        payload: {
          operationId: currentOperation.id,
          progress: currentOperation.progress
        } as ProgressUpdate
      });
    }
  }

  static sendComplete(): void {
    if (currentOperation) {
      self.postMessage({
        type: 'SYNC_COMPLETE',
        payload: {
          operationId: currentOperation.id,
          operation: currentOperation
        } as SyncResponse
      });
    }
  }

  static sendError(error: SyncError): void {
    if (currentOperation) {
      self.postMessage({
        type: 'SYNC_ERROR',
        payload: {
          operationId: currentOperation.id,
          error
        } as ErrorUpdate
      });
    }
  }

  static sendConflict(conflict: ConflictData): void {
    if (currentOperation) {
      self.postMessage({
        type: 'CONFLICT_DETECTED',
        payload: {
          operationId: currentOperation.id,
          conflict
        } as ConflictUpdate
      });
    }
  }

  static stopSync(): void {
    shouldStop = true;
    if (currentOperation) {
      currentOperation.status = 'stopping';
      currentOperation.progress.message = 'Stopping background sync...';
      this.sendProgress();
    }
  }
}

// Worker message handler
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'START_SYNC':
      if (!isRunning) {
        const request = payload as SyncRequest;
        await BackgroundSyncProcessor.processSync(request);
      } else {
        self.postMessage({
          type: 'SYNC_ERROR',
          payload: {
            operationId: payload.operationId,
            error: {
              id: `error_${Date.now()}`,
              type: 'sync_timeout',
              severity: 'medium',
              message: 'Background sync already in progress',
              timestamp: new Date().toISOString(),
              retryable: false,
              retryCount: 0
            }
          }
        });
      }
      break;

    case 'STOP_SYNC':
      BackgroundSyncProcessor.stopSync();
      break;

    default:
      console.warn('Unknown worker message type:', type);
  }
};

// Handle worker errors
self.onerror = (error) => {
  console.error('Worker error:', error);
  
  if (currentOperation) {
    const errorMessage = typeof error === 'string' ? error : 
                        error instanceof ErrorEvent ? error.message : 
                        'Unknown error';
    
    self.postMessage({
      type: 'SYNC_ERROR',
      payload: {
        operationId: currentOperation.id,
        error: {
          id: `error_${Date.now()}`,
          type: 'unknown_error',
          severity: 'critical',
          message: `Worker error: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          retryable: false,
          retryCount: 0
        }
      }
    });
  }
};

// Export types for TypeScript
export type {
  WorkerMessage,
  SyncRequest,
  SyncResponse,
  ProgressUpdate,
  ErrorUpdate,
  ConflictUpdate
};

export default null; // Required for TypeScript module