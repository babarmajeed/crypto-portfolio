import {
  TransactionCategory,
  TransactionTag,
  CategoryRule,
  CategorizationResult,
  CategorySuggestion,
  BulkCategorizationRequest,
  BulkCategorizationResult,
  CategorizedTransaction,
  CategorizationMethod,
  ConditionField,
  ConditionOperator,
  TaxType,
  RuleCondition,
  RuleAction,
  DEFAULT_CATEGORIES,
  DEFAULT_TAGS,
  CategorizationSettings,
  UserCategorizationAction
} from '../types/categorization.types';

export class CategorizationService {
  private categories: Map<string, TransactionCategory> = new Map();
  private tags: Map<string, TransactionTag> = new Map();
  private rules: Map<string, CategoryRule> = new Map();
  private settings: CategorizationSettings;
  private cache = new Map<string, CategorizationResult>();
  
  constructor() {
    this.settings = this.getDefaultSettings();
    this.initializeDefaults();
    this.loadData();
  }

  /**
   * Initialize default categories and tags
   */
  private initializeDefaults(): void {
    // Initialize default categories
    DEFAULT_CATEGORIES.forEach((categoryData, index) => {
      const category: TransactionCategory = {
        ...categoryData,
        id: `default_category_${index + 1}`,
        rules: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usage: {
          totalTransactions: 0,
          totalAmount: 0,
          frequency: 0,
          averageAmount: 0,
          monthlyUsage: {}
        }
      };
      this.categories.set(category.id, category);
    });

    // Initialize default tags
    DEFAULT_TAGS.forEach((tagData, index) => {
      const tag: TransactionTag = {
        ...tagData,
        id: `default_tag_${index + 1}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usage: {
          totalTransactions: 0,
          frequency: 0,
          coUsedTags: {}
        }
      };
      this.tags.set(tag.id, tag);
    });
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): CategorizationSettings {
    return {
      autoCategorizationEnabled: true,
      minConfidenceThreshold: 0.7,
      requireManualReview: false,
      enablePatternLearning: true,
      enableMLClassification: true,
      mlModelType: 'random_forest',
      retrainInterval: 30,
      maxSuggestions: 5,
      enableTaxOptimization: true,
      taxReportingStandard: 'us',
      backupEnabled: true,
      backupFrequency: 'weekly',
      dataRetentionDays: 365,
      debugMode: false
    };
  }

  /**
   * Load data from storage
   */
  private loadData(): void {
    try {
      // Load categories
      const storedCategories = localStorage.getItem('categorization_categories');
      if (storedCategories) {
        const categoriesData = JSON.parse(storedCategories);
        categoriesData.forEach((category: TransactionCategory) => {
          this.categories.set(category.id, category);
        });
      }

      // Load tags
      const storedTags = localStorage.getItem('categorization_tags');
      if (storedTags) {
        const tagsData = JSON.parse(storedTags);
        tagsData.forEach((tag: TransactionTag) => {
          this.tags.set(tag.id, tag);
        });
      }

      // Load rules
      const storedRules = localStorage.getItem('categorization_rules');
      if (storedRules) {
        const rulesData = JSON.parse(storedRules);
        rulesData.forEach((rule: CategoryRule) => {
          this.rules.set(rule.id, rule);
        });
      }

      // Load settings
      const storedSettings = localStorage.getItem('categorization_settings');
      if (storedSettings) {
        this.settings = { ...this.settings, ...JSON.parse(storedSettings) };
      }
    } catch (error) {
      console.error('Failed to load categorization data:', error);
    }
  }

  /**
   * Save data to storage
   */
  private saveData(): void {
    try {
      localStorage.setItem('categorization_categories', JSON.stringify(Array.from(this.categories.values())));
      localStorage.setItem('categorization_tags', JSON.stringify(Array.from(this.tags.values())));
      localStorage.setItem('categorization_rules', JSON.stringify(Array.from(this.rules.values())));
      localStorage.setItem('categorization_settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save categorization data:', error);
    }
  }

  /**
   * Get all categories
   */
  getCategories(): TransactionCategory[] {
    return Array.from(this.categories.values()).filter(cat => cat.isActive);
  }

  /**
   * Get category by ID
   */
  getCategory(id: string): TransactionCategory | undefined {
    return this.categories.get(id);
  }

  /**
   * Create new category
   */
  async createCategory(categoryData: Omit<TransactionCategory, 'id' | 'createdAt' | 'updatedAt' | 'usage'>): Promise<TransactionCategory> {
    const id = `category_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const category: TransactionCategory = {
      ...categoryData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usage: {
        totalTransactions: 0,
        totalAmount: 0,
        frequency: 0,
        averageAmount: 0,
        monthlyUsage: {}
      }
    };

    this.categories.set(id, category);
    this.saveData();
    
    return category;
  }

  /**
   * Update category
   */
  async updateCategory(id: string, updates: Partial<TransactionCategory>): Promise<TransactionCategory> {
    const category = this.categories.get(id);
    if (!category) {
      throw new Error(`Category ${id} not found`);
    }

    const updatedCategory = {
      ...category,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };

    this.categories.set(id, updatedCategory);
    this.saveData();
    
    return updatedCategory;
  }

  /**
   * Delete category
   */
  async deleteCategory(id: string): Promise<void> {
    const category = this.categories.get(id);
    if (!category) {
      throw new Error(`Category ${id} not found`);
    }

    if (category.isDefault) {
      throw new Error('Cannot delete default category');
    }

    this.categories.delete(id);
    
    // Remove associated rules
    this.rules.forEach((rule, ruleId) => {
      if (rule.categoryId === id) {
        this.rules.delete(ruleId);
      }
    });

    this.saveData();
  }

  /**
   * Get all tags
   */
  getTags(): TransactionTag[] {
    return Array.from(this.tags.values()).filter(tag => tag.isActive);
  }

  /**
   * Create new tag
   */
  async createTag(tagData: Omit<TransactionTag, 'id' | 'createdAt' | 'updatedAt' | 'usage'>): Promise<TransactionTag> {
    const id = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const tag: TransactionTag = {
      ...tagData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usage: {
        totalTransactions: 0,
        frequency: 0,
        coUsedTags: {}
      }
    };

    this.tags.set(id, tag);
    this.saveData();
    
    return tag;
  }

  /**
   * Update tag
   */
  async updateTag(id: string, updates: Partial<TransactionTag>): Promise<TransactionTag> {
    const tag = this.tags.get(id);
    if (!tag) {
      throw new Error(`Tag ${id} not found`);
    }

    const updatedTag = {
      ...tag,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };

    this.tags.set(id, updatedTag);
    this.saveData();
    
    return updatedTag;
  }

  /**
   * Delete tag
   */
  async deleteTag(id: string): Promise<void> {
    const tag = this.tags.get(id);
    if (!tag) {
      throw new Error(`Tag ${id} not found`);
    }

    this.tags.delete(id);
    this.saveData();
  }

  /**
   * Get all rules
   */
  getRules(): CategoryRule[] {
    return Array.from(this.rules.values()).filter(rule => rule.isActive);
  }

  /**
   * Create new rule
   */
  async createRule(ruleData: Omit<CategoryRule, 'id' | 'createdAt' | 'updatedAt' | 'usage'>): Promise<CategoryRule> {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const rule: CategoryRule = {
      ...ruleData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      usage: {
        matches: 0,
        successRate: 0,
        avgConfidence: 0
      }
    };

    this.rules.set(id, rule);
    this.saveData();
    
    return rule;
  }

  /**
   * Update rule
   */
  async updateRule(id: string, updates: Partial<CategoryRule>): Promise<CategoryRule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found`);
    }

    const updatedRule = {
      ...rule,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString()
    };

    this.rules.set(id, updatedRule);
    this.saveData();
    
    return updatedRule;
  }

  /**
   * Delete rule
   */
  async deleteRule(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found`);
    }

    this.rules.delete(id);
    this.saveData();
  }

  /**
   * Get category suggestions for a transaction
   */
  async getCategorySuggestions(transaction: CategorizedTransaction): Promise<CategorySuggestion[]> {
    const cacheKey = `suggestions_${transaction.id}`;
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return cached.suggestions;
    }

    const suggestions: CategorySuggestion[] = [];

    try {
      // Rule-based suggestions (highest priority)
      const ruleSuggestions = await this.getRuleBasedSuggestions(transaction);
      suggestions.push(...ruleSuggestions);

      // Pattern-based suggestions (medium priority)
      const patternSuggestions = await this.getPatternBasedSuggestions(transaction);
      suggestions.push(...patternSuggestions);

      // Default suggestions based on transaction type
      const defaultSuggestions = this.getDefaultSuggestions(transaction);
      suggestions.push(...defaultSuggestions);

      // Sort by confidence and limit results
      const sortedSuggestions = suggestions
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, this.settings.maxSuggestions);

      // Cache results
      const result: CategorizationResult = {
        transactionId: transaction.id,
        suggestions: sortedSuggestions,
        confidence: sortedSuggestions[0]?.confidence || 0,
        method: 'rule_based',
        reasoning: 'Combined rule-based and pattern matching',
        timestamp: new Date().toISOString()
      };
      
      this.cache.set(cacheKey, result);

      return sortedSuggestions;
    } catch (error) {
      console.error('Failed to get category suggestions:', error);
      return [];
    }
  }

  /**
   * Get rule-based suggestions
   */
  private async getRuleBasedSuggestions(transaction: CategorizedTransaction): Promise<CategorySuggestion[]> {
    const suggestions: CategorySuggestion[] = [];
    const activeRules = Array.from(this.rules.values())
      .filter(rule => rule.isActive)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of activeRules) {
      if (this.evaluateRule(rule, transaction)) {
        const category = this.categories.get(rule.categoryId);
        if (category) {
          const confidence = this.calculateRuleConfidence(rule, transaction);
          
          suggestions.push({
            categoryId: rule.categoryId,
            categoryName: category.name,
            confidence,
            reasoning: `Matched rule: ${rule.name}`,
            method: 'rule_based',
            tags: this.getTagSuggestionsFromRule(rule)
          });

          // Update rule usage
          rule.usage.matches++;
          rule.usage.lastMatched = new Date().toISOString();
        }
      }
    }

    return suggestions;
  }

  /**
   * Evaluate if a rule matches a transaction
   */
  private evaluateRule(rule: CategoryRule, transaction: CategorizedTransaction): boolean {
    return rule.conditions.every(condition => this.evaluateCondition(condition, transaction));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: RuleCondition, transaction: CategorizedTransaction): boolean {
    const fieldValue = this.getTransactionFieldValue(condition.field, transaction);
    const conditionValue = condition.value;

    switch (condition.operator) {
      case 'equals':
        return this.compareValues(fieldValue, conditionValue, condition.caseSensitive);
      
      case 'not_equals':
        return !this.compareValues(fieldValue, conditionValue, condition.caseSensitive);
      
      case 'contains':
        return this.containsValue(fieldValue, conditionValue, condition.caseSensitive);
      
      case 'not_contains':
        return !this.containsValue(fieldValue, conditionValue, condition.caseSensitive);
      
      case 'starts_with':
        return this.startsWithValue(fieldValue, conditionValue, condition.caseSensitive);
      
      case 'ends_with':
        return this.endsWithValue(fieldValue, conditionValue, condition.caseSensitive);
      
      case 'greater_than':
        return Number(fieldValue) > Number(conditionValue);
      
      case 'less_than':
        return Number(fieldValue) < Number(conditionValue);
      
      case 'between':
        const [min, max] = Array.isArray(conditionValue) ? conditionValue : [conditionValue, conditionValue];
        const numValue = Number(fieldValue);
        return numValue >= Number(min) && numValue <= Number(max);
      
      case 'in':
        const values = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
        return values.some(val => this.compareValues(fieldValue, val, condition.caseSensitive));
      
      case 'not_in':
        const notValues = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
        return !notValues.some(val => this.compareValues(fieldValue, val, condition.caseSensitive));
      
      case 'regex_match':
        try {
          const regex = new RegExp(conditionValue, condition.caseSensitive ? 'g' : 'gi');
          return regex.test(String(fieldValue));
        } catch {
          return false;
        }
      
      case 'is_empty':
        return !fieldValue || fieldValue === '' || fieldValue === null || fieldValue === undefined;
      
      case 'is_not_empty':
        return fieldValue && fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
      
      default:
        return false;
    }
  }

  /**
   * Get transaction field value
   */
  private getTransactionFieldValue(field: ConditionField, transaction: CategorizedTransaction): any {
    switch (field) {
      case 'asset':
        return transaction.asset;
      case 'type':
        return transaction.type;
      case 'amount':
        return transaction.amount;
      case 'price':
        return transaction.price;
      case 'total':
        return transaction.total;
      case 'fees':
        return transaction.fees;
      case 'exchange':
        return transaction.exchangeId;
      case 'description':
      case 'notes':
        return transaction.userNotes || '';
      case 'timestamp':
        return transaction.timestamp;
      case 'dayOfWeek':
        return new Date(transaction.timestamp).getDay();
      case 'timeOfDay':
        return new Date(transaction.timestamp).getHours();
      case 'source':
        return transaction.exchangeId || 'unknown';
      default:
        return null;
    }
  }

  /**
   * Compare values with optional case sensitivity
   */
  private compareValues(value1: any, value2: any, caseSensitive = true): boolean {
    if (typeof value1 === 'string' && typeof value2 === 'string') {
      return caseSensitive ? value1 === value2 : value1.toLowerCase() === value2.toLowerCase();
    }
    return value1 === value2;
  }

  /**
   * Check if value contains substring
   */
  private containsValue(value: any, substring: any, caseSensitive = true): boolean {
    const strValue = String(value);
    const strSubstring = String(substring);
    return caseSensitive 
      ? strValue.includes(strSubstring)
      : strValue.toLowerCase().includes(strSubstring.toLowerCase());
  }

  /**
   * Check if value starts with substring
   */
  private startsWithValue(value: any, substring: any, caseSensitive = true): boolean {
    const strValue = String(value);
    const strSubstring = String(substring);
    return caseSensitive 
      ? strValue.startsWith(strSubstring)
      : strValue.toLowerCase().startsWith(strSubstring.toLowerCase());
  }

  /**
   * Check if value ends with substring
   */
  private endsWithValue(value: any, substring: any, caseSensitive = true): boolean {
    const strValue = String(value);
    const strSubstring = String(substring);
    return caseSensitive 
      ? strValue.endsWith(strSubstring)
      : strValue.toLowerCase().endsWith(strSubstring.toLowerCase());
  }

  /**
   * Calculate rule confidence based on specificity and history
   */
  private calculateRuleConfidence(rule: CategoryRule, transaction: CategorizedTransaction): number {
    let confidence = 0.8; // Base confidence for rule matches

    // Increase confidence for more specific rules
    const conditionSpecificity = rule.conditions.length * 0.05;
    confidence += Math.min(conditionSpecificity, 0.15);

    // Adjust based on rule success rate
    if (rule.usage.matches > 0) {
      confidence *= Math.min(rule.usage.successRate, 1.0);
    }

    // Adjust based on average confidence
    if (rule.usage.avgConfidence > 0) {
      confidence = (confidence + rule.usage.avgConfidence) / 2;
    }

    return Math.min(confidence, 0.95); // Cap at 95%
  }

  /**
   * Get tag suggestions from rule actions
   */
  private getTagSuggestionsFromRule(rule: CategoryRule): any[] {
    const tagSuggestions: any[] = [];
    
    rule.actions.forEach(action => {
      if (action.type === 'add_tag' && typeof action.value === 'string') {
        const tag = this.tags.get(action.value);
        if (tag) {
          tagSuggestions.push({
            tagId: tag.id,
            tagName: tag.name,
            confidence: action.confidence || 0.8,
            reasoning: `Rule-based tag assignment`
          });
        }
      }
    });

    return tagSuggestions;
  }

  /**
   * Get pattern-based suggestions (simplified implementation)
   */
  private async getPatternBasedSuggestions(transaction: CategorizedTransaction): Promise<CategorySuggestion[]> {
    const suggestions: CategorySuggestion[] = [];
    
    // Simple pattern matching based on transaction type and asset
    const typePatterns = this.getTransactionTypePatterns();
    const pattern = typePatterns[transaction.type];
    
    if (pattern) {
      const category = this.categories.get(pattern.categoryId);
      if (category) {
        suggestions.push({
          categoryId: pattern.categoryId,
          categoryName: category.name,
          confidence: pattern.confidence,
          reasoning: `Pattern match for ${transaction.type} transactions`,
          method: 'pattern_recognition'
        });
      }
    }

    return suggestions;
  }

  /**
   * Get default suggestions based on transaction type
   */
  private getDefaultSuggestions(transaction: CategorizedTransaction): CategorySuggestion[] {
    const suggestions: CategorySuggestion[] = [];
    const defaultMappings = this.getDefaultCategoryMappings();
    
    const mapping = defaultMappings[transaction.type];
    if (mapping) {
      const category = Array.from(this.categories.values()).find(cat => cat.name === mapping.categoryName);
      if (category) {
        suggestions.push({
          categoryId: category.id,
          categoryName: category.name,
          confidence: mapping.confidence,
          reasoning: `Default mapping for ${transaction.type}`,
          method: 'rule_based'
        });
      }
    }

    return suggestions;
  }

  /**
   * Get transaction type patterns
   */
  private getTransactionTypePatterns(): { [type: string]: { categoryId: string; confidence: number } } {
    const tradingCategory = Array.from(this.categories.values()).find(cat => cat.name === 'Trading');
    const transferCategory = Array.from(this.categories.values()).find(cat => cat.name === 'Transfers');
    
    return {
      'buy': { categoryId: tradingCategory?.id || '', confidence: 0.9 },
      'sell': { categoryId: tradingCategory?.id || '', confidence: 0.9 },
      'trade': { categoryId: tradingCategory?.id || '', confidence: 0.9 },
      'transfer': { categoryId: transferCategory?.id || '', confidence: 0.8 },
      'deposit': { categoryId: transferCategory?.id || '', confidence: 0.8 },
      'withdrawal': { categoryId: transferCategory?.id || '', confidence: 0.8 }
    };
  }

  /**
   * Get default category mappings
   */
  private getDefaultCategoryMappings(): { [type: string]: { categoryName: string; confidence: number } } {
    return {
      'buy': { categoryName: 'Trading', confidence: 0.7 },
      'sell': { categoryName: 'Trading', confidence: 0.7 },
      'trade': { categoryName: 'Trading', confidence: 0.7 },
      'deposit': { categoryName: 'Transfers', confidence: 0.6 },
      'withdrawal': { categoryName: 'Transfers', confidence: 0.6 },
      'transfer': { categoryName: 'Transfers', confidence: 0.6 },
      'staking': { categoryName: 'Staking Rewards', confidence: 0.8 },
      'mining': { categoryName: 'Mining', confidence: 0.8 },
      'airdrop': { categoryName: 'Airdrops', confidence: 0.8 }
    };
  }

  /**
   * Bulk categorization
   */
  async bulkCategorize(request: BulkCategorizationRequest): Promise<BulkCategorizationResult> {
    const startTime = Date.now();
    const requestId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let successfulUpdates = 0;
    let failedUpdates = 0;
    let skippedTransactions = 0;
    const errors: any[] = [];

    try {
      for (const transactionId of request.transactionIds) {
        try {
          // Mock transaction processing
          await this.processBulkTransaction(transactionId, request.operation);
          successfulUpdates++;
        } catch (error) {
          failedUpdates++;
          errors.push({
            transactionId,
            error: error instanceof Error ? error.message : 'Unknown error',
            severity: 'error'
          });
        }
      }

      return {
        requestId,
        totalTransactions: request.transactionIds.length,
        successfulUpdates,
        failedUpdates,
        skippedTransactions,
        errors,
        summary: {
          operationType: request.operation.type,
          affectedCategories: request.operation.categoryId ? [request.operation.categoryId] : [],
          affectedTags: request.operation.tagIds || [],
          warnings: []
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Bulk categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process single transaction in bulk operation
   */
  private async processBulkTransaction(transactionId: string, operation: any): Promise<void> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Mock implementation - in real app, would update actual transaction
    switch (operation.type) {
      case 'assign_category':
        if (!operation.categoryId) {
          throw new Error('Category ID required for assign_category operation');
        }
        // Update transaction category
        break;
      
      case 'add_tags':
        if (!operation.tagIds || operation.tagIds.length === 0) {
          throw new Error('Tag IDs required for add_tags operation');
        }
        // Add tags to transaction
        break;
      
      case 'remove_tags':
        // Remove tags from transaction
        break;
      
      case 'clear_categorization':
        // Clear all categorization from transaction
        break;
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Categorize single transaction
   */
  async categorizeTransaction(
    transactionId: string, 
    categoryId: string, 
    tagIds: string[] = [], 
    method: CategorizationMethod = 'manual'
  ): Promise<void> {
    const category = this.categories.get(categoryId);
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    // Validate tags
    for (const tagId of tagIds) {
      if (!this.tags.has(tagId)) {
        throw new Error(`Tag ${tagId} not found`);
      }
    }

    // Update category usage
    category.usage.totalTransactions++;
    category.usage.lastUsed = new Date().toISOString();
    category.usage.frequency++;
    
    // Update tag usage
    tagIds.forEach(tagId => {
      const tag = this.tags.get(tagId);
      if (tag) {
        tag.usage.totalTransactions++;
        tag.usage.lastUsed = new Date().toISOString();
        tag.usage.frequency++;
      }
    });

    this.saveData();
    
    // Clear cache for this transaction
    const cacheKey = `suggestions_${transactionId}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Record user feedback on categorization
   */
  async recordUserFeedback(
    transactionId: string,
    action: UserCategorizationAction
  ): Promise<void> {
    // Update rule success rates based on user actions
    if (action.action === 'accepted') {
      this.updateRuleSuccessRates(transactionId, true);
    } else if (action.action === 'rejected') {
      this.updateRuleSuccessRates(transactionId, false);
    }
    
    this.saveData();
  }

  /**
   * Update rule success rates based on user feedback
   */
  private updateRuleSuccessRates(transactionId: string, accepted: boolean): void {
    // Mock implementation - would track which rules were used for this transaction
    this.rules.forEach(rule => {
      if (rule.usage.matches > 0) {
        const currentSuccess = rule.usage.successRate * rule.usage.matches;
        const newSuccess = accepted ? currentSuccess + 1 : currentSuccess;
        rule.usage.successRate = newSuccess / (rule.usage.matches + 1);
      }
    });
  }

  /**
   * Get settings
   */
  getSettings(): CategorizationSettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<CategorizationSettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    this.saveData();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Export categorization data
   */
  async exportData(): Promise<any> {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      categories: Array.from(this.categories.values()),
      tags: Array.from(this.tags.values()),
      rules: Array.from(this.rules.values()),
      settings: this.settings
    };
  }

  /**
   * Import categorization data
   */
  async importData(data: any): Promise<void> {
    try {
      if (data.categories) {
        data.categories.forEach((category: TransactionCategory) => {
          this.categories.set(category.id, category);
        });
      }

      if (data.tags) {
        data.tags.forEach((tag: TransactionTag) => {
          this.tags.set(tag.id, tag);
        });
      }

      if (data.rules) {
        data.rules.forEach((rule: CategoryRule) => {
          this.rules.set(rule.id, rule);
        });
      }

      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
      }

      this.saveData();
      this.clearCache();
    } catch (error) {
      throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const categorizationService = new CategorizationService();