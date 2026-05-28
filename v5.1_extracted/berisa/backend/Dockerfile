FROM node:20-alpine AS base
RUN apk add --no-cache curl
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM base AS final
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN addgroup -S berisa && adduser -S berisa -G berisa
USER berisa
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1
CMD ["node", "server.js"]
