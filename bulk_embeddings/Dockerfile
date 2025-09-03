# Multi-stage Dockerfile for Bulk PDF Processor
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . ./

# Create directories for data
RUN mkdir -p /app/data /app/uploads /app/manifests

# Expose port for web UI
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Default command
CMD ["node", "bulk_embeddings/web-ui/server.js"]
