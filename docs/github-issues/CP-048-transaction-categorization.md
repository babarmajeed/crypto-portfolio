# CP-048: Intelligent Transaction Categorization and Tagging

## Overview
Implement an intelligent transaction categorization system that automatically classifies transactions, detects patterns, applies smart tags, and provides detailed analytics for better portfolio management and tax reporting.

## Objectives
- Build AI-powered transaction categorization engine
- Implement custom tagging system with auto-suggestions
- Create pattern recognition for transaction types
- Add advanced filtering and analytics based on categories

## Acceptance Criteria
- [ ] Automatic transaction categorization with machine learning
- [ ] Custom tag creation and management system
- [ ] Pattern recognition for recurring transactions
- [ ] Bulk categorization and editing tools
- [ ] Category-based portfolio analytics and insights
- [ ] Tax-friendly categorization for reporting
- [ ] Smart suggestions based on transaction patterns
- [ ] Import/export of categorization rules
- [ ] Visual category distribution charts
- [ ] Historical category trend analysis

## Technical Implementation

### File Structure
```
src/
  components/
    Categorization/
      CategoryManager.jsx
      TransactionCategorizer.jsx
      BulkCategorization.jsx
      CategoryAnalytics.jsx
      TagEditor.jsx
      CategoryRules.jsx
      PatternDetector.jsx
  hooks/
    useTransactionCategories.js
    useCategoryAnalytics.js
    usePatternDetection.js
  services/
    CategorizationService.js
    PatternRecognitionService.js
    TaxCategoryService.js
  ml/
    categoryClassifier.js
    patternLearning.js
  utils/
    categoryUtils.js
    tagUtils.js
```

### Category Manager Component
```jsx
// CategoryManager.jsx
import React, { useState, useEffect } from 'react';
import { useTransactionCategories } from '../hooks/useTransactionCategories';
import { useCategoryAnalytics } from '../hooks/useCategoryAnalytics';
import TransactionCategorizer from './TransactionCategorizer';
import BulkCategorization from './BulkCategorization';
import CategoryAnalytics from './CategoryAnalytics';
import CategoryRules from './CategoryRules';

const CategoryManager = ({ transactions, onTransactionUpdate }) => {
  const [activeTab, setActiveTab] = useState('categorize');
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    categories,
    tags,
    uncategorizedTransactions,
    categorizeTransaction,
    bulkCategorize,
    createCategory,
    createTag,
    deleteCategory,
    mergeCategories,
    exportRules,
    importRules
  } = useTransactionCategories(transactions);

  const {
    categoryDistribution,
    categoryTrends,
    taxCategorySummary,
    categoryPerformance
  } = useCategoryAnalytics(transactions, categories);

  const tabs = [
    { id: 'categorize', label: 'Categorize', icon: '🏷️' },
    { id: 'bulk', label: 'Bulk Edit', icon: '📝' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
    { id: 'rules', label: 'Rules', icon: '⚙️' }
  ];

  const defaultCategories = [
    { id: 'trading', name: 'Trading', color: '#007bff', taxType: 'capital_gains' },
    { id: 'staking', name: 'Staking Rewards', color: '#28a745', taxType: 'income' },
    { id: 'mining', name: 'Mining', color: '#ffc107', taxType: 'income' },
    { id: 'airdrops', name: 'Airdrops', color: '#17a2b8', taxType: 'income' },
    { id: 'defi', name: 'DeFi', color: '#6f42c1', taxType: 'capital_gains' },
    { id: 'fees', name: 'Transaction Fees', color: '#dc3545', taxType: 'expense' },
    { id: 'transfers', name: 'Transfers', color: '#6c757d', taxType: 'non_taxable' }
  ];

  const handleBulkCategorization = async (categoryId, tagIds = []) => {
    await bulkCategorize(selectedTransactions, categoryId, tagIds);
    setSelectedTransactions([]);
  };

  const handleAutoCategorizeSingle = async (transaction) => {
    const result = await categorizeTransaction(transaction.id, 'auto');
    onTransactionUpdate?.(result);
  };

  const handleAutoCategorizeAll = async () => {
    const uncategorized = transactions.filter(tx => !tx.categoryId);
    for (const transaction of uncategorized) {
      await categorizeTransaction(transaction.id, 'auto');
    }
  };

  const getFilteredTransactions = () => {
    let filtered = transactions;

    if (filterCategory !== 'all') {
      filtered = filtered.filter(tx => tx.categoryId === filterCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tx =>
        tx.asset?.toLowerCase().includes(query) ||
        tx.type?.toLowerCase().includes(query) ||
        tx.exchange?.toLowerCase().includes(query) ||
        tx.notes?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const renderCategorizeTab = () => (
    <div className="categorize-tab">
      <div className="categorize-header">
        <div className="search-filter">
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="category-filter"
          >
            <option value="all">All Categories</option>
            <option value="">Uncategorized</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="categorize-actions">
          <button
            onClick={handleAutoCategorizeAll}
            className="auto-categorize-btn"
          >
            🤖 Auto-Categorize All
          </button>
          
          <button
            onClick={() => setSelectedTransactions(
              selectedTransactions.length === transactions.length ? [] : transactions.map(tx => tx.id)
            )}
            className="select-all-btn"
          >
            {selectedTransactions.length === transactions.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      <div className="uncategorized-summary">
        <div className="summary-card">
          <h4>Uncategorized Transactions</h4>
          <span className="count">{uncategorizedTransactions.length}</span>
        </div>
        <div className="summary-card">
          <h4>Total Categories</h4>
          <span className="count">{categories.length}</span>
        </div>
        <div className="summary-card">
          <h4>Total Tags</h4>
          <span className="count">{tags.length}</span>
        </div>
      </div>

      <TransactionCategorizer
        transactions={getFilteredTransactions()}
        categories={categories}
        tags={tags}
        selectedTransactions={selectedTransactions}
        onSelectionChange={setSelectedTransactions}
        onCategorize={categorizeTransaction}
        onAutoCategorizeSingle={handleAutoCategorizeSingle}
      />
    </div>
  );

  const renderBulkTab = () => (
    <div className="bulk-tab">
      <BulkCategorization
        transactions={transactions}
        categories={categories}
        tags={tags}
        selectedTransactions={selectedTransactions}
        onSelectionChange={setSelectedTransactions}
        onBulkCategorize={handleBulkCategorization}
        onCreateCategory={createCategory}
        onCreateTag={createTag}
      />
    </div>
  );

  const renderAnalyticsTab = () => (
    <div className="analytics-tab">
      <CategoryAnalytics
        categoryDistribution={categoryDistribution}
        categoryTrends={categoryTrends}
        taxCategorySummary={taxCategorySummary}
        categoryPerformance={categoryPerformance}
        categories={categories}
      />
    </div>
  );

  const renderRulesTab = () => (
    <div className="rules-tab">
      <CategoryRules
        categories={categories}
        onCreateCategory={createCategory}
        onDeleteCategory={deleteCategory}
        onMergeCategories={mergeCategories}
        onExportRules={exportRules}
        onImportRules={importRules}
      />
    </div>
  );

  return (
    <div className="category-manager">
      <div className="manager-header">
        <h2>Transaction Categorization</h2>
        <p>Organize and analyze your transactions with intelligent categorization</p>
      </div>

      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'categorize' && renderCategorizeTab()}
        {activeTab === 'bulk' && renderBulkTab()}
        {activeTab === 'analytics' && renderAnalyticsTab()}
        {activeTab === 'rules' && renderRulesTab()}
      </div>
    </div>
  );
};

export default CategoryManager;
```

### Transaction Categorizer Component
```jsx
// TransactionCategorizer.jsx
import React, { useState, useEffect } from 'react';
import { categorizationService } from '../services/CategorizationService';

const TransactionCategorizer = ({
  transactions,
  categories,
  tags,
  selectedTransactions,
  onSelectionChange,
  onCategorize,
  onAutoCategorizeSingle
}) => {
  const [suggestions, setSuggestions] = useState(new Map());
  const [expandedTransaction, setExpandedTransaction] = useState(null);

  useEffect(() => {
    loadSuggestions();
  }, [transactions]);

  const loadSuggestions = async () => {
    const newSuggestions = new Map();
    
    for (const transaction of transactions.slice(0, 20)) { // Limit for performance
      if (!transaction.categoryId) {
        const suggestion = await categorizationService.suggestCategory(transaction);
        newSuggestions.set(transaction.id, suggestion);
      }
    }
    
    setSuggestions(newSuggestions);
  };

  const handleTransactionSelect = (transactionId) => {
    const newSelection = selectedTransactions.includes(transactionId)
      ? selectedTransactions.filter(id => id !== transactionId)
      : [...selectedTransactions, transactionId];
    
    onSelectionChange(newSelection);
  };

  const handleCategoryChange = async (transactionId, categoryId) => {
    await onCategorize(transactionId, categoryId);
  };

  const handleAcceptSuggestion = async (transactionId, suggestion) => {
    await onCategorize(transactionId, suggestion.categoryId, suggestion.tagIds);
    setSuggestions(prev => {
      const newSuggestions = new Map(prev);
      newSuggestions.delete(transactionId);
      return newSuggestions;
    });
  };

  const getCategoryColor = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#6c757d';
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const getTagNames = (tagIds = []) => {
    return tagIds.map(tagId => {
      const tag = tags.find(t => t.id === tagId);
      return tag?.name || tagId;
    }).join(', ');
  };

  const renderSuggestionCard = (transaction, suggestion) => (
    <div className="suggestion-card">
      <div className="suggestion-header">
        <span className="suggestion-label">AI Suggestion:</span>
        <span className="confidence-score">
          {Math.round(suggestion.confidence * 100)}% confidence
        </span>
      </div>
      
      <div className="suggestion-content">
        <div className="suggested-category">
          <span 
            className="category-dot"
            style={{ backgroundColor: getCategoryColor(suggestion.categoryId) }}
          ></span>
          <span className="category-name">{getCategoryName(suggestion.categoryId)}</span>
        </div>
        
        {suggestion.tagIds?.length > 0 && (
          <div className="suggested-tags">
            <span className="tags-label">Tags:</span>
            <span className="tags-list">{getTagNames(suggestion.tagIds)}</span>
          </div>
        )}
        
        <div className="suggestion-reason">
          <span className="reason-label">Reason:</span>
          <span className="reason-text">{suggestion.reason}</span>
        </div>
      </div>
      
      <div className="suggestion-actions">
        <button
          onClick={() => handleAcceptSuggestion(transaction.id, suggestion)}
          className="accept-btn"
        >
          ✓ Accept
        </button>
        <button
          onClick={() => setSuggestions(prev => {
            const newSuggestions = new Map(prev);
            newSuggestions.delete(transaction.id);
            return newSuggestions;
          })}
          className="reject-btn"
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );

  return (
    <div className="transaction-categorizer">
      <div className="transactions-list">
        {transactions.map(transaction => {
          const suggestion = suggestions.get(transaction.id);
          const isSelected = selectedTransactions.includes(transaction.id);
          const isExpanded = expandedTransaction === transaction.id;
          
          return (
            <div 
              key={transaction.id}
              className={`transaction-row ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
            >
              <div className="transaction-header">
                <div className="transaction-select">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTransactionSelect(transaction.id)}
                  />
                </div>
                
                <div className="transaction-info">
                  <div className="transaction-primary">
                    <span className="asset">{transaction.asset}</span>
                    <span className={`type ${transaction.type}`}>{transaction.type}</span>
                    <span className="quantity">
                      {transaction.quantity > 0 ? '+' : ''}{transaction.quantity}
                    </span>
                    <span className="date">
                      {new Date(transaction.date).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="transaction-secondary">
                    <span className="exchange">{transaction.exchange}</span>
                    {transaction.price && (
                      <span className="price">${transaction.price.toFixed(2)}</span>
                    )}
                    <span className="total">${transaction.total?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
                
                <div className="transaction-category">
                  {transaction.categoryId ? (
                    <div className="current-category">
                      <span 
                        className="category-dot"
                        style={{ backgroundColor: getCategoryColor(transaction.categoryId) }}
                      ></span>
                      <span className="category-name">
                        {getCategoryName(transaction.categoryId)}
                      </span>
                      {transaction.tagIds?.length > 0 && (
                        <span className="tag-count">+{transaction.tagIds.length}</span>
                      )}
                    </div>
                  ) : (
                    <select
                      value=""
                      onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                      className="category-select"
                    >
                      <option value="">Select Category</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                
                <div className="transaction-actions">
                  {!transaction.categoryId && (
                    <button
                      onClick={() => onAutoCategorizeSingle(transaction)}
                      className="auto-categorize-single-btn"
                      title="Auto-categorize this transaction"
                    >
                      🤖
                    </button>
                  )}
                  
                  <button
                    onClick={() => setExpandedTransaction(
                      isExpanded ? null : transaction.id
                    )}
                    className="expand-btn"
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                </div>
              </div>
              
              {isExpanded && (
                <div className="transaction-details">
                  {suggestion && renderSuggestionCard(transaction, suggestion)}
                  
                  <div className="manual-categorization">
                    <h4>Manual Categorization</h4>
                    
                    <div className="category-selection">
                      <label>Category:</label>
                      <select
                        value={transaction.categoryId || ''}
                        onChange={(e) => handleCategoryChange(transaction.id, e.target.value)}
                      >
                        <option value="">No Category</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="tag-selection">
                      <label>Tags:</label>
                      <div className="tag-checkboxes">
                        {tags.map(tag => (
                          <label key={tag.id} className="tag-checkbox">
                            <input
                              type="checkbox"
                              checked={transaction.tagIds?.includes(tag.id) || false}
                              onChange={(e) => {
                                // Handle tag selection
                                console.log('Tag selection:', tag.id, e.target.checked);
                              }}
                            />
                            <span className="tag-name">{tag.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div className="transaction-notes">
                      <label>Notes:</label>
                      <textarea
                        value={transaction.notes || ''}
                        onChange={(e) => {
                          // Handle notes update
                          console.log('Notes update:', e.target.value);
                        }}
                        placeholder="Add notes about this transaction..."
                        rows="3"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TransactionCategorizer;
```

### Categorization Service
```javascript
// CategorizationService.js
import { patternRecognitionService } from './PatternRecognitionService';
import { categoryClassifier } from '../ml/categoryClassifier';

class CategorizationService {
  constructor() {
    this.categories = new Map();
    this.tags = new Map();
    this.rules = [];
    this.patterns = new Map();
    this.classifier = null;
  }

  async initialize() {
    await this.loadCategories();
    await this.loadTags();
    await this.loadRules();
    await this.initializeClassifier();
  }

  async suggestCategory(transaction) {
    try {
      // First, try rule-based categorization
      const ruleBasedSuggestion = this.applyRules(transaction);
      if (ruleBasedSuggestion) {
        return {
          categoryId: ruleBasedSuggestion.categoryId,
          tagIds: ruleBasedSuggestion.tagIds || [],
          confidence: 0.9,
          reason: `Matched rule: ${ruleBasedSuggestion.ruleName}`,
          method: 'rule-based'
        };
      }

      // Then try pattern recognition
      const patternSuggestion = await this.suggestByPattern(transaction);
      if (patternSuggestion && patternSuggestion.confidence > 0.7) {
        return patternSuggestion;
      }

      // Finally, use ML classifier
      const mlSuggestion = await this.suggestByML(transaction);
      return mlSuggestion;

    } catch (error) {
      console.error('Error suggesting category:', error);
      return {
        categoryId: 'unknown',
        tagIds: [],
        confidence: 0.1,
        reason: 'Unable to categorize automatically',
        method: 'fallback'
      };
    }
  }

  applyRules(transaction) {
    for (const rule of this.rules) {
      if (this.evaluateRule(rule, transaction)) {
        return {
          categoryId: rule.categoryId,
          tagIds: rule.tagIds,
          ruleName: rule.name
        };
      }
    }
    return null;
  }

  evaluateRule(rule, transaction) {
    for (const condition of rule.conditions) {
      if (!this.evaluateCondition(condition, transaction)) {
        return false;
      }
    }
    return true;
  }

  evaluateCondition(condition, transaction) {
    const value = this.getTransactionValue(transaction, condition.field);
    
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      case 'contains':
        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'starts_with':
        return String(value).toLowerCase().startsWith(String(condition.value).toLowerCase());
      case 'greater_than':
        return parseFloat(value) > parseFloat(condition.value);
      case 'less_than':
        return parseFloat(value) < parseFloat(condition.value);
      case 'in_list':
        return condition.value.includes(value);
      default:
        return false;
    }
  }

  getTransactionValue(transaction, field) {
    switch (field) {
      case 'asset':
        return transaction.asset;
      case 'type':
        return transaction.type;
      case 'exchange':
        return transaction.exchange;
      case 'quantity':
        return transaction.quantity;
      case 'price':
        return transaction.price;
      case 'total':
        return transaction.total;
      case 'fees':
        return transaction.fees;
      case 'notes':
        return transaction.notes || '';
      default:
        return '';
    }
  }

  async suggestByPattern(transaction) {
    const patterns = await patternRecognitionService.findSimilarTransactions(transaction);
    
    if (patterns.length === 0) {
      return null;
    }

    // Find the most common category among similar transactions
    const categoryFrequency = {};
    const tagFrequency = {};
    
    patterns.forEach(pattern => {
      if (pattern.categoryId) {
        categoryFrequency[pattern.categoryId] = (categoryFrequency[pattern.categoryId] || 0) + pattern.similarity;
      }
      
      pattern.tagIds?.forEach(tagId => {
        tagFrequency[tagId] = (tagFrequency[tagId] || 0) + pattern.similarity;
      });
    });

    const bestCategory = Object.entries(categoryFrequency)
      .sort(([,a], [,b]) => b - a)[0];
    
    const bestTags = Object.entries(tagFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([tagId]) => tagId);

    if (!bestCategory) {
      return null;
    }

    const confidence = Math.min(bestCategory[1] / patterns.length, 0.95);
    
    return {
      categoryId: bestCategory[0],
      tagIds: bestTags,
      confidence,
      reason: `Similar to ${patterns.length} previous transactions`,
      method: 'pattern-matching'
    };
  }

  async suggestByML(transaction) {
    if (!this.classifier) {
      await this.initializeClassifier();
    }

    if (!this.classifier) {
      return {
        categoryId: 'unknown',
        tagIds: [],
        confidence: 0.1,
        reason: 'ML classifier not available',
        method: 'fallback'
      };
    }

    const features = this.extractFeatures(transaction);
    const prediction = await this.classifier.predict(features);
    
    return {
      categoryId: prediction.category,
      tagIds: prediction.tags || [],
      confidence: prediction.confidence,
      reason: `ML classification based on transaction features`,
      method: 'machine-learning'
    };
  }

  extractFeatures(transaction) {
    return {
      asset: transaction.asset?.toLowerCase() || '',
      type: transaction.type?.toLowerCase() || '',
      exchange: transaction.exchange?.toLowerCase() || '',
      quantity: Math.abs(transaction.quantity || 0),
      price: transaction.price || 0,
      total: Math.abs(transaction.total || 0),
      fees: transaction.fees || 0,
      dayOfWeek: new Date(transaction.date).getDay(),
      hourOfDay: new Date(transaction.date).getHours(),
      hasNotes: Boolean(transaction.notes),
      notesLength: transaction.notes?.length || 0,
      // Text features from notes
      notesWords: transaction.notes ? transaction.notes.toLowerCase().split(/\s+/) : []
    };
  }

  async initializeClassifier() {
    try {
      this.classifier = await categoryClassifier.initialize();
    } catch (error) {
      console.error('Error initializing classifier:', error);
      this.classifier = null;
    }
  }

  async categorizeTransaction(transactionId, categoryId, tagIds = []) {
    const transaction = {
      id: transactionId,
      categoryId,
      tagIds,
      categorizedAt: new Date().toISOString()
    };

    // Save to storage (this would integrate with your data layer)
    await this.saveTransactionCategory(transaction);
    
    // Update classifier with new training data
    if (this.classifier) {
      const features = this.extractFeatures(transaction);
      await this.classifier.addTrainingExample(features, categoryId, tagIds);
    }

    return transaction;
  }

  async bulkCategorize(transactionIds, categoryId, tagIds = []) {
    const results = [];
    
    for (const transactionId of transactionIds) {
      try {
        const result = await this.categorizeTransaction(transactionId, categoryId, tagIds);
        results.push({ success: true, transactionId, result });
      } catch (error) {
        results.push({ success: false, transactionId, error: error.message });
      }
    }

    return results;
  }

  async createCategory(categoryData) {
    const category = {
      id: categoryData.id || `cat_${Date.now()}`,
      name: categoryData.name,
      color: categoryData.color || '#6c757d',
      taxType: categoryData.taxType || 'capital_gains',
      description: categoryData.description || '',
      createdAt: new Date().toISOString()
    };

    this.categories.set(category.id, category);
    await this.saveCategories();
    
    return category;
  }

  async createTag(tagData) {
    const tag = {
      id: tagData.id || `tag_${Date.now()}`,
      name: tagData.name,
      color: tagData.color || '#007bff',
      description: tagData.description || '',
      createdAt: new Date().toISOString()
    };

    this.tags.set(tag.id, tag);
    await this.saveTags();
    
    return tag;
  }

  async createRule(ruleData) {
    const rule = {
      id: ruleData.id || `rule_${Date.now()}`,
      name: ruleData.name,
      conditions: ruleData.conditions,
      categoryId: ruleData.categoryId,
      tagIds: ruleData.tagIds || [],
      priority: ruleData.priority || 0,
      enabled: ruleData.enabled !== false,
      createdAt: new Date().toISOString()
    };

    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority); // Sort by priority
    
    await this.saveRules();
    return rule;
  }

  async loadCategories() {
    const stored = localStorage.getItem('transactionCategories');
    if (stored) {
      const categories = JSON.parse(stored);
      this.categories = new Map(categories);
    } else {
      // Initialize with default categories
      await this.initializeDefaultCategories();
    }
  }

  async loadTags() {
    const stored = localStorage.getItem('transactionTags');
    if (stored) {
      const tags = JSON.parse(stored);
      this.tags = new Map(tags);
    }
  }

  async loadRules() {
    const stored = localStorage.getItem('categorizationRules');
    if (stored) {
      this.rules = JSON.parse(stored);
    }
  }

  async saveCategories() {
    const categoriesArray = Array.from(this.categories.entries());
    localStorage.setItem('transactionCategories', JSON.stringify(categoriesArray));
  }

  async saveTags() {
    const tagsArray = Array.from(this.tags.entries());
    localStorage.setItem('transactionTags', JSON.stringify(tagsArray));
  }

  async saveRules() {
    localStorage.setItem('categorizationRules', JSON.stringify(this.rules));
  }

  async saveTransactionCategory(transaction) {
    // This would integrate with your transaction storage
    const transactions = JSON.parse(localStorage.getItem('categorizedTransactions') || '[]');
    const index = transactions.findIndex(t => t.id === transaction.id);
    
    if (index >= 0) {
      transactions[index] = { ...transactions[index], ...transaction };
    } else {
      transactions.push(transaction);
    }
    
    localStorage.setItem('categorizedTransactions', JSON.stringify(transactions));
  }

  async initializeDefaultCategories() {
    const defaultCategories = [
      { name: 'Trading', color: '#007bff', taxType: 'capital_gains' },
      { name: 'Staking Rewards', color: '#28a745', taxType: 'income' },
      { name: 'Mining', color: '#ffc107', taxType: 'income' },
      { name: 'Airdrops', color: '#17a2b8', taxType: 'income' },
      { name: 'DeFi', color: '#6f42c1', taxType: 'capital_gains' },
      { name: 'Transaction Fees', color: '#dc3545', taxType: 'expense' },
      { name: 'Transfers', color: '#6c757d', taxType: 'non_taxable' }
    ];

    for (const categoryData of defaultCategories) {
      await this.createCategory(categoryData);
    }
  }

  getCategories() {
    return Array.from(this.categories.values());
  }

  getTags() {
    return Array.from(this.tags.values());
  }

  getRules() {
    return this.rules;
  }
}

export const categorizationService = new CategorizationService();
```

## Testing Requirements
- Machine learning accuracy validation
- Pattern recognition performance testing
- Bulk categorization efficiency testing
- Rule engine logic verification
- Tax categorization compliance testing

## Dependencies
- Depends on: CP-047 (Automated Data Sync)
- Depends on: CP-003 (Transaction History)
- Blocks: CP-049 (Tax Reporting Tools)

## Time Estimate
**Beginner**: 11-13 days
**Intermediate**: 7-9 days
**Advanced**: 5-7 days

## Required Skills
- Machine learning and pattern recognition
- Rule-based classification systems
- Data visualization and analytics
- Tax regulation knowledge
- Natural language processing basics