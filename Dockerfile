# Root Dockerfile for Cloud Build (trigger expects Dockerfile at repo root).
# Builds the backend; all sources are in backend/.

# Build stage
FROM node:18 AS builder

WORKDIR /app

# Copy package files from backend
COPY backend/package*.json backend/tsconfig.json ./

# Install dependencies (npm install: works without package-lock.json; use npm ci + lock file for reproducible builds)
RUN npm install

# Copy source code
COPY backend/src ./src
COPY backend/prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18

WORKDIR /app

# Install curl and OpenSSL (for Prisma / libssl) and clean up apt cache
RUN apt-get update && \
    apt-get install -y curl openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files from backend
COPY backend/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# Generate Prisma Client for production
RUN npx prisma generate

# Entrypoint: run migrations then start app (for Cloud Run / GCP)
COPY backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
