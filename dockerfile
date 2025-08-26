FROM node:20-alpine AS production

WORKDIR /app

# Copy backend
COPY ./build ./build
COPY ./server/package.json ./package.json
COPY ./server/server.js ./server.js

# Install backend deps
RUN npm install --only=production

EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", "server.js"]