import axios, { AxiosInstance } from 'axios';

interface TransactionQuery {
  startDate?: string;
  endDate?: string;
  type?: string;
  exchange?: string;
  asset?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

interface Transaction {
  id: string;
  timestamp: Date;
  type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out' | 'deposit' | 'withdrawal';
  asset: string;
  assetIcon?: string;
  quantity: number;
  price: number;
  total: number;
  fee?: number;
  feeCurrency?: string;
  feeRate?: number;
  exchange: string;
  exchangeIcon?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  orderId?: string;
  tradeId?: string;
  txHash?: string;
  notes?: string;
}

interface TransactionResponse {
  transactions: Transaction[];
  totalCount: number;
  hasMore: boolean;
}

class TransactionApi {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth token to requests if available
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get transactions with filters and pagination
   */
  async getTransactions(query: TransactionQuery = {}): Promise<TransactionResponse> {
    try {
      const response = await this.api.get('/transactions', { params: query });
      
      // Transform date strings to Date objects
      const transactions = response.data.transactions.map((tx: any) => ({
        ...tx,
        timestamp: new Date(tx.timestamp)
      }));

      return {
        transactions,
        totalCount: response.data.totalCount || transactions.length,
        hasMore: response.data.hasMore || false
      };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      // Return mock data for development
      return this.getMockTransactions(query);
    }
  }

  /**
   * Get a single transaction by ID
   */
  async getTransaction(id: string): Promise<Transaction> {
    try {
      const response = await this.api.get(`/transactions/${id}`);
      return {
        ...response.data,
        timestamp: new Date(response.data.timestamp)
      };
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw error;
    }
  }

  /**
   * Create a new transaction
   */
  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    try {
      const response = await this.api.post('/transactions', transaction);
      return {
        ...response.data,
        timestamp: new Date(response.data.timestamp)
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Update an existing transaction
   */
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    try {
      const response = await this.api.put(`/transactions/${id}`, updates);
      return {
        ...response.data,
        timestamp: new Date(response.data.timestamp)
      };
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    try {
      await this.api.delete(`/transactions/${id}`);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   */
  async getTransactionStats(period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<any> {
    try {
      const response = await this.api.get('/transactions/stats', { params: { period } });
      return response.data;
    } catch (error) {
      console.error('Error fetching transaction stats:', error);
      return {
        totalVolume: 0,
        totalTransactions: 0,
        avgTransactionSize: 0,
        topAssets: []
      };
    }
  }

  /**
   * Mock data for development
   */
  private getMockTransactions(query: TransactionQuery): TransactionResponse {
    const mockTransactions: Transaction[] = [
      {
        id: 'tx_001',
        timestamp: new Date('2024-01-15T10:30:00'),
        type: 'buy',
        asset: 'BTC',
        assetIcon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png',
        quantity: 0.5,
        price: 42000,
        total: 21000,
        fee: 21,
        feeCurrency: 'USD',
        feeRate: 0.1,
        exchange: 'binance',
        exchangeIcon: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png',
        status: 'completed',
        orderId: 'ORD123456',
        tradeId: 'TRD789012',
        notes: 'Monthly DCA purchase'
      },
      {
        id: 'tx_002',
        timestamp: new Date('2024-01-14T15:45:00'),
        type: 'sell',
        asset: 'ETH',
        assetIcon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
        quantity: 2,
        price: 2500,
        total: 5000,
        fee: 5,
        feeCurrency: 'USD',
        feeRate: 0.1,
        exchange: 'coinbase',
        exchangeIcon: 'https://cryptologos.cc/logos/coinbase-coin-logo.png',
        status: 'completed',
        orderId: 'ORD234567',
        notes: 'Taking profits'
      },
      {
        id: 'tx_003',
        timestamp: new Date('2024-01-13T09:00:00'),
        type: 'transfer_in',
        asset: 'USDT',
        assetIcon: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        quantity: 10000,
        price: 1,
        total: 10000,
        fee: 0,
        exchange: 'binance',
        exchangeIcon: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png',
        status: 'completed',
        txHash: '0x1234567890abcdef'
      },
      {
        id: 'tx_004',
        timestamp: new Date('2024-01-12T14:20:00'),
        type: 'buy',
        asset: 'ADA',
        assetIcon: 'https://cryptologos.cc/logos/cardano-ada-logo.png',
        quantity: 5000,
        price: 0.5,
        total: 2500,
        fee: 2.5,
        feeCurrency: 'USD',
        feeRate: 0.1,
        exchange: 'kraken',
        exchangeIcon: 'https://cryptologos.cc/logos/kraken-logo.png',
        status: 'completed',
        orderId: 'ORD345678'
      },
      {
        id: 'tx_005',
        timestamp: new Date('2024-01-11T11:00:00'),
        type: 'deposit',
        asset: 'USD',
        quantity: 5000,
        price: 1,
        total: 5000,
        fee: 0,
        exchange: 'coinbase',
        exchangeIcon: 'https://cryptologos.cc/logos/coinbase-coin-logo.png',
        status: 'completed'
      },
      {
        id: 'tx_006',
        timestamp: new Date('2024-01-10T16:30:00'),
        type: 'buy',
        asset: 'SOL',
        assetIcon: 'https://cryptologos.cc/logos/solana-sol-logo.png',
        quantity: 50,
        price: 100,
        total: 5000,
        fee: 5,
        feeCurrency: 'USD',
        feeRate: 0.1,
        exchange: 'binance',
        exchangeIcon: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png',
        status: 'pending',
        orderId: 'ORD456789'
      }
    ];

    // Apply filters
    let filteredTransactions = [...mockTransactions];

    if (query.type && query.type !== 'all') {
      filteredTransactions = filteredTransactions.filter(tx => tx.type === query.type);
    }

    if (query.exchange && query.exchange !== 'all') {
      filteredTransactions = filteredTransactions.filter(tx => tx.exchange === query.exchange);
    }

    if (query.asset && query.asset !== 'all') {
      filteredTransactions = filteredTransactions.filter(tx => 
        tx.asset.toLowerCase().includes(query.asset.toLowerCase())
      );
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredTransactions = filteredTransactions.filter(tx => 
        tx.id.toLowerCase().includes(searchLower) ||
        tx.asset.toLowerCase().includes(searchLower) ||
        tx.exchange.toLowerCase().includes(searchLower) ||
        tx.notes?.toLowerCase().includes(searchLower)
      );
    }

    // Apply sorting
    if (query.sortBy) {
      filteredTransactions.sort((a, b) => {
        const aValue = a[query.sortBy as keyof Transaction];
        const bValue = b[query.sortBy as keyof Transaction];
        
        if (aValue === undefined || bValue === undefined) return 0;
        
        if (query.sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });
    }

    return {
      transactions: filteredTransactions,
      totalCount: filteredTransactions.length,
      hasMore: false
    };
  }
}

export const transactionApi = new TransactionApi();
export type { Transaction, TransactionQuery, TransactionResponse };