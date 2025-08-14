import React, { useState, useMemo } from 'react';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  BarChart3,
  ArrowUpDown,
  Info,
  Award,
  AlertTriangle
} from 'lucide-react';
import { PerformanceReturn, BenchmarkComparison as BenchmarkComparisonType } from '../../services/PerformanceAnalyticsService';

interface BenchmarkComparisonProps {
  portfolioReturns: PerformanceReturn[];
  benchmarkReturns: PerformanceReturn[];
  benchmarkComparison: BenchmarkComparisonType | null;
  selectedBenchmark: string;
  onBenchmarkChange?: (benchmark: string) => void;
  className?: string;
}

const BenchmarkComparison: React.FC<BenchmarkComparisonProps> = ({
  portfolioReturns,
  benchmarkReturns,
  benchmarkComparison,
  selectedBenchmark,
  onBenchmarkChange,
  className = ''
}) => {
  const [analysisTimeframe, setAnalysisTimeframe] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('1Y');
  const [showRollingAnalysis, setShowRollingAnalysis] = useState(false);

  // Available benchmarks
  const benchmarks = [
    { value: 'BTC', label: 'Bitcoin (BTC)', description: 'Leading cryptocurrency' },
    { value: 'ETH', label: 'Ethereum (ETH)', description: 'Smart contract platform' },
    { value: 'SPY', label: 'S&P 500 (SPY)', description: 'US stock market index' },
    { value: 'QQQ', label: 'NASDAQ (QQQ)', description: 'Tech-heavy index' },
    { value: 'GLD', label: 'Gold (GLD)', description: 'Precious metals' },
    { value: 'TLT', label: 'Bonds (TLT)', description: '20+ Year Treasury' }
  ];

  // Calculate aligned performance data
  const alignedData = useMemo(() => {
    const portfolioMap = new Map(portfolioReturns.map(r => [r.date, r]));
    const aligned: Array<{
      date: string;
      portfolioReturn: number;
      benchmarkReturn: number;
      portfolioCumulative: number;
      benchmarkCumulative: number;
      outperformance: number;
      timestamp: number;
    }> = [];

    benchmarkReturns.forEach(benchmarkReturn => {
      const portfolioReturn = portfolioMap.get(benchmarkReturn.date);
      if (portfolioReturn) {
        aligned.push({
          date: benchmarkReturn.date,
          portfolioReturn: portfolioReturn.return,
          benchmarkReturn: benchmarkReturn.return,
          portfolioCumulative: portfolioReturn.cumulativeReturn,
          benchmarkCumulative: benchmarkReturn.cumulativeReturn,
          outperformance: portfolioReturn.return - benchmarkReturn.return,
          timestamp: portfolioReturn.timestamp
        });
      }
    });

    return aligned.sort((a, b) => a.timestamp - b.timestamp);
  }, [portfolioReturns, benchmarkReturns]);

  // Calculate rolling metrics
  const rollingMetrics = useMemo(() => {
    const windowSize = 30; // 30-day rolling window
    const metrics: Array<{
      date: string;
      rollingBeta: number;
      rollingAlpha: number;
      rollingCorrelation: number;
      rollingTrackingError: number;
    }> = [];

    for (let i = windowSize; i < alignedData.length; i++) {
      const window = alignedData.slice(i - windowSize, i);
      
      // Calculate rolling correlation
      const portfolioReturns = window.map(d => d.portfolioReturn);
      const benchmarkReturns = window.map(d => d.benchmarkReturn);
      
      const portfolioMean = portfolioReturns.reduce((sum, r) => sum + r, 0) / portfolioReturns.length;
      const benchmarkMean = benchmarkReturns.reduce((sum, r) => sum + r, 0) / benchmarkReturns.length;
      
      let covariance = 0;
      let portfolioVariance = 0;
      let benchmarkVariance = 0;
      
      for (let j = 0; j < window.length; j++) {
        const portfolioDiff = portfolioReturns[j] - portfolioMean;
        const benchmarkDiff = benchmarkReturns[j] - benchmarkMean;
        
        covariance += portfolioDiff * benchmarkDiff;
        portfolioVariance += portfolioDiff * portfolioDiff;
        benchmarkVariance += benchmarkDiff * benchmarkDiff;
      }
      
      const correlation = Math.sqrt(portfolioVariance * benchmarkVariance) > 0 
        ? covariance / Math.sqrt(portfolioVariance * benchmarkVariance) 
        : 0;
      
      const beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 0;
      
      // Calculate alpha (simplified)
      const avgPortfolioReturn = portfolioMean * 252;
      const avgBenchmarkReturn = benchmarkMean * 252;
      const alpha = avgPortfolioReturn - (0.02 + beta * (avgBenchmarkReturn - 0.02));
      
      // Calculate tracking error
      const differences = window.map(d => d.outperformance);
      const avgDifference = differences.reduce((sum, d) => sum + d, 0) / differences.length;
      const trackingErrorVariance = differences.reduce((sum, d) => sum + Math.pow(d - avgDifference, 2), 0) / differences.length;
      const trackingError = Math.sqrt(trackingErrorVariance) * Math.sqrt(252);
      
      metrics.push({
        date: alignedData[i].date,
        rollingBeta: beta,
        rollingAlpha: alpha,
        rollingCorrelation: correlation,
        rollingTrackingError: trackingError
      });
    }

    return metrics;
  }, [alignedData]);

  // Calculate period-specific statistics
  const periodStats = useMemo(() => {
    const periods = ['1M', '3M', '6M', '1Y'] as const;
    const stats: Record<string, {
      portfolioReturn: number;
      benchmarkReturn: number;
      outperformance: number;
      volatility: number;
      sharpeRatio: number;
    }> = {};

    periods.forEach(period => {
      let days: number;
      switch (period) {
        case '1M': days = 30; break;
        case '3M': days = 90; break;
        case '6M': days = 180; break;
        case '1Y': days = 365; break;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const periodData = alignedData.filter(d => new Date(d.date) >= cutoffDate);
      
      if (periodData.length > 0) {
        const portfolioReturn = periodData[periodData.length - 1].portfolioCumulative - 
          (periodData[0].portfolioCumulative || 0);
        const benchmarkReturn = periodData[periodData.length - 1].benchmarkCumulative - 
          (periodData[0].benchmarkCumulative || 0);
        
        const returns = periodData.map(d => d.portfolioReturn);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        const volatility = Math.sqrt(variance) * Math.sqrt(252);
        
        stats[period] = {
          portfolioReturn,
          benchmarkReturn,
          outperformance: portfolioReturn - benchmarkReturn,
          volatility,
          sharpeRatio: volatility > 0 ? (portfolioReturn - 0.02) / volatility : 0
        };
      }
    });

    return stats;
  }, [alignedData]);

  // Format percentage
  const formatPercentage = (value: number, decimals: number = 2): JSX.Element => {
    const formatted = `${value >= 0 ? '+' : ''}${(value * 100).toFixed(decimals)}%`;
    const colorClass = value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    
    return <span className={colorClass}>{formatted}</span>;
  };

  // Format number
  const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toFixed(decimals);
  };

  // Get performance rating
  const getPerformanceRating = (outperformance: number): { 
    rating: string; 
    color: string; 
    icon: React.ReactNode;
    description: string;
  } => {
    if (outperformance > 0.1) {
      return {
        rating: 'Excellent',
        color: 'text-green-600 bg-green-100 dark:bg-green-900/20',
        icon: <Award className="w-4 h-4" />,
        description: 'Significantly outperforming benchmark'
      };
    } else if (outperformance > 0.05) {
      return {
        rating: 'Good',
        color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
        icon: <TrendingUp className="w-4 h-4" />,
        description: 'Outperforming benchmark'
      };
    } else if (outperformance > -0.05) {
      return {
        rating: 'Fair',
        color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20',
        icon: <ArrowUpDown className="w-4 h-4" />,
        description: 'Tracking benchmark closely'
      };
    } else {
      return {
        rating: 'Poor',
        color: 'text-red-600 bg-red-100 dark:bg-red-900/20',
        icon: <TrendingDown className="w-4 h-4" />,
        description: 'Underperforming benchmark'
      };
    }
  };

  // Render metric card
  const renderMetricCard = (
    title: string,
    value: string | number | JSX.Element,
    subtitle: string,
    icon: React.ReactNode,
    tooltip?: string
  ) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="text-gray-500 dark:text-gray-400">
            {icon}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
        </div>
        {tooltip && (
          <div className="group relative">
            <Info className="w-3 h-3 text-gray-400 cursor-help" />
            <div className="absolute top-full right-0 mt-1 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        {typeof value === 'number' ? formatNumber(value) : value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </div>
    </div>
  );

  if (!benchmarkComparison) {
    return (
      <div className={`benchmark-comparison ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-4" />
          <p>Benchmark comparison data not available</p>
        </div>
      </div>
    );
  }

  const performanceRating = getPerformanceRating(benchmarkComparison.relativeReturn);

  return (
    <div className={`benchmark-comparison space-y-6 ${className}`}>
      {/* Header with benchmark selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Benchmark Comparison
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Portfolio performance vs {benchmarks.find(b => b.value === selectedBenchmark)?.label}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-4 lg:mt-0">
          <select
            value={selectedBenchmark}
            onChange={(e) => onBenchmarkChange?.(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            {benchmarks.map(benchmark => (
              <option key={benchmark.value} value={benchmark.value}>
                {benchmark.label}
              </option>
            ))}
          </select>
          
          <button
            onClick={() => setShowRollingAnalysis(!showRollingAnalysis)}
            className={`px-3 py-2 text-sm rounded-md transition-colors ${
              showRollingAnalysis 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Rolling Analysis
          </button>
        </div>
      </div>

      {/* Performance Rating */}
      <div className={`rounded-lg p-4 border ${performanceRating.color}`}>
        <div className="flex items-center space-x-3">
          {performanceRating.icon}
          <div>
            <h3 className="font-medium text-lg">
              {performanceRating.rating} Performance
            </h3>
            <p className="text-sm mt-1">{performanceRating.description}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-lg font-bold">
              {formatPercentage(benchmarkComparison.relativeReturn)}
            </div>
            <div className="text-xs opacity-75">vs {selectedBenchmark}</div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {renderMetricCard(
          'Beta',
          benchmarkComparison.beta,
          'Sensitivity to benchmark',
          <Activity className="w-4 h-4" />,
          'Beta measures how much your portfolio moves relative to the benchmark. Beta > 1 means higher volatility.'
        )}
        
        {renderMetricCard(
          'Alpha',
          formatPercentage(benchmarkComparison.alpha),
          'Excess return vs benchmark',
          <TrendingUp className="w-4 h-4" />,
          'Alpha represents the excess return generated above what would be expected given the portfolio\'s beta.'
        )}
        
        {renderMetricCard(
          'Correlation',
          formatNumber(benchmarkComparison.correlation),
          'Movement similarity',
          <ArrowUpDown className="w-4 h-4" />,
          'Correlation measures how similarly your portfolio and the benchmark move. 1 = perfect correlation.'
        )}
        
        {renderMetricCard(
          'Information Ratio',
          formatNumber(benchmarkComparison.informationRatio),
          'Risk-adjusted outperformance',
          <Target className="w-4 h-4" />,
          'Information Ratio measures excess return per unit of tracking error. Higher values indicate better risk-adjusted performance.'
        )}
      </div>

      {/* Capture Ratios */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Capture Analysis
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Up Market Capture</h5>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-green-600">
                {formatNumber(benchmarkComparison.upCapture * 100, 1)}%
              </span>
              <div className="text-sm text-gray-500">
                {benchmarkComparison.upCapture > 1 ? 'Better than benchmark' : 'Following benchmark'}
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full"
                style={{ width: `${Math.min(benchmarkComparison.upCapture * 100, 100)}%` }}
              />
            </div>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Down Market Capture</h5>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-red-600">
                {formatNumber(benchmarkComparison.downCapture * 100, 1)}%
              </span>
              <div className="text-sm text-gray-500">
                {benchmarkComparison.downCapture < 1 ? 'Better downside protection' : 'Following benchmark'}
              </div>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div 
                className="bg-red-600 h-2 rounded-full"
                style={{ width: `${Math.min(benchmarkComparison.downCapture * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p><strong>Up Capture:</strong> Percentage of benchmark gains captured during positive periods.</p>
            <p className="mt-1"><strong>Down Capture:</strong> Percentage of benchmark losses experienced during negative periods.</p>
          </div>
        </div>
      </div>

      {/* Period Performance Comparison */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Period Performance Breakdown
        </h4>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Portfolio
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Benchmark
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Difference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Volatility
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {Object.entries(periodStats).map(([period, stats]) => (
                <tr key={period} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {period}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(stats.portfolioReturn)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(stats.benchmarkReturn)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(stats.outperformance)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {formatPercentage(stats.volatility, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rolling Analysis */}
      {showRollingAnalysis && rollingMetrics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            30-Day Rolling Analysis
          </h4>
          
          <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2" />
              <p>Rolling metrics chart will be rendered here</p>
              <p className="text-sm">Integration with chart library needed</p>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatNumber(rollingMetrics[rollingMetrics.length - 1]?.rollingBeta || 0)}
              </div>
              <div className="text-sm text-gray-500">Current Beta</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatPercentage(rollingMetrics[rollingMetrics.length - 1]?.rollingAlpha || 0)}
              </div>
              <div className="text-sm text-gray-500">Current Alpha</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatNumber(rollingMetrics[rollingMetrics.length - 1]?.rollingCorrelation || 0)}
              </div>
              <div className="text-sm text-gray-500">Current Correlation</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {formatPercentage(rollingMetrics[rollingMetrics.length - 1]?.rollingTrackingError || 0, 2)}
              </div>
              <div className="text-sm text-gray-500">Current Tracking Error</div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center">
          <Target className="w-5 h-5 mr-2" />
          Performance Insights & Recommendations
        </h4>
        
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          {benchmarkComparison.beta > 1.2 && (
            <p>• Your portfolio is more volatile than the benchmark. Consider reducing position sizes or adding defensive assets.</p>
          )}
          {benchmarkComparison.beta < 0.8 && (
            <p>• Your portfolio is less volatile than the benchmark. You might consider adding growth assets if seeking higher returns.</p>
          )}
          {benchmarkComparison.alpha < 0 && (
            <p>• Negative alpha suggests underperformance relative to risk taken. Review asset selection and timing strategies.</p>
          )}
          {benchmarkComparison.correlation < 0.5 && (
            <p>• Low correlation with benchmark indicates unique risk/return profile. Ensure this aligns with your investment strategy.</p>
          )}
          {benchmarkComparison.trackingError > 0.15 && (
            <p>• High tracking error indicates significant deviation from benchmark. Consider whether this level of active risk is intended.</p>
          )}
          {benchmarkComparison.informationRatio > 0.5 && (
            <p>• Strong information ratio indicates good risk-adjusted outperformance. Current strategy appears effective.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BenchmarkComparison;