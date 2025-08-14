import React, { useState, useMemo } from 'react';
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Target,
  Activity,
  DollarSign,
  Percent,
  ArrowUpDown,
  Info,
  Filter,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react';

interface AssetAttribution {
  symbol: string;
  name: string;
  weight: number;
  return: number;
  contribution: number;
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  category: string;
}

interface SectorAttribution {
  sector: string;
  portfolioWeight: number;
  benchmarkWeight: number;
  portfolioReturn: number;
  benchmarkReturn: number;
  allocationEffect: number;
  selectionEffect: number;
  totalContribution: number;
}

interface TimeBasedAttribution {
  period: string;
  date: string;
  totalReturn: number;
  assetSelection: number;
  assetAllocation: number;
  interactionEffect: number;
  timingEffect: number;
  unexplained: number;
}

interface PerformanceAttributionProps {
  portfolioId: string;
  timeRange: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL';
  benchmarkSymbol?: string;
  className?: string;
}

const PerformanceAttribution: React.FC<PerformanceAttributionProps> = ({
  portfolioId,
  timeRange,
  benchmarkSymbol = 'BTC',
  className = ''
}) => {
  const [activeView, setActiveView] = useState<'assets' | 'sectors' | 'timeline' | 'factors'>('assets');
  const [sortBy, setSortBy] = useState<'contribution' | 'weight' | 'return'>('contribution');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for asset attribution
  const assetAttribution = useMemo<AssetAttribution[]>(() => [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      weight: 0.45,
      return: 0.127,
      contribution: 0.057,
      allocationEffect: 0.012,
      selectionEffect: 0.041,
      interactionEffect: 0.004,
      category: 'Cryptocurrency'
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      weight: 0.30,
      return: 0.089,
      contribution: 0.027,
      allocationEffect: 0.008,
      selectionEffect: 0.017,
      interactionEffect: 0.002,
      category: 'Cryptocurrency'
    },
    {
      symbol: 'SOL',
      name: 'Solana',
      weight: 0.12,
      return: 0.156,
      contribution: 0.019,
      allocationEffect: 0.005,
      selectionEffect: 0.012,
      interactionEffect: 0.002,
      category: 'Cryptocurrency'
    },
    {
      symbol: 'AAPL',
      name: 'Apple Inc',
      weight: 0.08,
      return: 0.034,
      contribution: 0.003,
      allocationEffect: -0.002,
      selectionEffect: 0.004,
      interactionEffect: 0.001,
      category: 'Technology'
    },
    {
      symbol: 'TSLA',
      name: 'Tesla Inc',
      weight: 0.05,
      return: -0.023,
      contribution: -0.001,
      allocationEffect: 0.001,
      selectionEffect: -0.002,
      interactionEffect: 0.000,
      category: 'Technology'
    }
  ], []);

  // Mock data for sector attribution
  const sectorAttribution = useMemo<SectorAttribution[]>(() => [
    {
      sector: 'Cryptocurrency',
      portfolioWeight: 0.87,
      benchmarkWeight: 1.0,
      portfolioReturn: 0.118,
      benchmarkReturn: 0.127,
      allocationEffect: -0.017,
      selectionEffect: -0.008,
      totalContribution: 0.103
    },
    {
      sector: 'Technology',
      portfolioWeight: 0.13,
      benchmarkWeight: 0.0,
      portfolioReturn: 0.018,
      benchmarkReturn: 0.0,
      allocationEffect: 0.013,
      selectionEffect: 0.002,
      totalContribution: 0.002
    }
  ], []);

  // Mock data for time-based attribution
  const timeBasedAttribution = useMemo<TimeBasedAttribution[]>(() => [
    {
      period: 'Q1 2024',
      date: '2024-03-31',
      totalReturn: 0.089,
      assetSelection: 0.045,
      assetAllocation: 0.023,
      interactionEffect: 0.008,
      timingEffect: 0.012,
      unexplained: 0.001
    },
    {
      period: 'Q2 2024',
      date: '2024-06-30',
      totalReturn: 0.034,
      assetSelection: 0.012,
      assetAllocation: 0.015,
      interactionEffect: 0.003,
      timingEffect: 0.004,
      unexplained: 0.000
    },
    {
      period: 'Q3 2024',
      date: '2024-09-30',
      totalReturn: -0.018,
      assetSelection: -0.012,
      assetAllocation: -0.008,
      interactionEffect: -0.002,
      timingEffect: 0.004,
      unexplained: 0.000
    },
    {
      period: 'Q4 2024',
      date: '2024-12-31',
      totalReturn: 0.067,
      assetSelection: 0.034,
      assetAllocation: 0.018,
      interactionEffect: 0.008,
      timingEffect: 0.007,
      unexplained: 0.000
    }
  ], []);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const totalReturn = assetAttribution.reduce((sum, asset) => sum + asset.contribution, 0);
    const allocationEffect = assetAttribution.reduce((sum, asset) => sum + asset.allocationEffect, 0);
    const selectionEffect = assetAttribution.reduce((sum, asset) => sum + asset.selectionEffect, 0);
    const interactionEffect = assetAttribution.reduce((sum, asset) => sum + asset.interactionEffect, 0);
    
    return {
      totalReturn,
      allocationEffect,
      selectionEffect,
      interactionEffect,
      explained: allocationEffect + selectionEffect + interactionEffect,
      unexplained: totalReturn - (allocationEffect + selectionEffect + interactionEffect)
    };
  }, [assetAttribution]);

  // Filter and sort data
  const filteredAssets = useMemo(() => {
    let filtered = assetAttribution;
    
    if (filterCategory !== 'all') {
      filtered = filtered.filter(asset => asset.category === filterCategory);
    }
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'contribution':
          return Math.abs(b.contribution) - Math.abs(a.contribution);
        case 'weight':
          return b.weight - a.weight;
        case 'return':
          return Math.abs(b.return) - Math.abs(a.return);
        default:
          return 0;
      }
    });
  }, [assetAttribution, filterCategory, sortBy]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(assetAttribution.map(asset => asset.category))];
    return ['all', ...cats];
  }, [assetAttribution]);

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

  // Get contribution bar width
  const getContributionBarWidth = (contribution: number): number => {
    const maxContribution = Math.max(...assetAttribution.map(a => Math.abs(a.contribution)));
    return Math.abs(contribution) / maxContribution * 100;
  };

  // Render assets view
  const renderAssetsView = () => (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            <option value="contribution">Sort by Contribution</option>
            <option value="weight">Sort by Weight</option>
            <option value="return">Sort by Return</option>
          </select>
        </div>
      </div>

      {/* Asset Attribution Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Asset-Level Attribution Analysis
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Return
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contribution
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Allocation Effect
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Selection Effect
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Interaction
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAssets.map((asset) => (
                <tr key={asset.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {asset.symbol}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {asset.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatNumber(asset.weight * 100, 1)}%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(asset.return)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm font-medium">
                        {formatPercentage(asset.contribution)}
                      </div>
                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 min-w-[60px]">
                        <div
                          className={`h-2 rounded-full ${
                            asset.contribution >= 0 ? 'bg-green-600' : 'bg-red-600'
                          }`}
                          style={{ width: `${getContributionBarWidth(asset.contribution)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(asset.allocationEffect)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(asset.selectionEffect)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(asset.interactionEffect)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render sectors view
  const renderSectorsView = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Sector Attribution Analysis
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Sector
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Portfolio Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Benchmark Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Portfolio Return
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Allocation Effect
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Selection Effect
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Contribution
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sectorAttribution.map((sector) => (
                <tr key={sector.sector} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {sector.sector}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatNumber(sector.portfolioWeight * 100, 1)}%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {formatNumber(sector.benchmarkWeight * 100, 1)}%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(sector.portfolioReturn)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(sector.allocationEffect)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(sector.selectionEffect)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    {formatPercentage(sector.totalContribution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render timeline view
  const renderTimelineView = () => (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Time-Based Attribution Analysis
        </h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Return
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Asset Selection
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Asset Allocation
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timing Effect
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Interaction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Unexplained
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {timeBasedAttribution.map((period) => (
                <tr key={period.period} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {period.period}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    {formatPercentage(period.totalReturn)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(period.assetSelection)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(period.assetAllocation)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(period.timingEffect)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {formatPercentage(period.interactionEffect)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatPercentage(period.unexplained)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render factors view
  const renderFactorsView = () => (
    <div className="space-y-6">
      {/* Attribution Breakdown Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Attribution Breakdown
        </h3>
        
        <div className="h-80 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <PieChart className="w-12 h-12 mx-auto mb-2" />
            <p>Attribution breakdown chart will be rendered here</p>
            <p className="text-sm">Integration with chart library needed</p>
          </div>
        </div>
      </div>

      {/* Factor Explanation */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center">
          <Info className="w-4 h-4 mr-2" />
          Attribution Factor Definitions
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800 dark:text-blue-200">
          <div>
            <h5 className="font-medium mb-2">Asset Allocation Effect</h5>
            <p>Impact of being over/underweight in assets relative to the benchmark</p>
          </div>
          
          <div>
            <h5 className="font-medium mb-2">Asset Selection Effect</h5>
            <p>Impact of choosing assets that outperform/underperform their benchmark</p>
          </div>
          
          <div>
            <h5 className="font-medium mb-2">Interaction Effect</h5>
            <p>Combined impact of allocation and selection decisions</p>
          </div>
          
          <div>
            <h5 className="font-medium mb-2">Timing Effect</h5>
            <p>Impact of when positions were entered or exited during the period</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className={`performance-attribution ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Calculating performance attribution...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`performance-attribution ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Performance Attribution Analysis
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Understand what drove your portfolio's performance relative to the benchmark
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Target className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Attribution</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatPercentage(summaryStats.totalReturn)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Portfolio contribution</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Allocation Effect</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatPercentage(summaryStats.allocationEffect)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Asset weighting impact</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Selection Effect</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatPercentage(summaryStats.selectionEffect)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Asset picking impact</div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-2">
            <Activity className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Explained</h3>
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {formatNumber(summaryStats.explained / summaryStats.totalReturn * 100, 1)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Of total return</div>
        </div>
      </div>

      {/* Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { id: 'assets', label: 'Assets', icon: DollarSign },
            { id: 'sectors', label: 'Sectors', icon: PieChart },
            { id: 'timeline', label: 'Timeline', icon: Calendar },
            { id: 'factors', label: 'Factors', icon: BarChart3 }
          ].map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeView === tab.id
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

      {/* Content */}
      <div className="tab-content">
        {activeView === 'assets' && renderAssetsView()}
        {activeView === 'sectors' && renderSectorsView()}
        {activeView === 'timeline' && renderTimelineView()}
        {activeView === 'factors' && renderFactorsView()}
      </div>
    </div>
  );
};

export default PerformanceAttribution;