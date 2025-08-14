interface PortfolioHistoryPoint {
  date: string;
  value: number;
  timestamp: number;
}

interface CashFlow {
  date: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  timestamp: number;
}

interface PerformanceReturn {
  date: string;
  return: number;
  cumulativeReturn: number;
  timestamp: number;
}

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
  timeWeightedReturn: number;
  moneyWeightedReturn: number;
  diversificationRatio: number;
  bestMonth: number;
  worstMonth: number;
  avgMonthlyReturn: number;
  skewness: number;
  kurtosis: number;
  var95: number; // Value at Risk (95%)
  cvar95: number; // Conditional Value at Risk (95%)
  betaToMarket: number;
  alphaToMarket: number;
  informationRatio: number;
  trackingError: number;
  periodicReturns: Array<{
    period: string;
    portfolio: number;
    benchmark: number;
    difference: number;
  }>;
}

interface RiskMetrics {
  valueAtRisk: {
    daily95: number;
    weekly95: number;
    monthly95: number;
  };
  expectedShortfall: {
    daily95: number;
    weekly95: number;
    monthly95: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  volatilityMetrics: {
    realized: number;
    parkinson: number;
    garchEstimate: number;
  };
  correlationRisk: number;
  concentrationRisk: number;
  liquidityRisk: number;
}

interface DrawdownAnalysis {
  date: string;
  drawdown: number;
  peak: number;
  trough: number;
  recovery: number;
  duration: number; // days
  timestamp: number;
}

interface BenchmarkComparison {
  benchmark: string;
  correlation: number;
  beta: number;
  alpha: number;
  trackingError: number;
  informationRatio: number;
  relativeReturn: number;
  upCapture: number;
  downCapture: number;
}

class PerformanceAnalyticsService {
  private riskFreeRate: number = 0.02; // 2% annual risk-free rate

  // Main performance metrics calculation
  calculatePerformanceMetrics(
    portfolioHistory: PortfolioHistoryPoint[],
    cashFlows: CashFlow[] = [],
    benchmarkData: PerformanceReturn[] = []
  ): PerformanceMetrics {
    if (portfolioHistory.length < 2) {
      throw new Error('Insufficient data for performance calculation');
    }

    const returns = this.calculateReturns(portfolioHistory);
    const totalReturn = this.calculateTotalReturn(portfolioHistory);
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const volatility = this.calculateVolatility(returns);
    
    return {
      totalReturn,
      annualizedReturn,
      volatility,
      sharpeRatio: this.calculateSharpeRatio(annualizedReturn, volatility),
      sortinoRatio: this.calculateSortinoRatio(returns, annualizedReturn),
      maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
      winRate: this.calculateWinRate(returns),
      profitFactor: this.calculateProfitFactor(returns),
      calmarRatio: this.calculateCalmarRatio(annualizedReturn, this.calculateMaxDrawdown(portfolioHistory)),
      timeWeightedReturn: this.calculateTimeWeightedReturn(portfolioHistory),
      moneyWeightedReturn: this.calculateMoneyWeightedReturn(portfolioHistory, cashFlows),
      diversificationRatio: this.calculateDiversificationRatio(returns),
      bestMonth: this.getBestPeriodReturn(returns, 'month'),
      worstMonth: this.getWorstPeriodReturn(returns, 'month'),
      avgMonthlyReturn: this.getAveragePeriodReturn(returns, 'month'),
      skewness: this.calculateSkewness(returns),
      kurtosis: this.calculateKurtosis(returns),
      var95: this.calculateVaR(returns, 0.05),
      cvar95: this.calculateCVaR(returns, 0.05),
      betaToMarket: benchmarkData.length > 0 ? this.calculateBeta(returns, benchmarkData) : 0,
      alphaToMarket: benchmarkData.length > 0 ? this.calculateAlpha(returns, benchmarkData, annualizedReturn) : 0,
      informationRatio: benchmarkData.length > 0 ? this.calculateInformationRatio(returns, benchmarkData) : 0,
      trackingError: benchmarkData.length > 0 ? this.calculateTrackingError(returns, benchmarkData) : 0,
      periodicReturns: this.calculatePeriodicReturns(returns, benchmarkData)
    };
  }

  // Calculate daily returns from portfolio history
  calculateReturns(portfolioHistory: PortfolioHistoryPoint[]): PerformanceReturn[] {
    const returns: PerformanceReturn[] = [];
    let cumulativeReturn = 0;

    for (let i = 1; i < portfolioHistory.length; i++) {
      const previousValue = portfolioHistory[i - 1].value;
      const currentValue = portfolioHistory[i].value;
      
      if (previousValue > 0) {
        const dailyReturn = (currentValue - previousValue) / previousValue;
        cumulativeReturn = (1 + cumulativeReturn) * (1 + dailyReturn) - 1;
        
        returns.push({
          date: portfolioHistory[i].date,
          return: dailyReturn,
          cumulativeReturn,
          timestamp: portfolioHistory[i].timestamp
        });
      }
    }
    
    return returns;
  }

  // Calculate total return from start to end
  calculateTotalReturn(portfolioHistory: PortfolioHistoryPoint[]): number {
    if (portfolioHistory.length < 2) return 0;
    
    const initialValue = portfolioHistory[0].value;
    const finalValue = portfolioHistory[portfolioHistory.length - 1].value;
    
    return (finalValue - initialValue) / initialValue;
  }

  // Calculate annualized return
  calculateAnnualizedReturn(returns: PerformanceReturn[]): number {
    if (returns.length === 0) return 0;
    
    const totalReturn = returns[returns.length - 1].cumulativeReturn;
    const days = returns.length;
    const years = days / 365.25;
    
    if (years <= 0) return 0;
    
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  // Calculate annualized volatility
  calculateVolatility(returns: PerformanceReturn[]): number {
    if (returns.length < 2) return 0;
    
    const returnValues = returns.map(r => r.return);
    const avgReturn = returnValues.reduce((sum, r) => sum + r, 0) / returnValues.length;
    
    const variance = returnValues.reduce((sum, r) => {
      return sum + Math.pow(r - avgReturn, 2);
    }, 0) / (returnValues.length - 1);
    
    const dailyVolatility = Math.sqrt(variance);
    return dailyVolatility * Math.sqrt(252); // Annualized
  }

  // Calculate Sharpe ratio
  calculateSharpeRatio(annualizedReturn: number, volatility: number): number {
    if (volatility === 0) return 0;
    return (annualizedReturn - this.riskFreeRate) / volatility;
  }

  // Calculate Sortino ratio (only considers downside volatility)
  calculateSortinoRatio(returns: PerformanceReturn[], annualizedReturn: number): number {
    const returnValues = returns.map(r => r.return);
    const avgReturn = returnValues.reduce((sum, r) => sum + r, 0) / returnValues.length;
    
    const downsideVariance = returnValues.reduce((sum, r) => {
      return r < avgReturn ? sum + Math.pow(r - avgReturn, 2) : sum;
    }, 0) / returnValues.length;
    
    const downsideDeviation = Math.sqrt(downsideVariance) * Math.sqrt(252);
    
    if (downsideDeviation === 0) return 0;
    return (annualizedReturn - this.riskFreeRate) / downsideDeviation;
  }

  // Calculate maximum drawdown
  calculateMaxDrawdown(portfolioHistory: PortfolioHistoryPoint[]): number {
    let maxDrawdown = 0;
    let peak = portfolioHistory[0]?.value || 0;
    
    for (const point of portfolioHistory) {
      if (point.value > peak) {
        peak = point.value;
      }
      
      const drawdown = peak > 0 ? (peak - point.value) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  // Calculate detailed drawdown analysis
  calculateDrawdownAnalysis(portfolioHistory: PortfolioHistoryPoint[]): DrawdownAnalysis[] {
    const drawdowns: DrawdownAnalysis[] = [];
    let peak = portfolioHistory[0]?.value || 0;
    let peakDate = portfolioHistory[0]?.date || '';
    let trough = peak;
    let troughDate = peakDate;
    let inDrawdown = false;
    
    portfolioHistory.forEach((point, index) => {
      if (point.value > peak) {
        // New peak reached
        if (inDrawdown) {
          // End of drawdown period - calculate recovery
          const recoveryDays = this.daysBetween(troughDate, point.date);
          const drawdownDuration = this.daysBetween(peakDate, troughDate);
          
          drawdowns.push({
            date: troughDate,
            drawdown: (peak - trough) / peak,
            peak,
            trough,
            recovery: recoveryDays,
            duration: drawdownDuration,
            timestamp: point.timestamp
          });
          
          inDrawdown = false;
        }
        
        peak = point.value;
        peakDate = point.date;
        trough = peak;
        troughDate = peakDate;
      } else if (point.value < trough) {
        // New trough in current drawdown
        trough = point.value;
        troughDate = point.date;
        inDrawdown = true;
      }
      
      // Add current drawdown state
      const currentDrawdown = peak > 0 ? (peak - point.value) / peak : 0;
      if (currentDrawdown > 0 || index === portfolioHistory.length - 1) {
        drawdowns.push({
          date: point.date,
          drawdown: currentDrawdown,
          peak,
          trough: point.value,
          recovery: 0, // Ongoing
          duration: this.daysBetween(peakDate, point.date),
          timestamp: point.timestamp
        });
      }
    });
    
    return drawdowns;
  }

  // Calculate win rate (percentage of positive returns)
  calculateWinRate(returns: PerformanceReturn[]): number {
    if (returns.length === 0) return 0;
    
    const positiveReturns = returns.filter(r => r.return > 0).length;
    return positiveReturns / returns.length;
  }

  // Calculate profit factor
  calculateProfitFactor(returns: PerformanceReturn[]): number {
    const profits = returns.filter(r => r.return > 0).reduce((sum, r) => sum + r.return, 0);
    const losses = Math.abs(returns.filter(r => r.return < 0).reduce((sum, r) => sum + r.return, 0));
    
    return losses > 0 ? profits / losses : profits > 0 ? Infinity : 0;
  }

  // Calculate Calmar ratio (annualized return / max drawdown)
  calculateCalmarRatio(annualizedReturn: number, maxDrawdown: number): number {
    return maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
  }

  // Calculate time-weighted return (geometric return)
  calculateTimeWeightedReturn(portfolioHistory: PortfolioHistoryPoint[]): number {
    return this.calculateTotalReturn(portfolioHistory);
  }

  // Calculate money-weighted return (IRR)
  calculateMoneyWeightedReturn(portfolioHistory: PortfolioHistoryPoint[], cashFlows: CashFlow[]): number {
    if (cashFlows.length === 0) {
      return this.calculateTimeWeightedReturn(portfolioHistory);
    }

    // Prepare cash flows for IRR calculation
    const flows = [...cashFlows];
    
    // Add initial investment (negative)
    if (portfolioHistory.length > 0) {
      flows.unshift({
        date: portfolioHistory[0].date,
        amount: -portfolioHistory[0].value,
        type: 'deposit',
        timestamp: portfolioHistory[0].timestamp
      });
    }
    
    // Add final value (positive)
    if (portfolioHistory.length > 0) {
      const lastPoint = portfolioHistory[portfolioHistory.length - 1];
      flows.push({
        date: lastPoint.date,
        amount: lastPoint.value,
        type: 'withdrawal',
        timestamp: lastPoint.timestamp
      });
    }
    
    return this.calculateIRR(flows);
  }

  // Internal Rate of Return calculation using Newton-Raphson method
  calculateIRR(cashFlows: CashFlow[]): number {
    if (cashFlows.length < 2) return 0;
    
    let irr = 0.1; // Initial guess
    const maxIterations = 100;
    const tolerance = 1e-6;
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let npvDerivative = 0;
      
      const baseDate = new Date(cashFlows[0].date);
      
      cashFlows.forEach((cf) => {
        const days = this.daysBetween(cashFlows[0].date, cf.date);
        const years = days / 365.25;
        const factor = Math.pow(1 + irr, years);
        
        const amount = cf.type === 'deposit' ? -cf.amount : cf.amount;
        npv += amount / factor;
        npvDerivative -= amount * years / (factor * (1 + irr));
      });
      
      if (Math.abs(npv) < tolerance) {
        return irr;
      }
      
      if (Math.abs(npvDerivative) < tolerance) {
        break;
      }
      
      irr = irr - npv / npvDerivative;
      
      // Constrain IRR to reasonable bounds
      irr = Math.max(-0.99, Math.min(irr, 10));
    }
    
    return irr;
  }

  // Calculate portfolio diversification ratio
  calculateDiversificationRatio(returns: PerformanceReturn[]): number {
    // Simplified calculation - in real implementation would need individual asset data
    const returnValues = returns.map(r => r.return);
    const volatility = this.calculateVolatility(returns);
    
    // Placeholder calculation based on return consistency
    const avgAbsReturn = returnValues.reduce((sum, r) => sum + Math.abs(r), 0) / returnValues.length;
    const maxAbsReturn = Math.max(...returnValues.map(r => Math.abs(r)));
    
    return maxAbsReturn > 0 ? 1 - (avgAbsReturn / maxAbsReturn) : 0;
  }

  // Statistical measures
  calculateSkewness(returns: PerformanceReturn[]): number {
    const returnValues = returns.map(r => r.return);
    const mean = returnValues.reduce((sum, r) => sum + r, 0) / returnValues.length;
    const variance = returnValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returnValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const skewness = returnValues.reduce((sum, r) => {
      return sum + Math.pow((r - mean) / stdDev, 3);
    }, 0) / returnValues.length;
    
    return skewness;
  }

  calculateKurtosis(returns: PerformanceReturn[]): number {
    const returnValues = returns.map(r => r.return);
    const mean = returnValues.reduce((sum, r) => sum + r, 0) / returnValues.length;
    const variance = returnValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returnValues.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const kurtosis = returnValues.reduce((sum, r) => {
      return sum + Math.pow((r - mean) / stdDev, 4);
    }, 0) / returnValues.length;
    
    return kurtosis - 3; // Excess kurtosis
  }

  // Value at Risk calculation
  calculateVaR(returns: PerformanceReturn[], confidenceLevel: number): number {
    const returnValues = returns.map(r => r.return).sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * returnValues.length);
    return Math.abs(returnValues[index] || 0);
  }

  // Conditional Value at Risk (Expected Shortfall)
  calculateCVaR(returns: PerformanceReturn[], confidenceLevel: number): number {
    const returnValues = returns.map(r => r.return).sort((a, b) => a - b);
    const cutoffIndex = Math.floor((1 - confidenceLevel) * returnValues.length);
    const tailReturns = returnValues.slice(0, cutoffIndex + 1);
    
    if (tailReturns.length === 0) return 0;
    
    const avgTailReturn = tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
    return Math.abs(avgTailReturn);
  }

  // Benchmark comparison calculations
  calculateBeta(portfolioReturns: PerformanceReturn[], benchmarkReturns: PerformanceReturn[]): number {
    const alignedData = this.alignReturnData(portfolioReturns, benchmarkReturns);
    
    if (alignedData.length < 2) return 0;
    
    const portfolioValues = alignedData.map(d => d.portfolio);
    const benchmarkValues = alignedData.map(d => d.benchmark);
    
    const portfolioMean = portfolioValues.reduce((sum, r) => sum + r, 0) / portfolioValues.length;
    const benchmarkMean = benchmarkValues.reduce((sum, r) => sum + r, 0) / benchmarkValues.length;
    
    let covariance = 0;
    let benchmarkVariance = 0;
    
    for (let i = 0; i < alignedData.length; i++) {
      const portfolioDiff = portfolioValues[i] - portfolioMean;
      const benchmarkDiff = benchmarkValues[i] - benchmarkMean;
      
      covariance += portfolioDiff * benchmarkDiff;
      benchmarkVariance += benchmarkDiff * benchmarkDiff;
    }
    
    return benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
  }

  calculateAlpha(portfolioReturns: PerformanceReturn[], benchmarkReturns: PerformanceReturn[], portfolioReturn: number): number {
    const beta = this.calculateBeta(portfolioReturns, benchmarkReturns);
    const benchmarkReturn = this.calculateAnnualizedReturn(benchmarkReturns);
    
    return portfolioReturn - (this.riskFreeRate + beta * (benchmarkReturn - this.riskFreeRate));
  }

  calculateTrackingError(portfolioReturns: PerformanceReturn[], benchmarkReturns: PerformanceReturn[]): number {
    const alignedData = this.alignReturnData(portfolioReturns, benchmarkReturns);
    
    if (alignedData.length < 2) return 0;
    
    const differences = alignedData.map(d => d.portfolio - d.benchmark);
    const avgDifference = differences.reduce((sum, d) => sum + d, 0) / differences.length;
    
    const variance = differences.reduce((sum, d) => {
      return sum + Math.pow(d - avgDifference, 2);
    }, 0) / (differences.length - 1);
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  calculateInformationRatio(portfolioReturns: PerformanceReturn[], benchmarkReturns: PerformanceReturn[]): number {
    const portfolioReturn = this.calculateAnnualizedReturn(portfolioReturns);
    const benchmarkReturn = this.calculateAnnualizedReturn(benchmarkReturns);
    const trackingError = this.calculateTrackingError(portfolioReturns, benchmarkReturns);
    
    return trackingError > 0 ? (portfolioReturn - benchmarkReturn) / trackingError : 0;
  }

  // Risk metrics calculation
  calculateRiskMetrics(returns: PerformanceReturn[]): RiskMetrics {
    const dailyVaR95 = this.calculateVaR(returns, 0.05);
    const dailyCVaR95 = this.calculateCVaR(returns, 0.05);
    const volatility = this.calculateVolatility(returns);
    
    return {
      valueAtRisk: {
        daily95: dailyVaR95,
        weekly95: dailyVaR95 * Math.sqrt(7),
        monthly95: dailyVaR95 * Math.sqrt(30)
      },
      expectedShortfall: {
        daily95: dailyCVaR95,
        weekly95: dailyCVaR95 * Math.sqrt(7),
        monthly95: dailyCVaR95 * Math.sqrt(30)
      },
      riskLevel: volatility > 0.4 ? 'high' : volatility > 0.2 ? 'medium' : 'low',
      volatilityMetrics: {
        realized: volatility,
        parkinson: this.calculateParkinsonVolatility(returns),
        garchEstimate: volatility * 1.1 // Simplified GARCH estimate
      },
      correlationRisk: 0.5, // Placeholder - would need individual asset correlations
      concentrationRisk: 0.3, // Placeholder - would need position sizes
      liquidityRisk: 0.2 // Placeholder - would need asset liquidity data
    };
  }

  calculateParkinsonVolatility(returns: PerformanceReturn[]): number {
    // Simplified Parkinson estimator using only close prices
    // In real implementation would need high/low prices
    return this.calculateVolatility(returns) * 0.9;
  }

  // Utility functions
  private alignReturnData(portfolioReturns: PerformanceReturn[], benchmarkReturns: PerformanceReturn[]) {
    const benchmarkMap = new Map(benchmarkReturns.map(r => [r.date, r.return]));
    
    return portfolioReturns
      .map(pr => ({
        date: pr.date,
        portfolio: pr.return,
        benchmark: benchmarkMap.get(pr.date) || 0
      }))
      .filter(item => benchmarkMap.has(item.date));
  }

  private getBestPeriodReturn(returns: PerformanceReturn[], period: 'month' | 'quarter' | 'year'): number {
    const periodReturns = this.groupReturnsByPeriod(returns, period);
    return periodReturns.length > 0 ? Math.max(...periodReturns.map(p => p.return)) : 0;
  }

  private getWorstPeriodReturn(returns: PerformanceReturn[], period: 'month' | 'quarter' | 'year'): number {
    const periodReturns = this.groupReturnsByPeriod(returns, period);
    return periodReturns.length > 0 ? Math.min(...periodReturns.map(p => p.return)) : 0;
  }

  private getAveragePeriodReturn(returns: PerformanceReturn[], period: 'month' | 'quarter' | 'year'): number {
    const periodReturns = this.groupReturnsByPeriod(returns, period);
    if (periodReturns.length === 0) return 0;
    
    const sum = periodReturns.reduce((total, p) => total + p.return, 0);
    return sum / periodReturns.length;
  }

  private groupReturnsByPeriod(returns: PerformanceReturn[], period: 'month' | 'quarter' | 'year') {
    const grouped = new Map<string, number>();
    
    returns.forEach(r => {
      const date = new Date(r.date);
      let key: string;
      
      switch (period) {
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarter':
          key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
          break;
        case 'year':
          key = `${date.getFullYear()}`;
          break;
      }
      
      const existing = grouped.get(key) || 0;
      grouped.set(key, (1 + existing) * (1 + r.return) - 1);
    });
    
    return Array.from(grouped.entries()).map(([period, return_]) => ({
      period,
      return: return_
    }));
  }

  private calculatePeriodicReturns(portfolioReturns: PerformanceReturn[], benchmarkReturns: PerformanceReturn[]) {
    const portfolioPeriods = this.groupReturnsByPeriod(portfolioReturns, 'month');
    const benchmarkPeriods = new Map(
      this.groupReturnsByPeriod(benchmarkReturns, 'month').map(p => [p.period, p.return])
    );
    
    return portfolioPeriods.map(p => ({
      period: p.period,
      portfolio: p.return,
      benchmark: benchmarkPeriods.get(p.period) || 0,
      difference: p.return - (benchmarkPeriods.get(p.period) || 0)
    }));
  }

  private daysBetween(date1: string, date2: string): number {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);
    
    return Math.round(Math.abs((secondDate.getTime() - firstDate.getTime()) / oneDay));
  }
}

export const performanceAnalyticsService = new PerformanceAnalyticsService();
export type { PerformanceMetrics, RiskMetrics, DrawdownAnalysis, BenchmarkComparison, PerformanceReturn };