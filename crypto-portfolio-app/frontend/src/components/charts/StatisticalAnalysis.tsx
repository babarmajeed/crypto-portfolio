import React, { useState, useMemo } from 'react';
import { X, TrendingUp, TrendingDown, BarChart3, Activity, Target, AlertTriangle } from 'lucide-react';
import { correlationService } from '../../services/CorrelationService';

interface CandlestickData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CorrelationPair {
  asset1: string;
  asset2: string;
  correlation: number;
  strength: string;
  direction: string;
  significance: number;
}

interface StatisticalAnalysisProps {
  assets: string[];
  multiAssetData: Record<string, CandlestickData[]>;
  correlationMatrix: Record<string, Record<string, number>>;
  pairCorrelations: CorrelationPair[];
  onClose: () => void;
}

interface AssetMetrics {
  asset: string;
  returns: {
    daily: number;
    weekly: number;
    monthly: number;
    annual: number;
  };
  volatility: {
    daily: number;
    annual: number;
  };
  sharpeRatio: number;
  maxDrawdown: number;
  beta?: number;
  alpha?: number;
  rSquared?: number;
  skewness: number;
  kurtosis: number;
  var95: number; // Value at Risk (95%)
  cvar95: number; // Conditional Value at Risk (95%)
}

const StatisticalAnalysis: React.FC<StatisticalAnalysisProps> = ({
  assets,
  multiAssetData,
  correlationMatrix,
  pairCorrelations,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'metrics' | 'correlation' | 'regression' | 'risk'>('metrics');
  const [benchmarkAsset, setBenchmarkAsset] = useState<string>(assets[0]);
  const [confidenceLevel, setConfidenceLevel] = useState<number>(95);

  // Calculate comprehensive statistics for each asset
  const assetMetrics = useMemo((): AssetMetrics[] => {
    return assets.map(asset => {
      const data = multiAssetData[asset] || [];
      if (data.length < 2) {
        return {
          asset,
          returns: { daily: 0, weekly: 0, monthly: 0, annual: 0 },
          volatility: { daily: 0, annual: 0 },
          sharpeRatio: 0,
          maxDrawdown: 0,
          skewness: 0,
          kurtosis: 0,
          var95: 0,
          cvar95: 0
        };
      }

      // Calculate returns
      const returns = calculateReturns(data);
      const dailyReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
      const weeklyReturn = dailyReturn * 7;
      const monthlyReturn = dailyReturn * 30;
      const annualReturn = dailyReturn * 252;

      // Calculate volatility
      const variance = returns.length > 1 
        ? returns.reduce((sum, r) => sum + Math.pow(r - dailyReturn, 2), 0) / (returns.length - 1)
        : 0;
      const dailyVolatility = Math.sqrt(variance);
      const annualVolatility = dailyVolatility * Math.sqrt(252);

      // Calculate Sharpe ratio (assuming 2% risk-free rate)
      const riskFreeRate = 0.02;
      const sharpeRatio = annualVolatility > 0 ? (annualReturn - riskFreeRate) / annualVolatility : 0;

      // Calculate maximum drawdown
      const maxDrawdown = calculateMaxDrawdown(data);

      // Calculate higher moments
      const skewness = calculateSkewness(returns, dailyReturn, dailyVolatility);
      const kurtosis = calculateKurtosis(returns, dailyReturn, dailyVolatility);

      // Calculate VaR and CVaR
      const { var95, cvar95 } = calculateRiskMetrics(returns, confidenceLevel);

      // Calculate beta and alpha if benchmark is different asset
      let beta, alpha, rSquared;
      if (benchmarkAsset !== asset && multiAssetData[benchmarkAsset]) {
        const regression = correlationService.calculateLinearRegression(
          multiAssetData[benchmarkAsset],
          data
        );
        beta = regression.beta;
        alpha = regression.alpha * 252; // Annualized
        rSquared = regression.rSquared;
      }

      return {
        asset,
        returns: {
          daily: dailyReturn,
          weekly: weeklyReturn,
          monthly: monthlyReturn,
          annual: annualReturn
        },
        volatility: {
          daily: dailyVolatility,
          annual: annualVolatility
        },
        sharpeRatio,
        maxDrawdown,
        beta,
        alpha,
        rSquared,
        skewness,
        kurtosis,
        var95,
        cvar95
      };
    });
  }, [assets, multiAssetData, benchmarkAsset, confidenceLevel]);

  // Helper functions
  const calculateReturns = (data: CandlestickData[]): number[] => {
    const returns: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prevPrice = data[i - 1].close;
      const currentPrice = data[i].close;
      const returnValue = (currentPrice - prevPrice) / prevPrice;
      returns.push(returnValue);
    }
    return returns;
  };

  const calculateMaxDrawdown = (data: CandlestickData[]): number => {
    let maxDrawdown = 0;
    let peak = data[0]?.close || 0;

    for (const candle of data) {
      if (candle.close > peak) {
        peak = candle.close;
      }
      const drawdown = (peak - candle.close) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  };

  const calculateSkewness = (returns: number[], mean: number, stdDev: number): number => {
    if (returns.length < 3 || stdDev === 0) return 0;
    
    const n = returns.length;
    const skewness = returns.reduce((sum, r) => {
      return sum + Math.pow((r - mean) / stdDev, 3);
    }, 0);
    
    return (skewness * n) / ((n - 1) * (n - 2));
  };

  const calculateKurtosis = (returns: number[], mean: number, stdDev: number): number => {
    if (returns.length < 4 || stdDev === 0) return 0;
    
    const n = returns.length;
    const kurtosis = returns.reduce((sum, r) => {
      return sum + Math.pow((r - mean) / stdDev, 4);
    }, 0);
    
    return (kurtosis * n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) - 
           (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3));
  };

  const calculateRiskMetrics = (returns: number[], confidenceLevel: number): { var95: number; cvar95: number } => {
    if (returns.length === 0) return { var95: 0, cvar95: 0 };

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const percentile = (100 - confidenceLevel) / 100;
    const varIndex = Math.floor(percentile * sortedReturns.length);
    
    const var95 = sortedReturns[varIndex] || 0;
    
    // Calculate CVaR (average of returns below VaR)
    const belowVarReturns = sortedReturns.slice(0, varIndex + 1);
    const cvar95 = belowVarReturns.length > 0 
      ? belowVarReturns.reduce((sum, r) => sum + r, 0) / belowVarReturns.length
      : 0;

    return { var95: Math.abs(var95), cvar95: Math.abs(cvar95) };
  };

  // Format percentage
  const formatPercentage = (value: number, decimals: number = 2): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  // Format number
  const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toFixed(decimals);
  };

  // Get risk level color
  const getRiskColor = (value: number, type: 'volatility' | 'sharpe' | 'drawdown'): string => {
    switch (type) {
      case 'volatility':
        if (value > 0.6) return 'text-red-600';
        if (value > 0.3) return 'text-yellow-600';
        return 'text-green-600';
      case 'sharpe':
        if (value > 1) return 'text-green-600';
        if (value > 0.5) return 'text-yellow-600';
        return 'text-red-600';
      case 'drawdown':
        if (value > 0.3) return 'text-red-600';
        if (value > 0.15) return 'text-yellow-600';
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  // Render metrics tab
  const renderMetricsTab = () => (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
          Performance Overview
        </h4>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Annual Return
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Volatility
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sharpe Ratio
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Max Drawdown
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {assetMetrics.map(metric => (
                <tr key={metric.asset} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {metric.asset}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    <span className={metric.returns.annual >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatPercentage(metric.returns.annual)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={getRiskColor(metric.volatility.annual, 'volatility')}>
                      {formatPercentage(metric.volatility.annual)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={getRiskColor(metric.sharpeRatio, 'sharpe')}>
                      {formatNumber(metric.sharpeRatio)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={getRiskColor(metric.maxDrawdown, 'drawdown')}>
                      {formatPercentage(metric.maxDrawdown)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Risk Metrics */}
      <div>
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
          Risk Metrics
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {assetMetrics.map(metric => (
            <div key={metric.asset} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h5 className="font-semibold text-gray-900 dark:text-white mb-3">{metric.asset}</h5>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">VaR (95%):</span>
                  <span className="text-red-600 font-medium">
                    {formatPercentage(metric.var95)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">CVaR (95%):</span>
                  <span className="text-red-600 font-medium">
                    {formatPercentage(metric.cvar95)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Skewness:</span>
                  <span className={`font-medium ${
                    metric.skewness > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatNumber(metric.skewness)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Kurtosis:</span>
                  <span className={`font-medium ${
                    metric.kurtosis > 3 ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {formatNumber(metric.kurtosis)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render correlation tab
  const renderCorrelationTab = () => (
    <div className="space-y-6">
      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Activity className="w-5 h-5 mr-2 text-purple-600" />
        Correlation Analysis
      </h4>
      
      {/* Top Correlations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h5 className="font-medium text-gray-900 dark:text-white mb-3">
            Highest Positive Correlations
          </h5>
          <div className="space-y-2">
            {pairCorrelations
              .filter(pair => pair.correlation > 0)
              .slice(0, 5)
              .map((pair, index) => (
                <div key={`${pair.asset1}-${pair.asset2}`} 
                     className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {pair.asset1} × {pair.asset2}
                    </span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {pair.strength} correlation
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">
                      {formatNumber(pair.correlation)}
                    </div>
                    <div className="text-xs text-gray-500">
                      p &lt; {(1 - pair.significance).toFixed(3)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div>
          <h5 className="font-medium text-gray-900 dark:text-white mb-3">
            Highest Negative Correlations
          </h5>
          <div className="space-y-2">
            {pairCorrelations
              .filter(pair => pair.correlation < 0)
              .slice(0, 5)
              .map((pair, index) => (
                <div key={`${pair.asset1}-${pair.asset2}`} 
                     className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {pair.asset1} × {pair.asset2}
                    </span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {pair.strength} correlation
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-600">
                      {formatNumber(pair.correlation)}
                    </div>
                    <div className="text-xs text-gray-500">
                      p &lt; {(1 - pair.significance).toFixed(3)}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Diversification Insights */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
        <h5 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          Diversification Insights
        </h5>
        <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <p>• Pairs with correlation &lt; 0.3 provide good diversification benefits</p>
          <p>• Strong positive correlations (&gt; 0.7) indicate similar risk/return profiles</p>
          <p>• Negative correlations can provide natural hedging opportunities</p>
        </div>
      </div>
    </div>
  );

  // Render regression tab
  const renderRegressionTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <Target className="w-5 h-5 mr-2 text-green-600" />
          Regression Analysis
        </h4>
        
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Benchmark:</label>
          <select
            value={benchmarkAsset}
            onChange={(e) => setBenchmarkAsset(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            {assets.map(asset => (
              <option key={asset} value={asset}>{asset}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Asset
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Alpha (Annual)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Beta
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                R-Squared
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Interpretation
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {assetMetrics
              .filter(metric => metric.asset !== benchmarkAsset)
              .map(metric => (
                <tr key={metric.asset} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {metric.asset}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <span className={`${
                      (metric.alpha || 0) > 0 ? 'text-green-600' : 'text-red-600'
                    } font-medium`}>
                      {metric.alpha ? formatPercentage(metric.alpha) : 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {metric.beta ? formatNumber(metric.beta) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {metric.rSquared ? formatPercentage(metric.rSquared) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {metric.beta ? (
                      metric.beta > 1.2 ? 'High volatility vs benchmark' :
                      metric.beta < 0.8 ? 'Low volatility vs benchmark' :
                      'Similar volatility to benchmark'
                    ) : 'Insufficient data'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
        <h5 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
          Understanding Regression Metrics
        </h5>
        <div className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
          <p><strong>Alpha:</strong> Excess return relative to benchmark (positive = outperforming)</p>
          <p><strong>Beta:</strong> Sensitivity to benchmark movements (&gt;1 = more volatile)</p>
          <p><strong>R-Squared:</strong> Percentage of price movements explained by benchmark</p>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'metrics', label: 'Performance', icon: TrendingUp },
    { id: 'correlation', label: 'Correlation', icon: Activity },
    { id: 'regression', label: 'Regression', icon: Target },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Statistical Analysis
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Comprehensive analysis of {assets.join(', ')}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'metrics' && renderMetricsTab()}
          {activeTab === 'correlation' && renderCorrelationTab()}
          {activeTab === 'regression' && renderRegressionTab()}
        </div>
      </div>
    </div>
  );
};

export default StatisticalAnalysis;