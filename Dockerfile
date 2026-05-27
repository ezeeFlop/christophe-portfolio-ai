# Use official Node.js LTS image
FROM node:18-alpine

# Build arguments
ARG BUILD_DATE
ARG VERSION
ARG GIT_COMMIT

# Metadata labels
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.title="Christophe Verdier Portfolio"
LABEL org.opencontainers.image.description="AI-powered portfolio website for Christophe Verdier"
LABEL org.opencontainers.image.authors="Christophe Verdier <christophe.verdier@sponge-theory.ai>"
LABEL org.opencontainers.image.vendor="Sponge Theory"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY server.js ./
COPY system-prompt.js ./
COPY public ./public

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create the writable data dir for the page-view counter (a fresh named volume
# mounted here will inherit this ownership), then fix ownership of everything
RUN mkdir -p /app/data
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (default 3000)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
