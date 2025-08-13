# CP-061: Unit Testing Framework Setup

## 📋 Issue Type
**Infrastructure** - Testing Foundation

## 🎯 Objective
Establish comprehensive unit testing frameworks for both frontend and backend components with proper mocking, coverage reporting, and continuous integration integration.

## 📝 Description
Set up robust testing infrastructure that enables developers to write reliable unit tests for all components. This includes configuring testing frameworks, establishing testing patterns, setting up mocking strategies, and implementing automated test execution in the CI/CD pipeline.

## ✅ Acceptance Criteria

### Backend Testing Setup (Node.js/TypeScript)
- [ ] Jest testing framework configuration with TypeScript support
- [ ] Supertest for API endpoint testing
- [ ] Database testing with test database isolation
- [ ] Mocking strategies for external services (Redis, exchanges)
- [ ] Test coverage reporting with Istanbul
- [ ] Custom test utilities and helpers
- [ ] Environment-specific test configurations

### Frontend Testing Setup (React/TypeScript)
- [ ] Jest configuration for React components
- [ ] React Testing Library for component testing
- [ ] Mock Service Worker (MSW) for API mocking
- [ ] User event simulation and interaction testing
- [ ] Custom render utilities with providers
- [ ] Snapshot testing for UI components
- [ ] Visual regression testing setup

### Testing Infrastructure
- [ ] Test database seeding and cleanup utilities
- [ ] Factory patterns for test data generation
- [ ] Shared testing utilities and matchers
- [ ] Test configuration management
- [ ] Parallel test execution optimization
- [ ] Test result reporting and analysis
- [ ] CI/CD integration with test automation

### Code Coverage and Quality
- [ ] Code coverage thresholds (minimum 80%)
- [ ] Coverage reporting for frontend and backend
- [ ] Uncovered code identification and tracking
- [ ] Test quality metrics and analysis
- [ ] Performance testing for critical functions
- [ ] Memory leak detection in tests
- [ ] Test execution time monitoring

## 🛠️ Technical Implementation

### Backend Jest Configuration
```typescript
// jest.config.js (Backend)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/migrations/**',
    '!src/seeds/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  testTimeout: 10000,
  maxWorkers: '50%'
};
```

### Test Setup and Utilities
```typescript
// tests/setup.ts
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { server } from '@tests/mocks/server';

// Setup MSW server
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Database cleanup
beforeEach(async () => {
  await cleanupDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.disconnect();
});

// Global test utilities
global.testUtils = {
  cleanupDatabase,
  createTestUser,
  createTestPortfolio,
  createTestTransaction
};

// Extend Jest matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass
    };
  },
  
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be within range ${floor} - ${ceiling}`,
      pass
    };
  }
});
```

### Database Testing Utilities
```typescript
// tests/utils/database.utils.ts
import { prisma } from '@/lib/prisma';
import { User, Portfolio, Transaction } from '@prisma/client';

export async function cleanupDatabase(): Promise<void> {
  // Delete in correct order to respect foreign key constraints
  await prisma.transaction.deleteMany();
  await prisma.portfolio.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();
  
  // Reset sequences if using PostgreSQL
  if (process.env.DATABASE_URL?.includes('postgresql')) {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
  }
}

export async function createTestUser(overrides: Partial<User> = {}): Promise<User> {
  return prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash: '$2b$12$hashedpassword',
      emailVerified: true,
      role: 'basic',
      ...overrides
    }
  });
}

export async function createTestPortfolio(
  userId: string, 
  overrides: Partial<Portfolio> = {}
): Promise<Portfolio> {
  return prisma.portfolio.create({
    data: {
      userId,
      name: 'Test Portfolio',
      type: 'main',
      ...overrides
    }
  });
}

export async function createTestTransaction(
  portfolioId: string,
  overrides: Partial<Transaction> = {}
): Promise<Transaction> {
  return prisma.transaction.create({
    data: {
      portfolioId,
      type: 'buy',
      symbol: 'BTC',
      quantity: 1.0,
      price: 50000,
      executedAt: new Date(),
      ...overrides
    }
  });
}

// Factory pattern for test data
export class TestDataFactory {
  static user(overrides: Partial<User> = {}) {
    return {
      email: `test-${Date.now()}@example.com`,
      passwordHash: '$2b$12$hashedpassword',
      emailVerified: true,
      role: 'basic' as const,
      ...overrides
    };
  }

  static portfolio(userId: string, overrides: Partial<Portfolio> = {}) {
    return {
      userId,
      name: `Test Portfolio ${Date.now()}`,
      type: 'main' as const,
      ...overrides
    };
  }

  static transaction(portfolioId: string, overrides: Partial<Transaction> = {}) {
    return {
      portfolioId,
      type: 'buy' as const,
      symbol: 'BTC',
      quantity: Math.random() * 10,
      price: 40000 + Math.random() * 20000,
      executedAt: new Date(),
      ...overrides
    };
  }
}
```

### API Testing Examples
```typescript
// tests/api/auth.test.ts
import request from 'supertest';
import { app } from '@/app';
import { createTestUser } from '@tests/utils/database.utils';

describe('Authentication API', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      // Arrange
      const user = await createTestUser({
        email: 'test@example.com',
        passwordHash: '$2b$12$...' // properly hashed password
      });

      // Act
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'validpassword'
        });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.user.passwordHash).toBeUndefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid credentials');
    });

    it('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'invalid-email',
          password: 'password'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid email format');
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register new user successfully', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        terms: true
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should prevent duplicate email registration', async () => {
      await createTestUser({ email: 'existing@example.com' });

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'SecurePass123!',
          firstName: 'John',
          lastName: 'Doe',
          terms: true
        });

      expect(response.status).toBe(409);
      expect(response.body.error.message).toContain('Email already exists');
    });
  });
});
```

### Service Testing Examples
```typescript
// tests/services/portfolio.service.test.ts
import { PortfolioService } from '@/services/portfolio.service';
import { PriceService } from '@/services/price.service';
import { createTestUser, createTestPortfolio, createTestTransaction } from '@tests/utils/database.utils';

// Mock external dependencies
jest.mock('@/services/price.service');
const mockPriceService = PriceService as jest.Mocked<typeof PriceService>;

describe('PortfolioService', () => {
  let portfolioService: PortfolioService;
  let testUser: any;
  let testPortfolio: any;

  beforeEach(async () => {
    portfolioService = new PortfolioService();
    testUser = await createTestUser();
    testPortfolio = await createTestPortfolio(testUser.id);
  });

  describe('calculatePortfolioValue', () => {
    it('should calculate portfolio value correctly', async () => {
      // Arrange
      await createTestTransaction(testPortfolio.id, {
        type: 'buy',
        symbol: 'BTC',
        quantity: 1.0,
        price: 40000
      });

      await createTestTransaction(testPortfolio.id, {
        type: 'buy',
        symbol: 'ETH',
        quantity: 10.0,
        price: 3000
      });

      mockPriceService.getCurrentPrice.mockImplementation(async (symbol) => {
        const prices = { BTC: 45000, ETH: 3200 };
        return prices[symbol] || 0;
      });

      // Act
      const result = await portfolioService.calculatePortfolioValue(testPortfolio.id);

      // Assert
      expect(result.totalValue).toBe(77000); // (1 * 45000) + (10 * 3200)
      expect(result.totalCost).toBe(70000);  // (1 * 40000) + (10 * 3000)
      expect(result.unrealizedPnL).toBe(7000);
      expect(result.pnlPercentage).toBeWithinRange(9.99, 10.01); // ~10%
    });

    it('should handle empty portfolio', async () => {
      const result = await portfolioService.calculatePortfolioValue(testPortfolio.id);

      expect(result.totalValue).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.unrealizedPnL).toBe(0);
      expect(result.pnlPercentage).toBe(0);
    });

    it('should throw error for non-existent portfolio', async () => {
      const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(
        portfolioService.calculatePortfolioValue(nonExistentId)
      ).rejects.toThrow('Portfolio not found');
    });
  });

  describe('getPortfolioPerformance', () => {
    it('should calculate performance metrics', async () => {
      // Create transactions over time
      const baseDate = new Date('2024-01-01');
      
      await createTestTransaction(testPortfolio.id, {
        symbol: 'BTC',
        quantity: 1.0,
        price: 40000,
        executedAt: baseDate
      });

      await createTestTransaction(testPortfolio.id, {
        symbol: 'BTC',
        quantity: 0.5,
        price: 42000,
        executedAt: new Date(baseDate.getTime() + 24 * 60 * 60 * 1000)
      });

      const performance = await portfolioService.getPortfolioPerformance(
        testPortfolio.id,
        '30d'
      );

      expect(performance.returnPercentage).toBeGreaterThan(0);
      expect(performance.volatility).toBeGreaterThanOrEqual(0);
      expect(performance.sharpeRatio).toBeDefined();
      expect(performance.maxDrawdown).toBeLessThanOrEqual(0);
    });
  });
});
```

### Frontend Testing Configuration
```typescript
// frontend/jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/src/tests/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  }
};

// src/tests/setup.ts
import '@testing-library/jest-dom';
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));
```

### Frontend Component Testing
```typescript
// src/tests/components/Dashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from '@/components/Dashboard/Dashboard';
import { renderWithProviders } from '@tests/utils/test-utils';

describe('Dashboard Component', () => {
  it('should render portfolio summary', async () => {
    renderWithProviders(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Total Portfolio Value')).toBeInTheDocument();
    });

    expect(screen.getByText(/\$[\d,]+\.\d{2}/)).toBeInTheDocument();
  });

  it('should handle time range selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    const sevenDayButton = screen.getByText('7D');
    await user.click(sevenDayButton);

    expect(sevenDayButton).toHaveClass('bg-blue-500');
  });

  it('should display loading state', () => {
    renderWithProviders(<Dashboard />, {
      preloadedState: {
        portfolio: { loading: true }
      }
    });

    expect(screen.getByTestId('portfolio-skeleton')).toBeInTheDocument();
  });

  it('should handle error state', () => {
    renderWithProviders(<Dashboard />, {
      preloadedState: {
        portfolio: { 
          loading: false, 
          error: 'Failed to load portfolio data' 
        }
      }
    });

    expect(screen.getByText('Failed to load portfolio data')).toBeInTheDocument();
  });
});
```

### Test Utilities
```typescript
// src/tests/utils/test-utils.tsx
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { store } from '@/store';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: any;
  store?: any;
}

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
};

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Mock data generators
export const mockPortfolioData = {
  summary: {
    totalValue: 125000,
    change24h: 2500,
    changePercent24h: 2.04,
    totalPnL: 25000,
    totalPnLPercent: 25.0,
    assetsCount: 8,
    exchangesCount: 3
  }
};

export const mockMarketData = {
  totalMarketCap: 2500000000000,
  btcDominance: 42.5,
  fearGreedIndex: 65,
  trending: [
    { symbol: 'BTC', name: 'Bitcoin', price: 45000, change24h: 2.5, marketCap: 850000000000 }
  ]
};
```

## 🧪 Testing Best Practices

### Test Organization
- **Arrange-Act-Assert**: Structure all tests clearly
- **One Assertion Per Test**: Focus on single behavior
- **Descriptive Test Names**: Clearly state what is being tested
- **Test Data Isolation**: Each test should be independent

### Mocking Strategies
- **Mock External Services**: APIs, databases, file systems
- **Mock Time-Dependent Code**: Use Jest fake timers
- **Mock Heavy Computations**: Avoid slow tests
- **Spy on Internal Methods**: Verify interactions

### Coverage Goals
- **Statements**: 80% minimum
- **Branches**: 80% minimum
- **Functions**: 80% minimum
- **Lines**: 80% minimum

## 🔗 Dependencies
- **Depends on**: CP-001 (Project Setup), CP-006 (API Foundation)
- **Blocks**: CP-062 (Integration Testing), CP-063 (E2E Testing)

## 🎯 Definition of Done
- [ ] Jest configured for both frontend and backend
- [ ] Test utilities and helpers implemented
- [ ] Database testing setup with isolation
- [ ] Mocking strategies established
- [ ] Coverage reporting functional
- [ ] CI/CD integration complete
- [ ] Documentation and examples provided
- [ ] Coverage thresholds met

## 📚 Resources
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## 🏷️ Labels
`testing`, `jest`, `unit-tests`, `infrastructure`, `quality-assurance`

## ⏱️ Estimated Time
**16-24 hours** for experienced testing engineer

## 👥 Assignee
Requires developer with:
- Strong testing framework experience
- Jest and React Testing Library expertise
- Test-driven development knowledge
- CI/CD integration experience

---
*Good tests are the foundation of reliable software. Invest in comprehensive testing infrastructure.*