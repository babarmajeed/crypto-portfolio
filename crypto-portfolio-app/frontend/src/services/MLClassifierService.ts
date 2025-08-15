import {
  MLModel,
  MLModelType,
  MLModelStatus,
  MLTrainingData,
  MLFeature,
  MLParameters,
  MLPerformance,
  ClassificationReport,
  MLPrediction,
  CategorizedTransaction,
  CategorySuggestion,
  TransactionCategory,
  CategorizationMethod
} from '../types/categorization.types';

export class MLClassifierService {
  private models: Map<string, MLModel> = new Map();
  private activeModelId: string | null = null;
  private trainingData: CategorizedTransaction[] = [];
  private features: MLFeature[] = [];
  private isTraining = false;
  private modelCache = new Map<string, any>();

  constructor() {
    this.initializeDefaultFeatures();
    this.loadModels();
    this.loadTrainingData();
  }

  /**
   * Initialize default ML features
   */
  private initializeDefaultFeatures(): void {
    this.features = [
      {
        name: 'amount',
        type: 'numerical',
        importance: 0.15,
        preprocessing: ['normalize', 'log_transform']
      },
      {
        name: 'asset',
        type: 'categorical',
        importance: 0.25,
        encoding: 'one_hot'
      },
      {
        name: 'transaction_type',
        type: 'categorical',
        importance: 0.20,
        encoding: 'label'
      },
      {
        name: 'exchange',
        type: 'categorical',
        importance: 0.15,
        encoding: 'one_hot'
      },
      {
        name: 'day_of_week',
        type: 'categorical',
        importance: 0.08,
        encoding: 'ordinal'
      },
      {
        name: 'hour_of_day',
        type: 'numerical',
        importance: 0.06,
        preprocessing: ['normalize']
      },
      {
        name: 'amount_percentile',
        type: 'numerical',
        importance: 0.10,
        preprocessing: ['normalize']
      },
      {
        name: 'has_fees',
        type: 'boolean',
        importance: 0.05
      },
      {
        name: 'weekend_flag',
        type: 'boolean',
        importance: 0.03
      },
      {
        name: 'price_volatility',
        type: 'numerical',
        importance: 0.08,
        preprocessing: ['normalize']
      }
    ];
  }

  /**
   * Load stored models from localStorage
   */
  private loadModels(): void {
    try {
      const stored = localStorage.getItem('ml_models');
      if (stored) {
        const modelsData = JSON.parse(stored);
        modelsData.forEach((model: MLModel) => {
          this.models.set(model.id, model);
        });
      }

      const activeModelId = localStorage.getItem('active_ml_model');
      if (activeModelId && this.models.has(activeModelId)) {
        this.activeModelId = activeModelId;
      }
    } catch (error) {
      console.error('Failed to load ML models:', error);
    }
  }

  /**
   * Load training data
   */
  private loadTrainingData(): void {
    try {
      const stored = localStorage.getItem('ml_training_data');
      if (stored) {
        this.trainingData = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load training data:', error);
    }
  }

  /**
   * Save models to localStorage
   */
  private saveModels(): void {
    try {
      localStorage.setItem('ml_models', JSON.stringify(Array.from(this.models.values())));
      if (this.activeModelId) {
        localStorage.setItem('active_ml_model', this.activeModelId);
      }
    } catch (error) {
      console.error('Failed to save ML models:', error);
    }
  }

  /**
   * Train a new ML model
   */
  async trainModel(
    modelType: MLModelType = 'random_forest',
    trainingTransactions?: CategorizedTransaction[],
    hyperparameters?: MLParameters
  ): Promise<MLModel> {
    if (this.isTraining) {
      throw new Error('Model training already in progress');
    }

    this.isTraining = true;

    try {
      const trainingData = trainingTransactions || this.getTrainingData();
      
      if (trainingData.length < 50) {
        throw new Error('Insufficient training data. At least 50 categorized transactions required.');
      }

      const modelId = `model_${modelType}_${Date.now()}`;
      
      // Prepare training data
      const { features, labels, categories } = await this.prepareTrainingData(trainingData);
      
      // Split data into train/test sets
      const { trainFeatures, testFeatures, trainLabels, testLabels } = this.splitTrainingData(
        features, labels, 0.8
      );

      // Create and train model
      const model = await this.createModel(modelId, modelType, hyperparameters);
      const trainedModel = await this.trainModelWithData(model, trainFeatures, trainLabels, categories);
      
      // Evaluate model
      const performance = await this.evaluateModel(trainedModel, testFeatures, testLabels, categories);
      
      trainedModel.performance = performance;
      trainedModel.status = 'ready';
      trainedModel.lastTrainedAt = new Date().toISOString();
      trainedModel.accuracy = performance.accuracy;

      // Save model
      this.models.set(modelId, trainedModel);
      this.activeModelId = modelId;
      this.saveModels();

      return trainedModel;
    } catch (error) {
      throw new Error(`Model training failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Get category predictions for a transaction
   */
  async predictCategory(transaction: CategorizedTransaction): Promise<CategorySuggestion[]> {
    const activeModel = this.getActiveModel();
    if (!activeModel) {
      throw new Error('No active ML model available');
    }

    try {
      const features = this.extractFeatures(transaction);
      const predictions = await this.makePrediction(activeModel, features);
      
      return this.formatPredictions(predictions, transaction);
    } catch (error) {
      console.error('Prediction failed:', error);
      return [];
    }
  }

  /**
   * Batch predict categories for multiple transactions
   */
  async batchPredict(transactions: CategorizedTransaction[]): Promise<Map<string, CategorySuggestion[]>> {
    const results = new Map<string, CategorySuggestion[]>();
    const activeModel = this.getActiveModel();
    
    if (!activeModel) {
      throw new Error('No active ML model available');
    }

    try {
      for (const transaction of transactions) {
        const suggestions = await this.predictCategory(transaction);
        results.set(transaction.id, suggestions);
      }
      
      return results;
    } catch (error) {
      console.error('Batch prediction failed:', error);
      return results;
    }
  }

  /**
   * Add training data and retrain if needed
   */
  async addTrainingData(transactions: CategorizedTransaction[]): Promise<void> {
    const categorizedTransactions = transactions.filter(tx => tx.categoryId);
    
    if (categorizedTransactions.length === 0) return;

    this.trainingData.push(...categorizedTransactions);
    
    // Keep only recent training data (last 10,000 transactions)
    this.trainingData = this.trainingData.slice(-10000);
    
    try {
      localStorage.setItem('ml_training_data', JSON.stringify(this.trainingData));
    } catch (error) {
      console.error('Failed to save training data:', error);
    }

    // Auto-retrain if we have enough new data
    const activeModel = this.getActiveModel();
    if (activeModel && this.shouldRetrain(activeModel, categorizedTransactions.length)) {
      await this.trainModel(activeModel.type);
    }
  }

  /**
   * Get model performance metrics
   */
  getModelPerformance(modelId?: string): MLPerformance | null {
    const model = modelId ? this.models.get(modelId) : this.getActiveModel();
    return model?.performance || null;
  }

  /**
   * Get all available models
   */
  getAvailableModels(): MLModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Set active model
   */
  setActiveModel(modelId: string): void {
    if (!this.models.has(modelId)) {
      throw new Error(`Model ${modelId} not found`);
    }
    
    this.activeModelId = modelId;
    localStorage.setItem('active_ml_model', modelId);
  }

  /**
   * Delete model
   */
  deleteModel(modelId: string): void {
    if (!this.models.has(modelId)) {
      throw new Error(`Model ${modelId} not found`);
    }

    this.models.delete(modelId);
    
    if (this.activeModelId === modelId) {
      this.activeModelId = null;
      localStorage.removeItem('active_ml_model');
    }
    
    this.saveModels();
  }

  /**
   * Update model with feedback
   */
  async updateModelWithFeedback(
    transactionId: string,
    actualCategoryId: string,
    predictedCategoryId: string,
    wasCorrect: boolean
  ): Promise<void> {
    const activeModel = this.getActiveModel();
    if (!activeModel) return;

    // Find the transaction in training data
    const transaction = this.trainingData.find(tx => tx.id === transactionId);
    if (!transaction) return;

    // Update transaction category if prediction was wrong
    if (!wasCorrect && actualCategoryId !== predictedCategoryId) {
      transaction.categoryId = actualCategoryId;
      transaction.categorizedBy = 'manual';
    }

    // Update model performance statistics
    this.updateModelStats(activeModel, wasCorrect);
    
    this.saveModels();
  }

  /**
   * Private helper methods
   */
  private getActiveModel(): MLModel | null {
    return this.activeModelId ? this.models.get(this.activeModelId) || null : null;
  }

  private getTrainingData(): CategorizedTransaction[] {
    return this.trainingData.filter(tx => tx.categoryId && tx.categoryId.trim() !== '');
  }

  private async prepareTrainingData(transactions: CategorizedTransaction[]): Promise<{
    features: number[][];
    labels: string[];
    categories: string[];
  }> {
    const features: number[][] = [];
    const labels: string[] = [];
    const categorySet = new Set<string>();

    // Extract features and labels
    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;

      const featureVector = this.extractFeatures(transaction);
      features.push(featureVector);
      labels.push(transaction.categoryId);
      categorySet.add(transaction.categoryId);
    }

    const categories = Array.from(categorySet);
    
    return { features, labels, categories };
  }

  private extractFeatures(transaction: CategorizedTransaction): number[] {
    const features: number[] = [];
    const date = new Date(transaction.timestamp);

    // Amount (normalized)
    const amount = transaction.amount || 0;
    features.push(this.normalizeAmount(amount));

    // Asset (one-hot encoded)
    const assetEncoding = this.encodeAsset(transaction.asset);
    features.push(...assetEncoding);

    // Transaction type (label encoded)
    features.push(this.encodeTransactionType(transaction.type));

    // Exchange (one-hot encoded)
    const exchangeEncoding = this.encodeExchange(transaction.exchangeId || 'unknown');
    features.push(...exchangeEncoding);

    // Day of week (ordinal)
    features.push(date.getDay() / 6); // Normalize to 0-1

    // Hour of day (normalized)
    features.push(date.getHours() / 23); // Normalize to 0-1

    // Amount percentile
    features.push(this.calculateAmountPercentile(amount));

    // Has fees (boolean)
    features.push((transaction.fees || 0) > 0 ? 1 : 0);

    // Weekend flag (boolean)
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    features.push(isWeekend ? 1 : 0);

    // Price volatility (mock calculation)
    features.push(this.calculatePriceVolatility(transaction));

    return features;
  }

  private normalizeAmount(amount: number): number {
    // Log transform and normalize
    const logAmount = Math.log(Math.max(amount, 0.01));
    return Math.min(1, Math.max(0, (logAmount + 10) / 20)); // Rough normalization
  }

  private encodeAsset(asset: string): number[] {
    const commonAssets = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'XRP', 'DOT', 'MATIC', 'DOGE', 'LTC'];
    const encoding = new Array(commonAssets.length + 1).fill(0); // +1 for "other"
    
    const index = commonAssets.indexOf(asset);
    if (index >= 0) {
      encoding[index] = 1;
    } else {
      encoding[commonAssets.length] = 1; // "other" category
    }
    
    return encoding;
  }

  private encodeTransactionType(type: string): number {
    const typeMap: { [key: string]: number } = {
      'buy': 1,
      'sell': 2,
      'trade': 3,
      'deposit': 4,
      'withdrawal': 5,
      'transfer': 6,
      'staking': 7,
      'mining': 8,
      'airdrop': 9
    };
    
    return typeMap[type] || 0;
  }

  private encodeExchange(exchange: string): number[] {
    const commonExchanges = ['coinbase', 'binance', 'kraken', 'kucoin', 'huobi', 'okx'];
    const encoding = new Array(commonExchanges.length + 1).fill(0); // +1 for "other"
    
    const index = commonExchanges.indexOf(exchange.toLowerCase());
    if (index >= 0) {
      encoding[index] = 1;
    } else {
      encoding[commonExchanges.length] = 1; // "other" category
    }
    
    return encoding;
  }

  private calculateAmountPercentile(amount: number): number {
    // Calculate percentile based on training data
    const amounts = this.trainingData.map(tx => tx.amount || 0).sort((a, b) => a - b);
    if (amounts.length === 0) return 0.5;
    
    let rank = 0;
    for (const amt of amounts) {
      if (amt <= amount) rank++;
      else break;
    }
    
    return rank / amounts.length;
  }

  private calculatePriceVolatility(transaction: CategorizedTransaction): number {
    // Mock volatility calculation - in real implementation, would use historical price data
    const asset = transaction.asset;
    const volatilityMap: { [key: string]: number } = {
      'BTC': 0.6, 'ETH': 0.7, 'BNB': 0.5, 'ADA': 0.8, 'SOL': 0.9,
      'XRP': 0.8, 'DOT': 0.8, 'MATIC': 0.9, 'DOGE': 1.0, 'LTC': 0.7
    };
    
    return volatilityMap[asset] || 0.8; // Default volatility
  }

  private splitTrainingData(
    features: number[][],
    labels: string[],
    trainRatio: number
  ): {
    trainFeatures: number[][];
    testFeatures: number[][];
    trainLabels: string[];
    testLabels: string[];
  } {
    const trainSize = Math.floor(features.length * trainRatio);
    
    return {
      trainFeatures: features.slice(0, trainSize),
      testFeatures: features.slice(trainSize),
      trainLabels: labels.slice(0, trainSize),
      testLabels: labels.slice(trainSize)
    };
  }

  private async createModel(
    modelId: string,
    modelType: MLModelType,
    hyperparameters?: MLParameters
  ): Promise<MLModel> {
    const defaultParams = this.getDefaultHyperparameters(modelType);
    const params = { ...defaultParams, ...hyperparameters };

    return {
      id: modelId,
      name: `${modelType} Classifier`,
      type: modelType,
      version: '1.0.0',
      status: 'training',
      accuracy: 0,
      trainingData: {
        totalSamples: 0,
        trainingSamples: 0,
        testingSamples: 0,
        validationSamples: 0,
        categories: [],
        features: this.features.map(f => f.name),
        lastUpdated: new Date().toISOString()
      },
      features: this.features,
      parameters: params,
      performance: {
        accuracy: 0,
        precision: 0,
        recall: 0,
        f1Score: 0,
        confusionMatrix: [],
        classificationReport: {},
        crossValidationScores: []
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private getDefaultHyperparameters(modelType: MLModelType): MLParameters {
    switch (modelType) {
      case 'random_forest':
        return {
          numEstimators: 100,
          maxDepth: 10,
          minSamplesSplit: 2,
          minSamplesLeaf: 1
        };
      case 'decision_tree':
        return {
          maxDepth: 8,
          minSamplesSplit: 2,
          criterion: 'gini'
        };
      case 'naive_bayes':
        return {
          alpha: 1.0
        };
      case 'svm':
        return {
          C: 1.0,
          kernel: 'rbf',
          gamma: 'scale'
        };
      case 'neural_network':
        return {
          hiddenLayers: [100, 50],
          learningRate: 0.001,
          maxIter: 200
        };
      default:
        return {};
    }
  }

  private async trainModelWithData(
    model: MLModel,
    features: number[][],
    labels: string[],
    categories: string[]
  ): Promise<MLModel> {
    // Mock training implementation
    // In a real implementation, this would use a proper ML library like TensorFlow.js or scikit-learn

    const trainedModel = { ...model };
    
    trainedModel.trainingData = {
      totalSamples: features.length,
      trainingSamples: features.length,
      testingSamples: 0,
      validationSamples: 0,
      categories,
      features: this.features.map(f => f.name),
      lastUpdated: new Date().toISOString()
    };

    // Mock training process
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate training time

    return trainedModel;
  }

  private async evaluateModel(
    model: MLModel,
    testFeatures: number[][],
    testLabels: string[],
    categories: string[]
  ): Promise<MLPerformance> {
    // Mock evaluation - in real implementation, would use actual predictions
    const predictions = testLabels.map(() => categories[Math.floor(Math.random() * categories.length)]);
    
    const correct = predictions.filter((pred, i) => pred === testLabels[i]).length;
    const accuracy = testLabels.length > 0 ? correct / testLabels.length : 0;

    // Create confusion matrix
    const confusionMatrix = this.createConfusionMatrix(testLabels, predictions, categories);
    
    // Calculate per-class metrics
    const classificationReport: ClassificationReport = {};
    categories.forEach(category => {
      const metrics = this.calculateClassMetrics(testLabels, predictions, category);
      classificationReport[category] = metrics;
    });

    return {
      accuracy,
      precision: accuracy, // Simplified
      recall: accuracy,
      f1Score: accuracy,
      confusionMatrix,
      classificationReport,
      crossValidationScores: [accuracy] // Single fold for simplicity
    };
  }

  private createConfusionMatrix(actual: string[], predicted: string[], categories: string[]): number[][] {
    const matrix = categories.map(() => new Array(categories.length).fill(0));
    
    for (let i = 0; i < actual.length; i++) {
      const actualIndex = categories.indexOf(actual[i]);
      const predictedIndex = categories.indexOf(predicted[i]);
      
      if (actualIndex >= 0 && predictedIndex >= 0) {
        matrix[actualIndex][predictedIndex]++;
      }
    }
    
    return matrix;
  }

  private calculateClassMetrics(actual: string[], predicted: string[], category: string): {
    precision: number;
    recall: number;
    f1Score: number;
    support: number;
  } {
    const truePositives = actual.filter((label, i) => label === category && predicted[i] === category).length;
    const falsePositives = predicted.filter((label, i) => label === category && actual[i] !== category).length;
    const falseNegatives = actual.filter((label, i) => label === category && predicted[i] !== category).length;
    const support = actual.filter(label => label === category).length;

    const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
    const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

    return { precision, recall, f1Score, support };
  }

  private async makePrediction(model: MLModel, features: number[]): Promise<MLPrediction[]> {
    // Mock prediction implementation
    const categories = model.trainingData.categories;
    const predictions: MLPrediction[] = [];

    // Generate mock predictions with probabilities
    for (let i = 0; i < Math.min(3, categories.length); i++) {
      const categoryId = categories[i];
      const confidence = Math.random() * 0.5 + 0.5; // Random confidence 0.5-1.0
      
      predictions.push({
        modelId: model.id,
        categoryId,
        confidence,
        features: features.reduce((obj, val, idx) => {
          obj[`feature_${idx}`] = val;
          return obj;
        }, {} as { [key: string]: any }),
        timestamp: new Date().toISOString()
      });
    }

    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  private formatPredictions(predictions: MLPrediction[], transaction: CategorizedTransaction): CategorySuggestion[] {
    return predictions.map(prediction => ({
      categoryId: prediction.categoryId,
      categoryName: prediction.categoryId, // In real implementation, would lookup category name
      confidence: prediction.confidence,
      reasoning: `ML prediction with ${(prediction.confidence * 100).toFixed(1)}% confidence`,
      method: 'ml_classifier' as CategorizationMethod,
      tags: [] // Could include ML-suggested tags
    }));
  }

  private shouldRetrain(model: MLModel, newDataCount: number): boolean {
    const daysSinceLastTrain = model.lastTrainedAt ? 
      (Date.now() - new Date(model.lastTrainedAt).getTime()) / (24 * 60 * 60 * 1000) : 
      Infinity;
    
    return (
      daysSinceLastTrain > 7 || // Weekly retraining
      newDataCount > 100 || // Significant new data
      model.accuracy < 0.7 // Poor performance
    );
  }

  private updateModelStats(model: MLModel, wasCorrect: boolean): void {
    // Update running accuracy
    const currentCorrect = model.performance.correctPredictions || 0;
    const currentTotal = model.performance.totalPredictions || 0;
    
    const newCorrect = wasCorrect ? currentCorrect + 1 : currentCorrect;
    const newTotal = currentTotal + 1;
    
    model.performance.correctPredictions = newCorrect;
    model.performance.totalPredictions = newTotal;
    model.performance.accuracy = newCorrect / newTotal;
    model.accuracy = model.performance.accuracy;
    model.updatedAt = new Date().toISOString();
  }

  /**
   * Export model for backup or sharing
   */
  exportModel(modelId: string): any {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    return {
      model: model,
      features: this.features,
      trainingData: this.trainingData.slice(-1000), // Export last 1000 training samples
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import model from backup
   */
  async importModel(modelData: any): Promise<string> {
    try {
      const model: MLModel = modelData.model;
      const modelId = `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      model.id = modelId;
      model.createdAt = new Date().toISOString();
      model.updatedAt = new Date().toISOString();
      
      this.models.set(modelId, model);
      
      if (modelData.trainingData) {
        this.trainingData.push(...modelData.trainingData);
      }
      
      this.saveModels();
      return modelId;
    } catch (error) {
      throw new Error(`Model import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get feature importance for the active model
   */
  getFeatureImportance(): MLFeature[] {
    const activeModel = this.getActiveModel();
    return activeModel?.features || this.features;
  }

  /**
   * Clear all models and training data
   */
  clearAllData(): void {
    this.models.clear();
    this.activeModelId = null;
    this.trainingData = [];
    this.modelCache.clear();
    
    localStorage.removeItem('ml_models');
    localStorage.removeItem('active_ml_model');
    localStorage.removeItem('ml_training_data');
  }
}

export const mlClassifierService = new MLClassifierService();