import { SentimentAnalysis } from '../types/news.types';

export class SentimentAnalysisService {
  private baseURL: string;
  private cache = new Map<string, { result: SentimentAnalysis; timestamp: number }>();

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
  }

  async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    const cacheKey = this.getCacheKey(text);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // In production, this would call a real sentiment analysis API
      // For now, we'll use a sophisticated mock implementation
      const sentiment = this.mockSentimentAnalysis(text);
      
      this.setCache(cacheKey, sentiment);
      return sentiment;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      
      // Return neutral sentiment on error
      return {
        score: 0,
        label: 'neutral',
        confidence: 0,
        keywords: []
      };
    }
  }

  async batchAnalyzeSentiment(texts: string[]): Promise<SentimentAnalysis[]> {
    const results = await Promise.all(
      texts.map(text => this.analyzeSentiment(text))
    );
    return results;
  }

  private mockSentimentAnalysis(text: string): SentimentAnalysis {
    const lowerText = text.toLowerCase();
    
    // Define sentiment keywords and their weights
    const positiveKeywords = {
      // Strong positive
      'bullish': 0.8, 'surge': 0.7, 'rally': 0.7, 'moon': 0.9, 'pump': 0.6,
      'breakthrough': 0.7, 'milestone': 0.6, 'adoption': 0.6, 'partnership': 0.5,
      'upgrade': 0.5, 'innovation': 0.6, 'growth': 0.5, 'success': 0.6,
      'profit': 0.7, 'gains': 0.6, 'rise': 0.4, 'increase': 0.4, 'buy': 0.3,
      'bullrun': 0.8, 'ath': 0.7, 'record': 0.5, 'high': 0.3, 'up': 0.2,
      'positive': 0.5, 'good': 0.3, 'great': 0.5, 'excellent': 0.7,
      'amazing': 0.6, 'outstanding': 0.7, 'impressive': 0.6, 'strong': 0.4,
      'solid': 0.4, 'stable': 0.3, 'secure': 0.4, 'promising': 0.5,
      'opportunity': 0.4, 'potential': 0.3, 'optimistic': 0.6, 'confident': 0.5
    };

    const negativeKeywords = {
      // Strong negative
      'bearish': -0.8, 'crash': -0.8, 'dump': -0.7, 'collapse': -0.9,
      'hack': -0.8, 'scam': -0.9, 'fraud': -0.9, 'ponzi': -0.9,
      'bubble': -0.6, 'overvalued': -0.5, 'risk': -0.4, 'danger': -0.6,
      'warning': -0.5, 'concern': -0.4, 'problem': -0.4, 'issue': -0.3,
      'fall': -0.4, 'drop': -0.4, 'decline': -0.4, 'decrease': -0.4,
      'loss': -0.6, 'losses': -0.6, 'sell': -0.3, 'bear': -0.5,
      'down': -0.2, 'low': -0.3, 'weak': -0.4, 'poor': -0.5,
      'bad': -0.4, 'terrible': -0.7, 'awful': -0.7, 'disappointing': -0.5,
      'concerning': -0.4, 'worried': -0.5, 'fear': -0.6, 'panic': -0.7,
      'uncertainty': -0.4, 'volatile': -0.3, 'unstable': -0.4, 'risky': -0.4
    };

    const neutralKeywords = {
      'stable': 0, 'sideways': 0, 'consolidation': 0, 'range': 0,
      'analysis': 0, 'report': 0, 'data': 0, 'news': 0, 'update': 0
    };

    // Calculate base sentiment score
    let score = 0;
    let totalWeight = 0;
    const foundKeywords: string[] = [];
    const emotions = { fear: 0, greed: 0, optimism: 0, uncertainty: 0 };

    // Check positive keywords
    for (const [keyword, weight] of Object.entries(positiveKeywords)) {
      if (lowerText.includes(keyword)) {
        score += weight;
        totalWeight += Math.abs(weight);
        foundKeywords.push(keyword);
        
        // Update emotions
        if (['moon', 'pump', 'bullrun', 'gains', 'profit'].includes(keyword)) {
          emotions.greed += weight * 0.5;
        }
        if (['breakthrough', 'innovation', 'growth', 'promising'].includes(keyword)) {
          emotions.optimism += weight * 0.7;
        }
      }
    }

    // Check negative keywords
    for (const [keyword, weight] of Object.entries(negativeKeywords)) {
      if (lowerText.includes(keyword)) {
        score += weight;
        totalWeight += Math.abs(weight);
        foundKeywords.push(keyword);
        
        // Update emotions
        if (['crash', 'dump', 'hack', 'scam', 'panic'].includes(keyword)) {
          emotions.fear += Math.abs(weight) * 0.8;
        }
        if (['risk', 'uncertainty', 'concern', 'warning'].includes(keyword)) {
          emotions.uncertainty += Math.abs(weight) * 0.6;
        }
      }
    }

    // Normalize score
    if (totalWeight > 0) {
      score = score / totalWeight;
    }

    // Apply text length penalty/bonus
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 10) {
      score *= 0.7; // Reduce confidence for very short texts
    } else if (wordCount > 100) {
      score *= 1.1; // Slight boost for longer, more detailed texts
    }

    // Clamp score to [-1, 1]
    score = Math.max(-1, Math.min(1, score));

    // Determine label
    let label: 'positive' | 'negative' | 'neutral';
    if (score > 0.1) {
      label = 'positive';
    } else if (score < -0.1) {
      label = 'negative';
    } else {
      label = 'neutral';
    }

    // Calculate confidence based on keyword matches and score extremity
    let confidence = Math.min(0.9, foundKeywords.length * 0.15 + Math.abs(score) * 0.5);
    if (foundKeywords.length === 0) {
      confidence = 0.3; // Low confidence for texts with no sentiment keywords
    }

    // Normalize emotions to [0, 1] range
    const maxEmotion = Math.max(emotions.fear, emotions.greed, emotions.optimism, emotions.uncertainty);
    if (maxEmotion > 0) {
      emotions.fear = Math.min(1, emotions.fear / maxEmotion);
      emotions.greed = Math.min(1, emotions.greed / maxEmotion);
      emotions.optimism = Math.min(1, emotions.optimism / maxEmotion);
      emotions.uncertainty = Math.min(1, emotions.uncertainty / maxEmotion);
    }

    return {
      score: Number(score.toFixed(3)),
      label,
      confidence: Number(confidence.toFixed(2)),
      keywords: foundKeywords.slice(0, 5), // Return top 5 keywords
      emotions
    };
  }

  async getSentimentTrends(timeframe: string = '24h'): Promise<SentimentAnalysis[]> {
    // Mock implementation - in production, this would query historical sentiment data
    const trends: SentimentAnalysis[] = [];
    const intervals = this.getTimeframeIntervals(timeframe);
    
    for (let i = 0; i < intervals; i++) {
      // Generate mock trend data with some randomness but realistic patterns
      const baseScore = Math.sin(i * 0.5) * 0.3; // Create wave pattern
      const noise = (Math.random() - 0.5) * 0.2; // Add some randomness
      const score = Math.max(-1, Math.min(1, baseScore + noise));
      
      trends.push({
        score: Number(score.toFixed(3)),
        label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
        confidence: 0.7 + Math.random() * 0.2, // Random confidence between 0.7-0.9
        keywords: []
      });
    }
    
    return trends;
  }

  async getMarketSentimentMetrics(): Promise<{
    overall: SentimentAnalysis;
    byCategory: Record<string, SentimentAnalysis>;
    trendingEmotions: { emotion: string; score: number; change: number }[];
  }> {
    // Mock implementation for overall market sentiment
    const overall = await this.analyzeSentiment(
      'Bitcoin adoption grows as institutions show bullish sentiment despite market volatility and regulatory concerns'
    );

    const byCategory = {
      'bitcoin': await this.analyzeSentiment('Bitcoin reaches new highs with institutional adoption'),
      'ethereum': await this.analyzeSentiment('Ethereum staking rewards increase network security'),
      'defi': await this.analyzeSentiment('DeFi protocols face liquidity concerns amid market uncertainty'),
      'regulation': await this.analyzeSentiment('Regulatory framework development shows mixed signals'),
      'adoption': await this.analyzeSentiment('Corporate treasury adoption of crypto accelerates growth')
    };

    const trendingEmotions = [
      { emotion: 'optimism', score: 0.65, change: 0.12 },
      { emotion: 'greed', score: 0.58, change: -0.08 },
      { emotion: 'fear', score: 0.32, change: -0.15 },
      { emotion: 'uncertainty', score: 0.45, change: 0.05 }
    ];

    return { overall, byCategory, trendingEmotions };
  }

  private getTimeframeIntervals(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 12; // 5-minute intervals
      case '6h': return 24; // 15-minute intervals
      case '24h': return 24; // 1-hour intervals
      case '7d': return 168; // 1-hour intervals
      case '30d': return 30; // 1-day intervals
      default: return 24;
    }
  }

  private getCacheKey(text: string): string {
    // Create a hash-like key from the text
    return text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
  }

  private getFromCache(key: string): SentimentAnalysis | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Cache expires after 1 hour
    if (Date.now() - cached.timestamp > 60 * 60 * 1000) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  private setCache(key: string, result: SentimentAnalysis): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });

    // Clean up old cache entries if cache gets too large
    if (this.cache.size > 1000) {
      const oldestEntries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 200);
      
      oldestEntries.forEach(([key]) => this.cache.delete(key));
    }
  }

  // Utility methods for external use
  public static getSentimentColor(sentiment: SentimentAnalysis): string {
    if (sentiment.label === 'positive') {
      return sentiment.score > 0.5 ? '#22c55e' : '#65a30d'; // Strong green or light green
    } else if (sentiment.label === 'negative') {
      return sentiment.score < -0.5 ? '#dc2626' : '#ea580c'; // Strong red or orange-red
    }
    return '#6b7280'; // Neutral gray
  }

  public static getSentimentIcon(sentiment: SentimentAnalysis): string {
    if (sentiment.label === 'positive') {
      return sentiment.score > 0.5 ? '📈' : '👍';
    } else if (sentiment.label === 'negative') {
      return sentiment.score < -0.5 ? '📉' : '👎';
    }
    return '➖';
  }

  public static formatSentimentScore(score: number): string {
    const percentage = Math.round(Math.abs(score) * 100);
    const direction = score > 0 ? '+' : score < 0 ? '-' : '';
    return `${direction}${percentage}%`;
  }
}

export const sentimentAnalysisService = new SentimentAnalysisService();
export default SentimentAnalysisService;