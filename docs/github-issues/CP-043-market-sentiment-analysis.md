# CP-043: Market Sentiment Analysis Dashboard

## Overview
Create a comprehensive market sentiment analysis system that aggregates sentiment data from news, social media, on-chain metrics, and trading indicators to provide insights into market psychology and potential price movements.

## Objectives
- Aggregate sentiment data from multiple sources (news, social media, on-chain)
- Create sentiment scoring algorithms and visualization
- Implement Fear & Greed Index and custom sentiment indicators
- Build alerts and notifications for sentiment changes

## Acceptance Criteria
- [ ] Multi-source sentiment aggregation (news, Twitter, Reddit, Discord)
- [ ] Fear & Greed Index calculation and visualization
- [ ] Sentiment scoring with historical tracking
- [ ] On-chain sentiment indicators (whale movements, exchange flows)
- [ ] Social media mention tracking and sentiment analysis
- [ ] Sentiment-based trading signals and alerts
- [ ] Market mood visualization with color-coded indicators
- [ ] Sentiment correlation with price movements
- [ ] Custom sentiment indicators and thresholds
- [ ] Export sentiment data and reports

## Technical Implementation

### File Structure
```
src/
  components/
    Sentiment/
      SentimentDashboard.jsx
      FearGreedIndex.jsx
      SentimentChart.jsx
      SocialSentiment.jsx
      OnChainSentiment.jsx
      SentimentAlerts.jsx
      SentimentCorrelation.jsx
  hooks/
    useSentimentAnalysis.js
    useFearGreedIndex.js
    useSocialSentiment.js
  services/
    SentimentAnalysisService.js
    SocialMediaService.js
    OnChainAnalysisService.js
  utils/
    sentimentCalculations.js
    sentimentIndicators.js
```

### Sentiment Dashboard Component
```jsx
// SentimentDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useSentimentAnalysis } from '../hooks/useSentimentAnalysis';
import { useFearGreedIndex } from '../hooks/useFearGreedIndex';
import FearGreedIndex from './FearGreedIndex';
import SentimentChart from './SentimentChart';
import SocialSentiment from './SocialSentiment';
import OnChainSentiment from './OnChainSentiment';
import SentimentAlerts from './SentimentAlerts';
import SentimentCorrelation from './SentimentCorrelation';

const SentimentDashboard = ({ symbols = ['BTC', 'ETH'], timeframe = '7d' }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');

  const {
    sentimentData,
    sentimentHistory,
    sentimentSources,
    aggregatedSentiment,
    isLoading,
    error
  } = useSentimentAnalysis(symbols, timeframe);

  const {
    fearGreedIndex,
    fearGreedHistory,
    indexComponents
  } = useFearGreedIndex(timeframe);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'social', label: 'Social Media', icon: '🐦' },
    { id: 'onchain', label: 'On-Chain', icon: '⛓️' },
    { id: 'correlation', label: 'Price Correlation', icon: '📈' },
    { id: 'alerts', label: 'Sentiment Alerts', icon: '🔔' }
  ];

  const getSentimentColor = (score) => {
    if (score >= 0.6) return '#00c851'; // Very positive
    if (score >= 0.2) return '#4caf50'; // Positive
    if (score >= -0.2) return '#ff9800'; // Neutral
    if (score >= -0.6) return '#ff5722'; // Negative
    return '#f44336'; // Very negative
  };

  const getSentimentLabel = (score) => {
    if (score >= 0.6) return 'Very Bullish';
    if (score >= 0.2) return 'Bullish';
    if (score >= -0.2) return 'Neutral';
    if (score >= -0.6) return 'Bearish';
    return 'Very Bearish';
  };

  const renderOverviewTab = () => (
    <div className="sentiment-overview">
      <div className="sentiment-summary">
        <div className="current-sentiment">
          <h3>Market Sentiment</h3>
          <div className="sentiment-score-container">
            <div 
              className="sentiment-score"
              style={{ color: getSentimentColor(aggregatedSentiment?.score || 0) }}
            >
              {((aggregatedSentiment?.score || 0) * 100).toFixed(0)}
            </div>
            <div className="sentiment-label">
              {getSentimentLabel(aggregatedSentiment?.score || 0)}
            </div>
          </div>
        </div>

        <div className="fear-greed-container">
          <FearGreedIndex
            value={fearGreedIndex?.value || 50}
            label={fearGreedIndex?.label || 'Neutral'}
            components={indexComponents}
            size={120}
          />
        </div>

        <div className="sentiment-breakdown">
          <h4>Sentiment Sources</h4>
          <div className="sources-grid">
            {sentimentSources?.map(source => (
              <div key={source.name} className="source-card">
                <div className="source-name">{source.name}</div>
                <div 
                  className="source-score"
                  style={{ color: getSentimentColor(source.score) }}
                >
                  {(source.score * 100).toFixed(0)}
                </div>
                <div className="source-confidence">
                  {source.confidence}% confidence
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sentiment-chart-container">
        <SentimentChart
          data={sentimentHistory}
          fearGreedData={fearGreedHistory}
          symbol={selectedSymbol}
          timeframe={timeframe}
          height={300}
        />
      </div>

      <div className="quick-insights">
        <h4>Key Insights</h4>
        <div className="insights-list">
          {aggregatedSentiment?.insights?.map((insight, index) => (
            <div key={index} className="insight-item">
              <span className="insight-icon">{insight.icon}</span>
              <span className="insight-text">{insight.text}</span>
              <span className="insight-impact">{insight.impact}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSocialTab = () => (
    <div className="social-sentiment-tab">
      <SocialSentiment
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        onSymbolChange={setSelectedSymbol}
        timeframe={timeframe}
      />
    </div>
  );

  const renderOnChainTab = () => (
    <div className="onchain-sentiment-tab">
      <OnChainSentiment
        symbols={symbols}
        selectedSymbol={selectedSymbol}
        onSymbolChange={setSelectedSymbol}
        timeframe={timeframe}
      />
    </div>
  );

  const renderCorrelationTab = () => (
    <div className="correlation-tab">
      <SentimentCorrelation
        symbols={symbols}
        sentimentData={sentimentData}
        timeframe={timeframe}
      />
    </div>
  );

  const renderAlertsTab = () => (
    <div className="alerts-tab">
      <SentimentAlerts
        symbols={symbols}
        currentSentiment={aggregatedSentiment}
        onCreateAlert={(alert) => console.log('Create alert:', alert)}
      />
    </div>
  );

  if (isLoading) {
    return (
      <div className="sentiment-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Analyzing market sentiment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sentiment-dashboard-error">
        <p>Error loading sentiment data: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="sentiment-dashboard">
      <div className="dashboard-header">
        <h1>Market Sentiment Analysis</h1>
        
        <div className="header-controls">
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="symbol-selector"
          >
            {symbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="timeframe-selector"
          >
            <option value="24h">24 Hours</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
          </select>
        </div>
      </div>

      <div className="sentiment-navigation">
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

      <div className="sentiment-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'social' && renderSocialTab()}
        {activeTab === 'onchain' && renderOnChainTab()}
        {activeTab === 'correlation' && renderCorrelationTab()}
        {activeTab === 'alerts' && renderAlertsTab()}
      </div>
    </div>
  );
};

export default SentimentDashboard;
```

### Fear & Greed Index Component
```jsx
// FearGreedIndex.jsx
import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';

const FearGreedIndex = ({ 
  value, 
  label, 
  components = [], 
  size = 150,
  showComponents = true 
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    drawGauge();
  }, [value, size]);

  const drawGauge = () => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;

    // Create color scale for fear/greed
    const colorScale = d3.scaleLinear()
      .domain([0, 25, 50, 75, 100])
      .range(['#f44336', '#ff9800', '#ffc107', '#8bc34a', '#4caf50']);

    // Create arc generator
    const arc = d3.arc()
      .innerRadius(radius - 20)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2);

    const g = svg.append('g')
      .attr('transform', `translate(${centerX}, ${centerY})`);

    // Background arc
    g.append('path')
      .datum({ value: 100 })
      .attr('d', arc)
      .attr('fill', '#e0e0e0');

    // Value arc
    const valueArc = d3.arc()
      .innerRadius(radius - 20)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + (value / 100) * Math.PI);

    g.append('path')
      .datum({ value })
      .attr('d', valueArc)
      .attr('fill', colorScale(value));

    // Needle
    const needleAngle = -Math.PI / 2 + (value / 100) * Math.PI;
    const needleLength = radius - 10;

    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', needleLength * Math.cos(needleAngle))
      .attr('y2', needleLength * Math.sin(needleAngle))
      .attr('stroke', '#333')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round');

    // Center circle
    g.append('circle')
      .attr('r', 6)
      .attr('fill', '#333');

    // Value text
    g.append('text')
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .attr('fill', '#333')
      .text(value);

    // Label text
    g.append('text')
      .attr('y', 40)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#666')
      .text(label);

    // Scale labels
    const scaleLabels = ['Extreme Fear', 'Fear', 'Neutral', 'Greed', 'Extreme Greed'];
    const labelPositions = [0, 25, 50, 75, 100];

    labelPositions.forEach((pos, index) => {
      const angle = -Math.PI / 2 + (pos / 100) * Math.PI;
      const labelRadius = radius + 15;
      const x = labelRadius * Math.cos(angle);
      const y = labelRadius * Math.sin(angle);

      g.append('text')
        .attr('x', x)
        .attr('y', y)
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px')
        .attr('fill', '#666')
        .text(scaleLabels[index]);
    });
  };

  const getIndexDescription = () => {
    if (value <= 25) return 'Extreme Fear - Time to Buy?';
    if (value <= 45) return 'Fear - Buying Opportunity';
    if (value <= 55) return 'Neutral - Wait and See';
    if (value <= 75) return 'Greed - Time to be Cautious';
    return 'Extreme Greed - Time to Sell?';
  };

  return (
    <div className="fear-greed-index">
      <h3>Fear & Greed Index</h3>
      
      <div className="gauge-container">
        <svg
          ref={svgRef}
          width={size}
          height={size}
          className="fear-greed-gauge"
        />
      </div>

      <div className="index-description">
        <p>{getIndexDescription()}</p>
      </div>

      {showComponents && components.length > 0 && (
        <div className="index-components">
          <h4>Index Components</h4>
          <div className="components-list">
            {components.map(component => (
              <div key={component.name} className="component-item">
                <span className="component-name">{component.name}</span>
                <span className="component-weight">{component.weight}%</span>
                <div className="component-bar">
                  <div 
                    className="component-fill"
                    style={{ 
                      width: `${component.value}%`,
                      backgroundColor: d3.scaleLinear()
                        .domain([0, 100])
                        .range(['#f44336', '#4caf50'])(component.value)
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FearGreedIndex;
```

### Sentiment Analysis Service
```javascript
// SentimentAnalysisService.js
class SentimentAnalysisService {
  constructor() {
    this.sentimentCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
  }

  async getSentimentData(symbols, timeframe) {
    try {
      const cacheKey = `${symbols.join(',')}-${timeframe}`;
      const cached = this.sentimentCache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }

      const [
        newsSentiment,
        socialSentiment,
        onChainSentiment,
        fearGreedData
      ] = await Promise.all([
        this.getNewsSentiment(symbols, timeframe),
        this.getSocialSentiment(symbols, timeframe),
        this.getOnChainSentiment(symbols, timeframe),
        this.getFearGreedIndex()
      ]);

      const aggregatedSentiment = this.aggregateSentimentSources([
        { name: 'News', score: newsSentiment.score, confidence: newsSentiment.confidence },
        { name: 'Social Media', score: socialSentiment.score, confidence: socialSentiment.confidence },
        { name: 'On-Chain', score: onChainSentiment.score, confidence: onChainSentiment.confidence }
      ]);

      const result = {
        aggregatedSentiment,
        sentimentSources: [
          { name: 'News', score: newsSentiment.score, confidence: newsSentiment.confidence },
          { name: 'Social Media', score: socialSentiment.score, confidence: socialSentiment.confidence },
          { name: 'On-Chain', score: onChainSentiment.score, confidence: onChainSentiment.confidence }
        ],
        sentimentHistory: await this.getSentimentHistory(symbols, timeframe),
        fearGreedIndex: fearGreedData,
        insights: this.generateSentimentInsights(aggregatedSentiment, fearGreedData)
      };

      this.sentimentCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error('Error getting sentiment data:', error);
      throw error;
    }
  }

  async getNewsSentiment(symbols, timeframe) {
    try {
      // Fetch recent news articles for the symbols
      const newsArticles = await this.fetchNewsArticles(symbols, timeframe);
      
      let totalSentiment = 0;
      let articleCount = 0;
      let confidenceSum = 0;

      for (const article of newsArticles) {
        const sentiment = await this.analyzeTextSentiment(
          article.title + ' ' + article.summary
        );
        
        totalSentiment += sentiment.score;
        confidenceSum += sentiment.confidence;
        articleCount++;
      }

      const averageSentiment = articleCount > 0 ? totalSentiment / articleCount : 0;
      const averageConfidence = articleCount > 0 ? confidenceSum / articleCount : 0;

      return {
        score: averageSentiment,
        confidence: averageConfidence,
        articleCount,
        sources: ['CoinDesk', 'Cointelegraph', 'CryptoNews']
      };
    } catch (error) {
      console.error('Error analyzing news sentiment:', error);
      return { score: 0, confidence: 0, articleCount: 0 };
    }
  }

  async getSocialSentiment(symbols, timeframe) {
    try {
      const [twitterSentiment, redditSentiment] = await Promise.all([
        this.getTwitterSentiment(symbols, timeframe),
        this.getRedditSentiment(symbols, timeframe)
      ]);

      // Weighted average of social platforms
      const weightedScore = (
        twitterSentiment.score * 0.6 + 
        redditSentiment.score * 0.4
      );

      const avgConfidence = (
        twitterSentiment.confidence + 
        redditSentiment.confidence
      ) / 2;

      return {
        score: weightedScore,
        confidence: avgConfidence,
        twitter: twitterSentiment,
        reddit: redditSentiment
      };
    } catch (error) {
      console.error('Error analyzing social sentiment:', error);
      return { score: 0, confidence: 0 };
    }
  }

  async getTwitterSentiment(symbols, timeframe) {
    // Mock implementation - replace with actual Twitter API integration
    const mockSentiment = Math.random() * 2 - 1; // -1 to 1
    const mockConfidence = Math.random() * 0.3 + 0.7; // 0.7 to 1
    
    return {
      score: mockSentiment,
      confidence: mockConfidence,
      mentionCount: Math.floor(Math.random() * 1000) + 100,
      engagementRate: Math.random() * 0.1 + 0.02
    };
  }

  async getRedditSentiment(symbols, timeframe) {
    // Mock implementation - replace with actual Reddit API integration
    const mockSentiment = Math.random() * 2 - 1; // -1 to 1
    const mockConfidence = Math.random() * 0.3 + 0.6; // 0.6 to 0.9
    
    return {
      score: mockSentiment,
      confidence: mockConfidence,
      postCount: Math.floor(Math.random() * 500) + 50,
      upvoteRatio: Math.random() * 0.4 + 0.6
    };
  }

  async getOnChainSentiment(symbols, timeframe) {
    try {
      // Analyze on-chain metrics for sentiment indicators
      const onChainMetrics = await this.fetchOnChainMetrics(symbols, timeframe);
      
      let sentimentScore = 0;
      let factorsCount = 0;

      // Exchange flow sentiment
      if (onChainMetrics.exchangeInflow < onChainMetrics.exchangeOutflow) {
        sentimentScore += 0.3; // Bullish when more flowing out
      } else {
        sentimentScore -= 0.2; // Bearish when more flowing in
      }
      factorsCount++;

      // Whale activity sentiment
      if (onChainMetrics.whaleAccumulation > 0) {
        sentimentScore += 0.2;
      } else {
        sentimentScore -= 0.2;
      }
      factorsCount++;

      // Active addresses trend
      if (onChainMetrics.activeAddressesTrend > 0) {
        sentimentScore += 0.1;
      } else {
        sentimentScore -= 0.1;
      }
      factorsCount++;

      // HODL ratio sentiment
      if (onChainMetrics.hodlRatio > 0.6) {
        sentimentScore += 0.2;
      } else if (onChainMetrics.hodlRatio < 0.4) {
        sentimentScore -= 0.2;
      }
      factorsCount++;

      const averageSentiment = factorsCount > 0 ? sentimentScore / factorsCount : 0;
      
      return {
        score: Math.max(-1, Math.min(1, averageSentiment)),
        confidence: 0.8,
        metrics: onChainMetrics
      };
    } catch (error) {
      console.error('Error analyzing on-chain sentiment:', error);
      return { score: 0, confidence: 0 };
    }
  }

  async fetchOnChainMetrics(symbols, timeframe) {
    // Mock implementation - replace with actual on-chain data
    return {
      exchangeInflow: Math.random() * 1000000,
      exchangeOutflow: Math.random() * 1000000,
      whaleAccumulation: Math.random() * 2 - 1,
      activeAddressesTrend: Math.random() * 2 - 1,
      hodlRatio: Math.random(),
      networkValue: Math.random() * 1000000000000
    };
  }

  aggregateSentimentSources(sources) {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let insights = [];

    sources.forEach(source => {
      const weight = source.confidence;
      totalWeightedScore += source.score * weight;
      totalWeight += weight;

      // Generate insights based on individual source sentiment
      if (Math.abs(source.score) > 0.5) {
        insights.push({
          icon: source.score > 0 ? '📈' : '📉',
          text: `${source.name} shows ${source.score > 0 ? 'bullish' : 'bearish'} sentiment`,
          impact: Math.abs(source.score) > 0.7 ? 'High' : 'Medium'
        });
      }
    });

    const aggregatedScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;

    return {
      score: aggregatedScore,
      confidence: totalWeight / sources.length,
      insights
    };
  }

  async getFearGreedIndex() {
    try {
      // Mock implementation - replace with actual Fear & Greed Index API
      const value = Math.floor(Math.random() * 100);
      
      let label;
      if (value <= 25) label = 'Extreme Fear';
      else if (value <= 45) label = 'Fear';
      else if (value <= 55) label = 'Neutral';
      else if (value <= 75) label = 'Greed';
      else label = 'Extreme Greed';

      const components = [
        { name: 'Volatility', value: Math.random() * 100, weight: 25 },
        { name: 'Market Volume', value: Math.random() * 100, weight: 25 },
        { name: 'Social Media', value: Math.random() * 100, weight: 15 },
        { name: 'Dominance', value: Math.random() * 100, weight: 10 },
        { name: 'Trends', value: Math.random() * 100, weight: 10 },
        { name: 'Surveys', value: Math.random() * 100, weight: 15 }
      ];

      return {
        value,
        label,
        components,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error fetching Fear & Greed Index:', error);
      return { value: 50, label: 'Neutral', components: [] };
    }
  }

  async analyzeTextSentiment(text) {
    // Simple sentiment analysis - replace with advanced NLP service
    const positiveWords = ['bullish', 'positive', 'growth', 'gain', 'rise', 'up', 'good', 'strong'];
    const negativeWords = ['bearish', 'negative', 'decline', 'loss', 'fall', 'down', 'bad', 'weak'];
    
    const words = text.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });

    const totalSentimentWords = positiveCount + negativeCount;
    if (totalSentimentWords === 0) {
      return { score: 0, confidence: 0.1 };
    }

    const score = (positiveCount - negativeCount) / Math.max(totalSentimentWords, 1);
    const confidence = Math.min(totalSentimentWords / words.length * 10, 1);

    return { score, confidence };
  }

  generateSentimentInsights(aggregatedSentiment, fearGreedIndex) {
    const insights = [...(aggregatedSentiment.insights || [])];

    // Add Fear & Greed specific insights
    if (fearGreedIndex.value <= 25) {
      insights.push({
        icon: '😨',
        text: 'Extreme fear in the market - historically a good buying opportunity',
        impact: 'High'
      });
    } else if (fearGreedIndex.value >= 75) {
      insights.push({
        icon: '🤑',
        text: 'Extreme greed detected - consider taking profits',
        impact: 'High'
      });
    }

    return insights;
  }

  async getSentimentHistory(symbols, timeframe) {
    // Mock historical sentiment data
    const days = timeframe === '24h' ? 1 : timeframe === '7d' ? 7 : 30;
    const history = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      history.push({
        date: date.toISOString(),
        sentiment: Math.random() * 2 - 1,
        fearGreed: Math.floor(Math.random() * 100),
        volume: Math.random() * 1000000
      });
    }

    return history;
  }
}

export const sentimentAnalysisService = new SentimentAnalysisService();
```

## Testing Requirements
- Sentiment analysis accuracy validation
- Multi-source data aggregation testing
- Fear & Greed Index calculation verification
- Real-time sentiment update testing
- Correlation analysis accuracy testing

## Dependencies
- Depends on: CP-041 (Real-time News Feed)
- Depends on: CP-042 (Social Trading Features)
- Blocks: CP-054 (Automated Trading Strategies)

## Time Estimate
**Beginner**: 9-11 days
**Intermediate**: 6-8 days
**Advanced**: 4-6 days

## Required Skills
- Sentiment analysis and NLP concepts
- Social media API integration
- On-chain data analysis
- Statistical analysis and correlation
- Data visualization and gauge components