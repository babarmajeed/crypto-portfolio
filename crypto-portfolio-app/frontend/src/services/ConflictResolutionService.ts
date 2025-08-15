import {
  ConflictData,
  ConflictResolution,
  ConflictResolutionStrategy,
  ConflictType,
  TransactionData,
  ConflictTransaction,
  ConflictPattern,
  ConflictMetadata
} from '../types/sync.types';

export class ConflictResolutionService {
  private resolutionHistory: Map<string, ConflictResolution> = new Map();
  private conflictPatterns: ConflictPattern[] = [];
  private userPreferences: Map<ConflictType, ConflictResolutionStrategy> = new Map();
  private confidenceThresholds = {
    auto_resolve: 0.8,
    suggest_resolution: 0.6,
    require_manual: 0.4
  };

  constructor() {
    this.loadResolutionHistory();
    this.loadConflictPatterns();
    this.loadUserPreferences();
  }

  /**
   * Analyze conflict and provide resolution recommendations
   */
  async analyzeConflict(conflict: ConflictData): Promise<{
    recommendations: ConflictResolution[];
    riskAssessment: RiskAssessment;
    similarCases: ConflictPattern[];
    confidence: number;
  }> {
    const startTime = Date.now();

    // Find similar past conflicts
    const similarCases = this.findSimilarConflicts(conflict);
    
    // Generate multiple resolution strategies
    const recommendations = await this.generateResolutionStrategies(conflict);
    
    // Assess risk level
    const riskAssessment = this.assessConflictRisk(conflict);
    
    // Calculate overall confidence
    const confidence = this.calculateConfidence(conflict, recommendations, similarCases);

    // Update metadata
    conflict.metadata = {
      ...conflict.metadata,
      processingTime: Date.now() - startTime,
      similarityScore: this.calculateSimilarityScore(conflict, similarCases),
      riskLevel: riskAssessment.level,
      recommendedAction: recommendations[0]?.action || 'manual_review'
    };

    return {
      recommendations,
      riskAssessment,
      similarCases,
      confidence
    };
  }

  /**
   * Auto-resolve conflict using specified strategy
   */
  async autoResolveConflict(
    conflict: ConflictData,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    const resolution = await this.resolveConflictWithStrategy(conflict, strategy);
    
    // Record resolution
    this.recordResolution(conflict.id, resolution);
    
    // Update patterns
    await this.updateConflictPatterns(conflict, resolution);
    
    return resolution;
  }

  /**
   * Resolve multiple conflicts in batch
   */
  async batchResolveConflicts(
    conflicts: ConflictData[],
    strategy: ConflictResolutionStrategy
  ): Promise<Map<string, ConflictResolution>> {
    const resolutions = new Map<string, ConflictResolution>();
    
    // Group conflicts by type for more efficient processing
    const groupedConflicts = this.groupConflictsByType(conflicts);
    
    for (const [type, typeConflicts] of groupedConflicts) {
      const typeStrategy = this.getStrategyForType(type, strategy);
      
      for (const conflict of typeConflicts) {
        try {
          const resolution = await this.autoResolveConflict(conflict, typeStrategy);
          resolutions.set(conflict.id, resolution);
        } catch (error) {
          console.error(`Failed to resolve conflict ${conflict.id}:`, error);
          resolutions.set(conflict.id, {
            strategy: 'manual',
            action: 'manual_review',
            reasoning: `Auto-resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            confidence: 0,
            manual: true
          });
        }
      }
    }
    
    return resolutions;
  }

  /**
   * Merge conflicting transactions using smart merging logic
   */
  async mergeTransactions(
    transactions: ConflictTransaction[],
    mergeStrategy: 'conservative' | 'aggressive' | 'balanced' = 'balanced'
  ): Promise<TransactionData> {
    if (transactions.length === 0) {
      throw new Error('No transactions to merge');
    }

    if (transactions.length === 1) {
      return transactions[0].data;
    }

    // Start with the highest confidence transaction as base
    const sortedTransactions = [...transactions].sort((a, b) => b.confidence - a.confidence);
    const baseTransaction = { ...sortedTransactions[0].data };

    // Merge fields based on strategy
    for (let i = 1; i < sortedTransactions.length; i++) {
      const transaction = sortedTransactions[i];
      baseTransaction = this.mergeTransactionFields(
        baseTransaction,
        transaction.data,
        transaction.confidence,
        mergeStrategy
      );
    }

    // Validate merged transaction
    this.validateMergedTransaction(baseTransaction);

    return baseTransaction;
  }

  /**
   * Generate resolution strategies for a conflict
   */
  private async generateResolutionStrategies(conflict: ConflictData): Promise<ConflictResolution[]> {
    const strategies: ConflictResolution[] = [];

    // Strategy 1: Exchange Priority
    if (this.hasExchangeTransaction(conflict)) {
      strategies.push(await this.createExchangePriorityResolution(conflict));
    }

    // Strategy 2: Timestamp Priority
    strategies.push(await this.createTimestampPriorityResolution(conflict));

    // Strategy 3: Confidence-based
    strategies.push(await this.createConfidenceBasedResolution(conflict));

    // Strategy 4: Merge
    if (conflict.transactions.length >= 2) {
      strategies.push(await this.createMergeResolution(conflict));
    }

    // Strategy 5: User preference
    const userPreference = this.userPreferences.get(conflict.type);
    if (userPreference) {
      strategies.push(await this.createUserPreferenceResolution(conflict, userPreference));
    }

    // Sort by confidence
    return strategies.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Resolve conflict using specific strategy
   */
  private async resolveConflictWithStrategy(
    conflict: ConflictData,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    switch (strategy) {
      case 'exchange-priority':
        return this.createExchangePriorityResolution(conflict);
      
      case 'timestamp-priority':
        return this.createTimestampPriorityResolution(conflict);
      
      case 'merge':
        return this.createMergeResolution(conflict);
      
      case 'manual':
        return this.createManualResolution(conflict);
      
      case 'skip':
        return this.createSkipResolution(conflict);
      
      default:
        throw new Error(`Unknown resolution strategy: ${strategy}`);
    }
  }

  /**
   * Create exchange priority resolution
   */
  private async createExchangePriorityResolution(conflict: ConflictData): Promise<ConflictResolution> {
    const exchangeTransaction = conflict.transactions.find(t => t.source === 'exchange');
    
    if (!exchangeTransaction) {
      throw new Error('No exchange transaction found for exchange priority resolution');
    }

    return {
      strategy: 'exchange-priority',
      action: 'use_incoming',
      resolvedTransaction: exchangeTransaction.data,
      reasoning: 'Exchange data is considered more authoritative and up-to-date',
      confidence: this.calculateExchangePriorityConfidence(conflict),
      manual: false
    };
  }

  /**
   * Create timestamp priority resolution
   */
  private async createTimestampPriorityResolution(conflict: ConflictData): Promise<ConflictResolution> {
    const transactions = conflict.transactions.map(t => t.data);
    const mostRecent = transactions.reduce((latest, current) => 
      new Date(current.timestamp) > new Date(latest.timestamp) ? current : latest
    );

    return {
      strategy: 'timestamp-priority',
      action: 'use_incoming',
      resolvedTransaction: mostRecent,
      reasoning: 'Most recent transaction data is likely more accurate',
      confidence: this.calculateTimestampPriorityConfidence(conflict),
      manual: false
    };
  }

  /**
   * Create confidence-based resolution
   */
  private async createConfidenceBasedResolution(conflict: ConflictData): Promise<ConflictResolution> {
    const highestConfidenceTransaction = conflict.transactions.reduce((highest, current) =>
      current.confidence > highest.confidence ? current : highest
    );

    return {
      strategy: 'exchange-priority', // Using highest confidence
      action: 'use_incoming',
      resolvedTransaction: highestConfidenceTransaction.data,
      reasoning: `Transaction with highest confidence (${highestConfidenceTransaction.confidence}) selected`,
      confidence: highestConfidenceTransaction.confidence,
      manual: false
    };
  }

  /**
   * Create merge resolution
   */
  private async createMergeResolution(conflict: ConflictData): Promise<ConflictResolution> {
    const mergedTransaction = await this.mergeTransactions(conflict.transactions, 'balanced');

    return {
      strategy: 'merge',
      action: 'create_new',
      resolvedTransaction: mergedTransaction,
      reasoning: 'Merged data from all sources to create comprehensive transaction',
      confidence: this.calculateMergeConfidence(conflict),
      manual: false
    };
  }

  /**
   * Create manual resolution
   */
  private async createManualResolution(conflict: ConflictData): Promise<ConflictResolution> {
    return {
      strategy: 'manual',
      action: 'manual_review',
      reasoning: 'Conflict requires manual review due to complexity or low confidence',
      confidence: 0,
      manual: true
    };
  }

  /**
   * Create skip resolution
   */
  private async createSkipResolution(conflict: ConflictData): Promise<ConflictResolution> {
    return {
      strategy: 'skip',
      action: 'ignore',
      reasoning: 'Conflict marked for skipping based on user preference',
      confidence: 1.0,
      manual: false
    };
  }

  /**
   * Create user preference resolution
   */
  private async createUserPreferenceResolution(
    conflict: ConflictData,
    strategy: ConflictResolutionStrategy
  ): Promise<ConflictResolution> {
    const baseResolution = await this.resolveConflictWithStrategy(conflict, strategy);
    
    return {
      ...baseResolution,
      reasoning: `${baseResolution.reasoning} (User preference applied)`,
      confidence: Math.min(baseResolution.confidence + 0.1, 1.0) // Slight confidence boost
    };
  }

  /**
   * Merge transaction fields
   */
  private mergeTransactionFields(
    base: TransactionData,
    other: TransactionData,
    otherConfidence: number,
    strategy: 'conservative' | 'aggressive' | 'balanced'
  ): TransactionData {
    const merged = { ...base };

    // Define field priorities based on strategy
    const fieldPriorities = this.getFieldPriorities(strategy);

    Object.keys(other).forEach(field => {
      const otherValue = (other as any)[field];
      const baseValue = (base as any)[field];

      if (otherValue !== null && otherValue !== undefined) {
        if (baseValue === null || baseValue === undefined) {
          // Use other value if base is missing
          (merged as any)[field] = otherValue;
        } else if (this.shouldUseOtherValue(field, baseValue, otherValue, otherConfidence, strategy)) {
          // Use other value based on strategy
          (merged as any)[field] = otherValue;
        }
      }
    });

    return merged;
  }

  /**
   * Determine if other value should be used
   */
  private shouldUseOtherValue(
    field: string,
    baseValue: any,
    otherValue: any,
    otherConfidence: number,
    strategy: 'conservative' | 'aggressive' | 'balanced'
  ): boolean {
    switch (strategy) {
      case 'conservative':
        // Only use other value if confidence is very high
        return otherConfidence > 0.9;
      
      case 'aggressive':
        // Use other value if confidence is reasonable
        return otherConfidence > 0.5;
      
      case 'balanced':
        // Use other value based on field type and confidence
        if (field === 'timestamp') {
          // Prefer more recent timestamp
          return new Date(otherValue) > new Date(baseValue);
        }
        if (field === 'amount' || field === 'price') {
          // Prefer non-zero values
          return otherValue !== 0 && baseValue === 0;
        }
        return otherConfidence > 0.7;
      
      default:
        return false;
    }
  }

  /**
   * Get field priorities for merging strategy
   */
  private getFieldPriorities(strategy: 'conservative' | 'aggressive' | 'balanced'): { [field: string]: number } {
    const basePriorities = {
      id: 1.0,
      timestamp: 0.9,
      amount: 0.8,
      price: 0.8,
      asset: 0.7,
      type: 0.7,
      fees: 0.6,
      total: 0.5
    };

    switch (strategy) {
      case 'conservative':
        return Object.fromEntries(
          Object.entries(basePriorities).map(([field, priority]) => [field, priority * 0.8])
        );
      
      case 'aggressive':
        return Object.fromEntries(
          Object.entries(basePriorities).map(([field, priority]) => [field, priority * 1.2])
        );
      
      default:
        return basePriorities;
    }
  }

  /**
   * Validate merged transaction
   */
  private validateMergedTransaction(transaction: TransactionData): void {
    const errors: string[] = [];

    if (!transaction.id) errors.push('Missing transaction ID');
    if (!transaction.asset) errors.push('Missing asset');
    if (!transaction.type) errors.push('Missing transaction type');
    if (!transaction.timestamp) errors.push('Missing timestamp');
    if (transaction.amount !== undefined && transaction.amount < 0) errors.push('Negative amount');

    if (errors.length > 0) {
      throw new Error(`Merged transaction validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Find similar conflicts from history
   */
  private findSimilarConflicts(conflict: ConflictData): ConflictPattern[] {
    return this.conflictPatterns.filter(pattern => {
      // Match by type
      if (pattern.type !== conflict.type) return false;
      
      // Check similarity score
      const similarity = this.calculateConflictSimilarity(conflict, pattern);
      return similarity > 0.7;
    });
  }

  /**
   * Calculate conflict similarity score
   */
  private calculateConflictSimilarity(conflict: ConflictData, pattern: ConflictPattern): number {
    let score = 0;
    let factors = 0;

    // Type match
    if (conflict.type === pattern.type) {
      score += 0.4;
    }
    factors++;

    // Severity match
    if (conflict.severity === 'high' && pattern.frequency > 10) {
      score += 0.2;
    }
    factors++;

    // Exchange match
    if (conflict.exchangeIds.length > 0 && pattern.id.includes(conflict.exchangeIds[0])) {
      score += 0.2;
    }
    factors++;

    // Difference count similarity
    const diffCountSimilarity = 1 - Math.abs(conflict.differences.length - 3) / 10;
    score += diffCountSimilarity * 0.2;
    factors++;

    return score / factors;
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(
    conflict: ConflictData,
    recommendations: ConflictResolution[],
    similarCases: ConflictPattern[]
  ): number {
    let confidence = 0;
    let factors = 0;

    // Base confidence from best recommendation
    if (recommendations.length > 0) {
      confidence += recommendations[0].confidence * 0.4;
      factors++;
    }

    // Historical similarity boost
    if (similarCases.length > 0) {
      const avgPattern = similarCases.reduce((sum, p) => sum + p.confidence, 0) / similarCases.length;
      confidence += avgPattern * 0.3;
      factors++;
    }

    // Data quality factor
    const dataQuality = this.assessDataQuality(conflict);
    confidence += dataQuality * 0.2;
    factors++;

    // Conflict complexity penalty
    const complexityPenalty = Math.min(conflict.differences.length / 10, 0.3);
    confidence -= complexityPenalty * 0.1;
    factors++;

    return Math.max(0, Math.min(1, confidence / factors));
  }

  /**
   * Assess conflict risk
   */
  private assessConflictRisk(conflict: ConflictData): RiskAssessment {
    let riskScore = 0;
    const factors: string[] = [];

    // High-value transactions
    const hasHighValue = conflict.transactions.some(t => 
      (t.data.total || 0) > 10000 || (t.data.amount || 0) * (t.data.price || 0) > 10000
    );
    if (hasHighValue) {
      riskScore += 0.3;
      factors.push('High-value transaction');
    }

    // Many differences
    if (conflict.differences.length > 3) {
      riskScore += 0.2;
      factors.push('Multiple data differences');
    }

    // Critical fields affected
    const criticalFields = ['amount', 'price', 'total', 'asset'];
    const hasCriticalDifferences = conflict.differences.some(d => 
      criticalFields.includes(d.field)
    );
    if (hasCriticalDifferences) {
      riskScore += 0.3;
      factors.push('Critical fields affected');
    }

    // Low confidence transactions
    const hasLowConfidence = conflict.transactions.some(t => t.confidence < 0.5);
    if (hasLowConfidence) {
      riskScore += 0.2;
      factors.push('Low confidence data');
    }

    const level = riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';

    return {
      level,
      score: riskScore,
      factors,
      recommendations: this.getRiskRecommendations(level, factors)
    };
  }

  /**
   * Get risk recommendations
   */
  private getRiskRecommendations(level: 'low' | 'medium' | 'high', factors: string[]): string[] {
    const recommendations: string[] = [];

    switch (level) {
      case 'high':
        recommendations.push('Require manual review');
        recommendations.push('Create backup before resolution');
        recommendations.push('Notify administrator');
        break;
      
      case 'medium':
        recommendations.push('Consider manual review');
        recommendations.push('Use conservative resolution strategy');
        break;
      
      case 'low':
        recommendations.push('Auto-resolution acceptable');
        break;
    }

    if (factors.includes('High-value transaction')) {
      recommendations.push('Verify with exchange if possible');
    }

    if (factors.includes('Critical fields affected')) {
      recommendations.push('Double-check field mappings');
    }

    return recommendations;
  }

  /**
   * Calculate confidence for specific resolution strategies
   */
  private calculateExchangePriorityConfidence(conflict: ConflictData): number {
    const exchangeTransaction = conflict.transactions.find(t => t.source === 'exchange');
    if (!exchangeTransaction) return 0;

    let confidence = exchangeTransaction.confidence;

    // Boost confidence if exchange is known to be reliable
    const reliableExchanges = ['coinbase', 'binance', 'kraken'];
    if (reliableExchanges.includes(exchangeTransaction.exchangeId || '')) {
      confidence = Math.min(confidence + 0.1, 1.0);
    }

    return confidence;
  }

  private calculateTimestampPriorityConfidence(conflict: ConflictData): number {
    const timestamps = conflict.transactions.map(t => new Date(t.data.timestamp).getTime());
    const timeDiff = Math.max(...timestamps) - Math.min(...timestamps);
    
    // Higher confidence if timestamps are close together
    if (timeDiff < 60000) return 0.9; // Within 1 minute
    if (timeDiff < 300000) return 0.7; // Within 5 minutes
    if (timeDiff < 3600000) return 0.5; // Within 1 hour
    
    return 0.3;
  }

  private calculateMergeConfidence(conflict: ConflictData): number {
    // Base confidence on data completeness and consistency
    const avgConfidence = conflict.transactions.reduce((sum, t) => sum + t.confidence, 0) / conflict.transactions.length;
    
    // Penalty for many differences
    const diffPenalty = Math.min(conflict.differences.length / 10, 0.3);
    
    return Math.max(0.3, avgConfidence - diffPenalty);
  }

  /**
   * Helper methods
   */
  private hasExchangeTransaction(conflict: ConflictData): boolean {
    return conflict.transactions.some(t => t.source === 'exchange');
  }

  private groupConflictsByType(conflicts: ConflictData[]): Map<ConflictType, ConflictData[]> {
    const groups = new Map<ConflictType, ConflictData[]>();
    
    conflicts.forEach(conflict => {
      if (!groups.has(conflict.type)) {
        groups.set(conflict.type, []);
      }
      groups.get(conflict.type)!.push(conflict);
    });
    
    return groups;
  }

  private getStrategyForType(type: ConflictType, defaultStrategy: ConflictResolutionStrategy): ConflictResolutionStrategy {
    const userPreference = this.userPreferences.get(type);
    return userPreference || defaultStrategy;
  }

  private assessDataQuality(conflict: ConflictData): number {
    let qualityScore = 0;
    let factors = 0;

    // Check transaction completeness
    conflict.transactions.forEach(transaction => {
      const requiredFields = ['id', 'type', 'asset', 'amount', 'timestamp'];
      const missingFields = requiredFields.filter(field => 
        !(transaction.data as any)[field]
      );
      
      qualityScore += (requiredFields.length - missingFields.length) / requiredFields.length;
      factors++;
    });

    return factors > 0 ? qualityScore / factors : 0;
  }

  private calculateSimilarityScore(conflict: ConflictData, similarCases: ConflictPattern[]): number {
    if (similarCases.length === 0) return 0;
    
    return similarCases.reduce((sum, pattern) => 
      sum + this.calculateConflictSimilarity(conflict, pattern), 0
    ) / similarCases.length;
  }

  private recordResolution(conflictId: string, resolution: ConflictResolution): void {
    this.resolutionHistory.set(conflictId, resolution);
    
    // Persist to storage
    const historyArray = Array.from(this.resolutionHistory.entries());
    localStorage.setItem('conflict_resolution_history', JSON.stringify(historyArray));
  }

  private async updateConflictPatterns(conflict: ConflictData, resolution: ConflictResolution): Promise<void> {
    // Find existing pattern or create new one
    const existingPattern = this.conflictPatterns.find(p => 
      p.type === conflict.type && p.resolution === resolution.strategy
    );

    if (existingPattern) {
      existingPattern.frequency++;
      existingPattern.confidence = (existingPattern.confidence + resolution.confidence) / 2;
      existingPattern.lastSeen = new Date().toISOString();
    } else {
      this.conflictPatterns.push({
        id: `pattern_${conflict.type}_${resolution.strategy}_${Date.now()}`,
        type: conflict.type,
        frequency: 1,
        resolution: resolution.strategy,
        confidence: resolution.confidence,
        lastSeen: new Date().toISOString()
      });
    }

    // Persist patterns
    localStorage.setItem('conflict_patterns', JSON.stringify(this.conflictPatterns));
  }

  private loadResolutionHistory(): void {
    const stored = localStorage.getItem('conflict_resolution_history');
    if (stored) {
      try {
        const historyArray = JSON.parse(stored);
        this.resolutionHistory = new Map(historyArray);
      } catch (error) {
        console.warn('Failed to load resolution history:', error);
      }
    }
  }

  private loadConflictPatterns(): void {
    const stored = localStorage.getItem('conflict_patterns');
    if (stored) {
      try {
        this.conflictPatterns = JSON.parse(stored);
      } catch (error) {
        console.warn('Failed to load conflict patterns:', error);
      }
    }
  }

  private loadUserPreferences(): void {
    const stored = localStorage.getItem('conflict_user_preferences');
    if (stored) {
      try {
        const preferencesArray = JSON.parse(stored);
        this.userPreferences = new Map(preferencesArray);
      } catch (error) {
        console.warn('Failed to load user preferences:', error);
      }
    }
  }

  // Public API methods
  public setUserPreference(type: ConflictType, strategy: ConflictResolutionStrategy): void {
    this.userPreferences.set(type, strategy);
    
    // Persist preferences
    const preferencesArray = Array.from(this.userPreferences.entries());
    localStorage.setItem('conflict_user_preferences', JSON.stringify(preferencesArray));
  }

  public getUserPreferences(): Map<ConflictType, ConflictResolutionStrategy> {
    return new Map(this.userPreferences);
  }

  public getConflictPatterns(): ConflictPattern[] {
    return [...this.conflictPatterns];
  }

  public getResolutionHistory(): Map<string, ConflictResolution> {
    return new Map(this.resolutionHistory);
  }

  public clearHistory(): void {
    this.resolutionHistory.clear();
    this.conflictPatterns = [];
    
    localStorage.removeItem('conflict_resolution_history');
    localStorage.removeItem('conflict_patterns');
  }
}

interface RiskAssessment {
  level: 'low' | 'medium' | 'high';
  score: number;
  factors: string[];
  recommendations: string[];
}

export const conflictResolutionService = new ConflictResolutionService();