#!/bin/bash

# Crypto Portfolio App - Local Development Startup Script
# This script sets up and starts the application locally for development and testing

set -e  # Exit on any error

echo "🚀 Starting Crypto Portfolio App Local Development Environment"
echo "============================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo -e "${BLUE}Checking system requirements...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ and try again.${NC}"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}❌ Node.js version 18+ is required. Current version: $(node --version)${NC}"
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed.${NC}"
        exit 1
    fi
    
    # Check Docker (for PostgreSQL and Redis)
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed. Please install Docker to run PostgreSQL and Redis.${NC}"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker is not running. Please start Docker and try again.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All requirements met!${NC}"
}

# Setup environment variables
setup_environment() {
    echo -e "${BLUE}Setting up environment variables...${NC}"
    
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Creating .env file from template...${NC}"
        cp .env.example .env
        
        # Generate JWT secrets
        JWT_SECRET=$(openssl rand -base64 32)
        REFRESH_SECRET=$(openssl rand -base64 32)
        ENCRYPTION_KEY=$(openssl rand -hex 32)
        
        # Update .env with generated secrets
        sed -i.bak "s/your-super-secret-jwt-key-here/$JWT_SECRET/" .env
        sed -i.bak "s/your-refresh-token-secret-here/$REFRESH_SECRET/" .env
        sed -i.bak "s/your-32-char-encryption-key-here/$ENCRYPTION_KEY/" .env
        
        rm .env.bak
        
        echo -e "${GREEN}✅ Environment file created with secure secrets${NC}"
    else
        echo -e "${GREEN}✅ Environment file already exists${NC}"
    fi
}

# Start database services
start_databases() {
    echo -e "${BLUE}Starting database services...${NC}"
    
    # Create docker-compose.yml if it doesn't exist
    if [ ! -f docker-compose.yml ]; then
        echo -e "${YELLOW}Creating docker-compose.yml...${NC}"
        cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: crypto-portfolio-postgres
    environment:
      POSTGRES_DB: crypto_portfolio
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: crypto-portfolio-redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
  redis_data:
EOF
        echo -e "${GREEN}✅ Docker Compose configuration created${NC}"
    fi
    
    # Start services
    echo -e "${YELLOW}Starting PostgreSQL and Redis...${NC}"
    docker-compose up -d
    
    # Wait for services to be healthy
    echo -e "${YELLOW}Waiting for databases to be ready...${NC}"
    
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null && \
           docker-compose exec -T redis redis-cli ping &> /dev/null; then
            echo -e "${GREEN}✅ Databases are ready!${NC}"
            break
        fi
        echo "Waiting for databases... ($i/30)"
        sleep 2
    done
}

# Install dependencies
install_dependencies() {
    echo -e "${BLUE}Installing dependencies...${NC}"
    
    if [ ! -d "node_modules" ] || [ package.json -nt node_modules ]; then
        echo -e "${YELLOW}Installing npm packages...${NC}"
        npm install
        echo -e "${GREEN}✅ Dependencies installed${NC}"
    else
        echo -e "${GREEN}✅ Dependencies already installed${NC}"
    fi
}

# Setup database
setup_database() {
    echo -e "${BLUE}Setting up database...${NC}"
    
    # Generate Prisma client
    echo -e "${YELLOW}Generating Prisma client...${NC}"
    npx prisma generate
    
    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    npx prisma migrate deploy
    
    # Seed database if needed
    if [ -f "prisma/seed.ts" ]; then
        echo -e "${YELLOW}Seeding database...${NC}"
        npx prisma db seed
    fi
    
    echo -e "${GREEN}✅ Database setup complete${NC}"
}

# Start the application
start_application() {
    echo -e "${BLUE}Starting the application...${NC}"
    
    # Build the application
    echo -e "${YELLOW}Building application...${NC}"
    npm run build
    
    echo -e "${GREEN}✅ Build complete${NC}"
    echo ""
    echo -e "${GREEN}🎉 Crypto Portfolio App is starting!${NC}"
    echo ""
    echo -e "${BLUE}Application URLs:${NC}"
    echo -e "  🌐 API Server:      http://localhost:3000"
    echo -e "  📚 API Docs:        http://localhost:3000/api-docs"
    echo -e "  🔍 Health Check:    http://localhost:3000/health"
    echo ""
    echo -e "${BLUE}Database URLs:${NC}"
    echo -e "  🐘 PostgreSQL:      postgresql://postgres:postgres@localhost:5432/crypto_portfolio"
    echo -e "  🔴 Redis:           redis://localhost:6379"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop the application${NC}"
    echo ""
    
    # Start in development mode
    npm run dev
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    
    # Stop databases if requested
    read -p "Stop database containers? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Stopping database containers...${NC}"
        docker-compose down
        echo -e "${GREEN}✅ Database containers stopped${NC}"
    fi
    
    echo -e "${GREEN}👋 Goodbye!${NC}"
}

# Handle script interruption
trap cleanup EXIT

# Main execution
main() {
    echo -e "${BLUE}Starting setup process...${NC}"
    
    check_requirements
    setup_environment
    start_databases
    install_dependencies
    setup_database
    start_application
}

# Help function
show_help() {
    echo "Crypto Portfolio App - Local Development Startup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  --no-docker    Skip Docker setup (assumes databases are already running)"
    echo "  --clean        Clean install (remove node_modules and reinstall)"
    echo "  --reset-db     Reset database (drop and recreate)"
    echo ""
    echo "Environment Variables:"
    echo "  PORT           Application port (default: 3000)"
    echo "  NODE_ENV       Environment (default: development)"
    echo ""
    echo "Examples:"
    echo "  $0                 # Normal startup"
    echo "  $0 --clean         # Clean installation"
    echo "  $0 --reset-db      # Reset database and start"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        --no-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --clean)
            echo -e "${YELLOW}Cleaning node_modules...${NC}"
            rm -rf node_modules package-lock.json
            shift
            ;;
        --reset-db)
            echo -e "${YELLOW}Resetting database...${NC}"
            npx prisma migrate reset --force
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Skip Docker setup if requested
if [ "$SKIP_DOCKER" = true ]; then
    echo -e "${YELLOW}Skipping Docker setup...${NC}"
    check_requirements() {
        echo -e "${BLUE}Checking Node.js requirements...${NC}"
        
        if ! command -v node &> /dev/null; then
            echo -e "${RED}❌ Node.js is not installed.${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ Node.js requirements met!${NC}"
    }
    start_databases() {
        echo -e "${YELLOW}Skipping database startup (--no-docker flag)${NC}"
    }
fi

# Run main function
main