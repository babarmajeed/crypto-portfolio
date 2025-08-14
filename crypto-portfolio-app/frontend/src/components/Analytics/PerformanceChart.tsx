import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  ComposedChart,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine,
  Brush
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Activity, 
  Target,
  Settings,
  Download,
  Maximize2,
  Calendar,
  Info
} from 'lucide-react';
import { PerformanceReturn } from '../../services/PerformanceAnalyticsService';

interface PerformanceChartProps {
  portfolioData: PerformanceReturn[];
  benchmarkData?: PerformanceReturn[];
  benchmarkName?: string;
  timeRange: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL';
  className?: string;
}

type ChartType = 'line' | 'area' | 'candle' | 'drawdown' | 'correlation' | 'returns';
type DisplayMode = 'cumulative' | 'periodic' | 'normalized' | 'rolling';

interface ChartDataPoint {
  date: string;
  timestamp: number;
  portfolioValue: number;
  portfolioCumulative: number;
  portfolioReturn: number;
  benchmarkValue?: number;
  benchmarkCumulative?: number;
  benchmarkReturn?: number;
  drawdown: number;
  rollingVolatility: number;
  rollingReturn: number;
  outperformance?: number;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  portfolioData,
  benchmarkData = [],
  benchmarkName = 'Benchmark',
  timeRange,
  className = ''
}) => {
  const [chartType, setChartType] = useState<ChartType>('line');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('cumulative');
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [showDrawdown, setShowDrawdown] = useState(false);
  const [showVolatility, setShowVolatility] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brushData, setBrushData] = useState<{ startIndex: number; endIndex: number } | null>(null);
  
  const chartRef = useRef<HTMLDivElement>(null);

  // Process and combine data
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const portfolioMap = new Map(portfolioData.map(d => [d.date, d]));
    const benchmarkMap = new Map(benchmarkData.map(d => [d.date, d]));
    
    const combinedData: ChartDataPoint[] = [];
    let portfolioPeak = 1;
    
    // Calculate rolling metrics window (20 days)
    const rollingWindow = 20;
    
    portfolioData.forEach((portfolioPoint, index) => {
      const benchmarkPoint = benchmarkMap.get(portfolioPoint.date);
      
      // Calculate drawdown
      const currentValue = 1 + portfolioPoint.cumulativeReturn;
      if (currentValue > portfolioPeak) {
        portfolioPeak = currentValue;
      }
      const drawdown = (portfolioPeak - currentValue) / portfolioPeak;
      
      // Calculate rolling volatility and returns
      const windowStart = Math.max(0, index - rollingWindow + 1);
      const windowData = portfolioData.slice(windowStart, index + 1);
      
      let rollingVolatility = 0;
      let rollingReturn = 0;
      
      if (windowData.length >= 2) {
        const returns = windowData.map(d => d.return);
        const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
        rollingVolatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
        rollingReturn = avgReturn * 252; // Annualized
      }
      
      const dataPoint: ChartDataPoint = {
        date: portfolioPoint.date,
        timestamp: portfolioPoint.timestamp,
        portfolioValue: 1 + portfolioPoint.cumulativeReturn,
        portfolioCumulative: portfolioPoint.cumulativeReturn,
        portfolioReturn: portfolioPoint.return,
        drawdown: -drawdown, // Negative for display
        rollingVolatility,
        rollingReturn,
        outperformance: benchmarkPoint 
          ? portfolioPoint.cumulativeReturn - benchmarkPoint.cumulativeReturn
          : undefined
      };
      
      if (benchmarkPoint) {
        dataPoint.benchmarkValue = 1 + benchmarkPoint.cumulativeReturn;
        dataPoint.benchmarkCumulative = benchmarkPoint.cumulativeReturn;
        dataPoint.benchmarkReturn = benchmarkPoint.return;
      }
      
      combinedData.push(dataPoint);
    });
    
    return combinedData;
  }, [portfolioData, benchmarkData]);

  // Format data for display based on mode
  const displayData = useMemo(() => {
    if (displayMode === 'normalized') {
      // Normalize to start at 100
      const firstPortfolio = chartData[0]?.portfolioValue || 1;
      const firstBenchmark = chartData[0]?.benchmarkValue || 1;
      
      return chartData.map(d => ({
        ...d,
        portfolioValue: (d.portfolioValue / firstPortfolio) * 100,
        benchmarkValue: d.benchmarkValue ? (d.benchmarkValue / firstBenchmark) * 100 : undefined
      }));
    }
    
    if (displayMode === 'periodic') {
      return chartData.map(d => ({
        ...d,
        portfolioValue: d.portfolioReturn * 100,
        benchmarkValue: d.benchmarkReturn ? d.benchmarkReturn * 100 : undefined
      }));
    }
    
    if (displayMode === 'rolling') {
      return chartData.map(d => ({
        ...d,
        portfolioValue: d.rollingReturn * 100,
        benchmarkValue: d.benchmarkValue ? d.rollingReturn * 100 : undefined // Simplified
      }));
    }
    
    // Default cumulative mode
    return chartData.map(d => ({
      ...d,
      portfolioValue: d.portfolioCumulative * 100,
      benchmarkValue: d.benchmarkCumulative ? d.benchmarkCumulative * 100 : undefined
    }));
  }, [chartData, displayMode]);

  // Chart configuration
  const chartConfig = useMemo(() => {
    const config = {
      portfolio: {
        color: '#3B82F6',
        name: 'Portfolio'
      },
      benchmark: {
        color: '#EF4444',
        name: benchmarkName
      },
      drawdown: {
        color: '#F59E0B',
        name: 'Drawdown'
      },
      volatility: {
        color: '#8B5CF6',
        name: 'Volatility'
      }
    };
    
    return config;
  }, [benchmarkName]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            {new Date(data.timestamp).toLocaleDateString()}
          </p>
          
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-4 text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-gray-700 dark:text-gray-300">{item.name}:</span>
              </div>
              <span className="font-medium" style={{ color: item.color }}>
                {typeof item.value === 'number' 
                  ? `${item.value >= 0 ? '+' : ''}${item.value.toFixed(2)}%`
                  : item.value
                }
              </span>
            </div>
          ))}
          
          {data.outperformance !== undefined && (
            <div className="flex items-center justify-between space-x-4 text-sm mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-700 dark:text-gray-300">Outperformance:</span>
              <span className={`font-medium ${
                data.outperformance >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {data.outperformance >= 0 ? '+' : ''}{(data.outperformance * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  // Handle brush change for zoom
  const handleBrushChange = (brushData: any) => {
    if (brushData && brushData.startIndex !== undefined && brushData.endIndex !== undefined) {
      setBrushData({
        startIndex: brushData.startIndex,
        endIndex: brushData.endIndex
      });
    }
  };

  // Export chart as image
  const exportChart = () => {
    // Implementation would depend on the chart library's export capabilities
    console.log('Export chart functionality would be implemented here');
  };

  // Render different chart types
  const renderChart = () => {
    const commonProps = {
      data: displayData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="date"
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            <Area
              type="monotone"
              dataKey="portfolioValue"
              name={chartConfig.portfolio.name}
              stroke={chartConfig.portfolio.color}
              fill={chartConfig.portfolio.color}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            
            {showBenchmark && benchmarkData.length > 0 && (
              <Area
                type="monotone"
                dataKey="benchmarkValue"
                name={chartConfig.benchmark.name}
                stroke={chartConfig.benchmark.color}
                fill={chartConfig.benchmark.color}
                fillOpacity={0.1}
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            )}
          </AreaChart>
        );

      case 'drawdown':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="date"
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            />
            <YAxis 
              yAxisId="left"
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="portfolioValue"
              name={chartConfig.portfolio.name}
              stroke={chartConfig.portfolio.color}
              strokeWidth={2}
              dot={false}
            />
            
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="drawdown"
              name={chartConfig.drawdown.name}
              stroke={chartConfig.drawdown.color}
              fill={chartConfig.drawdown.color}
              fillOpacity={0.3}
              strokeWidth={1}
            />
          </ComposedChart>
        );

      case 'returns':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="date"
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
            
            <Bar
              dataKey="portfolioReturn"
              name="Daily Returns"
              fill={chartConfig.portfolio.color}
              opacity={0.8}
            />
          </BarChart>
        );

      default: // line chart
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
            <XAxis 
              dataKey="date"
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
              })}
            />
            <YAxis 
              stroke="#6B7280"
              fontSize={12}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            <Line
              type="monotone"
              dataKey="portfolioValue"
              name={chartConfig.portfolio.name}
              stroke={chartConfig.portfolio.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: chartConfig.portfolio.color, strokeWidth: 2 }}
            />
            
            {showBenchmark && benchmarkData.length > 0 && (
              <Line
                type="monotone"
                dataKey="benchmarkValue"
                name={chartConfig.benchmark.name}
                stroke={chartConfig.benchmark.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 4, stroke: chartConfig.benchmark.color, strokeWidth: 2 }}
              />
            )}
            
            {showVolatility && (
              <Line
                type="monotone"
                dataKey="rollingVolatility"
                name={chartConfig.volatility.name}
                stroke={chartConfig.volatility.color}
                strokeWidth={1}
                strokeOpacity={0.6}
                dot={false}
              />
            )}
          </LineChart>
        );
    }
  };

  return (
    <div className={`performance-chart ${className}`}>
      {/* Chart Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-wrap gap-4">
            {/* Chart Type */}
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-gray-500" />
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as ChartType)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="line">Line Chart</option>
                <option value="area">Area Chart</option>
                <option value="drawdown">Drawdown Analysis</option>
                <option value="returns">Returns Distribution</option>
              </select>
            </div>
            
            {/* Display Mode */}
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <select
                value={displayMode}
                onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="cumulative">Cumulative Returns</option>
                <option value="periodic">Periodic Returns</option>
                <option value="normalized">Normalized (Base 100)</option>
                <option value="rolling">Rolling Returns</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Toggle Options */}
            {benchmarkData.length > 0 && (
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={showBenchmark}
                  onChange={(e) => setShowBenchmark(e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-700 dark:text-gray-300">Show Benchmark</span>
              </label>
            )}
            
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showVolatility}
                onChange={(e) => setShowVolatility(e.target.checked)}
                className="rounded"
              />
              <span className="text-gray-700 dark:text-gray-300">Show Volatility</span>
            </label>
            
            {/* Action Buttons */}
            <button
              onClick={exportChart}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Export Chart"
            >
              <Download className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div 
        ref={chartRef}
        className={`bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 ${
          isFullscreen ? 'fixed inset-4 z-50' : ''
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Portfolio Performance Chart
          </h3>
          
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <span>{timeRange} Performance</span>
            <span>•</span>
            <span>{displayData.length} data points</span>
          </div>
        </div>
        
        <div className={`${isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-96'}`}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        
        {/* Brush for zooming */}
        {chartData.length > 50 && (
          <div className="mt-4 h-20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayData}>
                <Line
                  type="monotone"
                  dataKey="portfolioValue"
                  stroke={chartConfig.portfolio.color}
                  strokeWidth={1}
                  dot={false}
                />
                <Brush
                  dataKey="date"
                  height={20}
                  stroke={chartConfig.portfolio.color}
                  onChange={handleBrushChange}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Chart Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Current Value</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {displayData[displayData.length - 1]?.portfolioValue.toFixed(2)}%
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Return</div>
          <div className="text-lg font-semibold text-green-600">
            +{((displayData[displayData.length - 1]?.portfolioValue || 0) - (displayData[0]?.portfolioValue || 0)).toFixed(2)}%
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Max Drawdown</div>
          <div className="text-lg font-semibold text-red-600">
            {Math.min(...chartData.map(d => d.drawdown)).toFixed(2)}%
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Volatility (Ann.)</div>
          <div className="text-lg font-semibold text-yellow-600">
            {(chartData[chartData.length - 1]?.rollingVolatility || 0).toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;