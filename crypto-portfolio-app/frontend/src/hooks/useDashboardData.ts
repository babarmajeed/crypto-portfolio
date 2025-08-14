import { useState, useEffect } from 'react';
// import { api } from '../services/api'; // TODO: Uncomment when API service is implemented

export interface PortfolioData {
  totalValue: number;
  totalValue24hAgo: number;
  totalValueChange24h: number;
  totalValueChangePercentage24h: number;
  totalAssets: number;
  connectedExchanges: number;
  lastUpdated: string;
  volume24h: number;
  allocation: AllocationData[];
}

export interface AllocationData {
  symbol: string;
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface PerformanceData {
  '24h': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
  '7d': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
  '30d': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
  '1y': {
    pnl: number;
    pnlPercentage: number;
    bestPerformer: { symbol: string; change: number };
    worstPerformer: { symbol: string; change: number };
  };
}

export interface Transaction {
  id: string;
  type: 'BUY' | 'SELL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'STAKE' | 'UNSTAKE';
  symbol: string;
  amount: number;
  price: number;
  total: number;
  timestamp: string;
  exchange?: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
}

export const useDashboardData = () => {
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Mock data for development - replace with actual API calls
      const mockPortfolioData: PortfolioData = {
        totalValue: 25847.32,
        totalValue24hAgo: 24692.18,
        totalValueChange24h: 1155.14,
        totalValueChangePercentage24h: 4.68,
        totalAssets: 8,
        connectedExchanges: 3,
        lastUpdated: new Date().toISOString(),
        volume24h: 12458.67,
        allocation: [
          { symbol: 'BTC', name: 'Bitcoin', value: 15200.45, percentage: 58.8 },
          { symbol: 'ETH', name: 'Ethereum', value: 6850.22, percentage: 26.5 },
          { symbol: 'ADA', name: 'Cardano', value: 1250.80, percentage: 4.8 },
          { symbol: 'DOT', name: 'Polkadot', value: 1125.35, percentage: 4.4 },
          { symbol: 'LINK', name: 'Chainlink', value: 875.20, percentage: 3.4 },
          { symbol: 'UNI', name: 'Uniswap', value: 545.30, percentage: 2.1 }
        ]
      };

      const mockPerformanceData: PerformanceData = {
        '24h': {
          pnl: 1155.14,
          pnlPercentage: 4.68,
          bestPerformer: { symbol: 'ADA', change: 12.5 },
          worstPerformer: { symbol: 'LINK', change: -2.1 }
        },
        '7d': {
          pnl: 2847.92,
          pnlPercentage: 12.35,
          bestPerformer: { symbol: 'ETH', change: 18.7 },
          worstPerformer: { symbol: 'DOT', change: -5.2 }
        },
        '30d': {
          pnl: 4125.67,
          pnlPercentage: 19.05,
          bestPerformer: { symbol: 'BTC', change: 23.4 },
          worstPerformer: { symbol: 'UNI', change: -8.9 }
        },
        '1y': {
          pnl: 15847.32,
          pnlPercentage: 158.7,
          bestPerformer: { symbol: 'ETH', change: 245.6 },
          worstPerformer: { symbol: 'ADA', change: 45.2 }
        }
      };

      const mockTransactions: Transaction[] = [
        {
          id: '1',
          type: 'BUY',
          symbol: 'BTC',
          amount: 0.05,
          price: 42850.00,
          total: 2142.50,
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          exchange: 'Binance',
          status: 'COMPLETED'
        },
        {
          id: '2',
          type: 'SELL',
          symbol: 'ETH',
          amount: 2.5,
          price: 2650.00,
          total: 6625.00,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
          exchange: 'Coinbase',
          status: 'COMPLETED'
        },
        {
          id: '3',
          type: 'STAKE',
          symbol: 'ADA',
          amount: 1000,
          price: 0.48,
          total: 480.00,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
          exchange: 'Kraken',
          status: 'PENDING'
        },
        {
          id: '4',
          type: 'TRANSFER_IN',
          symbol: 'DOT',
          amount: 50,
          price: 6.75,
          total: 337.50,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
          exchange: 'External',
          status: 'COMPLETED'
        },
        {
          id: '5',
          type: 'BUY',
          symbol: 'LINK',
          amount: 75,
          price: 14.20,
          total: 1065.00,
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          exchange: 'Binance',
          status: 'COMPLETED'
        }
      ];

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      setPortfolioData(mockPortfolioData);
      setPerformanceData(mockPerformanceData);
      setRecentTransactions(mockTransactions);

      // In production, use actual API calls:
      // const [portfolio, performance, transactions] = await Promise.all([
      //   api.get('/portfolios/summary'),
      //   api.get('/portfolios/performance'),
      //   api.get('/transactions/recent?limit=10')
      // ]);
      // setPortfolioData(portfolio.data);
      // setPerformanceData(performance.data);
      // setRecentTransactions(transactions.data);

    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load dashboard data'));
    } finally {
      setIsLoading(false);
    }
  };

  const setupRealTimeUpdates = () => {
    // TODO: Implement WebSocket connection for real-time updates
    // const websocket = new WebSocket('ws://localhost:3001/ws');
    
    // websocket.onmessage = (event) => {
    //   const update = JSON.parse(event.data);
    //   if (update.type === 'portfolio_update') {
    //     setPortfolioData(prevData => ({
    //       ...prevData,
    //       ...update.data
    //     }));
    //   }
    // };

    // return () => {
    //   websocket.close();
    // };

    // For now, simulate real-time updates with periodic refreshes
    const interval = setInterval(() => {
      if (portfolioData) {
        // Simulate small price fluctuations
        const fluctuation = (Math.random() - 0.5) * 100; // Random change between -50 and +50
        const newTotalValue = portfolioData.totalValue + fluctuation;
        const change24h = newTotalValue - portfolioData.totalValue24hAgo;
        const changePercentage = (change24h / portfolioData.totalValue24hAgo) * 100;

        setPortfolioData(prev => prev ? {
          ...prev,
          totalValue: newTotalValue,
          totalValueChange24h: change24h,
          totalValueChangePercentage24h: changePercentage,
          lastUpdated: new Date().toISOString()
        } : null);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  };

  useEffect(() => {
    loadDashboardData();
    const cleanup = setupRealTimeUpdates();

    return cleanup;
  }, []);

  const refresh = () => {
    loadDashboardData();
  };

  return {
    portfolioData,
    performanceData,
    recentTransactions,
    isLoading,
    error,
    refresh
  };
};