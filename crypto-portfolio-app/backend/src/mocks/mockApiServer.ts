import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { faker } from '@faker-js/faker';
import { config } from '@/config/config';

/**
 * Mock API Server for Frontend Development
 * Provides realistic mock data and responses for all API endpoints
 */
export class MockApiServer {
  private app: Express;
  private mockDatabase: {
    users: any[];
    portfolios: any[];
    transactions: any[];
    apiKeys: any[];
    exchanges: any[];
    marketData: any[];
  };

  constructor() {
    this.app = express();
    this.mockDatabase = {
      users: [],
      portfolios: [],
      transactions: [],
      apiKeys: [],
      exchanges: [],
      marketData: []
    };
    
    this.initializeMockData();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Initialize mock data
   */
  private initializeMockData(): void {
    // Create mock users
    for (let i = 0; i < 10; i++) {
      this.mockDatabase.users.push(this.generateMockUser());
    }

    // Create mock portfolios
    for (let i = 0; i < 25; i++) {
      const userId = this.mockDatabase.users[i % this.mockDatabase.users.length].id;
      this.mockDatabase.portfolios.push(this.generateMockPortfolio(userId));
    }

    // Create mock transactions
    for (let i = 0; i < 100; i++) {
      const portfolioId = this.mockDatabase.portfolios[i % this.mockDatabase.portfolios.length].id;
      this.mockDatabase.transactions.push(this.generateMockTransaction(portfolioId));
    }

    // Create mock exchanges
    this.mockDatabase.exchanges = this.generateMockExchanges();

    // Create mock market data
    this.mockDatabase.marketData = this.generateMockMarketData();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors({
      origin: config.corsOrigins || ['http://localhost:3000', 'http://localhost:5173'],
      credentials: true
    }));
    
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Add delay middleware to simulate network latency
    this.app.use((req: Request, res: Response, next) => {
      const delay = parseInt(req.query.delay as string) || 100;
      setTimeout(next, Math.min(delay, 2000)); // Max 2 second delay
    });

    // Mock authentication middleware
    this.app.use('/api/v1', (req: Request, res: Response, next) => {
      if (req.path.includes('/auth/') || req.path === '/health') {
        return next();
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication token required'
        });
      }

      // Mock user extraction from token
      req.user = this.mockDatabase.users[0]; // Always use first user for simplicity
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/api/v1/health', this.handleHealthCheck.bind(this));

    // Authentication routes
    this.app.post('/api/v1/auth/login', this.handleLogin.bind(this));
    this.app.post('/api/v1/auth/register', this.handleRegister.bind(this));
    this.app.post('/api/v1/auth/logout', this.handleLogout.bind(this));
    this.app.post('/api/v1/auth/refresh', this.handleRefreshToken.bind(this));

    // User routes
    this.app.get('/api/v1/users/profile', this.handleGetProfile.bind(this));
    this.app.put('/api/v1/users/profile', this.handleUpdateProfile.bind(this));
    this.app.get('/api/v1/users/statistics', this.handleGetUserStatistics.bind(this));

    // Portfolio routes
    this.app.get('/api/v1/portfolios', this.handleGetPortfolios.bind(this));
    this.app.post('/api/v1/portfolios', this.handleCreatePortfolio.bind(this));
    this.app.get('/api/v1/portfolios/:id', this.handleGetPortfolio.bind(this));
    this.app.put('/api/v1/portfolios/:id', this.handleUpdatePortfolio.bind(this));
    this.app.delete('/api/v1/portfolios/:id', this.handleDeletePortfolio.bind(this));
    this.app.get('/api/v1/portfolios/:id/performance', this.handleGetPortfolioPerformance.bind(this));

    // Transaction routes
    this.app.get('/api/v1/portfolios/:portfolioId/transactions', this.handleGetTransactions.bind(this));
    this.app.post('/api/v1/portfolios/:portfolioId/transactions', this.handleCreateTransaction.bind(this));
    this.app.get('/api/v1/portfolios/:portfolioId/transactions/:id', this.handleGetTransaction.bind(this));
    this.app.put('/api/v1/portfolios/:portfolioId/transactions/:id', this.handleUpdateTransaction.bind(this));
    this.app.delete('/api/v1/portfolios/:portfolioId/transactions/:id', this.handleDeleteTransaction.bind(this));
    this.app.post('/api/v1/portfolios/:portfolioId/transactions/bulk', this.handleBulkCreateTransactions.bind(this));

    // Market data routes
    this.app.get('/api/v1/market/prices', this.handleGetPrices.bind(this));
    this.app.get('/api/v1/market/prices/:symbol', this.handleGetPrice.bind(this));

    // Exchange routes
    this.app.get('/api/v1/exchanges', this.handleGetExchanges.bind(this));
    this.app.get('/api/v1/exchanges/:id', this.handleGetExchange.bind(this));

    // API Key routes
    this.app.get('/api/v1/api-keys', this.handleGetApiKeys.bind(this));
    this.app.post('/api/v1/api-keys', this.handleCreateApiKey.bind(this));
    this.app.delete('/api/v1/api-keys/:id', this.handleDeleteApiKey.bind(this));

    // Error simulation routes
    this.app.get('/api/v1/mock/error/:code', this.handleErrorSimulation.bind(this));
  }

  /**
   * Generate mock data methods
   */
  private generateMockUser(): any {
    return {
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: faker.helpers.arrayElement(['BASIC', 'PREMIUM', 'ADMIN']),
      isEmailVerified: faker.datatype.boolean(0.8),
      twoFactorEnabled: faker.datatype.boolean(0.3),
      preferences: {
        currency: faker.helpers.arrayElement(['USD', 'EUR', 'GBP', 'CAD']),
        timezone: faker.location.timeZone(),
        notifications: {
          email: faker.datatype.boolean(0.7),
          push: faker.datatype.boolean(0.5),
          sms: faker.datatype.boolean(0.2)
        },
        privacy: {
          sharePortfolio: faker.datatype.boolean(0.3),
          analyticsOptOut: faker.datatype.boolean(0.1)
        }
      },
      createdAt: faker.date.past({ years: 2 }),
      updatedAt: faker.date.recent({ days: 30 })
    };
  }

  private generateMockPortfolio(userId: string): any {
    const totalValue = faker.number.float({ min: 1000, max: 1000000, fractionDigits: 2 });
    const totalReturn = faker.number.float({ min: -50000, max: 200000, fractionDigits: 2 });
    
    return {
      id: faker.string.uuid(),
      name: faker.company.name() + ' Portfolio',
      description: faker.lorem.sentence(),
      type: faker.helpers.arrayElement(['MANUAL', 'EXCHANGE_SYNC', 'TEMPLATE']),
      userId,
      exchangeId: faker.helpers.maybe(() => faker.helpers.arrayElement(['binance', 'coinbase', 'kraken']), { probability: 0.3 }),
      isDefault: faker.datatype.boolean(0.2),
      isActive: faker.datatype.boolean(0.9),
      totalValue,
      performance: {
        totalReturn,
        totalReturnPercentage: totalValue > 0 ? (totalReturn / totalValue) * 100 : 0,
        dayChange: faker.number.float({ min: -10000, max: 10000, fractionDigits: 2 }),
        dayChangePercentage: faker.number.float({ min: -10, max: 10, fractionDigits: 2 }),
        weekChange: faker.number.float({ min: -25000, max: 25000, fractionDigits: 2 }),
        monthChange: faker.number.float({ min: -50000, max: 50000, fractionDigits: 2 }),
        yearChange: faker.number.float({ min: -100000, max: 300000, fractionDigits: 2 })
      },
      assets: this.generatePortfolioAssets(),
      createdAt: faker.date.past({ years: 1 }),
      updatedAt: faker.date.recent({ days: 7 })
    };
  }

  private generatePortfolioAssets(): any[] {
    const symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI', 'AVAX', 'SOL'];
    const assetCount = faker.number.int({ min: 2, max: 6 });
    
    return faker.helpers.arrayElements(symbols, assetCount).map(symbol => ({
      symbol,
      name: this.getCryptoName(symbol),
      quantity: faker.number.float({ min: 0.01, max: 100, fractionDigits: 8 }),
      averagePrice: faker.number.float({ min: 0.1, max: 100000, fractionDigits: 2 }),
      currentPrice: faker.number.float({ min: 0.1, max: 100000, fractionDigits: 2 }),
      value: faker.number.float({ min: 100, max: 100000, fractionDigits: 2 }),
      allocation: faker.number.float({ min: 5, max: 40, fractionDigits: 1 }),
      change24h: faker.number.float({ min: -15, max: 15, fractionDigits: 2 })
    }));
  }

  private generateMockTransaction(portfolioId: string): any {
    const quantity = faker.number.float({ min: 0.01, max: 100, fractionDigits: 8 });
    const price = faker.number.float({ min: 0.1, max: 100000, fractionDigits: 2 });
    const fee = faker.number.float({ min: 0, max: 100, fractionDigits: 2 });

    return {
      id: faker.string.uuid(),
      portfolioId,
      type: faker.helpers.arrayElement(['BUY', 'SELL', 'TRANSFER', 'DIVIDEND']),
      symbol: faker.helpers.arrayElement(['BTC', 'ETH', 'ADA', 'DOT', 'LINK']),
      quantity,
      price,
      fee,
      total: (quantity * price) + fee,
      exchangeId: faker.helpers.maybe(() => faker.helpers.arrayElement(['binance', 'coinbase', 'kraken']), { probability: 0.7 }),
      externalId: faker.helpers.maybe(() => faker.string.alphanumeric(16), { probability: 0.5 }),
      notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }),
      executedAt: faker.date.recent({ days: 365 }),
      createdAt: faker.date.recent({ days: 365 }),
      updatedAt: faker.date.recent({ days: 30 })
    };
  }

  private generateMockExchanges(): any[] {
    return [
      {
        id: 'binance',
        name: 'Binance',
        displayName: 'Binance',
        isActive: true,
        supportedFeatures: ['trading', 'websocket', 'futures', 'margin'],
        rateLimits: { requests: 1200, orders: 100 },
        fees: { trading: 0.1, withdrawal: 0.0005 }
      },
      {
        id: 'coinbase',
        name: 'Coinbase Pro',
        displayName: 'Coinbase Pro',
        isActive: true,
        supportedFeatures: ['trading', 'websocket'],
        rateLimits: { requests: 10000, orders: 50 },
        fees: { trading: 0.5, withdrawal: 0.001 }
      },
      {
        id: 'kraken',
        name: 'Kraken',
        displayName: 'Kraken',
        isActive: true,
        supportedFeatures: ['trading', 'websocket', 'margin'],
        rateLimits: { requests: 60, orders: 20 },
        fees: { trading: 0.26, withdrawal: 0.0015 }
      }
    ];
  }

  private generateMockMarketData(): any[] {
    const symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK', 'UNI', 'AVAX', 'SOL', 'MATIC', 'ATOM'];
    
    return symbols.map(symbol => ({
      symbol,
      name: this.getCryptoName(symbol),
      price: faker.number.float({ min: 0.1, max: 100000, fractionDigits: 2 }),
      change24h: faker.number.float({ min: -20, max: 20, fractionDigits: 2 }),
      volume24h: faker.number.float({ min: 1000000, max: 50000000000, fractionDigits: 0 }),
      marketCap: faker.number.float({ min: 100000000, max: 1000000000000, fractionDigits: 0 }),
      rank: symbols.indexOf(symbol) + 1,
      lastUpdated: new Date()
    }));
  }

  private getCryptoName(symbol: string): string {
    const names: { [key: string]: string } = {
      BTC: 'Bitcoin',
      ETH: 'Ethereum',
      ADA: 'Cardano',
      DOT: 'Polkadot',
      LINK: 'Chainlink',
      UNI: 'Uniswap',
      AVAX: 'Avalanche',
      SOL: 'Solana',
      MATIC: 'Polygon',
      ATOM: 'Cosmos'
    };
    return names[symbol] || symbol;
  }

  /**
   * Route handlers
   */
  private handleHealthCheck(req: Request, res: Response): void {
    res.json({
      success: true,
      message: 'Mock API Server is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0-mock'
    });
  }

  private handleLogin(req: Request, res: Response): void {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'Email and password are required'
      });
    }

    // Simulate authentication
    const user = this.mockDatabase.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Invalid credentials'
      });
    }

    res.json({
      success: true,
      data: {
        user: { ...user, password: undefined },
        token: faker.string.alphanumeric(128),
        refreshToken: faker.string.alphanumeric(128),
        expiresIn: 900 // 15 minutes
      }
    });
  }

  private handleRegister(req: Request, res: Response): void {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        message: 'All fields are required'
      });
    }

    // Check if user exists
    if (this.mockDatabase.users.find(u => u.email === email)) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'Email already exists'
      });
    }

    const newUser = {
      ...this.generateMockUser(),
      email,
      firstName,
      lastName
    };

    this.mockDatabase.users.push(newUser);

    res.status(201).json({
      success: true,
      data: {
        user: { ...newUser, password: undefined },
        token: faker.string.alphanumeric(128),
        refreshToken: faker.string.alphanumeric(128)
      }
    });
  }

  private handleLogout(req: Request, res: Response): void {
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  }

  private handleRefreshToken(req: Request, res: Response): void {
    res.json({
      success: true,
      data: {
        token: faker.string.alphanumeric(128),
        refreshToken: faker.string.alphanumeric(128),
        expiresIn: 900
      }
    });
  }

  private handleGetProfile(req: Request, res: Response): void {
    const user = req.user;
    res.json({
      success: true,
      data: { ...user, password: undefined }
    });
  }

  private handleUpdateProfile(req: Request, res: Response): void {
    const user = req.user;
    const updates = req.body;
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    
    res.json({
      success: true,
      data: { ...updatedUser, password: undefined }
    });
  }

  private handleGetUserStatistics(req: Request, res: Response): void {
    res.json({
      success: true,
      data: {
        portfolios: {
          total: faker.number.int({ min: 1, max: 10 }),
          active: faker.number.int({ min: 1, max: 8 })
        },
        transactions: {
          total: faker.number.int({ min: 10, max: 1000 }),
          thisMonth: faker.number.int({ min: 0, max: 50 })
        },
        account: {
          createdAt: faker.date.past({ years: 2 }),
          lastLogin: faker.date.recent({ days: 1 }),
          loginCount: faker.number.int({ min: 10, max: 1000 })
        },
        security: {
          twoFactorEnabled: faker.datatype.boolean(0.3),
          activeSessions: faker.number.int({ min: 1, max: 5 }),
          lastPasswordChange: faker.date.recent({ days: 90 })
        }
      }
    });
  }

  private handleGetPortfolios(req: Request, res: Response): void {
    const userId = req.user.id;
    const userPortfolios = this.mockDatabase.portfolios.filter(p => p.userId === userId);
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    const paginatedPortfolios = userPortfolios.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: paginatedPortfolios,
      pagination: {
        page,
        limit,
        total: userPortfolios.length,
        pages: Math.ceil(userPortfolios.length / limit)
      }
    });
  }

  private handleCreatePortfolio(req: Request, res: Response): void {
    const userId = req.user.id;
    const portfolioData = req.body;
    
    const newPortfolio = {
      ...this.generateMockPortfolio(userId),
      ...portfolioData,
      id: faker.string.uuid(),
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.mockDatabase.portfolios.push(newPortfolio);
    
    res.status(201).json({
      success: true,
      data: newPortfolio
    });
  }

  private handleGetPortfolio(req: Request, res: Response): void {
    const { id } = req.params;
    const userId = req.user.id;
    
    const portfolio = this.mockDatabase.portfolios.find(p => p.id === id && p.userId === userId);
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Portfolio not found'
      });
    }
    
    res.json({
      success: true,
      data: portfolio
    });
  }

  private handleUpdatePortfolio(req: Request, res: Response): void {
    const { id } = req.params;
    const userId = req.user.id;
    const updates = req.body;
    
    const portfolioIndex = this.mockDatabase.portfolios.findIndex(p => p.id === id && p.userId === userId);
    
    if (portfolioIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Portfolio not found'
      });
    }
    
    this.mockDatabase.portfolios[portfolioIndex] = {
      ...this.mockDatabase.portfolios[portfolioIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    res.json({
      success: true,
      data: this.mockDatabase.portfolios[portfolioIndex]
    });
  }

  private handleDeletePortfolio(req: Request, res: Response): void {
    const { id } = req.params;
    const userId = req.user.id;
    
    const portfolioIndex = this.mockDatabase.portfolios.findIndex(p => p.id === id && p.userId === userId);
    
    if (portfolioIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Portfolio not found'
      });
    }
    
    this.mockDatabase.portfolios.splice(portfolioIndex, 1);
    
    res.status(204).send();
  }

  private handleGetPortfolioPerformance(req: Request, res: Response): void {
    const { id } = req.params;
    const period = req.query.period as string || '30d';
    
    const portfolio = this.mockDatabase.portfolios.find(p => p.id === id);
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Portfolio not found'
      });
    }
    
    res.json({
      success: true,
      data: {
        period,
        ...portfolio.performance,
        history: this.generatePerformanceHistory(period)
      }
    });
  }

  private generatePerformanceHistory(period: string): any[] {
    const days = period === '1d' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const history = [];
    
    for (let i = days; i >= 0; i--) {
      history.push({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        value: faker.number.float({ min: 50000, max: 150000, fractionDigits: 2 }),
        change: faker.number.float({ min: -5, max: 5, fractionDigits: 2 })
      });
    }
    
    return history;
  }

  private handleGetTransactions(req: Request, res: Response): void {
    const { portfolioId } = req.params;
    const transactions = this.mockDatabase.transactions.filter(t => t.portfolioId === portfolioId);
    
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    
    const paginatedTransactions = transactions.slice(offset, offset + limit);
    
    res.json({
      success: true,
      data: paginatedTransactions,
      pagination: {
        page,
        limit,
        total: transactions.length,
        pages: Math.ceil(transactions.length / limit)
      }
    });
  }

  private handleCreateTransaction(req: Request, res: Response): void {
    const { portfolioId } = req.params;
    const transactionData = req.body;
    
    const newTransaction = {
      ...this.generateMockTransaction(portfolioId),
      ...transactionData,
      id: faker.string.uuid(),
      portfolioId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.mockDatabase.transactions.push(newTransaction);
    
    res.status(201).json({
      success: true,
      data: newTransaction
    });
  }

  private handleGetTransaction(req: Request, res: Response): void {
    const { portfolioId, id } = req.params;
    
    const transaction = this.mockDatabase.transactions.find(t => t.id === id && t.portfolioId === portfolioId);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      data: transaction
    });
  }

  private handleUpdateTransaction(req: Request, res: Response): void {
    const { portfolioId, id } = req.params;
    const updates = req.body;
    
    const transactionIndex = this.mockDatabase.transactions.findIndex(t => t.id === id && t.portfolioId === portfolioId);
    
    if (transactionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Transaction not found'
      });
    }
    
    this.mockDatabase.transactions[transactionIndex] = {
      ...this.mockDatabase.transactions[transactionIndex],
      ...updates,
      updatedAt: new Date()
    };
    
    res.json({
      success: true,
      data: this.mockDatabase.transactions[transactionIndex]
    });
  }

  private handleDeleteTransaction(req: Request, res: Response): void {
    const { portfolioId, id } = req.params;
    
    const transactionIndex = this.mockDatabase.transactions.findIndex(t => t.id === id && t.portfolioId === portfolioId);
    
    if (transactionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Transaction not found'
      });
    }
    
    this.mockDatabase.transactions.splice(transactionIndex, 1);
    
    res.status(204).send();
  }

  private handleBulkCreateTransactions(req: Request, res: Response): void {
    const { portfolioId } = req.params;
    const { transactions } = req.body;
    
    const createdTransactions = transactions.map((tx: any) => ({
      ...this.generateMockTransaction(portfolioId),
      ...tx,
      id: faker.string.uuid(),
      portfolioId,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    this.mockDatabase.transactions.push(...createdTransactions);
    
    res.status(201).json({
      success: true,
      data: {
        created: createdTransactions.length,
        failed: 0,
        transactions: createdTransactions
      }
    });
  }

  private handleGetPrices(req: Request, res: Response): void {
    res.json({
      success: true,
      data: this.mockDatabase.marketData
    });
  }

  private handleGetPrice(req: Request, res: Response): void {
    const { symbol } = req.params;
    const price = this.mockDatabase.marketData.find(p => p.symbol === symbol.toUpperCase());
    
    if (!price) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Price data not found for symbol'
      });
    }
    
    res.json({
      success: true,
      data: price
    });
  }

  private handleGetExchanges(req: Request, res: Response): void {
    res.json({
      success: true,
      data: this.mockDatabase.exchanges
    });
  }

  private handleGetExchange(req: Request, res: Response): void {
    const { id } = req.params;
    const exchange = this.mockDatabase.exchanges.find(e => e.id === id);
    
    if (!exchange) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Exchange not found'
      });
    }
    
    res.json({
      success: true,
      data: exchange
    });
  }

  private handleGetApiKeys(req: Request, res: Response): void {
    const mockApiKeys = Array.from({ length: 3 }, () => ({
      id: faker.string.uuid(),
      name: faker.company.name() + ' API Key',
      exchangeId: faker.helpers.arrayElement(['binance', 'coinbase', 'kraken']),
      permissions: faker.helpers.arrayElements(['read', 'trade', 'withdraw'], { min: 1, max: 3 }),
      isActive: faker.datatype.boolean(0.8),
      lastUsed: faker.date.recent({ days: 30 }),
      createdAt: faker.date.past({ years: 1 })
    }));
    
    res.json({
      success: true,
      data: mockApiKeys
    });
  }

  private handleCreateApiKey(req: Request, res: Response): void {
    const keyData = req.body;
    
    const newApiKey = {
      id: faker.string.uuid(),
      ...keyData,
      isActive: true,
      lastUsed: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    res.status(201).json({
      success: true,
      data: newApiKey
    });
  }

  private handleDeleteApiKey(req: Request, res: Response): void {
    const { id } = req.params;
    
    res.status(204).send();
  }

  private handleErrorSimulation(req: Request, res: Response): void {
    const { code } = req.params;
    const statusCode = parseInt(code);
    
    const errorResponses: { [key: number]: any } = {
      400: { success: false, error: 'Bad Request', message: 'Invalid request data' },
      401: { success: false, error: 'Unauthorized', message: 'Authentication required' },
      403: { success: false, error: 'Forbidden', message: 'Access denied' },
      404: { success: false, error: 'Not Found', message: 'Resource not found' },
      429: { success: false, error: 'Rate Limit Exceeded', message: 'Too many requests' },
      500: { success: false, error: 'Internal Server Error', message: 'Server error occurred' },
      503: { success: false, error: 'Service Unavailable', message: 'Service temporarily unavailable' }
    };
    
    const errorResponse = errorResponses[statusCode] || errorResponses[500];
    res.status(statusCode).json(errorResponse);
  }

  /**
   * Start the mock server
   */
  public start(port: number = 3001): void {
    this.app.listen(port, () => {
      console.log(`🚀 Mock API Server running on port ${port}`);
      console.log(`📚 Mock endpoints available at http://localhost:${port}/api/v1`);
      console.log(`💾 Mock database contains:`);
      console.log(`   - ${this.mockDatabase.users.length} users`);
      console.log(`   - ${this.mockDatabase.portfolios.length} portfolios`);
      console.log(`   - ${this.mockDatabase.transactions.length} transactions`);
      console.log(`   - ${this.mockDatabase.exchanges.length} exchanges`);
      console.log(`   - ${this.mockDatabase.marketData.length} market data entries`);
    });
  }

  /**
   * Get the Express app instance
   */
  public getApp(): Express {
    return this.app;
  }

  /**
   * Reset mock database
   */
  public resetDatabase(): void {
    this.initializeMockData();
    console.log('Mock database reset');
  }

  /**
   * Add custom mock data
   */
  public addMockData(type: keyof typeof this.mockDatabase, data: any): void {
    this.mockDatabase[type].push(data);
  }

  /**
   * Get mock database
   */
  public getMockDatabase(): typeof this.mockDatabase {
    return this.mockDatabase;
  }
}

// Export singleton instance
export const mockApiServer = new MockApiServer();

// Export for use in tests
export default MockApiServer;