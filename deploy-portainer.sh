#!/bin/bash

# Christophe Verdier Portfolio - Portainer Deployment Script
# Builds and pushes image to registry and triggers Portainer webhook

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${REGISTRY:-"registry.sponge-theory.dev"}
PORTAINER_WEBHOOK=${PORTAINER_WEBHOOK:-"https://portainer.sponge-theory.dev/api/stacks/webhooks/0455b73c-d4bc-4877-8f91-689c98e61cbc"}
PLATFORM=${PLATFORM:-"linux/amd64"}
IMAGE_NAME=${IMAGE_NAME:-"christophe-portfolio"}

# Get app version from package.json
APP_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TAG=${TAG:-"latest"}

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Christophe Verdier Portfolio - Portainer Deployment        ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Registry: ${REGISTRY}"
echo "  Platform: ${PLATFORM}"
echo "  Image Name: ${IMAGE_NAME}"
echo "  App Version: ${APP_VERSION}"
echo "  Git Commit: ${GIT_COMMIT}"
echo "  Build Date: ${BUILD_DATE}"
echo "  Tag: ${TAG}"
echo ""

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -f "server.js" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    echo -e "${YELLOW}Create a .env file with ANTHROPIC_API_KEY=your-key-here${NC}"
    exit 1
fi

# Verify Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Build Docker image
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 1: Building Docker Image${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Building ${IMAGE_NAME}:${APP_VERSION}..."
echo ""

docker build \
    --platform ${PLATFORM} \
    -f Dockerfile \
    -t ${IMAGE_NAME}:${APP_VERSION} \
    --build-arg BUILD_DATE="${BUILD_DATE}" \
    --build-arg VERSION="${APP_VERSION}" \
    --build-arg GIT_COMMIT="${GIT_COMMIT}" \
    .

echo ""
echo -e "${GREEN}✓ Image built successfully${NC}"
echo ""

# Tag images
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 2: Tagging Images${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Tagging images for registry..."
docker tag ${IMAGE_NAME}:${APP_VERSION} ${REGISTRY}/${IMAGE_NAME}:${TAG}
docker tag ${IMAGE_NAME}:${APP_VERSION} ${REGISTRY}/${IMAGE_NAME}:${APP_VERSION}
docker tag ${IMAGE_NAME}:${APP_VERSION} ${REGISTRY}/${IMAGE_NAME}:${GIT_COMMIT}

echo -e "${GREEN}✓ Images tagged successfully${NC}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${APP_VERSION}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${GIT_COMMIT}"
echo ""

# Push to registry
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 3: Pushing to Registry${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

echo "Pushing images to ${REGISTRY}..."
docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}
docker push ${REGISTRY}/${IMAGE_NAME}:${APP_VERSION}
docker push ${REGISTRY}/${IMAGE_NAME}:${GIT_COMMIT}

echo ""
echo -e "${GREEN}✓ Images pushed successfully${NC}"
echo ""

# Trigger Portainer webhook
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}Step 4: Triggering Portainer Deployment${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -n "${PORTAINER_WEBHOOK}" ]; then
    echo "Triggering Portainer webhook..."
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${PORTAINER_WEBHOOK}")

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
        echo -e "${GREEN}✓ Portainer deployment triggered successfully (HTTP ${HTTP_CODE})${NC}"
    else
        echo -e "${RED}⚠ Portainer webhook returned HTTP ${HTTP_CODE}${NC}"
        echo -e "${YELLOW}  This might indicate an issue with the webhook URL or permissions${NC}"
    fi
else
    echo -e "${YELLOW}⚠ PORTAINER_WEBHOOK not set, skipping deployment trigger${NC}"
    echo -e "${YELLOW}  Set PORTAINER_WEBHOOK environment variable to trigger automatic deployment${NC}"
    echo -e "${YELLOW}  Example: export PORTAINER_WEBHOOK='https://portainer.example.com/api/stacks/webhooks/xxx'${NC}"
fi

echo ""

# Summary
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Deployment Complete!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Summary:${NC}"
echo "  • Image: ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo "  • App Version: ${APP_VERSION}"
echo "  • Git Commit: ${GIT_COMMIT}"
echo "  • Build Date: ${BUILD_DATE}"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Check Portainer dashboard for deployment status"
echo "  2. Verify services are running and healthy"
echo "  3. Test the application at your deployment URL"
echo ""

echo -e "${BLUE}Available tags in registry:${NC}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${APP_VERSION}"
echo "  ${REGISTRY}/${IMAGE_NAME}:${GIT_COMMIT}"
echo ""

echo -e "${GREEN}Image Sizes:${NC}"
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "(REPOSITORY|${IMAGE_NAME})" | grep -E "(REPOSITORY|${TAG}|${APP_VERSION}|${GIT_COMMIT})"
echo ""

echo -e "${BLUE}Quick Commands:${NC}"
echo "  # Deploy with default settings:"
echo "  ./deploy-portainer.sh"
echo ""
echo "  # Deploy to specific registry:"
echo "  REGISTRY=your-registry.com ./deploy-portainer.sh"
echo ""
echo "  # Deploy with webhook:"
echo "  PORTAINER_WEBHOOK='https://portainer.example.com/api/stacks/webhooks/xxx' ./deploy-portainer.sh"
echo ""
echo "  # Deploy with custom tag:"
echo "  TAG=v1.0.0 ./deploy-portainer.sh"
echo ""

exit 0
