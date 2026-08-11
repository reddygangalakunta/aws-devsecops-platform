# ==========================================
# Multi-Stage Secure Dockerfile for Node.js Gateway Microservice
# ==========================================

# Stage 1: Dependency Builder
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production Container
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production \
    PORT=3000

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Copy dependencies and application source
COPY --from=builder --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

# Run as unprivileged built-in user
USER node

EXPOSE 3000

# Container Healthcheck targeting Kubernetes/Docker liveness probe
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health/live || exit 1

CMD ["node", "src/index.js"]
