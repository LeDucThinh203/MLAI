# ==========================================
# 🐳 DOCKERFILE - CASEFLOW AI ENTERPRISE PLATFORM
# ==========================================
FROM node:20-alpine AS base
WORKDIR /app

# Install native dependencies for sharp & sqlite on Alpine Linux
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev

# Copy package files
COPY package*.json ./
COPY Part1_JWT_Auth/backend/package*.json ./Part1_JWT_Auth/backend/
COPY Part1_JWT_Auth/frontend/package*.json ./Part1_JWT_Auth/frontend/

# Install dependencies
RUN npm install
RUN cd Part1_JWT_Auth/backend && npm install
RUN cd Part1_JWT_Auth/frontend && npm install

# Copy source code
COPY . .

# Build frontend production bundle
RUN cd Part1_JWT_Auth/frontend && npm run build

# Expose API port (3001)
EXPOSE 3001

# Environment & Data directory
ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data

RUN mkdir -p /app/data /app/uploads

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start Backend Server
CMD ["node", "Part1_JWT_Auth/backend/server.js"]
