FROM node:20-alpine AS base
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN apk add --no-cache curl
WORKDIR /app

FROM base AS deps
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

FROM base AS final
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN addgroup -S berisa && adduser -S berisa -G berisa
USER berisa
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:8080/api/health || exit 1
CMD ["node", "src/server.js"]
