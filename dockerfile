# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS builder

WORKDIR /app

# Install git and ssh for private repo access
RUN apk add --no-cache git openssh

# Set up SSH for private repo
RUN mkdir -p -m 0700 /root/.ssh && \
    ssh-keyscan -t ed25519 github.com >> /root/.ssh/known_hosts

# Copy package files
COPY package*.json ./

# Install ALL dependencies with SSH mount (including dev dependencies for building)
RUN --mount=type=ssh npm install --legacy-peer-deps

# Copy source code and build
COPY . .
RUN npm run build

# Production stage - serve both frontend and backend
FROM node:20-alpine AS production

WORKDIR /app

# Copy built React app, server files, and ALL dependencies from builder
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.js ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port 3000 (your server runs on this port)
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start the Express server (which also serves the React app)
CMD ["node", "server.js"]