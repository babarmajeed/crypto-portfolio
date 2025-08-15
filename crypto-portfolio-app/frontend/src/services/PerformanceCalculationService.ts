/**
 * CP-050: Performance Calculation Service
 * Advanced service for calculating comprehensive performance metrics including
 * Sharpe ratio, alpha, beta, volatility, drawdown analysis, and benchmark comparisons
 */

import {
  PerformanceMetrics,
  VaRMetrics,
  BenchmarkComparison,
  BenchmarkData,
  TimeSeriesData,
  TimeframeOption,
  TimeSeriesComparison,
  SUPPORTED_BENCHMARKS,
  DEFAULT_ANALYTICS_SETTINGS,
  CalculationError
} from '../types/analytics.types';

import { statisticalUtils } from '../utils/statisticalUtils';

interface PerformanceCalculationOptions {
  timeSeries: TimeSeriesData[];
  riskFreeRate?: number;
  benchmarks?: string[];
  timeframe: TimeframeOption;
  confidenceLevel?: number;
}

interface BenchmarkCalculationOptions {
  portfolioTimeSeries: TimeSeriesData[];
  benchmarkData: BenchmarkData;
  riskFreeRate: number;
}

/**
 * Performance Calculation Service
 * Provides comprehensive performance metrics calculation and analysis
 */
class PerformanceCalculationService {
  private benchmarkCache: Map<string, BenchmarkData>;
  private calculationCache: Map<string, PerformanceMetrics>;

  constructor() {
    this.benchmarkCache = new Map();
    this.calculationCache = new Map();
  }

  /**
   * Calculate advanced performance metrics
   */
  async calculateAdvancedMetrics(options: PerformanceCalculationOptions): Promise<PerformanceMetrics> {
    const {
      timeSeries,
      riskFreeRate = DEFAULT_ANALYTICS_SETTINGS.riskFreeRate,
      benchmarks = ['btc'],
      timeframe,
      confidenceLevel = 95
    } = options;

    if (timeSeries.length < 2) {
      throw new CalculationError('Insufficient data for performance calculation', 'calculateAdvancedMetrics', { length: timeSeries.length });
    }

    // Extract returns and values
    const values = timeSeries.map(ts => ts.value);
    const returns = timeSeries.map(ts => ts.returns).filter(r => !isNaN(r));
    
    if (returns.length === 0) {
      throw new CalculationError('No valid returns data available', 'calculateAdvancedMetrics');
    }

    // Basic return calculations
    const totalReturn = this.calculateTotalReturn(values);
    const annualizedReturn = this.calculateAnnualizedReturn(totalReturn, timeSeries, timeframe);
    const cagr = this.calculateCAGR(values, timeSeries);

    // Volatility metrics
    const volatility = this.calculateVolatility(returns);
    const downVolatility = this.calculateDownVolatility(returns);

    // Risk-adjusted metrics
    const sharpeRatio = this.calculateSharpeRatio(annualizedReturn, volatility, riskFreeRate);
    const sortinoRatio = this.calculateSortinoRatio(annualizedReturn, downVolatility, riskFreeRate);
    const calmarRatio = this.calculateCalmarRatio(annualizedReturn, this.calculateMaxDrawdown(values).maxDrawdown);

    // Drawdown analysis
    const drawdownAnalysis = this.calculateDrawdownAnalysis(values, timeSeries);

    // Market metrics (simplified for demo)
    const alpha = this.calculateAlpha(returns, returns, 1.0, riskFreeRate); // Simplified
    const beta = this.calculateBeta(returns, returns); // Simplified
    const rSquared = this.calculateRSquared(returns, returns); // Simplified

    // Win/Loss analysis
    const winLossAnalysis = this.calculateWinLossAnalysis(returns);

    // VaR calculations
    const valueAtRisk = this.calculateVaR(returns, confidenceLevel);
    const conditionalVaR = this.calculateConditionalVaR(returns, confidenceLevel);

    // Return periods
    const returnPeriods = this.calculateReturnPeriods(returns, timeSeries);

    // Benchmark comparison
    let benchmarkComparison: BenchmarkComparison | undefined;
    if (benchmarks.length > 0) {
      benchmarkComparison = await this.calculateBenchmarkComparison({
        portfolioTimeSeries: timeSeries,
        benchmarkData: await this.getBenchmarkData(benchmarks[0], timeframe),
        riskFreeRate
      });
    }

    return {
      totalReturn,
      annualizedReturn,
      cagr,
      volatility,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      alpha,
      beta,
      rSquared,
      trackingError: benchmarkComparison?.trackingError || 0,
      informationRatio: benchmarkComparison?.informationRatio || 0,
      maxDrawdown: drawdownAnalysis.maxDrawdown,
      maxDrawdownDuration: drawdownAnalysis.maxDrawdownDuration,
      upCaptureRatio: benchmarkComparison?.upCaptureRatio || 0,
      downCaptureRatio: benchmarkComparison?.downCaptureRatio || 0,
      winRate: winLossAnalysis.winRate,
      averageWin: winLossAnalysis.averageWin,
      averageLoss: winLossAnalysis.averageLoss,
      profitFactor: winLossAnalysis.profitFactor,
      riskAdjustedReturn: sharpeRatio,
      valueAtRisk,
      conditionalVaR,
      returns: returnPeriods,
      benchmarkComparison: benchmarkComparison!
    };
  }

  /**
   * Calculate total return
   */
  private calculateTotalReturn(values: number[]): number {
    if (values.length < 2 || values[0] === 0) return 0;
    
    const initialValue = values[0];
    const finalValue = values[values.length - 1];
    
    return ((finalValue - initialValue) / initialValue) * 100;
  }

  /**
   * Calculate annualized return
   */
  private calculateAnnualizedReturn(
    totalReturn: number,
    timeSeries: TimeSeriesData[],
    timeframe: TimeframeOption
  ): number {
    if (timeSeries.length < 2) return 0;
    
    const startDate = new Date(timeSeries[0].date);
    const endDate = new Date(timeSeries[timeSeries.length - 1].date);
    const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    
    if (years === 0) return totalReturn;
    
    return (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
  }

  /**
   * Calculate Compound Annual Growth Rate (CAGR)
   */
  private calculateCAGR(values: number[], timeSeries: TimeSeriesData[]): number {
    if (values.length < 2 || values[0] === 0) return 0;
    
    const startDate = new Date(timeSeries[0].date);
    const endDate = new Date(timeSeries[timeSeries.length - 1].date);
    const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    
    if (years === 0) return 0;
    
    const startValue = values[0];
    const endValue = values[values.length - 1];
    
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  }

  /**
   * Calculate volatility (annualized standard deviation)
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const dailyVolatility = statisticalUtils.standardDeviation(returns);
    return dailyVolatility * Math.sqrt(252); // Annualized (252 trading days)
  }

  /**
   * Calculate downside volatility (for Sortino ratio)
   */
  private calculateDownVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const negativeReturns = returns.filter(r => r < 0);
    if (negativeReturns.length === 0) return 0;
    
    const dailyDownVol = statisticalUtils.standardDeviation(negativeReturns);
    return dailyDownVol * Math.sqrt(252); // Annualized
  }

  /**
   * Calculate Sharpe ratio
   */
  private calculateSharpeRatio(
    annualizedReturn: number,
    volatility: number,
    riskFreeRate: number
  ): number {
    if (volatility === 0) return 0;
    
    const excessReturn = (annualizedReturn / 100) - riskFreeRate;
    return excessReturn / (volatility / 100);
  }

  /**
   * Calculate Sortino ratio
   */
  private calculateSortinoRatio(
    annualizedReturn: number,
    downVolatility: number,
    riskFreeRate: number
  ): number {
    if (downVolatility === 0) return 0;
    
    const excessReturn = (annualizedReturn / 100) - riskFreeRate;
    return excessReturn / (downVolatility / 100);
  }

  /**
   * Calculate Calmar ratio
   */
  private calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
    if (maxDrawdown === 0) return 0;
    
    return (annualizedReturn / 100) / (Math.abs(maxDrawdown) / 100);
  }

  /**
   * Calculate Alpha
   */
  private calculateAlpha(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    beta: number,
    riskFreeRate: number
  ): number {
    if (portfolioReturns.length === 0 || benchmarkReturns.length === 0) return 0;
    
    const portfolioReturn = statisticalUtils.mean(portfolioReturns) * 252; // Annualized
    const benchmarkReturn = statisticalUtils.mean(benchmarkReturns) * 252; // Annualized
    
    return portfolioReturn - (riskFreeRate * 100 + beta * (benchmarkReturn - riskFreeRate * 100));
  }

  /**
   * Calculate Beta
   */
  private calculateBeta(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length === 0 || benchmarkReturns.length === 0) return 1.0;
    if (portfolioReturns.length !== benchmarkReturns.length) return 1.0;
    
    return statisticalUtils.calculateBeta(portfolioReturns, benchmarkReturns);
  }

  /**
   * Calculate R-squared
   */
  private calculateRSquared(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length === 0 || benchmarkReturns.length === 0) return 0;
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;
    
    const correlation = statisticalUtils.correlation(portfolioReturns, benchmarkReturns);
    return Math.pow(correlation, 2);
  }

  /**
   * Calculate drawdown analysis
   */
  private calculateDrawdownAnalysis(values: number[], timeSeries: TimeSeriesData[]): {
    maxDrawdown: number;
    maxDrawdownDuration: number;
    currentDrawdown: number;
    drawdownPeriods: any[];
  } {
    if (values.length === 0) {
      return { maxDrawdown: 0, maxDrawdownDuration: 0, currentDrawdown: 0, drawdownPeriods: [] };
    }

    let peak = values[0];
    let maxDrawdown = 0;
    let maxDrawdownDuration = 0;
    let currentDrawdownStart = 0;
    let drawdownPeriods = [];
    let inDrawdown = false;

    for (let i = 1; i < values.length; i++) {
      if (values[i] > peak) {
        // New peak
        if (inDrawdown) {
          // End of drawdown period
          const duration = i - currentDrawdownStart;
          drawdownPeriods.push({
            start: currentDrawdownStart,
            end: i - 1,
            duration,
            maxDrawdown: ((peak - Math.min(...values.slice(currentDrawdownStart, i))) / peak) * 100
          });
          inDrawdown = false;
        }
        peak = values[i];
      } else {
        // Potential drawdown
        if (!inDrawdown) {
          currentDrawdownStart = i;
          inDrawdown = true;
        }

        const currentDrawdown = ((peak - values[i]) / peak) * 100;
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
          maxDrawdownDuration = i - currentDrawdownStart + 1;
        }
      }
    }

    // Handle ongoing drawdown
    const currentDrawdown = peak > values[values.length - 1] ?
      ((peak - values[values.length - 1]) / peak) * 100 : 0;

    return {
      maxDrawdown,
      maxDrawdownDuration,
      currentDrawdown,
      drawdownPeriods
    };
  }

  /**
   * Calculate max drawdown
   */
  private calculateMaxDrawdown(values: number[]): { maxDrawdown: number; maxDrawdownDuration: number } {
    return this.calculateDrawdownAnalysis(values, []);
  }

  /**
   * Calculate win/loss analysis
   */
  private calculateWinLossAnalysis(returns: number[]): {
    winRate: number;
    averageWin: number;
    averageLoss: number;
    profitFactor: number;
  } {
    if (returns.length === 0) {
      return { winRate: 0, averageWin: 0, averageLoss: 0, profitFactor: 0 };
    }

    const wins = returns.filter(r => r > 0);
    const losses = returns.filter(r => r < 0);

    const winRate = (wins.length / returns.length) * 100;
    const averageWin = wins.length > 0 ? statisticalUtils.mean(wins) : 0;
    const averageLoss = losses.length > 0 ? Math.abs(statisticalUtils.mean(losses)) : 0;
    
    const totalWins = wins.reduce((sum, win) => sum + win, 0);
    const totalLosses = Math.abs(losses.reduce((sum, loss) => sum + loss, 0));
    
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    return {
      winRate,
      averageWin,
      averageLoss,
      profitFactor
    };
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  private calculateVaR(returns: number[], confidenceLevel: number = 95): VaRMetrics {
    if (returns.length === 0) {
      return this.getEmptyVaRMetrics();
    }

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index95 = Math.floor((100 - 95) / 100 * sortedReturns.length);
    const index99 = Math.floor((100 - 99) / 100 * sortedReturns.length);
    const index99_9 = Math.floor((100 - 99.9) / 100 * sortedReturns.length);

    const oneDay = {
      confidence95: Math.abs(sortedReturns[index95] || 0),
      confidence99: Math.abs(sortedReturns[index99] || 0),
      confidence99_9: Math.abs(sortedReturns[index99_9] || 0)
    };

    // Scale to different time periods
    const oneWeek = {
      confidence95: oneDay.confidence95 * Math.sqrt(7),
      confidence99: oneDay.confidence99 * Math.sqrt(7),
      confidence99_9: oneDay.confidence99_9 * Math.sqrt(7)
    };

    const oneMonth = {
      confidence95: oneDay.confidence95 * Math.sqrt(30),
      confidence99: oneDay.confidence99 * Math.sqrt(30),
      confidence99_9: oneDay.confidence99_9 * Math.sqrt(30)
    };

    return {
      oneDay,
      oneWeek,
      oneMonth,
      methodology: 'historical'
    };
  }

  /**
   * Calculate Conditional Value at Risk (CVaR)
   */
  private calculateConditionalVaR(returns: number[], confidenceLevel: number = 95): VaRMetrics {
    if (returns.length === 0) {
      return this.getEmptyVaRMetrics();
    }

    const sortedReturns = [...returns].sort((a, b) => a - b);
    
    const calculateCVaR = (confidence: number) => {
      const cutoffIndex = Math.floor((100 - confidence) / 100 * sortedReturns.length);
      const tailReturns = sortedReturns.slice(0, cutoffIndex + 1);
      return tailReturns.length > 0 ? Math.abs(statisticalUtils.mean(tailReturns)) : 0;
    };

    const oneDay = {
      confidence95: calculateCVaR(95),
      confidence99: calculateCVaR(99),
      confidence99_9: calculateCVaR(99.9)
    };

    const oneWeek = {
      confidence95: oneDay.confidence95 * Math.sqrt(7),
      confidence99: oneDay.confidence99 * Math.sqrt(7),
      confidence99_9: oneDay.confidence99_9 * Math.sqrt(7)
    };

    const oneMonth = {
      confidence95: oneDay.confidence95 * Math.sqrt(30),
      confidence99: oneDay.confidence99 * Math.sqrt(30),
      confidence99_9: oneDay.confidence99_9 * Math.sqrt(30)
    };

    return {
      oneDay,
      oneWeek,
      oneMonth,
      methodology: 'historical'
    };
  }

  /**
   * Calculate return periods
   */
  private calculateReturnPeriods(returns: number[], timeSeries: TimeSeriesData[]): {
    daily: number[];
    monthly: number[];
    quarterly: number[];
    yearly: number[];
  } {
    const daily = returns;
    
    // Group by month for monthly returns
    const monthlyGroups = new Map<string, number[]>();
    timeSeries.forEach(ts => {
      const monthKey = ts.date.substring(0, 7); // YYYY-MM
      if (!monthlyGroups.has(monthKey)) {
        monthlyGroups.set(monthKey, []);
      }
      monthlyGroups.get(monthKey)!.push(ts.returns);
    });
    
    const monthly = Array.from(monthlyGroups.values()).map(monthReturns => 
      monthReturns.reduce((sum, ret) => sum + ret, 0)
    );

    // Simplified quarterly and yearly (would need more sophisticated grouping)
    const quarterly = this.groupReturnsByPeriod(monthly, 3);
    const yearly = this.groupReturnsByPeriod(monthly, 12);

    return {
      daily,
      monthly,
      quarterly,
      yearly
    };
  }

  /**
   * Group returns by period
   */
  private groupReturnsByPeriod(returns: number[], groupSize: number): number[] {
    const grouped = [];
    for (let i = 0; i < returns.length; i += groupSize) {
      const group = returns.slice(i, i + groupSize);
      const periodReturn = group.reduce((sum, ret) => sum + ret, 0);
      grouped.push(periodReturn);
    }
    return grouped;
  }

  /**
   * Calculate benchmark comparison
   */
  private async calculateBenchmarkComparison(options: BenchmarkCalculationOptions): Promise<BenchmarkComparison> {
    const { portfolioTimeSeries, benchmarkData, riskFreeRate } = options;

    // Extract returns
    const portfolioReturns = portfolioTimeSeries.map(ts => ts.returns).filter(r => !isNaN(r));
    const benchmarkReturns = benchmarkData.returns.daily;

    // Align the series lengths
    const minLength = Math.min(portfolioReturns.length, benchmarkReturns.length);
    const alignedPortfolioReturns = portfolioReturns.slice(-minLength);
    const alignedBenchmarkReturns = benchmarkReturns.slice(-minLength);

    // Calculate relative metrics
    const beta = this.calculateBeta(alignedPortfolioReturns, alignedBenchmarkReturns);
    const alpha = this.calculateAlpha(alignedPortfolioReturns, alignedBenchmarkReturns, beta, riskFreeRate);
    const correlation = statisticalUtils.correlation(alignedPortfolioReturns, alignedBenchmarkReturns);
    const trackingError = statisticalUtils.trackingError(alignedPortfolioReturns, alignedBenchmarkReturns);
    const informationRatio = trackingError > 0 ? alpha / trackingError : 0;

    // Calculate capture ratios
    const upCapture = this.calculateCaptureRatio(alignedPortfolioReturns, alignedBenchmarkReturns, true);
    const downCapture = this.calculateCaptureRatio(alignedPortfolioReturns, alignedBenchmarkReturns, false);

    // Calculate relative return
    const portfolioTotalReturn = this.calculateTotalReturn(portfolioTimeSeries.map(ts => ts.value));
    const relativeReturn = portfolioTotalReturn - benchmarkData.returns.total;

    // Create time series comparison
    const timeSeries = portfolioTimeSeries.map((ts, index) => {
      const benchmarkValue = index < benchmarkReturns.length ? benchmarkReturns[index] : 0;
      return {
        date: ts.date,
        portfolioValue: ts.value,
        benchmarkValue: benchmarkValue,
        portfolioReturn: ts.returns,
        benchmarkReturn: benchmarkValue,
        relativeReturn: ts.returns - benchmarkValue,
        rollingAlpha: alpha, // Simplified - would calculate rolling alpha
        rollingBeta: beta // Simplified - would calculate rolling beta
      };
    });

    return {
      benchmark: benchmarkData,
      relativeName: `Portfolio vs ${benchmarkData.name}`,
      relativeReturn,
      trackingError,
      informationRatio,
      upCaptureRatio: upCapture,
      downCaptureRatio: downCapture,
      beta,
      alpha,
      correlation,
      timeSeries
    };
  }

  /**
   * Calculate capture ratios
   */
  private calculateCaptureRatio(
    portfolioReturns: number[],
    benchmarkReturns: number[],
    upCapture: boolean
  ): number {
    if (portfolioReturns.length !== benchmarkReturns.length) return 0;

    const pairs = portfolioReturns.map((pr, i) => [pr, benchmarkReturns[i]]);
    const filteredPairs = upCapture 
      ? pairs.filter(([_, br]) => br > 0)
      : pairs.filter(([_, br]) => br < 0);

    if (filteredPairs.length === 0) return 0;

    const avgPortfolioReturn = statisticalUtils.mean(filteredPairs.map(([pr, _]) => pr));
    const avgBenchmarkReturn = statisticalUtils.mean(filteredPairs.map(([_, br]) => br));

    return avgBenchmarkReturn !== 0 ? (avgPortfolioReturn / avgBenchmarkReturn) * 100 : 0;
  }

  /**
   * Get benchmark data (simplified - would fetch from API)
   */
  private async getBenchmarkData(benchmarkId: string, timeframe: TimeframeOption): Promise<BenchmarkData> {
    // Check cache first
    const cacheKey = `${benchmarkId}_${timeframe}`;
    if (this.benchmarkCache.has(cacheKey)) {
      return this.benchmarkCache.get(cacheKey)!;
    }

    // Find benchmark definition
    const benchmarkDef = SUPPORTED_BENCHMARKS.find(b => b.id === benchmarkId);
    if (!benchmarkDef) {
      throw new CalculationError(`Unsupported benchmark: ${benchmarkId}`, 'getBenchmarkData');
    }

    // Simulate benchmark data (in production, would fetch from API)
    const data: BenchmarkData = {
      id: benchmarkDef.id,
      name: benchmarkDef.name,
      symbol: benchmarkDef.symbol,
      description: benchmarkDef.description,
      category: benchmarkDef.category,
      returns: {
        daily: this.generateMockBenchmarkReturns(365), // Mock daily returns
        total: this.generateMockTotalReturn(benchmarkId),
        annualized: this.generateMockAnnualizedReturn(benchmarkId)
      }
    };

    // Cache the result
    this.benchmarkCache.set(cacheKey, data);
    
    return data;
  }

  /**
   * Generate mock benchmark returns (for demo purposes)
   */
  private generateMockBenchmarkReturns(days: number): number[] {
    const returns = [];
    const volatility = 0.03; // 3% daily volatility
    
    for (let i = 0; i < days; i++) {
      // Generate return using random walk with drift
      const drift = 0.0005; // 0.05% daily drift
      const randomShock = (Math.random() - 0.5) * volatility * 2;
      const dailyReturn = (drift + randomShock) * 100;
      returns.push(dailyReturn);
    }
    
    return returns;
  }

  /**
   * Generate mock total return
   */
  private generateMockTotalReturn(benchmarkId: string): number {
    const returnMap: { [key: string]: number } = {
      'btc': 45.2,
      'eth': 38.7,
      'total_crypto': 42.1,
      'sp500': 12.5,
      'nasdaq': 18.3,
      'gold': 8.2
    };
    
    return returnMap[benchmarkId] || 25.0;
  }

  /**
   * Generate mock annualized return
   */
  private generateMockAnnualizedReturn(benchmarkId: string): number {
    const returnMap: { [key: string]: number } = {
      'btc': 28.5,
      'eth': 24.2,
      'total_crypto': 26.8,
      'sp500': 10.2,
      'nasdaq': 14.7,
      'gold': 6.1
    };
    
    return returnMap[benchmarkId] || 18.0;
  }

  /**
   * Get empty VaR metrics structure
   */
  private getEmptyVaRMetrics(): VaRMetrics {
    const empty = { confidence95: 0, confidence99: 0, confidence99_9: 0 };
    return {
      oneDay: empty,
      oneWeek: empty,
      oneMonth: empty,
      methodology: 'historical'
    };
  }

  /**
   * Calculate rolling metrics
   */
  async calculateRollingMetrics(
    timeSeries: TimeSeriesData[],
    windowSize: number = 30
  ): Promise<{
    rollingReturns: number[];
    rollingVolatility: number[];
    rollingSharpe: number[];
    rollingDrawdown: number[];
  }> {
    if (timeSeries.length < windowSize) {
      return {
        rollingReturns: [],
        rollingVolatility: [],
        rollingSharpe: [],
        rollingDrawdown: []
      };
    }

    const rollingReturns = [];
    const rollingVolatility = [];
    const rollingSharpe = [];
    const rollingDrawdown = [];

    for (let i = windowSize - 1; i < timeSeries.length; i++) {
      const window = timeSeries.slice(i - windowSize + 1, i + 1);
      const windowReturns = window.map(ts => ts.returns).filter(r => !isNaN(r));
      const windowValues = window.map(ts => ts.value);

      // Rolling return
      const periodReturn = windowValues.length > 1 ?
        ((windowValues[windowValues.length - 1] - windowValues[0]) / windowValues[0]) * 100 : 0;
      rollingReturns.push(periodReturn);

      // Rolling volatility
      const volatility = this.calculateVolatility(windowReturns);
      rollingVolatility.push(volatility);

      // Rolling Sharpe
      const annualizedReturn = this.calculateAnnualizedReturn(periodReturn, window, '1M');
      const sharpe = this.calculateSharpeRatio(annualizedReturn, volatility, DEFAULT_ANALYTICS_SETTINGS.riskFreeRate);
      rollingSharpe.push(sharpe);

      // Rolling drawdown
      const { currentDrawdown } = this.calculateDrawdownAnalysis(windowValues, window);
      rollingDrawdown.push(currentDrawdown);
    }

    return {
      rollingReturns,
      rollingVolatility,
      rollingSharpe,
      rollingDrawdown
    };
  }

  /**
   * Calculate performance attribution
   */
  async calculatePerformanceAttribution(
    portfolioTimeSeries: TimeSeriesData[],
    benchmarkTimeSeries: TimeSeriesData[],
    assetWeights: Map<string, number>
  ): Promise<{
    totalAttribution: number;
    assetContributions: Map<string, number>;
    interactionEffects: Map<string, number>;
  }> {
    const portfolioReturn = this.calculateTotalReturn(portfolioTimeSeries.map(ts => ts.value));
    const benchmarkReturn = this.calculateTotalReturn(benchmarkTimeSeries.map(ts => ts.value));
    const totalAttribution = portfolioReturn - benchmarkReturn;

    const assetContributions = new Map<string, number>();
    const interactionEffects = new Map<string, number>();

    // Simplified attribution calculation
    for (const [asset, weight] of assetWeights) {
      // In a real implementation, this would use actual asset returns vs benchmark
      const contribution = totalAttribution * weight;
      assetContributions.set(asset, contribution);
      
      // Interaction effect (simplified)
      const interaction = contribution * 0.1; // 10% of contribution as interaction
      interactionEffects.set(asset, interaction);
    }

    return {
      totalAttribution,
      assetContributions,
      interactionEffects
    };
  }

  /**
   * Clear caches
   */
  clearCache(): void {
    this.benchmarkCache.clear();
    this.calculationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    benchmarkCacheSize: number;
    calculationCacheSize: number;
  } {
    return {
      benchmarkCacheSize: this.benchmarkCache.size,
      calculationCacheSize: this.calculationCache.size
    };
  }
}

// Create and export singleton instance
export const performanceCalculationService = new PerformanceCalculationService();