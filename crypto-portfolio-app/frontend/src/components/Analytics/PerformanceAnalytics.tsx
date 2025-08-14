import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity, 
  Target, 
  AlertTriangle,
  DollarSign,
  Percent,
  Calendar,
  Download,
  RefreshCw,
  Info
} from 'lucide-react';
import { usePerformanceAnalytics, useRiskAnalysis, useBenchmarkComparison } from '../../hooks/usePerformanceAnalytics';
import { useResponsive } from '../../hooks/useResponsive';
import RiskMetrics from './RiskMetrics';
import BenchmarkComparison from './BenchmarkComparison';
import PerformanceAttribution from './PerformanceAttribution';
import PerformanceChart from './PerformanceChart';
import MonteCarloSimulation from './MonteCarloSimulation';
import PerformanceExport from './PerformanceExport';

interface PerformanceAnalyticsProps {
  portfolioId: string;
  initialTimeRange?: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL';
  className?: string;
}

const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  portfolioId,
  initialTimeRange = '1Y',
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'returns' | 'risk' | 'benchmark' | 'attribution' | 'charts' | 'simulation'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState(initialTimeRange);
  const [selectedBenchmark, setSelectedBenchmark] = useState('BTC');
  
  const { isMobile } = useResponsive();

  const {
    data,
    isLoading,
    error,
    refresh,
    updateTimeRange,
    updateBenchmark
  } = usePerformanceAnalytics({
    portfolioId,
    timeRange: selectedPeriod,
    benchmarkSymbol: selectedBenchmark
  });

  const {
    riskMetrics,
    valueAtRisk,
    expectedShortfall
  } = useRiskAnalysis(portfolioId, selectedPeriod);

  const {
    benchmarkComparison,
    benchmarkData
  } = useBenchmarkComparison(portfolioId, selectedPeriod, selectedBenchmark);

  // Time period options
  const periods = [
    { value: '1M', label: '1 Month' },
    { value: '3M', label: '3 Months' },
    { value: '6M', label: '6 Months' },
    { value: '1Y', label: '1 Year' },
    { value: '2Y', label: '2 Years' },
    { value: 'ALL', label: 'All Time' }
  ];

  // Benchmark options
  const benchmarks = [
    { value: 'BTC', label: 'Bitcoin (BTC)' },
    { value: 'ETH', label: 'Ethereum (ETH)' },
    { value: 'SPY', label: 'S&P 500 (SPY)' },
    { value: 'QQQ', label: 'NASDAQ (QQQ)' }
  ];

  // Navigation tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'returns', label: 'Returns', icon: TrendingUp },
    { id: 'risk', label: 'Risk Analysis', icon: AlertTriangle },
    { id: 'benchmark', label: 'Benchmarking', icon: Target },
    { id: 'attribution', label: 'Attribution', icon: Activity },
    { id: 'charts', label: 'Charts', icon: BarChart3 },
    { id: 'simulation', label: 'Simulation', icon: Activity }
  ];

  // Handle period change
  const handlePeriodChange = (newPeriod: string) => {
    setSelectedPeriod(newPeriod as any);
    updateTimeRange(newPeriod);
  };

  // Handle benchmark change
  const handleBenchmarkChange = (newBenchmark: string) => {
    setSelectedBenchmark(newBenchmark);
    updateBenchmark(newBenchmark);
  };

  // Format percentage with color
  const formatPercentage = (value: number, showSign: boolean = true): JSX.Element => {
    const formatted = `${showSign && value > 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
    const colorClass = value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    
    return <span className={colorClass}>{formatted}</span>;
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Format number with appropriate precision
  const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toFixed(decimals);
  };

  // Get risk level color
  const getRiskLevelColor = (level: string): string => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-100 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
      case 'low': return 'text-green-600 bg-green-100 dark:bg-green-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
  };

  // Render metric card
  const renderMetricCard = (
    title: string,
    value: string | JSX.Element,
    subtitle: string,
    icon: React.ReactNode,
    trend?: number
  ) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className="text-gray-500 dark:text-gray-400">
            {icon}
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
        </div>
        {trend !== undefined && (
          <div className={`flex items-center text-xs ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {formatPercentage(Math.abs(trend))}
          </div>
        )}
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </div>
    </div>
  );

  // Render overview tab
  const renderOverviewTab = () => {
    const metrics = data.performanceMetrics;
    if (!metrics) return null;

    return (
      <div className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {renderMetricCard(
            'Total Return',
            formatPercentage(metrics.totalReturn),
            'Since inception',
            <Percent className="w-4 h-4" />
          )}
          
          {renderMetricCard(
            'Annualized Return',
            formatPercentage(metrics.annualizedReturn),
            'Per year',
            <TrendingUp className="w-4 h-4" />
          )}
          
          {renderMetricCard(
            'Volatility',
            formatPercentage(metrics.volatility, false),
            'Annualized',
            <Activity className="w-4 h-4" />
          )}
          
          {renderMetricCard(
            'Sharpe Ratio',
            formatNumber(metrics.sharpeRatio),
            'Risk-adjusted',
            <Target className="w-4 h-4" />
          )}
          
          {renderMetricCard(
            'Max Drawdown',
            <span className="text-red-600 dark:text-red-400">
              {formatPercentage(metrics.maxDrawdown, false)}
            </span>,
            'Peak to trough',
            <TrendingDown className="w-4 h-4" />
          )}
          
          {renderMetricCard(
            'Win Rate',
            formatPercentage(metrics.winRate, false),
            'Positive periods',
            <TrendingUp className="w-4 h-4" />
          )}
          
          {renderMetricCard(
            'Sortino Ratio',
            formatNumber(metrics.sortinoRatio),
            'Downside deviation',
            <Target className="w-4 h-4" />
          )}
          
          {renderMetricCard(
            'Calmar Ratio',
            formatNumber(metrics.calmarRatio),
            'Return / Max DD',
            <BarChart3 className="w-4 h-4" />
          )}
        </div>

        {/* Performance Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Portfolio Performance vs Benchmark
          </h3>
          <PerformanceChart
            portfolioData={data.returnsTimeSeries || []}
            benchmarkData={benchmarkData || []}
            benchmarkName={selectedBenchmark}
            timeRange={selectedPeriod}
          />
        </div>

        {/* Key Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
              <Target className="w-4 h-4 mr-2" />
              Performance vs Benchmark
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {benchmarkComparison?.relativeReturn && benchmarkComparison.relativeReturn > 0 
                ? `Outperformed ${selectedBenchmark} by ${formatPercentage(benchmarkComparison.relativeReturn)}`
                : benchmarkComparison?.relativeReturn 
                ? `Underperformed ${selectedBenchmark} by ${formatPercentage(Math.abs(benchmarkComparison.relativeReturn))}`
                : 'Benchmark comparison data loading...'
              }
            </p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Risk Assessment
            </h4>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {riskMetrics?.riskLevel === 'high' 
                ? 'High risk portfolio with significant volatility'
                : riskMetrics?.riskLevel === 'medium'
                ? 'Moderate risk with balanced volatility'
                : 'Conservative portfolio with low volatility'
              }
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <h4 className="font-medium text-green-900 dark:text-green-100 mb-2 flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Diversification
            </h4>
            <p className="text-sm text-green-800 dark:text-green-200">
              {metrics.diversificationRatio > 0.7
                ? 'Well diversified portfolio'
                : 'Portfolio may benefit from better diversification'
              }
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render returns analysis tab
  const renderReturnsTab = () => {
    const metrics = data.performanceMetrics;
    if (!metrics) return null;

    return (
      <div className="space-y-6">
        {/* Return Types Comparison */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Return Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Time-Weighted vs Money-Weighted</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Time-Weighted Return</span>
                  <span className="font-medium">{formatPercentage(metrics.timeWeightedReturn)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Money-Weighted Return</span>
                  <span className="font-medium">{formatPercentage(metrics.moneyWeightedReturn)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Difference</span>
                  <span className="font-medium">
                    {formatPercentage(metrics.timeWeightedReturn - metrics.moneyWeightedReturn)}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Return Distribution</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Best Month</span>
                  <span className="font-medium text-green-600">{formatPercentage(metrics.bestMonth)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Worst Month</span>
                  <span className="font-medium text-red-600">{formatPercentage(metrics.worstMonth)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Average Monthly</span>
                  <span className="font-medium">{formatPercentage(metrics.avgMonthlyReturn)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Statistical Measures */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Statistical Analysis
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(metrics.skewness)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Skewness</div>
              <div className="text-xs text-gray-400 mt-1">
                {metrics.skewness > 0 ? 'Right-tailed' : metrics.skewness < 0 ? 'Left-tailed' : 'Symmetric'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(metrics.kurtosis)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Kurtosis</div>
              <div className="text-xs text-gray-400 mt-1">
                {metrics.kurtosis > 0 ? 'Fat tails' : 'Thin tails'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(metrics.profitFactor)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Profit Factor</div>
              <div className="text-xs text-gray-400 mt-1">
                {metrics.profitFactor > 1 ? 'Profitable' : 'Unprofitable'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercentage(metrics.winRate, false)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Win Rate</div>
              <div className="text-xs text-gray-400 mt-1">
                Positive periods
              </div>
            </div>
          </div>
        </div>

        {/* Periodic Returns Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Periodic Returns
          </h3>
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
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {metrics.periodicReturns.slice(0, 12).map((period, index) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {period.period}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {formatPercentage(period.portfolio)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {formatPercentage(period.benchmark)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {formatPercentage(period.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`performance-analytics ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Calculating performance analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`performance-analytics ${className}`}>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h3 className="font-medium text-red-800 dark:text-red-200">Error loading performance data</h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={refresh}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`performance-analytics ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Portfolio Performance Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive analysis of your portfolio performance and risk metrics
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-4 lg:mt-0">
            {/* Time Period Selector */}
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {periods.map(period => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Benchmark Selector */}
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-gray-500" />
              <select
                value={selectedBenchmark}
                onChange={(e) => handleBenchmarkChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {benchmarks.map(benchmark => (
                  <option key={benchmark.value} value={benchmark.value}>
                    {benchmark.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center space-x-3">
              <button
                onClick={refresh}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              
              <PerformanceExport portfolioId={portfolioId} />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'returns' && renderReturnsTab()}
        {activeTab === 'risk' && (
          <RiskMetrics
            riskMetrics={riskMetrics}
            drawdownAnalysis={data.drawdownAnalysis}
          />
        )}
        {activeTab === 'benchmark' && (
          <BenchmarkComparison
            portfolioReturns={data.returnsTimeSeries}
            benchmarkReturns={benchmarkData}
            benchmarkComparison={benchmarkComparison}
            selectedBenchmark={selectedBenchmark}
            onBenchmarkChange={handleBenchmarkChange}
          />
        )}
        {activeTab === 'attribution' && (
          <PerformanceAttribution
            portfolioId={portfolioId}
            timeRange={selectedPeriod}
            benchmarkSymbol={selectedBenchmark}
          />
        )}
        {activeTab === 'charts' && (
          <PerformanceChart
            portfolioData={data.returnsTimeSeries || []}
            benchmarkData={benchmarkData || []}
            benchmarkName={selectedBenchmark}
            timeRange={selectedPeriod}
          />
        )}
        {activeTab === 'simulation' && (
          <MonteCarloSimulation
            historicalReturns={data.returnsTimeSeries || []}
            currentValue={data.performanceMetrics?.totalReturn ? 
              (1 + data.performanceMetrics.totalReturn) * 100000 : 100000}
          />
        )}
      </div>
    </div>
  );
};

export default PerformanceAnalytics;