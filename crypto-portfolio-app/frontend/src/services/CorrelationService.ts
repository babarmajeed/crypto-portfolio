// Correlation Service for multi-asset statistical analysis

interface PriceData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CorrelationResult {
  correlation: number;
  pValue: number;
  sampleSize: number;
  confidence: number;
}

interface RegressionResult {
  alpha: number;
  beta: number;
  rSquared: number;
  standardError: number;
  correlation: number;
}

interface StatisticalMetrics {
  mean: number;
  standardDeviation: number;
  variance: number;
  sharpeRatio: number;
  volatility: number;
  skewness: number;
  kurtosis: number;
}

class CorrelationService {
  // Calculate Pearson correlation coefficient
  calculatePearsonCorrelation(data1: PriceData[], data2: PriceData[]): number {
    if (!data1 || !data2 || data1.length === 0 || data2.length === 0) {
      return 0;
    }

    // Align data by timestamp
    const alignedData = this.alignDataByTime(data1, data2);
    if (alignedData.aligned1.length < 2) return 0;

    const prices1 = alignedData.aligned1.map(d => d.close);
    const prices2 = alignedData.aligned2.map(d => d.close);

    return this.calculateCorrelationFromArrays(prices1, prices2);
  }

  // Calculate correlation from arrays of numbers
  calculateCorrelationFromArrays(arr1: number[], arr2: number[]): number {
    if (arr1.length !== arr2.length || arr1.length < 2) return 0;

    const n = arr1.length;
    const mean1 = arr1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = arr2.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sumSq1 = 0;
    let sumSq2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = arr1[i] - mean1;
      const diff2 = arr2[i] - mean2;
      
      numerator += diff1 * diff2;
      sumSq1 += diff1 * diff1;
      sumSq2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(sumSq1 * sumSq2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Calculate enhanced correlation with statistical significance
  calculateEnhancedCorrelation(data1: PriceData[], data2: PriceData[]): CorrelationResult {
    const correlation = this.calculatePearsonCorrelation(data1, data2);
    const alignedData = this.alignDataByTime(data1, data2);
    const n = alignedData.aligned1.length;

    // Calculate t-statistic for significance testing
    const tStat = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    
    // Approximate p-value calculation (two-tailed test)
    const pValue = this.calculatePValue(Math.abs(tStat), n - 2);
    
    // Confidence level based on p-value
    const confidence = 1 - pValue;

    return {
      correlation,
      pValue,
      sampleSize: n,
      confidence
    };
  }

  // Calculate rolling correlation
  calculateRollingCorrelation(
    data1: PriceData[], 
    data2: PriceData[], 
    window: number = 20
  ): Array<{ time: number; correlation: number }> {
    const alignedData = this.alignDataByTime(data1, data2);
    const result: Array<{ time: number; correlation: number }> = [];

    if (alignedData.aligned1.length < window) return result;

    for (let i = window - 1; i < alignedData.aligned1.length; i++) {
      const windowData1 = alignedData.aligned1.slice(i - window + 1, i + 1);
      const windowData2 = alignedData.aligned2.slice(i - window + 1, i + 1);
      
      const prices1 = windowData1.map(d => d.close);
      const prices2 = windowData2.map(d => d.close);
      
      const correlation = this.calculateCorrelationFromArrays(prices1, prices2);
      
      result.push({
        time: alignedData.aligned1[i].time,
        correlation
      });
    }

    return result;
  }

  // Calculate linear regression (beta analysis)
  calculateLinearRegression(
    independentData: PriceData[], 
    dependentData: PriceData[]
  ): RegressionResult {
    const alignedData = this.alignDataByTime(independentData, dependentData);
    
    if (alignedData.aligned1.length < 2) {
      return {
        alpha: 0,
        beta: 0,
        rSquared: 0,
        standardError: 0,
        correlation: 0
      };
    }

    // Calculate returns for regression
    const returns1 = this.calculateReturns(alignedData.aligned1);
    const returns2 = this.calculateReturns(alignedData.aligned2);

    const n = returns1.length;
    const meanX = returns1.reduce((sum, val) => sum + val, 0) / n;
    const meanY = returns2.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denominator = 0;
    let ssr = 0; // Sum of squared residuals
    let sst = 0; // Total sum of squares

    // Calculate beta (slope)
    for (let i = 0; i < n; i++) {
      const diffX = returns1[i] - meanX;
      const diffY = returns2[i] - meanY;
      
      numerator += diffX * diffY;
      denominator += diffX * diffX;
      sst += diffY * diffY;
    }

    const beta = denominator === 0 ? 0 : numerator / denominator;
    const alpha = meanY - (beta * meanX);

    // Calculate R-squared
    for (let i = 0; i < n; i++) {
      const predicted = alpha + (beta * returns1[i]);
      const residual = returns2[i] - predicted;
      ssr += residual * residual;
    }

    const rSquared = sst === 0 ? 0 : 1 - (ssr / sst);
    const standardError = Math.sqrt(ssr / (n - 2));
    const correlation = this.calculateCorrelationFromArrays(returns1, returns2);

    return {
      alpha,
      beta,
      rSquared,
      standardError,
      correlation
    };
  }

  // Calculate comprehensive statistical metrics
  calculateStatisticalMetrics(data: PriceData[], riskFreeRate: number = 0.02): StatisticalMetrics {
    if (!data || data.length < 2) {
      return {
        mean: 0,
        standardDeviation: 0,
        variance: 0,
        sharpeRatio: 0,
        volatility: 0,
        skewness: 0,
        kurtosis: 0
      };
    }

    const returns = this.calculateReturns(data);
    const n = returns.length;
    
    // Calculate mean return
    const mean = returns.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate variance and standard deviation
    const variance = returns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
    const standardDeviation = Math.sqrt(variance);
    
    // Annualized volatility (assuming daily data)
    const volatility = standardDeviation * Math.sqrt(252);
    
    // Sharpe ratio
    const excessReturn = mean - (riskFreeRate / 252); // Daily risk-free rate
    const sharpeRatio = standardDeviation === 0 ? 0 : (excessReturn / standardDeviation) * Math.sqrt(252);
    
    // Skewness (third moment)
    const skewness = n > 2 ? (
      returns.reduce((sum, val) => sum + Math.pow((val - mean) / standardDeviation, 3), 0) * 
      (n / ((n - 1) * (n - 2)))
    ) : 0;
    
    // Kurtosis (fourth moment)
    const kurtosis = n > 3 ? (
      (returns.reduce((sum, val) => sum + Math.pow((val - mean) / standardDeviation, 4), 0) * 
       (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) - 
      (3 * (n - 1) * (n - 1) / ((n - 2) * (n - 3)))
    ) : 0;

    return {
      mean: mean * 252, // Annualized
      standardDeviation,
      variance,
      sharpeRatio,
      volatility,
      skewness,
      kurtosis
    };
  }

  // Calculate correlation matrix for multiple assets
  calculateCorrelationMatrix(multiAssetData: Record<string, PriceData[]>): Record<string, Record<string, number>> {
    const assets = Object.keys(multiAssetData);
    const matrix: Record<string, Record<string, number>> = {};

    assets.forEach(asset1 => {
      matrix[asset1] = {};
      
      assets.forEach(asset2 => {
        if (asset1 === asset2) {
          matrix[asset1][asset2] = 1;
        } else {
          matrix[asset1][asset2] = this.calculatePearsonCorrelation(
            multiAssetData[asset1],
            multiAssetData[asset2]
          );
        }
      });
    });

    return matrix;
  }

  // Calculate diversification ratio
  calculateDiversificationRatio(weights: number[], correlationMatrix: number[][]): number {
    if (weights.length !== correlationMatrix.length) return 0;

    const n = weights.length;
    let weightedSum = 0;
    let portfolioVariance = 0;

    // Weighted sum of individual volatilities
    for (let i = 0; i < n; i++) {
      weightedSum += weights[i]; // Assuming unit volatilities for simplification
    }

    // Portfolio variance calculation
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portfolioVariance += weights[i] * weights[j] * correlationMatrix[i][j];
      }
    }

    const portfolioVolatility = Math.sqrt(portfolioVariance);
    return portfolioVolatility === 0 ? 0 : weightedSum / portfolioVolatility;
  }

  // Find optimal portfolio weights (minimum variance)
  calculateMinimumVarianceWeights(correlationMatrix: number[][]): number[] {
    const n = correlationMatrix.length;
    if (n === 0) return [];

    // For simplicity, using equal weights as approximation
    // In production, would implement quadratic programming solver
    const equalWeight = 1 / n;
    return new Array(n).fill(equalWeight);
  }

  // Helper methods
  private alignDataByTime(data1: PriceData[], data2: PriceData[]): {
    aligned1: PriceData[];
    aligned2: PriceData[];
  } {
    const aligned1: PriceData[] = [];
    const aligned2: PriceData[] = [];

    // Create time maps for efficient lookup
    const timeMap1 = new Map(data1.map(item => [item.time, item]));
    const timeMap2 = new Map(data2.map(item => [item.time, item]));

    // Find common timestamps
    const commonTimes = data1
      .map(item => item.time)
      .filter(time => timeMap2.has(time))
      .sort((a, b) => a - b);

    // Build aligned arrays
    commonTimes.forEach(time => {
      const item1 = timeMap1.get(time);
      const item2 = timeMap2.get(time);
      
      if (item1 && item2) {
        aligned1.push(item1);
        aligned2.push(item2);
      }
    });

    return { aligned1, aligned2 };
  }

  private calculateReturns(data: PriceData[]): number[] {
    if (data.length < 2) return [];

    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const previousPrice = data[i - 1].close;
      const currentPrice = data[i].close;
      const returnValue = (currentPrice - previousPrice) / previousPrice;
      returns.push(returnValue);
    }

    return returns;
  }

  private calculatePValue(tStat: number, df: number): number {
    // Simplified p-value calculation using t-distribution approximation
    // In production, would use proper statistical library
    if (df <= 0) return 1;
    
    const x = tStat * tStat / (tStat * tStat + df);
    const p = 0.5 * this.incompleteBeta(0.5, df / 2, x);
    
    return 2 * Math.min(p, 1 - p); // Two-tailed test
  }

  private incompleteBeta(a: number, b: number, x: number): number {
    // Simplified incomplete beta function approximation
    // In production, would use proper mathematical library
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    
    // Simple approximation for demonstration
    return Math.pow(x, a) * Math.pow(1 - x, b) / (a + b);
  }

  // Cointegration test (Engle-Granger method simplified)
  testCointegration(data1: PriceData[], data2: PriceData[]): {
    isCointegrated: boolean;
    testStatistic: number;
    criticalValue: number;
  } {
    const alignedData = this.alignDataByTime(data1, data2);
    
    if (alignedData.aligned1.length < 10) {
      return {
        isCointegrated: false,
        testStatistic: 0,
        criticalValue: -2.86 // 5% critical value approximation
      };
    }

    const prices1 = alignedData.aligned1.map(d => Math.log(d.close));
    const prices2 = alignedData.aligned2.map(d => Math.log(d.close));

    // Step 1: Run regression
    const regression = this.calculateLinearRegression(
      alignedData.aligned1.map((d, i) => ({ ...d, close: prices1[i] })),
      alignedData.aligned2.map((d, i) => ({ ...d, close: prices2[i] }))
    );

    // Step 2: Calculate residuals
    const residuals = prices2.map((y, i) => y - (regression.alpha + regression.beta * prices1[i]));

    // Step 3: ADF test on residuals (simplified)
    const adfStat = this.augmentedDickeyFullerTest(residuals);
    const criticalValue = -2.86; // 5% critical value

    return {
      isCointegrated: adfStat < criticalValue,
      testStatistic: adfStat,
      criticalValue
    };
  }

  private augmentedDickeyFullerTest(series: number[]): number {
    // Simplified ADF test
    if (series.length < 3) return 0;

    const n = series.length - 1;
    const y = series.slice(1);
    const yLag = series.slice(0, -1);
    const deltaY = y.map((val, i) => val - yLag[i]);

    // Run regression: ΔY = α + βY_{t-1} + ε
    const meanYLag = yLag.reduce((sum, val) => sum + val, 0) / yLag.length;
    const meanDeltaY = deltaY.reduce((sum, val) => sum + val, 0) / deltaY.length;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const diffYLag = yLag[i] - meanYLag;
      const diffDeltaY = deltaY[i] - meanDeltaY;
      
      numerator += diffYLag * diffDeltaY;
      denominator += diffYLag * diffYLag;
    }

    const beta = denominator === 0 ? 0 : numerator / denominator;
    
    // Calculate standard error (simplified)
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const predicted = meanDeltaY + beta * (yLag[i] - meanYLag);
      const residual = deltaY[i] - predicted;
      sse += residual * residual;
    }

    const standardError = Math.sqrt(sse / (n - 2)) / Math.sqrt(denominator);
    
    return standardError === 0 ? 0 : beta / standardError;
  }
}

// Export singleton instance
export const correlationService = new CorrelationService();
export default correlationService;