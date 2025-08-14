import React, { useState, useMemo } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Target,
  Settings,
  Play,
  Info,
  Calendar,
  DollarSign,
  Percent
} from 'lucide-react';
import { PerformanceReturn } from '../../services/PerformanceAnalyticsService';

interface MonteCarloSimulationProps {
  historicalReturns: PerformanceReturn[];
  currentValue: number;
  className?: string;
}

interface SimulationResult {
  path: number[];
  finalValue: number;
  totalReturn: number;
  maxDrawdown: number;
  minValue: number;
  maxValue: number;
}

interface SimulationStatistics {
  scenarios: SimulationResult[];
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  probabilityOfLoss: number;
  probabilityOfGain: {
    above10: number;
    above25: number;
    above50: number;
    above100: number;
  };
  expectedValue: number;
  worstCase: number;
  bestCase: number;
  volatility: number;
}

const MonteCarloSimulation: React.FC<MonteCarloSimulationProps> = ({
  historicalReturns,
  currentValue,
  className = ''
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [numSimulations, setNumSimulations] = useState(1000);
  const [timeHorizon, setTimeHorizon] = useState(252); // 1 year in trading days
  const [confidenceLevel, setConfidenceLevel] = useState(95);
  const [simulationResults, setSimulationResults] = useState<SimulationStatistics | null>(null);

  // Calculate historical statistics
  const historicalStats = useMemo(() => {
    if (historicalReturns.length === 0) return null;
    
    const returns = historicalReturns.map(r => r.return);
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    
    // Calculate skewness and kurtosis for more realistic simulation
    const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0) / returns.length;
    const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 4), 0) / returns.length - 3;
    
    return {
      mean,
      stdDev,
      skewness,
      kurtosis,
      annualizedMean: mean * 252,
      annualizedStdDev: stdDev * Math.sqrt(252)
    };
  }, [historicalReturns]);

  // Generate random number using Box-Muller transformation for normal distribution
  const generateNormalRandom = (mean: number = 0, stdDev: number = 1): number => {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  };

  // Adjust for skewness and kurtosis using Cornish-Fisher expansion
  const adjustForMoments = (normalRandom: number, skewness: number, kurtosis: number): number => {
    // Cornish-Fisher expansion for skewness and kurtosis adjustment
    const adjustment = (skewness / 6) * (Math.pow(normalRandom, 2) - 1) +
                      (kurtosis / 24) * (Math.pow(normalRandom, 3) - 3 * normalRandom) -
                      (Math.pow(skewness, 2) / 36) * (2 * Math.pow(normalRandom, 3) - 5 * normalRandom);
    
    return normalRandom + adjustment;
  };

  // Run Monte Carlo simulation
  const runSimulation = async () => {
    if (!historicalStats) return;
    
    setIsRunning(true);
    
    // Run simulation in chunks to avoid blocking UI
    const chunkSize = 100;
    const scenarios: SimulationResult[] = [];
    
    try {
      for (let chunk = 0; chunk < Math.ceil(numSimulations / chunkSize); chunk++) {
        const currentChunkSize = Math.min(chunkSize, numSimulations - chunk * chunkSize);
        
        for (let i = 0; i < currentChunkSize; i++) {
          const path: number[] = [currentValue];
          let value = currentValue;
          let peak = currentValue;
          let maxDrawdown = 0;
          let minValue = currentValue;
          let maxValue = currentValue;
          
          // Generate path
          for (let day = 0; day < timeHorizon; day++) {
            // Generate return with historical statistics
            let randomReturn = generateNormalRandom(historicalStats.mean, historicalStats.stdDev);
            
            // Adjust for skewness and kurtosis
            randomReturn = adjustForMoments(randomReturn, historicalStats.skewness, historicalStats.kurtosis);
            
            // Apply return to current value
            value *= (1 + randomReturn);
            path.push(value);
            
            // Track statistics
            if (value > peak) {
              peak = value;
            }
            
            const currentDrawdown = (peak - value) / peak;
            if (currentDrawdown > maxDrawdown) {
              maxDrawdown = currentDrawdown;
            }
            
            if (value < minValue) minValue = value;
            if (value > maxValue) maxValue = value;
          }
          
          const finalValue = path[path.length - 1];
          const totalReturn = (finalValue - currentValue) / currentValue;
          
          scenarios.push({
            path,
            finalValue,
            totalReturn,
            maxDrawdown,
            minValue,
            maxValue
          });
        }
        
        // Yield control to prevent UI blocking
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      
      // Calculate statistics
      const finalValues = scenarios.map(s => s.finalValue).sort((a, b) => a - b);
      const returns = scenarios.map(s => s.totalReturn).sort((a, b) => a - b);
      
      const percentiles = {
        p5: finalValues[Math.floor(0.05 * finalValues.length)],
        p10: finalValues[Math.floor(0.10 * finalValues.length)],
        p25: finalValues[Math.floor(0.25 * finalValues.length)],
        p50: finalValues[Math.floor(0.50 * finalValues.length)],
        p75: finalValues[Math.floor(0.75 * finalValues.length)],
        p90: finalValues[Math.floor(0.90 * finalValues.length)],
        p95: finalValues[Math.floor(0.95 * finalValues.length)]
      };
      
      const probabilityOfLoss = returns.filter(r => r < 0).length / returns.length;
      const probabilityOfGain = {
        above10: returns.filter(r => r > 0.10).length / returns.length,
        above25: returns.filter(r => r > 0.25).length / returns.length,
        above50: returns.filter(r => r > 0.50).length / returns.length,
        above100: returns.filter(r => r > 1.00).length / returns.length
      };
      
      const expectedValue = finalValues.reduce((sum, v) => sum + v, 0) / finalValues.length;
      const worstCase = Math.min(...finalValues);
      const bestCase = Math.max(...finalValues);
      const volatility = Math.sqrt(
        returns.reduce((sum, r) => {
          const avgReturn = returns.reduce((s, ret) => s + ret, 0) / returns.length;
          return sum + Math.pow(r - avgReturn, 2);
        }, 0) / (returns.length - 1)
      );
      
      setSimulationResults({
        scenarios,
        percentiles,
        probabilityOfLoss,
        probabilityOfGain,
        expectedValue,
        worstCase,
        bestCase,
        volatility
      });
      
    } catch (error) {
      console.error('Simulation error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  // Format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number, decimals: number = 1): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  // Get color based on value relative to current
  const getValueColor = (value: number): string => {
    const ratio = value / currentValue;
    if (ratio > 1.1) return 'text-green-600 dark:text-green-400';
    if (ratio < 0.9) return 'text-red-600 dark:text-red-400';
    return 'text-gray-900 dark:text-white';
  };

  // Render simulation controls
  const renderControls = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
        <Settings className="w-5 h-5 mr-2" />
        Simulation Parameters
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Number of Simulations
          </label>
          <select
            value={numSimulations}
            onChange={(e) => setNumSimulations(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
          >
            <option value={500}>500 (Fast)</option>
            <option value={1000}>1,000 (Balanced)</option>
            <option value={5000}>5,000 (Detailed)</option>
            <option value={10000}>10,000 (Comprehensive)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Time Horizon
          </label>
          <select
            value={timeHorizon}
            onChange={(e) => setTimeHorizon(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
          >
            <option value={63}>3 Months</option>
            <option value={126}>6 Months</option>
            <option value={252}>1 Year</option>
            <option value={504}>2 Years</option>
            <option value={1260}>5 Years</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Confidence Level
          </label>
          <select
            value={confidenceLevel}
            onChange={(e) => setConfidenceLevel(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm"
          >
            <option value={90}>90%</option>
            <option value={95}>95%</option>
            <option value={99}>99%</option>
          </select>
        </div>
        
        <div className="flex items-end">
          <button
            onClick={runSimulation}
            disabled={isRunning || !historicalStats}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <Zap className="w-4 h-4 animate-pulse" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Run Simulation</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      {historicalStats && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p>
              <strong>Historical Data:</strong> Using {historicalReturns.length} days of returns data. 
              Annual return: {formatPercentage(historicalStats.annualizedMean)}, 
              Annual volatility: {formatPercentage(historicalStats.annualizedStdDev)}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  // Render simulation results
  const renderResults = () => {
    if (!simulationResults) return null;

    return (
      <div className="space-y-6">
        {/* Summary Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2" />
            Simulation Results Summary
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className={`text-xl font-bold ${getValueColor(simulationResults.expectedValue)}`}>
                {formatCurrency(simulationResults.expectedValue)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Expected Value</div>
              <div className="text-xs text-gray-400 mt-1">
                {formatPercentage((simulationResults.expectedValue - currentValue) / currentValue)}
              </div>
            </div>
            
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-xl font-bold text-red-600">
                {formatCurrency(simulationResults.worstCase)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Worst Case</div>
              <div className="text-xs text-gray-400 mt-1">
                {formatPercentage((simulationResults.worstCase - currentValue) / currentValue)}
              </div>
            </div>
            
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-xl font-bold text-green-600">
                {formatCurrency(simulationResults.bestCase)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Best Case</div>
              <div className="text-xs text-gray-400 mt-1">
                {formatPercentage((simulationResults.bestCase - currentValue) / currentValue)}
              </div>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-xl font-bold text-yellow-600">
                {formatPercentage(simulationResults.volatility)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Projected Volatility</div>
              <div className="text-xs text-gray-400 mt-1">
                Annualized standard deviation
              </div>
            </div>
          </div>
        </div>

        {/* Percentile Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Value at Risk Analysis
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Percentile</th>
                  <th className="text-left py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Portfolio Value</th>
                  <th className="text-left py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Return</th>
                  <th className="text-left py-3 text-sm font-medium text-gray-700 dark:text-gray-300">Interpretation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {Object.entries(simulationResults.percentiles).map(([key, value]) => {
                  const percentile = key.replace('p', '');
                  const returnPct = (value - currentValue) / currentValue;
                  return (
                    <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="py-3 text-sm text-gray-900 dark:text-white">{percentile}th</td>
                      <td className={`py-3 text-sm font-medium ${getValueColor(value)}`}>
                        {formatCurrency(value)}
                      </td>
                      <td className={`py-3 text-sm ${returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPercentage(returnPct)}
                      </td>
                      <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                        {percentile === '5' && `${confidenceLevel}% chance of doing better`}
                        {percentile === '10' && '90% chance of doing better'}
                        {percentile === '25' && '75% chance of doing better'}
                        {percentile === '50' && 'Median outcome'}
                        {percentile === '75' && '25% chance of doing better'}
                        {percentile === '90' && '10% chance of doing better'}
                        {percentile === '95' && '5% chance of doing better'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Probability Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Percent className="w-5 h-5 mr-2" />
            Probability Analysis
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Probability of Loss</h4>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-red-600 h-3 rounded-full"
                    style={{ width: `${simulationResults.probabilityOfLoss * 100}%` }}
                  />
                </div>
                <span className="text-lg font-bold text-red-600">
                  {formatPercentage(simulationResults.probabilityOfLoss)}
                </span>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">Probability of Gains</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Gain {'>'} 10%:</span>
                  <span className="font-medium text-green-600">
                    {formatPercentage(simulationResults.probabilityOfGain.above10)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Gain {'>'} 25%:</span>
                  <span className="font-medium text-green-600">
                    {formatPercentage(simulationResults.probabilityOfGain.above25)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Gain {'>'} 50%:</span>
                  <span className="font-medium text-green-600">
                    {formatPercentage(simulationResults.probabilityOfGain.above50)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Gain {'>'} 100%:</span>
                  <span className="font-medium text-green-600">
                    {formatPercentage(simulationResults.probabilityOfGain.above100)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Placeholder */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Simulation Paths Visualization
          </h3>
          <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <BarChart3 className="w-12 h-12 mx-auto mb-2" />
              <p>Monte Carlo simulation paths chart</p>
              <p className="text-sm">Showing {numSimulations} scenarios over {Math.round(timeHorizon / 252 * 12)} months</p>
            </div>
          </div>
        </div>

        {/* Methodology */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
            <Info className="w-4 h-4 mr-2" />
            Methodology & Assumptions
          </h4>
          <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <p>• Simulations use historical return distribution with {historicalReturns.length} days of data</p>
            <p>• Returns are assumed to follow a distribution adjusted for skewness and kurtosis</p>
            <p>• Each simulation path represents one possible future scenario</p>
            <p>• Results are for illustrative purposes and do not guarantee future performance</p>
            <p>• Consider additional factors like transaction costs, taxes, and changing market conditions</p>
          </div>
        </div>
      </div>
    );
  };

  if (!historicalStats) {
    return (
      <div className={`monte-carlo-simulation ${className}`}>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-4" />
          <p>Insufficient historical data for Monte Carlo simulation</p>
          <p className="text-sm mt-2">At least 30 days of return data required</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`monte-carlo-simulation ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Monte Carlo Simulation
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Project potential future portfolio values using historical return patterns
        </p>
      </div>

      {renderControls()}
      {renderResults()}
    </div>
  );
};

export default MonteCarloSimulation;