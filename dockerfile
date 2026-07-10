# Turnkey image: builds the Vite app, then serves it through the relay (server.js).
# `docker compose up --build` does everything — no host-side `npm run build` needed.

# --- Build stage: compile the Vite frontend ---
FROM node:20-alpine AS build
WORKDIR /app

# Feature 0 (accounts/roles/studies) is opt-in and inlined by Vite at build time.
# Default it ON for the self-host/demo image; override with --build-arg if desired.
ARG REACT_APP_FEATURE0=on
ENV REACT_APP_FEATURE0=$REACT_APP_FEATURE0

COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# --- Production stage: the relay holds API keys + serves the built app ---
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=build /app/build ./build
COPY server/package.json ./package.json
COPY server/server.js ./server.js
RUN npm install --only=production

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
