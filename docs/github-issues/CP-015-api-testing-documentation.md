# CP-015: API Testing and Documentation

## Objective
Implement comprehensive API testing framework and create detailed API documentation with interactive examples, automated testing suites, and developer-friendly guides for all endpoints.

## Priority
High

## Category
Backend Quality Assurance

## Acceptance Criteria
- [ ] Comprehensive API documentation with OpenAPI/Swagger
- [ ] Interactive API explorer and testing interface
- [ ] Automated API testing suite with full coverage
- [ ] Performance testing for all endpoints
- [ ] Security testing and vulnerability assessment
- [ ] Mock API server for frontend development
- [ ] API versioning and backward compatibility testing
- [ ] Error response documentation and examples
- [ ] Rate limiting and authentication documentation
- [ ] Developer onboarding guides and tutorials

## Technical Implementation Details

### OpenAPI/Swagger Documentation
```javascript
// swagger/swagger.js
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Crypto Portfolio API',
      version: '1.0.0',
      description: 'Comprehensive API for managing cryptocurrency portfolios',
      contact: {
        name: 'API Support',
        email: 'api-support@cryptoportfolio.com',
        url: 'https://docs.cryptoportfolio.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'https://api.cryptoportfolio.com/v1',
        description: 'Production server'
      },
      {
        url: 'https://staging-api.cryptoportfolio.com/v1',
        description: 'Staging server'
      },
      {
        url: 'http://localhost:3000/api/v1',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        Portfolio: {
          type: 'object',
          required: ['name'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique portfolio identifier'
            },
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              description: 'Portfolio name'
            },
            description: {
              type: 'string',
              maxLength: 500,
              description: 'Portfolio description'
            },
            totalValue: {
              type: 'number',
              format: 'float',
              description: 'Total portfolio value in USD'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Portfolio creation timestamp'
            }
          },
          example: {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'My Crypto Portfolio',
            description: 'Long-term cryptocurrency investment portfolio',
            totalValue: 50000.00,
            createdAt: '2024-01-15T10:30:00Z'
          }
        },
        Transaction: {
          type: 'object',
          required: ['symbol', 'type', 'amount', 'price'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            symbol: {
              type: 'string',
              pattern: '^[A-Z]{2,10}$',
              description: 'Cryptocurrency symbol (e.g., BTC, ETH)'
            },
            type: {
              type: 'string',
              enum: ['buy', 'sell', 'transfer_in', 'transfer_out'],
              description: 'Transaction type'
            },
            amount: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Transaction amount'
            },
            price: {
              type: 'number',
              format: 'float',
              minimum: 0,
              description: 'Price per unit in USD'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Transaction timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type or code'
            },
            message: {
              type: 'string',
              description: 'Human-readable error message'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './models/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Crypto Portfolio API Documentation'
  })
};
```

### API Route Documentation
```javascript
// routes/portfolios.js
/**
 * @swagger
 * /portfolios:
 *   get:
 *     summary: Get user portfolios
 *     description: Retrieve all portfolios for the authenticated user
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of portfolios per page
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, totalValue, createdAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Portfolio'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/portfolios', authenticateUser, rateLimitMiddleware, portfolioController.getPortfolios);

/**
 * @swagger
 * /portfolios:
 *   post:
 *     summary: Create new portfolio
 *     description: Create a new portfolio for the authenticated user
 *     tags: [Portfolios]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "DeFi Investment Portfolio"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Portfolio focused on DeFi tokens and yield farming"
 *     responses:
 *       201:
 *         description: Portfolio created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Portfolio'
 *       400:
 *         description: Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "ValidationError"
 *               message: "Portfolio name is required"
 *               details:
 *                 field: "name"
 *                 code: "REQUIRED"
 */
router.post('/portfolios', authenticateUser, portfolioController.createPortfolio);
```

### Automated Testing Suite
```javascript
// tests/api/portfolios.test.js
const request = require('supertest');
const app = require('../../app');
const { User, Portfolio } = require('../../models');

describe('Portfolio API', () => {
  let authToken;
  let testUser;

  beforeAll(async () => {
    // Create test user and get auth token
    testUser = await User.create({
      email: 'test@example.com',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User'
    });

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'SecurePassword123!'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await User.destroy({ where: { email: 'test@example.com' } });
  });

  describe('GET /api/v1/portfolios', () => {
    test('should get user portfolios with authentication', async () => {
      const response = await request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/v1/portfolios')
        .expect(401);
    });

    test('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/portfolios?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    test('should support sorting parameters', async () => {
      await request(app)
        .get('/api/v1/portfolios?sortBy=name&sortOrder=asc')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });

  describe('POST /api/v1/portfolios', () => {
    test('should create portfolio with valid data', async () => {
      const portfolioData = {
        name: 'Test Portfolio',
        description: 'Test portfolio description'
      };

      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send(portfolioData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(portfolioData.name);
      expect(response.body.data.description).toBe(portfolioData.description);
      expect(response.body.data).toHaveProperty('id');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.message).toContain('name');
    });

    test('should validate field lengths', async () => {
      const longName = 'a'.repeat(101);
      
      const response = await request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: longName })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      // Make multiple requests to exceed rate limit
      const requests = Array(101).fill().map(() =>
        request(app)
          .get('/api/v1/portfolios')
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.allSettled(requests);
      const rateLimitedResponses = responses.filter(
        response => response.value?.status === 429
      );

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000);
  });
});
```

### Performance Testing
```javascript
// tests/performance/api.performance.test.js
const { performance } = require('perf_hooks');
const request = require('supertest');
const app = require('../../app');

describe('API Performance Tests', () => {
  let authToken;

  beforeAll(async () => {
    // Setup authentication
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'SecurePassword123!'
      });
    
    authToken = response.body.token;
  });

  test('GET /portfolios should respond within 500ms', async () => {
    const start = performance.now();
    
    await request(app)
      .get('/api/v1/portfolios')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    const end = performance.now();
    const responseTime = end - start;
    
    expect(responseTime).toBeLessThan(500);
  });

  test('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 50;
    const start = performance.now();
    
    const requests = Array(concurrentRequests).fill().map(() =>
      request(app)
        .get('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
    );
    
    const responses = await Promise.all(requests);
    const end = performance.now();
    
    // All requests should succeed
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    // Average response time should be reasonable
    const averageTime = (end - start) / concurrentRequests;
    expect(averageTime).toBeLessThan(1000);
  });

  test('should handle large datasets efficiently', async () => {
    // Create many portfolios for testing
    const portfolioPromises = Array(100).fill().map((_, index) =>
      request(app)
        .post('/api/v1/portfolios')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: `Portfolio ${index}` })
    );
    
    await Promise.all(portfolioPromises);
    
    const start = performance.now();
    
    const response = await request(app)
      .get('/api/v1/portfolios?limit=100')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);
    
    const end = performance.now();
    const responseTime = end - start;
    
    expect(response.body.data.length).toBe(100);
    expect(responseTime).toBeLessThan(2000); // 2 seconds for 100 items
  });
});
```

### Mock API Server
```javascript
// tests/mocks/mockServer.js
const express = require('express');
const cors = require('cors');

class MockAPIServer {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Mock authentication middleware
    this.app.use((req, res, next) => {
      const token = req.headers.authorization?.split(' ')[1];
      if (token === 'mock-token') {
        req.user = { id: 'mock-user-id', email: 'mock@example.com' };
      }
      next();
    });
  }

  setupRoutes() {
    // Mock portfolios endpoint
    this.app.get('/api/v1/portfolios', (req, res) => {
      res.json({
        data: [
          {
            id: 'portfolio-1',
            name: 'Mock Portfolio 1',
            description: 'Mock portfolio for testing',
            totalValue: 10000.00,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 'portfolio-2',
            name: 'Mock Portfolio 2',
            description: 'Another mock portfolio',
            totalValue: 25000.00,
            createdAt: '2024-01-02T00:00:00Z'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          pages: 1
        }
      });
    });

    // Mock portfolio creation
    this.app.post('/api/v1/portfolios', (req, res) => {
      const { name, description } = req.body;
      
      if (!name) {
        return res.status(400).json({
          error: 'ValidationError',
          message: 'Portfolio name is required'
        });
      }

      res.status(201).json({
        success: true,
        data: {
          id: `portfolio-${Date.now()}`,
          name,
          description,
          totalValue: 0,
          createdAt: new Date().toISOString()
        }
      });
    });

    // Mock prices endpoint
    this.app.get('/api/v1/prices/:symbol', (req, res) => {
      const { symbol } = req.params;
      
      res.json({
        symbol: symbol.toUpperCase(),
        price: Math.random() * 50000,
        change24h: (Math.random() - 0.5) * 10,
        timestamp: new Date().toISOString()
      });
    });
  }

  start(port = 3001) {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Mock API server running on port ${port}`);
        resolve();
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

module.exports = MockAPIServer;
```

## Required Technologies
- **Swagger/OpenAPI** - API documentation
- **Jest/Supertest** - API testing framework
- **Artillery/k6** - Performance testing
- **Express** - Mock server framework
- **swagger-jsdoc** - JSDoc to OpenAPI conversion
- **swagger-ui-express** - Interactive documentation

## Testing Requirements

### Test Coverage Goals
- **Unit Tests**: 90%+ coverage for all API endpoints
- **Integration Tests**: Full request/response cycle testing
- **Performance Tests**: Response time and throughput validation
- **Security Tests**: Authentication and authorization validation

### Test Categories
```javascript
// tests/api/index.test.js
describe('API Test Suite', () => {
  // Authentication tests
  require('./auth.test.js');
  
  // Portfolio management tests
  require('./portfolios.test.js');
  
  // Transaction tests
  require('./transactions.test.js');
  
  // Price data tests
  require('./prices.test.js');
  
  // User management tests
  require('./users.test.js');
  
  // Analytics tests
  require('./analytics.test.js');
});
```

## Dependencies
- CP-002: User Authentication and Authorization
- CP-003: Core API Development
- CP-012: API Rate Limiting and Throttling

## Documentation Structure

### API Documentation Sections
1. **Getting Started** - Authentication, base URLs, rate limits
2. **Authentication** - JWT tokens, API keys, security
3. **Endpoints** - Detailed endpoint documentation
4. **Data Models** - Schema definitions and examples
5. **Error Handling** - Error codes and troubleshooting
6. **SDKs and Libraries** - Client libraries and examples
7. **Webhooks** - Real-time event notifications
8. **Changelog** - API version history and updates

### Interactive Examples
- Live API testing interface
- Code samples in multiple languages
- Authentication flow demonstrations
- Real-time response previews

## Definition of Done
- [ ] Complete OpenAPI/Swagger documentation
- [ ] Interactive API explorer deployed
- [ ] Comprehensive automated test suite (90%+ coverage)
- [ ] Performance testing benchmarks established
- [ ] Security testing and vulnerability assessment completed
- [ ] Mock API server for development
- [ ] API versioning strategy implemented
- [ ] Error response documentation complete
- [ ] Developer onboarding guides created
- [ ] Documentation deployed and accessible
- [ ] All tests passing in CI/CD pipeline
- [ ] API monitoring and analytics active

## Estimated Time
**Beginner Developer**: 10-12 days
**Intermediate Developer**: 6-8 days
**Senior Developer**: 4-6 days

## Required Skills
- API documentation tools (Swagger/OpenAPI)
- Automated testing frameworks (Jest, Supertest)
- Performance testing tools and methodologies
- Security testing and vulnerability assessment
- Technical writing and documentation
- API design best practices
- Mock server development
- CI/CD pipeline integration

## Related Issues
- CP-002: User Authentication and Authorization
- CP-003: Core API Development
- CP-012: API Rate Limiting and Throttling
- CP-013: Logging, Monitoring and Analytics