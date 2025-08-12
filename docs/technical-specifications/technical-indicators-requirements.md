# Technical Analysis Indicators Requirements

## Overview
Comprehensive specification for implementing technical analysis indicators with real-time calculation and visualization capabilities.

## 1. Moving Averages (MA)

### 1.1 Simple Moving Average (SMA)

#### Functional Requirements
- **FR-1.1.1**: Calculate SMA for configurable periods (5, 10, 20, 50, 100, 200)
- **FR-1.1.2**: Real-time updates with new price data
- **FR-1.1.3**: Multiple SMA overlays on single chart
- **FR-1.1.4**: Customizable styling (color, thickness, line type)

#### Technical Specification
```typescript
interface SMAConfig {
  period: number;
  source: 'close' | 'open' | 'high' | 'low' | 'hlc3' | 'ohlc4';
  style: LineStyle;
}

class SimpleMovingAverage {
  private period: number;
  private values: number[] = [];
  
  calculate(price: number): number | null {
    this.values.push(price);
    
    if (this.values.length < this.period) {
      return null;
    }
    
    if (this.values.length > this.period) {
      this.values.shift();
    }
    
    return this.values.reduce((sum, val) => sum + val, 0) / this.period;
  }
}
```

#### Performance Requirements
- **PR-1.1.1**: Calculation time < 1ms per data point
- **PR-1.1.2**: Memory usage O(period) for rolling window
- **PR-1.1.3**: Support for 10,000+ historical data points

### 1.2 Exponential Moving Average (EMA)

#### Functional Requirements
- **FR-1.2.1**: EMA calculation with configurable smoothing factor
- **FR-1.2.2**: Real-time streaming updates
- **FR-1.2.3**: Multiple timeframe support
- **FR-1.2.4**: Crossover signal detection

#### Technical Specification
```typescript
class ExponentialMovingAverage {
  private multiplier: number;
  private previousEMA: number | null = null;
  
  constructor(period: number) {
    this.multiplier = 2 / (period + 1);
  }
  
  calculate(price: number): number {
    if (this.previousEMA === null) {
      this.previousEMA = price;
      return price;
    }
    
    this.previousEMA = (price * this.multiplier) + (this.previousEMA * (1 - this.multiplier));
    return this.previousEMA;
  }
}
```

## 2. Relative Strength Index (RSI)

### Functional Requirements
- **FR-2.1**: RSI calculation with configurable period (default 14)
- **FR-2.2**: Overbought/oversold level indicators (70/30 or 80/20)
- **FR-2.3**: Divergence detection
- **FR-2.4**: Multi-timeframe RSI analysis
- **FR-2.5**: RSI-based signal generation

### Technical Specification
```typescript
interface RSIConfig {
  period: number;
  overbought: number;
  oversold: number;
  source: PriceSource;
}

class RelativeStrengthIndex {
  private period: number;
  private gains: number[] = [];
  private losses: number[] = [];
  private previousClose: number | null = null;
  
  constructor(period: number = 14) {
    this.period = period;
  }
  
  calculate(price: number): number | null {
    if (this.previousClose === null) {
      this.previousClose = price;
      return null;
    }
    
    const change = price - this.previousClose;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    this.gains.push(gain);
    this.losses.push(loss);
    
    if (this.gains.length > this.period) {
      this.gains.shift();
      this.losses.shift();
    }
    
    if (this.gains.length < this.period) {
      this.previousClose = price;
      return null;
    }
    
    const avgGain = this.gains.reduce((sum, val) => sum + val, 0) / this.period;
    const avgLoss = this.losses.reduce((sum, val) => sum + val, 0) / this.period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    this.previousClose = price;
    return rsi;
  }
  
  getSignal(rsi: number): 'overbought' | 'oversold' | 'neutral' {
    if (rsi >= 70) return 'overbought';
    if (rsi <= 30) return 'oversold';
    return 'neutral';
  }
}
```

### Visualization Requirements
- **VR-2.1**: Separate panel below price chart
- **VR-2.2**: Horizontal reference lines at 30, 50, 70
- **VR-2.3**: Color-coded zones (green/red for oversold/overbought)
- **VR-2.4**: Divergence highlighting

## 3. MACD (Moving Average Convergence Divergence)

### Functional Requirements
- **FR-3.1**: MACD line calculation (12-period EMA - 26-period EMA)
- **FR-3.2**: Signal line calculation (9-period EMA of MACD)
- **FR-3.3**: Histogram calculation (MACD - Signal)
- **FR-3.4**: Zero-line crossover detection
- **FR-3.5**: Signal line crossover detection
- **FR-3.6**: Bullish/bearish divergence identification

### Technical Specification
```typescript
interface MACDConfig {
  fastPeriod: number;    // Default: 12
  slowPeriod: number;    // Default: 26
  signalPeriod: number;  // Default: 9
}

class MACD {
  private fastEMA: ExponentialMovingAverage;
  private slowEMA: ExponentialMovingAverage;
  private signalEMA: ExponentialMovingAverage;
  private macdValues: number[] = [];
  
  constructor(config: MACDConfig = { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }) {
    this.fastEMA = new ExponentialMovingAverage(config.fastPeriod);
    this.slowEMA = new ExponentialMovingAverage(config.slowPeriod);
    this.signalEMA = new ExponentialMovingAverage(config.signalPeriod);
  }
  
  calculate(price: number): MACDResult | null {
    const fastValue = this.fastEMA.calculate(price);
    const slowValue = this.slowEMA.calculate(price);
    
    if (fastValue === null || slowValue === null) {
      return null;
    }
    
    const macdLine = fastValue - slowValue;
    const signalLine = this.signalEMA.calculate(macdLine);
    
    if (signalLine === null) {
      return null;
    }
    
    const histogram = macdLine - signalLine;
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram,
      crossover: this.detectCrossover(macdLine, signalLine)
    };
  }
  
  private detectCrossover(macd: number, signal: number): 'bullish' | 'bearish' | null {
    // Implementation for crossover detection
    return null;
  }
}

interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover: 'bullish' | 'bearish' | null;
}
```

## 4. Bollinger Bands

### Functional Requirements
- **FR-4.1**: Middle band (SMA) calculation
- **FR-4.2**: Upper/lower bands (SMA ± 2*standard deviation)
- **FR-4.3**: Configurable period and deviation multiplier
- **FR-4.4**: Band squeeze detection
- **FR-4.5**: Price breakout identification
- **FR-4.6**: %B calculation (position within bands)

### Technical Specification
```typescript
interface BollingerBandsConfig {
  period: number;        // Default: 20
  multiplier: number;    // Default: 2
  source: PriceSource;
}

class BollingerBands {
  private period: number;
  private multiplier: number;
  private values: number[] = [];
  
  constructor(config: BollingerBandsConfig = { period: 20, multiplier: 2, source: 'close' }) {
    this.period = config.period;
    this.multiplier = config.multiplier;
  }
  
  calculate(price: number): BollingerBandsResult | null {
    this.values.push(price);
    
    if (this.values.length > this.period) {
      this.values.shift();
    }
    
    if (this.values.length < this.period) {
      return null;
    }
    
    const sma = this.values.reduce((sum, val) => sum + val, 0) / this.period;
    const variance = this.values.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / this.period;
    const standardDeviation = Math.sqrt(variance);
    
    const upperBand = sma + (this.multiplier * standardDeviation);
    const lowerBand = sma - (this.multiplier * standardDeviation);
    
    // %B calculation
    const percentB = (price - lowerBand) / (upperBand - lowerBand);
    
    return {
      upper: upperBand,
      middle: sma,
      lower: lowerBand,
      percentB: percentB,
      bandwidth: (upperBand - lowerBand) / sma
    };
  }
}

interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  percentB: number;
  bandwidth: number;
}
```

## 5. Additional Technical Indicators

### 5.1 Volume-Based Indicators

#### On-Balance Volume (OBV)
```typescript
class OnBalanceVolume {
  private previousOBV: number = 0;
  private previousClose: number | null = null;
  
  calculate(price: number, volume: number): number {
    if (this.previousClose === null) {
      this.previousClose = price;
      return volume;
    }
    
    if (price > this.previousClose) {
      this.previousOBV += volume;
    } else if (price < this.previousClose) {
      this.previousOBV -= volume;
    }
    
    this.previousClose = price;
    return this.previousOBV;
  }
}
```

#### Volume Weighted Average Price (VWAP)
```typescript
class VWAP {
  private cumulativeVolume: number = 0;
  private cumulativePriceVolume: number = 0;
  
  calculate(price: number, volume: number): number {
    this.cumulativeVolume += volume;
    this.cumulativePriceVolume += (price * volume);
    
    return this.cumulativePriceVolume / this.cumulativeVolume;
  }
}
```

### 5.2 Momentum Indicators

#### Stochastic Oscillator
```typescript
interface StochasticConfig {
  kPeriod: number;    // Default: 14
  dPeriod: number;    // Default: 3
  smooth: number;     // Default: 3
}

class StochasticOscillator {
  private kPeriod: number;
  private dPeriod: number;
  private highs: number[] = [];
  private lows: number[] = [];
  private closes: number[] = [];
  
  calculate(high: number, low: number, close: number): StochasticResult | null {
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);
    
    if (this.highs.length > this.kPeriod) {
      this.highs.shift();
      this.lows.shift();
      this.closes.shift();
    }
    
    if (this.highs.length < this.kPeriod) {
      return null;
    }
    
    const highestHigh = Math.max(...this.highs);
    const lowestLow = Math.min(...this.lows);
    
    const kPercent = ((close - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    return {
      k: kPercent,
      d: 0 // Implement D% calculation
    };
  }
}
```

## 6. Indicator Management System

### Functional Requirements
- **FR-6.1**: Dynamic indicator addition/removal
- **FR-6.2**: Indicator parameter customization
- **FR-6.3**: Indicator calculation optimization
- **FR-6.4**: Signal aggregation and filtering
- **FR-6.5**: Historical calculation for backtesting

### Technical Architecture
```typescript
interface IndicatorManager {
  indicators: Map<string, TechnicalIndicator>;
  
  addIndicator(name: string, indicator: TechnicalIndicator): void;
  removeIndicator(name: string): void;
  updateIndicators(priceData: PriceData): IndicatorResults;
  getSignals(): TradingSignal[];
}

class TechnicalAnalysisEngine implements IndicatorManager {
  private indicators = new Map<string, TechnicalIndicator>();
  
  updateIndicators(priceData: PriceData): IndicatorResults {
    const results: IndicatorResults = {};
    
    for (const [name, indicator] of this.indicators) {
      results[name] = indicator.calculate(priceData);
    }
    
    return results;
  }
  
  getSignals(): TradingSignal[] {
    const signals: TradingSignal[] = [];
    
    // Aggregate signals from all indicators
    for (const [name, indicator] of this.indicators) {
      const signal = indicator.getSignal();
      if (signal) {
        signals.push({
          indicator: name,
          type: signal.type,
          strength: signal.strength,
          timestamp: Date.now()
        });
      }
    }
    
    return signals;
  }
}
```

## 7. Performance Optimization

### Calculation Efficiency
- **OPT-7.1**: Incremental calculations for streaming data
- **OPT-7.2**: Lazy evaluation for inactive indicators
- **OPT-7.3**: Memory-efficient circular buffers
- **OPT-7.4**: Web Worker offloading for heavy calculations

### Caching Strategy
```typescript
class IndicatorCache {
  private cache = new Map<string, CacheEntry>();
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (entry && entry.timestamp > Date.now() - entry.ttl) {
      return entry.value;
    }
    return null;
  }
  
  set(key: string, value: any, ttl: number = 60000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }
}
```

## 8. Testing Requirements

### Unit Testing
- **UT-8.1**: Mathematical accuracy validation
- **UT-8.2**: Edge case handling (insufficient data, NaN values)
- **UT-8.3**: Performance benchmarking
- **UT-8.4**: Memory leak detection

### Integration Testing
- **IT-8.1**: Real-time data stream processing
- **IT-8.2**: Multiple indicator interaction
- **IT-8.3**: Visualization synchronization
- **IT-8.4**: Signal generation accuracy

## Success Metrics
- Calculation accuracy: 99.99% compared to reference implementations
- Real-time update latency: < 10ms per indicator
- Memory usage: < 50MB for 10 active indicators
- CPU usage: < 5% during active trading hours
- Signal detection rate: > 95% for known patterns