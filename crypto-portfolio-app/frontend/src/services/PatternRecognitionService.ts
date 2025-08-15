import {
  TransactionPattern,
  PatternType,
  PatternFrequency,
  PatternFeature,
  PatternExample,
  CategorizedTransaction,
  CategorySuggestion,
  CategorizationMethod,
  MLModel,
  TransactionCategory
} from '../types/categorization.types';

export class PatternRecognitionService {
  private patterns: Map<string, TransactionPattern> = new Map();
  private transactionHistory: CategorizedTransaction[] = [];
  private featureExtractors: Map<string, FeatureExtractor> = new Map();
  private patternCache = new Map<string, TransactionPattern[]>();
  private learningEnabled = true;
  private minPatternConfidence = 0.6;
  private minPatternFrequency = 3;

  constructor() {
    this.initializeFeatureExtractors();
    this.loadPatterns();
    this.loadTransactionHistory();
  }

  /**
   * Initialize feature extractors for different pattern types
   */
  private initializeFeatureExtractors(): void {
    this.featureExtractors.set('amount', new AmountFeatureExtractor());
    this.featureExtractors.set('timing', new TimingFeatureExtractor());
    this.featureExtractors.set('asset', new AssetFeatureExtractor());
    this.featureExtractors.set('exchange', new ExchangeFeatureExtractor());
    this.featureExtractors.set('textual', new TextualFeatureExtractor());
    this.featureExtractors.set('behavioral', new BehavioralFeatureExtractor());
  }

  /**
   * Load stored patterns from localStorage
   */
  private loadPatterns(): void {
    try {
      const stored = localStorage.getItem('transaction_patterns');
      if (stored) {
        const patternsData = JSON.parse(stored);
        patternsData.forEach((pattern: TransactionPattern) => {
          this.patterns.set(pattern.id, pattern);
        });
      }
    } catch (error) {
      console.error('Failed to load patterns:', error);
    }
  }

  /**
   * Load transaction history for pattern analysis
   */
  private loadTransactionHistory(): void {
    try {
      const stored = localStorage.getItem('categorized_transactions');
      if (stored) {
        this.transactionHistory = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load transaction history:', error);
    }
  }

  /**
   * Save patterns to localStorage
   */
  private savePatterns(): void {
    try {
      localStorage.setItem('transaction_patterns', JSON.stringify(Array.from(this.patterns.values())));
    } catch (error) {
      console.error('Failed to save patterns:', error);
    }
  }

  /**
   * Detect patterns in transactions
   */
  async detectPatterns(transactions: CategorizedTransaction[]): Promise<TransactionPattern[]> {
    const detectedPatterns: TransactionPattern[] = [];

    try {
      // Detect different types of patterns
      const recurringPatterns = await this.detectRecurringTransactions(transactions);
      const amountPatterns = await this.detectAmountPatterns(transactions);
      const timingPatterns = await this.detectTimingPatterns(transactions);
      const exchangePatterns = await this.detectExchangePatterns(transactions);
      const assetPatterns = await this.detectAssetCorrelations(transactions);
      const behavioralPatterns = await this.detectBehavioralPatterns(transactions);

      detectedPatterns.push(
        ...recurringPatterns,
        ...amountPatterns,
        ...timingPatterns,
        ...exchangePatterns,
        ...assetPatterns,
        ...behavioralPatterns
      );

      // Filter patterns by confidence and frequency
      const validPatterns = detectedPatterns.filter(pattern => 
        pattern.confidence >= this.minPatternConfidence && 
        pattern.examples.length >= this.minPatternFrequency
      );

      // Store new patterns
      validPatterns.forEach(pattern => {
        const existingPattern = this.findSimilarPattern(pattern);
        if (existingPattern) {
          this.mergePatterns(existingPattern, pattern);
        } else {
          this.patterns.set(pattern.id, pattern);
        }
      });

      this.savePatterns();
      return validPatterns;
    } catch (error) {
      console.error('Pattern detection failed:', error);
      return [];
    }
  }

  /**
   * Detect recurring transactions
   */
  private async detectRecurringTransactions(transactions: CategorizedTransaction[]): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const groupedTransactions = this.groupTransactionsByFeatures(transactions, ['asset', 'type', 'amount']);

    for (const [key, group] of groupedTransactions) {
      if (group.length < this.minPatternFrequency) continue;

      // Check for time-based recurrence
      const timeIntervals = this.calculateTimeIntervals(group);
      const averageInterval = this.calculateAverageInterval(timeIntervals);
      const intervalVariance = this.calculateIntervalVariance(timeIntervals, averageInterval);

      if (intervalVariance < 0.3) { // Low variance indicates regularity
        const frequency = this.determineFrequency(averageInterval);
        const confidence = this.calculateRecurrenceConfidence(group, timeIntervals, intervalVariance);

        const pattern: TransactionPattern = {
          id: `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `Recurring ${group[0].type} - ${group[0].asset}`,
          description: `Regular ${group[0].type} transactions for ${group[0].asset}`,
          type: 'recurring_transaction',
          confidence,
          frequency,
          features: [
            { name: 'asset', type: 'categorical', value: group[0].asset, weight: 0.8 },
            { name: 'type', type: 'categorical', value: group[0].type, weight: 0.7 },
            { name: 'amount', type: 'numerical', value: group[0].amount, weight: 0.6 },
            { name: 'interval', type: 'numerical', value: averageInterval, weight: 0.9 }
          ],
          examples: group.slice(0, 5).map(tx => ({
            transactionId: tx.id,
            matchScore: confidence,
            features: this.extractTransactionFeatures(tx),
            timestamp: tx.timestamp
          })),
          suggestedCategory: group[0].categoryId,
          suggestedTags: group[0].tagIds,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isActive: true,
          usage: {
            matches: group.length,
            accuracy: confidence,
            lastMatched: group[group.length - 1].timestamp
          }
        };

        patterns.push(pattern);
      }
    }

    return patterns;
  }

  /**
   * Detect amount patterns
   */
  private async detectAmountPatterns(transactions: CategorizedTransaction[]): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const amountExtractor = this.featureExtractors.get('amount')!;

    // Group transactions by rounded amounts
    const amountGroups = new Map<string, CategorizedTransaction[]>();
    
    transactions.forEach(tx => {
      if (tx.amount) {
        const roundedAmount = Math.round(tx.amount * 100) / 100; // Round to cents
        const key = `${roundedAmount}_${tx.type}`;
        if (!amountGroups.has(key)) {
          amountGroups.set(key, []);
        }
        amountGroups.get(key)!.push(tx);
      }
    });

    for (const [key, group] of amountGroups) {
      if (group.length < this.minPatternFrequency) continue;

      const features = amountExtractor.extract(group[0]);
      const confidence = Math.min(0.9, 0.5 + (group.length * 0.1));

      const pattern: TransactionPattern = {
        id: `amount_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Fixed Amount - ${group[0].amount} ${group[0].asset}`,
        description: `Transactions with consistent amount of ${group[0].amount}`,
        type: 'amount_pattern',
        confidence,
        frequency: 'irregular',
        features,
        examples: group.slice(0, 3).map(tx => ({
          transactionId: tx.id,
          matchScore: confidence,
          features: this.extractTransactionFeatures(tx),
          timestamp: tx.timestamp
        })),
        suggestedCategory: group[0].categoryId,
        suggestedTags: group[0].tagIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        usage: {
          matches: group.length,
          accuracy: confidence,
          lastMatched: group[group.length - 1].timestamp
        }
      };

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Detect timing patterns
   */
  private async detectTimingPatterns(transactions: CategorizedTransaction[]): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const timingExtractor = this.featureExtractors.get('timing')!;

    // Group by day of week and hour
    const timingGroups = new Map<string, CategorizedTransaction[]>();

    transactions.forEach(tx => {
      const date = new Date(tx.timestamp);
      const dayOfWeek = date.getDay();
      const hourOfDay = date.getHours();
      
      // Group by day of week
      const dayKey = `day_${dayOfWeek}_${tx.type}`;
      if (!timingGroups.has(dayKey)) {
        timingGroups.set(dayKey, []);
      }
      timingGroups.get(dayKey)!.push(tx);

      // Group by hour ranges
      const hourRange = Math.floor(hourOfDay / 4) * 4; // 4-hour blocks
      const hourKey = `hour_${hourRange}_${tx.type}`;
      if (!timingGroups.has(hourKey)) {
        timingGroups.set(hourKey, []);
      }
      timingGroups.get(hourKey)!.push(tx);
    });

    for (const [key, group] of timingGroups) {
      if (group.length < this.minPatternFrequency) continue;

      const features = timingExtractor.extract(group[0]);
      const confidence = Math.min(0.8, 0.4 + (group.length * 0.08));

      const isDay = key.startsWith('day_');
      const value = key.split('_')[1];
      
      const pattern: TransactionPattern = {
        id: `timing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: isDay ? `${this.getDayName(parseInt(value))} Transactions` : `${value}:00 Hour Transactions`,
        description: isDay ? 
          `Transactions commonly occur on ${this.getDayName(parseInt(value))}` :
          `Transactions commonly occur around ${value}:00`,
        type: 'timing_pattern',
        confidence,
        frequency: isDay ? 'weekly' : 'daily',
        features,
        examples: group.slice(0, 3).map(tx => ({
          transactionId: tx.id,
          matchScore: confidence,
          features: this.extractTransactionFeatures(tx),
          timestamp: tx.timestamp
        })),
        suggestedCategory: group[0].categoryId,
        suggestedTags: group[0].tagIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        usage: {
          matches: group.length,
          accuracy: confidence,
          lastMatched: group[group.length - 1].timestamp
        }
      };

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Detect exchange patterns
   */
  private async detectExchangePatterns(transactions: CategorizedTransaction[]): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const exchangeExtractor = this.featureExtractors.get('exchange')!;

    // Group by exchange and transaction type
    const exchangeGroups = new Map<string, CategorizedTransaction[]>();

    transactions.forEach(tx => {
      if (tx.exchangeId) {
        const key = `${tx.exchangeId}_${tx.type}`;
        if (!exchangeGroups.has(key)) {
          exchangeGroups.set(key, []);
        }
        exchangeGroups.get(key)!.push(tx);
      }
    });

    for (const [key, group] of exchangeGroups) {
      if (group.length < this.minPatternFrequency) continue;

      const features = exchangeExtractor.extract(group[0]);
      const confidence = Math.min(0.85, 0.6 + (group.length * 0.05));

      const [exchangeId, type] = key.split('_');

      const pattern: TransactionPattern = {
        id: `exchange_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${exchangeId} ${type} Pattern`,
        description: `${type} transactions frequently occur on ${exchangeId}`,
        type: 'exchange_pattern',
        confidence,
        frequency: 'irregular',
        features,
        examples: group.slice(0, 3).map(tx => ({
          transactionId: tx.id,
          matchScore: confidence,
          features: this.extractTransactionFeatures(tx),
          timestamp: tx.timestamp
        })),
        suggestedCategory: group[0].categoryId,
        suggestedTags: group[0].tagIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        usage: {
          matches: group.length,
          accuracy: confidence,
          lastMatched: group[group.length - 1].timestamp
        }
      };

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Detect asset correlations
   */
  private async detectAssetCorrelations(transactions: CategorizedTransaction[]): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const assetExtractor = this.featureExtractors.get('asset')!;

    // Find transactions that occur close in time with different assets
    const timeWindow = 60 * 60 * 1000; // 1 hour window
    const correlations = new Map<string, CategorizedTransaction[]>();

    for (let i = 0; i < transactions.length; i++) {
      for (let j = i + 1; j < transactions.length; j++) {
        const tx1 = transactions[i];
        const tx2 = transactions[j];
        
        const timeDiff = Math.abs(new Date(tx1.timestamp).getTime() - new Date(tx2.timestamp).getTime());
        
        if (timeDiff <= timeWindow && tx1.asset !== tx2.asset) {
          const key = [tx1.asset, tx2.asset].sort().join('_');
          if (!correlations.has(key)) {
            correlations.set(key, []);
          }
          correlations.get(key)!.push(tx1, tx2);
        }
      }
    }

    for (const [key, group] of correlations) {
      if (group.length < this.minPatternFrequency * 2) continue;

      const features = assetExtractor.extract(group[0]);
      const confidence = Math.min(0.75, 0.5 + (group.length * 0.03));

      const [asset1, asset2] = key.split('_');

      const pattern: TransactionPattern = {
        id: `correlation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `${asset1}-${asset2} Correlation`,
        description: `${asset1} and ${asset2} transactions often occur together`,
        type: 'asset_correlation',
        confidence,
        frequency: 'irregular',
        features,
        examples: group.slice(0, 4).map(tx => ({
          transactionId: tx.id,
          matchScore: confidence,
          features: this.extractTransactionFeatures(tx),
          timestamp: tx.timestamp
        })),
        suggestedCategory: group[0].categoryId,
        suggestedTags: group[0].tagIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        usage: {
          matches: group.length,
          accuracy: confidence,
          lastMatched: group[group.length - 1].timestamp
        }
      };

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Detect behavioral patterns
   */
  private async detectBehavioralPatterns(transactions: CategorizedTransaction[]): Promise<TransactionPattern[]> {
    const patterns: TransactionPattern[] = [];
    const behavioralExtractor = this.featureExtractors.get('behavioral')!;

    // Detect patterns in transaction sequences
    const sequences = this.findTransactionSequences(transactions);
    
    for (const sequence of sequences) {
      if (sequence.length < 3) continue;

      const features = behavioralExtractor.extract(sequence[0]);
      const confidence = Math.min(0.8, 0.6 + (sequence.length * 0.05));

      const pattern: TransactionPattern = {
        id: `behavioral_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Trading Sequence Pattern`,
        description: `Sequence of related trading actions`,
        type: 'behavioral_pattern',
        confidence,
        frequency: 'irregular',
        features,
        examples: sequence.slice(0, 3).map(tx => ({
          transactionId: tx.id,
          matchScore: confidence,
          features: this.extractTransactionFeatures(tx),
          timestamp: tx.timestamp
        })),
        suggestedCategory: sequence[0].categoryId,
        suggestedTags: sequence[0].tagIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        usage: {
          matches: sequence.length,
          accuracy: confidence,
          lastMatched: sequence[sequence.length - 1].timestamp
        }
      };

      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Find matching patterns for a transaction
   */
  async findMatchingPatterns(transaction: CategorizedTransaction): Promise<CategorySuggestion[]> {
    const suggestions: CategorySuggestion[] = [];
    const transactionFeatures = this.extractTransactionFeatures(transaction);

    for (const pattern of this.patterns.values()) {
      if (!pattern.isActive) continue;

      const matchScore = this.calculatePatternMatch(transactionFeatures, pattern);
      
      if (matchScore >= this.minPatternConfidence) {
        suggestions.push({
          categoryId: pattern.suggestedCategory || '',
          categoryName: pattern.name,
          confidence: matchScore,
          reasoning: `Matches pattern: ${pattern.name}`,
          method: 'pattern_recognition',
          tags: pattern.suggestedTags.map(tagId => ({
            tagId,
            tagName: tagId,
            confidence: matchScore * 0.9,
            reasoning: 'Pattern-based tag suggestion'
          }))
        });

        // Update pattern usage
        pattern.usage.matches++;
        pattern.usage.lastMatched = transaction.timestamp;
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Learn from user categorization feedback
   */
  async learnFromFeedback(
    transaction: CategorizedTransaction,
    acceptedCategoryId: string,
    rejectedSuggestions: CategorySuggestion[]
  ): Promise<void> {
    if (!this.learningEnabled) return;

    try {
      // Update pattern accuracies based on feedback
      rejectedSuggestions.forEach(suggestion => {
        if (suggestion.method === 'pattern_recognition') {
          this.updatePatternAccuracy(suggestion.categoryName, false);
        }
      });

      // Look for new patterns based on accepted categorization
      await this.identifyNewPatterns(transaction, acceptedCategoryId);
      
      this.savePatterns();
    } catch (error) {
      console.error('Failed to learn from feedback:', error);
    }
  }

  /**
   * Get all detected patterns
   */
  getPatterns(): TransactionPattern[] {
    return Array.from(this.patterns.values()).filter(pattern => pattern.isActive);
  }

  /**
   * Update pattern based on new data
   */
  async updatePattern(patternId: string, newExamples: CategorizedTransaction[]): Promise<void> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    // Add new examples
    const newPatternExamples = newExamples.map(tx => ({
      transactionId: tx.id,
      matchScore: this.calculatePatternMatch(this.extractTransactionFeatures(tx), pattern),
      features: this.extractTransactionFeatures(tx),
      timestamp: tx.timestamp
    }));

    pattern.examples.push(...newPatternExamples);
    pattern.examples = pattern.examples.slice(-10); // Keep last 10 examples

    // Update pattern statistics
    pattern.usage.matches += newExamples.length;
    pattern.usage.lastMatched = newExamples[newExamples.length - 1]?.timestamp;
    pattern.updatedAt = new Date().toISOString();

    this.savePatterns();
  }

  /**
   * Helper methods
   */
  private groupTransactionsByFeatures(
    transactions: CategorizedTransaction[],
    features: string[]
  ): Map<string, CategorizedTransaction[]> {
    const groups = new Map<string, CategorizedTransaction[]>();

    transactions.forEach(tx => {
      const key = features.map(feature => {
        switch (feature) {
          case 'asset': return tx.asset;
          case 'type': return tx.type;
          case 'amount': return Math.round((tx.amount || 0) * 100) / 100;
          case 'exchange': return tx.exchangeId;
          default: return 'unknown';
        }
      }).join('_');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(tx);
    });

    return groups;
  }

  private calculateTimeIntervals(transactions: CategorizedTransaction[]): number[] {
    if (transactions.length < 2) return [];

    const sortedTxs = transactions.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const intervals: number[] = [];
    for (let i = 1; i < sortedTxs.length; i++) {
      const interval = new Date(sortedTxs[i].timestamp).getTime() - new Date(sortedTxs[i-1].timestamp).getTime();
      intervals.push(interval);
    }

    return intervals;
  }

  private calculateAverageInterval(intervals: number[]): number {
    if (intervals.length === 0) return 0;
    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  }

  private calculateIntervalVariance(intervals: number[], average: number): number {
    if (intervals.length === 0) return 1;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - average, 2), 0) / intervals.length;
    return Math.sqrt(variance) / average; // Coefficient of variation
  }

  private determineFrequency(intervalMs: number): PatternFrequency {
    const days = intervalMs / (24 * 60 * 60 * 1000);
    
    if (days <= 1.5) return 'daily';
    if (days <= 8) return 'weekly';
    if (days <= 35) return 'monthly';
    if (days <= 100) return 'quarterly';
    if (days <= 400) return 'yearly';
    return 'irregular';
  }

  private calculateRecurrenceConfidence(
    transactions: CategorizedTransaction[],
    intervals: number[],
    variance: number
  ): number {
    let confidence = 0.5;

    // More transactions = higher confidence
    confidence += Math.min(0.3, transactions.length * 0.05);

    // Lower variance = higher confidence
    confidence += Math.max(0, 0.2 - variance);

    // Consistent amounts = higher confidence
    const amounts = transactions.map(tx => tx.amount || 0);
    const amountVariance = this.calculateVarianceForNumbers(amounts);
    confidence += Math.max(0, 0.1 - amountVariance);

    return Math.min(0.95, confidence);
  }

  private calculateVarianceForNumbers(numbers: number[]): number {
    if (numbers.length === 0) return 1;
    const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
    return mean === 0 ? 1 : Math.sqrt(variance) / mean;
  }

  private extractTransactionFeatures(transaction: CategorizedTransaction): { [key: string]: any } {
    const date = new Date(transaction.timestamp);
    
    return {
      asset: transaction.asset,
      type: transaction.type,
      amount: transaction.amount,
      price: transaction.price,
      total: transaction.total,
      fees: transaction.fees,
      exchange: transaction.exchangeId,
      dayOfWeek: date.getDay(),
      hourOfDay: date.getHours(),
      dayOfMonth: date.getDate(),
      month: date.getMonth(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    };
  }

  private calculatePatternMatch(transactionFeatures: any, pattern: TransactionPattern): number {
    let totalWeight = 0;
    let matchScore = 0;

    pattern.features.forEach(feature => {
      totalWeight += feature.weight;
      
      const transactionValue = transactionFeatures[feature.name];
      const patternValue = feature.value;

      let featureMatch = 0;
      
      switch (feature.type) {
        case 'categorical':
          featureMatch = transactionValue === patternValue ? 1 : 0;
          break;
        case 'numerical':
          const diff = Math.abs(transactionValue - patternValue);
          const tolerance = Math.max(patternValue * 0.1, 1); // 10% tolerance or minimum 1
          featureMatch = Math.max(0, 1 - (diff / tolerance));
          break;
        case 'temporal':
          // For time-based features, check if values are within reasonable range
          featureMatch = Math.abs(transactionValue - patternValue) <= 2 ? 1 : 0;
          break;
        default:
          featureMatch = 0.5; // Default partial match
      }

      matchScore += featureMatch * feature.weight;
    });

    return totalWeight > 0 ? matchScore / totalWeight : 0;
  }

  private findSimilarPattern(newPattern: TransactionPattern): TransactionPattern | null {
    for (const existingPattern of this.patterns.values()) {
      if (existingPattern.type === newPattern.type) {
        const similarity = this.calculatePatternSimilarity(existingPattern, newPattern);
        if (similarity > 0.8) {
          return existingPattern;
        }
      }
    }
    return null;
  }

  private calculatePatternSimilarity(pattern1: TransactionPattern, pattern2: TransactionPattern): number {
    // Simple similarity based on shared features
    const features1 = new Set(pattern1.features.map(f => f.name));
    const features2 = new Set(pattern2.features.map(f => f.name));
    
    const intersection = new Set([...features1].filter(x => features2.has(x)));
    const union = new Set([...features1, ...features2]);
    
    return intersection.size / union.size;
  }

  private mergePatterns(existingPattern: TransactionPattern, newPattern: TransactionPattern): void {
    // Merge examples
    existingPattern.examples.push(...newPattern.examples);
    existingPattern.examples = existingPattern.examples.slice(-15); // Keep last 15

    // Update confidence (weighted average)
    const totalMatches = existingPattern.usage.matches + newPattern.usage.matches;
    existingPattern.confidence = (
      (existingPattern.confidence * existingPattern.usage.matches) +
      (newPattern.confidence * newPattern.usage.matches)
    ) / totalMatches;

    // Update usage
    existingPattern.usage.matches = totalMatches;
    existingPattern.usage.lastMatched = newPattern.usage.lastMatched;
    existingPattern.updatedAt = new Date().toISOString();
  }

  private updatePatternAccuracy(patternName: string, wasCorrect: boolean): void {
    for (const pattern of this.patterns.values()) {
      if (pattern.name === patternName) {
        const currentAccuracy = pattern.usage.accuracy * pattern.usage.matches;
        const newAccuracy = wasCorrect ? currentAccuracy + 1 : currentAccuracy;
        pattern.usage.accuracy = newAccuracy / (pattern.usage.matches + 1);
        break;
      }
    }
  }

  private async identifyNewPatterns(transaction: CategorizedTransaction, categoryId: string): Promise<void> {
    // Look for similar historical transactions with the same category
    const similarTransactions = this.transactionHistory.filter(tx => 
      tx.categoryId === categoryId && 
      this.calculateTransactionSimilarity(transaction, tx) > 0.7
    );

    if (similarTransactions.length >= this.minPatternFrequency) {
      // Create a new pattern
      const features = this.extractTransactionFeatures(transaction);
      const confidence = Math.min(0.8, 0.6 + (similarTransactions.length * 0.05));

      const pattern: TransactionPattern = {
        id: `learned_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `Learned Pattern - ${transaction.asset} ${transaction.type}`,
        description: `Pattern learned from user categorization`,
        type: 'behavioral_pattern',
        confidence,
        frequency: 'irregular',
        features: Object.entries(features).map(([name, value]) => ({
          name,
          type: typeof value === 'number' ? 'numerical' : 'categorical',
          value,
          weight: 0.6
        })),
        examples: [transaction, ...similarTransactions.slice(0, 4)].map(tx => ({
          transactionId: tx.id,
          matchScore: confidence,
          features: this.extractTransactionFeatures(tx),
          timestamp: tx.timestamp
        })),
        suggestedCategory: categoryId,
        suggestedTags: transaction.tagIds,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        usage: {
          matches: similarTransactions.length + 1,
          accuracy: confidence,
          lastMatched: transaction.timestamp
        }
      };

      this.patterns.set(pattern.id, pattern);
    }
  }

  private calculateTransactionSimilarity(tx1: CategorizedTransaction, tx2: CategorizedTransaction): number {
    let score = 0;
    let factors = 0;

    // Asset match
    if (tx1.asset === tx2.asset) score += 0.3;
    factors++;

    // Type match
    if (tx1.type === tx2.type) score += 0.3;
    factors++;

    // Amount similarity
    if (tx1.amount && tx2.amount) {
      const amountDiff = Math.abs(tx1.amount - tx2.amount) / Math.max(tx1.amount, tx2.amount);
      score += Math.max(0, 0.2 - amountDiff);
    }
    factors++;

    // Exchange match
    if (tx1.exchangeId === tx2.exchangeId) score += 0.2;
    factors++;

    return score / factors;
  }

  private findTransactionSequences(transactions: CategorizedTransaction[]): CategorizedTransaction[][] {
    const sequences: CategorizedTransaction[][] = [];
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours

    const sortedTxs = transactions.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let currentSequence: CategorizedTransaction[] = [];
    
    for (const tx of sortedTxs) {
      if (currentSequence.length === 0) {
        currentSequence.push(tx);
      } else {
        const lastTx = currentSequence[currentSequence.length - 1];
        const timeDiff = new Date(tx.timestamp).getTime() - new Date(lastTx.timestamp).getTime();
        
        if (timeDiff <= timeWindow && this.areTransactionsRelated(lastTx, tx)) {
          currentSequence.push(tx);
        } else {
          if (currentSequence.length >= 3) {
            sequences.push([...currentSequence]);
          }
          currentSequence = [tx];
        }
      }
    }

    if (currentSequence.length >= 3) {
      sequences.push(currentSequence);
    }

    return sequences;
  }

  private areTransactionsRelated(tx1: CategorizedTransaction, tx2: CategorizedTransaction): boolean {
    // Check if transactions are part of a trading sequence
    return (
      (tx1.type === 'buy' && tx2.type === 'sell') ||
      (tx1.type === 'sell' && tx2.type === 'buy') ||
      (tx1.asset === tx2.asset) ||
      (tx1.exchangeId === tx2.exchangeId)
    );
  }

  private getDayName(dayIndex: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayIndex] || 'Unknown';
  }
}

// Feature extractor interfaces and implementations
interface FeatureExtractor {
  extract(transaction: CategorizedTransaction): PatternFeature[];
}

class AmountFeatureExtractor implements FeatureExtractor {
  extract(transaction: CategorizedTransaction): PatternFeature[] {
    return [
      {
        name: 'amount',
        type: 'numerical',
        value: transaction.amount || 0,
        weight: 0.8,
        description: 'Transaction amount'
      },
      {
        name: 'amount_range',
        type: 'categorical',
        value: this.getAmountRange(transaction.amount || 0),
        weight: 0.6,
        description: 'Amount range category'
      }
    ];
  }

  private getAmountRange(amount: number): string {
    if (amount < 10) return 'micro';
    if (amount < 100) return 'small';
    if (amount < 1000) return 'medium';
    if (amount < 10000) return 'large';
    return 'huge';
  }
}

class TimingFeatureExtractor implements FeatureExtractor {
  extract(transaction: CategorizedTransaction): PatternFeature[] {
    const date = new Date(transaction.timestamp);
    
    return [
      {
        name: 'day_of_week',
        type: 'categorical',
        value: date.getDay(),
        weight: 0.7,
        description: 'Day of week (0-6)'
      },
      {
        name: 'hour_of_day',
        type: 'numerical',
        value: date.getHours(),
        weight: 0.6,
        description: 'Hour of day (0-23)'
      },
      {
        name: 'is_weekend',
        type: 'categorical',
        value: date.getDay() === 0 || date.getDay() === 6,
        weight: 0.5,
        description: 'Weekend indicator'
      }
    ];
  }
}

class AssetFeatureExtractor implements FeatureExtractor {
  extract(transaction: CategorizedTransaction): PatternFeature[] {
    return [
      {
        name: 'asset',
        type: 'categorical',
        value: transaction.asset,
        weight: 0.9,
        description: 'Cryptocurrency asset'
      },
      {
        name: 'asset_type',
        type: 'categorical',
        value: this.getAssetType(transaction.asset),
        weight: 0.6,
        description: 'Asset category'
      }
    ];
  }

  private getAssetType(asset: string): string {
    const majors = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'MATIC'];
    if (majors.includes(asset)) return 'major';
    return 'altcoin';
  }
}

class ExchangeFeatureExtractor implements FeatureExtractor {
  extract(transaction: CategorizedTransaction): PatternFeature[] {
    return [
      {
        name: 'exchange',
        type: 'categorical',
        value: transaction.exchangeId || 'unknown',
        weight: 0.8,
        description: 'Exchange platform'
      }
    ];
  }
}

class TextualFeatureExtractor implements FeatureExtractor {
  extract(transaction: CategorizedTransaction): PatternFeature[] {
    const notes = transaction.userNotes || '';
    
    return [
      {
        name: 'has_notes',
        type: 'categorical',
        value: notes.length > 0,
        weight: 0.4,
        description: 'Has user notes'
      },
      {
        name: 'notes_length',
        type: 'numerical',
        value: notes.length,
        weight: 0.3,
        description: 'Length of notes'
      }
    ];
  }
}

class BehavioralFeatureExtractor implements FeatureExtractor {
  extract(transaction: CategorizedTransaction): PatternFeature[] {
    return [
      {
        name: 'transaction_type',
        type: 'categorical',
        value: transaction.type,
        weight: 0.9,
        description: 'Type of transaction'
      },
      {
        name: 'has_fees',
        type: 'categorical',
        value: (transaction.fees || 0) > 0,
        weight: 0.5,
        description: 'Has transaction fees'
      }
    ];
  }
}

export const patternRecognitionService = new PatternRecognitionService();