# Development Guide

## Getting Started

This guide will help you set up your development environment and understand the project structure.

## Prerequisites

- Node.js v18.0.0 or higher
- npm v9.0.0 or higher
- Docker and Docker Compose
- PostgreSQL v15 (if running locally)
- Redis v7 (if running locally)

## Project Setup

### 1. Repository Setup
```bash
git clone <repository-url>
cd crypto-portfolio-app
```

### 2. Install Dependencies
```bash
npm install
```

This will install dependencies for both frontend and backend using npm workspaces.

### 3. Environment Configuration

#### Backend Environment
```bash
cp backend/.env.example backend/.env
```

Update the following variables in `backend/.env`:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Strong secret for JWT tokens (min 32 characters)
- `CORS_ORIGIN`: Frontend URL for CORS

#### Frontend Environment
```bash
cp frontend/.env.example frontend/.env
```

Update the following variables in `frontend/.env`:
- `VITE_API_BASE_URL`: Backend API URL
- `VITE_WS_URL`: WebSocket URL for real-time features

### 4. Database Setup

#### Using Docker (Recommended)
```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database with sample data
npm run db:seed
```

#### Manual Setup
If you prefer to run PostgreSQL and Redis locally:

1. Install and start PostgreSQL
2. Create database: `CREATE DATABASE crypto_portfolio;`
3. Install and start Redis
4. Update connection strings in `.env`
5. Run migrations and seed data

### 5. Start Development Servers

#### Option A: Docker Compose (Full Stack)
```bash
npm run docker:up
```

#### Option B: Manual Start
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

#### Option C: Concurrent Start
```bash
npm run dev
```

## Development Workflow

### Code Style and Linting

We use ESLint, Prettier, and TypeScript for code quality:

```bash
# Lint all code
npm run lint

# Fix linting issues
npm run lint:fix

# Check TypeScript types
npm run typecheck

# Format code with Prettier
npx prettier --write .
```

### Git Hooks

We use Husky for Git hooks:
- **Pre-commit**: Runs lint-staged on staged files
- **Commit-msg**: Validates commit message format

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, missing semi-colons, etc)
- `refactor`: Code refactoring
- `test`: Adding missing tests
- `chore`: Maintenance

Examples:
```
feat(auth): add JWT authentication
fix(api): resolve portfolio calculation bug
docs(readme): update installation instructions
```

### Testing

#### Frontend Testing
```bash
# Run tests
npm run test:frontend

# Run tests in watch mode
npm run test:frontend -- --watch

# Run tests with coverage
npm run test:frontend -- --coverage
```

#### Backend Testing
```bash
# Run tests
npm run test:backend

# Run tests in watch mode
npm run test:backend -- --watch

# Run tests with coverage
npm run test:backend -- --coverage
```

### Database Development

#### Prisma Workflow
```bash
# Make schema changes in prisma/schema.prisma

# Generate new migration
npx prisma migrate dev --name migration_name

# Generate Prisma client
npm run db:generate

# View data in Prisma Studio
npm run db:studio

# Reset database (careful in development!)
npm run db:reset
```

#### Database Seeding
```bash
# Run seed script
npm run db:seed

# The seed script is in backend/prisma/seed.ts
```

## Project Structure

### Frontend (`/frontend`)
```
src/
├── components/         # Reusable UI components
│   ├── ui/            # Base UI components (buttons, inputs, etc.)
│   ├── layout/        # Layout components (header, sidebar, etc.)
│   └── features/      # Feature-specific components
├── pages/             # Page components
├── hooks/             # Custom React hooks
├── services/          # API services and external integrations
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
├── store/             # State management (Zustand stores)
└── assets/            # Static assets
```

### Backend (`/backend`)
```
src/
├── controllers/       # Route controllers
├── services/          # Business logic services
├── models/            # Data models and schemas
├── routes/            # API route definitions
├── middleware/        # Express middleware
├── types/             # TypeScript type definitions
├── utils/             # Utility functions
└── config/            # Configuration files
```

## Development Best Practices

### Frontend

1. **Component Organization**
   - Keep components small and focused
   - Use TypeScript for all components
   - Follow the compound component pattern for complex UI

2. **State Management**
   - Use Zustand for client state
   - Use React Query for server state
   - Keep state as close to where it's used as possible

3. **Styling**
   - Use Tailwind CSS utility classes
   - Create reusable component variants
   - Follow the design system tokens

4. **Testing**
   - Write unit tests for utility functions
   - Write integration tests for components
   - Mock external dependencies

### Backend

1. **API Design**
   - Follow RESTful conventions
   - Use proper HTTP status codes
   - Implement proper error handling

2. **Database**
   - Use Prisma for type-safe database access
   - Write database migrations for schema changes
   - Index frequently queried fields

3. **Security**
   - Validate all inputs with Zod
   - Use parameterized queries (Prisma handles this)
   - Implement rate limiting
   - Use HTTPS in production

4. **Testing**
   - Write unit tests for services
   - Write integration tests for API endpoints
   - Use test databases for testing

## Debugging

### Frontend Debugging
- Use React Developer Tools
- Use browser DevTools for network and console debugging
- Use React Query DevTools for server state debugging

### Backend Debugging
- Use `console.log` or `debugger` statements
- Use Winston logger for structured logging
- Use Prisma Studio for database debugging
- Use Redis CLI for cache debugging

### Docker Debugging
```bash
# View logs
docker-compose logs -f

# Execute commands in containers
docker-compose exec backend bash
docker-compose exec postgres psql -U postgres crypto_portfolio

# View container status
docker-compose ps
```

## Performance Optimization

### Frontend
- Use React.memo for expensive components
- Implement lazy loading for routes
- Optimize bundle size with code splitting
- Use React Query for efficient data fetching

### Backend
- Use Redis for caching
- Implement database query optimization
- Use compression middleware
- Implement rate limiting

## Deployment

### Development Deployment
```bash
# Build for development
npm run build

# Test production build locally
npm run docker:build
npm run docker:up
```

### Production Deployment
- Use the provided GitHub Actions workflows
- Ensure all environment variables are set
- Run database migrations
- Monitor application health

## Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure ports 3000, 3001, 5432, and 6379 are available
2. **Database connection**: Check PostgreSQL is running and connection string is correct
3. **Redis connection**: Check Redis is running and connection string is correct
4. **Permission errors**: Make sure you have write permissions in the project directory

### Getting Help

1. Check the error logs in console/terminal
2. Review the troubleshooting section in README.md
3. Check existing GitHub issues
4. Create a new issue with detailed error information

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Docker Documentation](https://docs.docker.com/)