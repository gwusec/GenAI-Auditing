# Turnkey image: builds the Vite app, then serves it through the relay (server.js).
# `docker compose up --build` does everything — no host-side `npm run build` needed.

# --- Build stage: compile the Vite frontend ---
FROM node:20-alpine AS build
WORKDIR /app

# Feature 0 (accounts/roles/studies) is opt-in and inlined by Vite at build time.
# Default it ON for the self-host/demo image; override with --build-arg if desired.
ARG REACT_APP_FEATURE0=on
ENV REACT_APP_FEATURE0=$REACT_APP_FEATURE0

# Optional Supabase backend. Vite inlines REACT_APP_* at build time, and .env is
# not copied into the image (.dockerignore), so these come in as build args (wired
# from docker-compose.yml -> the .env next to it). Leave blank to keep the local
# mock/IndexedDB backend; set them to switch persistence/auth/studies to Supabase.
ARG REACT_APP_SUPABASE_URL=
ARG REACT_APP_SUPABASE_ANON_KEY=
ARG REACT_APP_AUTH=
ARG REACT_APP_STUDIES=
ARG REACT_APP_SESSIONS=
ARG REACT_APP_PERSISTENCE=
ENV REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL \
    REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY \
    REACT_APP_AUTH=$REACT_APP_AUTH \
    REACT_APP_STUDIES=$REACT_APP_STUDIES \
    REACT_APP_SESSIONS=$REACT_APP_SESSIONS \
    REACT_APP_PERSISTENCE=$REACT_APP_PERSISTENCE

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
COPY server/relayHelpers.js ./relayHelpers.js
RUN npm install --only=production

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
