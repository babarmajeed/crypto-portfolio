# Crypto Portfolio Management Application

A production-ready cryptocurrency portfolio management application built with modern technologies and best practices.

## 🚀 Features

### Core Functionality
- **Portfolio Management**: Create and manage multiple crypto portfolios
- **Real-time Price Tracking**: Live cryptocurrency price updates
- **Transaction History**: Comprehensive transaction tracking and analysis
- **Asset Allocation**: Visual portfolio distribution and allocation insights
- **Performance Analytics**: Portfolio performance metrics and charts

### Technical Features
- **Real-time Updates**: WebSocket connections for live data
- **Responsive Design**: Mobile-first responsive UI
- **Dark/Light Theme**: User preference-based theming
- **Progressive Web App**: Installable PWA with offline capabilities
- **Security**: JWT authentication, input validation, rate limiting
- **Caching**: Redis-based caching for optimal performance

## 🏗️ Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with custom design system
- **State Management**: Zustand for client state, React Query for server state
- **Routing**: React Router v6
- **Charts**: Recharts for data visualization
- **Forms**: React Hook Form with Zod validation

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session and data caching
- **Authentication**: JWT-based authentication
- **Validation**: Zod schema validation
- **Logging**: Winston with structured logging
- **API Documentation**: OpenAPI/Swagger (coming soon)

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for local development
- **CI/CD**: GitHub Actions with automated testing and deployment
- **Monitoring**: Health checks and metrics collection
- **Security**: Helmet.js, CORS, rate limiting, input sanitization

## 📦 Project Structure

```
crypto-portfolio-app/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── services/       # API services and external integrations
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   ├── store/          # State management
│   │   └── assets/         # Static assets
│   ├── tests/              # Frontend tests
│   └── public/             # Public assets
├── backend/                 # Node.js backend API
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── services/       # Business logic services
│   │   ├── models/         # Data models and schemas
│   │   ├── routes/         # API route definitions
│   │   ├── middleware/     # Express middleware
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions
│   │   └── config/         # Configuration files
│   ├── tests/              # Backend tests
│   └── prisma/             # Database schema and migrations
├── docker/                 # Docker configurations
├── docs/                   # Project documentation
├── scripts/                # Utility scripts
└── .github/                # GitHub Actions workflows
```

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Docker**: v20.0.0 or higher (for containerized development)
- **PostgreSQL**: v15.0 or higher (if running locally)
- **Redis**: v7.0 or higher (if running locally)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd crypto-portfolio-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   # Backend environment
   cp backend/.env.example backend/.env
   
   # Frontend environment
   cp frontend/.env.example frontend/.env
   
   # Update the environment variables as needed
   ```

4. **Start with Docker (Recommended)**
   ```bash
   # Start all services
   npm run docker:up
   
   # View logs
   npm run docker:logs
   
   # Stop services
   npm run docker:down
   ```

5. **Or start manually**
   ```bash
   # Start database services
   docker-compose up postgres redis -d
   
   # Setup database
   npm run db:migrate
   npm run db:seed
   
   # Start development servers
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health
   - Database Studio: `npm run db:studio`

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Frontend tests
```bash
npm run test:frontend
npm run test:frontend -- --watch
npm run test:frontend -- --coverage
```

### Backend tests
```bash
npm run test:backend
npm run test:backend -- --watch
npm run test:backend -- --coverage
```

## 🏗️ Building for Production

### Build all applications
```bash
npm run build
```

### Build specific applications
```bash
npm run build:frontend
npm run build:backend
```

### Docker production build
```bash
npm run docker:build
```

## 📊 Database Management

### Prisma commands
```bash
# Generate Prisma client
npm run db:generate

# Create and apply migrations
npm run db:migrate

# Reset database
npm run db:reset

# Seed database with sample data
npm run db:seed

# Open Prisma Studio
npm run db:studio
```

## 🔧 Code Quality

### Linting and formatting
```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Type checking
npm run typecheck
```

### Git hooks
- **Pre-commit**: Runs linting and formatting on staged files
- **Commit-msg**: Validates commit message format using Conventional Commits

## 🚀 Deployment

### GitHub Actions
The project includes comprehensive CI/CD pipelines:

- **CI Pipeline**: Runs on pull requests and pushes
  - Linting and formatting checks
  - Type checking
  - Unit and integration tests
  - Security audits
  - Build verification

- **Deploy Pipeline**: Runs on main branch pushes
  - Production builds
  - Docker image building and pushing
  - Automated deployment to staging/production

### Manual Deployment

1. **Build production images**
   ```bash
   docker build -t crypto-portfolio-frontend ./frontend
   docker build -t crypto-portfolio-backend ./backend
   ```

2. **Deploy to your preferred platform**
   - AWS ECS/Fargate
   - Railway
   - DigitalOcean App Platform
   - Google Cloud Run
   - Azure Container Instances

## 📚 API Documentation

### Health Endpoints
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with dependencies
- `GET /health/live` - Liveness probe
- `GET /health/ready` - Readiness probe

### API Endpoints
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `GET /api/v1/portfolios` - Get user portfolios
- `GET /api/v1/assets` - Get cryptocurrency assets
- `GET /api/v1/transactions` - Get transaction history

*Full API documentation will be available via Swagger UI soon*

## 🔐 Security Features

- **Authentication**: JWT-based authentication with secure token handling
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive input validation using Zod schemas
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS**: Configurable CORS policies
- **Security Headers**: Helmet.js for security headers
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **XSS Protection**: Input sanitization and CSP headers

## 🔄 Environment Variables

### Backend (.env)
```bash
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crypto_portfolio
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key
CORS_ORIGIN=http://localhost:3000
```

### Frontend (.env)
```bash
VITE_API_BASE_URL=http://localhost:3001/api/v1
VITE_WS_URL=ws://localhost:3001
VITE_APP_NAME=Crypto Portfolio
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Format
We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test additions or modifications
- `chore:` - Maintenance tasks

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [CoinGecko](https://www.coingecko.com/) for cryptocurrency data
- [Recharts](https://recharts.org/) for beautiful charts
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Prisma](https://www.prisma.io/) for the excellent ORM

## 📞 Support

For support, email support@crypto-portfolio.com or create an issue in this repository.

---

**Built with ❤️ for the crypto community**