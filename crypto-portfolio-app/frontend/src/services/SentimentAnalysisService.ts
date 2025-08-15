import {
  SentimentAnalysisResponse,
  AggregatedSentiment,
  SentimentSource,
  SentimentFilters,
  SentimentHistory,
  SentimentHistoryPoint,
  SentimentInsight,
  SentimentScore,
  SentimentError,
  NewsSentiment,
  NewsHeadline,
  MockSentimentConfig
} from '../types/sentiment.types';

export class SentimentAnalysisService {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly defaultCacheExpiry = 5 * 60 * 1000; // 5 minutes
  private readonly apiBaseUrl = process.env.REACT_APP_SENTIMENT_API_URL || '';
  
  private mockConfig: MockSentimentConfig = {
    volatility: 0.3,
    trend: 0.1,
    cyclePeriod: 14,
    noiseLevel: 0.2
  };

  // Main sentiment analysis endpoint
  async getSentimentAnalysis(
    symbols: string[] = ['BTC'],
    filters: SentimentFilters = {}
  ): Promise<SentimentAnalysisResponse> {
    try {
      const cacheKey = this.generateCacheKey('sentiment', symbols, filters);
      const cached = this.getFromCache(cacheKey);
      
      if (cached) {
        return cached;
      }

      // In production, this would make actual API calls
      // For now, using sophisticated mock data
      const [
        aggregatedSentiment,
        newsSentiment,
        socialSentiment,
        onChainSentiment,
        sentimentHistory
      ] = await Promise.all([
        this.getAggregatedSentiment(symbols, filters),
        this.getNewsSentiment(symbols, filters),
        this.getSocialSentiment(symbols, filters),
        this.getOnChainSentiment(symbols, filters),
        this.getSentimentHistory(symbols, filters.timeframe || '7d')
      ]);

      const response: SentimentAnalysisResponse = {
        aggregatedSentiment,
        fearGreedIndex: await this.getFearGreedIndexData(),
        newsSentiment,
        socialSentiment,
        onChainSentiment,
        sentimentHistory,
        correlations: await this.getSentimentCorrelations(symbols, filters.timeframe || '7d'),
        lastUpdated: new Date().toISOString()
      };

      this.setCache(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error in sentiment analysis:', error);
      throw this.createSentimentError('ANALYSIS_FAILED', 'Failed to analyze sentiment', error);
    }
  }

  // Aggregated sentiment from all sources
  private async getAggregatedSentiment(
    symbols: string[],
    filters: SentimentFilters
  ): Promise<AggregatedSentiment> {
    const sources: SentimentSource[] = [
      {
        name: 'News',
        score: this.generateSentimentScore(),
        confidence: 0.8,
        weight: 0.3,
        lastUpdated: new Date().toISOString()
      },
      {
        name: 'Social Media',
        score: this.generateSentimentScore(),
        confidence: 0.7,
        weight: 0.4,
        lastUpdated: new Date().toISOString()
      },
      {
        name: 'On-Chain',
        score: this.generateSentimentScore(),
        confidence: 0.9,
        weight: 0.3,
        lastUpdated: new Date().toISOString()
      }
    ];

    const weightedScore = sources.reduce((acc, source) => {
      return acc + (source.score * (source.weight || 1) * source.confidence);
    }, 0) / sources.reduce((acc, source) => acc + (source.weight || 1) * source.confidence, 0);

    const confidence = sources.reduce((acc, source) => acc + source.confidence, 0) / sources.length;

    const insights = this.generateSentimentInsights(weightedScore, sources);
    const trend = this.determineTrend(weightedScore);

    return {
      score: weightedScore,
      confidence,
      magnitude: Math.abs(weightedScore),
      sources,
      insights,
      trend,
      volatility: this.calculateVolatility(sources)
    };
  }

  // News sentiment analysis
  private async getNewsSentiment(
    symbols: string[],
    filters: SentimentFilters
  ): Promise<NewsSentiment> {
    const headlines = this.generateMockNewsHeadlines(symbols, 20);
    const sourceBreakdown = this.generateSourceBreakdown();
    
    const overallScore = headlines.reduce((acc, headline) => {
      return acc + headline.sentiment.score * headline.relevance;
    }, 0) / headlines.reduce((acc, headline) => acc + headline.relevance, 0);

    const confidence = headlines.reduce((acc, headline) => {
      return acc + headline.sentiment.confidence;
    }, 0) / headlines.length;

    return {
      score: overallScore,
      confidence,
      magnitude: Math.abs(overallScore),
      articleCount: headlines.length,
      sources: ['CoinDesk', 'Cointelegraph', 'CryptoNews', 'Decrypt', 'The Block'],
      topHeadlines: headlines.slice(0, 10),
      sourceBreakdown
    };
  }

  // Social media sentiment analysis
  private async getSocialSentiment(symbols: string[], filters: SentimentFilters): Promise<any> {
    const twitterSentiment = {
      score: this.generateSentimentScore(),
      confidence: 0.7,
      magnitude: Math.random() * 0.8 + 0.2,
      mentionCount: Math.floor(Math.random() * 5000) + 1000,
      engagementRate: Math.random() * 0.1 + 0.02,
      retweetRatio: Math.random() * 0.3 + 0.1,
      topTweets: this.generateMockTweets(5),
      hashtagSentiment: {
        '#BTC': { score: this.generateSentimentScore(), confidence: 0.8 },
        '#Bitcoin': { score: this.generateSentimentScore(), confidence: 0.9 },
        '#crypto': { score: this.generateSentimentScore(), confidence: 0.7 }
      }
    };

    const redditSentiment = {
      score: this.generateSentimentScore(),
      confidence: 0.8,
      magnitude: Math.random() * 0.7 + 0.3,
      postCount: Math.floor(Math.random() * 2000) + 500,
      commentCount: Math.floor(Math.random() * 10000) + 2000,
      upvoteRatio: Math.random() * 0.4 + 0.6,
      topPosts: this.generateMockRedditPosts(5),
      subredditBreakdown: {
        'r/bitcoin': { score: this.generateSentimentScore(), confidence: 0.9 },
        'r/cryptocurrency': { score: this.generateSentimentScore(), confidence: 0.8 },
        'r/cryptomarkets': { score: this.generateSentimentScore(), confidence: 0.7 }
      }
    };

    const discordSentiment = {
      score: this.generateSentimentScore(),
      confidence: 0.6,
      magnitude: Math.random() * 0.6 + 0.2,
      messageCount: Math.floor(Math.random() * 50000) + 10000,
      serverCount: Math.floor(Math.random() * 100) + 20,
      activeUsers: Math.floor(Math.random() * 10000) + 2000
    };

    const weightedScore = (
      twitterSentiment.score * 0.5 +
      redditSentiment.score * 0.4 +
      discordSentiment.score * 0.1
    );

    const confidence = (
      twitterSentiment.confidence * 0.5 +
      redditSentiment.confidence * 0.4 +
      discordSentiment.confidence * 0.1
    );

    return {
      score: weightedScore,
      confidence,
      magnitude: Math.abs(weightedScore),
      platforms: {
        twitter: twitterSentiment,
        reddit: redditSentiment,
        discord: discordSentiment
      },
      overallMentions: twitterSentiment.mentionCount + redditSentiment.postCount + redditSentiment.commentCount,
      trendingTopics: ['#Bitcoin', '#Crypto', '#BullRun', '#HODL', '#DeFi'],
      influencerSentiment: this.generateInfluencerSentiment()
    };
  }

  // On-chain sentiment analysis
  private async getOnChainSentiment(symbols: string[], filters: SentimentFilters): Promise<any> {
    const metrics = {
      activeAddresses: Math.floor(Math.random() * 500000) + 300000,
      activeAddressesTrend: (Math.random() - 0.5) * 0.2,
      transactionVolume: Math.floor(Math.random() * 1000000) + 500000,
      transactionVolumeUSD: Math.floor(Math.random() * 50000000000) + 10000000000,
      averageTransactionFee: Math.random() * 50 + 5,
      mvrv: Math.random() * 3 + 0.5,
      nvt: Math.random() * 200 + 50,
      hodlWaves: this.generateHodlWaves()
    };

    const indicators = [
      {
        name: 'MVRV Ratio',
        value: metrics.mvrv,
        signal: metrics.mvrv > 2.5 ? 'bearish' : metrics.mvrv < 1 ? 'bullish' : 'neutral',
        strength: Math.min(Math.abs(metrics.mvrv - 1.5) / 1.5, 1),
        description: 'Market Value to Realized Value ratio indicates if asset is over/undervalued'
      },
      {
        name: 'Network Value to Transactions',
        value: metrics.nvt,
        signal: metrics.nvt > 150 ? 'bearish' : metrics.nvt < 75 ? 'bullish' : 'neutral',
        strength: Math.min(Math.abs(metrics.nvt - 100) / 100, 1),
        description: 'High NVT suggests network is overvalued relative to transaction volume'
      },
      {
        name: 'Active Addresses Trend',
        value: metrics.activeAddressesTrend,
        signal: metrics.activeAddressesTrend > 0.05 ? 'bullish' : metrics.activeAddressesTrend < -0.05 ? 'bearish' : 'neutral',
        strength: Math.abs(metrics.activeAddressesTrend) * 5,
        description: 'Growing active addresses indicates increasing network adoption'
      }
    ];

    const whaleActivity = {
      largeTransactions: Math.floor(Math.random() * 500) + 100,
      whaleNetFlow: (Math.random() - 0.5) * 10000,
      topHolderConcentration: Math.random() * 0.3 + 0.4,
      accumulationTrend: (Math.random() - 0.5) * 0.1,
      distributionTrend: (Math.random() - 0.5) * 0.1
    };

    const exchangeFlows = {
      inflow: Math.random() * 50000,
      outflow: Math.random() * 55000,
      netFlow: 0,
      inflowTrend: (Math.random() - 0.5) * 0.2,
      outflowTrend: (Math.random() - 0.5) * 0.2,
      exchangeReserves: Math.random() * 3000000,
      reservesTrend: (Math.random() - 0.5) * 0.1
    };
    exchangeFlows.netFlow = exchangeFlows.outflow - exchangeFlows.inflow;

    const networkHealth = {
      hashRate: Math.random() * 500000000000000000,
      difficulty: Math.random() * 50000000000000,
      blockTime: Math.random() * 2 + 9,
      mempool: Math.floor(Math.random() * 100000) + 5000,
      feesPressure: Math.random() * 100
    };

    // Calculate overall on-chain sentiment
    let sentimentScore = 0;
    let factorCount = 0;

    // Exchange flow sentiment (outflow is bullish)
    if (exchangeFlows.netFlow > 0) {
      sentimentScore += 0.2;
    } else {
      sentimentScore -= 0.1;
    }
    factorCount++;

    // Whale accumulation sentiment
    if (whaleActivity.accumulationTrend > 0) {
      sentimentScore += 0.15;
    } else if (whaleActivity.distributionTrend > 0) {
      sentimentScore -= 0.15;
    }
    factorCount++;

    // Active addresses sentiment
    if (metrics.activeAddressesTrend > 0) {
      sentimentScore += 0.1;
    } else {
      sentimentScore -= 0.1;
    }
    factorCount++;

    // MVRV sentiment
    if (metrics.mvrv < 1) {
      sentimentScore += 0.2; // Undervalued
    } else if (metrics.mvrv > 2.5) {
      sentimentScore -= 0.2; // Overvalued
    }
    factorCount++;

    const finalScore = Math.max(-1, Math.min(1, sentimentScore / factorCount));

    return {
      score: finalScore,
      confidence: 0.85,
      magnitude: Math.abs(finalScore),
      metrics,
      indicators,
      whaleActivity,
      exchangeFlows,
      networkHealth
    };
  }

  // Get historical sentiment data
  private async getSentimentHistory(
    symbols: string[],
    timeframe: string
  ): Promise<SentimentHistory> {
    const days = this.getTimeframeDays(timeframe);
    const data: SentimentHistoryPoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Generate correlated sentiment and price data
      const sentiment = this.generateHistoricalSentiment(i, days);
      const fearGreed = Math.max(0, Math.min(100, (sentiment + 1) * 50 + (Math.random() - 0.5) * 20));
      
      data.push({
        date: date.toISOString(),
        sentiment,
        fearGreed,
        volume: Math.random() * 10000000000 + 1000000000,
        price: 50000 + sentiment * 10000 + (Math.random() - 0.5) * 5000,
        sources: {
          news: sentiment + (Math.random() - 0.5) * 0.3,
          social: sentiment + (Math.random() - 0.5) * 0.4,
          onChain: sentiment + (Math.random() - 0.5) * 0.2
        }
      });
    }

    return {
      data,
      timeframe,
      symbol: symbols[0],
      correlations: {
        priceCorrelation: 0.7 + Math.random() * 0.25,
        volumeCorrelation: 0.4 + Math.random() * 0.3
      }
    };
  }

  // Get Fear & Greed Index data
  private async getFearGreedIndexData(): Promise<any> {
    const value = Math.floor(Math.random() * 100);
    
    let label: string;
    if (value <= 25) label = 'Extreme Fear';
    else if (value <= 45) label = 'Fear';
    else if (value <= 55) label = 'Neutral';
    else if (value <= 75) label = 'Greed';
    else label = 'Extreme Greed';

    const components = [
      { name: 'Volatility', value: Math.random() * 100, weight: 25, description: 'Measuring current volatility' },
      { name: 'Market Momentum/Volume', value: Math.random() * 100, weight: 25, description: 'Volume and momentum data' },
      { name: 'Social Media', value: Math.random() * 100, weight: 15, description: 'Social media sentiment analysis' },
      { name: 'Dominance', value: Math.random() * 100, weight: 10, description: 'Bitcoin dominance over altcoins' },
      { name: 'Trends', value: Math.random() * 100, weight: 10, description: 'Google Trends data' },
      { name: 'Surveys', value: Math.random() * 100, weight: 15, description: 'Public polling data' }
    ];

    return {
      value,
      label,
      components,
      lastUpdated: new Date().toISOString(),
      trend: (Math.random() - 0.5) * 10,
      historicalAverage: 45 + Math.random() * 20
    };
  }

  // Get sentiment correlations with price
  private async getSentimentCorrelations(symbols: string[], timeframe: string): Promise<any> {
    return {
      symbol: symbols[0],
      timeframe,
      correlations: {
        sentimentToPrice: {
          coefficient: 0.65 + Math.random() * 0.25,
          significance: Math.random() * 0.05,
          strength: 'moderate',
          direction: 'positive',
          lag: Math.floor(Math.random() * 3)
        },
        sentimentToVolume: {
          coefficient: 0.45 + Math.random() * 0.3,
          significance: Math.random() * 0.1,
          strength: 'moderate',
          direction: 'positive'
        },
        fearGreedToPrice: {
          coefficient: 0.55 + Math.random() * 0.3,
          significance: Math.random() * 0.05,
          strength: 'moderate',
          direction: 'positive'
        },
        socialToPrice: {
          coefficient: 0.4 + Math.random() * 0.35,
          significance: Math.random() * 0.1,
          strength: 'weak',
          direction: 'positive'
        },
        onChainToPrice: {
          coefficient: 0.7 + Math.random() * 0.25,
          significance: Math.random() * 0.02,
          strength: 'strong',
          direction: 'positive'
        }
      },
      predictivePower: 0.6 + Math.random() * 0.25,
      laggingIndicators: ['Social Media', 'News'],
      leadingIndicators: ['On-Chain', 'Exchange Flows']
    };
  }

  // Utility methods
  private generateSentimentScore(): number {
    const trend = this.mockConfig.trend;
    const volatility = this.mockConfig.volatility;
    const noise = this.mockConfig.noiseLevel;
    
    return Math.max(-1, Math.min(1, trend + (Math.random() - 0.5) * volatility + (Math.random() - 0.5) * noise));
  }

  private generateHistoricalSentiment(dayIndex: number, totalDays: number): number {
    const cycle = Math.sin((dayIndex / this.mockConfig.cyclePeriod) * 2 * Math.PI) * 0.3;
    const trend = this.mockConfig.trend * (dayIndex / totalDays);
    const noise = (Math.random() - 0.5) * this.mockConfig.noiseLevel;
    
    return Math.max(-1, Math.min(1, cycle + trend + noise));
  }

  private generateSentimentInsights(score: number, sources: SentimentSource[]): SentimentInsight[] {
    const insights: SentimentInsight[] = [];

    if (score > 0.5) {
      insights.push({
        icon: '🚀',
        text: 'Strong bullish sentiment across multiple sources',
        impact: 'high',
        type: 'positive',
        confidence: 0.8
      });
    } else if (score < -0.5) {
      insights.push({
        icon: '📉',
        text: 'Bearish sentiment dominating market psychology',
        impact: 'high',
        type: 'negative',
        confidence: 0.8
      });
    }

    // Source-specific insights
    sources.forEach(source => {
      if (Math.abs(source.score) > 0.6) {
        insights.push({
          icon: source.score > 0 ? '📈' : '📉',
          text: `${source.name} showing ${source.score > 0 ? 'strong bullish' : 'strong bearish'} signals`,
          impact: source.confidence > 0.8 ? 'high' : 'medium',
          type: source.score > 0 ? 'positive' : 'negative',
          source: source.name,
          confidence: source.confidence
        });
      }
    });

    return insights;
  }

  private determineTrend(score: number): 'bullish' | 'bearish' | 'neutral' {
    if (score > 0.2) return 'bullish';
    if (score < -0.2) return 'bearish';
    return 'neutral';
  }

  private calculateVolatility(sources: SentimentSource[]): number {
    const scores = sources.map(s => s.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) / scores.length;
    return Math.sqrt(variance);
  }

  private generateMockNewsHeadlines(symbols: string[], count: number): NewsHeadline[] {
    const headlines = [];
    const sources = ['CoinDesk', 'Cointelegraph', 'CryptoNews', 'Decrypt', 'The Block'];
    const templates = [
      '{symbol} Price Analysis: Bulls Target ${price}',
      'Technical Analysis: {symbol} Shows {sentiment} Signals',
      'Market Update: {symbol} {action} Amid {context}',
      'Breaking: {symbol} {event} Sparks {reaction}',
      'Analysis: {symbol} Could {prediction} if {condition}'
    ];

    for (let i = 0; i < count; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const template = templates[Math.floor(Math.random() * templates.length)];
      const sentiment = this.generateSentimentScore();
      
      headlines.push({
        title: this.fillTemplate(template, symbol, sentiment),
        source: sources[Math.floor(Math.random() * sources.length)],
        url: `https://example.com/news/${i}`,
        publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: {
          score: sentiment,
          confidence: 0.7 + Math.random() * 0.3
        },
        relevance: 0.5 + Math.random() * 0.5,
        summary: 'Article summary would be extracted here...'
      });
    }

    return headlines;
  }

  private fillTemplate(template: string, symbol: string, sentiment: number): string {
    const replacements: Record<string, string> = {
      '{symbol}': symbol,
      '{price}': (50000 + Math.random() * 20000).toFixed(0),
      '{sentiment}': sentiment > 0 ? 'Bullish' : 'Bearish',
      '{action}': sentiment > 0 ? 'Rallies' : 'Declines',
      '{context}': sentiment > 0 ? 'Positive Market Sentiment' : 'Market Uncertainty',
      '{event}': Math.random() > 0.5 ? 'Technical Breakout' : 'Institutional News',
      '{reaction}': sentiment > 0 ? 'Investor Optimism' : 'Market Concern',
      '{prediction}': sentiment > 0 ? 'Rally Further' : 'Face Pressure',
      '{condition}': 'Key Support Holds'
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(key, value);
    }
    return result;
  }

  private generateSourceBreakdown(): Record<string, SentimentScore> {
    return {
      'CoinDesk': { score: this.generateSentimentScore(), confidence: 0.9 },
      'Cointelegraph': { score: this.generateSentimentScore(), confidence: 0.8 },
      'CryptoNews': { score: this.generateSentimentScore(), confidence: 0.7 },
      'Decrypt': { score: this.generateSentimentScore(), confidence: 0.8 },
      'The Block': { score: this.generateSentimentScore(), confidence: 0.85 }
    };
  }

  private generateMockTweets(count: number): any[] {
    const tweets = [];
    const authors = ['CryptoAnalyst', 'BTCMaximalist', 'TraderJoe', 'CoinGuru', 'CryptoQueen'];
    
    for (let i = 0; i < count; i++) {
      const sentiment = this.generateSentimentScore();
      tweets.push({
        id: `tweet_${i}`,
        text: sentiment > 0 ? 'Bitcoin looking strong! 🚀' : 'Bearish signals in the market 📉',
        author: authors[Math.floor(Math.random() * authors.length)],
        authorFollowers: Math.floor(Math.random() * 100000) + 10000,
        createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: { score: sentiment, confidence: 0.7 },
        engagement: {
          likes: Math.floor(Math.random() * 1000),
          retweets: Math.floor(Math.random() * 500),
          replies: Math.floor(Math.random() * 100)
        }
      });
    }
    
    return tweets;
  }

  private generateMockRedditPosts(count: number): any[] {
    const posts = [];
    const subreddits = ['bitcoin', 'cryptocurrency', 'cryptomarkets'];
    
    for (let i = 0; i < count; i++) {
      const sentiment = this.generateSentimentScore();
      posts.push({
        id: `post_${i}`,
        title: sentiment > 0 ? 'BTC to the moon!' : 'Market correction incoming?',
        subreddit: subreddits[Math.floor(Math.random() * subreddits.length)],
        author: `user_${i}`,
        createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        sentiment: { score: sentiment, confidence: 0.8 },
        engagement: {
          upvotes: Math.floor(Math.random() * 1000),
          downvotes: Math.floor(Math.random() * 100),
          comments: Math.floor(Math.random() * 200),
          awards: Math.floor(Math.random() * 10)
        }
      });
    }
    
    return posts;
  }

  private generateInfluencerSentiment(): any[] {
    const influencers = [
      { name: 'PlanB', platform: 'Twitter', followers: 1500000 },
      { name: 'Willy Woo', platform: 'Twitter', followers: 800000 },
      { name: 'Preston Pysh', platform: 'Twitter', followers: 600000 }
    ];

    return influencers.map(influencer => ({
      ...influencer,
      sentiment: { score: this.generateSentimentScore(), confidence: 0.8 },
      influence: Math.random() * 0.5 + 0.5,
      recentPosts: Math.floor(Math.random() * 10) + 1
    }));
  }

  private generateHodlWaves(): any[] {
    return [
      { ageRange: '1d-1w', percentage: 15 + Math.random() * 10, trend: (Math.random() - 0.5) * 0.1 },
      { ageRange: '1w-1m', percentage: 20 + Math.random() * 10, trend: (Math.random() - 0.5) * 0.1 },
      { ageRange: '1m-3m', percentage: 15 + Math.random() * 10, trend: (Math.random() - 0.5) * 0.1 },
      { ageRange: '3m-6m', percentage: 12 + Math.random() * 8, trend: (Math.random() - 0.5) * 0.1 },
      { ageRange: '6m-1y', percentage: 10 + Math.random() * 8, trend: (Math.random() - 0.5) * 0.1 },
      { ageRange: '1y-2y', percentage: 15 + Math.random() * 10, trend: (Math.random() - 0.5) * 0.1 },
      { ageRange: '2y+', percentage: 13 + Math.random() * 12, trend: (Math.random() - 0.5) * 0.1 }
    ];
  }

  private getTimeframeDays(timeframe: string): number {
    switch (timeframe) {
      case '1h': return 1;
      case '4h': return 1;
      case '1d': return 7;
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      default: return 7;
    }
  }

  private generateCacheKey(type: string, symbols: string[], filters: any): string {
    return `${type}-${symbols.join(',')}-${JSON.stringify(filters)}`;
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any, ttl: number = this.defaultCacheExpiry): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private createSentimentError(code: string, message: string, originalError?: any): SentimentError {
    return {
      code,
      message,
      source: 'SentimentAnalysisService',
      timestamp: new Date().toISOString(),
      retryAfter: 60000 // 1 minute
    };
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
}

export const sentimentAnalysisService = new SentimentAnalysisService();