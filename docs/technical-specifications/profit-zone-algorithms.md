# Profit Zone Calculation Algorithms

## Overview
Advanced algorithms for identifying and calculating profit zones using support/resistance levels, market structure analysis, and dynamic risk management.

## 1. Support and Resistance Level Detection

### 1.1 Pivot Point Analysis

#### Functional Requirements
- **FR-1.1.1**: Identify pivot highs and lows using configurable lookback periods
- **FR-1.1.2**: Calculate pivot point strength based on touch frequency
- **FR-1.1.3**: Dynamic level adjustment based on market volatility
- **FR-1.1.4**: Multi-timeframe support/resistance confluence

#### Technical Specification
```typescript
interface PivotPointConfig {
  leftBars: number;     // Lookback period (default: 5)
  rightBars: number;    // Look-ahead period (default: 5)
  minStrength: number;  // Minimum touches to confirm level
  maxAge: number;       // Maximum age in milliseconds
}

class PivotPointDetector {
  private config: PivotPointConfig;
  private priceHistory: PriceData[] = [];
  private pivotLevels: PivotLevel[] = [];
  
  constructor(config: PivotPointConfig) {
    this.config = config;
  }
  
  detectPivots(priceData: PriceData[]): PivotLevel[] {
    const pivots: PivotLevel[] = [];
    
    for (let i = this.config.leftBars; i < priceData.length - this.config.rightBars; i++) {
      const currentCandle = priceData[i];
      
      // Check for pivot high
      if (this.isPivotHigh(priceData, i)) {
        pivots.push({
          type: 'resistance',
          price: currentCandle.high,
          timestamp: currentCandle.timestamp,
          strength: this.calculateStrength(priceData, currentCandle.high, 'high'),
          touches: 1,
          confirmed: false
        });
      }
      
      // Check for pivot low
      if (this.isPivotLow(priceData, i)) {
        pivots.push({
          type: 'support',
          price: currentCandle.low,
          timestamp: currentCandle.timestamp,
          strength: this.calculateStrength(priceData, currentCandle.low, 'low'),
          touches: 1,
          confirmed: false
        });
      }
    }
    
    return this.filterAndConfirmPivots(pivots);
  }
  
  private isPivotHigh(data: PriceData[], index: number): boolean {
    const current = data[index];
    
    // Check left side
    for (let i = index - this.config.leftBars; i < index; i++) {
      if (data[i].high >= current.high) return false;
    }
    
    // Check right side
    for (let i = index + 1; i <= index + this.config.rightBars; i++) {
      if (data[i].high >= current.high) return false;
    }
    
    return true;
  }
  
  private isPivotLow(data: PriceData[], index: number): boolean {
    const current = data[index];
    
    // Check left side
    for (let i = index - this.config.leftBars; i < index; i++) {
      if (data[i].low <= current.low) return false;
    }
    
    // Check right side
    for (let i = index + 1; i <= index + this.config.rightBars; i++) {
      if (data[i].low <= current.low) return false;
    }
    
    return true;
  }
  
  private calculateStrength(data: PriceData[], level: number, type: 'high' | 'low'): number {
    let touches = 0;
    const tolerance = this.calculateTolerance(level);
    
    for (const candle of data) {
      const testPrice = type === 'high' ? candle.high : candle.low;
      if (Math.abs(testPrice - level) <= tolerance) {
        touches++;
      }
    }
    
    return touches;
  }
  
  private calculateTolerance(price: number): number {
    // Dynamic tolerance based on price and volatility
    return price * 0.002; // 0.2% tolerance
  }
}

interface PivotLevel {
  type: 'support' | 'resistance';
  price: number;
  timestamp: number;
  strength: number;
  touches: number;
  confirmed: boolean;
}
```

### 1.2 Volume Profile Analysis

#### Functional Requirements
- **FR-1.2.1**: Calculate volume-at-price distribution
- **FR-1.2.2**: Identify high-volume nodes (HVN) and low-volume nodes (LVN)
- **FR-1.2.3**: Point of Control (POC) identification
- **FR-1.2.4**: Value Area calculation (70% of volume)

#### Technical Specification
```typescript
interface VolumeProfileConfig {
  bins: number;           // Number of price bins (default: 100)
  valueAreaPercent: number; // Percentage for value area (default: 0.7)
  period: number;         // Lookback period in minutes
}

class VolumeProfileAnalyzer {
  private config: VolumeProfileConfig;
  
  constructor(config: VolumeProfileConfig) {
    this.config = config;
  }
  
  calculateVolumeProfile(data: PriceData[]): VolumeProfile {
    const priceRange = this.getPriceRange(data);
    const binSize = (priceRange.max - priceRange.min) / this.config.bins;
    const volumeBins = new Map<number, number>();
    
    // Distribute volume across price bins
    for (const candle of data) {
      const avgPrice = (candle.high + candle.low + candle.close) / 3;
      const binIndex = Math.floor((avgPrice - priceRange.min) / binSize);
      const binPrice = priceRange.min + (binIndex * binSize);
      
      volumeBins.set(binPrice, (volumeBins.get(binPrice) || 0) + candle.volume);
    }
    
    const sortedBins = Array.from(volumeBins.entries())
      .sort((a, b) => b[1] - a[1]);
    
    const poc = sortedBins[0]; // Point of Control
    const valueArea = this.calculateValueArea(sortedBins);
    const hvnLevels = this.identifyHVNLevels(sortedBins);
    
    return {
      poc: { price: poc[0], volume: poc[1] },
      valueArea,
      hvnLevels,
      totalVolume: Array.from(volumeBins.values()).reduce((sum, vol) => sum + vol, 0)
    };
  }
  
  private calculateValueArea(sortedBins: [number, number][]): ValueArea {
    const totalVolume = sortedBins.reduce((sum, bin) => sum + bin[1], 0);
    const targetVolume = totalVolume * this.config.valueAreaPercent;
    
    let accumulatedVolume = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    
    for (const [price, volume] of sortedBins) {
      accumulatedVolume += volume;
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
      
      if (accumulatedVolume >= targetVolume) {
        break;
      }
    }
    
    return { high: maxPrice, low: minPrice, volume: accumulatedVolume };
  }
  
  private identifyHVNLevels(sortedBins: [number, number][]): HVNLevel[] {
    const avgVolume = sortedBins.reduce((sum, bin) => sum + bin[1], 0) / sortedBins.length;
    const threshold = avgVolume * 1.5; // 50% above average
    
    return sortedBins
      .filter(bin => bin[1] >= threshold)
      .map(bin => ({ price: bin[0], volume: bin[1], strength: bin[1] / avgVolume }));
  }
}

interface VolumeProfile {
  poc: { price: number; volume: number };
  valueArea: ValueArea;
  hvnLevels: HVNLevel[];
  totalVolume: number;
}

interface ValueArea {
  high: number;
  low: number;
  volume: number;
}

interface HVNLevel {
  price: number;
  volume: number;
  strength: number;
}
```

## 2. Profit Zone Identification

### 2.1 Zone-Based Analysis

#### Functional Requirements
- **FR-2.1.1**: Identify potential profit zones between support/resistance levels
- **FR-2.1.2**: Calculate zone strength based on multiple confirmation factors
- **FR-2.1.3**: Dynamic zone adjustment based on market conditions
- **FR-2.1.4**: Risk-reward ratio calculation for each zone

#### Technical Specification
```typescript
interface ProfitZoneConfig {
  minZoneSize: number;      // Minimum zone size in price points
  maxZoneAge: number;       // Maximum zone age in milliseconds
  riskRewardRatio: number;  // Minimum risk-reward ratio
  confirmationFactors: ConfirmationFactor[];
}

class ProfitZoneAnalyzer {
  private config: ProfitZoneConfig;
  private pivotDetector: PivotPointDetector;
  private volumeAnalyzer: VolumeProfileAnalyzer;
  
  constructor(config: ProfitZoneConfig) {
    this.config = config;
    this.pivotDetector = new PivotPointDetector();
    this.volumeAnalyzer = new VolumeProfileAnalyzer();
  }
  
  identifyProfitZones(data: PriceData[], currentPrice: number): ProfitZone[] {
    const pivots = this.pivotDetector.detectPivots(data);
    const volumeProfile = this.volumeAnalyzer.calculateVolumeProfile(data);
    const zones: ProfitZone[] = [];
    
    // Create zones between support and resistance levels
    const supportLevels = pivots.filter(p => p.type === 'support').sort((a, b) => a.price - b.price);
    const resistanceLevels = pivots.filter(p => p.type === 'resistance').sort((a, b) => a.price - b.price);
    
    // Identify zones above current price (long opportunities)
    const nearestResistance = this.findNearestLevel(resistanceLevels, currentPrice, 'above');
    const nearestSupport = this.findNearestLevel(supportLevels, currentPrice, 'below');
    
    if (nearestResistance && nearestSupport) {
      const longZone = this.createProfitZone({
        type: 'long',
        entry: currentPrice,
        target: nearestResistance.price,
        stopLoss: nearestSupport.price,
        data,
        volumeProfile
      });
      
      if (this.validateZone(longZone)) {
        zones.push(longZone);
      }
    }
    
    // Identify zones below current price (short opportunities)
    const nearestSupportBelow = this.findNearestLevel(supportLevels, currentPrice, 'below');
    const nearestResistanceAbove = this.findNearestLevel(resistanceLevels, currentPrice, 'above');
    
    if (nearestSupportBelow && nearestResistanceAbove) {
      const shortZone = this.createProfitZone({
        type: 'short',
        entry: currentPrice,
        target: nearestSupportBelow.price,
        stopLoss: nearestResistanceAbove.price,
        data,
        volumeProfile
      });
      
      if (this.validateZone(shortZone)) {
        zones.push(shortZone);
      }
    }
    
    return this.rankZones(zones);
  }
  
  private createProfitZone(params: {
    type: 'long' | 'short';
    entry: number;
    target: number;
    stopLoss: number;
    data: PriceData[];
    volumeProfile: VolumeProfile;
  }): ProfitZone {
    const { type, entry, target, stopLoss, data, volumeProfile } = params;
    
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(target - entry);
    const riskRewardRatio = reward / risk;
    
    const strength = this.calculateZoneStrength({
      entry,
      target,
      stopLoss,
      data,
      volumeProfile,
      type
    });
    
    return {
      id: this.generateZoneId(),
      type,
      entry: {
        price: entry,
        timestamp: Date.now()
      },
      target: {
        price: target,
        probability: this.calculateTargetProbability(entry, target, data)
      },
      stopLoss: {
        price: stopLoss,
        probability: this.calculateStopLossProbability(entry, stopLoss, data)
      },
      riskRewardRatio,
      strength,
      confidence: this.calculateConfidence(strength, riskRewardRatio),
      timeframe: this.estimateTimeframe(entry, target, data),
      volume: this.getZoneVolume(entry, target, volumeProfile)
    };
  }
  
  private calculateZoneStrength(params: {
    entry: number;
    target: number;
    stopLoss: number;
    data: PriceData[];
    volumeProfile: VolumeProfile;
    type: 'long' | 'short';
  }): number {
    let strength = 0;
    
    // Factor 1: Volume confirmation
    const zoneVolume = this.getZoneVolume(params.entry, params.target, params.volumeProfile);
    const avgVolume = params.volumeProfile.totalVolume / 100; // Simplified
    strength += (zoneVolume / avgVolume) * 0.3;
    
    // Factor 2: Technical indicator confluence
    const indicators = this.calculateIndicatorConfluence(params.data, params.entry);
    strength += indicators * 0.25;
    
    // Factor 3: Historical level significance
    const historicalSignificance = this.calculateHistoricalSignificance(params.target, params.data);
    strength += historicalSignificance * 0.25;
    
    // Factor 4: Market structure alignment
    const marketStructure = this.analyzeMarketStructure(params.data, params.type);
    strength += marketStructure * 0.2;
    
    return Math.min(strength, 1.0); // Cap at 1.0
  }
  
  private calculateIndicatorConfluence(data: PriceData[], price: number): number {
    // Calculate confluence of multiple technical indicators
    let confluence = 0;
    const latest = data[data.length - 1];
    
    // Moving average confluence
    const sma20 = this.calculateSMA(data, 20);
    const sma50 = this.calculateSMA(data, 50);
    
    if (sma20 && sma50) {
      if (price > sma20 && sma20 > sma50) confluence += 0.3; // Bullish alignment
      if (price < sma20 && sma20 < sma50) confluence += 0.3; // Bearish alignment
    }
    
    // RSI confluence
    const rsi = this.calculateRSI(data, 14);
    if (rsi) {
      if (rsi < 30 && price > latest.close) confluence += 0.2; // Oversold + price above
      if (rsi > 70 && price < latest.close) confluence += 0.2; // Overbought + price below
    }
    
    // Volume confluence
    const recentVolume = data.slice(-5).reduce((sum, candle) => sum + candle.volume, 0) / 5;
    const avgVolume = data.reduce((sum, candle) => sum + candle.volume, 0) / data.length;
    
    if (recentVolume > avgVolume * 1.5) confluence += 0.2;
    
    return Math.min(confluence, 1.0);
  }
  
  private validateZone(zone: ProfitZone): boolean {
    return (
      zone.riskRewardRatio >= this.config.riskRewardRatio &&
      zone.strength >= 0.3 &&
      zone.confidence >= 0.4 &&
      Math.abs(zone.target.price - zone.entry.price) >= this.config.minZoneSize
    );
  }
  
  private rankZones(zones: ProfitZone[]): ProfitZone[] {
    return zones.sort((a, b) => {
      const scoreA = (a.strength * 0.4) + (a.confidence * 0.3) + (a.riskRewardRatio * 0.3);
      const scoreB = (b.strength * 0.4) + (b.confidence * 0.3) + (b.riskRewardRatio * 0.3);
      return scoreB - scoreA;
    });
  }
}

interface ProfitZone {
  id: string;
  type: 'long' | 'short';
  entry: {
    price: number;
    timestamp: number;
  };
  target: {
    price: number;
    probability: number;
  };
  stopLoss: {
    price: number;
    probability: number;
  };
  riskRewardRatio: number;
  strength: number;
  confidence: number;
  timeframe: number;
  volume: number;
}
```

## 3. Dynamic Risk Management

### 3.1 Position Sizing Algorithm

#### Functional Requirements
- **FR-3.1.1**: Calculate optimal position size based on account risk
- **FR-3.1.2**: Implement Kelly Criterion for position sizing
- **FR-3.1.3**: Volatility-adjusted position sizing
- **FR-3.1.4**: Maximum correlation exposure limits

#### Technical Specification
```typescript
interface RiskManagementConfig {
  maxAccountRisk: number;     // Maximum % of account to risk per trade
  maxPositionSize: number;    // Maximum % of account per position
  maxCorrelationRisk: number; // Maximum correlated exposure
  volatilityLookback: number; // Period for volatility calculation
}

class PositionSizingCalculator {
  private config: RiskManagementConfig;
  
  constructor(config: RiskManagementConfig) {
    this.config = config;
  }
  
  calculateOptimalSize(params: {
    accountBalance: number;
    zone: ProfitZone;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    currentPositions: Position[];
    volatility: number;
  }): PositionSizeResult {
    const { accountBalance, zone, winRate, avgWin, avgLoss, currentPositions, volatility } = params;
    
    // Kelly Criterion calculation
    const kellyPercent = this.calculateKellyPercent(winRate, avgWin, avgLoss);
    
    // Risk-based position sizing
    const riskAmount = accountBalance * this.config.maxAccountRisk;
    const stopDistance = Math.abs(zone.entry.price - zone.stopLoss.price);
    const maxSharesByRisk = riskAmount / stopDistance;
    
    // Volatility adjustment
    const volatilityAdjustment = this.calculateVolatilityAdjustment(volatility);
    const volatilityAdjustedShares = maxSharesByRisk * volatilityAdjustment;
    
    // Maximum position size limit
    const maxPositionValue = accountBalance * this.config.maxPositionSize;
    const maxSharesByPosition = maxPositionValue / zone.entry.price;
    
    // Correlation adjustment
    const correlationAdjustment = this.calculateCorrelationAdjustment(
      zone.type,
      currentPositions
    );
    
    // Final position size (take minimum of all constraints)
    const finalShares = Math.min(
      volatilityAdjustedShares,
      maxSharesByPosition,
      maxSharesByRisk * kellyPercent,
      maxSharesByRisk * correlationAdjustment
    );
    
    return {
      shares: Math.floor(finalShares),
      value: finalShares * zone.entry.price,
      riskAmount: finalShares * stopDistance,
      riskPercent: (finalShares * stopDistance) / accountBalance,
      kellyPercent,
      volatilityAdjustment,
      correlationAdjustment,
      reasoning: this.generateSizingReasoning({
        kellyPercent,
        volatilityAdjustment,
        correlationAdjustment,
        finalShares,
        maxSharesByRisk,
        maxSharesByPosition
      })
    };
  }
  
  private calculateKellyPercent(winRate: number, avgWin: number, avgLoss: number): number {
    if (avgLoss === 0) return 0;
    
    const winProbability = winRate;
    const lossProbability = 1 - winRate;
    const winLossRatio = avgWin / avgLoss;
    
    const kellyPercent = (winProbability * winLossRatio - lossProbability) / winLossRatio;
    
    // Cap Kelly percentage to prevent over-leveraging
    return Math.max(0, Math.min(kellyPercent, 0.25)); // Max 25%
  }
  
  private calculateVolatilityAdjustment(volatility: number): number {
    // Reduce position size for higher volatility
    const baseVolatility = 0.02; // 2% baseline
    const adjustment = baseVolatility / Math.max(volatility, baseVolatility);
    return Math.min(adjustment, 1.0);
  }
  
  private calculateCorrelationAdjustment(
    zoneType: 'long' | 'short',
    currentPositions: Position[]
  ): number {
    const sameDirectionPositions = currentPositions.filter(p => p.type === zoneType);
    const totalExposure = sameDirectionPositions.reduce((sum, p) => sum + p.value, 0);
    
    if (totalExposure === 0) return 1.0;
    
    // Reduce size if too much correlated exposure
    const exposureRatio = totalExposure / this.config.maxCorrelationRisk;
    return Math.max(0.1, 1 - exposureRatio);
  }
}

interface PositionSizeResult {
  shares: number;
  value: number;
  riskAmount: number;
  riskPercent: number;
  kellyPercent: number;
  volatilityAdjustment: number;
  correlationAdjustment: number;
  reasoning: string;
}
```

## 4. Real-Time Zone Monitoring

### 4.1 Zone Status Tracking

#### Functional Requirements
- **FR-4.1.1**: Real-time zone status updates (active, triggered, invalidated)
- **FR-4.1.2**: Zone strength recalculation on new data
- **FR-4.1.3**: Automated alerts for zone events
- **FR-4.1.4**: Historical zone performance tracking

#### Technical Specification
```typescript
class ProfitZoneMonitor {
  private zones: Map<string, ProfitZone> = new Map();
  private zoneHistory: Map<string, ZoneHistory> = new Map();
  private eventHandlers: Map<ZoneEvent, EventHandler[]> = new Map();
  
  addZone(zone: ProfitZone): void {
    this.zones.set(zone.id, zone);
    this.zoneHistory.set(zone.id, {
      created: Date.now(),
      events: [],
      performance: null
    });
  }
  
  updateZones(currentPrice: number, volume: number, timestamp: number): ZoneUpdate[] {
    const updates: ZoneUpdate[] = [];
    
    for (const [id, zone] of this.zones) {
      const previousStatus = zone.status || 'active';
      const newStatus = this.calculateZoneStatus(zone, currentPrice);
      
      if (newStatus !== previousStatus) {
        zone.status = newStatus;
        
        const update: ZoneUpdate = {
          zoneId: id,
          previousStatus,
          newStatus,
          price: currentPrice,
          timestamp,
          trigger: this.determineTrigger(zone, currentPrice)
        };
        
        updates.push(update);
        this.recordZoneEvent(id, update);
        this.triggerEventHandlers(newStatus, update);
      }
      
      // Update zone strength if still active
      if (newStatus === 'active') {
        const updatedStrength = this.recalculateZoneStrength(zone, currentPrice);
        if (Math.abs(updatedStrength - zone.strength) > 0.1) {
          zone.strength = updatedStrength;
          updates.push({
            zoneId: id,
            strengthUpdate: updatedStrength,
            timestamp
          });
        }
      }
    }
    
    return updates;
  }
  
  private calculateZoneStatus(zone: ProfitZone, currentPrice: number): ZoneStatus {
    const entryPrice = zone.entry.price;
    const targetPrice = zone.target.price;
    const stopLossPrice = zone.stopLoss.price;
    
    if (zone.type === 'long') {
      if (currentPrice >= targetPrice) return 'target_hit';
      if (currentPrice <= stopLossPrice) return 'stop_hit';
      if (currentPrice >= entryPrice) return 'triggered';
    } else { // short
      if (currentPrice <= targetPrice) return 'target_hit';
      if (currentPrice >= stopLossPrice) return 'stop_hit';
      if (currentPrice <= entryPrice) return 'triggered';
    }
    
    // Check for zone invalidation (age, market structure change)
    if (this.isZoneInvalidated(zone)) return 'invalidated';
    
    return 'active';
  }
  
  private isZoneInvalidated(zone: ProfitZone): boolean {
    const age = Date.now() - zone.entry.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return age > maxAge || zone.strength < 0.2;
  }
  
  getZonePerformance(zoneId: string): ZonePerformance | null {
    const history = this.zoneHistory.get(zoneId);
    if (!history) return null;
    
    const zone = this.zones.get(zoneId);
    if (!zone) return null;
    
    const completedEvent = history.events.find(e => 
      e.newStatus === 'target_hit' || e.newStatus === 'stop_hit'
    );
    
    if (!completedEvent) return null;
    
    const entryPrice = zone.entry.price;
    const exitPrice = completedEvent.price;
    const profit = zone.type === 'long' 
      ? exitPrice - entryPrice 
      : entryPrice - exitPrice;
    
    const profitPercent = profit / entryPrice;
    const duration = completedEvent.timestamp - zone.entry.timestamp;
    
    return {
      zoneId,
      success: completedEvent.newStatus === 'target_hit',
      profit,
      profitPercent,
      duration,
      entryPrice,
      exitPrice,
      maxDrawdown: this.calculateMaxDrawdown(history.events, zone)
    };
  }
}

type ZoneStatus = 'active' | 'triggered' | 'target_hit' | 'stop_hit' | 'invalidated';
type ZoneEvent = 'zone_created' | 'zone_triggered' | 'target_hit' | 'stop_hit' | 'zone_invalidated';

interface ZoneUpdate {
  zoneId: string;
  previousStatus?: ZoneStatus;
  newStatus?: ZoneStatus;
  strengthUpdate?: number;
  price?: number;
  timestamp: number;
  trigger?: string;
}

interface ZoneHistory {
  created: number;
  events: ZoneUpdate[];
  performance: ZonePerformance | null;
}

interface ZonePerformance {
  zoneId: string;
  success: boolean;
  profit: number;
  profitPercent: number;
  duration: number;
  entryPrice: number;
  exitPrice: number;
  maxDrawdown: number;
}
```

## 5. Performance Metrics and Analytics

### 5.1 Zone Performance Analysis

#### Functional Requirements
- **FR-5.1.1**: Historical zone success rate calculation
- **FR-5.1.2**: Average profit/loss per zone type
- **FR-5.1.3**: Zone timing analysis (optimal entry/exit timing)
- **FR-5.1.4**: Market condition correlation analysis

#### Technical Specification
```typescript
class ZoneAnalytics {
  private performanceHistory: ZonePerformance[] = [];
  
  calculateSuccessMetrics(timeframe?: { start: number; end: number }): SuccessMetrics {
    const filteredHistory = this.filterByTimeframe(this.performanceHistory, timeframe);
    
    const totalZones = filteredHistory.length;
    const successfulZones = filteredHistory.filter(p => p.success).length;
    const successRate = totalZones > 0 ? successfulZones / totalZones : 0;
    
    const profits = filteredHistory.map(p => p.profit);
    const avgProfit = profits.reduce((sum, profit) => sum + profit, 0) / profits.length;
    const maxProfit = Math.max(...profits);
    const maxLoss = Math.min(...profits);
    
    const profitFactor = this.calculateProfitFactor(filteredHistory);
    const sharpeRatio = this.calculateSharpeRatio(profits);
    const maxDrawdown = this.calculateMaxDrawdown(filteredHistory);
    
    return {
      totalZones,
      successRate,
      avgProfit,
      maxProfit,
      maxLoss,
      profitFactor,
      sharpeRatio,
      maxDrawdown,
      avgDuration: this.calculateAvgDuration(filteredHistory),
      winRate: successRate,
      avgWin: this.calculateAvgWin(filteredHistory),
      avgLoss: this.calculateAvgLoss(filteredHistory)
    };
  }
  
  private calculateProfitFactor(history: ZonePerformance[]): number {
    const totalProfits = history
      .filter(p => p.profit > 0)
      .reduce((sum, p) => sum + p.profit, 0);
    
    const totalLosses = Math.abs(history
      .filter(p => p.profit < 0)
      .reduce((sum, p) => sum + p.profit, 0));
    
    return totalLosses > 0 ? totalProfits / totalLosses : Infinity;
  }
  
  private calculateSharpeRatio(profits: number[]): number {
    if (profits.length === 0) return 0;
    
    const avgReturn = profits.reduce((sum, profit) => sum + profit, 0) / profits.length;
    const variance = profits.reduce((sum, profit) => sum + Math.pow(profit - avgReturn, 2), 0) / profits.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }
  
  analyzeZonesByMarketCondition(): MarketConditionAnalysis {
    // Analyze zone performance under different market conditions
    const trendingUp = this.performanceHistory.filter(p => this.getMarketTrend(p) === 'up');
    const trendingDown = this.performanceHistory.filter(p => this.getMarketTrend(p) === 'down');
    const ranging = this.performanceHistory.filter(p => this.getMarketTrend(p) === 'ranging');
    
    return {
      trendingUp: this.calculateSuccessMetrics(),
      trendingDown: this.calculateSuccessMetrics(),
      ranging: this.calculateSuccessMetrics(),
      bestCondition: this.determineBestCondition([
        { condition: 'trending_up', metrics: this.calculateSuccessMetrics() },
        { condition: 'trending_down', metrics: this.calculateSuccessMetrics() },
        { condition: 'ranging', metrics: this.calculateSuccessMetrics() }
      ])
    };
  }
}

interface SuccessMetrics {
  totalZones: number;
  successRate: number;
  avgProfit: number;
  maxProfit: number;
  maxLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgDuration: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
}

interface MarketConditionAnalysis {
  trendingUp: SuccessMetrics;
  trendingDown: SuccessMetrics;
  ranging: SuccessMetrics;
  bestCondition: string;
}
```

## Success Criteria

### Performance Benchmarks
- **Zone identification accuracy**: > 75% success rate
- **Real-time calculation latency**: < 50ms for zone updates
- **Memory efficiency**: < 100MB for 1000 active zones
- **Historical analysis speed**: < 2 seconds for 1-year data

### Quality Metrics
- **False positive rate**: < 25% for zone identification
- **Risk-reward optimization**: Average RR ratio > 2:1
- **Drawdown control**: Maximum drawdown < 15%
- **Correlation detection**: > 90% accuracy for related positions

This comprehensive specification provides the foundation for implementing sophisticated profit zone calculation algorithms that can adapt to changing market conditions while maintaining robust risk management principles.