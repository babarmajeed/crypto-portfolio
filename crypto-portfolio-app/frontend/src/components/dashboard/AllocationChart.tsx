import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

interface AllocationData {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

interface AllocationChartProps {
  data: AllocationData[];
  totalValue: number;
}

const COLORS = [
  '#F59E0B', // Bitcoin orange
  '#6366F1', // Ethereum purple
  '#10B981', // Green
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6B7280', // Gray
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: data.color }}
          ></div>
          <span className="font-medium text-gray-900">{data.name}</span>
        </div>
        <div className="text-sm text-gray-600">
          <div>Symbol: {data.symbol}</div>
          <div>Value: {formatCurrency(data.value)}</div>
          <div>Allocation: {data.percentage.toFixed(2)}%</div>
        </div>
      </div>
    );
  }
  return null;
};

export const AllocationChart: React.FC<AllocationChartProps> = ({ data, totalValue }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-80">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Allocation</h3>
        <div className="flex items-center justify-center h-64 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-medium">No allocation data available</p>
            <p className="text-xs text-gray-400 mt-1">Add some assets to see your portfolio allocation</p>
          </div>
        </div>
      </div>
    );
  }

  // Add colors to data and sort by value
  const chartData = data
    .map((item, index) => ({
      ...item,
      color: item.color || COLORS[index % COLORS.length]
    }))
    .sort((a, b) => b.value - a.value);

  // Show top 8 assets and group others
  const topAssets = chartData.slice(0, 8);
  const otherAssets = chartData.slice(8);
  
  let finalData = [...topAssets];
  
  if (otherAssets.length > 0) {
    const othersValue = otherAssets.reduce((sum, asset) => sum + asset.value, 0);
    const othersPercentage = (othersValue / totalValue) * 100;
    
    finalData.push({
      symbol: 'OTHER',
      name: `Others (${otherAssets.length} assets)`,
      value: othersValue,
      percentage: othersPercentage,
      color: '#9CA3AF'
    });
  }

  return (
    <div className="h-96">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Portfolio Allocation</h3>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-80">
        {/* Pie Chart */}
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={finalData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                paddingAngle={2}
                dataKey="value"
              >
                {finalData.map((entry, entryIndex) => (
                  <Cell key={`cell-${entryIndex}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Asset List */}
        <div className="h-full overflow-y-auto">
          <div className="space-y-3">
            {finalData.map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0" 
                    style={{ backgroundColor: asset.color }}
                  ></div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{asset.symbol}</div>
                    <div className="text-sm text-gray-500 truncate">{asset.name}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-medium text-gray-900">{asset.percentage.toFixed(2)}%</div>
                  <div className="text-sm text-gray-500">{formatCurrency(asset.value)}</div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Total Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between font-medium text-gray-900">
              <span>Total Portfolio Value</span>
              <span>{formatCurrency(totalValue)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend for mobile */}
      <div className="mt-4 lg:hidden">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {finalData.slice(0, 6).map((asset) => (
            <div key={asset.symbol} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full flex-shrink-0" 
                style={{ backgroundColor: asset.color }}
              ></div>
              <span className="truncate">{asset.symbol}</span>
              <span className="text-gray-500">{asset.percentage.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};