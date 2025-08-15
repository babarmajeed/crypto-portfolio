/**
 * CP-050: Statistical Utilities
 * Comprehensive mathematical and statistical functions for portfolio analytics,
 * performance calculations, risk analysis, and correlation computations
 */

/**
 * Statistical Utilities Class
 * Provides essential mathematical and statistical functions for financial calculations
 */
class StatisticalUtils {
  
  /**
   * Calculate the mean (average) of an array of numbers
   */
  mean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calculate the median of an array of numbers
   */
  median(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    } else {
      return sorted[middle];
    }
  }

  /**
   * Calculate the standard deviation of an array of numbers
   */
  standardDeviation(values: number[], sample: boolean = true): number {
    if (values.length === 0) return 0;
    if (values.length === 1 && sample) return 0;
    
    const mean = this.mean(values);
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = this.mean(squaredDifferences);
    
    // Use sample standard deviation (n-1) by default
    const denominator = sample ? values.length - 1 : values.length;
    const variance = denominator > 0 ? (avgSquaredDiff * values.length) / denominator : 0;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate variance
   */
  variance(values: number[], sample: boolean = true): number {
    const stdDev = this.standardDeviation(values, sample);
    return Math.pow(stdDev, 2);
  }

  /**
   * Calculate skewness (measure of asymmetry)
   */
  skewness(values: number[]): number {
    if (values.length < 3) return 0;
    
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values);
    
    if (stdDev === 0) return 0;
    
    const n = values.length;
    const skew = values.reduce((sum, val) => {
      const standardized = (val - mean) / stdDev;
      return sum + Math.pow(standardized, 3);
    }, 0);
    
    return (n / ((n - 1) * (n - 2))) * skew;
  }

  /**
   * Calculate kurtosis (measure of tail extremity)
   */
  kurtosis(values: number[]): number {
    if (values.length < 4) return 0;
    
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values);
    
    if (stdDev === 0) return 0;
    
    const n = values.length;
    const kurt = values.reduce((sum, val) => {
      const standardized = (val - mean) / stdDev;
      return sum + Math.pow(standardized, 4);
    }, 0);
    
    const adjustment = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const correction = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));
    
    return adjustment * kurt - correction;
  }

  /**
   * Calculate correlation coefficient between two arrays
   */
  correlation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    let numerator = 0;
    let sumSquaredX = 0;
    let sumSquaredY = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      sumSquaredX += deltaX * deltaX;
      sumSquaredY += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(sumSquaredX * sumSquaredY);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate covariance between two arrays
   */
  covariance(x: number[], y: number[], sample: boolean = true): number {
    if (x.length !== y.length || x.length === 0) return 0;
    if (x.length === 1 && sample) return 0;
    
    const meanX = this.mean(x);
    const meanY = this.mean(y);
    
    const covarSum = x.reduce((sum, xi, i) => {
      return sum + (xi - meanX) * (y[i] - meanY);
    }, 0);
    
    const denominator = sample ? x.length - 1 : x.length;
    return denominator > 0 ? covarSum / denominator : 0;
  }

  /**
   * Calculate beta (systematic risk measure)
   */
  calculateBeta(assetReturns: number[], marketReturns: number[]): number {
    if (assetReturns.length !== marketReturns.length || assetReturns.length === 0) {
      return 1.0; // Default beta
    }
    
    const marketVariance = this.variance(marketReturns);
    if (marketVariance === 0) return 1.0;
    
    const covar = this.covariance(assetReturns, marketReturns);
    return covar / marketVariance;
  }

  /**
   * Calculate alpha (excess return measure)
   */
  calculateAlpha(
    assetReturns: number[], 
    marketReturns: number[], 
    beta: number, 
    riskFreeRate: number
  ): number {
    if (assetReturns.length === 0 || marketReturns.length === 0) return 0;
    
    const assetReturn = this.mean(assetReturns) * 252; // Annualized
    const marketReturn = this.mean(marketReturns) * 252; // Annualized
    const riskFreeRateAnnual = riskFreeRate * 100;
    
    return assetReturn - (riskFreeRateAnnual + beta * (marketReturn - riskFreeRateAnnual));
  }

  /**
   * Calculate tracking error
   */
  trackingError(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length === 0) {
      return 0;
    }
    
    const activeReturns = portfolioReturns.map((pr, i) => pr - benchmarkReturns[i]);
    return this.standardDeviation(activeReturns) * Math.sqrt(252); // Annualized
  }

  /**
   * Calculate returns from price series
   */
  calculateReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] === 0) {
        returns.push(0);
      } else {
        const returnValue = ((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;
        returns.push(returnValue);
      }
    }
    
    return returns;
  }

  /**
   * Calculate cumulative returns
   */
  calculateCumulativeReturns(returns: number[]): number[] {
    if (returns.length === 0) return [];
    
    const cumulative = [returns[0]];
    for (let i = 1; i < returns.length; i++) {
      const prev = cumulative[i - 1];
      const current = returns[i];
      cumulative.push(prev + current + (prev * current / 100));
    }
    
    return cumulative;
  }

  /**
   * Calculate log returns
   */
  calculateLogReturns(prices: number[]): number[] {
    if (prices.length < 2) return [];
    
    const logReturns = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] <= 0 || prices[i] <= 0) {
        logReturns.push(0);
      } else {
        logReturns.push(Math.log(prices[i] / prices[i - 1]) * 100);
      }
    }
    
    return logReturns;
  }

  /**
   * Calculate Value at Risk using historical method
   */
  calculateHistoricalVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((100 - confidenceLevel) / 100 * sortedReturns.length);
    
    return Math.abs(sortedReturns[Math.max(0, Math.min(index, sortedReturns.length - 1))]);
  }

  /**
   * Calculate Value at Risk using parametric method
   */
  calculateParametricVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;
    
    const mean = this.mean(returns);
    const stdDev = this.standardDeviation(returns);
    
    // Z-scores for common confidence levels
    const zScores: { [key: number]: number } = {
      90: 1.282,
      95: 1.645,
      99: 2.326,
      99.9: 3.090
    };
    
    const zScore = zScores[confidenceLevel] || 1.645;
    return Math.abs(mean - zScore * stdDev);
  }

  /**
   * Calculate Expected Shortfall (Conditional VaR)
   */
  calculateExpectedShortfall(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;
    
    const var_ = this.calculateHistoricalVaR(returns, confidenceLevel);
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const cutoffIndex = Math.floor((100 - confidenceLevel) / 100 * sortedReturns.length);
    
    const tailReturns = sortedReturns.slice(0, cutoffIndex + 1);
    return tailReturns.length > 0 ? Math.abs(this.mean(tailReturns)) : var_;
  }

  /**
   * Calculate rolling statistics
   */
  calculateRollingStatistic(
    values: number[], 
    windowSize: number, 
    statFunc: (values: number[]) => number
  ): number[] {
    if (values.length < windowSize) return [];
    
    const rollingStats = [];
    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1);
      rollingStats.push(statFunc(window));
    }
    
    return rollingStats;
  }

  /**
   * Calculate rolling mean
   */
  calculateRollingMean(values: number[], windowSize: number): number[] {
    return this.calculateRollingStatistic(values, windowSize, this.mean.bind(this));
  }

  /**
   * Calculate rolling standard deviation
   */
  calculateRollingStdDev(values: number[], windowSize: number): number[] {
    return this.calculateRollingStatistic(values, windowSize, this.standardDeviation.bind(this));
  }

  /**
   * Calculate rolling correlation
   */
  calculateRollingCorrelation(x: number[], y: number[], windowSize: number): number[] {
    if (x.length !== y.length || x.length < windowSize) return [];
    
    const rollingCorrs = [];
    for (let i = windowSize - 1; i < x.length; i++) {
      const windowX = x.slice(i - windowSize + 1, i + 1);
      const windowY = y.slice(i - windowSize + 1, i + 1);
      rollingCorrs.push(this.correlation(windowX, windowY));
    }
    
    return rollingCorrs;
  }

  /**
   * Calculate exponentially weighted moving average
   */
  calculateEWMA(values: number[], lambda: number = 0.94): number[] {
    if (values.length === 0) return [];
    
    const ewma = [values[0]];
    for (let i = 1; i < values.length; i++) {
      const newValue = lambda * ewma[i - 1] + (1 - lambda) * values[i];
      ewma.push(newValue);
    }
    
    return ewma;
  }

  /**
   * Calculate GARCH volatility (simplified)
   */
  calculateGARCHVolatility(
    returns: number[], 
    alpha: number = 0.1, 
    beta: number = 0.85
  ): number[] {
    if (returns.length === 0) return [];
    
    const volatilities = [this.standardDeviation(returns.slice(0, Math.min(30, returns.length)))];
    
    for (let i = 1; i < returns.length; i++) {
      const prevVol = volatilities[i - 1];
      const prevReturn = returns[i - 1];
      const omega = 0.0001; // Long-term variance component
      
      const newVol = Math.sqrt(
        omega + alpha * Math.pow(prevReturn / 100, 2) + beta * Math.pow(prevVol, 2)
      );
      volatilities.push(newVol);
    }
    
    return volatilities.map(vol => vol * Math.sqrt(252) * 100); // Annualized percentage
  }

  /**
   * Calculate maximum drawdown
   */
  calculateMaximumDrawdown(values: number[]): {
    maxDrawdown: number;
    maxDrawdownPeriod: { start: number; end: number };
    drawdownSeries: number[];
  } {
    if (values.length === 0) {
      return {
        maxDrawdown: 0,
        maxDrawdownPeriod: { start: 0, end: 0 },
        drawdownSeries: []
      };
    }

    let peak = values[0];
    let maxDrawdown = 0;
    let maxDrawdownStart = 0;
    let maxDrawdownEnd = 0;
    let currentDrawdownStart = 0;
    const drawdownSeries = [];

    for (let i = 0; i < values.length; i++) {
      if (values[i] > peak) {
        peak = values[i];
        currentDrawdownStart = i;
      }

      const drawdown = ((peak - values[i]) / peak) * 100;
      drawdownSeries.push(drawdown);

      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
        maxDrawdownStart = currentDrawdownStart;
        maxDrawdownEnd = i;
      }
    }

    return {
      maxDrawdown,
      maxDrawdownPeriod: { start: maxDrawdownStart, end: maxDrawdownEnd },
      drawdownSeries
    };
  }

  /**
   * Calculate Sharpe ratio
   */
  calculateSharpeRatio(returns: number[], riskFreeRate: number): number {
    if (returns.length === 0) return 0;
    
    const meanReturn = this.mean(returns) * 252; // Annualized
    const volatility = this.standardDeviation(returns) * Math.sqrt(252); // Annualized
    
    if (volatility === 0) return 0;
    
    const excessReturn = meanReturn - (riskFreeRate * 100);
    return excessReturn / volatility;
  }

  /**
   * Calculate Sortino ratio
   */
  calculateSortinoRatio(returns: number[], riskFreeRate: number): number {
    if (returns.length === 0) return 0;
    
    const meanReturn = this.mean(returns) * 252; // Annualized
    const negativeReturns = returns.filter(r => r < 0);
    const downsideVolatility = negativeReturns.length > 0 ? 
      this.standardDeviation(negativeReturns) * Math.sqrt(252) : 0;
    
    if (downsideVolatility === 0) return 0;
    
    const excessReturn = meanReturn - (riskFreeRate * 100);
    return excessReturn / downsideVolatility;
  }

  /**
   * Calculate information ratio
   */
  calculateInformationRatio(portfolioReturns: number[], benchmarkReturns: number[]): number {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length === 0) {
      return 0;
    }
    
    const activeReturns = portfolioReturns.map((pr, i) => pr - benchmarkReturns[i]);
    const meanActiveReturn = this.mean(activeReturns) * 252; // Annualized
    const trackingError = this.standardDeviation(activeReturns) * Math.sqrt(252); // Annualized
    
    return trackingError === 0 ? 0 : meanActiveReturn / trackingError;
  }

  /**
   * Calculate Calmar ratio
   */
  calculateCalmarRatio(returns: number[], values: number[]): number {
    if (returns.length === 0 || values.length === 0) return 0;
    
    const annualizedReturn = this.mean(returns) * 252;
    const { maxDrawdown } = this.calculateMaximumDrawdown(values);
    
    return maxDrawdown === 0 ? 0 : Math.abs(annualizedReturn / maxDrawdown);
  }

  /**
   * Normalize data to z-scores
   */
  normalize(values: number[]): number[] {
    if (values.length === 0) return [];
    
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values);
    
    if (stdDev === 0) return values.map(() => 0);
    
    return values.map(val => (val - mean) / stdDev);
  }

  /**
   * Calculate percentile
   */
  percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    if (percentile < 0 || percentile > 100) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (index % 1 === 0) {
      return sorted[index];
    } else {
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
  }

  /**
   * Calculate interquartile range
   */
  interquartileRange(values: number[]): {
    q1: number;
    q2: number;
    q3: number;
    iqr: number;
  } {
    const q1 = this.percentile(values, 25);
    const q2 = this.percentile(values, 50);
    const q3 = this.percentile(values, 75);
    const iqr = q3 - q1;
    
    return { q1, q2, q3, iqr };
  }

  /**
   * Detect outliers using IQR method
   */
  detectOutliers(values: number[], multiplier: number = 1.5): {
    outliers: number[];
    outlierIndices: number[];
    lowerBound: number;
    upperBound: number;
  } {
    const { q1, q3, iqr } = this.interquartileRange(values);
    const lowerBound = q1 - multiplier * iqr;
    const upperBound = q3 + multiplier * iqr;
    
    const outliers: number[] = [];
    const outlierIndices: number[] = [];
    
    values.forEach((value, index) => {
      if (value < lowerBound || value > upperBound) {
        outliers.push(value);
        outlierIndices.push(index);
      }
    });
    
    return {
      outliers,
      outlierIndices,
      lowerBound,
      upperBound
    };
  }

  /**
   * Calculate compound annual growth rate (CAGR)
   */
  calculateCAGR(beginningValue: number, endingValue: number, years: number): number {
    if (beginningValue <= 0 || endingValue <= 0 || years <= 0) return 0;
    
    return (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100;
  }

  /**
   * Calculate annualized volatility
   */
  calculateAnnualizedVolatility(returns: number[], periodsPerYear: number = 252): number {
    const dailyVolatility = this.standardDeviation(returns);
    return dailyVolatility * Math.sqrt(periodsPerYear);
  }

  /**
   * Calculate semi-variance (downside variance)
   */
  calculateSemiVariance(returns: number[], threshold: number = 0): number {
    const belowThreshold = returns.filter(r => r < threshold);
    if (belowThreshold.length === 0) return 0;
    
    const meanBelow = this.mean(belowThreshold);
    const squaredDeviations = belowThreshold.map(r => Math.pow(r - meanBelow, 2));
    
    return this.mean(squaredDeviations);
  }

  /**
   * Calculate upside/downside capture ratios
   */
  calculateCaptureRatios(portfolioReturns: number[], benchmarkReturns: number[]): {
    upsideCapture: number;
    downsideCapture: number;
  } {
    if (portfolioReturns.length !== benchmarkReturns.length || portfolioReturns.length === 0) {
      return { upsideCapture: 0, downsideCapture: 0 };
    }

    const upPeriods = portfolioReturns
      .map((pr, i) => ({ portfolio: pr, benchmark: benchmarkReturns[i] }))
      .filter(pair => pair.benchmark > 0);

    const downPeriods = portfolioReturns
      .map((pr, i) => ({ portfolio: pr, benchmark: benchmarkReturns[i] }))
      .filter(pair => pair.benchmark < 0);

    const upsideCapture = upPeriods.length > 0 ? 
      (this.mean(upPeriods.map(p => p.portfolio)) / this.mean(upPeriods.map(p => p.benchmark))) * 100 : 0;

    const downsideCapture = downPeriods.length > 0 ? 
      (this.mean(downPeriods.map(p => p.portfolio)) / this.mean(downPeriods.map(p => p.benchmark))) * 100 : 0;

    return { upsideCapture, downsideCapture };
  }

  /**
   * Calculate pain index (average drawdown)
   */
  calculatePainIndex(values: number[]): number {
    const { drawdownSeries } = this.calculateMaximumDrawdown(values);
    return this.mean(drawdownSeries);
  }

  /**
   * Calculate tail ratio
   */
  calculateTailRatio(returns: number[]): number {
    const rightTail = this.percentile(returns, 95);
    const leftTail = Math.abs(this.percentile(returns, 5));
    
    return leftTail === 0 ? 0 : rightTail / leftTail;
  }

  /**
   * Monte Carlo simulation for portfolio returns
   */
  monteCarloSimulation(
    meanReturn: number,
    volatility: number,
    periods: number,
    simulations: number = 1000
  ): number[][] {
    const results: number[][] = [];
    
    for (let sim = 0; sim < simulations; sim++) {
      const path = [100]; // Starting value
      
      for (let period = 1; period < periods; period++) {
        const randomReturn = this.generateNormalRandom(meanReturn / 100, volatility / 100);
        const newValue = path[period - 1] * (1 + randomReturn);
        path.push(newValue);
      }
      
      results.push(path);
    }
    
    return results;
  }

  /**
   * Generate random number from normal distribution (Box-Muller transform)
   */
  private generateNormalRandom(mean: number = 0, stdDev: number = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();
    
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  /**
   * Calculate portfolio variance given weights and covariance matrix
   */
  calculatePortfolioVariance(weights: number[], covarianceMatrix: number[][]): number {
    if (weights.length !== covarianceMatrix.length) return 0;
    
    let variance = 0;
    for (let i = 0; i < weights.length; i++) {
      for (let j = 0; j < weights.length; j++) {
        variance += weights[i] * weights[j] * covarianceMatrix[i][j];
      }
    }
    
    return variance;
  }

  /**
   * Calculate efficient frontier points
   */
  calculateEfficientFrontier(
    expectedReturns: number[],
    covarianceMatrix: number[][],
    riskFreeRate: number = 0.02,
    numPoints: number = 50
  ): { returns: number[]; risks: number[]; sharpeRatios: number[] } {
    const results = {
      returns: [] as number[],
      risks: [] as number[],
      sharpeRatios: [] as number[]
    };

    // Simplified efficient frontier calculation
    // In practice, would use quadratic optimization
    const minReturn = Math.min(...expectedReturns);
    const maxReturn = Math.max(...expectedReturns);
    const returnRange = (maxReturn - minReturn) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const targetReturn = minReturn + i * returnRange;
      
      // Simplified weight calculation (equal weight as placeholder)
      const weights = new Array(expectedReturns.length).fill(1 / expectedReturns.length);
      const portfolioReturn = weights.reduce((sum, weight, j) => sum + weight * expectedReturns[j], 0);
      const portfolioVariance = this.calculatePortfolioVariance(weights, covarianceMatrix);
      const portfolioRisk = Math.sqrt(portfolioVariance);
      const sharpeRatio = portfolioRisk === 0 ? 0 : (portfolioReturn - riskFreeRate) / portfolioRisk;

      results.returns.push(portfolioReturn);
      results.risks.push(portfolioRisk);
      results.sharpeRatios.push(sharpeRatio);
    }

    return results;
  }
}

// Create and export singleton instance
export const statisticalUtils = new StatisticalUtils();