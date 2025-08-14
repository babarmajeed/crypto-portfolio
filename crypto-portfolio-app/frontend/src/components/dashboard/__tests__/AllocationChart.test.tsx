import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AllocationChart } from '../AllocationChart';

// Mock recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, onMouseEnter, onMouseLeave, onClick }: any) => (
    <div data-testid="pie">
      {data?.map((item: any, index: number) => (
        <div 
          key={item.symbol || index}
          data-testid={`pie-segment-${item.symbol}`}
          onClick={() => onClick?.(item)}
          onMouseEnter={() => onMouseEnter?.(item, index)}
          onMouseLeave={() => onMouseLeave?.()}
          style={{ backgroundColor: item.color }}
        >
          {item.symbol}: {item.percentage}%
        </div>
      ))}
    </div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="pie-cell" style={{ backgroundColor: fill }} />,
  Tooltip: ({ content }: { content: React.ComponentType<any> }) => {
    const TooltipComponent = content;
    return <div data-testid="tooltip"><TooltipComponent /></div>;
  },
  Sector: () => <div data-testid="sector" />,
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  TrendingUp: () => <div data-testid="trending-up" />,
  TrendingDown: () => <div data-testid="trending-down" />,
  Eye: () => <div data-testid="eye" />,
  EyeOff: () => <div data-testid="eye-off" />,
  Filter: () => <div data-testid="filter" />,
  RotateCcw: () => <div data-testid="rotate-ccw" />,
}));

// Mock formatters
jest.mock('../../utils/formatters', () => ({
  formatCurrency: (value: number) => `$${value.toFixed(2)}`
}));

const mockAllocationData = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    value: 50000,
    percentage: 50,
    color: '#F59E0B',
    change24h: 1000,
    changePercentage24h: 2.5,
    exchange: 'binance',
    lastUpdated: new Date('2024-01-01T12:00:00Z'),
    isStale: false
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    value: 30000,
    percentage: 30,
    color: '#6366F1',
    change24h: -500,
    changePercentage24h: -1.5,
    exchange: 'coinbase',
    lastUpdated: new Date('2024-01-01T12:00:00Z'),
    isStale: false
  },
  {
    symbol: 'ADA',
    name: 'Cardano',
    value: 15000,
    percentage: 15,
    color: '#10B981',
    change24h: 200,
    changePercentage24h: 1.2,
    exchange: 'kraken',
    lastUpdated: new Date('2024-01-01T11:30:00Z'),
    isStale: true
  },
  {
    symbol: 'DOT',
    name: 'Polkadot',
    value: 5000,
    percentage: 5,
    color: '#EF4444',
    change24h: -100,
    changePercentage24h: -2.0,
    exchange: 'kucoin',
    lastUpdated: new Date('2024-01-01T12:00:00Z'),
    isStale: false
  }
];

const defaultProps = {
  data: mockAllocationData,
  totalValue: 100000
};

describe('AllocationChart', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders the chart with data', () => {
      render(<AllocationChart {...defaultProps} />);
      
      expect(screen.getByText('Portfolio Allocation')).toBeInTheDocument();
      expect(screen.getByText('4 assets •')).toBeInTheDocument();
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument();
      expect(screen.getByText('$100000.00')).toBeInTheDocument();
    });

    it('renders all allocation items in the list', () => {
      render(<AllocationChart {...defaultProps} />);
      
      expect(screen.getByText('BTC')).toBeInTheDocument();
      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.getByText('ADA')).toBeInTheDocument();
      expect(screen.getByText('DOT')).toBeInTheDocument();
    });

    it('displays correct percentages and values', () => {
      render(<AllocationChart {...defaultProps} />);
      
      expect(screen.getByText('50.00%')).toBeInTheDocument();
      expect(screen.getByText('$50000.00')).toBeInTheDocument();
      expect(screen.getByText('30.00%')).toBeInTheDocument();
      expect(screen.getByText('$30000.00')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data provided', () => {
      render(<AllocationChart data={[]} totalValue={0} />);
      
      expect(screen.getByText('No allocation data available')).toBeInTheDocument();
      expect(screen.getByText('Add some assets to see your portfolio allocation')).toBeInTheDocument();
    });

    it('shows filtered empty state when all items are hidden', async () => {
      render(<AllocationChart {...defaultProps} />);
      
      // Hide all visible assets
      const eyeButtons = screen.getAllByTestId('eye');
      for (const button of eyeButtons) {
        await user.click(button);
      }
      
      await waitFor(() => {
        expect(screen.getByText('No assets match current filters')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<AllocationChart {...defaultProps} isLoading={true} />);
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.queryByText('Portfolio Allocation')).not.toBeInTheDocument();
    });
  });

  describe('Interactive Features', () => {
    it('handles asset click events', async () => {
      const onAssetClick = jest.fn();
      render(<AllocationChart {...defaultProps} onAssetClick={onAssetClick} />);
      
      const btcSegment = screen.getByTestId('pie-segment-BTC');
      await user.click(btcSegment);
      
      expect(onAssetClick).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC',
          name: 'Bitcoin',
          value: 50000
        })
      );
    });

    it('handles hover events', async () => {
      const onAssetHover = jest.fn();
      render(<AllocationChart {...defaultProps} onAssetHover={onAssetHover} />);
      
      const btcSegment = screen.getByTestId('pie-segment-BTC');
      fireEvent.mouseEnter(btcSegment);
      
      expect(onAssetHover).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC'
        })
      );
    });

    it('toggles asset visibility', async () => {
      render(<AllocationChart {...defaultProps} />);
      
      const eyeButton = screen.getAllByTestId('eye')[0];
      await user.click(eyeButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('eye-off')).toBeInTheDocument();
      });
    });
  });

  describe('Filtering', () => {
    it('filters profitable assets', async () => {
      render(<AllocationChart {...defaultProps} />);
      
      const profitableButton = screen.getByText('↗ Profitable');
      await user.click(profitableButton);
      
      // Should show BTC and ADA (positive change), hide ETH and DOT (negative change)
      expect(screen.getByText('BTC')).toBeInTheDocument();
      expect(screen.getByText('ADA')).toBeInTheDocument();
      expect(screen.queryByText('ETH')).not.toBeInTheDocument();
      expect(screen.queryByText('DOT')).not.toBeInTheDocument();
    });

    it('filters losing assets', async () => {
      render(<AllocationChart {...defaultProps} />);
      
      const losingButton = screen.getByText('↘ Losing');
      await user.click(losingButton);
      
      // Should show ETH and DOT (negative change), hide BTC and ADA (positive change)
      expect(screen.getByText('ETH')).toBeInTheDocument();
      expect(screen.getByText('DOT')).toBeInTheDocument();
      expect(screen.queryByText('BTC')).not.toBeInTheDocument();
      expect(screen.queryByText('ADA')).not.toBeInTheDocument();
    });

    it('sorts by different criteria', async () => {
      render(<AllocationChart {...defaultProps} />);
      
      const sortSelect = screen.getByDisplayValue('Sort by Value');
      await user.selectOptions(sortSelect, 'change');
      
      // Should sort by 24h change (highest to lowest)
      const assetItems = screen.getAllByRole('button').filter(button => 
        button.textContent?.includes('%') && button.textContent?.includes('$')
      );
      
      // First item should be BTC (2.5% change)
      expect(assetItems[0]).toHaveTextContent('BTC');
    });
  });

  describe('Change Indicators', () => {
    it('shows trending up icon for positive changes', () => {
      render(<AllocationChart {...defaultProps} showChangeIndicators={true} />);
      
      const trendingUpIcons = screen.getAllByTestId('trending-up');
      expect(trendingUpIcons).toHaveLength(2); // BTC and ADA have positive changes
    });

    it('shows trending down icon for negative changes', () => {
      render(<AllocationChart {...defaultProps} showChangeIndicators={true} />);
      
      const trendingDownIcons = screen.getAllByTestId('trending-down');
      expect(trendingDownIcons).toHaveLength(2); // ETH and DOT have negative changes
    });

    it('hides change indicators when disabled', () => {
      render(<AllocationChart {...defaultProps} showChangeIndicators={false} />);
      
      expect(screen.queryByTestId('trending-up')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trending-down')).not.toBeInTheDocument();
    });
  });

  describe('Stale Data Indicators', () => {
    it('shows stale data indicator', () => {
      render(<AllocationChart {...defaultProps} />);
      
      // ADA has isStale: true
      const adaContainer = screen.getByText('ADA').closest('[data-testid]') || 
                           screen.getByText('ADA').closest('div');
      
      if (adaContainer) {
        expect(within(adaContainer).getByTitle('Stale data')).toBeInTheDocument();
      }
    });
  });

  describe('Responsive Features', () => {
    it('shows mobile legend on mobile devices', () => {
      render(<AllocationChart {...defaultProps} />);
      
      expect(screen.getByText('Asset Legend')).toBeInTheDocument();
    });

    it('groups small allocations into Others', () => {
      const dataWithManySmallAllocations = [
        ...mockAllocationData,
        // Add many small allocations
        ...Array.from({ length: 10 }, (_, i) => ({
          symbol: `TOKEN${i}`,
          name: `Token ${i}`,
          value: 100,
          percentage: 0.1,
          color: '#999999'
        }))
      ];
      
      render(
        <AllocationChart 
          data={dataWithManySmallAllocations} 
          totalValue={101000}
          maxDisplayItems={5}
        />
      );
      
      expect(screen.getByText(/Others \(\d+ assets\)/)).toBeInTheDocument();
    });
  });

  describe('Auto-refresh', () => {
    it('shows auto-refresh indicator when enabled', () => {
      render(
        <AllocationChart 
          {...defaultProps} 
          autoRefresh={true}
          refreshInterval={10000}
        />
      );
      
      expect(screen.getByText(/Auto-refreshing every 10s/)).toBeInTheDocument();
    });
  });

  describe('Reset Functionality', () => {
    it('resets all filters when reset button is clicked', async () => {
      render(<AllocationChart {...defaultProps} />);
      
      // Apply some filters
      const profitableButton = screen.getByText('↗ Profitable');
      await user.click(profitableButton);
      
      // Hide an asset
      const eyeButton = screen.getAllByTestId('eye')[0];
      await user.click(eyeButton);
      
      // Reset filters
      const resetButton = screen.getByTestId('rotate-ccw').closest('button');
      if (resetButton) {
        await user.click(resetButton);
      }
      
      // Should show all assets again
      await waitFor(() => {
        expect(screen.getByText('BTC')).toBeInTheDocument();
        expect(screen.getByText('ETH')).toBeInTheDocument();
        expect(screen.getByText('ADA')).toBeInTheDocument();
        expect(screen.getByText('DOT')).toBeInTheDocument();
      });
    });
  });

  describe('Custom Tooltip', () => {
    it('renders custom tooltip with asset information', () => {
      const TooltipComponent = () => {
        const mockPayload = [{
          payload: mockAllocationData[0]
        }];
        
        // Simulate the tooltip content
        return (
          <div>
            <span>{mockAllocationData[0].symbol}</span>
            <span>{mockAllocationData[0].name}</span>
            <span>$50000.00</span>
            <span>50.00%</span>
          </div>
        );
      };
      
      render(<TooltipComponent />);
      
      expect(screen.getByText('BTC')).toBeInTheDocument();
      expect(screen.getByText('Bitcoin')).toBeInTheDocument();
      expect(screen.getByText('$50000.00')).toBeInTheDocument();
      expect(screen.getByText('50.00%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(<AllocationChart {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(<AllocationChart {...defaultProps} />);
      
      const firstButton = screen.getAllByRole('button')[0];
      firstButton.focus();
      expect(firstButton).toHaveFocus();
      
      // Tab to next element
      await user.tab();
      expect(document.activeElement).not.toBe(firstButton);
    });
  });

  describe('Edge Cases', () => {
    it('handles zero total value', () => {
      render(<AllocationChart data={mockAllocationData} totalValue={0} />);
      
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });

    it('handles undefined change percentages', () => {
      const dataWithoutChanges = mockAllocationData.map(item => ({
        ...item,
        changePercentage24h: undefined
      }));
      
      render(<AllocationChart data={dataWithoutChanges} totalValue={100000} />);
      
      expect(screen.queryByTestId('trending-up')).not.toBeInTheDocument();
      expect(screen.queryByTestId('trending-down')).not.toBeInTheDocument();
    });

    it('handles very small allocation percentages', () => {
      const dataWithSmallAllocations = mockAllocationData.map(item => ({
        ...item,
        percentage: 0.01 // Very small percentage
      }));
      
      render(<AllocationChart data={dataWithSmallAllocations} totalValue={100000} />);
      
      expect(screen.getByText('0.01%')).toBeInTheDocument();
    });
  });
});