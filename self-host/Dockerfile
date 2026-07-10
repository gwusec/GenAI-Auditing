# Multi-stage build for self-hosting the TRAILS app + relay.
#
# Why multi-stage: Create-React-App bakes REACT_APP_* env vars at BUILD time, so
# the Supabase URL / anon key and the seam flags must be passed as build args
# (not runtime env). The run stage then serves the static build via server.js,
# which also acts as the LLM relay.
#
# Build context = repo root:  docker build -f self-host/Dockerfile ..

# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# Supabase + feature flags baked into the static bundle
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY
ARG REACT_APP_AUTH=supabase
ARG REACT_APP_STUDIES=supabase
ARG REACT_APP_PERSISTENCE=supabase
ARG REACT_APP_FEATURE0=on
ENV REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL \
    REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY \
    REACT_APP_AUTH=$REACT_APP_AUTH \
    REACT_APP_STUDIES=$REACT_APP_STUDIES \
    REACT_APP_PERSISTENCE=$REACT_APP_PERSISTENCE \
    REACT_APP_FEATURE0=$REACT_APP_FEATURE0 \
    CI=false

COPY package.json ./
# package-lock.json is currently gitignored, so use npm install (not npm ci).
# @supabase/supabase-js is a declared dependency, so it's installed here.
RUN npm install
COPY . .
RUN npm run build

# ---------- run stage ----------
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app/build ./build
COPY server/package.json ./package.json
COPY server/server.js ./server.js
RUN npm install --only=production
EXPOSE 3000
CMD ["node", "server.js"]
