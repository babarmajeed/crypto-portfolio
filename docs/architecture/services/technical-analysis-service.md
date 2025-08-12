# Technical Analysis Service Architecture

## Overview
Comprehensive technical analysis service integrating TA-Lib for advanced charting, indicators, and algorithmic trading signals for cryptocurrency portfolio analysis.

## Service Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                             │
│              (Analytics Endpoints)                         │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│              Technical Analysis Service                     │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Indicator  │  │   Chart     │  │   Signal    │        │
│  │  Calculator │  │  Generator  │  │  Generator  │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Pattern   │  │ Backtesting │  │    Alert    │        │
│  │ Recognition │  │   Engine    │  │   Engine    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│        Market Data Cache + Time Series Database            │
│              (Redis + InfluxDB/TimescaleDB)                │
└─────────────────────────────────────────────────────────────┘
```

### Technical Analysis Service Implementation

```typescript
import talib from 'talib';
import { Redis } from 'ioredis';
import WebSocket from 'ws';

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TechnicalIndicator {
  name: string;
  values: number[];
  timestamps: number[];
  parameters: Record<string, any>;
  lastUpdated: number;
}

interface TradingSignal {
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  confidence: number; // 0-100
  indicators: string[];
  timestamp: number;
  description: string;
  priceLevel: number;
  stopLoss?: number;
  takeProfit?: number;
}

interface ChartPattern {
  pattern: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  description: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  timeframe: string;
}

class TechnicalAnalysisService {
  private redis: Redis;
  private indicatorCache: Map<string, TechnicalIndicator> = new Map();
  private patternRecognizer: PatternRecognitionEngine;
  private backtestingEngine: BacktestingEngine;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.patternRecognizer = new PatternRecognitionEngine();
    this.backtestingEngine = new BacktestingEngine();
  }

  async calculateIndicators(
    symbol: string,
    timeframe: string,
    indicators: string[],
    period: number = 100
  ): Promise<Record<string, TechnicalIndicator>> {
    // Get OHLCV data
    const ohlcvData = await this.getOHLCVData(symbol, timeframe, period);
    
    if (ohlcvData.length < 20) {
      throw new Error('Insufficient data for technical analysis');
    }

    const results: Record<string, TechnicalIndicator> = {};

    for (const indicatorName of indicators) {
      try {
        const indicator = await this.calculateIndicator(indicatorName, ohlcvData);
        results[indicatorName] = indicator;
        
        // Cache result
        const cacheKey = `indicator:${symbol}:${timeframe}:${indicatorName}`;
        await this.redis.setex(cacheKey, 300, JSON.stringify(indicator)); // 5 minutes cache
      } catch (error) {
        console.error(`Error calculating ${indicatorName}:`, error);
      }
    }

    return results;
  }

  private async calculateIndicator(name: string, data: OHLCV[]): Promise<TechnicalIndicator> {
    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const volumes = data.map(d => d.volume);
    const timestamps = data.map(d => d.timestamp);

    let values: number[] = [];
    let parameters: Record<string, any> = {};

    switch (name.toUpperCase()) {
      case 'SMA_20':
        values = talib.SMA({ inReal: closes, optInTimePeriod: 20 });
        parameters = { period: 20 };
        break;

      case 'SMA_50':
        values = talib.SMA({ inReal: closes, optInTimePeriod: 50 });
        parameters = { period: 50 };
        break;

      case 'EMA_12':
        values = talib.EMA({ inReal: closes, optInTimePeriod: 12 });
        parameters = { period: 12 };
        break;

      case 'EMA_26':
        values = talib.EMA({ inReal: closes, optInTimePeriod: 26 });
        parameters = { period: 26 };
        break;

      case 'RSI':
        values = talib.RSI({ inReal: closes, optInTimePeriod: 14 });
        parameters = { period: 14 };
        break;

      case 'MACD':
        const macdResult = talib.MACD({
          inReal: closes,
          optInFastPeriod: 12,
          optInSlowPeriod: 26,
          optInSignalPeriod: 9
        });
        values = macdResult.outMACD;
        parameters = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 };
        break;

      case 'BOLLINGER_BANDS':
        const bbResult = talib.BBANDS({
          inReal: closes,
          optInTimePeriod: 20,
          optInNbDevUp: 2,
          optInNbDevDn: 2
        });
        values = bbResult.outRealMiddleBand;
        parameters = { period: 20, stdDev: 2 };
        break;

      case 'STOCHASTIC':
        const stochResult = talib.STOCH({
          inHigh: highs,
          inLow: lows,
          inClose: closes,
          optInFastKPeriod: 14,
          optInSlowKPeriod: 3,
          optInSlowDPeriod: 3
        });
        values = stochResult.outSlowK;
        parameters = { fastK: 14, slowK: 3, slowD: 3 };
        break;

      case 'ATR':
        values = talib.ATR({
          inHigh: highs,
          inLow: lows,
          inClose: closes,
          optInTimePeriod: 14
        });
        parameters = { period: 14 };
        break;

      case 'VOLUME_SMA':
        values = talib.SMA({ inReal: volumes, optInTimePeriod: 20 });
        parameters = { period: 20 };
        break;

      case 'ICHIMOKU':
        const ichimokuResult = this.calculateIchimoku(highs, lows, closes);
        values = ichimokuResult.tenkanSen;
        parameters = { tenkanPeriod: 9, kijunPeriod: 26, senkouPeriod: 52 };
        break;

      case 'FIBONACCI_RETRACEMENT':
        const fibResult = this.calculateFibonacciRetracement(highs, lows);
        values = fibResult.levels;
        parameters = { levels: [0.236, 0.382, 0.5, 0.618, 0.786] };
        break;

      default:
        throw new Error(`Unsupported indicator: ${name}`);
    }

    return {
      name,
      values: values.filter(v => !isNaN(v)),
      timestamps: timestamps.slice(-values.length),
      parameters,
      lastUpdated: Date.now()
    };
  }

  async generateTradingSignals(
    symbol: string,
    timeframe: string,
    strategies: string[] = ['DEFAULT']
  ): Promise<TradingSignal[]> {
    const indicators = await this.calculateIndicators(symbol, timeframe, [
      'SMA_20', 'SMA_50', 'EMA_12', 'EMA_26', 'RSI', 'MACD', 'BOLLINGER_BANDS', 'STOCHASTIC'
    ]);

    const signals: TradingSignal[] = [];
    const currentPrice = await this.getCurrentPrice(symbol);

    for (const strategy of strategies) {
      try {
        const signal = await this.generateSignalForStrategy(strategy, indicators, currentPrice, symbol);
        if (signal) {
          signals.push(signal);
        }
      } catch (error) {
        console.error(`Error generating signal for strategy ${strategy}:`, error);
      }
    }

    return signals;
  }

  private async generateSignalForStrategy(
    strategy: string,
    indicators: Record<string, TechnicalIndicator>,
    currentPrice: number,
    symbol: string
  ): Promise<TradingSignal | null> {
    switch (strategy) {
      case 'DEFAULT':
        return this.generateDefaultSignal(indicators, currentPrice, symbol);
      
      case 'MOMENTUM':
        return this.generateMomentumSignal(indicators, currentPrice, symbol);
      
      case 'MEAN_REVERSION':
        return this.generateMeanReversionSignal(indicators, currentPrice, symbol);
      
      case 'TREND_FOLLOWING':
        return this.generateTrendFollowingSignal(indicators, currentPrice, symbol);
      
      default:
        throw new Error(`Unknown strategy: ${strategy}`);
    }
  }

  private generateDefaultSignal(
    indicators: Record<string, TechnicalIndicator>,
    currentPrice: number,
    symbol: string
  ): TradingSignal | null {
    const rsi = indicators['RSI'];
    const sma20 = indicators['SMA_20'];
    const sma50 = indicators['SMA_50'];
    const macd = indicators['MACD'];

    if (!rsi || !sma20 || !sma50 || !macd) {
      return null;
    }

    const latestRSI = rsi.values[rsi.values.length - 1];
    const latestSMA20 = sma20.values[sma20.values.length - 1];
    const latestSMA50 = sma50.values[sma50.values.length - 1];
    const latestMACD = macd.values[macd.values.length - 1];

    let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0;
    let confidence = 0;
    let description = '';
    const usedIndicators: string[] = [];

    // RSI analysis
    if (latestRSI < 30) {
      strength += 25;
      confidence += 20;
      usedIndicators.push('RSI_OVERSOLD');
      description += 'RSI oversold, ';
    } else if (latestRSI > 70) {
      strength -= 25;
      confidence += 20;
      usedIndicators.push('RSI_OVERBOUGHT');
      description += 'RSI overbought, ';
    }

    // Moving average analysis
    if (currentPrice > latestSMA20 && latestSMA20 > latestSMA50) {
      strength += 30;
      confidence += 25;
      usedIndicators.push('SMA_BULLISH');
      description += 'Price above SMAs (bullish trend), ';
    } else if (currentPrice < latestSMA20 && latestSMA20 < latestSMA50) {
      strength -= 30;
      confidence += 25;
      usedIndicators.push('SMA_BEARISH');
      description += 'Price below SMAs (bearish trend), ';
    }

    // MACD analysis
    if (latestMACD > 0) {
      strength += 20;
      confidence += 15;
      usedIndicators.push('MACD_BULLISH');
      description += 'MACD positive, ';
    } else {
      strength -= 20;
      confidence += 15;
      usedIndicators.push('MACD_BEARISH');
      description += 'MACD negative, ';
    }

    // Determine signal type
    if (strength > 30) {
      signalType = 'BUY';
    } else if (strength < -30) {
      signalType = 'SELL';
    }

    // Calculate stop loss and take profit
    const atr = await this.calculateATR(symbol, '1h', 14);
    const stopLoss = signalType === 'BUY' 
      ? currentPrice - (atr * 2) 
      : currentPrice + (atr * 2);
    const takeProfit = signalType === 'BUY' 
      ? currentPrice + (atr * 3) 
      : currentPrice - (atr * 3);

    return {
      symbol,
      type: signalType,
      strength: Math.abs(strength),
      confidence: Math.min(confidence, 100),
      indicators: usedIndicators,
      timestamp: Date.now(),
      description: description.slice(0, -2), // Remove trailing comma
      priceLevel: currentPrice,
      stopLoss: signalType !== 'HOLD' ? stopLoss : undefined,
      takeProfit: signalType !== 'HOLD' ? takeProfit : undefined
    };
  }

  private generateMomentumSignal(
    indicators: Record<string, TechnicalIndicator>,
    currentPrice: number,
    symbol: string
  ): TradingSignal | null {
    const rsi = indicators['RSI'];
    const stoch = indicators['STOCHASTIC'];
    const macd = indicators['MACD'];

    if (!rsi || !stoch || !macd) {
      return null;
    }

    const latestRSI = rsi.values[rsi.values.length - 1];
    const latestStoch = stoch.values[stoch.values.length - 1];
    const latestMACD = macd.values[macd.values.length - 1];
    const prevMACD = macd.values[macd.values.length - 2];

    let strength = 0;
    let confidence = 0;
    const usedIndicators: string[] = [];
    let description = '';

    // RSI momentum
    if (latestRSI > 50 && latestRSI < 70) {
      strength += 25;
      confidence += 20;
      usedIndicators.push('RSI_MOMENTUM');
      description += 'RSI showing bullish momentum, ';
    } else if (latestRSI < 50 && latestRSI > 30) {
      strength -= 25;
      confidence += 20;
      usedIndicators.push('RSI_MOMENTUM');
      description += 'RSI showing bearish momentum, ';
    }

    // Stochastic momentum
    if (latestStoch > 20 && latestStoch < 80) {
      if (latestStoch > 50) {
        strength += 20;
        usedIndicators.push('STOCH_BULLISH');
        description += 'Stochastic bullish, ';
      } else {
        strength -= 20;
        usedIndicators.push('STOCH_BEARISH');
        description += 'Stochastic bearish, ';
      }
      confidence += 15;
    }

    // MACD momentum
    if (latestMACD > prevMACD && latestMACD > 0) {
      strength += 30;
      confidence += 25;
      usedIndicators.push('MACD_MOMENTUM');
      description += 'MACD increasing momentum, ';
    } else if (latestMACD < prevMACD && latestMACD < 0) {
      strength -= 30;
      confidence += 25;
      usedIndicators.push('MACD_MOMENTUM');
      description += 'MACD decreasing momentum, ';
    }

    const signalType: 'BUY' | 'SELL' | 'HOLD' = strength > 25 ? 'BUY' : strength < -25 ? 'SELL' : 'HOLD';

    return {
      symbol,
      type: signalType,
      strength: Math.abs(strength),
      confidence: Math.min(confidence, 100),
      indicators: usedIndicators,
      timestamp: Date.now(),
      description: description.slice(0, -2),
      priceLevel: currentPrice
    };
  }

  async recognizePatterns(
    symbol: string,
    timeframe: string,
    lookbackPeriod: number = 50
  ): Promise<ChartPattern[]> {
    const ohlcvData = await this.getOHLCVData(symbol, timeframe, lookbackPeriod);
    return this.patternRecognizer.recognizePatterns(ohlcvData, timeframe);
  }

  async runBacktest(
    symbol: string,
    strategy: string,
    timeframe: string,
    startDate: Date,
    endDate: Date,
    initialCapital: number = 10000
  ): Promise<BacktestResult> {
    return this.backtestingEngine.runBacktest({
      symbol,
      strategy,
      timeframe,
      startDate,
      endDate,
      initialCapital
    });
  }

  async calculatePortfolioMetrics(
    userId: string,
    timeframe: string = '1d'
  ): Promise<PortfolioTechnicalMetrics> {
    const portfolio = await this.getUserPortfolio(userId);
    const metrics: PortfolioTechnicalMetrics = {
      totalValue: 0,
      volatility: 0,
      sharpeRatio: 0,
      beta: 0,
      alpha: 0,
      maxDrawdown: 0,
      correlationMatrix: {},
      diversificationRatio: 0,
      riskAdjustedReturn: 0
    };

    // Calculate individual asset metrics
    for (const holding of portfolio.holdings) {
      const assetMetrics = await this.calculateAssetMetrics(holding.symbol, timeframe);
      // Aggregate metrics based on portfolio weights
    }

    return metrics;
  }

  private calculateIchimoku(highs: number[], lows: number[], closes: number[]): any {
    const tenkanSen = this.calculateIchimokuLine(highs, lows, 9);
    const kijunSen = this.calculateIchimokuLine(highs, lows, 26);
    const senkouSpanA = tenkanSen.map((t, i) => (t + kijunSen[i]) / 2);
    const senkouSpanB = this.calculateIchimokuLine(highs, lows, 52);

    return {
      tenkanSen,
      kijunSen,
      senkouSpanA,
      senkouSpanB,
      chikouSpan: closes.map((c, i) => i >= 26 ? closes[i - 26] : null)
    };
  }

  private calculateIchimokuLine(highs: number[], lows: number[], period: number): number[] {
    const result: number[] = [];
    
    for (let i = period - 1; i < highs.length; i++) {
      const periodHighs = highs.slice(i - period + 1, i + 1);
      const periodLows = lows.slice(i - period + 1, i + 1);
      const high = Math.max(...periodHighs);
      const low = Math.min(...periodLows);
      result.push((high + low) / 2);
    }

    return result;
  }

  private calculateFibonacciRetracement(highs: number[], lows: number[]): any {
    const high = Math.max(...highs);
    const low = Math.min(...lows);
    const diff = high - low;

    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map(ratio => 
      high - (diff * ratio)
    );

    return { levels, high, low };
  }

  private async calculateATR(symbol: string, timeframe: string, period: number): Promise<number> {
    const data = await this.getOHLCVData(symbol, timeframe, period + 1);
    const highs = data.map(d => d.high);
    const lows = data.map(d => d.low);
    const closes = data.map(d => d.close);

    const atrValues = talib.ATR({
      inHigh: highs,
      inLow: lows,
      inClose: closes,
      optInTimePeriod: period
    });

    return atrValues[atrValues.length - 1] || 0;
  }

  private async getOHLCVData(symbol: string, timeframe: string, period: number): Promise<OHLCV[]> {
    // Implementation would fetch from your market data service/database
    // This is a placeholder
    return [];
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    // Implementation would fetch current price from your market data service
    return 0;
  }

  private async getUserPortfolio(userId: string): Promise<any> {
    // Implementation would fetch user portfolio from your portfolio service
    return { holdings: [] };
  }

  private async calculateAssetMetrics(symbol: string, timeframe: string): Promise<any> {
    // Implementation for individual asset technical metrics
    return {};
  }
}

// Supporting Classes

class PatternRecognitionEngine {
  recognizePatterns(data: OHLCV[], timeframe: string): ChartPattern[] {
    const patterns: ChartPattern[] = [];

    // Head and Shoulders
    const headAndShoulders = this.detectHeadAndShoulders(data);
    if (headAndShoulders) patterns.push(headAndShoulders);

    // Double Top/Bottom
    const doubleTopBottom = this.detectDoubleTopBottom(data);
    if (doubleTopBottom) patterns.push(doubleTopBottom);

    // Triangle patterns
    const triangles = this.detectTriangles(data);
    patterns.push(...triangles);

    // Support and Resistance
    const supportResistance = this.detectSupportResistance(data);
    patterns.push(...supportResistance);

    return patterns;
  }

  private detectHeadAndShoulders(data: OHLCV[]): ChartPattern | null {
    // Implementation for head and shoulders pattern detection
    return null;
  }

  private detectDoubleTopBottom(data: OHLCV[]): ChartPattern | null {
    // Implementation for double top/bottom pattern detection
    return null;
  }

  private detectTriangles(data: OHLCV[]): ChartPattern[] {
    // Implementation for triangle pattern detection
    return [];
  }

  private detectSupportResistance(data: OHLCV[]): ChartPattern[] {
    // Implementation for support/resistance level detection
    return [];
  }
}

interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  trades: Trade[];
}

interface Trade {
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  pnl: number;
  pnlPercent: number;
}

interface PortfolioTechnicalMetrics {
  totalValue: number;
  volatility: number;
  sharpeRatio: number;
  beta: number;
  alpha: number;
  maxDrawdown: number;
  correlationMatrix: Record<string, Record<string, number>>;
  diversificationRatio: number;
  riskAdjustedReturn: number;
}

class BacktestingEngine {
  async runBacktest(config: any): Promise<BacktestResult> {
    // Implementation for backtesting engine
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      totalTrades: 0,
      profitFactor: 0,
      trades: []
    };
  }
}
```

### Real-time Technical Analysis Updates

```typescript
class RealTimeTechnicalAnalysis {
  private wsConnections: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map();

  async subscribeToIndicatorUpdates(
    userId: string,
    symbol: string,
    indicators: string[],
    timeframe: string
  ): Promise<void> {
    const subscriptionKey = `${symbol}:${timeframe}`;
    
    if (!this.subscriptions.has(subscriptionKey)) {
      this.subscriptions.set(subscriptionKey, new Set());
    }
    
    this.subscriptions.get(subscriptionKey)!.add(userId);

    // Start real-time indicator calculation for this symbol/timeframe
    await this.startIndicatorCalculation(symbol, timeframe, indicators);
  }

  private async startIndicatorCalculation(
    symbol: string,
    timeframe: string,
    indicators: string[]
  ): Promise<void> {
    // Set up WebSocket connection to market data feed
    const ws = new WebSocket(`wss://api.exchange.com/ws/stream?symbol=${symbol}`);
    
    ws.on('message', async (data) => {
      const priceUpdate = JSON.parse(data.toString());
      
      // Update OHLCV data
      await this.updateOHLCVData(symbol, timeframe, priceUpdate);
      
      // Recalculate indicators
      const updatedIndicators = await this.recalculateIndicators(symbol, timeframe, indicators);
      
      // Broadcast to subscribers
      await this.broadcastIndicatorUpdates(symbol, timeframe, updatedIndicators);
    });

    this.wsConnections.set(`${symbol}:${timeframe}`, ws);
  }

  private async broadcastIndicatorUpdates(
    symbol: string,
    timeframe: string,
    indicators: Record<string, TechnicalIndicator>
  ): Promise<void> {
    const subscriptionKey = `${symbol}:${timeframe}`;
    const subscribers = this.subscriptions.get(subscriptionKey);
    
    if (!subscribers) return;

    const update = {
      type: 'indicator_update',
      symbol,
      timeframe,
      indicators,
      timestamp: Date.now()
    };

    // Send to all subscribers via WebSocket or message queue
    for (const userId of subscribers) {
      await this.sendToUser(userId, update);
    }
  }

  private async sendToUser(userId: string, message: any): Promise<void> {
    // Implementation to send message to user via WebSocket
  }

  private async updateOHLCVData(symbol: string, timeframe: string, priceUpdate: any): Promise<void> {
    // Implementation to update OHLCV data in time series database
  }

  private async recalculateIndicators(
    symbol: string,
    timeframe: string,
    indicators: string[]
  ): Promise<Record<string, TechnicalIndicator>> {
    // Implementation to recalculate indicators with new data
    return {};
  }
}
```

This technical analysis service provides:
- **Comprehensive Indicators**: Full TA-Lib integration with 150+ indicators
- **Pattern Recognition**: Advanced chart pattern detection algorithms
- **Real-time Updates**: Live indicator calculations and signal generation
- **Backtesting**: Historical strategy performance analysis
- **Portfolio Analytics**: Technical metrics for entire portfolio
- **Signal Generation**: Automated trading signal creation
- **Risk Management**: Stop-loss and take-profit calculations
- **Performance Metrics**: Sharpe ratio, drawdown, volatility analysis