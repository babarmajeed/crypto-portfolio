# Portfolio Performance Metrics Requirements

## Overview
Comprehensive specification for calculating and analyzing portfolio performance metrics including ROI, Sharpe ratio, volatility, and advanced risk-adjusted performance measures.

## 1. Return on Investment (ROI) Calculations

### 1.1 Simple ROI

#### Functional Requirements
- **FR-1.1.1**: Calculate simple ROI for individual positions and total portfolio
- **FR-1.1.2**: Time-weighted return calculations for varying investment periods
- **FR-1.1.3**: Currency-adjusted returns for multi-currency portfolios
- **FR-1.1.4**: Realized vs unrealized gains segregation

#### Technical Specification
```typescript
interface ROIConfig {
  baseCurrency: string;
  includeFees: boolean;
  includeStaking: boolean;
  timeWeighted: boolean;
}

class ROICalculator {
  private config: ROIConfig;
  private exchangeRates: Map<string, number> = new Map();
  
  constructor(config: ROIConfig) {
    this.config = config;
  }
  
  calculateSimpleROI(position: Position): ROIResult {
    const { symbol, quantity, averageCost, currentPrice, fees, stakingRewards } = position;
    
    let totalInvestment = quantity * averageCost;
    let currentValue = quantity * currentPrice;
    
    // Include fees in calculation if configured
    if (this.config.includeFees) {
      totalInvestment += fees.total;
    }
    
    // Include staking rewards if configured
    if (this.config.includeStaking && stakingRewards) {
      currentValue += stakingRewards.total;
    }
    
    // Convert to base currency if needed
    if (position.currency !== this.config.baseCurrency) {
      const exchangeRate = this.exchangeRates.get(position.currency) || 1;
      totalInvestment *= exchangeRate;
      currentValue *= exchangeRate;
    }
    
    const absoluteGain = currentValue - totalInvestment;
    const percentageGain = (absoluteGain / totalInvestment) * 100;
    
    return {
      position: symbol,
      totalInvestment,
      currentValue,
      absoluteGain,
      percentageGain,
      currency: this.config.baseCurrency,
      calculatedAt: Date.now()
    };
  }
  
  calculatePortfolioROI(positions: Position[]): PortfolioROIResult {
    const positionROIs = positions.map(position => this.calculateSimpleROI(position));
    
    const totalInvestment = positionROIs.reduce((sum, roi) => sum + roi.totalInvestment, 0);
    const totalCurrentValue = positionROIs.reduce((sum, roi) => sum + roi.currentValue, 0);
    const totalAbsoluteGain = positionROIs.reduce((sum, roi) => sum + roi.absoluteGain, 0);
    
    const overallROI = (totalAbsoluteGain / totalInvestment) * 100;
    
    return {
      totalInvestment,
      totalCurrentValue,
      totalAbsoluteGain,
      overallROI,
      positions: positionROIs,
      currency: this.config.baseCurrency,
      calculatedAt: Date.now()
    };
  }
  
  calculateTimeWeightedReturn(transactions: Transaction[], currentPrices: Map<string, number>): TWRResult {
    const positions = this.groupTransactionsBySymbol(transactions);
    const twrResults: Map<string, number> = new Map();
    
    for (const [symbol, txns] of positions) {
      const periods = this.createTimePeriods(txns);
      let cumulativeReturn = 1;
      
      for (const period of periods) {
        const beginningValue = this.calculatePeriodBeginningValue(period);
        const endingValue = this.calculatePeriodEndingValue(period, currentPrices.get(symbol)!);
        const periodReturn = endingValue / beginningValue;
        
        cumulativeReturn *= periodReturn;
      }
      
      const twr = (cumulativeReturn - 1) * 100;
      twrResults.set(symbol, twr);
    }
    
    return {
      timeWeightedReturns: twrResults,
      calculationMethod: 'Modified Dietz',
      calculatedAt: Date.now()
    };
  }
}

interface ROIResult {
  position: string;
  totalInvestment: number;
  currentValue: number;
  absoluteGain: number;
  percentageGain: number;
  currency: string;
  calculatedAt: number;
}

interface PortfolioROIResult {
  totalInvestment: number;
  totalCurrentValue: number;
  totalAbsoluteGain: number;
  overallROI: number;
  positions: ROIResult[];
  currency: string;
  calculatedAt: number;
}
```

### 1.2 Annualized Returns

#### Functional Requirements
- **FR-1.2.1**: Calculate annualized returns for different time periods
- **FR-1.2.2**: Compound Annual Growth Rate (CAGR) calculation
- **FR-1.2.3**: Geometric vs arithmetic mean returns

#### Technical Specification
```typescript
class AnnualizedReturnCalculator {
  calculateCAGR(initialValue: number, finalValue: number, years: number): number {
    if (initialValue <= 0 || finalValue <= 0 || years <= 0) {
      throw new Error('Invalid input values for CAGR calculation');
    }
    
    return (Math.pow(finalValue / initialValue, 1 / years) - 1) * 100;
  }
  
  calculateAnnualizedReturn(returns: number[], period: 'daily' | 'monthly' | 'quarterly'): AnnualizedReturnResult {
    if (returns.length === 0) {
      throw new Error('No returns data provided');
    }
    
    const periodsPerYear = this.getPeriodsPerYear(period);
    
    // Geometric mean calculation
    const geometricMean = this.calculateGeometricMean(returns);
    const annualizedGeometric = (Math.pow(1 + geometricMean / 100, periodsPerYear) - 1) * 100;
    
    // Arithmetic mean calculation
    const arithmeticMean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const annualizedArithmetic = arithmeticMean * periodsPerYear;
    
    return {
      annualizedGeometric,
      annualizedArithmetic,
      periodCount: returns.length,
      period,
      calculatedAt: Date.now()
    };
  }
  
  private calculateGeometricMean(returns: number[]): number {
    const product = returns.reduce((prod, ret) => prod * (1 + ret / 100), 1);
    return (Math.pow(product, 1 / returns.length) - 1) * 100;
  }
  
  private getPeriodsPerYear(period: 'daily' | 'monthly' | 'quarterly'): number {
    switch (period) {
      case 'daily': return 365;
      case 'monthly': return 12;
      case 'quarterly': return 4;
      default: throw new Error('Invalid period type');
    }
  }
}

interface AnnualizedReturnResult {
  annualizedGeometric: number;
  annualizedArithmetic: number;
  periodCount: number;
  period: 'daily' | 'monthly' | 'quarterly';
  calculatedAt: number;
}
```

## 2. Sharpe Ratio Analysis

### 2.1 Classic Sharpe Ratio

#### Functional Requirements
- **FR-2.1.1**: Calculate Sharpe ratio using risk-free rate
- **FR-2.1.2**: Dynamic risk-free rate adjustment based on jurisdiction
- **FR-2.1.3**: Multiple timeframe Sharpe ratio calculations
- **FR-2.1.4**: Rolling Sharpe ratio for trend analysis

#### Technical Specification
```typescript
interface SharpeRatioConfig {
  riskFreeRate: number;      // Annual risk-free rate (%)
  period: 'daily' | 'monthly' | 'annually';
  rollingWindow?: number;    // For rolling calculations
}

class SharpeRatioCalculator {
  private config: SharpeRatioConfig;
  
  constructor(config: SharpeRatioConfig) {
    this.config = config;
  }
  
  calculateSharpeRatio(returns: number[]): SharpeRatioResult {
    if (returns.length < 2) {
      throw new Error('Insufficient data for Sharpe ratio calculation');
    }
    
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1);
    const standardDeviation = Math.sqrt(variance);
    
    // Adjust risk-free rate for the calculation period
    const adjustedRiskFreeRate = this.adjustRiskFreeRate();
    
    if (standardDeviation === 0) {
      return {
        sharpeRatio: 0,
        meanReturn,
        standardDeviation,
        riskFreeRate: adjustedRiskFreeRate,
        excessReturn: meanReturn - adjustedRiskFreeRate,
        interpretation: this.interpretSharpeRatio(0),
        calculatedAt: Date.now()
      };
    }
    
    const excessReturn = meanReturn - adjustedRiskFreeRate;
    const sharpeRatio = excessReturn / standardDeviation;
    
    return {
      sharpeRatio,
      meanReturn,
      standardDeviation,
      riskFreeRate: adjustedRiskFreeRate,
      excessReturn,
      interpretation: this.interpretSharpeRatio(sharpeRatio),
      calculatedAt: Date.now()
    };
  }
  
  calculateRollingSharpeRatio(returns: number[], windowSize: number): RollingSharpeResult[] {
    if (returns.length < windowSize) {
      throw new Error('Insufficient data for rolling Sharpe ratio calculation');
    }
    
    const rollingResults: RollingSharpeResult[] = [];
    
    for (let i = windowSize - 1; i < returns.length; i++) {
      const windowReturns = returns.slice(i - windowSize + 1, i + 1);
      const sharpeResult = this.calculateSharpeRatio(windowReturns);
      
      rollingResults.push({
        ...sharpeResult,
        windowStart: i - windowSize + 1,
        windowEnd: i,
        windowSize
      });
    }
    
    return rollingResults;
  }
  
  private adjustRiskFreeRate(): number {
    switch (this.config.period) {
      case 'daily':
        return this.config.riskFreeRate / 365;
      case 'monthly':
        return this.config.riskFreeRate / 12;
      case 'annually':
        return this.config.riskFreeRate;
      default:
        return this.config.riskFreeRate;
    }
  }
  
  private interpretSharpeRatio(ratio: number): string {
    if (ratio < 0) return 'Poor - negative excess return';
    if (ratio < 1) return 'Subpar - low risk-adjusted return';
    if (ratio < 2) return 'Good - adequate risk-adjusted return';
    if (ratio < 3) return 'Very Good - strong risk-adjusted return';
    return 'Excellent - exceptional risk-adjusted return';
  }
}

interface SharpeRatioResult {
  sharpeRatio: number;
  meanReturn: number;
  standardDeviation: number;
  riskFreeRate: number;
  excessReturn: number;
  interpretation: string;
  calculatedAt: number;
}

interface RollingSharpeResult extends SharpeRatioResult {
  windowStart: number;
  windowEnd: number;
  windowSize: number;
}
```

### 2.2 Information Ratio

#### Functional Requirements
- **FR-2.2.1**: Calculate Information Ratio vs benchmark
- **FR-2.2.2**: Multiple benchmark comparisons
- **FR-2.2.3**: Tracking error analysis

#### Technical Specification
```typescript
class InformationRatioCalculator {
  calculateInformationRatio(
    portfolioReturns: number[],
    benchmarkReturns: number[]
  ): InformationRatioResult {
    if (portfolioReturns.length !== benchmarkReturns.length) {
      throw new Error('Portfolio and benchmark return arrays must have equal length');
    }
    
    const excessReturns = portfolioReturns.map((ret, i) => ret - benchmarkReturns[i]);
    const meanExcessReturn = excessReturns.reduce((sum, ret) => sum + ret, 0) / excessReturns.length;
    
    const trackingError = this.calculateTrackingError(excessReturns);
    const informationRatio = trackingError !== 0 ? meanExcessReturn / trackingError : 0;
    
    return {
      informationRatio,
      meanExcessReturn,
      trackingError,
      periods: portfolioReturns.length,
      interpretation: this.interpretInformationRatio(informationRatio),
      calculatedAt: Date.now()
    };
  }
  
  private calculateTrackingError(excessReturns: number[]): number {
    const meanExcessReturn = excessReturns.reduce((sum, ret) => sum + ret, 0) / excessReturns.length;
    const variance = excessReturns.reduce((sum, ret) => sum + Math.pow(ret - meanExcessReturn, 2), 0) / (excessReturns.length - 1);
    return Math.sqrt(variance);
  }
  
  private interpretInformationRatio(ratio: number): string {
    if (ratio < 0) return 'Poor - underperforming benchmark';
    if (ratio < 0.5) return 'Moderate - slight outperformance';
    if (ratio < 1) return 'Good - solid outperformance';
    return 'Excellent - strong outperformance';
  }
}

interface InformationRatioResult {
  informationRatio: number;
  meanExcessReturn: number;
  trackingError: number;
  periods: number;
  interpretation: string;
  calculatedAt: number;
}
```

## 3. Volatility Measurements

### 3.1 Historical Volatility

#### Functional Requirements
- **FR-3.1.1**: Calculate historical volatility using multiple methods
- **FR-3.1.2**: Annualized volatility calculations
- **FR-3.1.3**: Rolling volatility for trend analysis
- **FR-3.1.4**: Volatility clustering detection

#### Technical Specification
```typescript
interface VolatilityConfig {
  method: 'simple' | 'exponential' | 'garch';
  annualize: boolean;
  tradingDaysPerYear: number;
}

class VolatilityCalculator {
  private config: VolatilityConfig;
  
  constructor(config: VolatilityConfig) {
    this.config = config;
  }
  
  calculateHistoricalVolatility(prices: number[]): VolatilityResult {
    if (prices.length < 2) {
      throw new Error('Insufficient price data for volatility calculation');
    }
    
    const returns = this.calculateReturns(prices);
    
    let volatility: number;
    
    switch (this.config.method) {
      case 'simple':
        volatility = this.calculateSimpleVolatility(returns);
        break;
      case 'exponential':
        volatility = this.calculateExponentialVolatility(returns);
        break;
      case 'garch':
        volatility = this.calculateGARCHVolatility(returns);
        break;
      default:
        volatility = this.calculateSimpleVolatility(returns);
    }
    
    if (this.config.annualize) {
      volatility = volatility * Math.sqrt(this.config.tradingDaysPerYear);
    }
    
    return {
      volatility,
      method: this.config.method,
      annualized: this.config.annualize,
      periods: returns.length,
      interpretation: this.interpretVolatility(volatility),
      calculatedAt: Date.now()
    };
  }
  
  calculateRollingVolatility(prices: number[], windowSize: number): RollingVolatilityResult[] {
    if (prices.length < windowSize + 1) {
      throw new Error('Insufficient data for rolling volatility calculation');
    }
    
    const results: RollingVolatilityResult[] = [];
    
    for (let i = windowSize; i < prices.length; i++) {
      const windowPrices = prices.slice(i - windowSize, i + 1);
      const volatilityResult = this.calculateHistoricalVolatility(windowPrices);
      
      results.push({
        ...volatilityResult,
        windowStart: i - windowSize,
        windowEnd: i,
        windowSize
      });
    }
    
    return results;
  }
  
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const returnValue = Math.log(prices[i] / prices[i - 1]);
      returns.push(returnValue);
    }
    
    return returns;
  }
  
  private calculateSimpleVolatility(returns: number[]): number {
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1);
    return Math.sqrt(variance);
  }
  
  private calculateExponentialVolatility(returns: number[], lambda: number = 0.94): number {
    if (returns.length === 0) return 0;
    
    let variance = Math.pow(returns[0], 2);
    
    for (let i = 1; i < returns.length; i++) {
      variance = lambda * variance + (1 - lambda) * Math.pow(returns[i], 2);
    }
    
    return Math.sqrt(variance);
  }
  
  private calculateGARCHVolatility(returns: number[]): number {
    // Simplified GARCH(1,1) implementation
    const alpha = 0.1;
    const beta = 0.8;
    const omega = 0.01;
    
    let variance = this.calculateSimpleVolatility(returns) ** 2;
    
    for (let i = 1; i < returns.length; i++) {
      variance = omega + alpha * Math.pow(returns[i - 1], 2) + beta * variance;
    }
    
    return Math.sqrt(variance);
  }
  
  private interpretVolatility(volatility: number): string {
    const annualizedVol = this.config.annualize ? volatility : volatility * Math.sqrt(252);
    
    if (annualizedVol < 0.1) return 'Very Low - stable asset';
    if (annualizedVol < 0.2) return 'Low - moderate fluctuations';
    if (annualizedVol < 0.4) return 'Moderate - average volatility';
    if (annualizedVol < 0.6) return 'High - significant fluctuations';
    return 'Very High - extremely volatile';
  }
}

interface VolatilityResult {
  volatility: number;
  method: 'simple' | 'exponential' | 'garch';
  annualized: boolean;
  periods: number;
  interpretation: string;
  calculatedAt: number;
}

interface RollingVolatilityResult extends VolatilityResult {
  windowStart: number;
  windowEnd: number;
  windowSize: number;
}
```

### 3.2 Value at Risk (VaR)

#### Functional Requirements
- **FR-3.2.1**: Calculate VaR using historical simulation
- **FR-3.2.2**: Parametric VaR calculation
- **FR-3.2.3**: Monte Carlo VaR simulation
- **FR-3.2.4**: Conditional VaR (Expected Shortfall)

#### Technical Specification
```typescript
interface VaRConfig {
  confidenceLevel: number;  // e.g., 0.95 for 95%
  timeHorizon: number;      // in days
  method: 'historical' | 'parametric' | 'montecarlo';
  simulations?: number;     // for Monte Carlo
}

class VaRCalculator {
  private config: VaRConfig;
  
  constructor(config: VaRConfig) {
    this.config = config;
  }
  
  calculateVaR(portfolioReturns: number[], portfolioValue: number): VaRResult {
    let var95: number;
    let cvar95: number;
    
    switch (this.config.method) {
      case 'historical':
        ({ var95, cvar95 } = this.calculateHistoricalVaR(portfolioReturns, portfolioValue));
        break;
      case 'parametric':
        ({ var95, cvar95 } = this.calculateParametricVaR(portfolioReturns, portfolioValue));
        break;
      case 'montecarlo':
        ({ var95, cvar95 } = this.calculateMonteCarloVaR(portfolioReturns, portfolioValue));
        break;
      default:
        ({ var95, cvar95 } = this.calculateHistoricalVaR(portfolioReturns, portfolioValue));
    }
    
    return {
      var95,
      cvar95,
      confidenceLevel: this.config.confidenceLevel,
      timeHorizon: this.config.timeHorizon,
      method: this.config.method,
      portfolioValue,
      varPercent: (var95 / portfolioValue) * 100,
      calculatedAt: Date.now()
    };
  }
  
  private calculateHistoricalVaR(returns: number[], portfolioValue: number): { var95: number; cvar95: number } {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const varIndex = Math.floor((1 - this.config.confidenceLevel) * sortedReturns.length);
    
    const varReturn = sortedReturns[varIndex];
    const var95 = Math.abs(varReturn * portfolioValue * Math.sqrt(this.config.timeHorizon));
    
    // Conditional VaR (Expected Shortfall)
    const tailReturns = sortedReturns.slice(0, varIndex + 1);
    const expectedTailReturn = tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length;
    const cvar95 = Math.abs(expectedTailReturn * portfolioValue * Math.sqrt(this.config.timeHorizon));
    
    return { var95, cvar95 };
  }
  
  private calculateParametricVaR(returns: number[], portfolioValue: number): { var95: number; cvar95: number } {
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    
    // Z-score for 95% confidence level
    const zScore = this.getZScore(this.config.confidenceLevel);
    
    const var95 = (zScore * stdDev - meanReturn) * portfolioValue * Math.sqrt(this.config.timeHorizon);
    
    // Conditional VaR for normal distribution
    const cvar95 = var95 * (this.normalPDF(zScore) / (1 - this.config.confidenceLevel));
    
    return { var95, cvar95 };
  }
  
  private calculateMonteCarloVaR(returns: number[], portfolioValue: number): { var95: number; cvar95: number } {
    const simulations = this.config.simulations || 10000;
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    
    const simulatedReturns: number[] = [];
    
    for (let i = 0; i < simulations; i++) {
      const randomReturn = this.generateNormalRandom(meanReturn, stdDev);
      simulatedReturns.push(randomReturn);
    }
    
    return this.calculateHistoricalVaR(simulatedReturns, portfolioValue);
  }
  
  private getZScore(confidenceLevel: number): number {
    // Simplified Z-score lookup
    const zScores: { [key: number]: number } = {
      0.90: 1.282,
      0.95: 1.645,
      0.99: 2.326
    };
    
    return zScores[confidenceLevel] || 1.645;
  }
  
  private normalPDF(x: number): number {
    return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
  }
  
  private generateNormalRandom(mean: number, stdDev: number): number {
    // Box-Muller transformation
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + stdDev * z0;
  }
}

interface VaRResult {
  var95: number;
  cvar95: number;
  confidenceLevel: number;
  timeHorizon: number;
  method: 'historical' | 'parametric' | 'montecarlo';
  portfolioValue: number;
  varPercent: number;
  calculatedAt: number;
}
```

## 4. Advanced Performance Metrics

### 4.1 Maximum Drawdown

#### Functional Requirements
- **FR-4.1.1**: Calculate maximum drawdown and duration
- **FR-4.1.2**: Recovery time analysis
- **FR-4.1.3**: Drawdown frequency analysis
- **FR-4.1.4**: Ulcer Index calculation

#### Technical Specification
```typescript
class DrawdownAnalyzer {
  calculateMaxDrawdown(portfolioValues: number[]): DrawdownResult {
    if (portfolioValues.length < 2) {
      throw new Error('Insufficient data for drawdown calculation');
    }
    
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdown = 0;
    let currentDuration = 0;
    let peak = portfolioValues[0];
    let maxDrawdownStart = 0;
    let maxDrawdownEnd = 0;
    let recoveryTime = 0;
    
    const drawdownSeries: number[] = [];
    
    for (let i = 0; i < portfolioValues.length; i++) {
      const value = portfolioValues[i];
      
      if (value > peak) {
        peak = value;
        currentDuration = 0;
        
        // Check if we've recovered from max drawdown
        if (currentDrawdown === maxDrawdown && recoveryTime === 0) {
          recoveryTime = i - maxDrawdownEnd;
        }
        
        currentDrawdown = 0;
      } else {
        currentDrawdown = (peak - value) / peak;
        currentDuration++;
        
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
          maxDrawdownDuration = currentDuration;
          maxDrawdownStart = i - currentDuration + 1;
          maxDrawdownEnd = i;
          recoveryTime = 0; // Reset recovery time
        }
      }
      
      drawdownSeries.push(currentDrawdown);
    }
    
    const ulcerIndex = this.calculateUlcerIndex(drawdownSeries);
    const calmarRatio = this.calculateCalmarRatio(portfolioValues, maxDrawdown);
    
    return {
      maxDrawdown: maxDrawdown * 100, // Convert to percentage
      maxDrawdownDuration,
      maxDrawdownStart,
      maxDrawdownEnd,
      recoveryTime,
      ulcerIndex,
      calmarRatio,
      averageDrawdown: this.calculateAverageDrawdown(drawdownSeries),
      drawdownFrequency: this.calculateDrawdownFrequency(drawdownSeries),
      calculatedAt: Date.now()
    };
  }
  
  private calculateUlcerIndex(drawdownSeries: number[]): number {
    const squaredDrawdowns = drawdownSeries.map(dd => dd * dd);
    const meanSquaredDrawdown = squaredDrawdowns.reduce((sum, dd) => sum + dd, 0) / drawdownSeries.length;
    return Math.sqrt(meanSquaredDrawdown) * 100;
  }
  
  private calculateCalmarRatio(portfolioValues: number[], maxDrawdown: number): number {
    if (maxDrawdown === 0) return Infinity;
    
    const totalReturn = (portfolioValues[portfolioValues.length - 1] / portfolioValues[0] - 1) * 100;
    const years = portfolioValues.length / 252; // Assuming daily data
    const annualizedReturn = (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
    
    return annualizedReturn / (maxDrawdown * 100);
  }
  
  private calculateAverageDrawdown(drawdownSeries: number[]): number {
    const nonZeroDrawdowns = drawdownSeries.filter(dd => dd > 0);
    if (nonZeroDrawdowns.length === 0) return 0;
    
    return (nonZeroDrawdowns.reduce((sum, dd) => sum + dd, 0) / nonZeroDrawdowns.length) * 100;
  }
  
  private calculateDrawdownFrequency(drawdownSeries: number[]): number {
    let drawdownPeriods = 0;
    let inDrawdown = false;
    
    for (const drawdown of drawdownSeries) {
      if (drawdown > 0 && !inDrawdown) {
        drawdownPeriods++;
        inDrawdown = true;
      } else if (drawdown === 0) {
        inDrawdown = false;
      }
    }
    
    return drawdownPeriods;
  }
}

interface DrawdownResult {
  maxDrawdown: number;
  maxDrawdownDuration: number;
  maxDrawdownStart: number;
  maxDrawdownEnd: number;
  recoveryTime: number;
  ulcerIndex: number;
  calmarRatio: number;
  averageDrawdown: number;
  drawdownFrequency: number;
  calculatedAt: number;
}
```

### 4.2 Alpha and Beta Analysis

#### Functional Requirements
- **FR-4.2.1**: Calculate portfolio alpha and beta vs benchmark
- **FR-4.2.2**: Multi-factor alpha/beta analysis
- **FR-4.2.3**: Time-varying beta estimation
- **FR-4.2.4**: Jensen's Alpha calculation

#### Technical Specification
```typescript
class AlphaBetaAnalyzer {
  calculateAlphaBeta(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    riskFreeRate: number
  ): AlphaBetaResult {
    if (portfolioReturns.length !== benchmarkReturns.length) {
      throw new Error('Portfolio and benchmark return arrays must have equal length');
    }
    
    if (portfolioReturns.length < 30) {
      console.warn('Less than 30 observations may result in unreliable estimates');
    }
    
    // Calculate excess returns
    const portfolioExcessReturns = portfolioReturns.map(ret => ret - riskFreeRate);
    const benchmarkExcessReturns = benchmarkReturns.map(ret => ret - riskFreeRate);
    
    // Linear regression to find alpha and beta
    const regression = this.linearRegression(benchmarkExcessReturns, portfolioExcessReturns);
    
    const alpha = regression.intercept;
    const beta = regression.slope;
    const rSquared = regression.rSquared;
    
    // Annualize alpha
    const annualizedAlpha = alpha * 252; // Assuming daily returns
    
    // Calculate Jensen's Alpha
    const portfolioMean = portfolioExcessReturns.reduce((sum, ret) => sum + ret, 0) / portfolioExcessReturns.length;
    const benchmarkMean = benchmarkExcessReturns.reduce((sum, ret) => sum + ret, 0) / benchmarkExcessReturns.length;
    const jensensAlpha = portfolioMean - (beta * benchmarkMean);
    
    // Statistical significance testing
    const standardError = this.calculateStandardError(benchmarkExcessReturns, portfolioExcessReturns, regression);
    const tStatistic = alpha / standardError;
    const pValue = this.calculatePValue(tStatistic, portfolioReturns.length - 2);
    
    return {
      alpha,
      beta,
      annualizedAlpha,
      jensensAlpha,
      rSquared,
      standardError,
      tStatistic,
      pValue,
      isSignificant: pValue < 0.05,
      interpretation: this.interpretAlphaBeta(alpha, beta),
      calculatedAt: Date.now()
    };
  }
  
  calculateRollingBeta(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    windowSize: number
  ): RollingBetaResult[] {
    if (portfolioReturns.length < windowSize) {
      throw new Error('Insufficient data for rolling beta calculation');
    }
    
    const results: RollingBetaResult[] = [];
    
    for (let i = windowSize - 1; i < portfolioReturns.length; i++) {
      const portfolioWindow = portfolioReturns.slice(i - windowSize + 1, i + 1);
      const benchmarkWindow = benchmarkReturns.slice(i - windowSize + 1, i + 1);
      
      const regression = this.linearRegression(benchmarkWindow, portfolioWindow);
      
      results.push({
        beta: regression.slope,
        alpha: regression.intercept,
        rSquared: regression.rSquared,
        windowStart: i - windowSize + 1,
        windowEnd: i,
        windowSize
      });
    }
    
    return results;
  }
  
  private linearRegression(x: number[], y: number[]): RegressionResult {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yMean = sumY / n;
    const totalSumSquares = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const residualSumSquares = y.reduce((sum, val, i) => {
      const predicted = intercept + slope * x[i];
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (residualSumSquares / totalSumSquares);
    
    return { slope, intercept, rSquared };
  }
  
  private calculateStandardError(
    x: number[],
    y: number[],
    regression: RegressionResult
  ): number {
    const n = x.length;
    const sumSquaredErrors = y.reduce((sum, val, i) => {
      const predicted = regression.intercept + regression.slope * x[i];
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    
    const meanSquaredError = sumSquaredErrors / (n - 2);
    const xMean = x.reduce((sum, val) => sum + val, 0) / n;
    const sumSquaredDeviations = x.reduce((sum, val) => sum + Math.pow(val - xMean, 2), 0);
    
    return Math.sqrt(meanSquaredError / sumSquaredDeviations);
  }
  
  private calculatePValue(tStatistic: number, degreesOfFreedom: number): number {
    // Simplified p-value calculation (normally would use statistical tables)
    const absT = Math.abs(tStatistic);
    
    if (absT >= 2.576) return 0.01;   // 99% confidence
    if (absT >= 1.96) return 0.05;    // 95% confidence
    if (absT >= 1.645) return 0.10;   // 90% confidence
    
    return 0.20; // Simplified for this example
  }
  
  private interpretAlphaBeta(alpha: number, beta: number): string {
    let interpretation = '';
    
    if (alpha > 0) {
      interpretation += 'Positive alpha indicates outperformance. ';
    } else {
      interpretation += 'Negative alpha indicates underperformance. ';
    }
    
    if (beta > 1) {
      interpretation += 'Beta > 1 indicates higher volatility than benchmark.';
    } else if (beta < 1) {
      interpretation += 'Beta < 1 indicates lower volatility than benchmark.';
    } else {
      interpretation += 'Beta ≈ 1 indicates similar volatility to benchmark.';
    }
    
    return interpretation;
  }
}

interface AlphaBetaResult {
  alpha: number;
  beta: number;
  annualizedAlpha: number;
  jensensAlpha: number;
  rSquared: number;
  standardError: number;
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  interpretation: string;
  calculatedAt: number;
}

interface RollingBetaResult {
  beta: number;
  alpha: number;
  rSquared: number;
  windowStart: number;
  windowEnd: number;
  windowSize: number;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}
```

## 5. Performance Attribution

### 5.1 Asset Allocation Attribution

#### Functional Requirements
- **FR-5.1.1**: Calculate performance attribution by asset class
- **FR-5.1.2**: Security selection vs allocation effects
- **FR-5.1.3**: Interaction effects analysis
- **FR-5.1.4**: Brinson-Hood-Beebower methodology

#### Technical Specification
```typescript
interface AttributionInput {
  portfolioWeights: Map<string, number>;
  benchmarkWeights: Map<string, number>;
  portfolioReturns: Map<string, number>;
  benchmarkReturns: Map<string, number>;
}

class PerformanceAttributionAnalyzer {
  calculateBrinsonAttribution(input: AttributionInput): AttributionResult {
    const assets = Array.from(input.portfolioWeights.keys());
    
    let totalAllocationEffect = 0;
    let totalSelectionEffect = 0;
    let totalInteractionEffect = 0;
    
    const assetAttributions: AssetAttribution[] = [];
    
    for (const asset of assets) {
      const wp = input.portfolioWeights.get(asset) || 0;
      const wb = input.benchmarkWeights.get(asset) || 0;
      const rp = input.portfolioReturns.get(asset) || 0;
      const rb = input.benchmarkReturns.get(asset) || 0;
      
      // Allocation Effect: (wp - wb) * rb
      const allocationEffect = (wp - wb) * rb;
      
      // Selection Effect: wb * (rp - rb)
      const selectionEffect = wb * (rp - rb);
      
      // Interaction Effect: (wp - wb) * (rp - rb)
      const interactionEffect = (wp - wb) * (rp - rb);
      
      totalAllocationEffect += allocationEffect;
      totalSelectionEffect += selectionEffect;
      totalInteractionEffect += interactionEffect;
      
      assetAttributions.push({
        asset,
        allocationEffect: allocationEffect * 100,
        selectionEffect: selectionEffect * 100,
        interactionEffect: interactionEffect * 100,
        totalEffect: (allocationEffect + selectionEffect + interactionEffect) * 100,
        portfolioWeight: wp * 100,
        benchmarkWeight: wb * 100,
        portfolioReturn: rp * 100,
        benchmarkReturn: rb * 100
      });
    }
    
    return {
      totalAllocationEffect: totalAllocationEffect * 100,
      totalSelectionEffect: totalSelectionEffect * 100,
      totalInteractionEffect: totalInteractionEffect * 100,
      totalActiveReturn: (totalAllocationEffect + totalSelectionEffect + totalInteractionEffect) * 100,
      assetAttributions,
      calculatedAt: Date.now()
    };
  }
  
  calculateSectorAttribution(
    portfolioData: Map<string, { sector: string; weight: number; return: number }>,
    benchmarkData: Map<string, { sector: string; weight: number; return: number }>
  ): SectorAttributionResult {
    const sectors = new Set<string>();
    
    // Collect all sectors
    for (const data of portfolioData.values()) {
      sectors.add(data.sector);
    }
    for (const data of benchmarkData.values()) {
      sectors.add(data.sector);
    }
    
    const sectorAttributions: SectorAttribution[] = [];
    
    for (const sector of sectors) {
      const portfolioSectorData = this.aggregateSectorData(portfolioData, sector);
      const benchmarkSectorData = this.aggregateSectorData(benchmarkData, sector);
      
      const allocationEffect = (portfolioSectorData.weight - benchmarkSectorData.weight) * benchmarkSectorData.return;
      const selectionEffect = benchmarkSectorData.weight * (portfolioSectorData.return - benchmarkSectorData.return);
      const interactionEffect = (portfolioSectorData.weight - benchmarkSectorData.weight) * (portfolioSectorData.return - benchmarkSectorData.return);
      
      sectorAttributions.push({
        sector,
        allocationEffect: allocationEffect * 100,
        selectionEffect: selectionEffect * 100,
        interactionEffect: interactionEffect * 100,
        totalEffect: (allocationEffect + selectionEffect + interactionEffect) * 100,
        portfolioWeight: portfolioSectorData.weight * 100,
        benchmarkWeight: benchmarkSectorData.weight * 100,
        portfolioReturn: portfolioSectorData.return * 100,
        benchmarkReturn: benchmarkSectorData.return * 100
      });
    }
    
    return {
      sectorAttributions,
      calculatedAt: Date.now()
    };
  }
  
  private aggregateSectorData(
    data: Map<string, { sector: string; weight: number; return: number }>,
    targetSector: string
  ): { weight: number; return: number } {
    let totalWeight = 0;
    let weightedReturn = 0;
    
    for (const [asset, info] of data) {
      if (info.sector === targetSector) {
        totalWeight += info.weight;
        weightedReturn += info.weight * info.return;
      }
    }
    
    const averageReturn = totalWeight > 0 ? weightedReturn / totalWeight : 0;
    
    return {
      weight: totalWeight,
      return: averageReturn
    };
  }
}

interface AttributionResult {
  totalAllocationEffect: number;
  totalSelectionEffect: number;
  totalInteractionEffect: number;
  totalActiveReturn: number;
  assetAttributions: AssetAttribution[];
  calculatedAt: number;
}

interface AssetAttribution {
  asset: string;
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  totalEffect: number;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
}

interface SectorAttributionResult {
  sectorAttributions: SectorAttribution[];
  calculatedAt: number;
}

interface SectorAttribution {
  sector: string;
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  totalEffect: number;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
}
```

## Success Criteria

### Performance Benchmarks
- **Calculation accuracy**: 99.99% precision vs industry standards
- **Real-time updates**: < 100ms for all metrics
- **Historical analysis**: < 5 seconds for 5-year data sets
- **Memory efficiency**: < 200MB for comprehensive analysis

### Quality Metrics
- **Statistical significance**: P-values calculated for all relevant metrics
- **Error handling**: Graceful degradation for insufficient data
- **Consistency**: Results match financial industry standards
- **Scalability**: Support for portfolios with 1000+ positions

This specification provides a comprehensive framework for implementing sophisticated portfolio performance metrics that meet institutional-grade requirements while maintaining computational efficiency.