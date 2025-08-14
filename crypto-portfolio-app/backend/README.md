# Crypto Portfolio Backend API

A comprehensive backend API for cryptocurrency portfolio management with real-time tracking, analytics, and secure transactions.

## 🚀 Quick Start

### Local Development Setup

The easiest way to get started is using our automated setup script:

```bash
# Make the script executable and run it
npm run local
# OR
./scripts/start-local.sh
```

This script will:
- ✅ Check system requirements (Node.js 18+, Docker)
- ✅ Set up environment variables
- ✅ Start PostgreSQL and Redis with Docker
- ✅ Install dependencies
- ✅ Run database migrations
- ✅ Start the development server

### Manual Setup

If you prefer manual setup:

1. **Install Dependencies**
```bash
npm install
```

2. **Set up Environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start Database Services**
```bash
docker-compose up -d
```

4. **Set up Database**
```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5. **Start Development Server**
```bash
npm run dev
```

## 🔧 Development Commands

### Server Management
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run local        # Automated local setup
```

### Database Operations
```bash
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:reset     # Reset database
npm run db:seed      # Seed database with sample data
npm run db:studio    # Open Prisma Studio
```

### Testing
```bash
npm run test              # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
npm run test:api          # Run API tests only
npm run test:integration  # Run integration tests
npm run test:performance  # Run performance tests
npm run test:security     # Run security tests
```

### Code Quality
```bash
npm run lint         # Lint code
npm run lint:fix     # Fix lint issues
npm run typecheck    # Type checking
npm run validate     # Run typecheck + lint + smoke tests
```

### Documentation
```bash
npm run docs:generate    # Generate API documentation
npm run docs:serve      # Serve documentation
```

## 📋 API Documentation

Once the server is running, access the interactive API documentation at:
- **Swagger UI**: http://localhost:3001/api-docs
- **Health Check**: http://localhost:3001/health

### API Endpoints Overview

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh tokens
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/forgot-password` - Password reset

#### Portfolios
- `GET /api/v1/portfolios` - List user portfolios
- `POST /api/v1/portfolios` - Create new portfolio
- `GET /api/v1/portfolios/:id` - Get portfolio details
- `PUT /api/v1/portfolios/:id` - Update portfolio
- `DELETE /api/v1/portfolios/:id` - Delete portfolio
- `GET /api/v1/portfolios/:id/analytics` - Portfolio analytics

#### Transactions
- `GET /api/v1/transactions` - List transactions
- `POST /api/v1/transactions` - Create transaction
- `GET /api/v1/transactions/:id` - Get transaction details
- `PUT /api/v1/transactions/:id` - Update transaction
- `DELETE /api/v1/transactions/:id` - Delete transaction
- `POST /api/v1/transactions/bulk` - Bulk create transactions

#### Market Data
- `GET /api/v1/market/prices` - Current crypto prices
- `GET /api/v1/market/historical` - Historical price data
- `GET /api/v1/market/trending` - Trending cryptocurrencies

#### Users
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update profile
- `POST /api/v1/users/change-password` - Change password
- `GET /api/v1/users/settings` - User settings

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Authentication**: JWT tokens
- **File Storage**: AWS S3
- **WebSockets**: Socket.IO
- **Background Jobs**: Bull Queue
- **Documentation**: Swagger/OpenAPI 3.0

### Project Structure
```
src/
├── controllers/     # Request handlers
├── services/        # Business logic
├── models/         # Data models
├── routes/         # API routes
├── middleware/     # Express middleware
├── config/         # Configuration files
├── utils/          # Utility functions
├── types/          # TypeScript type definitions
├── docs/           # API documentation
├── tests/          # Test suites
│   ├── api/        # API endpoint tests
│   ├── integration/ # Integration tests
│   ├── performance/ # Performance tests
│   └── security/   # Security tests
└── workers/        # Background workers
```

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Rate Limiting** per IP and user
- **Input Validation** with comprehensive sanitization
- **CORS Protection** with configurable origins
- **Helmet Security** headers
- **API Key Encryption** with AES-256-GCM
- **Audit Logging** for sensitive operations
- **2FA Support** with TOTP

## 📊 Monitoring & Analytics

- **Error Tracking** with Sentry integration
- **Performance Monitoring** with Prometheus metrics
- **Request Logging** with Winston
- **Health Checks** for all services
- **Real-time Analytics** via WebSocket

## 🌍 Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/crypto_portfolio_db"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="your-super-secure-jwt-secret"
ENCRYPTION_KEY="your-32-character-encryption-key"

# External APIs
COINGECKO_API_KEY="your-coingecko-api-key" # Optional
COINMARKETCAP_API_KEY="your-coinmarketcap-api-key" # Optional

# Server
PORT=3001
NODE_ENV=development
```

## 🚦 Testing Strategy

### Test Types
- **Unit Tests**: Individual functions and methods
- **API Tests**: HTTP endpoint validation
- **Integration Tests**: Service interaction testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability assessment

### Running Tests
```bash
# Run specific test suites
npm run test:api          # API endpoints
npm run test:integration  # Service integration
npm run test:performance  # Performance benchmarks
npm run test:security     # Security validation

# Generate coverage reports
npm run test:coverage

# Debug tests
npm run test:debug
```

## 📈 Performance Features

- **Redis Caching** for frequently accessed data
- **Connection Pooling** for database efficiency
- **Request Compression** with gzip
- **Rate Limiting** to prevent abuse
- **Background Jobs** for heavy operations
- **WebSocket** for real-time updates

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps
   
   # Restart database services
   docker-compose restart postgres
   ```

2. **Redis Connection Failed**
   ```bash
   # Check Redis status
   docker-compose ps redis
   
   # Restart Redis
   docker-compose restart redis
   ```

3. **Port Already in Use**
   ```bash
   # Kill process on port 3001
   npx kill-port 3001
   
   # Or change PORT in .env file
   PORT=3002
   ```

4. **Migration Errors**
   ```bash
   # Reset database and migrations
   npm run db:reset
   ```

### Debug Mode
```bash
# Start server with debug logging
DEBUG=* npm run dev

# Or set log level in .env
LOG_LEVEL=debug
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm run validate`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Development Workflow
1. **Code** → Write your feature
2. **Test** → `npm run validate`
3. **Document** → Update API docs if needed
4. **Review** → Submit PR for review

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check API docs at `/api-docs`
- **Issues**: Report bugs in GitHub Issues
- **Email**: Contact the development team
- **Discord**: Join our development community

---

## 🎯 Quick Commands Reference

```bash
# Essential commands for daily development
npm run local           # Start everything locally
npm run dev            # Development server
npm run test           # Run tests
npm run validate       # Check code quality
npm run db:studio      # Database GUI
npm run docs:serve     # API documentation
```

Happy coding! 🚀