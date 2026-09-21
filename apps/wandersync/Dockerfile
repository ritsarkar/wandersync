# Multi-stage production build for WanderSync
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build production frontend bundle
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server

EXPOSE 4000

CMD ["node", "server/server.js"]
