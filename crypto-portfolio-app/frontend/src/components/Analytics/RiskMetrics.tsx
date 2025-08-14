import React, { useState } from 'react';
import { 
  AlertTriangle, 
  TrendingDown, 
  Activity, 
  Shield, 
  Target,
  BarChart3,
  Info,
  Zap
} from 'lucide-react';
import { RiskMetrics as RiskMetricsType, DrawdownAnalysis } from '../../services/PerformanceAnalyticsService';

interface RiskMetricsProps {
  riskMetrics: RiskMetricsType | null;
  drawdownAnalysis: DrawdownAnalysis[];
  className?: string;
}

const RiskMetrics: React.FC<RiskMetricsProps> = ({
  riskMetrics,
  drawdownAnalysis,
  className = ''
}) => {
  const [selectedConfidenceLevel, setSelectedConfidenceLevel] = useState<'95' | '99'>('95');
  const [selectedTimeHorizon, setSelectedTimeHorizon] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Format percentage
  const formatPercentage = (value: number, decimals: number = 2): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  // Format number
  const formatNumber = (value: number, decimals: number = 3): string => {
    return value.toFixed(decimals);
  };

  // Get risk level color and description
  const getRiskLevelInfo = (level: string) => {
    switch (level) {
      case 'high':
        return {
          color: 'text-red-600 bg-red-100 dark:bg-red-900/20 border-red-200',
          icon: <AlertTriangle className="w-4 h-4" />,
          description: 'High risk portfolio with significant volatility and potential for large losses'
        };
      case 'medium':
        return {
          color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-200',
          icon: <Activity className="w-4 h-4" />,
          description: 'Moderate risk with balanced volatility and manageable downside potential'
        };
      case 'low':
        return {
          color: 'text-green-600 bg-green-100 dark:bg-green-900/20 border-green-200',
          icon: <Shield className="w-4 h-4" />,
          description: 'Conservative portfolio with low volatility and limited downside risk'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-100 dark:bg-gray-700 border-gray-200',
          icon: <Info className="w-4 h-4" />,
          description: 'Risk level assessment pending'
        };
    }
  };

  // Get VaR value based on selected parameters
  const getVaRValue = () => {
    if (!riskMetrics) return 0;
    
    if (selectedTimeHorizon === 'daily') return riskMetrics.valueAtRisk.daily95;
    if (selectedTimeHorizon === 'weekly') return riskMetrics.valueAtRisk.weekly95;
    return riskMetrics.valueAtRisk.monthly95;
  };

  // Get CVaR value based on selected parameters
  const getCVaRValue = () => {
    if (!riskMetrics) return 0;
    
    if (selectedTimeHorizon === 'daily') return riskMetrics.expectedShortfall.daily95;
    if (selectedTimeHorizon === 'weekly') return riskMetrics.expectedShortfall.weekly95;
    return riskMetrics.expectedShortfall.monthly95;
  };

  // Calculate drawdown statistics
  const drawdownStats = React.useMemo(() => {
    if (drawdownAnalysis.length === 0) return null;
    
    const drawdowns = drawdownAnalysis.filter(d => d.drawdown > 0);
    if (drawdowns.length === 0) return null;
    
    const avgDrawdown = drawdowns.reduce((sum, d) => sum + d.drawdown, 0) / drawdowns.length;
    const maxDrawdown = Math.max(...drawdowns.map(d => d.drawdown));
    const avgDuration = drawdowns.reduce((sum, d) => sum + d.duration, 0) / drawdowns.length;
    const maxDuration = Math.max(...drawdowns.map(d => d.duration));
    const currentDrawdown = drawdownAnalysis[drawdownAnalysis.length - 1]?.drawdown || 0;
    
    return {
      avgDrawdown,
      maxDrawdown,
      avgDuration,
      maxDuration,
      currentDrawdown,
      totalDrawdowns: drawdowns.length
    };
  }, [drawdownAnalysis]);

  // Render risk metric card
  const renderRiskCard = (
    title: string,
    value: string | number,
    subtitle: string,
    icon: React.ReactNode,
    colorClass: string = 'text-gray-900'
  ) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center space-x-2 mb-2">
        <div className="text-gray-500 dark:text-gray-400">
          {icon}
        </div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className={`text-xl font-bold mb-1 ${colorClass}`}>
        {typeof value === 'number' ? formatPercentage(value) : value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {subtitle}
      </div>
    </div>
  );

  if (!riskMetrics) {
    return (
      <div className={`risk-metrics ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
          <p>Risk metrics data not available</p>
        </div>
      </div>
    );
  }

  const riskInfo = getRiskLevelInfo(riskMetrics.riskLevel);

  return (
    <div className={`risk-metrics space-y-6 ${className}`}>
      {/* Risk Level Overview */}
      <div className={`rounded-lg p-4 border ${riskInfo.color}`}>
        <div className="flex items-center space-x-3">
          {riskInfo.icon}
          <div>
            <h3 className="font-medium text-lg">
              {riskMetrics.riskLevel.charAt(0).toUpperCase() + riskMetrics.riskLevel.slice(1)} Risk Portfolio
            </h3>
            <p className="text-sm mt-1">{riskInfo.description}</p>
          </div>
        </div>
      </div>

      {/* VaR and CVaR Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 sm:mb-0">
            Value at Risk Analysis
          </h3>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedTimeHorizon}
              onChange={(e) => setSelectedTimeHorizon(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            
            <select
              value={selectedConfidenceLevel}
              onChange={(e) => setSelectedConfidenceLevel(e.target.value as any)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
            >
              <option value="95">95% Confidence</option>
              <option value="99">99% Confidence</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderRiskCard(
            `VaR (${selectedConfidenceLevel}%)`,
            getVaRValue(),
            `Maximum expected loss (${selectedTimeHorizon})`,
            <TrendingDown className="w-4 h-4" />,
            'text-red-600 dark:text-red-400'
          )}
          
          {renderRiskCard(
            `CVaR (${selectedConfidenceLevel}%)`,
            getCVaRValue(),
            `Expected loss beyond VaR (${selectedTimeHorizon})`,
            <AlertTriangle className="w-4 h-4" />,
            'text-red-700 dark:text-red-500'
          )}
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p><strong>VaR</strong>: The maximum loss you can expect {selectedConfidenceLevel}% of the time over a {selectedTimeHorizon} period.</p>
              <p className="mt-1"><strong>CVaR</strong>: The average loss you can expect in the worst {100 - parseInt(selectedConfidenceLevel)}% of scenarios.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Volatility Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Volatility Analysis
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderRiskCard(
            'Realized Volatility',
            riskMetrics.volatilityMetrics.realized,
            'Historical price volatility',
            <Activity className="w-4 h-4" />
          )}
          
          {renderRiskCard(
            'Parkinson Volatility',
            riskMetrics.volatilityMetrics.parkinson,
            'High-low range estimator',
            <BarChart3 className="w-4 h-4" />
          )}
          
          {renderRiskCard(
            'GARCH Estimate',
            riskMetrics.volatilityMetrics.garchEstimate,
            'Conditional volatility model',
            <Zap className="w-4 h-4" />
          )}
        </div>
        
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p>Different volatility measures provide insights into various aspects of price risk and market conditions.</p>
        </div>
      </div>

      {/* Drawdown Analysis */}
      {drawdownStats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Drawdown Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {renderRiskCard(
              'Current Drawdown',
              drawdownStats.currentDrawdown,
              'From recent peak',
              <TrendingDown className="w-4 h-4" />,
              drawdownStats.currentDrawdown > 0.1 ? 'text-red-600' : 'text-green-600'
            )}
            
            {renderRiskCard(
              'Maximum Drawdown',
              drawdownStats.maxDrawdown,
              'Worst historical loss',
              <AlertTriangle className="w-4 h-4" />,
              'text-red-600 dark:text-red-400'
            )}
            
            {renderRiskCard(
              'Average Drawdown',
              drawdownStats.avgDrawdown,
              'Typical loss magnitude',
              <BarChart3 className="w-4 h-4" />
            )}
            
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <div className="text-gray-500 dark:text-gray-400">
                  <Activity className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recovery Time</h3>
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {Math.round(drawdownStats.avgDuration)} days
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Average recovery period
              </div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total drawdown periods:</span>
              <span className="font-medium text-gray-900 dark:text-white">{drawdownStats.totalDrawdowns}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600 dark:text-gray-400">Longest recovery:</span>
              <span className="font-medium text-gray-900 dark:text-white">{Math.round(drawdownStats.maxDuration)} days</span>
            </div>
          </div>
        </div>
      )}

      {/* Risk Composition */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Risk Composition
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderRiskCard(
            'Correlation Risk',
            riskMetrics.correlationRisk,
            'Inter-asset correlation exposure',
            <Activity className="w-4 h-4" />,
            riskMetrics.correlationRisk > 0.7 ? 'text-red-600' : riskMetrics.correlationRisk > 0.4 ? 'text-yellow-600' : 'text-green-600'
          )}
          
          {renderRiskCard(
            'Concentration Risk',
            riskMetrics.concentrationRisk,
            'Single asset exposure risk',
            <Target className="w-4 h-4" />,
            riskMetrics.concentrationRisk > 0.5 ? 'text-red-600' : riskMetrics.concentrationRisk > 0.3 ? 'text-yellow-600' : 'text-green-600'
          )}
          
          {renderRiskCard(
            'Liquidity Risk',
            riskMetrics.liquidityRisk,
            'Market liquidity exposure',
            <Shield className="w-4 h-4" />,
            riskMetrics.liquidityRisk > 0.4 ? 'text-red-600' : riskMetrics.liquidityRisk > 0.2 ? 'text-yellow-600' : 'text-green-600'
          )}
        </div>
        
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">Risk Recommendations</h4>
            <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
              {riskMetrics.concentrationRisk > 0.4 && (
                <li>• Consider diversifying holdings to reduce concentration risk</li>
              )}
              {riskMetrics.correlationRisk > 0.6 && (
                <li>• Add assets with lower correlations to improve diversification</li>
              )}
              {riskMetrics.liquidityRisk > 0.3 && (
                <li>• Monitor liquidity conditions and consider more liquid alternatives</li>
              )}
              {riskMetrics.concentrationRisk <= 0.4 && riskMetrics.correlationRisk <= 0.6 && riskMetrics.liquidityRisk <= 0.3 && (
                <li>• Portfolio risk composition appears well-balanced</li>
              )}
            </ul>
          </div>
          
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Risk Management Tips</h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Regular rebalancing can help maintain target risk levels</li>
              <li>• Consider position sizing based on individual asset volatility</li>
              <li>• Monitor correlations during market stress periods</li>
              <li>• Use stop-losses and take-profit levels for active management</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskMetrics;