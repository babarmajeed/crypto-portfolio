import { useState, useCallback, useEffect } from 'react';
import {
  TransactionCategory,
  CategoryRule,
  CategorySuggestion,
  CategorizedTransaction,
  CategoryAnalytics,
  CategoryUsage,
  TagSuggestion,
  CategoryTemplate,
  BulkCategorizationOptions,
  BulkCategorizationResult,
  CategoryType,
  TaxType,
  RuleCondition,
  CategorizationSettings
} from '../types/categorization.types';
import { categorizationService } from '../services/CategorizationService';
import { patternRecognitionService } from '../services/PatternRecognitionService';
import { mlClassifierService } from '../services/MLClassifierService';

interface CategorizationState {
  categories: TransactionCategory[];
  rules: CategoryRule[];
  suggestions: Map<string, CategorySuggestion[]>;
  isLoading: boolean;
  error: string | null;
  analytics: CategoryAnalytics | null;
  templates: CategoryTemplate[];
  settings: CategorizationSettings;
}

interface CategorizationActions {
  // Category Management
  createCategory: (category: Omit<TransactionCategory, 'id' | 'createdAt' | 'updatedAt' | 'usage'>) => Promise<TransactionCategory>;
  updateCategory: (categoryId: string, updates: Partial<TransactionCategory>) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  getCategory: (categoryId: string) => TransactionCategory | null;
  getCategoriesByType: (type: CategoryType) => TransactionCategory[];
  
  // Rule Management
  createRule: (categoryId: string, rule: Omit<CategoryRule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<CategoryRule>;
  updateRule: (ruleId: string, updates: Partial<CategoryRule>) => Promise<void>;
  deleteRule: (ruleId: string) => Promise<void>;
  testRule: (rule: CategoryRule, transaction: CategorizedTransaction) => Promise<boolean>;
  
  // Categorization
  categorizeTransaction: (transaction: CategorizedTransaction, categoryId: string, method?: 'manual' | 'rule' | 'pattern' | 'ml') => Promise<void>;
  getSuggestions: (transaction: CategorizedTransaction) => Promise<CategorySuggestion[]>;
  applySuggestion: (transactionId: string, suggestion: CategorySuggestion) => Promise<void>;
  
  // Bulk Operations
  bulkCategorize: (transactionIds: string[], options: BulkCategorizationOptions) => Promise<BulkCategorizationResult>;
  autoCategorizeAll: (transactions: CategorizedTransaction[]) => Promise<BulkCategorizationResult>;
  
  // Analytics
  getAnalytics: (timeRange?: string) => Promise<CategoryAnalytics>;
  getCategoryUsage: (categoryId: string) => CategoryUsage;
  
  // Templates
  createTemplate: (template: Omit<CategoryTemplate, 'id' | 'createdAt'>) => Promise<CategoryTemplate>;
  applyTemplate: (templateId: string) => Promise<void>;
  exportCategories: () => Promise<string>;
  importCategories: (data: string) => Promise<void>;
  
  // Settings
  updateSettings: (settings: Partial<CategorizationSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  
  // Training
  trainMLModel: () => Promise<void>;
  retrainPatterns: () => Promise<void>;
  
  // Utilities
  refreshData: () => Promise<void>;
  clearCache: () => void;
}

const initialState: CategorizationState = {
  categories: [],
  rules: [],
  suggestions: new Map(),
  isLoading: false,
  error: null,
  analytics: null,
  templates: [],
  settings: {
    enableAutoSuggestions: true,
    enableMLPredictions: true,
    enablePatternRecognition: true,
    suggestionThreshold: 0.7,
    maxSuggestions: 5,
    autoApplyRules: true,
    learningMode: true,
    enableAuditLog: true
  }
};

export function useCategorization(): CategorizationState & CategorizationActions {
  const [state, setState] = useState<CategorizationState>(initialState);

  // Initialize hook
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const [categories, templates, settings] = await Promise.all([
        categorizationService.getCategories(),
        categorizationService.getTemplates(),
        categorizationService.getSettings()
      ]);

      const rules = categories.flatMap(cat => cat.rules);

      setState(prev => ({
        ...prev,
        categories,
        rules,
        templates,
        settings,
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load categorization data',
        isLoading: false
      }));
    }
  }, []);

  // Category Management
  const createCategory = useCallback(async (categoryData: Omit<TransactionCategory, 'id' | 'createdAt' | 'updatedAt' | 'usage'>): Promise<TransactionCategory> => {
    try {
      const category = await categorizationService.createCategory(categoryData);
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, category]
      }));
      return category;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create category';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const updateCategory = useCallback(async (categoryId: string, updates: Partial<TransactionCategory>): Promise<void> => {
    try {
      await categorizationService.updateCategory(categoryId, updates);
      setState(prev => ({
        ...prev,
        categories: prev.categories.map(cat => 
          cat.id === categoryId ? { ...cat, ...updates, updatedAt: new Date().toISOString() } : cat
        )
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update category';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const deleteCategory = useCallback(async (categoryId: string): Promise<void> => {
    try {
      await categorizationService.deleteCategory(categoryId);
      setState(prev => ({
        ...prev,
        categories: prev.categories.filter(cat => cat.id !== categoryId),
        rules: prev.rules.filter(rule => rule.categoryId !== categoryId)
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete category';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const getCategory = useCallback((categoryId: string): TransactionCategory | null => {
    return state.categories.find(cat => cat.id === categoryId) || null;
  }, [state.categories]);

  const getCategoriesByType = useCallback((type: CategoryType): TransactionCategory[] => {
    return state.categories.filter(cat => cat.type === type);
  }, [state.categories]);

  // Rule Management
  const createRule = useCallback(async (categoryId: string, ruleData: Omit<CategoryRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<CategoryRule> => {
    try {
      const rule = await categorizationService.createRule(categoryId, ruleData);
      setState(prev => ({
        ...prev,
        rules: [...prev.rules, rule],
        categories: prev.categories.map(cat => 
          cat.id === categoryId 
            ? { ...cat, rules: [...cat.rules, rule] }
            : cat
        )
      }));
      return rule;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create rule';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const updateRule = useCallback(async (ruleId: string, updates: Partial<CategoryRule>): Promise<void> => {
    try {
      await categorizationService.updateRule(ruleId, updates);
      setState(prev => ({
        ...prev,
        rules: prev.rules.map(rule => 
          rule.id === ruleId ? { ...rule, ...updates, updatedAt: new Date().toISOString() } : rule
        ),
        categories: prev.categories.map(cat => ({
          ...cat,
          rules: cat.rules.map(rule => 
            rule.id === ruleId ? { ...rule, ...updates, updatedAt: new Date().toISOString() } : rule
          )
        }))
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update rule';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const deleteRule = useCallback(async (ruleId: string): Promise<void> => {
    try {
      await categorizationService.deleteRule(ruleId);
      setState(prev => ({
        ...prev,
        rules: prev.rules.filter(rule => rule.id !== ruleId),
        categories: prev.categories.map(cat => ({
          ...cat,
          rules: cat.rules.filter(rule => rule.id !== ruleId)
        }))
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete rule';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const testRule = useCallback(async (rule: CategoryRule, transaction: CategorizedTransaction): Promise<boolean> => {
    try {
      return await categorizationService.testRule(rule, transaction);
    } catch (error) {
      console.error('Failed to test rule:', error);
      return false;
    }
  }, []);

  // Categorization
  const categorizeTransaction = useCallback(async (
    transaction: CategorizedTransaction, 
    categoryId: string, 
    method: 'manual' | 'rule' | 'pattern' | 'ml' = 'manual'
  ): Promise<void> => {
    try {
      await categorizationService.categorizeTransaction(transaction.id, categoryId, method);
      
      // Update category usage
      setState(prev => ({
        ...prev,
        categories: prev.categories.map(cat => 
          cat.id === categoryId 
            ? {
                ...cat,
                usage: {
                  ...cat.usage,
                  totalTransactions: cat.usage.totalTransactions + 1,
                  lastUsed: new Date().toISOString()
                }
              }
            : cat
        )
      }));

      // Add to ML training data if learning mode is enabled
      if (state.settings.learningMode) {
        const categorizedTransaction = { ...transaction, categoryId, categorizedBy: method };
        await mlClassifierService.addTrainingData([categorizedTransaction]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to categorize transaction';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.settings.learningMode]);

  const getSuggestions = useCallback(async (transaction: CategorizedTransaction): Promise<CategorySuggestion[]> => {
    try {
      const suggestions = await categorizationService.getCategorySuggestions(transaction);
      
      setState(prev => ({
        ...prev,
        suggestions: new Map(prev.suggestions.set(transaction.id, suggestions))
      }));
      
      return suggestions;
    } catch (error) {
      console.error('Failed to get suggestions:', error);
      return [];
    }
  }, []);

  const applySuggestion = useCallback(async (transactionId: string, suggestion: CategorySuggestion): Promise<void> => {
    try {
      await categorizationService.applySuggestion(transactionId, suggestion);
      
      // Remove suggestion from cache
      setState(prev => {
        const newSuggestions = new Map(prev.suggestions);
        newSuggestions.delete(transactionId);
        return { ...prev, suggestions: newSuggestions };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply suggestion';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Bulk Operations
  const bulkCategorize = useCallback(async (
    transactionIds: string[], 
    options: BulkCategorizationOptions
  ): Promise<BulkCategorizationResult> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await categorizationService.bulkCategorize(transactionIds, options);
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk categorization failed';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      throw error;
    }
  }, []);

  const autoCategorizeAll = useCallback(async (transactions: CategorizedTransaction[]): Promise<BulkCategorizationResult> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const result = await categorizationService.autoCategorizeTransactions(transactions);
      
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Auto categorization failed';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      throw error;
    }
  }, []);

  // Analytics
  const getAnalytics = useCallback(async (timeRange?: string): Promise<CategoryAnalytics> => {
    try {
      const analytics = await categorizationService.getAnalytics(timeRange);
      setState(prev => ({ ...prev, analytics }));
      return analytics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get analytics';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const getCategoryUsage = useCallback((categoryId: string): CategoryUsage => {
    const category = state.categories.find(cat => cat.id === categoryId);
    return category?.usage || {
      totalTransactions: 0,
      totalValue: 0,
      averageValue: 0,
      lastUsed: null,
      frequency: 0,
      successRate: 0
    };
  }, [state.categories]);

  // Templates
  const createTemplate = useCallback(async (templateData: Omit<CategoryTemplate, 'id' | 'createdAt'>): Promise<CategoryTemplate> => {
    try {
      const template = await categorizationService.createTemplate(templateData);
      setState(prev => ({
        ...prev,
        templates: [...prev.templates, template]
      }));
      return template;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create template';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const applyTemplate = useCallback(async (templateId: string): Promise<void> => {
    try {
      const categories = await categorizationService.applyTemplate(templateId);
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, ...categories]
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to apply template';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const exportCategories = useCallback(async (): Promise<string> => {
    try {
      return await categorizationService.exportCategories();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export categories';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const importCategories = useCallback(async (data: string): Promise<void> => {
    try {
      const categories = await categorizationService.importCategories(data);
      setState(prev => ({
        ...prev,
        categories: [...prev.categories, ...categories]
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import categories';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Settings
  const updateSettings = useCallback(async (settingsUpdates: Partial<CategorizationSettings>): Promise<void> => {
    try {
      const newSettings = { ...state.settings, ...settingsUpdates };
      await categorizationService.updateSettings(newSettings);
      setState(prev => ({ ...prev, settings: newSettings }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update settings';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [state.settings]);

  const resetSettings = useCallback(async (): Promise<void> => {
    try {
      await categorizationService.resetSettings();
      setState(prev => ({ ...prev, settings: initialState.settings }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset settings';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  // Training
  const trainMLModel = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const categorizedTransactions = await categorizationService.getCategorizedTransactions();
      await mlClassifierService.trainModel('random_forest', categorizedTransactions);
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to train ML model';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      throw error;
    }
  }, []);

  const retrainPatterns = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const transactions = await categorizationService.getCategorizedTransactions();
      await patternRecognitionService.detectPatterns(transactions);
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retrain patterns';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      throw error;
    }
  }, []);

  // Utilities
  const refreshData = useCallback(async (): Promise<void> => {
    await loadInitialData();
  }, [loadInitialData]);

  const clearCache = useCallback((): void => {
    setState(prev => ({
      ...prev,
      suggestions: new Map(),
      analytics: null,
      error: null
    }));
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    createCategory,
    updateCategory,
    deleteCategory,
    getCategory,
    getCategoriesByType,
    createRule,
    updateRule,
    deleteRule,
    testRule,
    categorizeTransaction,
    getSuggestions,
    applySuggestion,
    bulkCategorize,
    autoCategorizeAll,
    getAnalytics,
    getCategoryUsage,
    createTemplate,
    applyTemplate,
    exportCategories,
    importCategories,
    updateSettings,
    resetSettings,
    trainMLModel,
    retrainPatterns,
    refreshData,
    clearCache
  };
}

// Hook for category suggestions only
export function useCategorySuggestions(transaction: CategorizedTransaction | null) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSuggestions = useCallback(async () => {
    if (!transaction) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const results = await categorizationService.getCategorySuggestions(transaction);
      setSuggestions(results);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [transaction]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  return { suggestions, isLoading, refresh: loadSuggestions };
}

// Hook for bulk operations
export function useBulkCategorization() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BulkCategorizationResult | null>(null);

  const processBulk = useCallback(async (
    transactionIds: string[],
    options: BulkCategorizationOptions,
    onProgress?: (progress: number) => void
  ): Promise<BulkCategorizationResult> => {
    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const result = await categorizationService.bulkCategorize(
        transactionIds,
        options,
        (progress) => {
          setProgress(progress);
          onProgress?.(progress);
        }
      );

      setResult(result);
      return result;
    } catch (error) {
      throw error;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  return {
    isProcessing,
    progress,
    result,
    processBulk,
    reset: () => {
      setResult(null);
      setProgress(0);
    }
  };
}