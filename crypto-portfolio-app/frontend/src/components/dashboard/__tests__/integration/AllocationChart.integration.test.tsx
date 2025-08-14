import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AllocationChart } from '../../AllocationChart';
import { usePortfolioAllocation } from '../../../hooks/usePortfolioAllocation';

// Mock the custom hook
jest.mock('../../../hooks/usePortfolioAllocation');
const mockUsePortfolioAllocation = usePortfolioAllocation as jest.MockedFunction<typeof usePortfolioAllocation>;

// Mock recharts and icons
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ data, onMouseEnter, onMouseLeave }: any) => (
    <div data-testid="pie">
      {data?.map((item: any, index: number) => (
        <div 
          key={item.symbol || index}
          data-testid={`pie-segment-${item.symbol}`}
          onMouseEnter={() => onMouseEnter?.(item, index)}
          onMouseLeave={() => onMouseLeave?.()}
        >
          {item.symbol}: {item.percentage}%
        </div>
      ))}
    </div>
  ),
  Cell: ({ fill }: { fill: string }) => <div data-testid="pie-cell" style={{ backgroundColor: fill }} />,
  Tooltip: () => <div data-testid="tooltip" />,
  Sector: () => <div data-testid="sector" />,
}));

jest.mock('lucide-react', () => ({
  TrendingUp: () => <div data-testid="trending-up" />,
  TrendingDown: () => <div data-testid="trending-down" />,
  Eye: () => <div data-testid="eye" />,
  EyeOff: () => <div data-testid="eye-off" />,
  RotateCcw: () => <div data-testid="rotate-ccw" />,
}));

jest.mock('../../../utils/formatters', () => ({
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
  }
];

// Component that integrates with the hook
const IntegratedAllocationChart: React.FC<{
  portfolioId: string;
  onAssetClick?: (asset: any) => void;
}> = ({ portfolioId, onAssetClick }) => {
  const {
    allocations,
    totalValue,
    isLoading,
    isError,
    error,
    refetch
  } = usePortfolioAllocation({ portfolioId });

  if (isError) {
    return (
      <div data-testid="error-state">
        <p>Error loading portfolio: {error?.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    );
  }

  return (
    <AllocationChart
      data={allocations}
      totalValue={totalValue}
      isLoading={isLoading}
      onAssetClick={onAssetClick}
      showChangeIndicators={true}
      autoRefresh={true}
      refreshInterval={30000}
    />
  );
};

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('AllocationChart Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  describe('Successful Data Loading', () => {
    beforeEach(() => {
      mockUsePortfolioAllocation.mockReturnValue({
        data: {
          allocations: mockAllocationData,
          totalValue: 95000,
          lastUpdated: new Date(),
          isRealTime: true
        },
        allocations: mockAllocationData,
        totalValue: 95000,
        isLoading: false,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: new Date(),
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });
    });

    it('loads and displays portfolio allocation data', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('Portfolio Allocation')).toBeInTheDocument();
        expect(screen.getByText('BTC')).toBeInTheDocument();
        expect(screen.getByText('ETH')).toBeInTheDocument();
        expect(screen.getByText('ADA')).toBeInTheDocument();
        expect(screen.getByText('$95000.00')).toBeInTheDocument();
      });
    });

    it('shows real-time indicator when auto-refresh is enabled', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        expect(screen.getByText(/Auto-refreshing every 30s/)).toBeInTheDocument();
      });
    });

    it('handles asset interactions', async () => {
      const onAssetClick = jest.fn();
      
      renderWithQueryClient(
        <IntegratedAllocationChart 
          portfolioId="test-portfolio-1" 
          onAssetClick={onAssetClick}
        />
      );

      await waitFor(() => {
        const btcSegment = screen.getByTestId('pie-segment-BTC');
        expect(btcSegment).toBeInTheDocument();
      });

      const assetItem = screen.getByText('BTC').closest('div');
      if (assetItem) {
        fireEvent.click(assetItem);
        await waitFor(() => {
          expect(onAssetClick).toHaveBeenCalledWith(
            expect.objectContaining({
              symbol: 'BTC',
              value: 50000
            })
          );
        });
      }
    });
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockUsePortfolioAllocation.mockReturnValue({
        data: undefined,
        allocations: [],
        totalValue: 0,
        isLoading: true,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: null,
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });
    });

    it('shows loading skeleton while data is being fetched', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.queryByText('Portfolio Allocation')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      mockUsePortfolioAllocation.mockReturnValue({
        data: undefined,
        allocations: [],
        totalValue: 0,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch portfolio data'),
        isStale: true,
        lastUpdated: null,
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });
    });

    it('shows error state when data loading fails', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      expect(screen.getByTestId('error-state')).toBeInTheDocument();
      expect(screen.getByText('Error loading portfolio: Failed to fetch portfolio data')).toBeInTheDocument();
    });

    it('allows retry on error', async () => {
      const mockRefetch = jest.fn().mockResolvedValue(undefined);
      mockUsePortfolioAllocation.mockReturnValue({
        data: undefined,
        allocations: [],
        totalValue: 0,
        isLoading: false,
        isError: true,
        error: new Error('Failed to fetch portfolio data'),
        isStale: true,
        lastUpdated: null,
        refetch: mockRefetch,
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });

      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      mockUsePortfolioAllocation.mockReturnValue({
        data: {
          allocations: [],
          totalValue: 0,
          lastUpdated: new Date(),
          isRealTime: false
        },
        allocations: [],
        totalValue: 0,
        isLoading: false,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: new Date(),
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });
    });

    it('shows empty state when no allocation data is available', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('No allocation data available')).toBeInTheDocument();
        expect(screen.getByText('Add some assets to see your portfolio allocation')).toBeInTheDocument();
      });
    });
  });

  describe('Stale Data Handling', () => {
    beforeEach(() => {
      const staleData = mockAllocationData.map(item => ({
        ...item,
        isStale: true,
        lastUpdated: new Date(Date.now() - 300000) // 5 minutes ago
      }));

      mockUsePortfolioAllocation.mockReturnValue({
        data: {
          allocations: staleData,
          totalValue: 95000,
          lastUpdated: new Date(Date.now() - 300000),
          isRealTime: false
        },
        allocations: staleData,
        totalValue: 95000,
        isLoading: false,
        isError: false,
        error: null,
        isStale: true,
        lastUpdated: new Date(Date.now() - 300000),
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });
    });

    it('shows stale data indicators', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        const staleIndicators = screen.getAllByTitle('Stale data');
        expect(staleIndicators.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Real-time Updates', () => {
    it('handles real-time data updates', async () => {
      let hookReturnValue = {
        data: {
          allocations: mockAllocationData,
          totalValue: 95000,
          lastUpdated: new Date(),
          isRealTime: true
        },
        allocations: mockAllocationData,
        totalValue: 95000,
        isLoading: false,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: new Date(),
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      };

      mockUsePortfolioAllocation.mockReturnValue(hookReturnValue);

      const { rerender } = renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('$95000.00')).toBeInTheDocument();
      });

      // Simulate real-time update with new data
      const updatedData = mockAllocationData.map(item => 
        item.symbol === 'BTC' 
          ? { ...item, value: 55000, percentage: 55 }
          : item
      );

      hookReturnValue = {
        ...hookReturnValue,
        allocations: updatedData,
        totalValue: 100000,
        data: {
          ...hookReturnValue.data!,
          allocations: updatedData,
          totalValue: 100000,
          lastUpdated: new Date()
        }
      };

      mockUsePortfolioAllocation.mockReturnValue(hookReturnValue);

      rerender(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('$100000.00')).toBeInTheDocument();
        expect(screen.getByText('55.00%')).toBeInTheDocument(); // Updated BTC percentage
      });
    });
  });

  describe('Performance with Large Datasets', () => {
    beforeEach(() => {
      // Create large dataset with many small allocations
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        symbol: `TOKEN${i}`,
        name: `Token ${i}`,
        value: 1000 - (i * 5), // Decreasing values
        percentage: (1000 - (i * 5)) / 50000, // Calculate percentage
        color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
        change24h: Math.random() * 200 - 100, // Random change
        changePercentage24h: Math.random() * 10 - 5, // Random percentage change
        exchange: ['binance', 'coinbase', 'kraken', 'kucoin'][i % 4],
        lastUpdated: new Date(),
        isStale: Math.random() > 0.8 // 20% chance of being stale
      }));

      mockUsePortfolioAllocation.mockReturnValue({
        data: {
          allocations: largeDataset,
          totalValue: 50000,
          lastUpdated: new Date(),
          isRealTime: true
        },
        allocations: largeDataset,
        totalValue: 50000,
        isLoading: false,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: new Date(),
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });
    });

    it('handles large datasets efficiently with grouping', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('Portfolio Allocation')).toBeInTheDocument();
        expect(screen.getByText('100 assets •')).toBeInTheDocument();
        
        // Should show "Others" grouping for assets beyond the display limit
        expect(screen.getByText(/Others \(\d+ assets\)/)).toBeInTheDocument();
      });
    });

    it('maintains performance with filtering on large datasets', async () => {
      renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="test-portfolio-1" />
      );

      await waitFor(() => {
        expect(screen.getByText('↗ Profitable')).toBeInTheDocument();
      });

      // Apply profitable filter
      const profitableButton = screen.getByText('↗ Profitable');
      await user.click(profitableButton);

      // Should still render efficiently even with filtering
      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Portfolio Support', () => {
    it('handles switching between different portfolios', async () => {
      const { rerender } = renderWithQueryClient(
        <IntegratedAllocationChart portfolioId="portfolio-1" />
      );

      // Mock data for first portfolio
      mockUsePortfolioAllocation.mockReturnValue({
        data: {
          allocations: mockAllocationData,
          totalValue: 95000,
          lastUpdated: new Date(),
          isRealTime: true
        },
        allocations: mockAllocationData,
        totalValue: 95000,
        isLoading: false,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: new Date(),
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });

      await waitFor(() => {
        expect(screen.getByText('$95000.00')).toBeInTheDocument();
      });

      // Switch to different portfolio with different data
      const differentData = [{
        symbol: 'DOGE',
        name: 'Dogecoin',
        value: 25000,
        percentage: 100,
        color: '#FFD700'
      }];

      mockUsePortfolioAllocation.mockReturnValue({
        data: {
          allocations: differentData,
          totalValue: 25000,
          lastUpdated: new Date(),
          isRealTime: true
        },
        allocations: differentData,
        totalValue: 25000,
        isLoading: false,
        isError: false,
        error: null,
        isStale: false,
        lastUpdated: new Date(),
        refetch: jest.fn().mockResolvedValue(undefined),
        enableRealTime: jest.fn(),
        disableRealTime: jest.fn()
      });

      rerender(<IntegratedAllocationChart portfolioId="portfolio-2" />);

      await waitFor(() => {
        expect(screen.getByText('DOGE')).toBeInTheDocument();
        expect(screen.getByText('$25000.00')).toBeInTheDocument();
        expect(screen.queryByText('BTC')).not.toBeInTheDocument();
      });
    });
  });
});