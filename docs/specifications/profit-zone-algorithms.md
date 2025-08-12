# Profit Zone Calculation Algorithms Specification

## 1. Overview

This document specifies advanced algorithms for identifying and calculating profit zones in cryptocurrency trading, including support/resistance detection, trend analysis, risk/reward calculations, and automated take-profit strategies.

## 2. Core Profit Zone Components

### 2.1 Support and Resistance Detection Algorithm

#### 2.1.1 Multi-Timeframe Analysis

```typescript
interface SupportResistanceConfig {
  timeframes: ['1m', '5m', '15m', '1h', '4h', '1d'];
  lookbackPeriods: Record<string, number>;
  minTouchConfirmation: number; // Default: 3
  strengthWeighting: Record<string, number>;
  priceTolerancePercent: number; // Default: 0.5%
}

interface SupportResistanceLevel {
  price: number;
  strength: number; // 0-100
  confidence: number; // 0-100
  timeframe: string;
  touches: TouchPoint[];
  type: 'support' | 'resistance';
  age: number; // milliseconds since first detection
  volume: number; // total volume at level
  breaks: number; // number of false breaks
  lastTest: Date;
}

interface TouchPoint {
  timestamp: Date;
  price: number;
  volume: number;
  candleType: 'wick' | 'body';
  timeframe: string;
}

class AdvancedSupportResistanceDetector {
  constructor(private config: SupportResistanceConfig) {}
  
  async detectLevels(
    multiTimeframeData: Record<string, OHLCV[]>
  ): Promise<SupportResistanceLevel[]> {
    const allLevels: SupportResistanceLevel[] = [];
    
    // Detect levels for each timeframe
    for (const [timeframe, data] of Object.entries(multiTimeframeData)) {
      const timeframeLevels = await this.detectTimeframeLevels(
        data, 
        timeframe,
        this.config.lookbackPeriods[timeframe]
      );
      allLevels.push(...timeframeLevels);
    }
    
    // Cluster and merge similar levels across timeframes
    const clusteredLevels = this.clusterLevels(allLevels);
    
    // Calculate composite strength and confidence
    const rankedLevels = this.calculateCompositeMetrics(clusteredLevels);
    
    return rankedLevels.sort((a, b) => b.strength - a.strength);
  }
  
  private async detectTimeframeLevels(
    data: OHLCV[], 
    timeframe: string,
    lookback: number
  ): Promise<SupportResistanceLevel[]> {
    const levels: SupportResistanceLevel[] = [];
    
    // Detect pivot points
    const pivotHighs = this.findPivotPoints(data, 'high', lookback);
    const pivotLows = this.findPivotPoints(data, 'low', lookback);
    
    // Create resistance levels from pivot highs
    const resistanceClusters = this.groupSimilarPrices(
      pivotHighs, 
      this.config.priceTolerancePercent
    );
    
    resistanceClusters.forEach(cluster => {
      if (cluster.length >= this.config.minTouchConfirmation) {
        levels.push(this.createLevel(cluster, 'resistance', timeframe, data));
      }
    });
    
    // Create support levels from pivot lows
    const supportClusters = this.groupSimilarPrices(
      pivotLows, 
      this.config.priceTolerancePercent
    );
    
    supportClusters.forEach(cluster => {
      if (cluster.length >= this.config.minTouchConfirmation) {
        levels.push(this.createLevel(cluster, 'support', timeframe, data));
      }
    });
    
    return levels;
  }
  
  private findPivotPoints(
    data: OHLCV[], 
    type: 'high' | 'low', 
    lookback: number
  ): Array<{price: number, index: number, volume: number}> {
    const pivots: Array<{price: number, index: number, volume: number}> = [];
    const priceKey = type;
    
    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      let isPivot = true;
      
      // Check surrounding candles
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j === i) continue;
        
        const compare = data[j];
        if (type === 'high') {
          if (compare.high >= current.high) {
            isPivot = false;
            break;
          }
        } else {
          if (compare.low <= current.low) {
            isPivot = false;
            break;
          }
        }
      }
      
      if (isPivot) {
        pivots.push({
          price: current[priceKey],
          index: i,
          volume: current.volume
        });
      }
    }
    
    return pivots;
  }
  
  private calculateVolumeProfile(
    data: OHLCV[],
    level: SupportResistanceLevel
  ): number {
    const tolerance = level.price * (this.config.priceTolerancePercent / 100);
    const minPrice = level.price - tolerance;
    const maxPrice = level.price + tolerance;
    
    return data.reduce((totalVolume, candle) => {
      // Check if price level intersects with candle range
      if (candle.low <= maxPrice && candle.high >= minPrice) {
        return totalVolume + candle.volume;
      }
      return totalVolume;
    }, 0);
  }
}
```

#### 2.1.2 Dynamic Level Strength Calculation

```typescript
class LevelStrengthCalculator {
  calculateStrength(level: SupportResistanceLevel, marketData: OHLCV[]): number {
    const weights = {
      touches: 0.25,
      volume: 0.20,
      age: 0.15,
      timeframe: 0.15,
      reactions: 0.15,
      confluence: 0.10
    };
    
    const touchScore = this.calculateTouchScore(level);
    const volumeScore = this.calculateVolumeScore(level, marketData);
    const ageScore = this.calculateAgeScore(level);
    const timeframeScore = this.calculateTimeframeScore(level);
    const reactionScore = this.calculateReactionScore(level, marketData);
    const confluenceScore = this.calculateConfluenceScore(level);
    
    return Math.min(100, Math.max(0,
      touchScore * weights.touches +
      volumeScore * weights.volume +
      ageScore * weights.age +
      timeframeScore * weights.timeframe +
      reactionScore * weights.reactions +
      confluenceScore * weights.confluence
    ));
  }
  
  private calculateTouchScore(level: SupportResistanceLevel): number {
    // More touches = stronger level, but with diminishing returns
    const normalizedTouches = Math.min(level.touches.length, 10);
    return (normalizedTouches / 10) * 100;
  }
  
  private calculateVolumeScore(level: SupportResistanceLevel, marketData: OHLCV[]): number {
    const avgVolume = marketData.reduce((sum, candle) => sum + candle.volume, 0) / marketData.length;
    const levelVolume = level.volume;
    
    // Higher volume at level = stronger level
    return Math.min(100, (levelVolume / avgVolume) * 50);
  }
  
  private calculateReactionScore(level: SupportResistanceLevel, marketData: OHLCV[]): number {
    // Measure how strongly price reacted when touching the level
    let totalReaction = 0;
    let reactionCount = 0;
    
    level.touches.forEach(touch => {
      const touchIndex = this.findCandleIndex(marketData, touch.timestamp);
      if (touchIndex >= 0 && touchIndex < marketData.length - 5) {
        const reaction = this.measureReaction(marketData, touchIndex, level.type);
        totalReaction += reaction;
        reactionCount++;
      }
    });
    
    return reactionCount > 0 ? (totalReaction / reactionCount) : 0;
  }
  
  private measureReaction(
    data: OHLCV[], 
    touchIndex: number, 
    levelType: 'support' | 'resistance'
  ): number {
    const touchCandle = data[touchIndex];
    const nextCandles = data.slice(touchIndex + 1, touchIndex + 6); // Next 5 candles
    
    if (nextCandles.length === 0) return 0;
    
    let maxReaction = 0;
    
    nextCandles.forEach(candle => {
      const reaction = levelType === 'support' 
        ? (candle.high - touchCandle.low) / touchCandle.low
        : (touchCandle.high - candle.low) / touchCandle.high;
      
      maxReaction = Math.max(maxReaction, reaction * 100);
    });
    
    return Math.min(100, maxReaction);
  }
}
```

### 2.2 Trend Analysis Engine

#### 2.2.1 Multi-Dimensional Trend Detection

```typescript
interface TrendAnalysisConfig {
  timeframes: string[];
  trendStrengthThreshold: number; // Default: 0.7
  trendChangeThreshold: number; // Default: 0.3
  volumeConfirmationWeight: number; // Default: 0.4
  momentumWeight: number; // Default: 0.3
}

interface TrendState {
  direction: 'up' | 'down' | 'sideways';
  strength: number; // 0-1
  confidence: number; // 0-1
  duration: number; // milliseconds
  startPrice: number;
  currentPrice: number;
  volumeConfirmation: boolean;
  momentumDivergence: boolean;
  projectedTargets: PriceTarget[];
}

interface PriceTarget {
  price: number;
  probability: number; // 0-1
  timeframe: string;
  method: 'fibonacci' | 'measured_move' | 'pivot_projection' | 'volume_profile';
}

class MultiDimensionalTrendAnalyzer {
  constructor(private config: TrendAnalysisConfig) {}
  
  analyzeTrend(
    multiTimeframeData: Record<string, OHLCV[]>,
    supportResistanceLevels: SupportResistanceLevel[]
  ): Record<string, TrendState> {
    const trendStates: Record<string, TrendState> = {};
    
    this.config.timeframes.forEach(timeframe => {
      const data = multiTimeframeData[timeframe];
      if (!data || data.length < 50) return;
      
      trendStates[timeframe] = this.analyzeSingleTimeframe(
        data, 
        timeframe,
        supportResistanceLevels
      );
    });
    
    return trendStates;
  }
  
  private analyzeSingleTimeframe(
    data: OHLCV[],
    timeframe: string,
    levels: SupportResistanceLevel[]
  ): TrendState {
    // Calculate multiple trend indicators
    const priceAction = this.analyzePriceAction(data);
    const volumeAnalysis = this.analyzeVolumeProfile(data);
    const momentumAnalysis = this.analyzeMomentum(data);
    const structureAnalysis = this.analyzeMarketStructure(data, levels);
    
    // Combine analyses to determine trend state
    const direction = this.determineTrendDirection([
      priceAction,
      volumeAnalysis,
      momentumAnalysis,
      structureAnalysis
    ]);
    
    const strength = this.calculateTrendStrength([
      priceAction,
      volumeAnalysis,
      momentumAnalysis,
      structureAnalysis
    ]);
    
    const confidence = this.calculateConfidence([
      priceAction,
      volumeAnalysis,
      momentumAnalysis,
      structureAnalysis
    ]);
    
    return {
      direction,
      strength,
      confidence,
      duration: this.calculateTrendDuration(data, direction),
      startPrice: this.findTrendStart(data, direction),
      currentPrice: data[data.length - 1].close,
      volumeConfirmation: volumeAnalysis.confirmsDirection,
      momentumDivergence: momentumAnalysis.divergence,
      projectedTargets: this.calculatePriceTargets(data, direction, levels)
    };
  }
  
  private analyzePriceAction(data: OHLCV[]): TrendAnalysis {
    const recentData = data.slice(-20); // Last 20 periods
    const higherHighs = this.countHigherHighs(recentData);
    const higherLows = this.countHigherLows(recentData);
    const lowerHighs = this.countLowerHighs(recentData);
    const lowerLows = this.countLowerLows(recentData);
    
    let direction: 'up' | 'down' | 'sideways';
    let strength: number;
    
    if (higherHighs >= 3 && higherLows >= 3) {
      direction = 'up';
      strength = Math.min(1, (higherHighs + higherLows) / 8);
    } else if (lowerHighs >= 3 && lowerLows >= 3) {
      direction = 'down';
      strength = Math.min(1, (lowerHighs + lowerLows) / 8);
    } else {
      direction = 'sideways';
      strength = 0.3;
    }
    
    return { direction, strength, confirmsDirection: strength > 0.6 };
  }
  
  private calculatePriceTargets(
    data: OHLCV[],
    direction: 'up' | 'down' | 'sideways',
    levels: SupportResistanceLevel[]
  ): PriceTarget[] {
    const targets: PriceTarget[] = [];
    const currentPrice = data[data.length - 1].close;
    
    if (direction === 'sideways') return targets;
    
    // Fibonacci projection targets
    const fibTargets = this.calculateFibonacciTargets(data, direction);
    targets.push(...fibTargets);
    
    // Support/Resistance targets
    const levelTargets = this.calculateLevelTargets(currentPrice, direction, levels);
    targets.push(...levelTargets);
    
    // Measured move targets
    const measuredMoveTargets = this.calculateMeasuredMoveTargets(data, direction);
    targets.push(...measuredMoveTargets);
    
    // Volume profile targets
    const volumeTargets = this.calculateVolumeProfileTargets(data, direction);
    targets.push(...volumeTargets);
    
    return targets.sort((a, b) => b.probability - a.probability);
  }
}
```

### 2.3 Risk/Reward Calculation Engine

#### 2.3.1 Dynamic Position Sizing

```typescript
interface RiskManagementConfig {
  maxRiskPerTrade: number; // Default: 0.02 (2%)
  portfolioHeatLimit: number; // Default: 0.06 (6%)
  riskRewardRatios: {
    minimum: number; // Default: 1.5
    preferred: number; // Default: 2.0
    optimal: number; // Default: 3.0
  };
  volatilityAdjustment: boolean; // Default: true
  correlationAdjustment: boolean; // Default: true
}

interface TradeSetup {
  entryPrice: number;
  stopLoss: number;
  takeProfitLevels: TakeProfitLevel[];
  positionSize: number;
  riskAmount: number;
  potentialReward: number;
  riskRewardRatio: number;
  winProbability: number;
  expectedValue: number;
  maxDrawdown: number;
  timeframe: string;
}

interface TakeProfitLevel {
  price: number;
  percentage: number; // Percentage of position to close
  probability: number; // Probability of reaching this level
  method: string; // Method used to calculate this level
}

class DynamicPositionSizer {
  constructor(
    private config: RiskManagementConfig,
    private portfolioValue: number,
    private openPositions: Position[]
  ) {}
  
  calculateOptimalPosition(
    setup: TradeSetup,
    marketConditions: MarketConditions
  ): OptimizedTradeSetup {
    // Calculate base position size
    const basePositionSize = this.calculateBasePositionSize(setup);
    
    // Apply volatility adjustment
    const volatilityAdjustedSize = this.applyVolatilityAdjustment(
      basePositionSize, 
      marketConditions.volatility
    );
    
    // Apply correlation adjustment
    const correlationAdjustedSize = this.applyCorrelationAdjustment(
      volatilityAdjustedSize,
      setup,
      this.openPositions
    );
    
    // Apply portfolio heat check
    const finalPositionSize = this.applyPortfolioHeatLimit(
      correlationAdjustedSize,
      setup
    );
    
    // Optimize take-profit levels
    const optimizedTakeProfits = this.optimizeTakeProfitLevels(
      setup.takeProfitLevels,
      finalPositionSize,
      marketConditions
    );
    
    return {
      ...setup,
      positionSize: finalPositionSize,
      takeProfitLevels: optimizedTakeProfits,
      riskAmount: finalPositionSize * Math.abs(setup.entryPrice - setup.stopLoss),
      expectedValue: this.calculateExpectedValue(setup, optimizedTakeProfits)
    };
  }
  
  private calculateBasePositionSize(setup: TradeSetup): number {
    const riskPerTrade = this.portfolioValue * this.config.maxRiskPerTrade;
    const priceRisk = Math.abs(setup.entryPrice - setup.stopLoss);
    
    return riskPerTrade / priceRisk;
  }
  
  private applyVolatilityAdjustment(
    baseSize: number, 
    volatility: number
  ): number {
    if (!this.config.volatilityAdjustment) return baseSize;
    
    // Reduce position size in high volatility environments
    const volatilityMultiplier = Math.max(0.25, Math.min(1, 1 - (volatility - 0.02) * 10));
    return baseSize * volatilityMultiplier;
  }
  
  private applyCorrelationAdjustment(
    size: number,
    newSetup: TradeSetup,
    openPositions: Position[]
  ): number {
    if (!this.config.correlationAdjustment || openPositions.length === 0) {
      return size;
    }
    
    // Calculate correlation with open positions
    const totalCorrelation = openPositions.reduce((sum, position) => {
      const correlation = this.calculateAssetCorrelation(
        newSetup.symbol,
        position.symbol
      );
      return sum + Math.abs(correlation) * position.size;
    }, 0);
    
    // Reduce size based on correlation
    const correlationMultiplier = Math.max(0.1, 1 - (totalCorrelation * 0.5));
    return size * correlationMultiplier;
  }
  
  private optimizeTakeProfitLevels(
    takeProfits: TakeProfitLevel[],
    positionSize: number,
    marketConditions: MarketConditions
  ): TakeProfitLevel[] {
    return takeProfits.map(tp => ({
      ...tp,
      percentage: this.optimizeTPPercentage(tp, marketConditions),
    }));
  }
  
  private calculateExpectedValue(
    setup: TradeSetup,
    takeProfits: TakeProfitLevel[]
  ): number {
    const lossAmount = setup.riskAmount;
    const lossProbability = 1 - setup.winProbability;
    
    const winAmount = takeProfits.reduce((total, tp) => {
      const tpValue = (tp.price - setup.entryPrice) * setup.positionSize * (tp.percentage / 100);
      return total + (tpValue * tp.probability);
    }, 0);
    
    return (winAmount * setup.winProbability) - (lossAmount * lossProbability);
  }
}
```

#### 2.3.2 Probability-Based Take-Profit Strategy

```typescript
interface ProbabilityModel {
  calculateReachProbability(
    currentPrice: number,
    targetPrice: number,
    timeframe: string,
    marketConditions: MarketConditions,
    supportResistanceLevels: SupportResistanceLevel[]
  ): number;
}

class MonteCarloProbabilityModel implements ProbabilityModel {
  private simulations: number = 10000;
  
  calculateReachProbability(
    currentPrice: number,
    targetPrice: number,
    timeframe: string,
    marketConditions: MarketConditions,
    levels: SupportResistanceLevel[]
  ): number {
    let successfulSimulations = 0;
    
    for (let i = 0; i < this.simulations; i++) {
      const pathReachedTarget = this.simulatePricePath(
        currentPrice,
        targetPrice,
        timeframe,
        marketConditions,
        levels
      );
      
      if (pathReachedTarget) {
        successfulSimulations++;
      }
    }
    
    return successfulSimulations / this.simulations;
  }
  
  private simulatePricePath(
    startPrice: number,
    targetPrice: number,
    timeframe: string,
    conditions: MarketConditions,
    levels: SupportResistanceLevel[]
  ): boolean {
    let currentPrice = startPrice;
    const steps = this.getTimeframeSteps(timeframe);
    const drift = conditions.trend * 0.0001; // Small trend component
    const volatility = conditions.volatility;
    
    for (let step = 0; step < steps; step++) {
      // Generate random price movement
      const randomComponent = this.generateNormalRandom() * volatility;
      const trendComponent = drift;
      
      // Apply support/resistance effects
      const levelEffect = this.calculateLevelEffect(currentPrice, levels);
      
      // Calculate next price
      const priceChange = (trendComponent + randomComponent + levelEffect) * currentPrice;
      currentPrice += priceChange;
      
      // Check if target reached
      if (this.targetReached(currentPrice, targetPrice, startPrice)) {
        return true;
      }
      
      // Check for major support/resistance rejection
      if (this.strongLevelRejection(currentPrice, levels)) {
        break;
      }
    }
    
    return false;
  }
  
  private calculateLevelEffect(
    price: number, 
    levels: SupportResistanceLevel[]
  ): number {
    let totalEffect = 0;
    
    levels.forEach(level => {
      const distance = Math.abs(price - level.price) / price;
      const maxEffectDistance = 0.005; // 0.5%
      
      if (distance < maxEffectDistance) {
        const effectStrength = (maxEffectDistance - distance) / maxEffectDistance;
        const directionMultiplier = level.type === 'support' ? 1 : -1;
        const strengthMultiplier = level.strength / 100;
        
        totalEffect += effectStrength * directionMultiplier * strengthMultiplier * 0.001;
      }
    });
    
    return totalEffect;
  }
}
```

### 2.4 Automated Take-Profit Strategy Engine

#### 2.4.1 Dynamic Take-Profit Adjustment

```typescript
interface TakeProfitStrategy {
  name: string;
  description: string;
  execute(
    position: Position,
    marketData: OHLCV[],
    indicators: Record<string, any[]>
  ): TakeProfitAction[];
}

interface TakeProfitAction {
  type: 'partial_close' | 'move_stop' | 'add_level' | 'remove_level';
  percentage?: number; // For partial close
  newStopPrice?: number; // For stop movement
  newTakeProfitPrice?: number; // For new levels
  reason: string;
  confidence: number;
}

class TrailingStopStrategy implements TakeProfitStrategy {
  name = 'Trailing Stop';
  description = 'Dynamically adjusts stop-loss to lock in profits';
  
  constructor(
    private atrMultiplier: number = 2.0,
    private minProfitPercent: number = 0.01 // 1%
  ) {}
  
  execute(
    position: Position,
    marketData: OHLCV[],
    indicators: Record<string, any[]>
  ): TakeProfitAction[] {
    const actions: TakeProfitAction[] = [];
    const currentPrice = marketData[marketData.length - 1].close;
    const atr = indicators.atr[indicators.atr.length - 1];
    
    // Calculate minimum profit requirement
    const minProfitPrice = position.entryPrice * (1 + this.minProfitPercent);
    
    if (position.direction === 'long' && currentPrice > minProfitPrice) {
      const trailingStop = currentPrice - (atr * this.atrMultiplier);
      
      if (trailingStop > position.stopLoss) {
        actions.push({
          type: 'move_stop',
          newStopPrice: trailingStop,
          reason: `ATR trailing stop: ${this.atrMultiplier}x ATR below current price`,
          confidence: 0.8
        });
      }
    } else if (position.direction === 'short' && currentPrice < minProfitPrice) {
      const trailingStop = currentPrice + (atr * this.atrMultiplier);
      
      if (trailingStop < position.stopLoss) {
        actions.push({
          type: 'move_stop',
          newStopPrice: trailingStop,
          reason: `ATR trailing stop: ${this.atrMultiplier}x ATR above current price`,
          confidence: 0.8
        });
      }
    }
    
    return actions;
  }
}

class PartialProfitStrategy implements TakeProfitStrategy {
  name = 'Partial Profit Taking';
  description = 'Takes partial profits at predetermined levels';
  
  constructor(
    private profitLevels: Array<{percentage: number, takeProfit: number}> = [
      { percentage: 25, takeProfit: 1.5 }, // Take 25% at 1.5R
      { percentage: 25, takeProfit: 2.0 }, // Take 25% at 2R
      { percentage: 50, takeProfit: 3.0 }  // Take 50% at 3R
    ]
  ) {}
  
  execute(
    position: Position,
    marketData: OHLCV[],
    indicators: Record<string, any[]>
  ): TakeProfitAction[] {
    const actions: TakeProfitAction[] = [];
    const currentPrice = marketData[marketData.length - 1].close;
    const riskAmount = Math.abs(position.entryPrice - position.stopLoss);
    
    this.profitLevels.forEach(level => {
      const targetPrice = position.direction === 'long'
        ? position.entryPrice + (riskAmount * level.takeProfit)
        : position.entryPrice - (riskAmount * level.takeProfit);
      
      const hasReachedTarget = position.direction === 'long'
        ? currentPrice >= targetPrice
        : currentPrice <= targetPrice;
      
      if (hasReachedTarget && !position.partialsProfitsTaken.includes(level.takeProfit)) {
        actions.push({
          type: 'partial_close',
          percentage: level.percentage,
          reason: `Partial profit at ${level.takeProfit}R risk-reward ratio`,
          confidence: 0.9
        });
      }
    });
    
    return actions;
  }
}

class VolatilityBreakoutStrategy implements TakeProfitStrategy {
  name = 'Volatility Breakout';
  description = 'Adjusts take-profits based on volatility expansion/contraction';
  
  execute(
    position: Position,
    marketData: OHLCV[],
    indicators: Record<string, any[]>
  ): TakeProfitAction[] {
    const actions: TakeProfitAction[] = [];
    const atr = indicators.atr;
    const bollinger = indicators.bollinger;
    
    if (!atr || !bollinger) return actions;
    
    const currentATR = atr[atr.length - 1];
    const avgATR = atr.slice(-20).reduce((sum, val) => sum + val, 0) / 20;
    const currentBandwidth = bollinger.bandwidth[bollinger.bandwidth.length - 1];
    const avgBandwidth = bollinger.bandwidth.slice(-20).reduce((sum, val) => sum + val, 0) / 20;
    
    // If volatility is expanding, extend take-profit targets
    const volatilityExpansion = (currentATR / avgATR) + (currentBandwidth / avgBandwidth);
    
    if (volatilityExpansion > 1.5) {
      const extensionMultiplier = Math.min(2.0, volatilityExpansion);
      const riskAmount = Math.abs(position.entryPrice - position.stopLoss);
      const extendedTarget = position.direction === 'long'
        ? position.entryPrice + (riskAmount * 4.0 * extensionMultiplier)
        : position.entryPrice - (riskAmount * 4.0 * extensionMultiplier);
      
      actions.push({
        type: 'add_level',
        newTakeProfitPrice: extendedTarget,
        reason: `Volatility expansion detected: ${volatilityExpansion.toFixed(2)}x`,
        confidence: 0.7
      });
    }
    
    return actions;
  }
}
```

### 2.5 Profit Zone Visualization Engine

#### 2.5.1 Real-time Profit Zone Overlay

```typescript
interface ProfitZoneVisualization {
  zones: ProfitZone[];
  supportLevels: VisualLevel[];
  resistanceLevels: VisualLevel[];
  trendChannels: TrendChannel[];
  riskRewardAreas: RiskRewardArea[];
}

interface ProfitZone {
  id: string;
  minPrice: number;
  maxPrice: number;
  probability: number;
  timeframe: string;
  type: 'high_probability' | 'medium_probability' | 'low_probability';
  methods: string[]; // Methods that identified this zone
  color: string;
  opacity: number;
}

interface VisualLevel {
  price: number;
  strength: number;
  type: 'support' | 'resistance';
  touches: number;
  age: number;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  thickness: number;
}

class ProfitZoneVisualizer {
  generateVisualization(
    supportResistanceLevels: SupportResistanceLevel[],
    trendAnalysis: Record<string, TrendState>,
    priceTargets: PriceTarget[],
    currentPrice: number
  ): ProfitZoneVisualization {
    
    // Identify high-probability zones
    const profitZones = this.identifyProfitZones(
      supportResistanceLevels,
      trendAnalysis,
      priceTargets,
      currentPrice
    );
    
    // Create visual elements
    const supportLevels = this.createLevelVisuals(
      supportResistanceLevels.filter(l => l.type === 'support')
    );
    
    const resistanceLevels = this.createLevelVisuals(
      supportResistanceLevels.filter(l => l.type === 'resistance')
    );
    
    const trendChannels = this.createTrendChannels(trendAnalysis);
    
    const riskRewardAreas = this.createRiskRewardAreas(
      profitZones,
      currentPrice
    );
    
    return {
      zones: profitZones,
      supportLevels,
      resistanceLevels,
      trendChannels,
      riskRewardAreas
    };
  }
  
  private identifyProfitZones(
    levels: SupportResistanceLevel[],
    trends: Record<string, TrendState>,
    targets: PriceTarget[],
    currentPrice: number
  ): ProfitZone[] {
    const zones: ProfitZone[] = [];
    
    // Create zones around high-probability targets
    targets.forEach(target => {
      if (target.probability > 0.6) {
        const zone = this.createZoneAroundTarget(target, levels, currentPrice);
        zones.push(zone);
      }
    });
    
    // Create zones between strong support/resistance levels
    const strongLevels = levels.filter(l => l.strength > 70);
    
    for (let i = 0; i < strongLevels.length - 1; i++) {
      const level1 = strongLevels[i];
      const level2 = strongLevels[i + 1];
      
      if (Math.abs(level1.price - level2.price) / currentPrice > 0.02) { // 2% minimum
        const zone = this.createZoneBetweenLevels(level1, level2, currentPrice);
        zones.push(zone);
      }
    }
    
    return this.mergeSimilarZones(zones);
  }
  
  private createZoneAroundTarget(
    target: PriceTarget,
    levels: SupportResistanceLevel[],
    currentPrice: number
  ): ProfitZone {
    const zoneWidth = currentPrice * 0.01; // 1% zone width
    const minPrice = target.price - zoneWidth;
    const maxPrice = target.price + zoneWidth;
    
    // Check for confluence with support/resistance
    const confluence = levels.filter(level => 
      level.price >= minPrice && level.price <= maxPrice
    );
    
    const adjustedProbability = target.probability + (confluence.length * 0.1);
    
    return {
      id: `zone_${target.method}_${target.price}`,
      minPrice,
      maxPrice,
      probability: Math.min(1, adjustedProbability),
      timeframe: target.timeframe,
      type: this.getZoneType(adjustedProbability),
      methods: [target.method, ...confluence.map(c => 'level_confluence')],
      color: this.getZoneColor(adjustedProbability),
      opacity: this.getZoneOpacity(adjustedProbability)
    };
  }
  
  private getZoneType(probability: number): 'high_probability' | 'medium_probability' | 'low_probability' {
    if (probability >= 0.8) return 'high_probability';
    if (probability >= 0.6) return 'medium_probability';
    return 'low_probability';
  }
  
  private getZoneColor(probability: number): string {
    if (probability >= 0.8) return '#00ff00'; // Green for high probability
    if (probability >= 0.6) return '#ffff00'; // Yellow for medium probability
    return '#ff8800'; // Orange for low probability
  }
  
  private getZoneOpacity(probability: number): number {
    return Math.max(0.1, Math.min(0.6, probability * 0.6));
  }
}
```

## 3. Performance Optimization

### 3.1 Real-time Calculation Engine

```typescript
class OptimizedProfitZoneEngine {
  private calculationCache = new Map<string, any>();
  private webWorker: Worker | null = null;
  
  constructor() {
    this.initializeWebWorker();
  }
  
  async calculateProfitZones(
    marketData: Record<string, OHLCV[]>,
    indicators: Record<string, any[]>,
    config: ProfitZoneConfig
  ): Promise<ProfitZoneResult> {
    
    const cacheKey = this.generateCacheKey(marketData, config);
    
    // Check cache for recent calculations
    if (this.calculationCache.has(cacheKey)) {
      const cached = this.calculationCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5000) { // 5 second cache
        return this.updateIncrementally(cached.result, marketData);
      }
    }
    
    // Perform full calculation
    const result = await this.performFullCalculation(marketData, indicators, config);
    
    // Cache result
    this.calculationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    return result;
  }
  
  private async updateIncrementally(
    cachedResult: ProfitZoneResult,
    newData: Record<string, OHLCV[]>
  ): Promise<ProfitZoneResult> {
    // Only update the last few values instead of full recalculation
    const updatedLevels = this.updateSupportResistanceLevels(
      cachedResult.supportResistanceLevels,
      newData
    );
    
    const updatedTrends = this.updateTrendAnalysis(
      cachedResult.trendStates,
      newData
    );
    
    return {
      ...cachedResult,
      supportResistanceLevels: updatedLevels,
      trendStates: updatedTrends,
      lastUpdated: Date.now()
    };
  }
}
```

This comprehensive specification provides a robust framework for implementing advanced profit zone calculation algorithms that can significantly enhance trading decision-making in the crypto portfolio application.