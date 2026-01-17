# Docker Swarm Deployment Guide

This guide explains how to deploy the Christophe Verdier Portfolio application using Docker and Docker Swarm.

## Prerequisites

- Docker Engine 20.10+ with Swarm mode
- At least 1GB RAM available
- Anthropic API key

## Quick Start

### 1. Initialize Environment

Create a `.env` file with your Anthropic API key:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
```

### 2. Initialize Docker Swarm

```bash
./deploy.sh init
```

This command will:
- Initialize Docker Swarm (if not already done)
- Create a Docker secret from your API key
- Prepare the environment for deployment

### 3. Deploy the Stack

```bash
./deploy.sh deploy
```

This command will:
- Build the Docker image
- Deploy the application stack with 2 replicas
- Start the services
- Show deployment status

Access the application at: **http://localhost:3000**

## Deployment Script Commands

The `deploy.sh` script provides several commands:

```bash
./deploy.sh init      # Initialize Swarm and create secrets
./deploy.sh deploy    # Build and deploy the complete stack
./deploy.sh update    # Perform rolling update
./deploy.sh remove    # Remove the stack
./deploy.sh logs      # Show and follow service logs
./deploy.sh scale N   # Scale web service to N replicas
./deploy.sh status    # Show stack status
```

## Manual Deployment

If you prefer manual deployment:

### 1. Build the Image

```bash
docker build -t christophe-portfolio:latest .
```

### 2. Initialize Swarm

```bash
docker swarm init
```

### 3. Create Secret

```bash
echo "your-anthropic-api-key" | docker secret create anthropic_api_key -
```

### 4. Deploy Stack

```bash
docker stack deploy -c docker-compose.yml portfolio
```

## Architecture

### Services

**web** (2 replicas by default):
- Node.js application serving the portfolio
- Load balanced across replicas
- Resource limits: 1 CPU, 512MB RAM
- Health checks every 30s
- Rolling updates with zero downtime

**redis** (optional, 1 replica):
- Session storage for production use
- Persistent data storage
- Resource limits: 0.5 CPU, 256MB RAM

### Networking

- Uses Docker overlay network (`portfolio-network`)
- Services can communicate internally
- Only web service exposed on port 3000

### Secrets Management

- API key stored as Docker secret
- Not exposed in environment variables
- Automatically mounted at `/run/secrets/anthropic_api_key`

**Note**: To use secrets in your application, update `server.js` to read from `/run/secrets/anthropic_api_key` instead of environment variable.

## Scaling

Scale the web service to handle more traffic:

```bash
# Scale to 3 replicas
./deploy.sh scale 3

# Scale to 5 replicas
docker service scale portfolio_web=5
```

## Monitoring

### View Service Status

```bash
docker stack services portfolio
```

### View Running Tasks

```bash
docker stack ps portfolio
```

### View Logs

```bash
# Follow logs
./deploy.sh logs

# View specific service logs
docker service logs portfolio_web

# View last 100 lines
docker service logs --tail 100 portfolio_web
```

### Inspect Service

```bash
docker service inspect portfolio_web
```

## Updating the Application

When you make code changes:

```bash
# Rolling update (zero downtime)
./deploy.sh update
```

This will:
1. Build a new Docker image
2. Update replicas one by one
3. Verify health checks before proceeding
4. Rollback automatically if update fails

## Load Balancing with Traefik (Optional)

The docker-compose.yml includes Traefik labels for automatic SSL and load balancing.

To use Traefik:

1. Deploy Traefik to your Swarm:
```bash
docker network create --driver=overlay traefik-public
docker stack deploy -c traefik-compose.yml traefik
```

2. Update the domain in docker-compose.yml:
```yaml
- "traefik.http.routers.portfolio.rule=Host(`your-domain.com`)"
```

3. Deploy the stack (Traefik will handle SSL certificates automatically)

## Production Recommendations

### 1. Use Redis for Session Storage

Update `server.js` to use Redis instead of in-memory Map:

```javascript
const Redis = require('ioredis');
const redis = new Redis({
  host: 'redis',
  port: 6379
});
```

### 2. Add Rate Limiting Middleware

Install and configure express-rate-limit with Redis store:

```bash
npm install express-rate-limit rate-limit-redis
```

### 3. Enable HTTPS

Use a reverse proxy like Traefik or Nginx with Let's Encrypt.

### 4. Configure Logging

Use a centralized logging solution:
- Docker logging driver (e.g., json-file, syslog, gelf)
- External services (e.g., CloudWatch, Datadog, Elasticsearch)

### 5. Monitoring and Alerts

Set up monitoring with:
- Docker health checks (already configured)
- Prometheus + Grafana
- Application Performance Monitoring (APM) tools

### 6. Backup Strategy

For Redis data:
```bash
# Backup
docker run --rm --volumes-from portfolio_redis_1 \
  -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data

# Restore
docker run --rm --volumes-from portfolio_redis_1 \
  -v $(pwd):/backup alpine tar xzf /backup/redis-backup.tar.gz
```

## Troubleshooting

### Service Won't Start

Check logs:
```bash
docker service logs portfolio_web
```

Check service status:
```bash
docker service ps portfolio_web --no-trunc
```

### Can't Access Application

Verify port binding:
```bash
docker service inspect portfolio_web | grep PublishedPort
```

Check if service is running:
```bash
docker service ls
```

### Secret Not Found

Recreate secret:
```bash
docker secret rm anthropic_api_key
echo "your-api-key" | docker secret create anthropic_api_key -
```

### Rolling Update Failed

Rollback to previous version:
```bash
docker service rollback portfolio_web
```

### Remove Everything

```bash
# Remove stack
./deploy.sh remove

# Remove volumes
docker volume rm portfolio_redis-data

# Remove secrets
docker secret rm anthropic_api_key

# Leave swarm (if needed)
docker swarm leave --force
```

## Resource Usage

Typical resource usage:
- **Memory**: 200-300MB per replica (under normal load)
- **CPU**: 0.2-0.5 cores per replica (spikes during AI requests)
- **Disk**: ~100MB for image + Redis data

For production with expected high traffic:
- Minimum: 2 web replicas, 2GB RAM total
- Recommended: 3-5 web replicas, 4GB RAM total

## Security Considerations

1. **Never commit .env files** - Already in .gitignore
2. **Use Docker secrets** - API key not exposed in environment
3. **Non-root user** - Container runs as nodejs user (UID 1001)
4. **Health checks** - Automatic container restart on failure
5. **Network isolation** - Services communicate on private overlay network
6. **Rate limiting** - Built into application (20 req/min per session)
7. **Input validation** - Jailbreak protection enabled

## Further Reading

- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)
- [Docker Compose File Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
