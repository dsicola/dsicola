#!/bin/bash

# ===========================================
# DSICOLA Backend - Deploy Script
# ===========================================

set -e

echo "🚀 DSICOLA Backend Deploy Script"
echo "================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${RED}❌ Please edit .env file with your production values before continuing!${NC}"
    exit 1
fi

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to build and start containers
deploy_docker() {
    echo -e "${YELLOW}📦 Building Docker images...${NC}"
    docker-compose build --no-cache

    echo -e "${YELLOW}🗄️  Starting database...${NC}"
    docker-compose up -d postgres
    
    # Wait for database to be ready
    echo -e "${YELLOW}⏳ Waiting for database to be ready...${NC}"
    sleep 10

    echo -e "${YELLOW}🔄 Running database migrations...${NC}"
    docker-compose run --rm api npx prisma migrate deploy

    echo -e "${YELLOW}🚀 Starting API server...${NC}"
    docker-compose up -d api

    echo -e "${GREEN}✅ Deployment complete!${NC}"
    echo ""
    echo "API is running at: http://localhost:3000"
    echo "Health check: http://localhost:3000/api/health"
    echo ""
    echo "Useful commands:"
    echo "  - View logs: docker-compose logs -f api"
    echo "  - Stop: docker-compose down"
    echo "  - Restart: docker-compose restart api"
}

# Function for production deploy with nginx
deploy_production() {
    echo -e "${YELLOW}📦 Building production images...${NC}"
    docker-compose --profile production build --no-cache

    echo -e "${YELLOW}🗄️  Starting all services...${NC}"
    docker-compose --profile production up -d

    echo -e "${GREEN}✅ Production deployment complete!${NC}"
}

# Main menu
echo ""
echo "Select deployment option:"
echo "1) Development (API + Database)"
echo "2) Production (API + Database + Nginx)"
echo "3) Database only"
echo "4) Run migrations only"
echo "5) Stop all services"
echo ""

read -p "Enter option (1-5): " option

case $option in
    1)
        check_docker
        deploy_docker
        ;;
    2)
        check_docker
        deploy_production
        ;;
    3)
        check_docker
        docker-compose up -d postgres
        echo -e "${GREEN}✅ Database started at localhost:5432${NC}"
        ;;
    4)
        echo -e "${YELLOW}🔄 Running migrations...${NC}"
        npx prisma migrate deploy
        echo -e "${GREEN}✅ Migrations complete!${NC}"
        ;;
    5)
        docker-compose --profile production down
        echo -e "${GREEN}✅ All services stopped${NC}"
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac
