FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source files
COPY src/ ./src/
COPY public/ ./public/

# Create data directory
RUN mkdir -p /data

# Set environment defaults
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app /data

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/healthz || exit 1

CMD ["node", "src/app.js"]
