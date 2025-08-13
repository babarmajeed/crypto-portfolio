# CP-038: Portfolio Performance Analytics Dashboard

## Overview
Create comprehensive analytics dashboard with advanced portfolio performance metrics, risk analysis, benchmarking, and detailed insights to help users understand their investment performance.

## Objectives
- Build advanced performance metrics calculation engine
- Implement risk analysis tools (VaR, Sharpe ratio, volatility)
- Create benchmarking against market indices
- Add time-weighted and money-weighted return analysis

## Acceptance Criteria
- [ ] Performance metrics dashboard (returns, volatility, Sharpe ratio)
- [ ] Risk analysis tools (Value at Risk, maximum drawdown)
- [ ] Benchmark comparison against BTC, ETH, and market indices
- [ ] Time-weighted vs money-weighted returns
- [ ] Asset allocation efficiency analysis
- [ ] Historical performance attribution
- [ ] Risk-adjusted performance metrics
- [ ] Monte Carlo simulation for future projections
- [ ] Correlation and beta analysis
- [ ] Export detailed performance reports

## Technical Implementation

### File Structure
```
src/
  components/
    Analytics/
      PerformanceAnalytics.jsx
      RiskMetrics.jsx
      BenchmarkComparison.jsx
      PerformanceAttribution.jsx
      MonteCarloSimulation.jsx
      PerformanceChart.jsx
  hooks/
    usePerformanceAnalytics.js
    useRiskAnalysis.js
    useBenchmarking.js
  services/
    PerformanceAnalyticsService.js
    RiskAnalysisService.js
    BenchmarkingService.js
  utils/
    performanceCalculations.js
    riskMetrics.js
    statisticalAnalysis.js
```

### Performance Analytics Component
```jsx
// PerformanceAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { usePerformanceAnalytics } from '../hooks/usePerformanceAnalytics';
import { useRiskAnalysis } from '../hooks/useRiskAnalysis';
import { useBenchmarking } from '../hooks/useBenchmarking';
import RiskMetrics from './RiskMetrics';
import BenchmarkComparison from './BenchmarkComparison';
import PerformanceAttribution from './PerformanceAttribution';
import PerformanceChart from './PerformanceChart';

const PerformanceAnalytics = ({ portfolioId, timeRange = '1Y' }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState(timeRange);

  const {
    performanceData,
    returnsData,
    drawdownData,
    isLoading: perfLoading
  } = usePerformanceAnalytics(portfolioId, selectedPeriod);

  const {
    riskMetrics,
    valueAtRisk,
    expectedShortfall,
    isLoading: riskLoading
  } = useRiskAnalysis(portfolioId, selectedPeriod);

  const {
    benchmarkData,
    relativePerformance,
    trackingError,
    informationRatio
  } = useBenchmarking(portfolioId, selectedPeriod);

  const periods = [
    { value: '1M', label: '1 Month' },
    { value: '3M', label: '3 Months' },
    { value: '6M', label: '6 Months' },
    { value: '1Y', label: '1 Year' },
    { value: '2Y', label: '2 Years' },
    { value: 'ALL', label: 'All Time' }
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'returns', label: 'Returns', icon: '📈' },
    { id: 'risk', label: 'Risk Analysis', icon: '⚠️' },
    { id: 'benchmark', label: 'Benchmarking', icon: '📋' },
    { id: 'attribution', label: 'Attribution', icon: '🎯' }
  ];

  const renderOverviewTab = () => (
    <div className="analytics-overview">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Return</h3>
          <div className={`metric-value ${performanceData?.totalReturn >= 0 ? 'positive' : 'negative'}`}>
            {performanceData?.totalReturn ? `${(performanceData.totalReturn * 100).toFixed(2)}%` : 'N/A'}
          </div>
          <div className="metric-period">Since inception</div>
        </div>

        <div className="metric-card">
          <h3>Annualized Return</h3>
          <div className={`metric-value ${performanceData?.annualizedReturn >= 0 ? 'positive' : 'negative'}`}>
            {performanceData?.annualizedReturn ? `${(performanceData.annualizedReturn * 100).toFixed(2)}%` : 'N/A'}
          </div>
          <div className="metric-period">Per year</div>
        </div>

        <div className="metric-card">
          <h3>Volatility</h3>
          <div className="metric-value">
            {performanceData?.volatility ? `${(performanceData.volatility * 100).toFixed(2)}%` : 'N/A'}
          </div>
          <div className="metric-period">Annualized</div>
        </div>

        <div className="metric-card">
          <h3>Sharpe Ratio</h3>
          <div className={`metric-value ${performanceData?.sharpeRatio >= 0 ? 'positive' : 'negative'}`}>
            {performanceData?.sharpeRatio ? performanceData.sharpeRatio.toFixed(3) : 'N/A'}
          </div>
          <div className="metric-period">Risk-adjusted</div>
        </div>

        <div className="metric-card">
          <h3>Max Drawdown</h3>
          <div className="metric-value negative">
            {performanceData?.maxDrawdown ? `${(performanceData.maxDrawdown * 100).toFixed(2)}%` : 'N/A'}
          </div>
          <div className="metric-period">Peak to trough</div>
        </div>

        <div className="metric-card">
          <h3>Win Rate</h3>
          <div className="metric-value">
            {performanceData?.winRate ? `${(performanceData.winRate * 100).toFixed(1)}%` : 'N/A'}
          </div>
          <div className="metric-period">Positive periods</div>
        </div>
      </div>

      <div className="performance-chart-section">
        <PerformanceChart
          portfolioData={returnsData}
          benchmarkData={benchmarkData}
          drawdownData={drawdownData}
          height={400}
        />
      </div>

      <div className="quick-insights">
        <h3>Key Insights</h3>
        <div className="insights-grid">
          <div className="insight-card">
            <h4>Performance vs Benchmark</h4>
            <p>
              {relativePerformance > 0 
                ? `Outperformed benchmark by ${(relativePerformance * 100).toFixed(2)}%`
                : `Underperformed benchmark by ${Math.abs(relativePerformance * 100).toFixed(2)}%`
              }
            </p>
          </div>
          
          <div className="insight-card">
            <h4>Risk Assessment</h4>
            <p>
              {riskMetrics?.riskLevel === 'high' 
                ? 'High risk portfolio with significant volatility'
                : riskMetrics?.riskLevel === 'medium'
                ? 'Moderate risk with balanced volatility'
                : 'Conservative portfolio with low volatility'
              }
            </p>
          </div>

          <div className="insight-card">
            <h4>Diversification</h4>
            <p>
              {performanceData?.diversificationRatio > 0.8
                ? 'Well diversified portfolio'
                : 'Portfolio may benefit from better diversification'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderReturnsTab = () => (
    <div className="returns-analysis">
      <div className="returns-metrics">
        <div className="metric-section">
          <h3>Return Analysis</h3>
          <div className="metrics-row">
            <div className="metric-item">
              <label>Time-Weighted Return</label>
              <span className={performanceData?.timeWeightedReturn >= 0 ? 'positive' : 'negative'}>
                {performanceData?.timeWeightedReturn ? `${(performanceData.timeWeightedReturn * 100).toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <div className="metric-item">
              <label>Money-Weighted Return</label>
              <span className={performanceData?.moneyWeightedReturn >= 0 ? 'positive' : 'negative'}>
                {performanceData?.moneyWeightedReturn ? `${(performanceData.moneyWeightedReturn * 100).toFixed(2)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="metric-section">
          <h3>Return Distribution</h3>
          <div className="metrics-row">
            <div className="metric-item">
              <label>Best Month</label>
              <span className="positive">
                {performanceData?.bestMonth ? `${(performanceData.bestMonth * 100).toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <div className="metric-item">
              <label>Worst Month</label>
              <span className="negative">
                {performanceData?.worstMonth ? `${(performanceData.worstMonth * 100).toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <div className="metric-item">
              <label>Average Monthly Return</label>
              <span className={performanceData?.avgMonthlyReturn >= 0 ? 'positive' : 'negative'}>
                {performanceData?.avgMonthlyReturn ? `${(performanceData.avgMonthlyReturn * 100).toFixed(2)}%` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="returns-chart">
        <PerformanceChart
          portfolioData={returnsData}
          benchmarkData={benchmarkData}
          chartType="returns"
          height={350}
        />
      </div>

      <div className="periodic-returns">
        <h3>Periodic Returns</h3>
        <div className="returns-table">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Portfolio</th>
                <th>Benchmark</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {performanceData?.periodicReturns?.map((period, index) => (
                <tr key={index}>
                  <td>{period.period}</td>
                  <td className={period.portfolio >= 0 ? 'positive' : 'negative'}>
                    {(period.portfolio * 100).toFixed(2)}%
                  </td>
                  <td className={period.benchmark >= 0 ? 'positive' : 'negative'}>
                    {(period.benchmark * 100).toFixed(2)}%
                  </td>
                  <td className={period.difference >= 0 ? 'positive' : 'negative'}>
                    {(period.difference * 100).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (perfLoading || riskLoading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Calculating performance analytics...</p>
      </div>
    );
  }

  return (
    <div className="performance-analytics">
      <div className="analytics-header">
        <h1>Portfolio Performance Analytics</h1>
        
        <div className="analytics-controls">
          <div className="period-selector">
            <label>Time Period:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              {periods.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="analytics-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="analytics-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'returns' && renderReturnsTab()}
        {activeTab === 'risk' && (
          <RiskMetrics
            riskMetrics={riskMetrics}
            valueAtRisk={valueAtRisk}
            expectedShortfall={expectedShortfall}
            drawdownData={drawdownData}
          />
        )}
        {activeTab === 'benchmark' && (
          <BenchmarkComparison
            portfolioData={returnsData}
            benchmarkData={benchmarkData}
            relativePerformance={relativePerformance}
            trackingError={trackingError}
            informationRatio={informationRatio}
          />
        )}
        {activeTab === 'attribution' && (
          <PerformanceAttribution
            portfolioId={portfolioId}
            timeRange={selectedPeriod}
          />
        )}
      </div>
    </div>
  );
};

export default PerformanceAnalytics;
```

### Performance Analytics Hook
```javascript
// usePerformanceAnalytics.js
import { useState, useEffect } from 'react';
import { performanceAnalyticsService } from '../services/PerformanceAnalyticsService';

export const usePerformanceAnalytics = (portfolioId, timeRange) => {
  const [performanceData, setPerformanceData] = useState(null);
  const [returnsData, setReturnsData] = useState([]);
  const [drawdownData, setDrawdownData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (portfolioId && timeRange) {
      calculatePerformanceMetrics();
    }
  }, [portfolioId, timeRange]);

  const calculatePerformanceMetrics = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [performance, returns, drawdowns] = await Promise.all([
        performanceAnalyticsService.calculatePerformanceMetrics(portfolioId, timeRange),
        performanceAnalyticsService.getReturnsTimeSeries(portfolioId, timeRange),
        performanceAnalyticsService.calculateDrawdowns(portfolioId, timeRange)
      ]);

      setPerformanceData(performance);
      setReturnsData(returns);
      setDrawdownData(drawdowns);

    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    performanceData,
    returnsData,
    drawdownData,
    isLoading,
    error,
    refresh: calculatePerformanceMetrics
  };
};
```

### Performance Analytics Service
```javascript
// PerformanceAnalyticsService.js
import { performanceCalculations } from '../utils/performanceCalculations';
import { statisticalAnalysis } from '../utils/statisticalAnalysis';

class PerformanceAnalyticsService {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async calculatePerformanceMetrics(portfolioId, timeRange) {
    try {
      // Get portfolio value history
      const portfolioHistory = await this.getPortfolioHistory(portfolioId, timeRange);
      const returns = this.calculateReturns(portfolioHistory);

      const metrics = {
        totalReturn: this.calculateTotalReturn(portfolioHistory),
        annualizedReturn: this.calculateAnnualizedReturn(returns, timeRange),
        volatility: this.calculateVolatility(returns),
        sharpeRatio: this.calculateSharpeRatio(returns),
        maxDrawdown: this.calculateMaxDrawdown(portfolioHistory),
        winRate: this.calculateWinRate(returns),
        timeWeightedReturn: this.calculateTimeWeightedReturn(portfolioHistory),
        moneyWeightedReturn: await this.calculateMoneyWeightedReturn(portfolioId, timeRange),
        diversificationRatio: await this.calculateDiversificationRatio(portfolioId),
        bestMonth: this.getBestPeriod(returns, 'month'),
        worstMonth: this.getWorstPeriod(returns, 'month'),
        avgMonthlyReturn: this.getAverageReturn(returns, 'month'),
        periodicReturns: await this.getPeriodicReturns(portfolioId, timeRange)
      };

      return metrics;
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      throw error;
    }
  }

  calculateReturns(portfolioHistory) {
    const returns = [];
    
    for (let i = 1; i < portfolioHistory.length; i++) {
      const previousValue = portfolioHistory[i - 1].value;
      const currentValue = portfolioHistory[i].value;
      
      if (previousValue > 0) {
        const dailyReturn = (currentValue - previousValue) / previousValue;
        returns.push({
          date: portfolioHistory[i].date,
          return: dailyReturn
        });
      }
    }
    
    return returns;
  }

  calculateTotalReturn(portfolioHistory) {
    if (portfolioHistory.length < 2) return 0;
    
    const initialValue = portfolioHistory[0].value;
    const finalValue = portfolioHistory[portfolioHistory.length - 1].value;
    
    return (finalValue - initialValue) / initialValue;
  }

  calculateAnnualizedReturn(returns, timeRange) {
    if (returns.length === 0) return 0;
    
    const totalReturn = returns.reduce((total, r) => (1 + total) * (1 + r.return) - 1, 0);
    const days = returns.length;
    const years = days / 365.25;
    
    if (years <= 0) return 0;
    
    return Math.pow(1 + totalReturn, 1 / years) - 1;
  }

  calculateVolatility(returns) {
    if (returns.length < 2) return 0;
    
    const returnValues = returns.map(r => r.return);
    const avgReturn = returnValues.reduce((sum, r) => sum + r, 0) / returnValues.length;
    
    const variance = returnValues.reduce((sum, r) => {
      return sum + Math.pow(r - avgReturn, 2);
    }, 0) / (returnValues.length - 1);
    
    const dailyVolatility = Math.sqrt(variance);
    return dailyVolatility * Math.sqrt(252); // Annualized
  }

  calculateSharpeRatio(returns, riskFreeRate = 0.02) {
    const annualizedReturn = this.calculateAnnualizedReturn(returns);
    const volatility = this.calculateVolatility(returns);
    
    if (volatility === 0) return 0;
    
    return (annualizedReturn - riskFreeRate) / volatility;
  }

  calculateMaxDrawdown(portfolioHistory) {
    let maxDrawdown = 0;
    let peak = portfolioHistory[0]?.value || 0;
    
    for (const point of portfolioHistory) {
      if (point.value > peak) {
        peak = point.value;
      }
      
      const drawdown = (peak - point.value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  calculateWinRate(returns) {
    if (returns.length === 0) return 0;
    
    const positiveReturns = returns.filter(r => r.return > 0).length;
    return positiveReturns / returns.length;
  }

  calculateTimeWeightedReturn(portfolioHistory) {
    // Simple implementation - can be enhanced for cash flows
    return this.calculateTotalReturn(portfolioHistory);
  }

  async calculateMoneyWeightedReturn(portfolioId, timeRange) {
    try {
      // Get cash flow data
      const cashFlows = await this.apiClient.get(
        `/portfolios/${portfolioId}/cash-flows?timeRange=${timeRange}`
      );
      
      // Calculate IRR (Internal Rate of Return)
      return this.calculateIRR(cashFlows.data);
    } catch (error) {
      console.error('Error calculating money-weighted return:', error);
      return 0;
    }
  }

  calculateIRR(cashFlows) {
    // Implementation of Newton-Raphson method for IRR calculation
    let irr = 0.1; // Initial guess
    const maxIterations = 100;
    const tolerance = 1e-6;
    
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let npvDerivative = 0;
      
      cashFlows.forEach((cf, index) => {
        const days = this.daysBetween(cashFlows[0].date, cf.date);
        const years = days / 365.25;
        const factor = Math.pow(1 + irr, years);
        
        npv += cf.amount / factor;
        npvDerivative -= cf.amount * years / (factor * (1 + irr));
      });
      
      if (Math.abs(npv) < tolerance) {
        return irr;
      }
      
      if (Math.abs(npvDerivative) < tolerance) {
        break;
      }
      
      irr = irr - npv / npvDerivative;
    }
    
    return irr;
  }

  async getReturnsTimeSeries(portfolioId, timeRange) {
    try {
      const response = await this.apiClient.get(
        `/portfolios/${portfolioId}/returns-timeseries?timeRange=${timeRange}`
      );
      
      return response.data.map(point => ({
        date: point.date,
        value: point.cumulativeReturn,
        dailyReturn: point.dailyReturn
      }));
    } catch (error) {
      console.error('Error getting returns time series:', error);
      return [];
    }
  }

  async calculateDrawdowns(portfolioId, timeRange) {
    try {
      const portfolioHistory = await this.getPortfolioHistory(portfolioId, timeRange);
      const drawdowns = [];
      let peak = 0;
      
      portfolioHistory.forEach(point => {
        if (point.value > peak) {
          peak = point.value;
        }
        
        const drawdown = peak > 0 ? (peak - point.value) / peak : 0;
        drawdowns.push({
          date: point.date,
          drawdown: -drawdown, // Negative for display
          peak: peak
        });
      });
      
      return drawdowns;
    } catch (error) {
      console.error('Error calculating drawdowns:', error);
      return [];
    }
  }

  async getPortfolioHistory(portfolioId, timeRange) {
    try {
      const response = await this.apiClient.get(
        `/portfolios/${portfolioId}/history?timeRange=${timeRange}`
      );
      
      return response.data.map(point => ({
        date: point.date,
        value: point.totalValue
      }));
    } catch (error) {
      console.error('Error getting portfolio history:', error);
      return [];
    }
  }

  daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const firstDate = new Date(date1);
    const secondDate = new Date(date2);
    
    return Math.round(Math.abs((firstDate - secondDate) / oneDay));
  }

  getBestPeriod(returns, period) {
    // Group returns by period and find best
    const periodReturns = this.groupReturnsByPeriod(returns, period);
    return Math.max(...periodReturns.map(p => p.return));
  }

  getWorstPeriod(returns, period) {
    // Group returns by period and find worst
    const periodReturns = this.groupReturnsByPeriod(returns, period);
    return Math.min(...periodReturns.map(p => p.return));
  }

  getAverageReturn(returns, period) {
    const periodReturns = this.groupReturnsByPeriod(returns, period);
    const sum = periodReturns.reduce((total, p) => total + p.return, 0);
    return sum / periodReturns.length;
  }

  groupReturnsByPeriod(returns, period) {
    // Implementation depends on period type (month, quarter, year)
    // This is a simplified version
    return returns;
  }

  async getPeriodicReturns(portfolioId, timeRange) {
    // Implementation for getting periodic returns comparison
    return [];
  }

  async calculateDiversificationRatio(portfolioId) {
    // Implementation for portfolio diversification analysis
    return 0.75; // Placeholder
  }
}

export const performanceAnalyticsService = new PerformanceAnalyticsService();
```

## Testing Requirements
- Performance calculation accuracy testing
- Large dataset performance testing
- Risk metric calculation validation
- Benchmark comparison accuracy
- Statistical analysis correctness

## Dependencies
- Depends on: CP-004 (Portfolio Management)
- Depends on: CP-037 (Multi-Asset Chart Comparison)
- Blocks: CP-055 (Cost Basis Tracking)

## Time Estimate
**Beginner**: 10-12 days
**Intermediate**: 6-8 days
**Advanced**: 4-6 days

## Required Skills
- Financial mathematics and statistics
- Performance measurement concepts
- Risk analysis techniques
- Data visualization
- Complex calculation algorithms