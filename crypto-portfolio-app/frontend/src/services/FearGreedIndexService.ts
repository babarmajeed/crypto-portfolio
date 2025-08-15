import { FearGreedIndex, FearGreedComponent } from '../types/sentiment.types';

export class FearGreedIndexService {
  private cache = new Map<string, { data: FearGreedIndex; timestamp: number; ttl: number }>();
  private readonly cacheExpiry = 10 * 60 * 1000; // 10 minutes
  private readonly apiBaseUrl = process.env.REACT_APP_FEAR_GREED_API_URL || '';

  // Main Fear & Greed Index endpoint
  async getFearGreedIndex(): Promise<FearGreedIndex> {
    try {
      const cacheKey = 'fear-greed-current';
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        return cached;
      }

      // In production, this would call the actual Fear & Greed Index API
      // For now, using sophisticated mock data with realistic components
      const index = this.generateRealisticFearGreedIndex();
      
      this.setCache(cacheKey, index);
      return index;
    } catch (error) {
      console.error('Error fetching Fear & Greed Index:', error);
      throw new Error('Failed to fetch Fear & Greed Index');
    }
  }

  // Get historical Fear & Greed Index data
  async getFearGreedHistory(days: number = 30): Promise<{ date: string; value: number; label: string }[]> {
    try {
      const cacheKey = `fear-greed-history-${days}`;
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        return cached as any;
      }

      const history = this.generateFearGreedHistory(days);
      this.setCache(cacheKey, history as any, this.cacheExpiry * 2); // Cache longer for historical data
      
      return history;
    } catch (error) {
      console.error('Error fetching Fear & Greed history:', error);
      throw new Error('Failed to fetch Fear & Greed history');
    }
  }

  // Calculate custom Fear & Greed Index with specific weights
  async calculateCustomIndex(customWeights: Record<string, number>): Promise<FearGreedIndex> {
    try {
      const baseComponents = await this.getIndexComponents();
      
      // Apply custom weights
      const customComponents = baseComponents.map(component => ({
        ...component,
        weight: customWeights[component.name] || component.weight
      }));

      // Recalculate index value with custom weights
      const totalWeight = customComponents.reduce((sum, comp) => sum + comp.weight, 0);
      const weightedValue = customComponents.reduce((sum, comp) => {
        return sum + (comp.value * comp.weight / totalWeight);
      }, 0);

      const label = this.getIndexLabel(weightedValue);

      return {
        value: Math.round(weightedValue),
        label,
        components: customComponents,
        lastUpdated: new Date().toISOString(),
        trend: (Math.random() - 0.5) * 10,
        historicalAverage: 45 + Math.random() * 20
      };
    } catch (error) {
      console.error('Error calculating custom index:', error);
      throw new Error('Failed to calculate custom Fear & Greed Index');
    }
  }

  // Get detailed component analysis
  async getComponentAnalysis(): Promise<{
    components: FearGreedComponent[];
    correlations: Record<string, number>;
    impacts: Record<string, 'high' | 'medium' | 'low'>;
  }> {
    try {
      const components = await this.getIndexComponents();
      
      // Generate correlation data with price movements
      const correlations: Record<string, number> = {};
      const impacts: Record<string, 'high' | 'medium' | 'low'> = {};
      
      components.forEach(component => {
        correlations[component.name] = 0.3 + Math.random() * 0.6; // 0.3 to 0.9
        
        if (component.weight >= 20) {
          impacts[component.name] = 'high';
        } else if (component.weight >= 10) {
          impacts[component.name] = 'medium';
        } else {
          impacts[component.name] = 'low';
        }
      });

      return {
        components,
        correlations,
        impacts
      };
    } catch (error) {
      console.error('Error getting component analysis:', error);
      throw new Error('Failed to get component analysis');
    }
  }

  // Compare current index with historical averages
  async getIndexComparison(): Promise<{
    current: number;
    averages: {
      week: number;
      month: number;
      quarter: number;
      year: number;
    };
    percentiles: {
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
    };
  }> {
    try {
      const current = await this.getFearGreedIndex();
      const history = await this.getFearGreedHistory(365); // Full year
      
      const values = history.map(h => h.value);
      const sortedValues = [...values].sort((a, b) => a - b);
      
      return {
        current: current.value,
        averages: {
          week: this.calculateAverage(values.slice(-7)),
          month: this.calculateAverage(values.slice(-30)),
          quarter: this.calculateAverage(values.slice(-90)),
          year: this.calculateAverage(values)
        },
        percentiles: {
          p10: this.getPercentile(sortedValues, 0.1),
          p25: this.getPercentile(sortedValues, 0.25),
          p50: this.getPercentile(sortedValues, 0.5),
          p75: this.getPercentile(sortedValues, 0.75),
          p90: this.getPercentile(sortedValues, 0.9)
        }
      };
    } catch (error) {
      console.error('Error getting index comparison:', error);
      throw new Error('Failed to get index comparison');
    }
  }

  // Generate realistic Fear & Greed Index
  private generateRealisticFearGreedIndex(): FearGreedIndex {
    const components = this.getBaseComponents();
    
    // Calculate weighted value
    const totalWeight = components.reduce((sum, comp) => sum + comp.weight, 0);
    const weightedValue = components.reduce((sum, comp) => {
      return sum + (comp.value * comp.weight / totalWeight);
    }, 0);

    const value = Math.round(weightedValue);
    const label = this.getIndexLabel(value);

    return {
      value,
      label,
      components,
      lastUpdated: new Date().toISOString(),
      trend: (Math.random() - 0.5) * 10,
      historicalAverage: 45 + Math.random() * 20
    };
  }

  // Get base components with realistic market-influenced values
  private getBaseComponents(): FearGreedComponent[] {
    // Generate correlated values that make sense together
    const marketSentiment = Math.random(); // 0 = extreme fear, 1 = extreme greed
    const volatilityFactor = Math.random() * 0.4 + 0.3; // 0.3 to 0.7
    
    return [
      {
        name: 'Volatility',
        value: Math.round((1 - volatilityFactor) * 100), // Lower volatility = higher greed
        weight: 25,
        description: 'Measuring current volatility against averages',
        trend: (Math.random() - 0.5) * 20
      },
      {
        name: 'Market Momentum/Volume',
        value: Math.round((marketSentiment * 0.8 + 0.1) * 100),
        weight: 25,
        description: 'Current volume vs average volume',
        trend: (Math.random() - 0.5) * 15
      },
      {
        name: 'Social Media',
        value: Math.round((marketSentiment * 0.7 + Math.random() * 0.3) * 100),
        weight: 15,
        description: 'Social media sentiment analysis',
        trend: (Math.random() - 0.5) * 25
      },
      {
        name: 'Dominance',
        value: Math.round((0.5 + (marketSentiment - 0.5) * 0.4) * 100),
        weight: 10,
        description: 'Bitcoin dominance over altcoins',
        trend: (Math.random() - 0.5) * 10
      },
      {
        name: 'Trends',
        value: Math.round((marketSentiment * 0.6 + Math.random() * 0.4) * 100),
        weight: 10,
        description: 'Google Trends data for crypto searches',
        trend: (Math.random() - 0.5) * 30
      },
      {
        name: 'Surveys',
        value: Math.round((marketSentiment * 0.8 + Math.random() * 0.2) * 100),
        weight: 15,
        description: 'Strawpoll sentiment surveys',
        trend: (Math.random() - 0.5) * 20
      }
    ];
  }

  // Get index components (for external use)
  private async getIndexComponents(): Promise<FearGreedComponent[]> {
    return this.getBaseComponents();
  }

  // Generate historical data with realistic patterns
  private generateFearGreedHistory(days: number): { date: string; value: number; label: string }[] {
    const history = [];
    let currentValue = 50 + (Math.random() - 0.5) * 40; // Start around neutral
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Add trend and volatility
      const trend = (Math.random() - 0.5) * 2; // Daily trend
      const volatility = Math.random() * 5; // Daily volatility
      const meanReversion = (50 - currentValue) * 0.02; // Slight mean reversion
      
      currentValue += trend + (Math.random() - 0.5) * volatility + meanReversion;
      currentValue = Math.max(0, Math.min(100, currentValue)); // Clamp to 0-100
      
      const value = Math.round(currentValue);
      const label = this.getIndexLabel(value);
      
      history.push({
        date: date.toISOString().split('T')[0],
        value,
        label
      });
    }
    
    return history;
  }

  // Get label for index value
  private getIndexLabel(value: number): FearGreedIndex['label'] {
    if (value <= 25) return 'Extreme Fear';
    if (value <= 45) return 'Fear';
    if (value <= 55) return 'Neutral';
    if (value <= 75) return 'Greed';
    return 'Extreme Greed';
  }

  // Utility functions
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, val) => sum + val, 0) / values.length);
  }

  private getPercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil(sortedValues.length * percentile) - 1;
    return sortedValues[Math.max(0, index)] || 0;
  }

  // Cache management
  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any, ttl: number = this.cacheExpiry): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // Cleanup old cache entries
  private cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    this.cache.forEach((value, key) => {
      if (now - value.timestamp > value.ttl) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // Market insights based on Fear & Greed levels
  async getMarketInsights(): Promise<{
    level: string;
    description: string;
    recommendations: string[];
    historicalContext: string;
    risk: 'low' | 'medium' | 'high';
  }> {
    try {
      const index = await this.getFearGreedIndex();
      const comparison = await this.getIndexComparison();
      
      let level: string;
      let description: string;
      let recommendations: string[];
      let risk: 'low' | 'medium' | 'high';
      
      if (index.value <= 25) {
        level = 'Extreme Fear';
        description = 'The market is in extreme fear. This often presents buying opportunities for long-term investors.';
        recommendations = [
          'Consider dollar-cost averaging into strong positions',
          'Look for oversold quality assets',
          'Prepare for potential market reversals',
          'Avoid panic selling'
        ];
        risk = 'high';
      } else if (index.value <= 45) {
        level = 'Fear';
        description = 'Fear dominates the market sentiment. Cautious optimism may be warranted.';
        recommendations = [
          'Start building positions gradually',
          'Focus on fundamentally strong assets',
          'Wait for clear trend reversal signals',
          'Maintain defensive positions'
        ];
        risk = 'medium';
      } else if (index.value <= 55) {
        level = 'Neutral';
        description = 'Market sentiment is balanced. No strong directional bias is evident.';
        recommendations = [
          'Maintain current portfolio allocation',
          'Monitor for emerging trends',
          'Consider range trading strategies',
          'Stay disciplined with risk management'
        ];
        risk = 'medium';
      } else if (index.value <= 75) {
        level = 'Greed';
        description = 'Greed is driving market behavior. Consider taking profits and reducing risk.';
        recommendations = [
          'Consider taking partial profits',
          'Tighten stop-loss levels',
          'Reduce position sizes',
          'Prepare for potential pullbacks'
        ];
        risk = 'medium';
      } else {
        level = 'Extreme Greed';
        description = 'Extreme greed dominates. High probability of market correction or consolidation.';
        recommendations = [
          'Take significant profits',
          'Reduce overall market exposure',
          'Prepare cash for future opportunities',
          'Avoid FOMO-driven decisions'
        ];
        risk = 'high';
      }
      
      const percentilePosition = Object.values(comparison.percentiles).findIndex(p => index.value <= p);
      const percentileLabel = ['bottom 10%', 'bottom 25%', 'median', 'top 25%', 'top 10%'][percentilePosition] || 'extreme';
      
      const historicalContext = `Current index is in the ${percentileLabel} of historical values. ` +
        `Monthly average: ${comparison.averages.month}, Yearly average: ${comparison.averages.year}.`;
      
      return {
        level,
        description,
        recommendations,
        historicalContext,
        risk
      };
    } catch (error) {
      console.error('Error getting market insights:', error);
      throw new Error('Failed to get market insights');
    }
  }
}

export const fearGreedIndexService = new FearGreedIndexService();