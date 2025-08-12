# Technical Analysis Indicators Specification

## 1. Overview

This document specifies the implementation requirements for technical analysis indicators in the crypto portfolio application, including calculation methods, performance requirements, and visual presentation guidelines.

## 2. Core Indicator Categories

### 2.1 Trend Indicators

#### 2.1.1 Moving Averages

##### Simple Moving Average (SMA)
```typescript
interface SMAConfig {
  period: number; // Default: 20
  source: 'open' | 'high' | 'low' | 'close' | 'volume'; // Default: 'close'
}

class SimpleMovingAverage {
  calculate(data: OHLCV[], config: SMAConfig): number[] {
    const values = data.map(candle => candle[config.source]);
    return values.map((_, index) => {
      if (index < config.period - 1) return null;
      const slice = values.slice(index - config.period + 1, index + 1);
      return slice.reduce((sum, val) => sum + val, 0) / config.period;
    });
  }
}
```

**Performance Requirements**:
- Calculation time: <1ms for 1000 data points
- Memory usage: O(n) where n is data length
- Real-time update: <10ms latency

##### Exponential Moving Average (EMA)
```typescript
interface EMAConfig {
  period: number; // Default: 20
  source: 'open' | 'high' | 'low' | 'close' | 'volume';
  smoothing: number; // Default: 2
}

class ExponentialMovingAverage {
  calculate(data: OHLCV[], config: EMAConfig): number[] {
    const alpha = config.smoothing / (config.period + 1);
    const values = data.map(candle => candle[config.source]);
    const ema: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      if (i === 0) {
        ema[i] = values[i];
      } else {
        ema[i] = alpha * values[i] + (1 - alpha) * ema[i - 1];
      }
    }
    return ema;
  }
}
```

##### Volume Weighted Moving Average (VWMA)
```typescript
interface VWMAConfig {
  period: number; // Default: 20
}

class VolumeWeightedMovingAverage {
  calculate(data: OHLCV[], config: VWMAConfig): number[] {
    return data.map((_, index) => {
      if (index < config.period - 1) return null;
      
      const slice = data.slice(index - config.period + 1, index + 1);
      const totalVolumePrice = slice.reduce((sum, candle) => 
        sum + (candle.close * candle.volume), 0);
      const totalVolume = slice.reduce((sum, candle) => 
        sum + candle.volume, 0);
      
      return totalVolume > 0 ? totalVolumePrice / totalVolume : null;
    });
  }
}
```

### 2.2 Momentum Indicators

#### 2.2.1 Relative Strength Index (RSI)

```typescript
interface RSIConfig {
  period: number; // Default: 14
  overbought: number; // Default: 70
  oversold: number; // Default: 30
  source: 'open' | 'high' | 'low' | 'close'; // Default: 'close'
}

interface RSIResult {
  rsi: number[];
  signals: {
    overbought: boolean[];
    oversold: boolean[];
    divergence: DivergenceSignal[];
  };
}

class RelativeStrengthIndex {
  calculate(data: OHLCV[], config: RSIConfig): RSIResult {
    const values = data.map(candle => candle[config.source]);
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate RSI
    const rsi: number[] = [null]; // First value is null
    let avgGain = gains.slice(0, config.period).reduce((a, b) => a + b, 0) / config.period;
    let avgLoss = losses.slice(0, config.period).reduce((a, b) => a + b, 0) / config.period;
    
    for (let i = config.period; i < values.length; i++) {
      if (i === config.period) {
        // First RSI calculation
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      } else {
        // Smoothed RSI calculation
        avgGain = ((avgGain * (config.period - 1)) + gains[i - 1]) / config.period;
        avgLoss = ((avgLoss * (config.period - 1)) + losses[i - 1]) / config.period;
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    
    return {
      rsi,
      signals: this.generateSignals(rsi, config, values)
    };
  }
  
  private generateSignals(rsi: number[], config: RSIConfig, prices: number[]) {
    return {
      overbought: rsi.map(value => value !== null && value > config.overbought),
      oversold: rsi.map(value => value !== null && value < config.oversold),
      divergence: this.detectDivergence(rsi, prices)
    };
  }
}
```

#### 2.2.2 Moving Average Convergence Divergence (MACD)

```typescript
interface MACDConfig {
  fastPeriod: number; // Default: 12
  slowPeriod: number; // Default: 26
  signalPeriod: number; // Default: 9
  source: 'open' | 'high' | 'low' | 'close'; // Default: 'close'
}

interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
  signals: {
    bullishCrossover: boolean[];
    bearishCrossover: boolean[];
    divergence: DivergenceSignal[];
  };
}

class MACD {
  calculate(data: OHLCV[], config: MACDConfig): MACDResult {
    const emaFast = new ExponentialMovingAverage();
    const emaSlow = new ExponentialMovingAverage();
    const emaSignal = new ExponentialMovingAverage();
    
    const fastEMA = emaFast.calculate(data, {
      period: config.fastPeriod,
      source: config.source,
      smoothing: 2
    });
    
    const slowEMA = emaSlow.calculate(data, {
      period: config.slowPeriod,
      source: config.source,
      smoothing: 2
    });
    
    // Calculate MACD line
    const macd = fastEMA.map((fast, index) => 
      fast !== null && slowEMA[index] !== null 
        ? fast - slowEMA[index] 
        : null
    );
    
    // Calculate Signal line (EMA of MACD)
    const signal = emaSignal.calculate(
      macd.map(value => ({ close: value || 0 } as OHLCV)),
      { period: config.signalPeriod, source: 'close', smoothing: 2 }
    );
    
    // Calculate Histogram
    const histogram = macd.map((macdValue, index) =>
      macdValue !== null && signal[index] !== null
        ? macdValue - signal[index]
        : null
    );
    
    return {
      macd,
      signal,
      histogram,
      signals: this.generateSignals(macd, signal, histogram)
    };
  }
}
```

### 2.3 Volatility Indicators

#### 2.3.1 Bollinger Bands

```typescript
interface BollingerBandsConfig {
  period: number; // Default: 20
  standardDeviations: number; // Default: 2
  source: 'open' | 'high' | 'low' | 'close'; // Default: 'close'
}

interface BollingerBandsResult {
  upperBand: number[];
  middleBand: number[]; // SMA
  lowerBand: number[];
  bandwidth: number[];
  percentB: number[];
  signals: {
    squeeze: boolean[];
    breakout: 'upper' | 'lower' | null[];
    meanReversion: boolean[];
  };
}

class BollingerBands {
  calculate(data: OHLCV[], config: BollingerBandsConfig): BollingerBandsResult {
    const sma = new SimpleMovingAverage();
    const values = data.map(candle => candle[config.source]);
    
    const middleBand = sma.calculate(data, {
      period: config.period,
      source: config.source
    });
    
    // Calculate standard deviation
    const standardDeviations = values.map((_, index) => {
      if (index < config.period - 1) return null;
      
      const slice = values.slice(index - config.period + 1, index + 1);
      const mean = middleBand[index];
      const variance = slice.reduce((sum, val) => 
        sum + Math.pow(val - mean, 2), 0) / config.period;
      
      return Math.sqrt(variance);
    });
    
    const upperBand = middleBand.map((middle, index) =>
      middle !== null && standardDeviations[index] !== null
        ? middle + (config.standardDeviations * standardDeviations[index])
        : null
    );
    
    const lowerBand = middleBand.map((middle, index) =>
      middle !== null && standardDeviations[index] !== null
        ? middle - (config.standardDeviations * standardDeviations[index])
        : null
    );
    
    const bandwidth = upperBand.map((upper, index) =>
      upper !== null && lowerBand[index] !== null && middleBand[index] !== null
        ? (upper - lowerBand[index]) / middleBand[index]
        : null
    );
    
    const percentB = values.map((price, index) =>
      upperBand[index] !== null && lowerBand[index] !== null
        ? (price - lowerBand[index]) / (upperBand[index] - lowerBand[index])
        : null
    );
    
    return {
      upperBand,
      middleBand,
      lowerBand,
      bandwidth,
      percentB,
      signals: this.generateSignals(values, upperBand, middleBand, lowerBand, bandwidth)
    };
  }
}
```

#### 2.3.2 Average True Range (ATR)

```typescript
interface ATRConfig {
  period: number; // Default: 14
}

class AverageTrueRange {
  calculate(data: OHLCV[], config: ATRConfig): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    // Calculate ATR using RMA (Running Moving Average)
    const atr: number[] = [null]; // First value is null
    let rma = trueRanges.slice(0, config.period).reduce((a, b) => a + b, 0) / config.period;
    atr.push(rma);
    
    for (let i = config.period; i < trueRanges.length; i++) {
      rma = ((rma * (config.period - 1)) + trueRanges[i]) / config.period;
      atr.push(rma);
    }
    
    return atr;
  }
}
```

### 2.4 Volume Indicators

#### 2.4.1 On-Balance Volume (OBV)

```typescript
class OnBalanceVolume {
  calculate(data: OHLCV[]): number[] {
    const obv: number[] = [data[0]?.volume || 0]; // Start with first volume
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      if (current.close > previous.close) {
        obv.push(obv[i - 1] + current.volume);
      } else if (current.close < previous.close) {
        obv.push(obv[i - 1] - current.volume);
      } else {
        obv.push(obv[i - 1]);
      }
    }
    
    return obv;
  }
}
```

#### 2.4.2 Volume Weighted Average Price (VWAP)

```typescript
interface VWAPConfig {
  resetPeriod: 'session' | 'day' | 'week' | 'month'; // Default: 'day'
}

class VolumeWeightedAveragePrice {
  calculate(data: OHLCV[], config: VWAPConfig): number[] {
    const vwap: number[] = [];
    let cumulativeVolumePrice = 0;
    let cumulativeVolume = 0;
    let resetIndex = 0;
    
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      
      // Check if we need to reset (simplified for daily reset)
      if (this.shouldReset(i, resetIndex, config)) {
        cumulativeVolumePrice = 0;
        cumulativeVolume = 0;
        resetIndex = i;
      }
      
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativeVolumePrice += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      
      vwap.push(cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : typicalPrice);
    }
    
    return vwap;
  }
  
  private shouldReset(currentIndex: number, resetIndex: number, config: VWAPConfig): boolean {
    // Simplified reset logic - implement based on timestamp analysis
    return false;
  }
}
```

## 3. Advanced Pattern Recognition

### 3.1 Fibonacci Retracements

```typescript
interface FibonacciConfig {
  levels: number[]; // Default: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
  swingHighLookback: number; // Default: 20
  swingLowLookback: number; // Default: 20
}

interface FibonacciResult {
  swingHigh: {
    price: number;
    index: number;
  };
  swingLow: {
    price: number;
    index: number;
  };
  levels: {
    level: number;
    price: number;
    percentage: number;
  }[];
}

class FibonacciRetracements {
  calculate(data: OHLCV[], config: FibonacciConfig): FibonacciResult {
    const swingHigh = this.findSwingHigh(data, config.swingHighLookback);
    const swingLow = this.findSwingLow(data, config.swingLowLookback);
    
    const range = swingHigh.price - swingLow.price;
    const levels = config.levels.map(level => ({
      level,
      price: swingHigh.price - (range * level),
      percentage: level * 100
    }));
    
    return {
      swingHigh,
      swingLow,
      levels
    };
  }
  
  private findSwingHigh(data: OHLCV[], lookback: number): {price: number, index: number} {
    let maxPrice = -Infinity;
    let maxIndex = -1;
    
    for (let i = data.length - lookback; i < data.length; i++) {
      if (data[i].high > maxPrice) {
        maxPrice = data[i].high;
        maxIndex = i;
      }
    }
    
    return { price: maxPrice, index: maxIndex };
  }
  
  private findSwingLow(data: OHLCV[], lookback: number): {price: number, index: number} {
    let minPrice = Infinity;
    let minIndex = -1;
    
    for (let i = data.length - lookback; i < data.length; i++) {
      if (data[i].low < minPrice) {
        minPrice = data[i].low;
        minIndex = i;
      }
    }
    
    return { price: minPrice, index: minIndex };
  }
}
```

### 3.2 Support and Resistance Detection

```typescript
interface SupportResistanceConfig {
  lookback: number; // Default: 50
  touchThreshold: number; // Default: 0.02 (2%)
  minTouches: number; // Default: 2
  strengthPeriod: number; // Default: 20
}

interface SupportResistanceLevel {
  price: number;
  strength: number; // 0-100
  touches: number;
  type: 'support' | 'resistance';
  isActive: boolean;
  firstTouch: number; // index
  lastTouch: number; // index
}

class SupportResistanceDetector {
  detect(data: OHLCV[], config: SupportResistanceConfig): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const pivotHighs = this.findPivotHighs(data, config.lookback);
    const pivotLows = this.findPivotLows(data, config.lookback);
    
    // Group similar price levels
    const resistanceClusters = this.clusterPrices(pivotHighs, config.touchThreshold);
    const supportClusters = this.clusterPrices(pivotLows, config.touchThreshold);
    
    // Create resistance levels
    resistanceClusters.forEach(cluster => {
      if (cluster.length >= config.minTouches) {
        const level = this.createLevel(cluster, 'resistance', config);
        levels.push(level);
      }
    });
    
    // Create support levels
    supportClusters.forEach(cluster => {
      if (cluster.length >= config.minTouches) {
        const level = this.createLevel(cluster, 'support', config);
        levels.push(level);
      }
    });
    
    return levels.sort((a, b) => b.strength - a.strength);
  }
  
  private findPivotHighs(data: OHLCV[], lookback: number): {price: number, index: number}[] {
    const pivots: {price: number, index: number}[] = [];
    
    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      let isPivot = true;
      
      // Check if current high is higher than surrounding highs
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].high >= current.high) {
          isPivot = false;
          break;
        }
      }
      
      if (isPivot) {
        pivots.push({ price: current.high, index: i });
      }
    }
    
    return pivots;
  }
  
  private findPivotLows(data: OHLCV[], lookback: number): {price: number, index: number}[] {
    const pivots: {price: number, index: number}[] = [];
    
    for (let i = lookback; i < data.length - lookback; i++) {
      const current = data[i];
      let isPivot = true;
      
      // Check if current low is lower than surrounding lows
      for (let j = i - lookback; j <= i + lookback; j++) {
        if (j !== i && data[j].low <= current.low) {
          isPivot = false;
          break;
        }
      }
      
      if (isPivot) {
        pivots.push({ price: current.low, index: i });
      }
    }
    
    return pivots;
  }
}
```

## 4. Performance Optimization

### 4.1 Calculation Optimization

```typescript
interface IndicatorCalculationStrategy {
  // Use incremental calculation for real-time updates
  incremental: boolean;
  
  // Batch calculation for historical data
  batchSize: number;
  
  // Caching strategy
  cacheResults: boolean;
  
  // Web Worker usage for heavy calculations
  useWebWorker: boolean;
}

class OptimizedIndicatorEngine {
  private cache = new Map<string, any>();
  private worker: Worker | null = null;
  
  constructor(private strategy: IndicatorCalculationStrategy) {
    if (strategy.useWebWorker) {
      this.initializeWebWorker();
    }
  }
  
  async calculateIndicator<T>(
    indicator: string,
    data: OHLCV[],
    config: any
  ): Promise<T> {
    const cacheKey = this.generateCacheKey(indicator, data, config);
    
    if (this.strategy.cacheResults && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    let result: T;
    
    if (this.strategy.useWebWorker && data.length > 10000) {
      result = await this.calculateInWorker(indicator, data, config);
    } else {
      result = this.calculateInMainThread(indicator, data, config);
    }
    
    if (this.strategy.cacheResults) {
      this.cache.set(cacheKey, result);
    }
    
    return result;
  }
  
  private async calculateInWorker<T>(
    indicator: string,
    data: OHLCV[],
    config: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Web Worker not initialized'));
        return;
      }
      
      this.worker.postMessage({ indicator, data, config });
      
      this.worker.onmessage = (event) => {
        resolve(event.data);
      };
      
      this.worker.onerror = (error) => {
        reject(error);
      };
    });
  }
}
```

### 4.2 Real-time Update Strategy

```typescript
interface RealTimeUpdateConfig {
  indicators: string[];
  updateFrequency: number; // milliseconds
  batchUpdates: boolean;
  maxBatchSize: number;
}

class RealTimeIndicatorUpdater {
  private pendingUpdates: MarketDataUpdate[] = [];
  private updateTimer: NodeJS.Timeout | null = null;
  
  constructor(
    private config: RealTimeUpdateConfig,
    private indicatorEngine: OptimizedIndicatorEngine
  ) {}
  
  addUpdate(update: MarketDataUpdate): void {
    this.pendingUpdates.push(update);
    
    if (this.config.batchUpdates) {
      if (this.pendingUpdates.length >= this.config.maxBatchSize) {
        this.processBatch();
      } else if (!this.updateTimer) {
        this.updateTimer = setTimeout(() => {
          this.processBatch();
        }, this.config.updateFrequency);
      }
    } else {
      this.processUpdate(update);
    }
  }
  
  private processBatch(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
    
    const updates = [...this.pendingUpdates];
    this.pendingUpdates = [];
    
    updates.forEach(update => this.processUpdate(update));
  }
  
  private async processUpdate(update: MarketDataUpdate): Promise<void> {
    // Update only the last few values instead of recalculating everything
    const incrementalData = this.getIncrementalData(update);
    
    for (const indicatorName of this.config.indicators) {
      await this.updateIndicator(indicatorName, incrementalData);
    }
  }
}
```

## 5. Visualization Specifications

### 5.1 Chart Overlay Requirements

```typescript
interface IndicatorVisualization {
  id: string;
  name: string;
  type: 'line' | 'area' | 'histogram' | 'band' | 'level';
  panel: 'main' | 'separate';
  zIndex: number;
  style: {
    color: string;
    lineWidth: number;
    opacity: number;
    dashArray?: number[];
  };
  interactivity: {
    tooltip: boolean;
    crosshair: boolean;
    zoom: boolean;
  };
}

// Example configurations
const INDICATOR_VISUALIZATIONS: Record<string, IndicatorVisualization> = {
  sma: {
    id: 'sma',
    name: 'Simple Moving Average',
    type: 'line',
    panel: 'main',
    zIndex: 1,
    style: { color: '#ff6b6b', lineWidth: 2, opacity: 0.8 },
    interactivity: { tooltip: true, crosshair: true, zoom: true }
  },
  
  bollinger: {
    id: 'bollinger',
    name: 'Bollinger Bands',
    type: 'band',
    panel: 'main',
    zIndex: 0,
    style: { color: '#4ecdc4', lineWidth: 1, opacity: 0.3 },
    interactivity: { tooltip: true, crosshair: false, zoom: true }
  },
  
  rsi: {
    id: 'rsi',
    name: 'RSI',
    type: 'line',
    panel: 'separate',
    zIndex: 1,
    style: { color: '#45b7d1', lineWidth: 2, opacity: 1 },
    interactivity: { tooltip: true, crosshair: true, zoom: true }
  }
};
```

### 5.2 Performance Monitoring

```typescript
interface IndicatorPerformanceMetrics {
  calculationTime: number; // milliseconds
  memoryUsage: number; // bytes
  cacheHitRate: number; // percentage
  updateFrequency: number; // per second
  errorRate: number; // percentage
}

class IndicatorPerformanceMonitor {
  private metrics = new Map<string, IndicatorPerformanceMetrics>();
  
  recordCalculation(indicator: string, startTime: number, endTime: number): void {
    const calculationTime = endTime - startTime;
    const existing = this.metrics.get(indicator) || this.getDefaultMetrics();
    
    existing.calculationTime = (existing.calculationTime + calculationTime) / 2; // Rolling average
    this.metrics.set(indicator, existing);
  }
  
  getPerformanceReport(): Record<string, IndicatorPerformanceMetrics> {
    return Object.fromEntries(this.metrics);
  }
  
  private getDefaultMetrics(): IndicatorPerformanceMetrics {
    return {
      calculationTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      updateFrequency: 0,
      errorRate: 0
    };
  }
}
```

## 6. Implementation Guidelines

### 6.1 Error Handling

```typescript
class IndicatorCalculationError extends Error {
  constructor(
    public indicator: string,
    public config: any,
    message: string,
    public originalError?: Error
  ) {
    super(`${indicator} calculation failed: ${message}`);
  }
}

class SafeIndicatorCalculator {
  async calculate<T>(
    indicator: string,
    data: OHLCV[],
    config: any
  ): Promise<T | null> {
    try {
      // Validate input data
      if (!data || data.length === 0) {
        throw new Error('No data provided');
      }
      
      if (data.some(candle => this.isInvalidCandle(candle))) {
        throw new Error('Invalid candle data detected');
      }
      
      // Perform calculation
      return await this.performCalculation<T>(indicator, data, config);
      
    } catch (error) {
      console.error(new IndicatorCalculationError(indicator, config, error.message, error));
      return null;
    }
  }
  
  private isInvalidCandle(candle: OHLCV): boolean {
    return !candle ||
           typeof candle.open !== 'number' ||
           typeof candle.high !== 'number' ||
           typeof candle.low !== 'number' ||
           typeof candle.close !== 'number' ||
           typeof candle.volume !== 'number' ||
           candle.high < candle.low ||
           candle.open < 0 ||
           candle.volume < 0;
  }
}
```

### 6.2 Testing Strategy

```typescript
// Example test specification
describe('Technical Indicators', () => {
  describe('Simple Moving Average', () => {
    it('should calculate SMA correctly with valid data', () => {
      const data = generateTestData(100);
      const sma = new SimpleMovingAverage();
      const result = sma.calculate(data, { period: 20, source: 'close' });
      
      expect(result).toHaveLength(100);
      expect(result.slice(0, 19)).toEqual(Array(19).fill(null));
      expect(result[19]).toBeCloseTo(data.slice(0, 20).reduce((sum, candle) => sum + candle.close, 0) / 20);
    });
    
    it('should handle edge cases gracefully', () => {
      const sma = new SimpleMovingAverage();
      
      expect(() => sma.calculate([], { period: 20, source: 'close' })).not.toThrow();
      expect(() => sma.calculate(generateTestData(5), { period: 20, source: 'close' })).not.toThrow();
    });
    
    it('should meet performance requirements', () => {
      const data = generateTestData(1000);
      const sma = new SimpleMovingAverage();
      
      const startTime = performance.now();
      sma.calculate(data, { period: 20, source: 'close' });
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1); // <1ms requirement
    });
  });
});
```

## 7. Configuration Management

### 7.1 Default Configurations

```typescript
export const DEFAULT_INDICATOR_CONFIGS = {
  sma: { period: 20, source: 'close' },
  ema: { period: 20, source: 'close', smoothing: 2 },
  rsi: { period: 14, overbought: 70, oversold: 30, source: 'close' },
  macd: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, source: 'close' },
  bollinger: { period: 20, standardDeviations: 2, source: 'close' },
  atr: { period: 14 },
  stochastic: { kPeriod: 14, dPeriod: 3, smooth: 3 },
  fibonacci: { levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] }
} as const;
```

### 7.2 User Customization

```typescript
interface UserIndicatorSettings {
  userId: string;
  indicators: Record<string, any>;
  visualizations: Record<string, IndicatorVisualization>;
  alerts: AlertConfiguration[];
}

class IndicatorSettingsManager {
  async saveUserSettings(settings: UserIndicatorSettings): Promise<void> {
    // Validate settings
    this.validateSettings(settings);
    
    // Save to database
    await this.persistSettings(settings);
  }
  
  async loadUserSettings(userId: string): Promise<UserIndicatorSettings> {
    return await this.retrieveSettings(userId);
  }
  
  private validateSettings(settings: UserIndicatorSettings): void {
    // Validate indicator configurations
    // Validate visualization settings
    // Validate alert configurations
  }
}
```

This specification provides a comprehensive framework for implementing technical analysis indicators with high performance, accuracy, and user experience requirements for the crypto portfolio application.