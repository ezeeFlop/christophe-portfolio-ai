# Portainer Deployment Guide

This guide explains how to deploy the Christophe Verdier Portfolio application using Portainer with automated build and deployment.

## Overview

The Portainer deployment provides:
- **Automated Build & Push**: Script builds Docker image and pushes to your registry
- **Webhook Deployment**: Automatic stack update via Portainer webhook
- **Load Balancing**: 2 replicas with automatic load distribution
- **Zero Downtime**: Rolling updates with health checks
- **Traefik Integration**: Automatic SSL and routing
- **Version Tracking**: Tags images with version, commit hash, and latest

## Prerequisites

- Portainer CE/BE instance running
- Docker registry (can be Portainer's built-in registry)
- Docker installed locally for building images
- Git repository with the code
- Traefik (optional, for automatic SSL)

## Quick Start

### 1. Configure Registry

Set your registry URL:

```bash
export REGISTRY="registry.sponge-theory.dev"
# or
export REGISTRY="your-portainer-url:5000"
```

### 2. Create Portainer Secret

In Portainer:
1. Navigate to **Secrets**
2. Click **Add secret**
3. Name: `anthropic_api_key`
4. Value: Your Anthropic API key
5. Click **Create secret**

### 3. Create Portainer Stack

In Portainer:
1. Navigate to **Stacks**
2. Click **Add stack**
3. Name: `christophe-portfolio`
4. Upload `portainer-stack.yml` or paste its contents
5. Update the image registry URL if needed
6. Click **Deploy the stack**

### 4. Get Webhook URL

In Portainer:
1. Navigate to your stack
2. Scroll down to **Stack webhooks**
3. Click **Add a webhook**
4. Copy the webhook URL

### 5. Deploy with Script

```bash
export PORTAINER_WEBHOOK="https://portainer.example.com/api/stacks/webhooks/xxx"
./deploy-portainer.sh
```

## Deployment Script Usage

### Basic Deployment

```bash
./deploy-portainer.sh
```

This will:
1. Extract version from `package.json`
2. Build Docker image
3. Tag with version, commit hash, and latest
4. Push to registry
5. Trigger Portainer webhook (if configured)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REGISTRY` | `registry.sponge-theory.dev` | Docker registry URL |
| `PORTAINER_WEBHOOK` | _empty_ | Portainer webhook URL |
| `PLATFORM` | `linux/amd64` | Target platform |
| `IMAGE_NAME` | `christophe-portfolio` | Docker image name |
| `TAG` | `latest` | Primary image tag |

### Advanced Examples

**Deploy to custom registry:**
```bash
REGISTRY=my-registry.com ./deploy-portainer.sh
```

**Deploy with webhook:**
```bash
PORTAINER_WEBHOOK='https://portainer.example.com/api/stacks/webhooks/xxx' \
./deploy-portainer.sh
```

**Deploy with custom tag:**
```bash
TAG=production ./deploy-portainer.sh
```

**Deploy for ARM platform:**
```bash
PLATFORM=linux/arm64 ./deploy-portainer.sh
```

**Combine multiple options:**
```bash
REGISTRY=my-registry.com \
TAG=v1.0.0 \
PORTAINER_WEBHOOK='https://portainer.example.com/api/stacks/webhooks/xxx' \
./deploy-portainer.sh
```

## Stack Configuration

### Updating Domain

Edit `portainer-stack.yml` and update the Traefik labels:

```yaml
- "traefik.http.routers.portfolio.rule=Host(`your-domain.com`)"
```

### Scaling

To change the number of replicas, update the stack YAML:

```yaml
deploy:
  replicas: 3  # Change this number
```

Or scale via Portainer UI:
1. Go to your stack
2. Click on the **web** service
3. Click **Scale**
4. Enter desired replica count

### Resource Limits

Adjust resource limits in `portainer-stack.yml`:

```yaml
resources:
  limits:
    cpus: '2.0'      # Increase CPU
    memory: 1024M    # Increase memory
  reservations:
    cpus: '1.0'
    memory: 512M
```

## Monitoring

### View Logs

In Portainer:
1. Navigate to **Containers**
2. Find `christophe-portfolio_web` containers
3. Click **Logs** icon

Or via command line:
```bash
docker service logs christophe-portfolio_web -f
```

### Check Health

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","hasApiKey":true}
```

### Service Status

In Portainer:
1. Navigate to **Stacks**
2. Click on `christophe-portfolio`
3. View service status and replica distribution

## Continuous Deployment

### GitHub Actions Integration

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Portainer

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build and Deploy
        env:
          REGISTRY: ${{ secrets.REGISTRY }}
          PORTAINER_WEBHOOK: ${{ secrets.PORTAINER_WEBHOOK }}
        run: ./deploy-portainer.sh
```

Add secrets in GitHub:
- `REGISTRY`: Your registry URL
- `PORTAINER_WEBHOOK`: Your Portainer webhook URL

### GitLab CI/CD

Create `.gitlab-ci.yml`:

```yaml
deploy:
  stage: deploy
  image: docker:latest
  services:
    - docker:dind
  script:
    - ./deploy-portainer.sh
  only:
    - main
  variables:
    REGISTRY: $REGISTRY
    PORTAINER_WEBHOOK: $PORTAINER_WEBHOOK
```

## Updating the Application

### Method 1: Automated Script

```bash
# Make code changes, commit
git add .
git commit -m "Update feature"
git push

# Build and deploy
./deploy-portainer.sh
```

The script will automatically trigger a rolling update.

### Method 2: Webhook Only

If images are already built and pushed:

```bash
curl -X POST "https://portainer.example.com/api/stacks/webhooks/xxx"
```

### Method 3: Portainer UI

1. Navigate to your stack
2. Click **Update the stack**
3. Click **Pull latest image**
4. Click **Update**

## Traefik Integration

### Prerequisites

Traefik must be deployed with:
- Docker provider enabled
- Let's Encrypt configured
- Network `traefik-public` created

### Verify Traefik Labels

Check that labels are correctly set:

```bash
docker service inspect christophe-portfolio_web --format '{{json .Spec.Labels}}' | jq
```

### SSL Certificate

Traefik automatically provisions SSL certificates via Let's Encrypt for domains specified in the Host rule.

### Access Application

After deployment with Traefik:
- HTTP: Automatically redirects to HTTPS
- HTTPS: `https://your-domain.com`

## Troubleshooting

### Image Pull Errors

**Error**: "repository not found" or "unauthorized"

**Solution**: Ensure registry is accessible from Portainer:
```bash
# Test registry access
docker pull registry.sponge-theory.dev/christophe-portfolio:latest
```

Check registry credentials in Portainer:
1. Settings → Registries
2. Add/update registry credentials

### Webhook Not Triggering

**Error**: HTTP 404 or 401

**Solution**:
- Verify webhook URL is correct
- Check webhook permissions in Portainer
- Ensure stack exists and webhook is created

### Services Not Starting

**Error**: Health check failing

**Solution**:
1. Check logs for errors
2. Verify API key secret is created
3. Check resource availability (memory/CPU)

### Port Already in Use

**Error**: Port 3000 already allocated

**Solution**: Change port in stack YAML:
```yaml
ports:
  - "8080:3000"  # Use port 8080 externally
```

### SSL Certificate Issues

**Error**: Certificate not provisioning

**Solution**:
1. Verify domain DNS points to Portainer host
2. Check Traefik logs: `docker service logs traefik`
3. Ensure ports 80 and 443 are accessible

## Security Considerations

### Secrets Management

- ✅ Use Docker secrets (not environment variables)
- ✅ Rotate API keys periodically
- ✅ Limit registry access with authentication

### Network Security

- ✅ Use overlay networks for service isolation
- ✅ Enable Traefik with HTTPS only
- ✅ Configure firewall rules

### Image Security

- ✅ Scan images for vulnerabilities
- ✅ Use official base images (node:18-alpine)
- ✅ Run as non-root user (already configured)

### Access Control

- ✅ Limit Portainer access with RBAC
- ✅ Use webhook authentication
- ✅ Implement IP whitelisting if needed

## Production Checklist

Before going to production:

- [ ] Update domain in `portainer-stack.yml`
- [ ] Configure DNS to point to your server
- [ ] Create Anthropic API key secret in Portainer
- [ ] Set up Traefik with Let's Encrypt
- [ ] Configure backup strategy
- [ ] Set up monitoring and alerts
- [ ] Test rolling updates
- [ ] Verify health checks work
- [ ] Test failover (kill a replica)
- [ ] Configure logging aggregation
- [ ] Set up rate limiting (already built-in)
- [ ] Update SEO meta tags with actual domain
- [ ] Add favicon files
- [ ] Test from different devices/browsers

## Advanced Configuration

### Using Redis for Sessions

Uncomment Redis service in `portainer-stack.yml` and update `server.js`:

```javascript
const Redis = require('ioredis');
const redis = new Redis({
  host: 'redis',
  port: 6379
});
```

### Custom Health Checks

Modify health check interval in stack YAML:

```yaml
healthcheck:
  interval: 60s     # Check every 60 seconds
  timeout: 5s       # 5 second timeout
  retries: 5        # Try 5 times before marking unhealthy
```

### Multiple Environments

Deploy separate stacks for different environments:

```bash
# Production
TAG=production PORTAINER_WEBHOOK=$PROD_WEBHOOK ./deploy-portainer.sh

# Staging
TAG=staging PORTAINER_WEBHOOK=$STAGING_WEBHOOK ./deploy-portainer.sh
```

## Support

For issues:
- Check Portainer logs
- Review DOCKER.md for general Docker troubleshooting
- Check service status in Portainer dashboard
- Verify webhook URL and credentials

## Resources

- [Portainer Documentation](https://docs.portainer.io/)
- [Docker Swarm](https://docs.docker.com/engine/swarm/)
- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/)
