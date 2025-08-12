# CP-006: Backend API Foundation and Routing

## 📋 Issue Type
**Epic** - Backend Infrastructure

## 🎯 Objective
Establish a robust, scalable REST API foundation with proper routing, middleware, validation, error handling, and documentation for the crypto portfolio application.

## 📝 Description
Build a comprehensive backend API infrastructure that follows REST principles, implements proper security middleware, provides comprehensive validation, and includes auto-generated documentation. This foundation will support all portfolio management, exchange integration, and user management features.

## ✅ Acceptance Criteria

### Core API Infrastructure
- [ ] Express.js server with TypeScript configuration
- [ ] Structured routing with modular controllers
- [ ] Comprehensive middleware stack (security, CORS, parsing)
- [ ] Request/response validation with Zod schemas
- [ ] Centralized error handling and logging
- [ ] API versioning strategy implementation
- [ ] Health check and monitoring endpoints

### Security Middleware
- [ ] JWT authentication middleware
- [ ] Role-based authorization middleware  
- [ ] Rate limiting per endpoint and user
- [ ] Request sanitization and validation
- [ ] CORS configuration for frontend domains
- [ ] Security headers (Helmet.js integration)
- [ ] Request/response compression

### Documentation and Testing
- [ ] OpenAPI/Swagger documentation generation
- [ ] Interactive API explorer (Swagger UI)
- [ ] Automated API testing with Supertest
- [ ] Request/response schema validation
- [ ] API performance monitoring
- [ ] Error response standardization

## 🛠️ Technical Architecture

### Project Structure
```
backend/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── users.controller.ts
│   │   ├── portfolios.controller.ts
│   │   ├── exchanges.controller.ts
│   │   └── analytics.controller.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validation.middleware.ts
│   │   ├── error.middleware.ts
│   │   ├── logging.middleware.ts
│   │   └── security.middleware.ts
│   ├── routes/
│   │   ├── v1/
│   │   │   ├── auth.routes.ts
│   │   │   ├── users.routes.ts
│   │   │   ├── portfolios.routes.ts
│   │   │   ├── exchanges.routes.ts
│   │   │   └── analytics.routes.ts
│   │   └── index.ts
│   ├── schemas/
│   │   ├── auth.schema.ts
│   │   ├── user.schema.ts
│   │   ├── portfolio.schema.ts
│   │   └── common.schema.ts
│   ├── services/
│   ├── utils/
│   ├── types/
│   └── app.ts
├── tests/
├── docs/
└── package.json
```

### Core API Routes Structure
```typescript
// Main API routes structure
const apiRoutes = {
  // Authentication routes
  'POST /api/v1/auth/login': 'Login user',
  'POST /api/v1/auth/register': 'Register new user',
  'POST /api/v1/auth/refresh': 'Refresh JWT token',
  'POST /api/v1/auth/logout': 'Logout user',
  'POST /api/v1/auth/forgot-password': 'Request password reset',
  'POST /api/v1/auth/reset-password': 'Reset password',
  
  // User management routes
  'GET /api/v1/users/profile': 'Get user profile',
  'PUT /api/v1/users/profile': 'Update user profile',
  'GET /api/v1/users/preferences': 'Get user preferences',
  'PUT /api/v1/users/preferences': 'Update preferences',
  'DELETE /api/v1/users/account': 'Delete user account',
  
  // Portfolio management routes
  'GET /api/v1/portfolios': 'List user portfolios',
  'POST /api/v1/portfolios': 'Create new portfolio',
  'GET /api/v1/portfolios/:id': 'Get portfolio details',
  'PUT /api/v1/portfolios/:id': 'Update portfolio',
  'DELETE /api/v1/portfolios/:id': 'Delete portfolio',
  'GET /api/v1/portfolios/:id/holdings': 'Get portfolio holdings',
  'GET /api/v1/portfolios/:id/performance': 'Get portfolio performance',
  
  // Exchange integration routes
  'GET /api/v1/exchanges': 'List supported exchanges',
  'POST /api/v1/exchanges/credentials': 'Add exchange credentials',
  'GET /api/v1/exchanges/credentials': 'List user exchange credentials',
  'PUT /api/v1/exchanges/credentials/:id': 'Update credentials',
  'DELETE /api/v1/exchanges/credentials/:id': 'Remove credentials',
  'POST /api/v1/exchanges/sync': 'Sync exchange data',
  
  // Market data routes
  'GET /api/v1/market/prices': 'Get current prices',
  'GET /api/v1/market/history/:symbol': 'Get price history',
  'GET /api/v1/market/trending': 'Get trending cryptocurrencies',
  
  // Analytics routes
  'GET /api/v1/analytics/portfolio/:id/summary': 'Portfolio summary',
  'GET /api/v1/analytics/portfolio/:id/performance': 'Performance metrics',
  'GET /api/v1/analytics/portfolio/:id/allocation': 'Asset allocation',
  'GET /api/v1/analytics/portfolio/:id/pnl': 'Profit/Loss analysis'
};
```

### Express App Configuration
```typescript
// app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';
import { validateRequest } from './middleware/validation.middleware';
import { authenticateToken } from './middleware/auth.middleware';
import routes from './routes';

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing and compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Logging middleware
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api', routes);

// Error handling middleware
app.use(errorHandler);

export default app;
```

### Validation Schemas with Zod
```typescript
// schemas/auth.schema.ts
import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    rememberMe: z.boolean().optional()
  })
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
        'Password must contain uppercase, lowercase, number and special character'),
    firstName: z.string().min(1, 'First name is required').max(50),
    lastName: z.string().min(1, 'Last name is required').max(50),
    terms: z.boolean().refine(val => val === true, 'Terms must be accepted')
  })
});

// schemas/portfolio.schema.ts
export const createPortfolioSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Portfolio name is required').max(200),
    description: z.string().max(1000).optional(),
    type: z.enum(['main', 'trading', 'savings', 'defi']).default('main'),
    baseCurrency: z.string().length(3, 'Base currency must be 3 characters')
  })
});

export const portfolioQuerySchema = z.object({
  query: z.object({
    page: z.string().transform(Number).pipe(z.number().min(1)).default('1'),
    limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default('20'),
    sortBy: z.enum(['name', 'value', 'created_at']).default('created_at'),
    order: z.enum(['asc', 'desc']).default('desc'),
    type: z.enum(['main', 'trading', 'savings', 'defi']).optional()
  })
});
```

### Centralized Error Handling
```typescript
// middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | ApiError | ZodError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err } as ApiError;
  error.message = err.message;

  // Log error
  logger.error(err);

  // Zod validation errors
  if (err instanceof ZodError) {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    error = new AppError(message, 400);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new AppError(message, 404);
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = new AppError(message, 400);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = new AppError(message, 401);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  });
};
```

### OpenAPI Documentation Setup
```typescript
// docs/swagger.config.ts
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Crypto Portfolio API',
      version: '1.0.0',
      description: 'A comprehensive API for managing cryptocurrency portfolios across multiple exchanges',
      contact: {
        name: 'API Support',
        email: 'support@cryptoportfolio.app'
      }
    },
    servers: [
      {
        url: 'http://localhost:8000/api/v1',
        description: 'Development server'
      },
      {
        url: 'https://api.cryptoportfolio.app/v1',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            },
            timestamp: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }]
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts']
};

const specs = swaggerJSDoc(options);

export { specs, swaggerUi };
```

## 🧪 Testing Framework

### API Testing with Supertest
```typescript
// tests/integration/auth.test.ts
import request from 'supertest';
import app from '../../src/app';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/database';

describe('Authentication API', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  afterAll(async () => {
    await closeTestDB();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        terms: true
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should validate email format', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        terms: true
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid email format');
    });
  });
});
```

## 🔗 Dependencies
- **Depends on**: CP-001 (Project Setup), CP-002 (Authentication), CP-004 (Database)
- **Blocks**: CP-007 (WebSocket Server), CP-016 (Exchange Integration)

## 🎯 Definition of Done
- [ ] All API routes respond correctly
- [ ] Swagger documentation accessible
- [ ] All middleware functioning properly
- [ ] Request/response validation working
- [ ] Error handling comprehensive
- [ ] Rate limiting operational
- [ ] Security headers configured
- [ ] Integration tests passing
- [ ] Performance benchmarks met

## 📚 Resources
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Zod Documentation](https://zod.dev/)
- [API Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

## 🏷️ Labels
`backend`, `api`, `express`, `middleware`, `documentation`, `foundation`

## ⏱️ Estimated Time
**16-24 hours** for experienced backend developer

## 👥 Assignee
Suitable for developers with:
- Strong Express.js/Node.js experience
- API design and documentation skills
- Security middleware knowledge
- Testing framework experience

---
*A solid API foundation enables rapid feature development. Invest time in proper architecture.*