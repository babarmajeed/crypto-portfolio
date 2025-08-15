import {
  SyncOperation,
  SyncProgress,
  SyncResults,
  SyncError,
  ConflictData,
  ExchangeConnection,
  SyncOptions,
  SyncStatus,
  TransactionData,
  ExchangeResult,
  SyncHistoryEntry,
  SyncMetadata,
  ExchangeProgress,
  PerformanceMetrics,
  SyncType,
  ConflictType
} from '../types/sync.types';

export class AutoSyncService {
  private isRunning = false;
  private currentOperation: SyncOperation | null = null;
  private operationQueue: SyncOperation[] = [];
  private syncHistory: SyncHistoryEntry[] = [];
  private exchangeConnections = new Map<string, ExchangeConnection>();
  private rateLimiters = new Map<string, RateLimiter>();
  private progressCallbacks = new Map<string, (progress: SyncProgress) => void>();
  
  constructor() {
    this.loadSyncHistory();
    this.initializeRateLimiters();
  }

  /**
   * Start synchronization operation
   */
  async startSync(
    exchanges: ExchangeConnection[],
    options: SyncOptions,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncOperation> {
    if (this.isRunning && !options.conflictResolution.autoResolve) {
      throw new Error('Sync operation already in progress');
    }

    const operationId = this.generateOperationId();
    const operation: SyncOperation = {
      id: operationId,
      configurationId: options.conflictResolution?.priorityOrder?.[0] || 'default',
      exchanges: exchanges.map(e => e.id),
      status: 'syncing',
      type: options.syncType,
      startedAt: new Date().toISOString(),
      progress: this.createInitialProgress(exchanges),
      results: this.createInitialResults(),
      errors: [],
      conflicts: [],
      metadata: this.createMetadata()
    };

    this.currentOperation = operation;
    this.isRunning = true;

    if (onProgress) {
      this.progressCallbacks.set(operationId, onProgress);
    }

    try {
      await this.executeSync(operation, exchanges, options);
      return operation;
    } catch (error) {
      operation.status = 'error';
      operation.errors.push(this.createSyncError(error, 'sync_failed'));
      throw error;
    } finally {
      this.isRunning = false;
      this.progressCallbacks.delete(operationId);
      this.recordSyncHistory(operation);
    }
  }

  /**
   * Stop current synchronization
   */
  async stopSync(): Promise<void> {
    if (!this.isRunning || !this.currentOperation) {
      return;
    }

    this.currentOperation.status = 'stopping';
    this.updateProgress(this.currentOperation.id, {
      stage: 'finalizing',
      message: 'Stopping synchronization...'
    });

    // Cancel any pending operations
    await this.cancelPendingOperations();
    
    this.currentOperation.status = 'stopped';
    this.currentOperation.completedAt = new Date().toISOString();
    this.isRunning = false;
  }

  /**
   * Pause current synchronization
   */
  async pauseSync(): Promise<void> {
    if (!this.isRunning || !this.currentOperation) {
      return;
    }

    this.currentOperation.status = 'paused';
    this.updateProgress(this.currentOperation.id, {
      stage: 'finalizing',
      message: 'Synchronization paused'
    });
  }

  /**
   * Resume paused synchronization
   */
  async resumeSync(): Promise<void> {
    if (!this.currentOperation || this.currentOperation.status !== 'paused') {
      return;
    }

    this.currentOperation.status = 'syncing';
    this.updateProgress(this.currentOperation.id, {
      stage: 'fetching',
      message: 'Resuming synchronization...'
    });
  }

  /**
   * Execute synchronization for all exchanges
   */
  private async executeSync(
    operation: SyncOperation,
    exchanges: ExchangeConnection[],
    options: SyncOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Initialize progress
      this.updateProgress(operation.id, {
        stage: 'initializing',
        overall: 0,
        message: 'Initializing synchronization...'
      });

      // Create backup if enabled
      if (options.backup.enabled && options.backup.beforeSync) {
        await this.createBackup(operation.id);
      }

      // Process exchanges sequentially or in parallel based on options
      if (options.conflictResolution.autoResolve) {
        await this.processExchangesParallel(operation, exchanges, options);
      } else {
        await this.processExchangesSequential(operation, exchanges, options);
      }

      // Resolve conflicts
      if (operation.conflicts.length > 0) {
        await this.resolveConflicts(operation, options);
      }

      // Finalize operation
      operation.status = 'completed';
      operation.completedAt = new Date().toISOString();
      operation.duration = Date.now() - startTime;

      this.updateProgress(operation.id, {
        stage: 'complete',
        overall: 100,
        message: 'Synchronization completed successfully'
      });

    } catch (error) {
      operation.status = 'error';
      operation.errors.push(this.createSyncError(error, 'sync_failed'));
      
      this.updateProgress(operation.id, {
        stage: 'error',
        overall: 0,
        message: `Synchronization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error;
    }
  }

  /**
   * Process exchanges in parallel
   */
  private async processExchangesParallel(
    operation: SyncOperation,
    exchanges: ExchangeConnection[],
    options: SyncOptions
  ): Promise<void> {
    const promises = exchanges.map(exchange => 
      this.processExchange(operation, exchange, options)
    );

    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const exchange = exchanges[index];
        operation.errors.push(this.createSyncError(
          result.reason,
          'exchange_sync_failed',
          exchange.id
        ));
      }
    });
  }

  /**
   * Process exchanges sequentially
   */
  private async processExchangesSequential(
    operation: SyncOperation,
    exchanges: ExchangeConnection[],
    options: SyncOptions
  ): Promise<void> {
    for (const exchange of exchanges) {
      if (operation.status === 'stopping' || operation.status === 'paused') {
        break;
      }

      try {
        await this.processExchange(operation, exchange, options);
      } catch (error) {
        operation.errors.push(this.createSyncError(
          error,
          'exchange_sync_failed',
          exchange.id
        ));

        // Continue with next exchange or stop based on options
        if (!options.dataValidation.allowPartialSync) {
          throw error;
        }
      }
    }
  }

  /**
   * Process single exchange synchronization
   */
  private async processExchange(
    operation: SyncOperation,
    exchange: ExchangeConnection,
    options: SyncOptions
  ): Promise<ExchangeResult> {
    const startTime = Date.now();
    
    this.updateExchangeProgress(operation.id, exchange.id, {
      stage: 'connecting',
      progress: 0,
      message: `Connecting to ${exchange.name}...`
    });

    const result: ExchangeResult = {
      exchangeId: exchange.id,
      status: 'success',
      records: {
        fetched: 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        trades: 0,
        deposits: 0,
        withdrawals: 0,
        orders: 0
      },
      performance: {
        fetchTime: 0,
        processTime: 0,
        avgRequestTime: 0,
        rateLimitHits: 0,
        retries: 0,
        dataTransferred: 0
      },
      errors: [],
      warnings: []
    };

    try {
      // Test connection
      await this.testExchangeConnection(exchange);

      // Fetch transaction data
      const transactions = await this.fetchExchangeData(
        operation.id,
        exchange,
        options
      );

      result.records.fetched = transactions.length;

      // Validate data
      const validationResults = await this.validateTransactionData(
        transactions,
        options
      );

      if (!validationResults.isValid && !options.dataValidation.allowPartialSync) {
        throw new Error(`Data validation failed: ${validationResults.errors.join(', ')}`);
      }

      // Detect conflicts
      const conflicts = await this.detectConflicts(
        transactions,
        exchange.id,
        operation
      );

      operation.conflicts.push(...conflicts);

      // Process valid transactions
      const validTransactions = validationResults.validTransactions;
      const processResults = await this.processTransactions(
        operation.id,
        exchange.id,
        validTransactions,
        options
      );

      result.records.processed = processResults.processed;
      result.records.skipped = processResults.skipped;
      result.records.errors = processResults.errors;

      // Update counters by type
      this.updateRecordCountsByType(result.records, validTransactions);

      result.performance.fetchTime = Date.now() - startTime;
      
      this.updateExchangeProgress(operation.id, exchange.id, {
        stage: 'complete',
        progress: 100,
        message: `Processed ${result.records.processed} transactions`
      });

    } catch (error) {
      result.status = 'failed';
      result.errors.push(this.createSyncError(error, 'exchange_sync_failed', exchange.id));
      
      this.updateExchangeProgress(operation.id, exchange.id, {
        stage: 'error',
        progress: 0,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }

    operation.results.exchangeResults[exchange.id] = result;
    return result;
  }

  /**
   * Fetch data from exchange
   */
  private async fetchExchangeData(
    operationId: string,
    exchange: ExchangeConnection,
    options: SyncOptions
  ): Promise<TransactionData[]> {
    const transactions: TransactionData[] = [];
    const rateLimiter = this.rateLimiters.get(exchange.id);

    this.updateExchangeProgress(operationId, exchange.id, {
      stage: 'fetching',
      progress: 10,
      message: 'Fetching transaction data...'
    });

    try {
      // Get transaction history
      if (options.includeTrades) {
        const trades = await this.fetchWithRateLimit(
          () => this.getExchangeTransactionHistory(exchange, 'trades'),
          rateLimiter
        );
        transactions.push(...trades);
      }

      // Get deposits
      if (options.includeDeposits) {
        const deposits = await this.fetchWithRateLimit(
          () => this.getExchangeTransactionHistory(exchange, 'deposits'),
          rateLimiter
        );
        transactions.push(...deposits);
      }

      // Get withdrawals
      if (options.includeWithdrawals) {
        const withdrawals = await this.fetchWithRateLimit(
          () => this.getExchangeTransactionHistory(exchange, 'withdrawals'),
          rateLimiter
        );
        transactions.push(...withdrawals);
      }

      // Get order history
      if (options.includeOrderHistory) {
        const orders = await this.fetchWithRateLimit(
          () => this.getExchangeTransactionHistory(exchange, 'orders'),
          rateLimiter
        );
        transactions.push(...orders);
      }

    } catch (error) {
      if (this.isRateLimitError(error)) {
        throw new Error(`Rate limit exceeded for ${exchange.name}`);
      }
      throw error;
    }

    return this.deduplicateTransactions(transactions);
  }

  /**
   * Mock exchange API call with rate limiting
   */
  private async fetchWithRateLimit<T>(
    fetchFn: () => Promise<T>,
    rateLimiter?: RateLimiter
  ): Promise<T> {
    if (rateLimiter) {
      await rateLimiter.waitForToken();
    }

    try {
      return await fetchFn();
    } catch (error) {
      if (rateLimiter && this.isRateLimitError(error)) {
        rateLimiter.handleRateLimit();
      }
      throw error;
    }
  }

  /**
   * Mock exchange transaction history fetch
   */
  private async getExchangeTransactionHistory(
    exchange: ExchangeConnection,
    type: 'trades' | 'deposits' | 'withdrawals' | 'orders'
  ): Promise<TransactionData[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Mock data generation
    const mockTransactions: TransactionData[] = [];
    const count = Math.floor(Math.random() * 10) + 1;

    for (let i = 0; i < count; i++) {
      mockTransactions.push({
        id: `${exchange.id}_${type}_${i}_${Date.now()}`,
        exchangeId: exchange.id,
        exchangeTransactionId: `ext_${type}_${i}`,
        type: this.getTransactionType(type),
        asset: this.getRandomAsset(),
        amount: Math.random() * 10,
        price: Math.random() * 50000,
        total: 0, // Will be calculated
        fees: Math.random() * 10,
        timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      });
    }

    // Calculate totals
    mockTransactions.forEach(tx => {
      tx.total = (tx.amount || 0) * (tx.price || 0);
    });

    return mockTransactions;
  }

  /**
   * Validate transaction data
   */
  private async validateTransactionData(
    transactions: TransactionData[],
    options: SyncOptions
  ): Promise<{
    isValid: boolean;
    errors: string[];
    validTransactions: TransactionData[];
    invalidTransactions: TransactionData[];
  }> {
    const errors: string[] = [];
    const validTransactions: TransactionData[] = [];
    const invalidTransactions: TransactionData[] = [];

    for (const transaction of transactions) {
      const validationErrors = this.validateTransaction(transaction, options);
      
      if (validationErrors.length === 0) {
        validTransactions.push(transaction);
      } else {
        invalidTransactions.push(transaction);
        errors.push(`Transaction ${transaction.id}: ${validationErrors.join(', ')}`);
      }
    }

    const errorRate = invalidTransactions.length / transactions.length;
    const maxErrorThreshold = options.dataValidation.maxErrorThreshold / 100;

    return {
      isValid: errorRate <= maxErrorThreshold,
      errors,
      validTransactions,
      invalidTransactions
    };
  }

  /**
   * Validate individual transaction
   */
  private validateTransaction(transaction: TransactionData, options: SyncOptions): string[] {
    const errors: string[] = [];

    // Required fields
    if (!transaction.id) errors.push('Missing transaction ID');
    if (!transaction.type) errors.push('Missing transaction type');
    if (!transaction.asset) errors.push('Missing asset');
    if (!transaction.timestamp) errors.push('Missing timestamp');

    // Amount validation
    if (options.dataValidation.validateAmounts) {
      if (transaction.amount !== undefined && transaction.amount < 0) {
        errors.push('Amount cannot be negative');
      }
      if (transaction.price !== undefined && transaction.price < 0) {
        errors.push('Price cannot be negative');
      }
    }

    // Date validation
    if (options.dataValidation.validateDates) {
      const date = new Date(transaction.timestamp);
      if (isNaN(date.getTime())) {
        errors.push('Invalid timestamp format');
      }
      if (date > new Date()) {
        errors.push('Transaction date cannot be in the future');
      }
    }

    // Asset validation
    if (options.dataValidation.validateAssets) {
      if (transaction.asset && !/^[A-Z]{2,10}$/.test(transaction.asset)) {
        errors.push('Invalid asset format');
      }
    }

    return errors;
  }

  /**
   * Detect conflicts between transactions
   */
  private async detectConflicts(
    newTransactions: TransactionData[],
    exchangeId: string,
    operation: SyncOperation
  ): Promise<ConflictData[]> {
    const conflicts: ConflictData[] = [];
    const existingTransactions = await this.getExistingTransactions(exchangeId);

    for (const newTx of newTransactions) {
      const similarTransactions = existingTransactions.filter(existing => 
        this.areTransactionsSimilar(existing, newTx)
      );

      for (const existingTx of similarTransactions) {
        if (!this.areTransactionsEqual(existingTx, newTx)) {
          conflicts.push(this.createConflict(existingTx, newTx, exchangeId));
        }
      }
    }

    return conflicts;
  }

  /**
   * Process transactions
   */
  private async processTransactions(
    operationId: string,
    exchangeId: string,
    transactions: TransactionData[],
    options: SyncOptions
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    const results = { processed: 0, skipped: 0, errors: 0 };
    const batchSize = options.batchSize;

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);
      
      this.updateExchangeProgress(operationId, exchangeId, {
        stage: 'processing',
        progress: 50 + (i / transactions.length) * 40,
        message: `Processing batch ${Math.floor(i / batchSize) + 1}...`
      });

      for (const transaction of batch) {
        try {
          await this.saveTransaction(transaction);
          results.processed++;
        } catch (error) {
          console.error('Error processing transaction:', error);
          results.errors++;
        }
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return results;
  }

  /**
   * Resolve conflicts using configured strategy
   */
  private async resolveConflicts(
    operation: SyncOperation,
    options: SyncOptions
  ): Promise<void> {
    if (!options.conflictResolution.autoResolve) {
      return; // Manual resolution required
    }

    this.updateProgress(operation.id, {
      stage: 'resolving-conflicts',
      message: `Resolving ${operation.conflicts.length} conflicts...`
    });

    for (const conflict of operation.conflicts) {
      try {
        const resolution = await this.autoResolveConflict(
          conflict,
          options.conflictResolution.strategy
        );
        
        conflict.status = 'resolved';
        conflict.resolvedAt = new Date().toISOString();
        conflict.resolution = resolution;

      } catch (error) {
        console.error('Error resolving conflict:', error);
        conflict.status = 'manual_review';
      }
    }
  }

  /**
   * Auto-resolve conflict using strategy
   */
  private async autoResolveConflict(
    conflict: ConflictData,
    strategy: string
  ): Promise<any> {
    switch (strategy) {
      case 'exchange-priority':
        return this.resolveByExchangePriority(conflict);
      case 'timestamp-priority':
        return this.resolveByTimestamp(conflict);
      case 'merge':
        return this.mergeConflictingTransactions(conflict);
      default:
        throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }
  }

  // Helper methods
  private generateOperationId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createInitialProgress(exchanges: ExchangeConnection[]): SyncProgress {
    const exchangeProgress: { [exchangeId: string]: ExchangeProgress } = {};
    
    exchanges.forEach(exchange => {
      exchangeProgress[exchange.id] = {
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

    return {
      stage: 'initializing',
      overall: 0,
      exchanges: exchangeProgress,
      message: 'Starting synchronization...'
    };
  }

  private createInitialResults(): SyncResults {
    return {
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
    };
  }

  private createMetadata(): SyncMetadata {
    return {
      version: '1.0.0',
      environment: 'development',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      features: ['auto-sync', 'conflict-resolution', 'batch-processing']
    };
  }

  private createSyncError(
    error: any,
    type: string,
    exchangeId?: string
  ): SyncError {
    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type as any,
      severity: 'medium',
      exchangeId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      retryable: true,
      retryCount: 0
    };
  }

  private updateProgress(operationId: string, update: Partial<SyncProgress>): void {
    if (this.currentOperation?.id === operationId) {
      this.currentOperation.progress = {
        ...this.currentOperation.progress,
        ...update
      };

      const callback = this.progressCallbacks.get(operationId);
      if (callback) {
        callback(this.currentOperation.progress);
      }
    }
  }

  private updateExchangeProgress(
    operationId: string,
    exchangeId: string,
    update: Partial<ExchangeProgress>
  ): void {
    if (this.currentOperation?.id === operationId) {
      const exchanges = this.currentOperation.progress.exchanges;
      if (exchanges[exchangeId]) {
        exchanges[exchangeId] = {
          ...exchanges[exchangeId],
          ...update,
          lastActivity: new Date().toISOString()
        };

        // Update overall progress
        const totalProgress = Object.values(exchanges)
          .reduce((sum, ep) => sum + ep.progress, 0) / Object.keys(exchanges).length;
        
        this.currentOperation.progress.overall = totalProgress;
      }
    }
  }

  private async testExchangeConnection(exchange: ExchangeConnection): Promise<void> {
    // Mock connection test
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (Math.random() < 0.05) { // 5% chance of connection failure
      throw new Error(`Failed to connect to ${exchange.name}`);
    }
  }

  private deduplicateTransactions(transactions: TransactionData[]): TransactionData[] {
    const seen = new Set<string>();
    return transactions.filter(tx => {
      const key = `${tx.exchangeTransactionId}_${tx.timestamp}_${tx.amount}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private areTransactionsSimilar(tx1: TransactionData, tx2: TransactionData): boolean {
    return (
      tx1.asset === tx2.asset &&
      tx1.type === tx2.type &&
      Math.abs(new Date(tx1.timestamp).getTime() - new Date(tx2.timestamp).getTime()) < 60000 &&
      Math.abs((tx1.amount || 0) - (tx2.amount || 0)) < 0.00000001
    );
  }

  private areTransactionsEqual(tx1: TransactionData, tx2: TransactionData): boolean {
    return (
      tx1.asset === tx2.asset &&
      tx1.type === tx2.type &&
      tx1.amount === tx2.amount &&
      tx1.price === tx2.price &&
      tx1.timestamp === tx2.timestamp
    );
  }

  private createConflict(
    existing: TransactionData,
    incoming: TransactionData,
    exchangeId: string
  ): ConflictData {
    const differences = this.getTransactionDifferences(existing, incoming);
    
    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: this.determineConflictType(differences),
      severity: differences.length > 2 ? 'high' : 'medium',
      status: 'detected',
      exchangeIds: [exchangeId],
      transactions: [
        { source: 'portfolio', data: existing, confidence: 0.9 },
        { source: 'exchange', exchangeId, data: incoming, confidence: 0.8 }
      ],
      differences,
      detectedAt: new Date().toISOString(),
      metadata: {
        algorithmVersion: '1.0.0',
        processingTime: 0,
        riskLevel: 'medium',
        recommendedAction: 'Review and resolve manually'
      }
    };
  }

  private getTransactionDifferences(tx1: TransactionData, tx2: TransactionData): any[] {
    const differences: any[] = [];
    
    ['amount', 'price', 'total', 'fees', 'timestamp'].forEach(field => {
      const val1 = (tx1 as any)[field];
      const val2 = (tx2 as any)[field];
      
      if (val1 !== val2) {
        differences.push({
          field,
          values: { existing: val1, incoming: val2 },
          severity: field === 'amount' || field === 'price' ? 'high' : 'medium',
          confidence: 0.9
        });
      }
    });

    return differences;
  }

  private determineConflictType(differences: any[]): ConflictType {
    for (const diff of differences) {
      if (diff.field === 'amount') return 'amount_mismatch';
      if (diff.field === 'timestamp') return 'timestamp_mismatch';
      if (diff.field === 'asset') return 'asset_mismatch';
      if (diff.field === 'type') return 'type_mismatch';
      if (diff.field === 'fees') return 'fee_mismatch';
    }
    return 'duplicate_transaction';
  }

  private resolveByExchangePriority(conflict: ConflictData): any {
    // Use exchange data as priority
    const exchangeTransaction = conflict.transactions.find(t => t.source === 'exchange');
    return {
      strategy: 'exchange-priority',
      action: 'use_incoming',
      resolvedTransaction: exchangeTransaction?.data,
      reasoning: 'Exchange data takes priority',
      confidence: 0.8,
      manual: false
    };
  }

  private resolveByTimestamp(conflict: ConflictData): any {
    // Use most recent timestamp
    const transactions = conflict.transactions.map(t => t.data);
    const mostRecent = transactions.reduce((latest, current) => 
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    );

    return {
      strategy: 'timestamp-priority',
      action: 'use_incoming',
      resolvedTransaction: mostRecent,
      reasoning: 'Most recent timestamp takes priority',
      confidence: 0.7,
      manual: false
    };
  }

  private mergeConflictingTransactions(conflict: ConflictData): any {
    // Merge transaction data
    const transactions = conflict.transactions.map(t => t.data);
    const merged = { ...transactions[0] };

    // Use non-null values from either transaction
    transactions.forEach(tx => {
      Object.keys(tx).forEach(key => {
        if ((tx as any)[key] !== null && (tx as any)[key] !== undefined) {
          (merged as any)[key] = (tx as any)[key];
        }
      });
    });

    return {
      strategy: 'merge',
      action: 'create_new',
      resolvedTransaction: merged,
      reasoning: 'Merged data from both sources',
      confidence: 0.6,
      manual: false
    };
  }

  private getTransactionType(type: string): any {
    const typeMap: { [key: string]: any } = {
      'trades': 'trade',
      'deposits': 'deposit',
      'withdrawals': 'withdrawal',
      'orders': 'buy'
    };
    return typeMap[type] || 'trade';
  }

  private getRandomAsset(): string {
    const assets = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'DOGE'];
    return assets[Math.floor(Math.random() * assets.length)];
  }

  private updateRecordCountsByType(records: any, transactions: TransactionData[]): void {
    transactions.forEach(tx => {
      switch (tx.type) {
        case 'trade':
        case 'buy':
        case 'sell':
          records.trades++;
          break;
        case 'deposit':
          records.deposits++;
          break;
        case 'withdrawal':
          records.withdrawals++;
          break;
        default:
          records.orders++;
      }
    });
  }

  private async saveTransaction(transaction: TransactionData): Promise<void> {
    // Mock save to localStorage
    const existing = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]');
    existing.push(transaction);
    localStorage.setItem('portfolio_transactions', JSON.stringify(existing));
  }

  private async getExistingTransactions(exchangeId: string): Promise<TransactionData[]> {
    // Mock load from localStorage
    const all = JSON.parse(localStorage.getItem('portfolio_transactions') || '[]');
    return all.filter((tx: TransactionData) => tx.exchangeId === exchangeId);
  }

  private isRateLimitError(error: any): boolean {
    return error?.code === 'RATE_LIMIT_EXCEEDED' || 
           error?.status === 429 ||
           error?.message?.includes('rate limit');
  }

  private async cancelPendingOperations(): Promise<void> {
    // Cancel any pending HTTP requests, timers, etc.
    this.operationQueue = [];
  }

  private async createBackup(operationId: string): Promise<void> {
    // Mock backup creation
    const backup = {
      id: `backup_${operationId}`,
      timestamp: new Date().toISOString(),
      data: JSON.parse(localStorage.getItem('portfolio_transactions') || '[]')
    };
    
    localStorage.setItem(`backup_${operationId}`, JSON.stringify(backup));
  }

  private recordSyncHistory(operation: SyncOperation): void {
    const historyEntry: SyncHistoryEntry = {
      id: operation.id,
      configurationId: operation.configurationId,
      operationId: operation.id,
      type: operation.type,
      status: operation.status,
      exchanges: operation.exchanges,
      startedAt: operation.startedAt,
      completedAt: operation.completedAt,
      duration: operation.duration,
      results: operation.results,
      errors: operation.errors,
      conflicts: operation.conflicts,
      performance: {
        totalTime: operation.duration || 0,
        networkTime: 0,
        processTime: 0,
        memoryPeak: 0,
        memoryAverage: 0,
        cpuPeak: 0,
        cpuAverage: 0,
        diskIO: 0,
        networkIO: 0,
        cacheHitRate: 0
      }
    };

    this.syncHistory.unshift(historyEntry);
    this.syncHistory.splice(100); // Keep only last 100 entries

    localStorage.setItem('sync_history', JSON.stringify(this.syncHistory));
  }

  private loadSyncHistory(): void {
    const stored = localStorage.getItem('sync_history');
    if (stored) {
      try {
        this.syncHistory = JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to load sync history:', error);
        this.syncHistory = [];
      }
    }
  }

  private initializeRateLimiters(): void {
    // Initialize rate limiters for common exchanges
    const exchanges = ['coinbase', 'binance', 'kraken', 'kucoin'];
    exchanges.forEach(exchangeId => {
      this.rateLimiters.set(exchangeId, new RateLimiter({
        requestsPerSecond: 10,
        requestsPerMinute: 600,
        burstLimit: 20
      }));
    });
  }

  // Public API methods
  public getSyncHistory(): SyncHistoryEntry[] {
    return [...this.syncHistory];
  }

  public getCurrentOperation(): SyncOperation | null {
    return this.currentOperation;
  }

  public isOperationRunning(): boolean {
    return this.isRunning;
  }

  public async cancelAllOperations(): Promise<void> {
    await this.stopSync();
    this.operationQueue = [];
  }
}

/**
 * Simple rate limiter implementation
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(config: { requestsPerSecond: number; requestsPerMinute: number; burstLimit?: number }) {
    this.maxTokens = config.burstLimit || config.requestsPerSecond * 2;
    this.refillRate = config.requestsPerSecond;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  async waitForToken(): Promise<void> {
    this.refillTokens();
    
    if (this.tokens < 1) {
      const waitTime = (1 / this.refillRate) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForToken();
    }
    
    this.tokens--;
  }

  handleRateLimit(): void {
    this.tokens = 0; // Empty the bucket
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

export const autoSyncService = new AutoSyncService();