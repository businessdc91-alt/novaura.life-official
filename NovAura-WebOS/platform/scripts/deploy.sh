#!/bin/bash

# NovAura Platform - Polsia Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Environments: production (default), staging

set -e

ENVIRONMENT=${1:-production}
echo "🚀 Deploying NovAura Platform to Polsia ($ENVIRONMENT)..."

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if polsia CLI is installed
if ! command -v polsia &> /dev/null; then
    echo -e "${RED}❌ Polsia CLI not found${NC}"
    echo "Install it with: npm install -g @polsia/cli"
    exit 1
fi

# Check if user is logged in
if ! polsia whoami &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Polsia${NC}"
    echo "Running: polsia login"
    polsia login
fi

# Clean and build
echo -e "${YELLOW}📦 Building project...${NC}"
rm -rf dist
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Deploy
echo -e "${YELLOW}🚀 Deploying to Polsia...${NC}"

if [ "$ENVIRONMENT" = "production" ]; then
    polsia deploy --static ./dist --prod
else
    polsia deploy --static ./dist --staging
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}🌐 Your site is live at: https://novauraverse.com${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi
